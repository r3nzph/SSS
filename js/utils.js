// ===============================
// UTILITY FUNCTIONS
// ===============================

/** Read store settings from localStorage (shared helper) */
function getStoreSettings() {
  try {
    const raw = localStorage.getItem('sarisari_pos_data');
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (data.settings && Array.isArray(data.settings)) {
      return data.settings.find(s => s.id === 'main') || {};
    }
    return data.settings?.main || data.settings || {};
  } catch { return {}; }
}

/** Format a number as currency (₱) */
function formatCurrency(amount) {
  const data = (() => {
    try {
      const raw = localStorage.getItem('sarisari_pos_data');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  })();
  const currency = data?.settings?.currency || '₱';
  const num = parseFloat(amount) || 0;
  return currency + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Format a date string to a user-friendly format */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return '—'; }
}

/** Short date (no time) */
function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return '—'; }
}

/** Escape HTML to prevent XSS */
function escapeHtml(str) {
  if (typeof str !== 'string') return str || '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Generate a unique ID */
function generateId(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
}

/** Get ISO timestamp string */
function getISOTimestamp() {
  return new Date().toISOString();
}

/** Get input value by element ID */
function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

/** Show a modal overlay */
function showModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

/** Hide a modal overlay */
function hideModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

/** Handle an error with a toast notification */
function handleError(e, context = '') {
  console.error(`[${context}] Error:`, e);
  try {
    import('./ui.js').then(m => {
      m.default.toast(`Error${context ? ' in ' + context : ''}: ${e.message || 'Unknown error'}`, 'error');
    }).catch(() => {});
  } catch (_) {}
}

/** Clamp a number between min and max */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Debounce a function */
function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/** Truncate text with ellipsis */
function truncate(str, maxLen = 50) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
}

/** Get today's date as ISO string (YYYY-MM-DD) */
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/** Get start of today as ISO datetime */
function todayStart() {
  return new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
}

/** Get end of today as ISO datetime */
function todayEnd() {
  return new Date(new Date().setHours(23, 59, 59, 999)).toISOString();
}

/** Format percentage */
function formatPercent(value, decimals = 1) {
  return (parseFloat(value) || 0).toFixed(decimals) + '%';
}

/** Pluralize a word */
function pluralize(count, singular, plural) {
  return count === 1 ? singular : (plural || singular + 's');
}

/**
 * Centralized chart theme colors.
 * Returns semantic color names that adapt to the current theme.
 * All canvas-based charts should use these colors instead of hardcoded rgba().
 */
function getChartTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    chartTitle:    isLight ? '#111827' : 'rgba(255,255,255,0.6)',
    axisLabel:     isLight ? '#374151' : 'rgba(255,255,255,0.5)',
    axisLabelDim:  isLight ? '#4B5563' : 'rgba(255,255,255,0.4)',
    dataValue:     isLight ? '#111827' : 'rgba(255,255,255,0.7)',
    dataValueBold: isLight ? '#111827' : 'rgba(255,255,255,0.8)',
    emptyText:     isLight ? '#6B7280' : 'rgba(255,255,255,0.3)',
    mutedText:     isLight ? '#6B7280' : 'rgba(255,255,255,0.4)',
    legendText:    isLight ? '#111827' : 'rgba(255,255,255,0.65)',
    gridLine:      isLight ? '#E5E7EB' : 'rgba(255,255,255,0.08)',
  };
}

/** Get stock level CSS class */
function getStockLevel(stock, product) {
  if (product && product.archived) return 'stock-archived';
  if (stock <= 0) return 'stock-none';
  const minStock = (product && product.minStock) || 5;
  if (stock <= minStock) return 'stock-low';
  return 'stock-high';
}

/** Clear an input field by ID */
function clearInput(id) {
  const el = document.getElementById(id);
  if (el) {
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  }
}

/** Set an input field value by ID */
function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value != null ? value : '';
}

/** Get existing IDs from a collection */
function getExistingIds(collectionName) {
  try {
    const raw = localStorage.getItem('sarisari_pos_data');
    if (!raw) return [];
    const data = JSON.parse(raw);
    const items = data[collectionName] || [];
    return items.map(i => i.id).filter(Boolean);
  } catch { return []; }
}

/** Get a value from a select or input by ID */
function getSelectValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

/** Set a select value by ID */
function setSelectValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value != null ? value : '';
}

export default {
  formatCurrency, formatDate, formatShortDate, escapeHtml, generateId,
  getISOTimestamp, getInputValue, showModal, hideModal, handleError,
  clamp, debounce, truncate, todayISO, todayStart, todayEnd, formatPercent, pluralize,
  getStockLevel, clearInput, setInputValue, getExistingIds, getSelectValue, setSelectValue,
  getStoreSettings, getChartTheme
};

export {
  formatCurrency, formatDate, formatShortDate, escapeHtml, generateId,
  getISOTimestamp, getInputValue, showModal, hideModal, handleError,
  clamp, debounce, truncate, todayISO, todayStart, todayEnd, formatPercent, pluralize,
  getStockLevel, clearInput, setInputValue, getExistingIds, getSelectValue, setSelectValue,
  getStoreSettings, getChartTheme
};
