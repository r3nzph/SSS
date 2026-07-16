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

  _showViewSkeletons(view) {
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
      case 'salesreports':
        Skeleton.hide('srContent');
        document.getElementById('srContent') && (document.getElementById('srContent').innerHTML = '<div class="skeleton skeleton-block"></div>');
        break;
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
  },

  _setupEventListeners() {},

  refreshAll() {
    if (!Auth.isAdmin()) return;
    const state = Auth.getState();
    if (!state.db) return;

    Dashboard.renderDashboard();
    Admin.renderAdmin();
    Suppliers.renderSuppliers();
    Purchasing.renderPOs();
    Receiving.renderReceivingHistory();
    Accounts.renderUsers();
    History.renderHistory();
    Audit.renderAuditLog();
    Inventory.renderInventory();
    StockAdjustments.renderAdjustmentHistory();
    SalesReports.renderAll();
    UserManager.renderAll();
    ConfigCenter.renderAll();
    Backup.renderBackupInfo();
    Settings.loadSettings();
    Settings.renderSettingsSummary();
    Pricing.renderPriceAlerts();
    Pricing.renderPriceHistory();
    Pricing.checkPriceAlerts();
    Pricing.attachPricePopovers();
  }
};

export default AdminModule;
