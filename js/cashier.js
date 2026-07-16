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
  window.location.href = 'login.html';
};
window.toggleTheme = () => Theme.toggle();

document.addEventListener('DOMContentLoaded', async () => {
  UI.init();
  await StorageService.init();
  await Theme.init();

  // Restore session via centralized Session manager
  const session = Session.restoreSession();

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  // Validate role — cashier page is for cashier only
  if (!Session.isCashier(session.role)) {
    Session.redirectByRole(session.role);
    return;
  }

  // Restore Auth state
  Auth.setUser(session.user, session.role, session.userData);
  Auth.setDb(StorageService.readRaw());
  Auth.startActivityListeners();
  Auth.updateLastLogin();

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
});
