// ===============================
// SHARED AUTH MODULE v4
// Authentication state, session management, RBAC permission checking
// NO business logic, NO UI rendering — pure infrastructure
// Uses only StorageService.readRaw/update
// ===============================

import UI from './ui.js';

const AppState = {
  user: null,
  role: null,
  db: null,
  cart: [],
  userData: null,
  sessionTimer: null,
  SESSION_TIMEOUT: 30 * 60 * 1000,
};

const Auth = {
  state: AppState,

  getState() { return this.state; },

  DEFAULT_PERMISSIONS: {
    Administrator: {
      dashboard: true, inventory: true, suppliers: true, purchaseOrders: true,
      stockReceiving: true, stockAdjustment: true, salesAudit: true, reports: true,
      userManagement: true, settings: true, cashierPOS: true, backup: true,
      restore: true, deleteRecords: true, exportReports: true
    },
    Cashier: {
      dashboard: false, inventory: false, suppliers: false, purchaseOrders: false,
      stockReceiving: false, stockAdjustment: false, salesAudit: false, reports: false,
      userManagement: false, settings: false, cashierPOS: true, backup: false,
      restore: false, deleteRecords: false, exportReports: false
    }
  },

  ROLES_HIERARCHY: {
    Administrator: 100, Cashier: 50
  },

  VALID_ROLES: ['Administrator', 'Cashier'],

  setUser(username, role, userData = null) {
    this.state.user = username;
    this.state.role = role;
    this.state.userData = userData;
    this._startSessionTimer();
  },

  clearSession() {
    this.state.user = null;
    this.state.role = null;
    this.state.userData = null;
    this.state.cart = [];
    this.state.db = null;
    this._stopSessionTimer();
    this.stopActivityListeners();
  },

  hasPermission(permission) {
    if (this.state.userData && this.state.userData.permissions) {
      return this.state.userData.permissions[permission] === true;
    }
    const defaults = this.DEFAULT_PERMISSIONS[this.state.role];
    return defaults ? defaults[permission] === true : false;
  },

  isValidRole(role) {
    return this.VALID_ROLES.includes(role);
  },

  isAtLeast(role) {
    const currentRank = this.ROLES_HIERARCHY[this.state.role] || 0;
    const requiredRank = this.ROLES_HIERARCHY[role] || 0;
    return currentRank >= requiredRank;
  },

  isAdmin() { return this.state.role === 'Administrator'; },
  isCashier() { return this.state.role === 'Cashier'; },
  isLoggedIn() { return this.state.role !== null; },

  requirePermission(permission) {
    if (!this.hasPermission(permission)) {
      UI.toast('Access Denied: You do not have permission for this action.', 'error');
      return false;
    }
    return true;
  },

  requireAdmin() {
    if (!this.isAdmin()) {
      UI.toast('Access Denied: Admin privileges required.', 'error');
      return false;
    }
    return true;
  },

  requireCashier() {
    if (!this.isCashier()) {
      UI.toast('This area is for cashiers only.', 'error');
      return false;
    }
    return true;
  },

  getAuthorizedModule() {
    if (this.isAdmin()) return 'admin';
    if (this.isCashier()) return 'cashier';
    return null;
  },

  setDb(data) { this.state.db = data; },
  getCart() { return this.state.cart; },
  setCart(cart) { this.state.cart = cart; },
  clearCart() { this.state.cart = []; },
  getCurrentUserData() { return this.state.userData; },

  /** Refresh user data from StorageService */
  async refreshUserData() {
    try {
      const StorageService = (await import('./storage.js')).default;
      const data = StorageService.readRaw();
      this.setDb(data);
      if (this.state.user) {
        const user = (data.users || []).find(u => u.username === this.state.user);
        if (user) { this.state.userData = user; this.state.role = user.role; }
      }
    } catch (e) {
      console.error('Failed to refresh user data:', e);
    }
  },

  /** Update last login timestamp via generic update */
  async updateLastLogin() {
    try {
      const StorageService = (await import('./storage.js')).default;
      StorageService.update('users', this.state.userData?.id, {
        lastLogin: new Date().toISOString()
      });
    } catch (e) {
      console.error('Failed to update last login:', e);
    }
  },

  _startSessionTimer() {
    this._stopSessionTimer();
    this.state.sessionTimer = setTimeout(() => { this._autoLogout(); }, this.state.SESSION_TIMEOUT);
  },

  _stopSessionTimer() {
    if (this.state.sessionTimer) { clearTimeout(this.state.sessionTimer); this.state.sessionTimer = null; }
  },

  _resetSessionTimer() { this._startSessionTimer(); },

  _autoLogout() {
    UI.toast('Session expired due to inactivity. Please login again.', 'warning', 5000);
    window.handleLogout();
  },

  startActivityListeners() {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => this._resetSessionTimer();
    events.forEach(ev => document.addEventListener(ev, handler, { passive: true }));
    this._activityHandler = handler;
    this._activityEvents = events;
  },

  stopActivityListeners() {
    if (this._activityHandler && this._activityEvents) {
      this._activityEvents.forEach(ev => document.removeEventListener(ev, this._activityHandler));
    }
  }
};

export default Auth;
