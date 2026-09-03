# AI Code Generator & Debugger

A complete web application powered by Groq's Llama3-70B model that provides three powerful AI coding tools:

1. **Code Generator** - Describe what you want, get clean Python code
2. **Debugger** - Fix broken code with detailed explanations and diffs  
3. **Chat Assistant** - Ask Python questions conversationally

Fully functional with syntax highlighting, copy-to-clipboard, dark/light mode, and responsive design.

## Get Groq API Key (Free)

1. Go to [https://console.groq.com](https://console.groq.com)
2. Sign up / login
3. Go to API Keys → Create API Key
4. Copy your key

## Setup

```bash
cd d:/GENAI/ai-code-gen
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

**Start the server:**
```bash
uvicorn app:app --reload
```

Open [http://localhost:8000](http://localhost:8000)

## Folder Structure

```
ai-code-gen/
├── app.py                 # FastAPI backend
├── requirements.txt       # Dependencies
├── .env                   # Your API key
├── .env.example          # Template
├── README.md
├── templates/
│   └── index.html        # Frontend
└── static/
    ├── css/
    │   └── style.css
    └── js/
        └── main.js
```

## API Endpoints

### Generate Code
```bash
curl -X POST "http://localhost:8000/generate" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "write a fibonacci function"}'
```

### Debug Code
```bash
curl -X POST "http://localhost:8000/debug" \
  -H "Content-Type: application/json" \
  -d '{"code": "def foo(x)\n  return x + 1", "error": "SyntaxError"}'
```

### Chat
```bash
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "what is a decorator?"}'
```

## Features

✅ **Zero hardcoded responses** - Real Groq API calls  
✅ **3 isolated tabs** with independent state  
✅ **Syntax highlighting** with Highlight.js  
✅ **Copy to clipboard** on all code blocks  
✅ **Dark/light mode** (persisted)  
✅ **Responsive design** mobile-first  
✅ **Session management** with conversation history  
✅ **10s timeout** protection  
✅ **Error handling** everywhere  
✅ **Loading states** and typing indicators  

## Troubleshooting

**Missing API key**
```
ValueError: GROQ_API_KEY not found in .env file
```
→ Copy `.env.example` to `.env` and add your key

**Port conflict**
```
Address already in use
```
→ `uvicorn app:app --reload --port 8001`

**CORS error**
Browser only - development origins=["*"] enabled

**Highlight.js not loading**
CDN issue - reload page

**Groq rate limit**
```
GROQ_ERROR
```
Wait or get higher quota at console.groq.com

## Tech Stack

- **Backend**: FastAPI 0.111.0 + Uvicorn
- **AI**: Groq Llama3-70B-8192  
- **Frontend**: Vanilla JS + Jinja2 + Highlight.js
- **Styling**: CSS Custom Properties + Inter font
