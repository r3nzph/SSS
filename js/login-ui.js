// ===============================
// LOGIN UI — Minimal UI for login page
// Toast notifications, loading overlay, password toggle, ripple
// Does NOT create confirm/prompt dialogs (admin-only components)
// ===============================

const LoginUI = {
  _toastContainer: null,

  init() {
    // Create toast container only
    if (!document.getElementById('toastContainer')) {
      const container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    this._toastContainer = document.getElementById('toastContainer');
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

  showLoading(message = 'Signing in...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loadingOverlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `<div class="loading-spinner"></div><p class="loading-text" id="loadingText">${message}</p>`;
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

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

export default LoginUI;
