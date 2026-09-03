# AI Code Generator & Debugger Bug Fixes Plan

## Information Gathered:
- Current files have specific bugs as detailed in user feedback
- app.py has duplicate templates init, buggy debug parser, missing re import
- main.js has shared session, whitespace mangling escapeHtml, no auto-resize, theme class baked in
- style.css missing code-block theme rules, textarea resize issues
- index.html no issues
- Backend FastAPI + Groq, frontend Vanilla JS + HLJS

## Plan:
1. **app.py**:
   - Add import re # FIX 4
   - Remove duplicate templates = Jinja2Templates(...) # FIX 6
   - Replace debug parser with regex matching # FIX 4 - raise PARSE_ERROR instead of fallback

2. **static/js/main.js**:
   - Replace single session with {generator:null, debugger:null, chat:null} # FIX 1
   - Add escapeCode for code blocks (preserve whitespace) # FIX 2
   - Add autoResize method + bind to all textareas # FIX 3
   - Remove ${this.theme} from code-block divs # FIX 5
   - Replace hljs.highlightAll() with targeted block.forEach(hljs.highlightElement) # FIX 2
   - Update apiCall to accept sessionKey param

3. **static/css/style.css**:
   - Add [data-theme="light"] .code-block {bg #f6f8fa} rules # FIX 5
   - Update textarea: resize:none; max-height:300px; overflow-y:auto # FIX 3

4. **templates/index.html**: No changes

## Dependent Files to be edited:
- app.py
- static/js/main.js
- static/css/style.css

## Followup steps:
✓ 1. Apply edits
2. cd d:/GENAI/ai-code-gen && venv\\Scripts\\activate && pip install -r requirements.txt (if needed)
3. uvicorn app:app --reload
4. Test all 6 acceptance tests
5. Update TODO.md with ✓ completed steps

<ask_followup_question>
Does this plan look correct? Any changes before I proceed with the edits?
</ask_followup_question>
