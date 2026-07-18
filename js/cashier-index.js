// ===============================
// CASHIER MODULE ENTRY POINT
// Navigation & initialization for cashier views
// ===============================

import Auth from './auth.js';
import UI from './ui.js';
import { escapeHtml, formatCurrency, formatDate } from './utils.js';
import ReceiptViewer from './receipts.js';
import CashierPOS from './pos.js';
import Sales from './transactions.js';
import StorageService from './storage.js';
import Audit from './audit.js';
import Skeleton from './skeleton.js';

const CashierModule = {
  _initialized: false,
  _currentView: 'cashier',

  init() {
    if (!Auth.isCashier()) {
      console.error('[CASHIER] Blocked: Non-cashier user attempted to load cashier module.');
      UI.toast('Access Denied: Cashier module cannot be loaded.', 'error');
      return;
    }
    if (this._initialized) return;
    this._initialized = true;
    console.log('[CASHIER] Module initialized.');
    this._exposeGlobals();
    this._setupEventListeners();
  },

  switchView(view) {
    const cashierViews = ['cashier', 'cashier-transactions', 'cashier-receipts', 'cashier-profile'];
    if (!cashierViews.includes(view)) {
      UI.toast('Access Denied: This view is not available to cashiers.', 'error');
      return;
    }
    this._currentView = view;
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(view);
    if (panel) panel.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.view === view) item.classList.add('active');
    });
    // Safety timeout: clear skeletons after 5 seconds if data never loads
    if (this._safetyTimer) clearTimeout(this._safetyTimer);
    this._safetyTimer = setTimeout(() => {
      console.warn('[CASHIER] Safety timeout: clearing skeletons for view:', view);
      this._clearAllSkeletons();
    }, 5000);
    if (view === 'cashier-transactions') {
      Skeleton.showTable('cashierTransactionsBody', 5);
      setTimeout(() => this._renderTransactions(), 50);
    }
    if (view === 'cashier-receipts') {
      Skeleton.showTable('cashierReceiptsBody', 5);
      setTimeout(() => this._renderReceipts(), 50);
    }
    if (view === 'cashier-profile') this._renderProfile();
  },

  _exposeGlobals() {
    window.CashierModule = CashierModule;
    window.Cashier = CashierPOS;
    window.addCart = (...args) => CashierPOS.addCart(...args);
    window.removeCartItem = (...args) => CashierPOS.removeCartItem(...args);
    window.updateCartQty = (...args) => CashierPOS.updateCartQty(...args);
    window.filterProducts = (...args) => CashierPOS.filterProducts(...args);
    window.payCart = (...args) => Sales.payCart(...args);
    window.closeReceipt = (...args) => ReceiptViewer.closeReceipt(...args);
    window.printReceipt = (...args) => ReceiptViewer.printReceipt(...args);
    window.showReceipt = (...args) => ReceiptViewer.showReceipt(...args);
    // viewReceipt: looks up transaction by ID, then shows receipt modal
    window.viewReceipt = (txId) => {
      const data = Auth.state.db;
      if (!data || !data.transactions) return;
      const tx = data.transactions.find(t => t.id === txId);
      if (tx) window.showReceipt(tx);
    };
  },

  _setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F2') { e.preventDefault(); const el = document.getElementById('posBarcode'); if (el) el.focus(); }
      if (e.key === 'F3') { e.preventDefault(); const el = document.getElementById('posSearch'); if (el) el.focus(); }
    });
  },

  _renderTransactions(filterText) {
    const container = document.getElementById('cashierTransactionsBody');
    if (!container) return;
    const state = Auth.getState();
    const data = state.db;
    if (!data || !data.transactions) {
      container.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No transactions found.</td></tr>';
      return;
    }
    let transactions = data.transactions.filter(tx => tx.cashier === state.user);
    const query = (filterText || '').toLowerCase().trim();
    if (query) {
      transactions = transactions.filter(tx =>
        (tx.id || '').toLowerCase().includes(query) ||
        (tx.items || []).some(item => (item.name || '').toLowerCase().includes(query))
      );
    }
    transactions = transactions.reverse();
    if (transactions.length === 0) {
      container.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No transactions yet. Start selling!</td></tr>';
      return;
    }
    container.innerHTML = transactions.slice(0, 50).map(tx => `
      <tr>
        <td style="font-family:monospace;font-size:0.8rem;">${escapeHtml((tx.id || '').slice(0, 10))}</td>
        <td>${escapeHtml(formatDate(tx.date))}</td>
        <td>${tx.items ? tx.items.map(i => `${escapeHtml(i.name)} x${i.qty}`).join(', ') : '—'}</td>
        <td class="price-cell">${formatCurrency(tx.total)}</td>
        <td><button class="btn btn-sm btn-ghost" onclick="window.viewReceipt('${tx.id}')">🧾 View</button></td>
      </tr>
    `).join('');
  },

  _renderReceipts() {
    const container = document.getElementById('cashierReceiptsBody');
    if (!container) return;
    const state = Auth.getState();
    const data = state.db;
    if (!data || !data.transactions) {
      container.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No receipts found.</td></tr>';
      return;
    }
    let transactions = data.transactions.filter(tx => tx.cashier === state.user).reverse();
    if (transactions.length === 0) {
      container.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No receipts yet.</td></tr>';
      return;
    }
    container.innerHTML = transactions.slice(0, 50).map(tx => `
      <tr>
        <td style="font-family:monospace;font-size:0.8rem;">${escapeHtml((tx.id || '').slice(0, 10))}</td>
        <td>${escapeHtml(formatDate(tx.date))}</td>
        <td>${tx.items ? tx.items.reduce((s, i) => s + i.qty, 0) : 0} items</td>
        <td class="price-cell">${formatCurrency(tx.total)}</td>
        <td><button class="btn btn-sm btn-ghost" onclick="window.viewReceipt('${tx.id}')">🖨️ View</button></td>
      </tr>
    `).join('');
  },

  _renderProfile() {
    const state = Auth.getState();
    const user = state.userData || {};
    const displayName = user.fullName || state.user || '—';
    const nameEl = document.getElementById('profileName');
    if (nameEl) nameEl.textContent = displayName;
    const usernameEl = document.getElementById('profileUsername');
    if (usernameEl) usernameEl.textContent = state.user || '—';
    const roleEl = document.getElementById('profileRole');
    if (roleEl) roleEl.textContent = state.role || '—';
    const emailEl = document.getElementById('profileEmail');
    if (emailEl) emailEl.textContent = user.email || '—';
    const contactEl = document.getElementById('profileContact');
    if (contactEl) contactEl.textContent = user.contactNumber || '—';
    const loginEl = document.getElementById('profileLastLogin');
    if (loginEl) loginEl.textContent = user.lastLogin ? formatDate(user.lastLogin) : '—';
  },

  filterTransactions(query) { this._renderTransactions(query); },

  changePassword() {
    UI.prompt('Enter your new password:', '', 'Change Password').then(async (newPwd) => {
      if (!newPwd || newPwd.length < 4) {
        if (newPwd !== null) UI.toast('Password must be at least 4 characters.', 'error');
        return;
      }
      const state = Auth.getState();
      const hash = await StorageService.hashPassword(newPwd);
      const result = StorageService.update('users', state.userData?.id, {
        password: hash
      });
      if (result.success) {
        await Audit.logAction('PASSWORD_CHANGE', `Cashier "${state.user}" changed their password`);
        UI.toast('Password updated successfully!', 'success');
      } else {
        UI.toast(result.error || 'Failed to update password.', 'error');
      }
    });
  },

  _clearAllSkeletons() {
    if (this._safetyTimer) {
      clearTimeout(this._safetyTimer);
      this._safetyTimer = null;
    }
    // Clear skeleton elements
    document.querySelectorAll('.skeleton, .skeleton-table-row, .skeleton-card, .skeleton-block, .skeleton-toolbar').forEach(el => {
      console.log('[CASHIER] Safety clearing orphaned skeleton');
      el.innerHTML = '';
    });
  },

  refreshAll() {
    if (!Auth.isCashier()) return;
    const state = Auth.getState();
    if (!state.db) return;
    // If data loaded successfully, clear the safety timeout
    if (this._safetyTimer) {
      clearTimeout(this._safetyTimer);
      this._safetyTimer = null;
    }
    CashierPOS.renderCashier();
    if (this._currentView === 'cashier-transactions') this._renderTransactions();
    if (this._currentView === 'cashier-receipts') this._renderReceipts();
    if (this._currentView === 'cashier-profile') this._renderProfile();
  }
};

export default CashierModule;
