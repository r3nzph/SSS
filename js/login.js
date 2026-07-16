// ===============================
// SHARED LOGIN MODULE
// User authentication, session management, login/logout flow
// Uses centralized Session manager + StorageService
// ===============================

import Auth from './auth.js';
import Session from './session.js';
import Audit from './audit.js';
import { getInputValue } from './utils.js';
import StorageService from './storage.js';

const Login = {
  _ui: null,

  setUI(uiModule) {
    this._ui = uiModule;
  },

  async handleLogin() {
    const username = getInputValue('username');
    const password = getInputValue('password');

    if (!username || !password) {
      this._ui.toast('Please enter username and password.', 'warning');
      return;
    }

    this._ui.showLoading('Signing in...');

    try {
      const data = StorageService.readRaw();
      const user = (data.users || []).find(u => u.username === username);

      if (!user) {
        this._ui.hideLoading();
        this._ui.toast('Invalid username or password!', 'error');
        return;
      }

      // Check account lockout
      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        const remaining = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
        this._ui.hideLoading();
        this._ui.toast(`Account is locked. Try again in ${remaining} minute(s).`, 'error', 5000);
        return;
      }

      // Check account status
      if (user.status === 'disabled' || user.status === 'archived') {
        this._ui.hideLoading();
        this._ui.toast('This account is disabled. Contact your administrator.', 'error');
        return;
      }

      // Authenticate using StorageService.verifyPassword
      const valid = await StorageService.verifyPassword(password, user.password);

      if (!valid) {
        // Increment login attempts
        const attempts = (user.loginAttempts || 0) + 1;
        const lockedUntil = attempts >= 5
          ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
          : null;
        StorageService.update('users', user.id, {
          loginAttempts: attempts,
          ...(lockedUntil ? { lockedUntil } : {})
        });

        const attemptsLeft = Math.max(0, 5 - attempts);
        this._ui.hideLoading();
        if (attemptsLeft > 0) {
          this._ui.toast(`Invalid username or password! ${attemptsLeft} attempt(s) remaining.`, 'error');
        } else {
          this._ui.toast('Account locked due to too many failed attempts. Try again in 15 minutes.', 'error', 5000);
        }
        return;
      }

      // Successful login — reset attempts
      StorageService.update('users', user.id, {
        loginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date().toISOString()
      });

      // Handle "Remember me" checkbox
      const rememberMe = document.getElementById('rememberMe')?.checked;
      if (rememberMe) {
        Session.saveRememberedUser(username);
      } else {
        Session.clearRememberedUser();
      }

      const role = user.role;

      // Set Auth state
      Auth.setUser(username, role, user);
      Auth.setDb(StorageService.readRaw());
      Auth.startActivityListeners();

      // Save session to sessionStorage (browser tab-scoped)
      Session.saveSession(username, role, user);

      // Log audit
      await Audit.logAction('LOGIN', `User "${username}" logged in as ${role}`);

      this._ui.hideLoading();

      // Redirect based on role
      Session.redirectByRole(role);

    } catch (e) {
      this._ui.hideLoading();
      console.error('Login error:', e);
      this._ui.toast('Login failed. Please try again.', 'error');
    }
  },

  handleLogout() {
    this._ui.showLoading('Logging out...');
    try {
      Audit.logAction('LOGOUT', `User "${Auth.getState().user}" logged out`);
    } catch(e) {}
    Session.clearSession();
    Auth.clearSession();
    Session.redirectToIndex();
  }
};

export default Login;
