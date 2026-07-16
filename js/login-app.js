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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
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
});
