// ===============================
// USER MANAGER MODULE — Full implementation
// RBAC user management with add/edit/delete, password reset,
// permissions, roles filtering, profile viewer
// Uses ONLY StorageService — no Electron, no Node.js
// ===============================

import Auth from './auth.js';
import UI from './ui.js';
import Audit from './audit.js';
import { escapeHtml, formatDate, getInputValue, setInputValue, clearInput, generateId, getISOTimestamp, showModal, hideModal, handleError } from './utils.js';
import StorageService from './storage.js';

const UserManager = {
  _filters: { search: '', role: '', status: '' },
  _page: 1, _pageSize: 20,
  _editingUserId: null,

  // ============================
  // MAIN RENDER
  // ============================

  renderAll() {
    this._renderCards();
    this._renderRoleFilter();
  },

  _renderCards() {
    const el = document.getElementById('umCardsContainer');
    if (!el) return;
    const users = StorageService.load('users');
    if (!users || users.length === 0) {
      el.innerHTML = '<p class="um-empty">No users found.</p>';
      return;
    }

    let filtered = this._getFilteredUsers(users);
    const total = filtered.length;
    const pages = Math.ceil(total / this._pageSize) || 1;
    if (this._page > pages) this._page = pages;
    const start = (this._page - 1) * this._pageSize;
    const page = filtered.slice(start, start + this._pageSize);

    this._renderPagination(total, pages);
    this._renderSummary(total);

    if (page.length === 0) {
      el.innerHTML = '<p class="um-empty">No users match your criteria.</p>';
      return;
    }

    el.innerHTML = page.map(u => {
      const isCurrentUser = u.username === Auth.state.user;
      const statusClass = u.status === 'disabled' ? 'um-card-disabled' : u.status === 'archived' ? 'um-card-archived' : '';
      const initials = (u.fullName || u.username || '?').charAt(0).toUpperCase();
      return `<div class="um-user-card ${statusClass} ${isCurrentUser ? 'um-card-current' : ''}">
        <div class="um-card-header">
          <div class="um-avatar" style="background:${this._getAvatarColor(u.role)}">
            <span class="um-avatar-initials">${escapeHtml(initials)}</span>
          </div>
          <div class="um-card-info">
            <div class="um-card-name">${escapeHtml(u.fullName || u.username)} ${isCurrentUser ? '<span class="um-badge-current">You</span>' : ''}</div>
            <div class="um-card-username">@${escapeHtml(u.username)}</div>
          </div>
        </div>
        <div class="um-card-body">
          <div class="um-card-row">
            <span class="um-card-label">Role</span>
            <span class="um-role-badge um-role-${escapeHtml(u.role)}">${this._getRoleIcon(u.role)} ${escapeHtml(u.role)}</span>
          </div>
          <div class="um-card-row">
            <span class="um-card-label">Status</span>
            <span class="um-status-${u.status || 'active'}">${this._getStatusLabel(u)}</span>
          </div>
          <div class="um-card-row">
            <span class="um-card-label">Created</span>
            <span>${u.createdAt ? formatDate(u.createdAt) : '—'}</span>
          </div>
          ${u.email ? `<div class="um-card-row"><span class="um-card-label">Email</span><span>${escapeHtml(u.email)}</span></div>` : ''}
        </div>
        <div class="um-card-actions">
          <button class="btn btn-sm btn-ghost" onclick="UserManager.viewProfile('${u.id}')" title="View Profile">👤</button>
          <button class="btn btn-sm btn-ghost" onclick="UserManager.editUser('${u.id}')" title="Edit">✎</button>
          <button class="btn btn-sm btn-ghost" onclick="UserManager.openPermissions('${u.id}')" title="Permissions">🔐</button>
          ${u.status === 'active'
            ? `<button class="btn btn-sm btn-ghost" onclick="UserManager.toggleStatus('${u.id}','disabled')" title="Disable">⏸️</button>`
            : `<button class="btn btn-sm btn-ghost" onclick="UserManager.toggleStatus('${u.id}','active')" title="Activate">✅</button>`}
          ${!isCurrentUser ? `<button class="btn btn-sm btn-ghost" onclick="UserManager.deleteUser('${u.id}')" title="Delete" style="color:var(--danger);">🗑</button>` : ''}
        </div>
      </div>`;
    }).join('');
  },

  _getRoleIcon(role) {
    const icons = { Administrator: '🛡️', Cashier: '🛒' };
    return icons[role] || '👤';
  },

  _getStatusLabel(user) {
    if (user.archived) return '📁 Archived';
    if (user.status === 'disabled') return '⏸️ Disabled';
    if (user.status === 'active') return '✅ Active';
    return user.status || '✅ Active';
  },

  _getAvatarColor(role) {
    const root = getComputedStyle(document.documentElement);
    const accent = root.getPropertyValue('--accent-primary').trim() || '#6D5DFC';
    const success = root.getPropertyValue('--success').trim() || '#10B981';
    const info = root.getPropertyValue('--info').trim() || '#74b9ff';
    const colors = {
      Administrator: `linear-gradient(135deg, #EF4444, ${accent})`,
      Cashier: `linear-gradient(135deg, ${success}, ${info})`
    };
    return colors[role] || `linear-gradient(135deg, ${accent}, ${info})`;
  },

  // ============================
  // FILTERING & SORTING
  // ============================

  _getFilteredUsers(users) {
    let filtered = [...users];
    if (this._filters.search) {
      const q = this._filters.search.toLowerCase();
      filtered = filtered.filter(u =>
        (u.fullName || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q)
      );
    }
    if (this._filters.role) {
      filtered = filtered.filter(u => u.role === this._filters.role);
    }
    if (this._filters.status) {
      filtered = filtered.filter(u =>
        this._filters.status === 'archived' ? u.archived : u.status === this._filters.status
      );
    }
    return filtered;
  },

  setFilter(type, value) {
    if (type === 'search') this._filters.search = value;
    else if (type === 'role') this._filters.role = value;
    else if (type === 'status') this._filters.status = value;
    this._page = 1;
    this._renderCards();
  },

  setPage(p) { this._page = p; this._renderCards(); },

  _renderPagination(total, pages) {
    const el = document.getElementById('umPagination');
    if (!el) return;
    if (pages <= 1) { el.innerHTML = ''; return; }
    const p = this._page;
    let h = `<button class="btn btn-icon btn-sm" onclick="UserManager.setPage(${p - 1})" ${p <= 1 ? 'disabled' : ''}>‹</button>`;
    const maxVisible = 5;
    let startPg = Math.max(1, p - Math.floor(maxVisible / 2));
    let endPg = Math.min(pages, startPg + maxVisible - 1);
    if (endPg - startPg < maxVisible - 1) startPg = Math.max(1, endPg - maxVisible + 1);
    if (startPg > 1) {
      h += `<button class="btn btn-icon btn-sm" onclick="UserManager.setPage(1)">1</button>`;
      if (startPg > 2) h += `<span class="inv-pg-ellipsis">…</span>`;
    }
    for (let i = startPg; i <= endPg; i++)
      h += `<button class="btn btn-icon btn-sm ${i === p ? 'btn-primary' : 'btn-ghost'}" onclick="UserManager.setPage(${i})">${i}</button>`;
    if (endPg < pages) {
      if (endPg < pages - 1) h += `<span class="inv-pg-ellipsis">…</span>`;
      h += `<button class="btn btn-icon btn-sm" onclick="UserManager.setPage(${pages})">${pages}</button>`;
    }
    h += `<button class="btn btn-icon btn-sm" onclick="UserManager.setPage(${p + 1})" ${p >= pages ? 'disabled' : ''}>›</button>`;
    el.innerHTML = h;
  },

  _renderSummary(total) {
    const el = document.getElementById('umSummary');
    if (!el) return;
    el.textContent = `${total} user(s)`;
  },

  _renderRoleFilter() {
    const select = document.getElementById('umRoleFilter');
    if (!select) return;
    const roles = ['Administrator', 'Cashier'];
    const currentVal = select.value;
    select.innerHTML = '<option value="">All Roles</option>' +
      roles.map(r => `<option value="${r}">${this._getRoleIcon(r)} ${r}</option>`).join('');
    select.value = currentVal;
  },

  // ============================
  // USER MODAL (Add / Edit)
  // ============================

  showAddModal() {
    this._editingUserId = null;
    this._clearModal();
    const pwField = document.getElementById('umPasswordField');
    if (pwField) pwField.style.display = 'block';
    const hint = document.getElementById('umPasswordHint');
    if (hint) hint.classList.add('hidden');
    document.getElementById('umModalTitle').textContent = 'Add User';
    showModal('umModalOverlay');
  },

  editUser(id) {
    const u = StorageService.load('users', id);
    if (!u) return;
    this._editingUserId = id;
    setInputValue('umFullName', u.fullName || '');
    setInputValue('umUsername', u.username || '');
    setInputValue('umEmail', u.email || '');
    setInputValue('umContact', u.contactNumber || '');
    setInputValue('umPassword', '');
    const pwField = document.getElementById('umPasswordField');
    if (pwField) pwField.style.display = 'block';
    const hint = document.getElementById('umPasswordHint');
    if (hint) {
      hint.textContent = 'Leave blank to keep current password.';
      hint.classList.remove('hidden');
    }
    const roleSelect = document.getElementById('umRole');
    if (roleSelect) roleSelect.value = u.role || 'Cashier';
    const statusSelect = document.getElementById('umStatus');
    if (statusSelect) statusSelect.value = u.status === 'archived' ? 'active' : (u.status || 'active');
    const forcePw = document.getElementById('umForcePw');
    if (forcePw) forcePw.checked = u.forcePasswordChange || false;
    document.getElementById('umModalTitle').textContent = 'Edit User';
    showModal('umModalOverlay');
  },

  closeModal() {
    hideModal('umModalOverlay');
    this._editingUserId = null;
  },

  _clearModal() {
    ['umFullName', 'umUsername', 'umEmail', 'umContact', 'umPassword']
      .forEach(id => clearInput(id));
    const roleSelect = document.getElementById('umRole');
    if (roleSelect) roleSelect.value = 'Cashier';
    const statusSelect = document.getElementById('umStatus');
    if (statusSelect) statusSelect.value = 'active';
    const forcePw = document.getElementById('umForcePw');
    if (forcePw) forcePw.checked = false;
    const hint = document.getElementById('umPasswordHint');
    if (hint) hint.classList.add('hidden');
  },

  async saveUser() {
    const fullName = getInputValue('umFullName') || '';
    const username = getInputValue('umUsername');
    const email = getInputValue('umEmail') || '';
    const contact = getInputValue('umContact') || '';
    const password = getInputValue('umPassword');
    const role = document.getElementById('umRole')?.value || 'Cashier';
    const status = document.getElementById('umStatus')?.value || 'active';
    const forcePw = document.getElementById('umForcePw')?.checked || false;

    if (!username || username.length < 3) {
      UI.toast('Username is required (min 3 characters).', 'error');
      return;
    }
    if (!Auth.isValidRole(role)) {
      UI.toast(`Invalid role "${role}". Only Administrator and Cashier are allowed.`, 'error');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      UI.toast('Invalid email format.', 'error');
      return;
    }

    const allUsers = StorageService.load('users');
    const existing = allUsers.find(u => u.username === username);

    if (!this._editingUserId) {
      // ADD new user
      if (!password || password.length < 6) {
        UI.toast('Password must be at least 6 characters.', 'error');
        return;
      }
      if (existing) {
        UI.toast(`Username "${username}" is already taken.`, 'error');
        return;
      }
    } else {
      // EDIT existing user
      const currentUser = StorageService.load('users', this._editingUserId);
      if (currentUser && currentUser.username !== username && existing) {
        UI.toast(`Username "${username}" is already taken.`, 'error');
        return;
      }
    }

    const saveBtn = document.querySelector('#umModalOverlay .btn-success');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    try {
      const now = getISOTimestamp();

      if (this._editingUserId) {
        // UPDATE existing user
        const updates = { fullName, username, email, contactNumber: contact, role, status, forcePasswordChange: forcePw, lastUpdated: now };
        if (password) {
          updates.password = await StorageService.hashPassword(password);
        }
        const r = StorageService.update('users', this._editingUserId, updates);
        if (!r.success) { UI.toast(r.error || 'Update failed.', 'error'); return; }
        Auth.setDb(StorageService.readRaw());
        await Audit.logAction('USER_UPDATE', `Updated user "${username}" (role: ${role})`);
        UI.toast(`User "${username}" updated.`, 'success');
      } else {
        // ADD new user
        const newId = generateId('u');
        const userObj = {
          id: newId, username, fullName, email, contactNumber: contact,
          password: await StorageService.hashPassword(password),
          role, status: status || 'active',
          forcePasswordChange: forcePw,
          createdAt: now, lastUpdated: now,
          createdBy: Auth.state.user || 'system',
          lastLogin: null, loginAttempts: 0, lockedUntil: null,
          profilePicture: '', permissions: {}
        };
        const r = StorageService.save('users', userObj);
        if (!r.success) { UI.toast(r.error || 'Add failed.', 'error'); return; }
        Auth.setDb(StorageService.readRaw());
        await Audit.logAction('USER_ADD', `Added user "${username}" (role: ${role})`);
        UI.toast(`User "${username}" added.`, 'success');
      }

      this.closeModal();
      this._renderCards();

      if (typeof window.AdminModule !== 'undefined' && typeof window.AdminModule.refreshAll === 'function') {
        window.AdminModule.refreshAll();
      }
    } catch (e) {
      handleError(e, 'saveUser');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save User'; }
    }
  },

  // ============================
  // USER ACTIONS
  // ============================

  async deleteUser(id) {
    if (!id) return;
    const u = StorageService.load('users', id);
    if (!u) return;
    if (u.username === Auth.state.user) {
      UI.toast('Cannot delete your own account.', 'error');
      return;
    }
    const ok = await UI.confirm(`Permanently delete user "${u.username}"? This cannot be undone.`, 'Delete User');
    if (!ok) return;
    const r = StorageService.delete('users', id);
    if (r.success) {
      Auth.setDb(StorageService.readRaw());
      await Audit.logAction('USER_DELETE', `Deleted user "${u.username}"`);
      this._renderCards();
      UI.toast(`User "${u.username}" deleted.`, 'info');
    } else {
      UI.toast(r.error || 'Delete failed.', 'error');
    }
  },

  async toggleStatus(id, newStatus) {
    const u = StorageService.load('users', id);
    if (!u) return;
    const label = newStatus === 'disabled' ? 'disable' : 'activate';
    const ok = await UI.confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} user "${u.username}"?`, `${label.charAt(0).toUpperCase() + label.slice(1)} User`);
    if (!ok) return;
    StorageService.update('users', id, { status: newStatus, archived: false });
    Auth.setDb(StorageService.readRaw());
    await Audit.logAction('USER_STATUS', `${label}d user "${u.username}"`);
    this._renderCards();
    UI.toast(`User "${u.username}" ${label}d.`, 'success');
  },

  async changeOwnPassword() {      const currentPwd = await UI.prompt('Enter your current password:', '', 'Verify Current Password');
    if (!currentPwd) return;

    const state = Auth.getState();
    const user = state.userData;
    if (!user || !user.password) {
      UI.toast('User data not available.', 'error');
      return;
    }

    const valid = await StorageService.verifyPassword(currentPwd, user.password);
    if (!valid) {
      UI.toast('Current password is incorrect.', 'error');
      return;
    }      const newPwd = await UI.prompt('Enter your new password:', '', 'Change Password');
    if (!newPwd || newPwd.length < 6) {
      if (newPwd) UI.toast('Password must be at least 6 characters.', 'error');
      return;
    }      const confirmPwd = await UI.prompt('Confirm your new password:', '', 'Confirm Password');
    if (newPwd !== confirmPwd) {
      UI.toast('Passwords do not match.', 'error');
      return;
    }

    try {
      const hash = await StorageService.hashPassword(newPwd);
      const r = StorageService.update('users', user.id, { password: hash });
      if (r.success) {
        Auth.setDb(StorageService.readRaw());
        await Audit.logAction('PASSWORD_CHANGE', `User "${state.user}" changed their password`);
        UI.toast('Password updated successfully!', 'success');
      } else {
        UI.toast(r.error || 'Failed to update password.', 'error');
      }
    } catch (e) {
      UI.toast('Failed to update password.', 'error');
    }
  },

  // ============================
  // PERMISSIONS MODAL
  // ============================

  async openPermissions(id) {
    const user = StorageService.load('users', id);
    if (!user) return;
    document.getElementById('umPermsTitle').textContent = `🔐 Permissions — ${escapeHtml(user.username)}`;
    const body = document.getElementById('umPermsBody');
    if (!body) return;

    const permKeys = [
      'dashboard', 'inventory', 'suppliers', 'purchaseOrders',
      'stockReceiving', 'stockAdjustment', 'salesAudit', 'reports',
      'userManagement', 'settings', 'cashierPOS', 'backup', 'restore',
      'deleteRecords', 'exportReports'
    ];

    const perms = user.permissions || {};
    const defaults = Auth.DEFAULT_PERMISSIONS[user.role] || {};

    body.innerHTML = `
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:16px;">
        Custom permissions for <strong>${escapeHtml(user.username)}</strong> (${escapeHtml(user.role)})
      </p>
      <div class="um-perms-grid">
        ${permKeys.map(key => {
          const hasPerm = perms[key] !== undefined ? perms[key] : (defaults[key] || false);
          return `<label class="um-perm-item ${hasPerm ? 'perm-enabled' : 'perm-disabled'}">
            <input type="checkbox" ${hasPerm ? 'checked' : ''}
              onchange="UserManager._togglePerm('${key}', this.checked)">
            <span class="um-perm-label">${this._getPermLabel(key)}</span>
            <span class="um-perm-status">${hasPerm ? '✅' : '❌'}</span>
          </label>`;
        }).join('')}
      </div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-glass);display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-ghost" onclick="UserManager._setAllPerms(true)">Enable All</button>
        <button class="btn btn-sm btn-ghost" onclick="UserManager._setAllPerms(false)">Disable All</button>
        <button class="btn btn-sm btn-primary" onclick="UserManager._savePerms('${id}')" style="margin-left:auto;">💾 Save Permissions</button>
      </div>
    `;
    this._permUserId = id;
    this._permChanges = {};
    showModal('umPermsOverlay');
  },

  _permUserId: null,
  _permChanges: {},

  _getPermLabel(key) {
    const labels = {
      dashboard: '📊 Dashboard', inventory: '📦 Inventory', suppliers: '🏭 Suppliers',
      purchaseOrders: '📥 Purchase Orders', stockReceiving: '📤 Stock Receiving',
      stockAdjustment: '🔧 Stock Adjustment', salesAudit: '📋 Sales Audit',
      reports: '📊 Reports', userManagement: '👥 User Management',
      settings: '⚙️ Settings', cashierPOS: '🛒 Cashier POS',
      backup: '💾 Backup', restore: '↩️ Restore',
      deleteRecords: '🗑 Delete Records', exportReports: '📤 Export Reports'
    };
    return labels[key] || key;
  },

  _togglePerm(key, value) {
    this._permChanges[key] = value;
    const label = document.querySelector(`.um-perm-item input[onchange*="${key}"]`)?.closest('.um-perm-item');
    if (label) {
      label.classList.toggle('perm-enabled', value);
      label.classList.toggle('perm-disabled', !value);
      const status = label.querySelector('.um-perm-status');
      if (status) status.textContent = value ? '✅' : '❌';
    }
  },

  _setAllPerms(enabled) {
    const checkboxes = document.querySelectorAll('.um-perms-grid input[type="checkbox"]');
    checkboxes.forEach(cb => {
      const match = cb.getAttribute('onchange')?.match(/UserManager\._togglePerm\('([^']+)'/);
      if (match) {
        cb.checked = enabled;
        this._togglePerm(match[1], enabled);
      }
    });
  },

  async _savePerms(id) {
    const user = StorageService.load('users', id);
    if (!user) return;
    const existingPerms = user.permissions || {};
    const mergedPerms = { ...existingPerms, ...this._permChanges };
    StorageService.update('users', id, { permissions: mergedPerms });
    Auth.setDb(StorageService.readRaw());
    await Audit.logAction('USER_PERMISSIONS', `Updated permissions for "${user.username}"`);
    UI.toast('Permissions saved!', 'success');
    this.closePermsModal();
  },

  closePermsModal() {
    hideModal('umPermsOverlay');
    this._permUserId = null;
    this._permChanges = {};
  },

  // ============================
  // PROFILE MODAL
  // ============================

  viewProfile(id) {
    const user = StorageService.load('users', id);
    if (!user) return;
    document.getElementById('umProfileTitle').textContent = `👤 ${escapeHtml(user.fullName || user.username)}`;
    const content = document.getElementById('umProfileContent');
    if (!content) return;

    const isCurrentUser = user.username === Auth.state.user;
    const statusLabel = this._getStatusLabel(user);
    const initials = (user.fullName || user.username || '?').charAt(0).toUpperCase();
    const roleIcon = this._getRoleIcon(user.role);

    content.innerHTML = `
      <div class="um-profile-header" style="text-align:center;padding:16px 0;">
        <div class="um-avatar" style="width:64px;height:64px;font-size:1.8rem;margin:0 auto 12px;background:${this._getAvatarColor(user.role)}">
          <span class="um-avatar-initials">${escapeHtml(initials)}</span>
        </div>
        <h3 style="margin:0;">${escapeHtml(user.fullName || user.username)} ${isCurrentUser ? '<span style="font-size:0.75rem;color:var(--accent-secondary);">(You)</span>' : ''}</h3>
        <div style="font-size:0.85rem;color:var(--text-muted);">@${escapeHtml(user.username)}</div>
      </div>
      <div class="um-profile-details" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:8px 0;">
        <div class="um-profile-field">
          <div class="um-profile-label" style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;">Role</div>
          <div class="um-profile-value">${roleIcon} ${escapeHtml(user.role)}</div>
        </div>
        <div class="um-profile-field">
          <div class="um-profile-label" style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;">Status</div>
          <div class="um-profile-value">${statusLabel}</div>
        </div>
        <div class="um-profile-field">
          <div class="um-profile-label" style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;">Email</div>
          <div class="um-profile-value">${user.email || '—'}</div>
        </div>
        <div class="um-profile-field">
          <div class="um-profile-label" style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;">Contact</div>
          <div class="um-profile-value">${user.contactNumber || '—'}</div>
        </div>
        <div class="um-profile-field">
          <div class="um-profile-label" style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;">Created</div>
          <div class="um-profile-value">${user.createdAt ? formatDate(user.createdAt) : '—'}</div>
        </div>
        <div class="um-profile-field">
          <div class="um-profile-label" style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;">Last Login</div>
          <div class="um-profile-value">${user.lastLogin ? formatDate(user.lastLogin) : 'Never'}</div>
        </div>
      </div>
    `;
    showModal('umProfileOverlay');
  },

  closeProfileModal() {
    hideModal('umProfileOverlay');
  }
};

export default UserManager;
