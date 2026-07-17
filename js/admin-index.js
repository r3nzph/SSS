// ===============================
// ADMIN MODULE ENTRY POINT
// Navigation, view switching, global exposure
// ===============================

import Auth from './auth.js';
import UI from './ui.js';
import Audit from './audit.js';
import { escapeHtml, formatDate, formatCurrency } from './utils.js';
import ReceiptViewer from './receipts.js';
import Dashboard from './dashboard.js';
import Admin from './admin-admin.js';
import Inventory from './inventory.js';
import Suppliers from './suppliers.js';
import Purchasing from './purchase-orders.js';
import Receiving from './stock-receiving.js';
import StockAdjustments from './stock-adjustments.js';
import SalesReports from './reports.js';
import UserManager from './users.js';
import Settings from './store-settings.js';
import ConfigCenter from './settings.js';
import Pricing from './pricing.js';
import Backup from './backup.js';
import History from './history.js';
import Accounts from './accounts.js';
import Skeleton from './skeleton.js';

const AdminModule = {
  _initialized: false,
  _currentView: 'admin',
  _clearSkeletonTimer: null,
  _retryTimer: null,

  init() {
    if (!Auth.isAdmin()) {
      console.error('[ADMIN] Blocked: Non-admin user attempted to load admin module.');
      UI.toast('Access Denied: Admin module cannot be loaded.', 'error');
      return;
    }
    if (this._initialized) return;
    this._initialized = true;
    console.log('[ADMIN] Module initialized.');
    this._exposeGlobals();
    this._setupEventListeners();
  },

  switchView(view) {
    const adminViews = ['admin', 'inventory', 'audit', 'configcenter', 'usermanager', 'salesreports',
      'admin-suppliers', 'admin-pos', 'admin-receiving', 'admin-adjustments'];

    if (!adminViews.includes(view)) {
      UI.toast('Access Denied: This view is not available in Admin mode.', 'error');
      return;
    }

    this._currentView = view;
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

    // Show skeletons for data-heavy views
    this._showViewSkeletons(view);

    // SAFETY TIMEOUT: Auto-clear skeletons after 5 seconds if data never loads
    this._clearSkeletonTimer = setTimeout(() => {
      this._clearSkeletonsForView(view);
      console.warn('[ADMIN] Safety timeout: cleared skeletons for view:', view);
    }, 5000);

    const sectionMap = {
      'admin-suppliers': { panel: 'admin', sectionId: 'admin-suppliers-section' },
      'admin-pos': { panel: 'admin', sectionId: 'admin-pos-section' },
      'admin-receiving': { panel: 'admin', sectionId: 'admin-receiving-section' },
      'admin-adjustments': { panel: 'admin', sectionId: 'admin-adjustments-section' }
    };

    const mapped = sectionMap[view];
    if (mapped) {
      const panel = document.getElementById(mapped.panel);
      if (panel) {
        panel.classList.add('active');
        const section = document.getElementById(mapped.sectionId);
        if (section) {
          setTimeout(() => {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const h3 = section.querySelector('h3');
            if (h3) section.classList.remove('collapsed');
          }, 100);
        }
      }
    } else {
      const panel = document.getElementById(view);
      if (panel) panel.classList.add('active');
    }

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.view === view) item.classList.add('active');
    });
  },

  _clearSkeletonsForView(view) {
    const skeletonMap = {
      'admin': ['kpiContainer', 'salesChart', 'topProductsChart'],
      'inventory': ['lowStockAlerts', 'inventoryTable', 'invSummary', 'invPagination'],
      'audit': ['auditLogBody'],
      'usermanager': ['umCardsContainer', 'umSummary', 'umPagination'],
      'admin-suppliers': ['suppliersTable', 'supPagination'],
      'admin-pos': ['poTable', 'poSummary', 'poPagination'],
      'salesreports': ['srContent', 'srFilterBar', 'srTabs'],
      'configcenter': ['cfgContent'],
      'admin-receiving': ['recHistoryBody'],
      'admin-adjustments': ['adjHistoryBody', 'adjSummary', 'adjPagination']
    };
    const ids = skeletonMap[view] || [];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el && (el.querySelector('.skeleton') || el.innerHTML === '')) {
        console.log('[ADMIN] Safety clearing skeleton:', id);
        el.innerHTML = `<div class="panel-empty">Failed to load data. Try refreshing the page.</div>`;
      }
    });
    // Also clear any orphaned skeleton elements anywhere in the document
    document.querySelectorAll('.skeleton, .skeleton-table-row, .skeleton-card, .skeleton-block, .skeleton-toolbar').forEach(el => {
      console.log('[ADMIN] Safety clearing orphaned skeleton element');
      el.innerHTML = '';
    });
  },

  _showViewSkeletons(view) {
    // Use requestAnimationFrame to ensure browser paints skeletons before data loads
    requestAnimationFrame(() => {
      switch (view) {
        case 'admin':
          Skeleton.showKpiGrid('kpiContainer', 6);
          Skeleton.showChart('salesChart');
          Skeleton.showChart('topProductsChart');
          break;
        case 'inventory':
          Skeleton.showAlerts('lowStockAlerts', 2);
          Skeleton.showTable('inventoryTable', 8);
          break;
        case 'audit':
          Skeleton.showTable('auditLogBody', 10);
          break;
        case 'usermanager':
          Skeleton.showCards('umCardsContainer', 6);
          break;
        case 'admin-suppliers':
          Skeleton.showTable('suppliersTable', 5);
          break;
        case 'admin-pos':
          Skeleton.showTable('poTable', 5);
          break;
        case 'salesreports': {
          const srContent = document.getElementById('srContent');
          if (srContent) srContent.innerHTML = '<div class="skeleton skeleton-block"></div>';
          // Add skeletons for filter bar and tab bar too
          const srFilterBar = document.getElementById('srFilterBar');
          if (srFilterBar) Skeleton.showToolbar('srFilterBar');
          const srTabs = document.getElementById('srTabs');
          if (srTabs) srTabs.innerHTML = '<div class="skeleton skeleton-toolbar" style="height:36px"></div>';
          break;
        }
      }
    });
  },

  _exposeGlobals() {
    window.AdminModule = AdminModule;
    window.Admin = Admin;
    window.Inventory = Inventory;
    window.Suppliers = Suppliers;
    window.Purchasing = Purchasing;
    window.Receiving = Receiving;
    window.StockAdjustments = StockAdjustments;
    window.SalesReports = SalesReports;
    window.UserManager = UserManager;
    window.ConfigCenter = ConfigCenter;
    window.Pricing = Pricing;

    window.addNewProduct = (...args) => Admin.addNewProduct(...args);
    window.editProduct = (...args) => Admin.editProduct(...args);
    window.deleteProduct = (...args) => Admin.deleteProduct(...args);
    window.updateStock = (...args) => Admin.updateStock(...args);
    window.cancelEdit = (...args) => Admin.cancelEdit(...args);

    window.saveUser = (...args) => Accounts.saveUser(...args);
    window.editUser = (...args) => Accounts.editUser(...args);
    window.deleteUser = (...args) => Accounts.deleteUser(...args);
    window.resetUserPassword = (...args) => Accounts.resetUserPassword(...args);
    window.cancelUserEdit = (...args) => Accounts.cancelEdit(...args);

    window.saveSettings = (...args) => Settings.saveSettings(...args);
    window.exportData = (...args) => Backup.exportData(...args);
    window.importData = (...args) => Backup.importData(...args);
    window.filterAdminProducts = (...args) => Admin.filterAdminProducts(...args);
  },

  _setupEventListeners() {},

  refreshAll() {
    if (!Auth.isAdmin()) {
      console.warn('[ADMIN] refreshAll skipped: not admin.');
      return;
    }
    const state = Auth.getState();
    if (!state.db) {
      console.warn('[ADMIN] refreshAll skipped: db not loaded yet. Retrying in 500ms...');
      if (this._retryTimer) clearTimeout(this._retryTimer);
      this._retryTimer = setTimeout(() => {
        this._retryTimer = null;
        const retryState = Auth.getState();
        if (retryState.db) {
          console.log('[ADMIN] Retry successful, running refreshAll.');
          this.refreshAll();
        } else {
          console.error('[ADMIN] Retry failed: db still not loaded.');
          const panel = document.getElementById('admin');
          if (panel) {
            panel.innerHTML = `<div class="panel" style="text-align:center;padding:60px 20px;">
              <h2 style="font-size:1.5rem;margin-bottom:12px;">⚠️ Failed to Load Dashboard</h2>
              <p style="color:var(--text-secondary);margin-bottom:24px;">The database could not be loaded. This may be due to corrupted data or a storage error.</p>
              <button class="btn btn-primary" onclick="location.reload()">🔄 Refresh Page</button>
            </div>`;
          }
        }
      }, 500);
      return;
    }

    // Clear safety timeout if data loaded successfully
    if (this._clearSkeletonTimer) {
      clearTimeout(this._clearSkeletonTimer);
      this._clearSkeletonTimer = null;
    }

    const modules = [
      { name: 'Dashboard', fn: () => Dashboard.renderDashboard() },
      { name: 'Admin', fn: () => Admin.renderAdmin() },
      { name: 'Suppliers', fn: () => Suppliers.renderSuppliers() },
      { name: 'Purchasing', fn: () => Purchasing.renderPOs() },
      { name: 'Receiving', fn: () => Receiving.renderReceivingHistory() },
      { name: 'Accounts', fn: () => Accounts.renderUsers() },
      { name: 'History', fn: () => History.renderHistory() },
      { name: 'Audit', fn: () => Audit.renderAuditLog() },
      { name: 'Inventory', fn: () => Inventory.renderInventory() },
      { name: 'StockAdjustments', fn: () => StockAdjustments.renderAdjustmentHistory() },
      { name: 'SalesReports', fn: () => SalesReports.renderAll() },
      { name: 'UserManager', fn: () => UserManager.renderAll() },
      { name: 'ConfigCenter', fn: () => ConfigCenter.renderAll() },
      { name: 'Backup', fn: () => Backup.renderBackupInfo() },
      { name: 'Settings', fn: () => { Settings.loadSettings(); Settings.renderSettingsSummary(); } },
      { name: 'Pricing', fn: () => { Pricing.renderPriceAlerts(); Pricing.renderPriceHistory(); Pricing.checkPriceAlerts(); Pricing.attachPricePopovers(); } }
    ];

    modules.forEach(mod => {
      try {
        mod.fn();
      } catch (e) {
        console.error(`[ADMIN] ${mod.name} render failed:`, e);
      }
    });

    // Final safety: clear any remaining skeletons after all modules tried to render
    requestAnimationFrame(() => {
      this._clearSkeletonsForView('admin');
    });
  }
};

export default AdminModule;
