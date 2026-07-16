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

  renderAuditLog() {
    const container = document.getElementById('auditLogBody');
    if (!container) return;

    const state = Auth.getState();
    const data = state.db;
    if (!data || !data.auditLogs) {
      container.innerHTML = '<tr><td colspan="4">No audit records found.</td></tr>';
      return;
    }

    const logs = [...data.auditLogs].reverse();
    if (logs.length === 0) {
      container.innerHTML = '<tr><td colspan="4">No audit records found.</td></tr>';
      return;
    }

    container.innerHTML = logs.map(log => `
      <tr>
        <td>${escapeHtml(formatDate(log.timestamp))}</td>
        <td><span class="badge badge-${escapeHtml(log.role)}">${escapeHtml(log.role)}</span></td>
        <td>${escapeHtml(log.user)}</td>
        <td><span class="badge badge-action">${escapeHtml(log.action)}</span></td>
        <td>${escapeHtml(log.details)}</td>
      </tr>
    `).join('');
  }
};

export default Audit;
