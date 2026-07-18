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
import StorageService from './storage.js';

const AdminModule = {
  _initialized: false,
  _currentView: 'admin',
  _clearSkeletonTimer: null,

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
    const adminViews = ['admin', 'inventory', 'supplychain', 'audit', 'configcenter', 'usermanager', 'salesreports'];

    if (!adminViews.includes(view)) {
      UI.toast('Access Denied: This view is not available in Admin mode.', 'error');
      return;
    }

    this._currentView = view;
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

    // Check if this view's main data container already has content (rendered by refreshAll()).
    // If so, skip skeletons and safety timer to avoid overwriting real data.
    const viewHasData = this._viewHasData(view);

    if (!viewHasData) {
      // Show skeletons for data-heavy views
      this._showViewSkeletons(view);

      // SAFETY TIMEOUT: Auto-clear skeletons after 5 seconds if data never loads
      this._clearSkeletonTimer = setTimeout(() => {
        this._clearSkeletonsForView(view);
        console.warn('[ADMIN] Safety timeout: cleared skeletons for view:', view);
      }, 5000);
    }

    const panel = document.getElementById(view);
    if (panel) panel.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.view === view) item.classList.add('active');
    });
  },

  _clearSkeletonsForView(view) {
    const skeletonMap = {
      'admin': ['kpiContainer', 'dashboardLowStock'],
      'inventory': ['lowStockAlerts', 'inventoryTable', 'invSummary', 'invPagination'],
      'supplychain': ['suppliersTable', 'supPagination', 'poTable', 'poSummary', 'poPagination', 'recHistoryBody', 'adjHistoryBody', 'adjSummary', 'adjPagination'],
      'audit': ['auditLogBody'],
      'usermanager': ['umCardsContainer', 'umSummary', 'umPagination'],
      'salesreports': ['srContent', 'srFilterBar', 'srTabs'],
      'configcenter': ['cfgContent']
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

  /** Check if a view's main data containers already have real content rendered */
  _viewHasData(view) {
    const skeletonMap = {
      'admin': ['kpiContainer'],
      'inventory': ['inventoryTable'],
      'supplychain': ['suppliersTable'],
      'audit': ['auditLogBody'],
      'usermanager': ['umCardsContainer'],
      'salesreports': ['srContent'],
      'configcenter': ['cfgContent']
    };
    const ids = skeletonMap[view] || [];
    // If any main container has real content (non-empty, no skeletons), view has data
    return ids.some(id => {
      const el = document.getElementById(id);
      if (!el) return false;
      return el.innerHTML !== '' && !el.querySelector('.skeleton');
    });
  },

  _showViewSkeletons(view) {
    // Insert skeletons synchronously BEFORE data rendering.
    // refreshAll() runs immediately after this and replaces them with real data.
    // Do NOT use requestAnimationFrame here — it would delay skeleton insertion
    // until AFTER synchronous data rendering, causing skeletons to overwrite real data.
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
      case 'supplychain':
        Skeleton.showTable('suppliersTable', 5);
        break;
      case 'audit':
        Skeleton.showTable('auditLogBody', 10);
        break;
      case 'usermanager':
        Skeleton.showCards('umCardsContainer', 6);
        break;
      case 'salesreports': {
        const srContent = document.getElementById('srContent');
        if (srContent) srContent.innerHTML = '<div class="skeleton skeleton-block"></div>';
        const srFilterBar = document.getElementById('srFilterBar');
        if (srFilterBar) Skeleton.showToolbar('srFilterBar');
        const srTabs = document.getElementById('srTabs');
        if (srTabs) srTabs.innerHTML = '<div class="skeleton skeleton-toolbar" style="height:36px"></div>';
        break;
      }
    }
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
    window.switchSupplyTab = (tab) => this._switchSupplyTab(tab);
  },

  /** Switch between Supply Chain tabs without navigating away */
  _switchSupplyTab(tab) {
    document.querySelectorAll('.sc-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sc-panel').forEach(p => p.classList.remove('active'));
    const tabBtn = document.querySelector(`.sc-tab[data-tab="${tab}"]`);
    const panel = document.getElementById(`sc-tab-${tab}`);
    if (tabBtn) tabBtn.classList.add('active');
    if (panel) panel.classList.add('active');
  },

  _setupEventListeners() {},

  refreshAll() {
    // CRITICAL: Always clear the safety timer FIRST, before any conditionals.
    // switchView() sets a 5-second timer; if we exit early (e.g. db not ready),
    // the timer would replace skeletons with "Failed to load" messages.
    if (this._clearSkeletonTimer) {
      clearTimeout(this._clearSkeletonTimer);
      this._clearSkeletonTimer = null;
    }

    if (!Auth.isAdmin()) {
      console.warn('[ADMIN] refreshAll skipped: not admin.');
      return;
    }

    // Ensure db is available — fallback to StorageService if needed
    let state = Auth.getState();
    if (!state.db) {
      const freshDb = StorageService.readRaw();
      if (freshDb) {
        console.log('[ADMIN] refreshAll: state.db was null but StorageService has data. Using it.');
        Auth.setDb(freshDb);
        state = Auth.getState();
      } else {
        console.warn('[ADMIN] refreshAll: no db data available. Modules will render empty states.');
      }
    }

    // Render all modules — each handles null/missing data gracefully
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
