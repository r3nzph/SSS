// ===============================
// SHARED UI MODULE
// Toast notifications, confirm/prompt dialogs,
// loading screen, animations, theme, password toggle
// ===============================

const UI = {
  _toastContainer: null,
  _confirmOverlay: null,
  _confirmResolve: null,
  _promptOverlay: null,
  _promptResolve: null,

  init() {
    if (!document.getElementById('toastContainer')) {
      const container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    this._toastContainer = document.getElementById('toastContainer');

    if (!document.getElementById('confirmModal')) {
      const html = `
        <div id="confirmModal" class="dialog-overlay">
          <div class="dialog-box glass-card">
            <div class="dialog-header">
              <span class="dialog-icon">⚠️</span>
              <h3 id="confirmTitle">Confirm</h3>
            </div>
            <p id="confirmMessage" class="dialog-message"></p>
            <div class="dialog-actions">
              <button class="btn btn-ghost" id="confirmCancelBtn">Cancel</button>
              <button class="btn btn-danger" id="confirmOkBtn">Confirm</button>
            </div>
          </div>
        </div>`;
      document.body.insertAdjacentHTML('beforeend', html);
    }
    this._confirmOverlay = document.getElementById('confirmModal');
    document.getElementById('confirmCancelBtn').onclick = () => { this._confirmResolve(false); this.closeConfirm(); };
    document.getElementById('confirmOkBtn').onclick = () => { this._confirmResolve(true); this.closeConfirm(); };
    this._confirmOverlay.onclick = (e) => {
      if (e.target === this._confirmOverlay) { this._confirmResolve(false); this.closeConfirm(); }
    };

    if (!document.getElementById('promptModal')) {
      const html = `
        <div id="promptModal" class="dialog-overlay">
          <div class="dialog-box glass-card">
            <div class="dialog-header">
              <span class="dialog-icon">📝</span>
              <h3 id="promptTitle">Input</h3>
            </div>
            <p id="promptMessage" class="dialog-message"></p>
            <input type="text" id="promptInput" class="dialog-input" placeholder="Enter value...">
            <div class="dialog-actions">
              <button class="btn btn-ghost" id="promptCancelBtn">Cancel</button>
              <button class="btn btn-primary" id="promptOkBtn">OK</button>
            </div>
          </div>
        </div>`;
      document.body.insertAdjacentHTML('beforeend', html);
    }
    this._promptOverlay = document.getElementById('promptModal');
    document.getElementById('promptCancelBtn').onclick = () => { this._promptResolve(null); this.closePrompt(); };
    document.getElementById('promptOkBtn').onclick = () => {
      const val = document.getElementById('promptInput').value;
      this._promptResolve(val); this.closePrompt();
    };
    document.getElementById('promptInput').onkeydown = (e) => {
      if (e.key === 'Enter') document.getElementById('promptOkBtn').click();
      if (e.key === 'Escape') document.getElementById('promptCancelBtn').click();
    };
    this._promptOverlay.onclick = (e) => {
      if (e.target === this._promptOverlay) { this._promptResolve(null); this.closePrompt(); }
    };
  },

  toast(message, type = 'info', duration = 3500) {
    if (!message || !this._toastContainer) return;
    const existing = this._toastContainer?.querySelector('.toast:last-child .toast-message');
    if (existing && existing.textContent === message) return;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast-message">${this._escapeHtml(message)}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;
    this._toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    if (duration > 0) {
      setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
  },

  confirm(message, title = 'Confirm') {
    return new Promise(resolve => {
      this._confirmResolve = resolve;
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmMessage').textContent = message;
      this._confirmOverlay.classList.add('active');
    });
  },

  prompt(message, defaultValue = '', title = 'Input') {
    return new Promise(resolve => {
      this._promptResolve = resolve;
      document.getElementById('promptTitle').textContent = title;
      document.getElementById('promptMessage').textContent = message;
      document.getElementById('promptInput').value = defaultValue;
      this._promptOverlay.classList.add('active');
      setTimeout(() => document.getElementById('promptInput').focus(), 100);
    });
  },

  closeConfirm() { this._confirmOverlay.classList.remove('active'); },
  closePrompt() { this._promptOverlay.classList.remove('active'); },

  showLoading(message = 'Loading...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loadingOverlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `<div class="loading-spinner"></div><p class="loading-text" id="loadingText"></p>`;
      document.body.appendChild(overlay);
    }
    document.getElementById('loadingText').textContent = message;
    overlay.classList.add('active');
  },

  hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
  },

  togglePassword(inputId, toggleBtnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(toggleBtnId);
    if (!input || !btn) return;
    if (input.type === 'password') {
      input.type = 'text'; btn.textContent = '🙈'; btn.title = 'Hide password';
    } else {
      input.type = 'password'; btn.textContent = '👁️'; btn.title = 'Show password';
    }
  },

  ripple(e) {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  },

  /** Toggle theme via Theme module */
  toggleTheme() {
    import('./theme.js').then(m => m.default.toggle());
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

export default UI;
