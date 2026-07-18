// ===============================
// SHARED AUDIT MODULE
// Activity logging with timestamps
// ===============================

import Auth from './auth.js';
import { generateId, getISOTimestamp, formatDate, escapeHtml } from './utils.js';
import StorageService from './storage.js';

const Audit = {
  async logAction(action, details = '') {
    try {
      const state = Auth.getState();
      const log = {
        id: generateId(),
        action,
        user: state.user || 'system',
        role: state.role || 'system',
        details,
        timestamp: getISOTimestamp()
      };
      StorageService.save('auditLogs', log);
      return log;
    } catch (e) {
      console.warn('Audit log failed:', e);
    }
  },

  _filterQuery: '',

  filterAuditLog(query) {
    this._filterQuery = (query || '').toLowerCase().trim();
    this.renderAuditLog();
  },

  renderAuditLog() {
    const container = document.getElementById('auditLogBody');
    if (!container) return;

    const state = Auth.getState();
    const data = state.db;
    if (!data || !data.auditLogs) {
      container.innerHTML = '<tr><td colspan="5">No audit records found.</td></tr>';
      return;
    }

    let logs = [...data.auditLogs].reverse();

    // Apply search filter
    const query = this._filterQuery;
    if (query) {
      logs = logs.filter(log =>
        (log.user || '').toLowerCase().includes(query) ||
        (log.action || '').toLowerCase().includes(query) ||
        (log.details || '').toLowerCase().includes(query) ||
        (log.role || '').toLowerCase().includes(query)
      );
    }

    if (logs.length === 0) {
      container.innerHTML = '<tr><td colspan="5">' +
        (query ? 'No audit records match your search.' : 'No audit records found.') +
        '</td></tr>';
      return;
    }

    container.innerHTML = logs.slice(0, 200).map(log => {
      const roleClass = 'badge-' + (log.role || 'system').toLowerCase().replace(/\s+/g, '');
      return `
      <tr>
        <td style="white-space:nowrap;">${escapeHtml(formatDate(log.timestamp))}</td>
        <td><span class="badge ${roleClass}">${escapeHtml(log.role || 'system')}</span></td>
        <td>${escapeHtml(log.user)}</td>
        <td><span class="badge badge-action">${escapeHtml(log.action)}</span></td>
        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(log.details)}</td>
      </tr>
    `}).join('');
  }
};

export default Audit;
