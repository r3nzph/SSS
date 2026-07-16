// ===============================
// STOCK ADJUSTMENTS MODULE — Full implementation
// Product search, stock preview, adjustment creation,
// audit logging, filter/sort/paginate history, CSV export
// Uses ONLY StorageService — no Electron, no Node.js
// ===============================

import Auth from './auth.js';
import UI from './ui.js';
import Audit from './audit.js';
import { escapeHtml, formatCurrency, formatDate, getInputValue, setInputValue, clearInput, generateId, getISOTimestamp, showModal, hideModal } from './utils.js';
import StorageService from './storage.js';

const StockAdjustments = {
  _filters: { search: '', type: '' },
  _sort: { field: 'createdAt', dir: 'desc' },
  _page: 1, _pageSize: 15,
  _selectedProduct: null,
  _confirmEnabled: false,

  // ============================
  // MAIN RENDER
  // ============================

  renderAdjustmentHistory() {
    const tbody = document.getElementById('adjHistoryBody');
    if (!tbody) return;
    const data = Auth.state.db;
    if (!data || !data.stockAdjustments) {
      tbody.innerHTML = '<tr><td colspan="9">No adjustments recorded.</td></tr>';
      return;
    }

    let items = this._getFilteredItems(data.stockAdjustments);
    items = this._sortItems(items);
    const total = items.length;
    const pages = Math.ceil(total / this._pageSize) || 1;
    if (this._page > pages) this._page = pages;
    const start = (this._page - 1) * this._pageSize;
    const page = items.slice(start, start + this._pageSize);

    this._renderPagination(total, pages);
    this._renderSummary(total);

    if (page.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9">No adjustments match your criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = page.map(a => {
      const diff = a.difference || (a.newStock - a.oldStock);
      const diffClass = diff >= 0 ? 'adj-positive' : 'adj-negative';
      const diffSign = diff >= 0 ? '+' : '';
      return `<tr>
        <td style="font-family:monospace;font-size:0.8rem;">${escapeHtml(a.adjNumber || a.id || '')}</td>
        <td><strong>${escapeHtml(a.productName || '')}</strong></td>
        <td>${a.oldStock}</td>
        <td>${a.newStock}</td>
        <td class="${diffClass}">${diffSign}${diff}</td>
        <td>${escapeHtml(this._getTypeLabel(a.type || ''))}</td>
        <td>${escapeHtml((a.reason || '').substring(0, 35))}${(a.reason || '').length > 35 ? '…' : ''}</td>
        <td>${escapeHtml(a.user || '—')}</td>
        <td style="font-size:0.8rem;white-space:nowrap;">${formatDate(a.createdAt)}</td>
      </tr>`;
    }).join('');
  },

  _getTypeLabel(type) {
    const labels = {
      damaged: '💔 Damaged', expired: '⏰ Expired', lost: '🔍 Lost/Theft',
      customer_return: '🔄 Cust. Return', supplier_return: '📤 Sup. Return',
      count_correction: '📊 Count Corr.', manual: '✏️ Manual', other: '📝 Other'
    };
    return labels[type] || type;
  },

  _getFilteredItems(items) {
    let filtered = [...items];
    if (this._filters.search) {
      const q = this._filters.search.toLowerCase();
      filtered = filtered.filter(x =>
        (x.productName || '').toLowerCase().includes(q) ||
        (x.adjNumber || x.id || '').toLowerCase().includes(q) ||
        (x.reason || '').toLowerCase().includes(q)
      );
    }
    if (this._filters.type) {
      filtered = filtered.filter(x => x.type === this._filters.type);
    }
    return filtered;
  },

  _sortItems(items) {
    const { field, dir } = this._sort;
    return [...items].sort((a, b) => {
      let va, vb;
      switch (field) {
        case 'adjNumber': va = (a.adjNumber || a.id || ''); vb = (b.adjNumber || b.id || ''); break;
        case 'createdAt': va = new Date(a.createdAt || 0); vb = new Date(b.createdAt || 0); break;
        case 'productName': va = (a.productName || '').toLowerCase(); vb = (b.productName || '').toLowerCase(); break;
        default: va = new Date(a.createdAt || 0); vb = new Date(b.createdAt || 0);
      }
      return va < vb ? (dir === 'asc' ? -1 : 1) : va > vb ? (dir === 'asc' ? 1 : -1) : 0;
    });
  },

  setFilter(type, value) {
    if (type === 'search') this._filters.search = value;
    else if (type === 'type') this._filters.type = value;
    this._page = 1;
    this.renderAdjustmentHistory();
  },

  setSort(field) {
    if (this._sort.field === field) {
      this._sort.dir = this._sort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      this._sort.field = field;
      this._sort.dir = 'desc';
    }
    this._page = 1;
    this.renderAdjustmentHistory();
  },

  setPage(p) { this._page = p; this.renderAdjustmentHistory(); },

  _renderPagination(total, pages) {
    const el = document.getElementById('adjPagination');
    if (!el) return;
    if (pages <= 1) { el.innerHTML = ''; return; }
    const p = this._page;
    let h = `<button class="btn btn-icon btn-sm" onclick="StockAdjustments.setPage(${p - 1})" ${p <= 1 ? 'disabled' : ''}>‹</button>`;
    const maxVisible = 5;
    let startPg = Math.max(1, p - Math.floor(maxVisible / 2));
    let endPg = Math.min(pages, startPg + maxVisible - 1);
    if (endPg - startPg < maxVisible - 1) startPg = Math.max(1, endPg - maxVisible + 1);
    if (startPg > 1) {
      h += `<button class="btn btn-icon btn-sm" onclick="StockAdjustments.setPage(1)">1</button>`;
      if (startPg > 2) h += `<span class="inv-pg-ellipsis">…</span>`;
    }
    for (let i = startPg; i <= endPg; i++)
      h += `<button class="btn btn-icon btn-sm ${i === p ? 'btn-primary' : 'btn-ghost'}" onclick="StockAdjustments.setPage(${i})">${i}</button>`;
    if (endPg < pages) {
      if (endPg < pages - 1) h += `<span class="inv-pg-ellipsis">…</span>`;
      h += `<button class="btn btn-icon btn-sm" onclick="StockAdjustments.setPage(${pages})">${pages}</button>`;
    }
    h += `<button class="btn btn-icon btn-sm" onclick="StockAdjustments.setPage(${p + 1})" ${p >= pages ? 'disabled' : ''}>›</button>`;
    el.innerHTML = h;
  },

  _renderSummary(total) {
    const el = document.getElementById('adjSummary');
    if (!el) return;
    const start = (this._page - 1) * this._pageSize + 1;
    const end = Math.min(start + this._pageSize - 1, total);
    el.textContent = total > 0 ? `Showing ${start}–${end} of ${total} adjustments` : 'No adjustments found';
  },

  // ============================
  // ADJUSTMENT MODAL
  // ============================

  showAdjustModal() {
    this._selectedProduct = null;
    this._confirmEnabled = false;
    this._resetModalForm();
    this._populateProductSelect();
    document.getElementById('adjModalTitle').textContent = '🔧 New Stock Adjustment';
    const section = document.getElementById('adjConfirmSection');
    if (section) section.classList.add('hidden');
    showModal('adjModalOverlay');
  },

  closeModal() {
    hideModal('adjModalOverlay');
    this._selectedProduct = null;
    this._confirmEnabled = false;
  },

  _resetModalForm() {
    const fields = ['adjProductSearch', 'adjQty', 'adjReason'];
    fields.forEach(f => { const el = document.getElementById(f); if (el) el.value = ''; });
    const typeSelect = document.getElementById('adjType');
    if (typeSelect) typeSelect.value = '';
    this._updateStockPreview(null, null, null);
    const warning = document.getElementById('adjQtyWarning');
    if (warning) warning.classList.add('hidden');
    const section = document.getElementById('adjConfirmSection');
    if (section) section.classList.add('hidden');
  },

  _populateProductSelect() {
    const select = document.getElementById('adjProductSelect');
    if (!select) return;
    const products = StorageService.load('products').filter(p => !p.archived);
    select.innerHTML = '<option value="">-- Select Product --</option>' +
      products.map(p =>
        `<option value="${p.id}">${escapeHtml(p.name)} ${p.barcode ? '(#' + escapeHtml(p.barcode) + ')' : ''} — Stock: ${p.stock}</option>`
      ).join('');
  },

  _quickProductSearch() {
    const query = (document.getElementById('adjProductSearch')?.value || '').toLowerCase();
    const select = document.getElementById('adjProductSelect');
    if (!select) return;
    const products = StorageService.load('products').filter(p => !p.archived);
    const filtered = query
      ? products.filter(p =>
          p.name.toLowerCase().includes(query) ||
          (p.barcode || '').toLowerCase().includes(query) ||
          (p.category || '').toLowerCase().includes(query)
        )
      : products;
    select.innerHTML = '<option value="">-- Select Product --</option>' +
      filtered.map(p =>
        `<option value="${p.id}">${escapeHtml(p.name)} ${p.barcode ? '(#' + escapeHtml(p.barcode) + ')' : ''} — Stock: ${p.stock}</option>`
      ).join('');
  },

  _onProductSelect() {
    const select = document.getElementById('adjProductSelect');
    const productId = select?.value;
    if (!productId) {
      this._selectedProduct = null;
      this._updateStockPreview(null, null, null);
      this._previewAdjustment();
      return;
    }
    const product = StorageService.load('products', productId);
    if (product) {
      this._selectedProduct = product;
      document.getElementById('adjOldStock').textContent = product.stock;
      document.getElementById('adjDifference').textContent = '—';
      document.getElementById('adjNewStockPreview').textContent = '—';
    }
    this._previewAdjustment();
  },

  _previewAdjustment() {
    const qtyInput = document.getElementById('adjQty');
    const qty = parseInt(qtyInput?.value, 10);
    const reason = document.getElementById('adjReason')?.value?.trim();
    const type = document.getElementById('adjType')?.value;
    const warning = document.getElementById('adjQtyWarning');
    const section = document.getElementById('adjConfirmSection');

    if (!this._selectedProduct || !qty || isNaN(qty) || qty === 0 || !type || !reason) {
      this._confirmEnabled = false;
      if (warning) warning.classList.add('hidden');
      if (section) section.classList.add('hidden');
      return;
    }

    const product = this._selectedProduct;
    const newStock = product.stock + qty;
    const diffEl = document.getElementById('adjDifference');
    const newStockEl = document.getElementById('adjNewStockPreview');

    if (diffEl) {
      diffEl.textContent = `${qty >= 0 ? '+' : ''}${qty}`;
      diffEl.style.color = qty >= 0 ? 'var(--success)' : 'var(--danger)';
    }
    if (newStockEl) {
      newStockEl.textContent = newStock < 0 ? `${newStock} ⚠️` : newStock;
      newStockEl.style.color = newStock < 0 ? 'var(--danger)' : 'var(--accent-secondary)';
    }

    // Show warning if stock would go negative
    if (newStock < 0 && warning) {
      warning.textContent = `⚠️ This adjustment will result in negative stock (${newStock}). Consider adjusting by ${Math.abs(newStock)} less.`;
      warning.classList.remove('hidden');
      this._confirmEnabled = false;
    } else {
      if (warning) warning.classList.add('hidden');
      this._confirmEnabled = true;
    }

    // Show confirm section
    if (section) {
      if (this._confirmEnabled) section.classList.remove('hidden');
      else section.classList.add('hidden');
    }
  },

  async confirmAdjustment() {
    if (!this._confirmEnabled) {
      UI.toast('Please fill all required fields and ensure the adjustment is valid.', 'error');
      return;
    }

    const product = this._selectedProduct;
    const qty = parseInt(document.getElementById('adjQty')?.value, 10);
    const type = document.getElementById('adjType')?.value;
    const reason = document.getElementById('adjReason')?.value?.trim();

    if (!product || !qty || isNaN(qty) || qty === 0 || !type || !reason) return;

    const saveBtn = document.querySelector('#adjModalOverlay .btn-warning');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Applying...'; }

    try {
      const newStock = product.stock + qty;
      const now = getISOTimestamp();
      const adjId = generateId('adj');
      const adjNumber = `ADJ-${now.replace(/[^0-9]/g, '').slice(0, 12)}`;

      // Create adjustment record
      const adjustment = {
        id: adjId,
        adjNumber,
        productId: product.id,
        productName: product.name,
        oldStock: product.stock,
        newStock: Math.max(0, newStock),
        difference: qty,
        type,
        reason,
        user: Auth.state.user || 'system',
        createdAt: now,
        updatedAt: now
      };
      StorageService.save('stockAdjustments', adjustment);

      // Update product stock (never below 0)
      const updatedStock = Math.max(0, newStock);
      StorageService.update('products', product.id, {
        stock: updatedStock,
        lastUpdated: now
      });

      Auth.setDb(StorageService.readRaw());
      await Audit.logAction('STOCK_ADJUST', `${type}: "${product.name}" ${qty >= 0 ? '+' : ''}${qty} units (${reason})`);

      UI.toast(`Adjustment applied to "${product.name}". New stock: ${updatedStock}`, 'success');

      this.closeModal();
      this.renderAdjustmentHistory();

      if (typeof window.AdminModule !== 'undefined' && typeof window.AdminModule.refreshAll === 'function') {
        window.AdminModule.refreshAll();
      }
    } catch (e) {
      console.error('[StockAdjustments] Save error:', e);
      UI.toast('Failed to save adjustment.', 'error');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '🔧 Confirm Adjustment'; }
    }
  },

  _updateStockPreview(oldStock, diff, newStock) {
    document.getElementById('adjOldStock').textContent = oldStock !== null ? oldStock : '—';
    const diffEl = document.getElementById('adjDifference');
    if (diffEl) diffEl.textContent = diff !== null ? (diff >= 0 ? '+' : '') + diff : '—';
    const newEl = document.getElementById('adjNewStockPreview');
    if (newEl) newEl.textContent = newStock !== null ? newStock : '—';
  },

  // ============================
  // TIMELINE MODAL
  // ============================

  closeTimelineModal() {
    const overlay = document.getElementById('adjTimelineOverlay');
    if (overlay) overlay.classList.remove('active');
  },

  // ============================
  // CSV EXPORT
  // ============================

  exportCSV() {
    const data = Auth.state.db;
    if (!data || !data.stockAdjustments || data.stockAdjustments.length === 0) {
      UI.toast('No adjustments to export.', 'warning');
      return;
    }
    const items = this._getFilteredItems(data.stockAdjustments);
    if (items.length === 0) { UI.toast('No matching adjustments to export.', 'warning'); return; }

    const rows = [['Adj #', 'Product', 'Old Stock', 'New Stock', 'Difference', 'Type', 'Reason', 'User', 'Date']];
    items.forEach(a => {
      const diff = a.difference || (a.newStock - a.oldStock);
      rows.push([
        a.adjNumber || a.id || '',
        a.productName || '',
        a.oldStock,
        a.newStock,
        diff,
        a.type || '',
        (a.reason || '').replace(/"/g, '""'),
        a.user || '',
        a.createdAt || ''
      ]);
    });

    const csv = rows.map(r => r.map(v => typeof v === 'string' && v.includes(',') ? `"${v}"` : v).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `adjustments_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    UI.toast(`Exported ${items.length} adjustment(s) to CSV.`, 'success');
  }
};

export default StockAdjustments;
