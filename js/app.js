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

// ===============================
// INITIALIZATION LIFECYCLE
// ===============================

let _initCompleted = false;

// Safety timeout: if init doesn't complete in 10 seconds, show error
const _initTimeout = setTimeout(() => {
  if (!_initCompleted) {
    console.error('[APP] FATAL: Initialization timed out after 10 seconds.');
  }
}, 10000);

// Global: catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[APP] Unhandled Promise Rejection:', event.reason);
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
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

    _initCompleted = true;
    clearTimeout(_initTimeout);
  } catch (e) {
    console.error('[APP] Fatal initialization error:', e);
  }
});
