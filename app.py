import os
import uuid
from typing import Dict, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
import asyncio
import uvicorn
import re

load_dotenv()

sessions: Dict[str, list] = {}

app = FastAPI()

# CORS - restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")  # only ONE instance

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in .env file")

client = Groq(api_key=GROQ_API_KEY)

# Groq retired llama-3.3-70b-versatile; override with GROQ_MODEL env var if needed
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")


class GenerateRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None


class DebugRequest(BaseModel):
    code: str
    error: Optional[str] = None
    session_id: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


def get_or_create_session(session_id: Optional[str]) -> str:
    if not session_id:
        session_id = str(uuid.uuid4())
    if session_id not in sessions:
        sessions[session_id] = []
    return session_id


# BUG 1 FIX: use synchronous create() wrapped in run_in_executor
# create_async() does not exist in the groq package
async def groq_chat(prompt: str, history: list = None, timeout: int = 30) -> str:
    try:
        messages = [{"role": "user", "content": prompt}]
        if history:
            messages = history + messages

        loop = asyncio.get_event_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(None, lambda: client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                max_tokens=8192,
                temperature=0.1,
            )),
            timeout=timeout
        )
        return response.choices[0].message.content
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=500,
            detail={"error": True, "message": "Request timed out. Try again.", "code": "TIMEOUT"}
        )
    except Exception as e:
        print(f"Groq API error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"error": True, "message": f"Groq API failure: {str(e)}", "code": "GROQ_ERROR"}
        )


@app.post("/generate")
async def generate_code(request: GenerateRequest):
    if not request.prompt.strip():
        raise HTTPException(
            status_code=400,
            detail={"error": True, "message": "Prompt cannot be empty", "code": "EMPTY_INPUT"}
        )

    session_id = get_or_create_session(request.session_id)

    prompt = f"""You are an expert Python developer. Generate clean, well-commented, \
fully working Python code for the following request: {request.prompt}. \
Return only the code with brief inline comments. No explanations outside the code."""

    try:
        response = await groq_chat(prompt)
        return {"code": response.strip(), "explanation": "Code generated successfully", "session_id": session_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Generate error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"error": True, "message": str(e), "code": "SERVER_ERROR"}
        )


@app.post("/debug")
async def debug_code(request: DebugRequest):
    if not request.code.strip():
        raise HTTPException(
            status_code=400,
            detail={"error": True, "message": "Code cannot be empty", "code": "EMPTY_INPUT"}
        )

    session_id = get_or_create_session(request.session_id)
    error_msg = request.error or "No error message provided"

    prompt = f"""You are an expert Python debugger. Analyze this broken Python code:
```
{request.code}
```
Error message: {error_msg}.

Find all bugs, fix them, and return your response in EXACTLY this format with no deviation:

**FIXED_CODE**
```python
[complete fixed code here]
```

**EXPLANATION**
[what was wrong]

**DIFF_SUMMARY**
• [change 1]
• [change 2]"""

    try:
        response = await groq_chat(prompt)

        # BUG 2 FIX: robust regex parsing that never returns undefined fields
        fixed_code_match = re.search(r'\*\*FIXED_CODE\*\*\s*```python\s*(.*?)```', response, re.DOTALL)
        explanation_match = re.search(r'\*\*EXPLANATION\*\*\s*(.*?)(?=\*\*DIFF_SUMMARY\*\*|\Z)', response, re.DOTALL)
        diff_match = re.search(r'\*\*DIFF_SUMMARY\*\*(.*?)$', response, re.DOTALL)

        # Always return a string - never undefined or None
        fixed_code = fixed_code_match.group(1).strip() if fixed_code_match else response.strip()
        explanation = explanation_match.group(1).strip() if explanation_match else "Code has been analyzed and fixed"
        diff_summary = diff_match.group(1).strip() if diff_match else "• Code corrected"

        return {
            "fixed_code": fixed_code,
            "explanation": explanation,
            "diff_summary": diff_summary,
            "session_id": session_id
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Debug error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"error": True, "message": str(e), "code": "SERVER_ERROR"}
        )


@app.post("/chat")
async def chat(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(
            status_code=400,
            detail={"error": True, "message": "Message cannot be empty", "code": "EMPTY_INPUT"}
        )

    session_id = get_or_create_session(request.session_id)
    history = sessions.get(session_id, [])

    prompt = f"""You are a helpful Python programming assistant. \
Answer this question clearly and conversationally: {request.message}"""

    try:
        response = await groq_chat(prompt, history)

        history.append({"role": "user", "content": request.message})
        history.append({"role": "assistant", "content": response})
        if len(history) > 20:
            history = history[-20:]
        sessions[session_id] = history

        return {"reply": response, "session_id": session_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Chat error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"error": True, "message": str(e), "code": "SERVER_ERROR"}
        )


# BUG 3 FIX: Starlette 1.0.0 changed TemplateResponse signature
# Old: TemplateResponse("file.html", {"request": request})
# New: TemplateResponse(request, "file.html")
@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse(request, "index.html")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)