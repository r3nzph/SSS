// ===============================
// SETTINGS MODULE (Config Center)
// 9 tabs: Store, Receipt, Inventory, Sales,
// Notifications, Security, Appearance, Maintenance, Backup
// Uses ONLY StorageService — no Electron, no Node.js
// ===============================

import Auth from './auth.js';
import UI from './ui.js';
import { escapeHtml, getInputValue, setInputValue } from './utils.js';
import StorageService from './storage.js';
import Backup from './backup.js';

const ConfigCenter = {
  _currentTab: 'store',

  renderAll() {
    this.switchTab('store');
  },

  switchTab(tab) {
    this._currentTab = tab;
    document.querySelectorAll('.cfg-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll(`.cfg-tab-btn[data-tab="${tab}"]`).forEach(b => b.classList.add('active'));
    this._renderTabContent(tab);
  },

  _getSettings() {
    return StorageService.load('settings', 'main') || {};
  },

  _saveSettings(updates) {
    const current = this._getSettings();
    Object.assign(current, updates);
    StorageService.update('settings', 'main', current);
    Auth.setDb(StorageService.readRaw());
    UI.toast('Settings saved! ✅', 'success');
  },

  _renderTabContent(tab) {
    const el = document.getElementById('cfgContent');
    if (!el) return;
    const s = this._getSettings();

    switch (tab) {
      case 'store': this._renderStoreTab(el, s); break;
      case 'receipt': this._renderReceiptTab(el, s); break;
      case 'inventory': this._renderInventoryTab(el, s); break;
      case 'sales': this._renderSalesTab(el, s); break;
      case 'notifications': this._renderNotificationsTab(el, s); break;
      case 'security': this._renderSecurityTab(el, s); break;
      case 'appearance': this._renderAppearanceTab(el, s); break;
      case 'maintenance': this._renderMaintenanceTab(el, s); break;
      case 'backup': this._renderBackupTab(el, s); break;
      default: this._renderStoreTab(el, s);
    }
  },

  // ============================
  // STORE TAB
  // ============================
  _renderStoreTab(el, s) {
    el.innerHTML = `
      <div class="cfg-section">
        <div class="cfg-section-title">🏪 Store Information</div>
        <p class="cfg-section-desc">Basic information about your store that appears on receipts and reports.</p>
        <div class="cfg-grid-2">
          <div class="cfg-field">
            <label>Store Name</label>
            <input id="cfgStoreName" value="${escapeHtml(s.storeName || '')}" placeholder="e.g. Aking Tindahan">
          </div>
          <div class="cfg-field">
            <label>Store Phone</label>
            <input id="cfgStorePhone" value="${escapeHtml(s.storePhone || '')}" placeholder="e.g. +63 912 345 6789">
          </div>
        </div>
        <div class="cfg-grid-2">
          <div class="cfg-field">
            <label>Store Address</label>
            <input id="cfgStoreAddress" value="${escapeHtml(s.storeAddress || '')}" placeholder="e.g. 123 Rizal St, Barangay">
          </div>
          <div class="cfg-field">
            <label>Store Email</label>
            <input id="cfgStoreEmail" type="email" value="${escapeHtml(s.storeEmail || '')}" placeholder="e.g. store@email.com">
          </div>
        </div>
        <div class="cfg-field">
          <label>Store Description</label>
          <textarea id="cfgStoreDesc" rows="2" placeholder="Short description of your store...">${escapeHtml(s.storeDesc || '')}</textarea>
        </div>
        <button class="btn btn-primary" onclick="ConfigCenter._saveStore()">💾 Save Store Info</button>
      </div>`;
  },

  _saveStore() {
    this._saveSettings({
      storeName: getInputValue('cfgStoreName'),
      storePhone: getInputValue('cfgStorePhone'),
      storeAddress: getInputValue('cfgStoreAddress'),
      storeEmail: getInputValue('cfgStoreEmail'),
      storeDesc: getInputValue('cfgStoreDesc')
    });
  },

  // ============================
  // RECEIPT TAB
  // ============================
  _renderReceiptTab(el, s) {
    el.innerHTML = `
      <div class="cfg-section">
        <div class="cfg-section-title">🧾 Receipt Settings</div>
        <p class="cfg-section-desc">Customize how receipts look when printed or viewed.</p>
        <div class="cfg-grid-2">
          <div class="cfg-field">
            <label>Receipt Header</label>
            <input id="cfgReceiptHeader" value="${escapeHtml(s.receiptHeader || '')}" placeholder="e.g. Thank you for shopping!">
          </div>
          <div class="cfg-field">
            <label>Receipt Footer</label>
            <input id="cfgReceiptFooter" value="${escapeHtml(s.receiptFooter || '')}" placeholder="e.g. This serves as your official receipt">
          </div>
        </div>
        <div class="cfg-grid-2">
          <div class="cfg-field">
            <label>Default Receipt Message</label>
            <input id="cfgReceiptMessage" value="${escapeHtml(s.receiptMessage || 'Thank you for your purchase! ❤️')}" placeholder="e.g. Thank you for your purchase! ❤️">
          </div>
          <div class="cfg-field cfg-toggle-wrap">
            <label class="cfg-toggle">
              <input type="checkbox" id="cfgShowTax" ${s.showTaxOnReceipt ? 'checked' : ''}>
              <span class="cfg-toggle-slider"></span>
              <span class="cfg-toggle-label">Show tax on receipt</span>
            </label>
          </div>
        </div>
        <button class="btn btn-primary" onclick="ConfigCenter._saveReceipt()">💾 Save Receipt Settings</button>
      </div>`;
  },

  _saveReceipt() {
    this._saveSettings({
      receiptHeader: getInputValue('cfgReceiptHeader'),
      receiptFooter: getInputValue('cfgReceiptFooter'),
      receiptMessage: getInputValue('cfgReceiptMessage'),
      showTaxOnReceipt: document.getElementById('cfgShowTax')?.checked || false
    });
  },

  // ============================
  // INVENTORY TAB
  // ============================
  _renderInventoryTab(el, s) {
    el.innerHTML = `
      <div class="cfg-section">
        <div class="cfg-section-title">📦 Inventory Defaults</div>
        <p class="cfg-section-desc">Default values for new products and stock management.</p>
        <div class="cfg-grid-2">
          <div class="cfg-field">
            <label>Default Min Stock Level</label>
            <input id="cfgMinStock" type="number" value="${s.defaultMinStock || 5}" min="0" placeholder="5">
            <small>Products below this stock level trigger low stock alerts</small>
          </div>
          <div class="cfg-field">
            <label>Low Stock Threshold %</label>
            <input id="cfgLowThreshold" type="number" value="${s.lowStockThreshold || 20}" min="0" max="100" placeholder="20">
            <small>Percentage of min stock to highlight as warning</small>
          </div>
        </div>
        <div class="cfg-field cfg-toggle-wrap">
          <label class="cfg-toggle">
            <input type="checkbox" id="cfgAutoArchive" ${s.autoArchive ? 'checked' : ''}>
            <span class="cfg-toggle-slider"></span>
            <span class="cfg-toggle-label">Auto-archive products with 0 stock for 30+ days</span>
          </label>
        </div>
        <button class="btn btn-primary" onclick="ConfigCenter._saveInventory()">💾 Save Inventory Settings</button>
      </div>`;
  },

  _saveInventory() {
    this._saveSettings({
      defaultMinStock: parseInt(getInputValue('cfgMinStock')) || 5,
      lowStockThreshold: parseInt(getInputValue('cfgLowThreshold')) || 20,
      autoArchive: document.getElementById('cfgAutoArchive')?.checked || false
    });
  },

  // ============================
  // SALES TAB
  // ============================
  _renderSalesTab(el, s) {
    el.innerHTML = `
      <div class="cfg-section">
        <div class="cfg-section-title">💰 Sales Configuration</div>
        <p class="cfg-section-desc">Configure tax rates and payment defaults.</p>
        <div class="cfg-grid-2">
          <div class="cfg-field">
            <label>Tax Rate (%)</label>
            <input id="cfgTaxRate" type="number" step="0.1" value="${s.taxRate || 0}" min="0" max="100" placeholder="0">
            <small>Applied to all transactions (e.g. 12 for 12% VAT)</small>
          </div>
          <div class="cfg-field">
            <label>Currency Symbol</label>
            <input id="cfgCurrency" value="${escapeHtml(s.currency || '₱')}" maxlength="5" placeholder="₱">
          </div>
        </div>
        <div class="cfg-grid-2">
          <div class="cfg-field">
            <label>Default Payment Method</label>
            <select id="cfgPaymentMethod">
              <option value="cash" ${s.defaultPayment === 'cash' ? 'selected' : ''}>Cash</option>
              <option value="gcash" ${s.defaultPayment === 'gcash' ? 'selected' : ''}>GCash</option>
              <option value="card" ${s.defaultPayment === 'card' ? 'selected' : ''}>Card</option>
              <option value="bank_transfer" ${s.defaultPayment === 'bank_transfer' ? 'selected' : ''}>Bank Transfer</option>
            </select>
          </div>
          <div class="cfg-field">
            <label>Default Discount (%)</label>
            <input id="cfgDefaultDiscount" type="number" step="0.5" value="${s.defaultDiscount || 0}" min="0" max="100" placeholder="0">
            <small>Optional default discount applied to all sales</small>
          </div>
        </div>
        <button class="btn btn-primary" onclick="ConfigCenter._saveSales()">💾 Save Sales Settings</button>
      </div>`;
  },

  _saveSales() {
    this._saveSettings({
      taxRate: parseFloat(getInputValue('cfgTaxRate')) || 0,
      currency: getInputValue('cfgCurrency') || '₱',
      defaultPayment: document.getElementById('cfgPaymentMethod')?.value || 'cash',
      defaultDiscount: parseFloat(getInputValue('cfgDefaultDiscount')) || 0
    });
  },

  // ============================
  // NOTIFICATIONS TAB
  // ============================
  _renderNotificationsTab(el, s) {
    el.innerHTML = `
      <div class="cfg-section">
        <div class="cfg-section-title">🔔 Notification Preferences</div>
        <p class="cfg-section-desc">Control which alerts and notifications are shown.</p>
        <div class="cfg-toggle-group">
          <label class="cfg-toggle">
            <input type="checkbox" id="cfgNotifLowStock" ${s.notifLowStock !== false ? 'checked' : ''}>
            <span class="cfg-toggle-slider"></span>
            <span class="cfg-toggle-label">Low stock alerts</span>
          </label>
          <label class="cfg-toggle">
            <input type="checkbox" id="cfgNotifOutStock" ${s.notifOutStock !== false ? 'checked' : ''}>
            <span class="cfg-toggle-slider"></span>
            <span class="cfg-toggle-label">Out of stock alerts</span>
          </label>
          <label class="cfg-toggle">
            <input type="checkbox" id="cfgNotifDailySales" ${s.notifDailySales !== false ? 'checked' : ''}>
            <span class="cfg-toggle-slider"></span>
            <span class="cfg-toggle-label">Daily sales summary notification</span>
          </label>
          <label class="cfg-toggle">
            <input type="checkbox" id="cfgNotifExpired" ${s.notifExpired !== false ? 'checked' : ''}>
            <span class="cfg-toggle-slider"></span>
            <span class="cfg-toggle-label">Expired product alerts</span>
          </label>
        </div>
        <button class="btn btn-primary" onclick="ConfigCenter._saveNotifications()">💾 Save Notification Settings</button>
      </div>`;
  },

  _saveNotifications() {
    this._saveSettings({
      notifLowStock: document.getElementById('cfgNotifLowStock')?.checked || false,
      notifOutStock: document.getElementById('cfgNotifOutStock')?.checked || false,
      notifDailySales: document.getElementById('cfgNotifDailySales')?.checked || false,
      notifExpired: document.getElementById('cfgNotifExpired')?.checked || false
    });
  },

  // ============================
  // SECURITY TAB
  // ============================
  _renderSecurityTab(el, s) {
    el.innerHTML = `
      <div class="cfg-section">
        <div class="cfg-section-title">🔒 Security Settings</div>
        <p class="cfg-section-desc">Configure password policies and account security.</p>
        <div class="cfg-grid-2">
          <div class="cfg-field">
            <label>Minimum Password Length</label>
            <input id="cfgMinPwdLen" type="number" value="${s.minPasswordLength || 6}" min="4" max="32" placeholder="6">
          </div>
          <div class="cfg-field">
            <label>Max Login Attempts</label>
            <input id="cfgMaxAttempts" type="number" value="${s.maxLoginAttempts || 5}" min="1" max="20" placeholder="5">
            <small>Account locks after this many failed attempts</small>
          </div>
        </div>
        <div class="cfg-grid-2">
          <div class="cfg-field">
            <label>Lock Duration (minutes)</label>
            <input id="cfgLockDuration" type="number" value="${s.lockDuration || 30}" min="1" max="1440" placeholder="30">
            <small>How long before a locked account can try again</small>
          </div>
          <div class="cfg-field cfg-toggle-wrap">
            <label class="cfg-toggle">
              <input type="checkbox" id="cfgForcePwdChange" ${s.forcePasswordChange ? 'checked' : ''}>
              <span class="cfg-toggle-slider"></span>
              <span class="cfg-toggle-label">Force password change on first login</span>
            </label>
          </div>
        </div>
        <button class="btn btn-primary" onclick="ConfigCenter._saveSecurity()">💾 Save Security Settings</button>
      </div>`;
  },

  _saveSecurity() {
    this._saveSettings({
      minPasswordLength: parseInt(getInputValue('cfgMinPwdLen')) || 6,
      maxLoginAttempts: parseInt(getInputValue('cfgMaxAttempts')) || 5,
      lockDuration: parseInt(getInputValue('cfgLockDuration')) || 30,
      forcePasswordChange: document.getElementById('cfgForcePwdChange')?.checked || false
    });
  },

  // ============================
  // APPEARANCE TAB
  // ============================
  _renderAppearanceTab(el, s) {
    el.innerHTML = `
      <div class="cfg-section">
        <div class="cfg-section-title">🎨 Appearance</div>
        <p class="cfg-section-desc">Customize the look and feel of the application.</p>
        <div class="cfg-grid-2">
          <div class="cfg-field">
            <label>Default Theme</label>
            <select id="cfgTheme">
              <option value="dark" ${(s.defaultTheme || 'dark') === 'dark' ? 'selected' : ''}>🌙 Dark Mode</option>
              <option value="light" ${s.defaultTheme === 'light' ? 'selected' : ''}>☀️ Light Mode</option>
            </select>
          </div>
          <div class="cfg-field cfg-toggle-wrap">
            <label class="cfg-toggle">
              <input type="checkbox" id="cfgCompactMode" ${s.compactMode ? 'checked' : ''}>
              <span class="cfg-toggle-slider"></span>
              <span class="cfg-toggle-label">Compact mode (denser layouts)</span>
            </label>
          </div>
        </div>
        <button class="btn btn-primary" onclick="ConfigCenter._saveAppearance()">💾 Save Appearance</button>
      </div>`;
  },

  _saveAppearance() {
    this._saveSettings({
      defaultTheme: document.getElementById('cfgTheme')?.value || 'dark',
      compactMode: document.getElementById('cfgCompactMode')?.checked || false
    });
  },

  // ============================
  // MAINTENANCE TAB
  // ============================
  _renderMaintenanceTab(el, s) {
    el.innerHTML = `
      <div class="cfg-section">
        <div class="cfg-section-title">🛠️ Maintenance</div>
        <p class="cfg-section-desc">System tools for data management and troubleshooting.</p>
        <div class="cfg-card-grid">
          <div class="cfg-action-card">
            <div class="cfg-action-icon">📤</div>
            <div class="cfg-action-info">
              <strong>Export Data</strong>
              <small>Download all store data as JSON backup</small>
            </div>
            <button class="btn btn-primary btn-sm" onclick="ConfigCenter._exportData()">Export</button>
          </div>
          <div class="cfg-action-card">
            <div class="cfg-action-icon">📥</div>
            <div class="cfg-action-info">
              <strong>Import Data</strong>
              <small>Restore data from a JSON backup file</small>
            </div>
            <button class="btn btn-warning btn-sm" onclick="ConfigCenter._importData()">Import</button>
          </div>
          <div class="cfg-action-card cfg-action-danger">
            <div class="cfg-action-icon">🗑️</div>
            <div class="cfg-action-info">
              <strong>Clear All Data</strong>
              <small>⚠️ Permanently delete all store data</small>
            </div>
            <button class="btn btn-danger btn-sm" onclick="ConfigCenter._clearAllData()">Clear</button>
          </div>
          <div class="cfg-action-card">
            <div class="cfg-action-icon">📋</div>
            <div class="cfg-action-info">
              <strong>View Audit Log</strong>
              <small>Review all system activity</small>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="AdminModule.switchView('audit')">View</button>
          </div>
        </div>
      </div>`;
  },

  async _exportData() {
    if (typeof Backup !== 'undefined' && Backup.exportData) {
      Backup.exportData();
    } else {
      const data = StorageService.readRaw();
      if (!data) { UI.toast('No data to export.', 'warning'); return; }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `sari-sari-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      UI.toast('Data exported! ✅', 'success');
    }
  },

  async _importData() {
    if (typeof Backup !== 'undefined' && Backup.importData) {
      Backup.importData();
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const ok = await UI.confirm('Importing will REPLACE all current data. Continue?', '⚠️ Confirm Import');
        if (!ok) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          StorageService.importData(data);
          Auth.setDb(StorageService.readRaw());
          UI.toast('Data imported! Refreshing... ✅', 'success');
          setTimeout(() => location.reload(), 1500);
        } catch (err) {
          UI.toast('Invalid backup file!', 'error');
        }
      };
      input.click();
    }
  },

  async _clearAllData() {
    const ok = await UI.confirm(
      '⚠️ This will PERMANENTLY DELETE all products, transactions, users, and settings. This cannot be undone!\n\nAre you absolutely sure?',
      '⚠️ DANGER: Clear All Data'
    );
    if (!ok) return;
    const really = await UI.confirm(
      'Final warning: All data will be lost forever. Proceed?',
      'Confirm Destruction'
    );
    if (!really) return;
    localStorage.removeItem('sarisari_pos_data');
    Auth.setDb({ products: [], transactions: [], users: [], settings: { main: {} }, stats: {} });
    UI.toast('All data cleared. Refreshing...', 'info', 5000);
    setTimeout(() => location.reload(), 1500);
  },

  // ============================
  // BACKUP TAB
  // ============================
  _renderBackupTab(el, s) {
    const lastBackup = s.lastBackupDate || '';
    el.innerHTML = `
      <div class="cfg-section">
        <div class="cfg-section-title">🛡️ Backup & Restore</div>
        <p class="cfg-section-desc">Manage automatic backups and restore points.</p>
        <div class="cfg-card-grid">
          <div class="cfg-status-card">
            <div class="cfg-status-icon">📊</div>
            <div class="cfg-status-info">
              <strong>Data Overview</strong>
              <small id="cfgBackupStats">Loading...</small>
            </div>
          </div>
          <div class="cfg-status-card">
            <div class="cfg-status-icon">🕐</div>
            <div class="cfg-status-info">
              <strong>Last Backup</strong>
              <small id="cfgLastBackup">${lastBackup ? new Date(lastBackup).toLocaleString() : 'Never'}</small>
            </div>
          </div>
        </div>
        <div class="cfg-toggle-group" style="margin:12px 0;">
          <label class="cfg-toggle">
            <input type="checkbox" id="cfgAutoBackup" ${s.autoBackup ? 'checked' : ''} onchange="ConfigCenter._toggleAutoBackup()">
            <span class="cfg-toggle-slider"></span>
            <span class="cfg-toggle-label">Enable automatic daily backups</span>
          </label>
        </div>
        <div class="cfg-action-row">
          <button class="btn btn-primary" onclick="ConfigCenter._downloadBackup()">📥 Download Backup Now</button>
          <button class="btn btn-warning" onclick="ConfigCenter._restoreBackup()">📤 Restore from Backup</button>
        </div>
        <div class="cfg-info-box">
          <strong>ℹ️ Info:</strong> Backups are stored in your browser's local storage. For permanent safekeeping, download a backup file regularly.
        </div>
      </div>`;

    // Update stats
    const statsEl = document.getElementById('cfgBackupStats');
    if (statsEl) {
      const data = StorageService.readRaw();
      const products = (data.products || []).length;
      const transactions = (data.transactions || []).length;
      const users = (data.users || []).length;
      statsEl.textContent = `${products} products · ${transactions} transactions · ${users} users`;
    }
  },

  _toggleAutoBackup() {
    const checked = document.getElementById('cfgAutoBackup')?.checked || false;
    if (checked) {
      this._saveSettings({ autoBackup: true, lastBackupDate: new Date().toISOString() });
    } else {
      this._saveSettings({ autoBackup: false });
    }
  },

  _downloadBackup() {
    Backup.exportData();
    this._saveSettings({ lastBackupDate: new Date().toISOString() });
  },

  _restoreBackup() {
    Backup.importData();
  }
};

export default ConfigCenter;
