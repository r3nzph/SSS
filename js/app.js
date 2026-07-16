// ===============================
// APP ENTRY POINT — Login Page
// Loaded by: login.html
// ===============================

import Auth from './auth.js';
import UI from './ui.js';
import Theme from './theme.js';
import Login from './login.js';
import Session from './session.js';
import StorageService from './storage.js';

console.log('[APP] Sari-Sari Store POS — Modular Web App');

// Expose globals for HTML onclick handlers
window.handleLogin = () => Login.handleLogin();
window.handleLogout = () => Login.handleLogout();
window.togglePassword = (inputId, toggleBtnId) => UI.togglePassword(inputId, toggleBtnId);
window.toggleTheme = () => Theme.toggle();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  UI.init();

  // Initialize storage (creates default data if needed)
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

  // Ripple effect
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && !b.closest('.toast') && !b.closest('.modal-close')) UI.ripple(e);
  });
});
