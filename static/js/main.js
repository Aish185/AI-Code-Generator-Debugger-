class AICodeApp {
    constructor() {
        // Separate sessions per tab - no cross-contamination
        this.sessions = { generator: null, debugger: null, chat: null };
        this.theme = localStorage.getItem('theme') || 'dark';
        this.init();
    }
 
    init() {
        // Apply theme before render to prevent flash
        this.setTheme();
        this.bindEvents();
        hljs.configure({ languages: ['python'] });
    }
 
    setTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const sun = document.querySelector('.sun');
        const moon = document.querySelector('.moon');
        if (sun) sun.style.opacity = this.theme === 'dark' ? '0' : '0.5';
        if (moon) moon.style.opacity = this.theme === 'dark' ? '0.5' : '1';
    }
 
    bindEvents() {
        // Theme toggle
        document.querySelector('.theme-toggle').addEventListener('click', () => {
            this.theme = this.theme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', this.theme);
            this.setTheme();
        });
 
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.currentTarget.dataset.tab);
            });
        });
 
        // Auto-resize all textareas
        document.querySelectorAll('textarea').forEach(ta => {
            ta.addEventListener('input', () => this.autoResize(ta));
        });
 
        // Generator - Ctrl+Enter to submit
        document.getElementById('gen-submit').addEventListener('click', () => this.generateCode());
        document.getElementById('gen-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) this.generateCode();
        });
 
        // Debugger - Ctrl+Enter to submit
        document.getElementById('debug-submit').addEventListener('click', () => this.debugCode());
        document.getElementById('debug-code').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) this.debugCode();
        });
 
        // Chat - Enter to send, Shift+Enter for newline
        document.getElementById('chat-submit').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('chat-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.shiftKey) return;
                e.preventDefault();
                this.sendChatMessage();
            }
        });
    }
 
    switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');
    }
 
    // BUG 1 FIX: Each tab uses its own session key
    async apiCall(endpoint, data, sessionKey) {
        const sessionId = this.sessions[sessionKey];
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, session_id: sessionId })
            });
 
            const result = await response.json();
 
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Unknown server error');
            }
 
            this.sessions[sessionKey] = result.session_id;
            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
 
    async generateCode() {
        const input = document.getElementById('gen-input');
        const output = document.getElementById('gen-output');
        const btn = document.getElementById('gen-submit');
 
        if (!input.value.trim()) return;
 
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        output.innerHTML = '<div class="typing-indicator">Generating code <div class="typing-dots"><span></span><span></span><span></span></div></div>';
 
        try {
            const result = await this.apiCall('/generate', { prompt: input.value }, 'generator');
 
            // Use escapeCode for code blocks to preserve whitespace
            output.innerHTML = `
                <div class="code-block">
                    <div class="code-header">
                        <span class="language-label">python</span>
                        <button class="copy-btn" onclick="app.copyCode(this)">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                    </div>
                    <pre><code class="language-python">${this.escapeCode(result.code || '')}</code></pre>
                </div>
                <div style="color: var(--text-secondary); padding: 1rem; background: var(--bg-secondary); border-radius: 8px; margin-top: 0.5rem;">
                    ${this.escapeHtml(result.explanation || '')}
                </div>
            `;
            document.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
            });
        } catch (error) {
            output.innerHTML = `<div class="error-box">Error: ${this.escapeHtml(error.message)}</div>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-magic"></i> Generate Code';
        }
    }
 
    async debugCode() {
        const codeInput = document.getElementById('debug-code');
        const errorInput = document.getElementById('debug-error');
        const output = document.getElementById('debug-output');
        const btn = document.getElementById('debug-submit');
 
        if (!codeInput.value.trim()) return;
 
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Debugging...';
        output.innerHTML = '<div class="typing-indicator">Debugging code <div class="typing-dots"><span></span><span></span><span></span></div></div>';
 
        try {
            const result = await this.apiCall('/debug', {
                code: codeInput.value,
                error: errorInput.value
            }, 'debugger');
 
            // BUG 2 FIX: null guards so escapeCode never receives undefined
            const fixedCode = result.fixed_code || '';
            const explanation = result.explanation || 'No explanation provided';
            const diffSummary = result.diff_summary || '• Code corrected';
 
            output.innerHTML = `
                <div class="warning-box">
                    <strong>What was wrong:</strong><br>
                    ${this.escapeHtml(explanation)}<br><br>
                    <strong>Changes made:</strong><br>
                    ${this.escapeHtml(diffSummary)}
                </div>
                <div class="code-block">
                    <div class="code-header">
                        <span class="language-label">python (fixed)</span>
                        <button class="copy-btn" onclick="app.copyCode(this)">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                    </div>
                    <pre><code class="language-python">${this.escapeCode(fixedCode)}</code></pre>
                </div>
            `;
            document.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
            });
        } catch (error) {
            output.innerHTML = `<div class="error-box">Error: ${this.escapeHtml(error.message)}</div>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-wrench"></i> Debug Code';
        }
    }
 
    async sendChatMessage() {
        const input = document.getElementById('chat-input');
        const messages = document.getElementById('chat-messages');
        const btn = document.getElementById('chat-submit');
 
        if (!input.value.trim()) return;
 
        const message = input.value.trim();
        input.value = '';
        this.autoResize(input);
 
        this.addChatMessage('user', message);
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
 
        const typingId = this.addTypingIndicator();
 
        try {
            const result = await this.apiCall('/chat', { message }, 'chat');
            this.removeTypingIndicator(typingId);
            this.addChatMessage('ai', result.reply || 'No response received');
        } catch (error) {
            this.removeTypingIndicator(typingId);
            this.addChatMessage('ai', `Error: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
    }
 
    addChatMessage(sender, content) {
        const messages = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = `chat-message ${sender}`;
        div.innerHTML = `
            <div class="chat-avatar ${sender}">
                ${sender === 'ai' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>'}
            </div>
            <div class="chat-content">${this.escapeHtml(content)}</div>
        `;
        messages.appendChild(div);
        this.scrollToBottom();
    }
 
    addTypingIndicator() {
        const id = 'typing-' + Date.now();
        const messages = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.id = id;
        div.className = 'chat-message ai';
        div.innerHTML = `
            <div class="chat-avatar ai"><i class="fas fa-robot"></i></div>
            <div class="chat-content typing-indicator">
                <div class="typing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        messages.appendChild(div);
        this.scrollToBottom();
        return id;
    }
 
    removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }
 
    scrollToBottom() {
        const messages = document.getElementById('chat-messages');
        if (messages) messages.scrollTop = messages.scrollHeight;
    }
 
    copyCode(btn) {
        const code = btn.closest('.code-block').querySelector('pre code').textContent;
        navigator.clipboard.writeText(code).then(() => {
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            btn.classList.add('copy-success');
            setTimeout(() => {
                btn.innerHTML = original;
                btn.classList.remove('copy-success');
            }, 2000);
        }).catch(() => {
            btn.innerHTML = '<i class="fas fa-times"></i> Failed';
            setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> Copy'; }, 2000);
        });
    }
 
    // BUG 2 FIX: proper whitespace preservation for code blocks
    escapeCode(code) {
        if (!code) return '';
        return code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
 
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
 
    autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
    }
}
 
const app = new AICodeApp();