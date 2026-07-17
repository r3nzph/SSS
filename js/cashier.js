// ===============================
// CASHIER ENTRY POINT
// Loaded by: cashier.html
// Uses centralized Session manager
// ===============================

import Auth from './auth.js';
import UI from './ui.js';
import Theme from './theme.js';
import Audit from './audit.js';
import ReceiptViewer from './receipts.js';
import Session from './session.js';
import StorageService from './storage.js';
import CashierModule from './cashier-index.js';

console.log('[CASHIER] POS Terminal — Modular Web App');

// Expose receipt functions for HTML onclick handlers
window.closeReceipt = () => ReceiptViewer.closeReceipt();
window.printReceipt = () => ReceiptViewer.printReceipt();
window.viewReceipt = (id) => {
  const state = Auth.getState();
  const tx = (state.db.transactions || []).find(t => t.id === id);
  if (!tx) { UI.toast('Transaction not found.', 'error'); return; }
  ReceiptViewer.showReceipt(tx);
};
window.handleLogout = () => {
  UI.showLoading('Logging out...');
  try { Audit.logAction('LOGOUT', `User "${Auth.getState().user}" logged out`); } catch(e) {}
  Session.clearSession();
  Auth.clearSession();
  Session.redirectToIndex();
};
window.toggleTheme = () => Theme.toggle();

// ===============================
// INITIALIZATION LIFECYCLE
// ===============================

let _initCompleted = false;

// Safety timeout: if init doesn't complete in 10 seconds, show error
const _initTimeout = setTimeout(() => {
  if (!_initCompleted) {
    console.error('[CASHIER] FATAL: Initialization timed out after 10 seconds.');
    _showFatalError('Initialization timed out. The application could not start. Please refresh the page or clear your browser data.');
  }
}, 10000);

function _showFatalError(message) {
  // Hide loading overlay if visible
  try { UI.hideLoading(); } catch (_) {}
  // Clear any skeleton elements
  document.querySelectorAll('.skeleton, .skeleton-table-row, .skeleton-card, .skeleton-block').forEach(el => {
    el.innerHTML = '';
    el.className = '';
  });
  // Show error in cashier panel
  const panel = document.getElementById('cashier');
  if (panel) {
    panel.innerHTML = `<div style="text-align:center;padding:80px 20px;">
      <div style="font-size:3rem;margin-bottom:16px;">⚠️</div>
      <h2 style="font-size:1.5rem;margin-bottom:12px;">Failed to Load POS Terminal</h2>
      <p style="color:var(--text-secondary);margin-bottom:24px;max-width:480px;margin-left:auto;margin-right:auto;">${message}</p>
      <button class="btn btn-primary" onclick="location.reload()">🔄 Refresh Page</button>
    </div>`;
    panel.classList.add('active');
  }
}

// Global: catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[CASHIER] Unhandled Promise Rejection:', event.reason);
});

document.addEventListener('DOMContentLoaded', async () => {
  try {
    UI.init();
    await StorageService.init();

    // VERIFY: ensure data actually exists in localStorage
    // If init failed silently (e.g. crypto.subtle, localStorage quota),
    // force-create defaults so the app has data to work with.
    let rawDb = StorageService.readRaw();
    if (!rawDb) {
      console.warn('[CASHIER] Storage has no data after init. Force-initializing...');
      await StorageService.forceInit();
      rawDb = StorageService.readRaw();
      if (!rawDb) {
        console.error('[CASHIER] CRITICAL: Could not initialize storage data.');
        _showFatalError('Could not initialize storage. Please clear your browser data and refresh.');
        return;
      }
      console.log('[CASHIER] Storage force-initialized successfully.');
    }

    await Theme.init();

    // Restore session via centralized Session manager
    const session = Session.restoreSession();

    if (!session) {
      _initCompleted = true;
      clearTimeout(_initTimeout);
      Session.redirectToIndex();
      return;
    }

    // Validate role — cashier page is for cashiers and admins
    if (!Session.canAccessCashierPage(session.role)) {
      _initCompleted = true;
      clearTimeout(_initTimeout);
      Session.redirectByRole(session.role);
      return;
    }

    // Restore Auth state
    Auth.setUser(session.user, session.role, session.userData);
    Auth.setDb(rawDb);
    Auth.startActivityListeners();
    Auth.updateLastLogin().catch(e => console.error('[CASHIER] updateLastLogin failed:', e));

    // Update sidebar
    const displayName = (session.userData && session.userData.fullName) || session.user;
    const displayEl = document.getElementById('currentUserDisplay');
    if (displayEl) displayEl.innerText = displayName;
    const roleEl = document.getElementById('currentUserRole');
    if (roleEl) roleEl.innerText = session.role;
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl) avatarEl.textContent = displayName.charAt(0).toUpperCase();

    // Initialize cashier module
    CashierModule.init();
    CashierModule.switchView('cashier');
    CashierModule.refreshAll();

    // Ripple effect
    document.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b && !b.closest('.toast') && !b.closest('.modal-close')) UI.ripple(e);
    });

    _initCompleted = true;
    clearTimeout(_initTimeout);
  } catch (e) {
    console.error('[CASHIER] Fatal initialization error:', e);
    _showFatalError('A critical error occurred during initialization: ' + (e.message || 'Unknown error') + '. Please refresh the page or clear your browser data.');
  }
});
