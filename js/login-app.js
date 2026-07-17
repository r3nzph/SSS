// ===============================
// LOGIN ENTRY POINT — Lightweight
// Loaded by: login.html
// Only loads what's needed for authentication.
// Uses LoginUI instead of full UI (no admin confirm/prompt dialogs).
// ===============================

import Auth from './auth.js';
import LoginUI from './login-ui.js';
import Theme from './theme.js';
import Login from './login.js';
import Session from './session.js';
import StorageService from './storage.js';

console.log('[LOGIN] Sari-Sari Store POS — Login Page');

// Inject lightweight UI module (no confirm/prompt dialogs)
Login.setUI(LoginUI);

// Expose globals for HTML onclick handlers
window.handleLogin = () => Login.handleLogin();
window.handleLogout = () => Login.handleLogout();
window.togglePassword = (inputId, toggleBtnId) => LoginUI.togglePassword(inputId, toggleBtnId);
window.toggleTheme = () => Theme.toggle();
if (!window.handleForgotPassword) {
  window.handleForgotPassword = () => {
    alert('Please contact your administrator to reset your password.');
  };
}

// ===============================
// INITIALIZATION LIFECYCLE
// ===============================

let _initCompleted = false;

// Safety timeout: if init doesn't complete in 10 seconds, show error
const _initTimeout = setTimeout(() => {
  if (!_initCompleted) {
    console.error('[LOGIN] FATAL: Initialization timed out after 10 seconds.');
    _showFatalError('Initialization timed out. Please refresh the page or clear your browser data.');
  }
}, 10000);

function _showFatalError(message) {
  // Hide loading overlay if visible
  try { LoginUI.hideLoading(); } catch (_) {}
  // Show error in login card
  const loginForm = document.querySelector('.login-form');
  if (loginForm) {
    loginForm.innerHTML = `<div style="text-align:center;padding:20px;">
      <div style="font-size:2.5rem;margin-bottom:12px;">⚠️</div>
      <h3 style="margin-bottom:8px;">Failed to Load</h3>
      <p style="color:var(--text-secondary);margin-bottom:16px;font-size:0.9rem;">${message}</p>
      <button class="btn btn-primary" onclick="location.reload()">🔄 Refresh Page</button>
    </div>`;
  }
}

// Global: catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[LOGIN] Unhandled Promise Rejection:', event.reason);
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize lightweight UI (toast + loading only, no confirm/prompt)
    LoginUI.init();

    // Initialize storage (creates default user data if needed)
    await StorageService.init();

    // Load and apply theme
    await Theme.init();

    // Check if already logged in via sessionStorage
    const session = Session.restoreSession();
    if (session) {
      Auth.setUser(session.user, session.role, session.userData);
      Auth.setDb(StorageService.readRaw());
      _initCompleted = true;
      clearTimeout(_initTimeout);
      Session.redirectByRole(session.role);
      return;
    }

    // Restore remembered username (localStorage)
    const rememberedUser = Session.getRememberedUser();
    if (rememberedUser) {
      const usernameInput = document.getElementById('username');
      if (usernameInput) usernameInput.value = rememberedUser;
      const rememberCheck = document.getElementById('rememberMe');
      if (rememberCheck) rememberCheck.checked = true;
    }

    // Ripple effect on buttons
    document.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b && !b.closest('.toast') && !b.closest('.modal-close')) LoginUI.ripple(e);
    });

    _initCompleted = true;
    clearTimeout(_initTimeout);
  } catch (e) {
    console.error('[LOGIN] Fatal initialization error:', e);
    _showFatalError('A critical error occurred: ' + (e.message || 'Unknown error') + '. Please refresh the page or clear your browser data.');
  }
});
