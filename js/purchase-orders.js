// ===============================
// PURCHASING MODULE v2 — Full implementation
// Create, edit, approve, cancel Purchase Orders
// Item management, timeline tracking, export CSV, print
// Uses ONLY StorageService — no Electron, no Node.js
// ===============================

import Auth from './auth.js';
import Audit from './audit.js';
import UI from './ui.js';
import { escapeHtml, formatCurrency, formatDate, getInputValue, setInputValue, clearInput, generateId, getISOTimestamp, showModal, hideModal } from './utils.js';
import StorageService from './storage.js';

const Purchasing = {
  _currentPage: 1, _pageSize: 10,
  _searchQuery: '', _statusFilter: '',
  _sortField: 'createdAt', _sortDir: 'desc',
  _editingPOId: null,

  // ============================
  // MAIN RENDER
  // ============================

  renderPOs() {
    const tbody = document.getElementById('poTable');
    if (!tbody) return;
    const pos = StorageService.load('purchaseOrders');
    let filtered = this._getFilteredPOs(pos);
    filtered = this._sortPOs(filtered);
    const total = filtered.length, pages = Math.ceil(total / this._pageSize) || 1;
    if (this._currentPage > pages) this._currentPage = pages;
    const start = (this._currentPage - 1) * this._pageSize;
    const page = filtered.slice(start, start + this._pageSize);

    this._renderPagination(total, pages);
    this._renderSummary(total);

    if (page.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">No purchase orders found.</td></tr>';
      return;
    }

    tbody.innerHTML = page.map(po => {
      const statusBadge = this._getStatusBadge(po.status);
      const itemCount = po.items ? po.items.reduce((s, i) => s + i.qty, 0) : 0;
      const canEdit = ['draft', 'pending'].includes(po.status);
      const canApprove = po.status === 'draft' || po.status === 'pending';
      const canReceive = po.status === 'pending' || po.status === 'approved' || po.status === 'partial';
      const canCancel = !['received', 'cancelled'].includes(po.status);

      return `
        <tr>
          <td><strong>${escapeHtml(po.poNumber || po.id)}</strong></td>
          <td>${escapeHtml(po.supplierName || po.supplierId || '—')}</td>
          <td>${itemCount} items</td>
          <td class="price-cell">${formatCurrency(po.total || 0)}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn-icon btn-sm" onclick="Purchasing.viewPO('${po.id}')" title="View details">👁️</button>
            ${canEdit ? `<button class="btn-icon btn-sm" onclick="Purchasing.editPO('${po.id}')" title="Edit">✎</button>` : ''}
            ${canApprove ? `<button class="btn-icon btn-sm" onclick="Purchasing.approvePO('${po.id}')" title="Approve" style="color:var(--info);">✅</button>` : ''}
            ${canReceive ? `<button class="btn-icon btn-sm" onclick="Purchasing.receivePO('${po.id}')" title="Receive stock" style="color:var(--success);">📥</button>` : ''}
            ${canCancel ? `<button class="btn-icon btn-sm" onclick="Purchasing.cancelPO('${po.id}')" title="Cancel" style="color:var(--danger);">✕</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  // ============================
  // FILTERING & SORTING
  // ============================

  setFilter(type, value) {
    if (type === 'search') this._searchQuery = value;
    else if (type === 'status') this._statusFilter = value;
    this._currentPage = 1;
    this.renderPOs();
  },

  setSort(field) {
    if (this._sortField === field) this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
    else { this._sortField = field; this._sortDir = 'desc'; }
    this._currentPage = 1;
    this.renderPOs();
  },

  setPage(p) { this._currentPage = p; this.renderPOs(); },

  _getFilteredPOs(pos) {
    let filtered = [...(pos || [])];
    if (this._searchQuery) {
      const q = this._searchQuery.toLowerCase();
      filtered = filtered.filter(po =>
        (po.poNumber || po.id || '').toLowerCase().includes(q) ||
        (po.supplierName || '').toLowerCase().includes(q) ||
        (po.supplierId || '').toLowerCase().includes(q) ||
        (po.items || []).some(i => i.productName && i.productName.toLowerCase().includes(q))
      );
    }
    if (this._statusFilter) filtered = filtered.filter(po => po.status === this._statusFilter);
    return filtered;
  },

  _sortPOs(pos) {
    const { _sortField: field, _sortDir: dir } = this;
    return [...pos].sort((a, b) => {
      let va, vb;
      switch (field) {
        case 'poNumber': va = (a.poNumber || a.id || '').toLowerCase(); vb = (b.poNumber || b.id || '').toLowerCase(); break;
        case 'supplierName': va = (a.supplierName || '').toLowerCase(); vb = (b.supplierName || '').toLowerCase(); break;
        case 'status': va = a.status || ''; vb = b.status || ''; break;
        case 'total': va = a.total || 0; vb = b.total || 0; break;
        default: va = new Date(a.createdAt || 0).getTime(); vb = new Date(b.createdAt || 0).getTime();
      }
      return va < vb ? (dir === 'asc' ? -1 : 1) : va > vb ? (dir === 'asc' ? 1 : -1) : 0;
    });
  },

  _renderPagination(total, pages) {
    const el = document.getElementById('poPagination');
    if (!el) return;
    if (pages <= 1) { el.innerHTML = ''; return; }
    const p = this._currentPage;
    let h = `<button class="btn btn-icon btn-sm" onclick="Purchasing.setPage(${p - 1})" ${p <= 1 ? 'disabled' : ''}>‹</button>`;
    const maxVisible = 5;
    let startPage = Math.max(1, p - Math.floor(maxVisible / 2));
    let endPage = Math.min(pages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);
    if (startPage > 1) {
      h += `<button class="btn btn-icon btn-sm" onclick="Purchasing.setPage(1)">1</button>`;
      if (startPage > 2) h += `<span class="inv-pg-ellipsis">…</span>`;
    }
    for (let i = startPage; i <= endPage; i++)
      h += `<button class="btn btn-icon btn-sm ${i === p ? 'btn-primary' : 'btn-ghost'}" onclick="Purchasing.setPage(${i})">${i}</button>`;
    if (endPage < pages) {
      if (endPage < pages - 1) h += `<span class="inv-pg-ellipsis">…</span>`;
      h += `<button class="btn btn-icon btn-sm" onclick="Purchasing.setPage(${pages})">${pages}</button>`;
    }
    h += `<button class="btn btn-icon btn-sm" onclick="Purchasing.setPage(${p + 1})" ${p >= pages ? 'disabled' : ''}>›</button>`;
    el.innerHTML = h;
  },

  _renderSummary(total) {
    const el = document.getElementById('poSummary');
    if (!el) return;
    const start = (this._currentPage - 1) * this._pageSize + 1;
    const end = Math.min(start + this._pageSize - 1, total);
    el.textContent = total > 0 ? `Showing ${start}–${end} of ${total} POs` : 'No purchase orders found';
  },

  // ============================
  // CREATE / EDIT PO MODAL
  // ============================

  showCreatePOModal() {
    this._editingPOId = null;
    this._clearPOForm();
    document.getElementById('poModalTitle').textContent = 'Create Purchase Order';
    this._populateSupplierSelect();
    const tbody = document.getElementById('poItemsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No items added yet.</td></tr>';
    this._updatePOTotals();
    showModal('poModalOverlay');
  },

  editPO(id) {
    const po = StorageService.load('purchaseOrders', id);
    if (!po) { UI.toast('Purchase order not found.', 'error'); return; }
    if (!['draft', 'pending'].includes(po.status)) {
      UI.toast('Cannot edit a PO that is not Draft or Pending.', 'warning');
      return;
    }
    this._editingPOId = id;
    document.getElementById('poModalTitle').textContent = 'Edit Purchase Order';
    this._populateSupplierSelect(po.supplierId);
    setInputValue('poExpectedDate', po.expectedDate ? po.expectedDate.slice(0, 10) : '');
    setInputValue('poNotes', po.notes || '');
    this._renderPOItemsTable(po.items || []);
    this._updatePOTotals();
    showModal('poModalOverlay');
  },

  closePOModal() { hideModal('poModalOverlay'); this._editingPOId = null; },

  _clearPOForm() {
    const select = document.getElementById('poSupplierSelect');
    if (select) select.value = '';
    clearInput('poExpectedDate');
    clearInput('poNotes');
  },

  _populateSupplierSelect(selectedId) {
    const select = document.getElementById('poSupplierSelect');
    if (!select) return;
    const suppliers = StorageService.load('suppliers').filter(s => !s.archived && s.status !== 'inactive');
    select.innerHTML = '<option value="">-- Select Supplier --</option>' +
      suppliers.map(s =>
        `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${escapeHtml(s.companyName || s.name)}</option>`
      ).join('');
  },

  // ============================
  // PO ITEMS MANAGEMENT
  // ============================

  addPOItem() {
    const productName = getInputValue('poItemName');
    const qty = parseInt(getInputValue('poItemQty'), 10);
    const cost = parseFloat(getInputValue('poItemCost'));
    if (!productName) { UI.toast('Product name is required.', 'error'); return; }
    if (isNaN(qty) || qty <= 0) { UI.toast('Quantity must be > 0.', 'error'); return; }
    if (isNaN(cost) || cost <= 0) { UI.toast('Cost must be > 0.', 'error'); return; }

    const tbody = document.getElementById('poItemsTableBody');
    if (!tbody) return;
    const placeholder = tbody.querySelector('td[colspan]');
    if (placeholder) tbody.innerHTML = '';

    const row = document.createElement('tr');
    row.dataset.name = productName;
    row.dataset.qty = qty;
    row.dataset.cost = cost;
    row.dataset.total = qty * cost;
    row.innerHTML = `
      <td>${escapeHtml(productName)}</td>
      <td>${qty}</td>
      <td class="price-cell">${formatCurrency(cost)}</td>
      <td class="price-cell">${formatCurrency(qty * cost)}</td>
      <td><button class="btn-icon btn-sm" onclick="this.closest('tr').remove();Purchasing._updatePOTotals()" style="color:var(--danger);">✕</button></td>
    `;
    tbody.appendChild(row);

    clearInput('poItemName');
    setInputValue('poItemQty', '1');
    clearInput('poItemCost');
    this._updatePOTotals();
    document.getElementById('poItemName').focus();
  },

  _renderPOItemsTable(items) {
    const tbody = document.getElementById('poItemsTableBody');
    if (!tbody) return;
    if (!items || items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No items added yet.</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(item => `
      <tr data-name="${escapeHtml(item.productName)}" data-qty="${item.qty}" data-cost="${item.cost}" data-total="${item.total}">
        <td>${escapeHtml(item.productName)}</td>
        <td>${item.qty}</td>
        <td class="price-cell">${formatCurrency(item.cost)}</td>
        <td class="price-cell">${formatCurrency(item.total)}</td>
        <td><button class="btn-icon btn-sm" onclick="this.closest('tr').remove();Purchasing._updatePOTotals()" style="color:var(--danger);">✕</button></td>
      </tr>
    `).join('');
  },

  _updatePOTotals() {
    const tbody = document.getElementById('poItemsTableBody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr:not(:has(td[colspan]))');
    let totalQty = 0, totalCost = 0;
    rows.forEach(row => {
      totalQty += parseInt(row.dataset.qty) || 0;
      totalCost += parseFloat(row.dataset.total) || 0;
    });
    const qtyEl = document.getElementById('poTotalQty');
    const costEl = document.getElementById('poTotalCost');
    if (qtyEl) qtyEl.textContent = totalQty;
    if (costEl) costEl.textContent = formatCurrency(totalCost);
  },

  // ============================
  // SAVE PO
  // ============================

  async savePO() {
    const supplierSelect = document.getElementById('poSupplierSelect');
    const supplierId = supplierSelect ? supplierSelect.value : '';
    if (!supplierId) { UI.toast('Please select a supplier.', 'error'); return; }

    const supplier = StorageService.load('suppliers', supplierId);
    if (!supplier) { UI.toast('Supplier not found.', 'error'); return; }

    const items = [];
    const tbody = document.getElementById('poItemsTableBody');
    if (tbody) {
      tbody.querySelectorAll('tr:not(:has(td[colspan]))').forEach(row => {
        items.push({
          productName: row.dataset.name,
          qty: parseInt(row.dataset.qty) || 0,
          cost: parseFloat(row.dataset.cost) || 0,
          total: parseFloat(row.dataset.total) || 0
        });
      });
    }

    if (items.length === 0) { UI.toast('Add at least one item.', 'error'); return; }

    const total = items.reduce((s, i) => s + i.total, 0);
    const expectedDate = getInputValue('poExpectedDate');
    const notes = getInputValue('poNotes');
    const now = getISOTimestamp();
    const userName = Auth.state.user || 'admin';

    if (this._editingPOId) {
      // UPDATE existing PO
      StorageService.update('purchaseOrders', this._editingPOId, {
        supplierId,
        supplierName: supplier.companyName || supplier.name,
        items, total,
        expectedDate: expectedDate || '', notes,
        lastUpdated: now,
        timeline: [
          ...((StorageService.load('purchaseOrders', this._editingPOId) || {}).timeline || []),
          { action: 'edited', date: now, user: userName }
        ]
      });
      Auth.setDb(StorageService.readRaw());
      await Audit.logAction('PO_UPDATE', `Updated PO ${this._editingPOId} for ${supplier.companyName}`);
      UI.toast('PO updated.', 'success');
    } else {
      // CREATE new PO
      const existingPOs = StorageService.load('purchaseOrders');
      const existingNumbers = existingPOs.map(p => p.poNumber).filter(Boolean);
      let poNumber;
      do {
        poNumber = 'PO-' + Date.now().toString(36).toUpperCase();
      } while (existingNumbers.includes(poNumber));

      const po = {
        id: generateId('po'),
        poNumber, supplierId,
        supplierName: supplier.companyName || supplier.name,
        items, total, status: 'draft',
        expectedDate: expectedDate || '', notes,
        createdBy: userName, createdAt: now, lastUpdated: now,
        timeline: [{ action: 'created', date: now, user: userName }]
      };
      StorageService.save('purchaseOrders', po);
      Auth.setDb(StorageService.readRaw());
      await Audit.logAction('PO_CREATE', `Created ${poNumber} for ${supplier.companyName} — ${items.length} items, ${formatCurrency(total)}`);
      UI.toast(`Purchase order ${poNumber} created!`, 'success');
    }

    this.closePOModal();
    this.renderPOs();
    if (typeof window.AdminModule !== 'undefined' && typeof window.AdminModule.refreshAll === 'function') {
      window.AdminModule.refreshAll();
    }
  },

  // ============================
  // APPROVE PO
  // ============================

  async approvePO(id) {
    const po = StorageService.load('purchaseOrders', id);
    if (!po) return;
    if (po.status === 'approved') { UI.toast('Already approved.', 'info'); return; }
    if (po.status === 'received') { UI.toast('Already received.', 'warning'); return; }
    if (po.status === 'cancelled') { UI.toast('Cannot approve a cancelled PO.', 'warning'); return; }

    const confirmed = await UI.confirm(`Approve purchase order ${po.poNumber || po.id}?`, 'Approve PO');
    if (!confirmed) return;

    const userName = Auth.state.user || 'admin';
    const now = getISOTimestamp();
    const timeline = [...(po.timeline || []), { action: 'approved', date: now, user: userName }];

    StorageService.update('purchaseOrders', id, {
      status: 'approved', approvedAt: now, lastUpdated: now, timeline
    });
    Auth.setDb(StorageService.readRaw());
    await Audit.logAction('PO_APPROVE', `Approved ${po.poNumber || po.id} for ${po.supplierName}`);
    this.renderPOs();
    if (typeof window.AdminModule !== 'undefined' && typeof window.AdminModule.refreshAll === 'function') {
      window.AdminModule.refreshAll();
    }
    UI.toast('Purchase order approved.', 'success');
  },

  // ============================
  // CANCEL PO
  // ============================

  async cancelPO(id) {
    const po = StorageService.load('purchaseOrders', id);
    if (!po) return;
    if (po.status === 'received') { UI.toast('Cannot cancel a received PO.', 'warning'); return; }
    if (po.status === 'cancelled') { UI.toast('Already cancelled.', 'info'); return; }

    const confirmed = await UI.confirm(`Cancel purchase order ${po.poNumber || po.id} for "${po.supplierName}"?`, 'Cancel PO');
    if (!confirmed) return;

    const userName = Auth.state.user || 'admin';
    const now = getISOTimestamp();
    const timeline = [...(po.timeline || []), { action: 'cancelled', date: now, user: userName }];

    StorageService.update('purchaseOrders', id, {
      status: 'cancelled', cancelledAt: now, lastUpdated: now, timeline
    });
    Auth.setDb(StorageService.readRaw());
    await Audit.logAction('PO_CANCEL', `Cancelled ${po.poNumber || po.id} for ${po.supplierName}`);
    this.renderPOs();
    if (typeof window.AdminModule !== 'undefined' && typeof window.AdminModule.refreshAll === 'function') {
      window.AdminModule.refreshAll();
    }
    UI.toast('Purchase order cancelled.', 'info');
  },

  // ============================
  // VIEW PO DETAIL
  // ============================

  viewPO(id) {
    const po = StorageService.load('purchaseOrders', id);
    if (!po) { UI.toast('Purchase order not found.', 'error'); return; }

    const container = document.getElementById('poDetailContent');
    if (!container) return;

    const itemCount = po.items ? po.items.reduce((s, i) => s + i.qty, 0) : 0;
    const statusBadge = this._getStatusBadge(po.status);

    let itemsHtml = '';
    if (po.items && po.items.length > 0) {
      itemsHtml = `
        <table class="receipt-table" style="margin:10px 0;">
          <thead><tr><th>Product</th><th>Qty</th><th>Cost</th><th>Total</th></tr></thead>
          <tbody>
            ${po.items.map(i => `
              <tr><td>${escapeHtml(i.productName)}</td><td>${i.qty}</td><td class="price-cell">${formatCurrency(i.cost)}</td><td class="price-cell">${formatCurrency(i.total)}</td></tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    let timelineHtml = '';
    if (po.timeline && po.timeline.length > 0) {
      timelineHtml = `
        <div style="margin-top:12px;border-top:1px solid var(--border-glass);padding-top:10px;">
          <strong style="font-size:0.85rem;color:var(--text-secondary);">Timeline</strong>
          ${po.timeline.map(t => `
            <div style="display:flex;gap:10px;font-size:0.8rem;padding:3px 0;color:var(--text-secondary);">
              <span style="color:var(--text-muted);min-width:140px;">${escapeHtml(formatDate(t.date))}</span>
              <span style="text-transform:capitalize;font-weight:600;">${escapeHtml(t.action)}</span>
              <span>by ${escapeHtml(t.user)}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div>
          <strong style="font-size:1.1rem;">${escapeHtml(po.poNumber || po.id)}</strong>
          <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px;">
            Supplier: <strong>${escapeHtml(po.supplierName)}</strong>
          </div>
        </div>
        <div>${statusBadge}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.85rem;margin-bottom:14px;padding:12px;background:var(--bg-glass);border-radius:var(--radius-md);">
        <div><span style="color:var(--text-muted);">Created:</span> ${escapeHtml(formatDate(po.createdAt))}</div>
        <div><span style="color:var(--text-muted);">By:</span> ${escapeHtml(po.createdBy || '—')}</div>
        <div><span style="color:var(--text-muted);">Expected:</span> ${po.expectedDate ? escapeHtml(po.expectedDate) : '—'}</div>
        <div><span style="color:var(--text-muted);">Items:</span> ${itemCount}</div>
        <div style="grid-column:1/-1;"><span style="color:var(--text-muted);">Total:</span> <strong class="price-cell">${formatCurrency(po.total || 0)}</strong></div>
        ${po.notes ? `<div style="grid-column:1/-1;"><span style="color:var(--text-muted);">Notes:</span> ${escapeHtml(po.notes)}</div>` : ''}
      </div>

      <strong style="font-size:0.85rem;color:var(--text-secondary);">Items</strong>
      ${itemsHtml}
      ${timelineHtml}
    `;

    document.getElementById('poDetailTitle').textContent = `PO: ${po.poNumber || po.id}`;
    showModal('poDetailOverlay');
  },

  closePODetail() { hideModal('poDetailOverlay'); },

  // ============================
  // PRINT PO
  // ============================

  printPO() {
    const container = document.getElementById('poDetailContent');
    if (!container) return;
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) { UI.toast('Please allow pop-ups to print.', 'warning'); return; }
    const styles = Array.from(document.styleSheets)
      .map(sheet => { try { return Array.from(sheet.cssRules || []).map(r => r.cssText).join(''); } catch(e) { return ''; } })
      .join('');
    printWin.document.write(`
      <html><head><title>Purchase Order</title>
      <style>${styles} body { background: white; color: #000; padding: 20px; }
        .price-cell { color: #000 !important; }
        .badge { color: #000 !important; }
      </style>
      </head><body>${container.innerHTML}</body></html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 500);
  },

  // ============================
  // RECEIVE STOCK (via Receiving Module)
  // ============================

  receivePO(id) {
    // Delegate to Receiving module if available
    try {
      if (window.Receiving && typeof window.Receiving.startReceiving === 'function') {
        window.Receiving.startReceiving(id);
      } else {
        // Fallback: switch to receiving view
        if (typeof window.AdminModule !== 'undefined' && typeof window.AdminModule.switchView === 'function') {
          window.AdminModule.switchView('admin-receiving');
        }
        UI.toast('Switch to Stock Receiving to process this PO.', 'info');
      }
    } catch(e) {
      UI.toast('Receiving module not available.', 'warning');
    }
  },

  // ============================
  // EXPORT PO CSV
  // ============================

  exportPOsCSV() {
    const pos = StorageService.load('purchaseOrders');
    if (pos.length === 0) { UI.toast('No POs to export.', 'warning'); return; }
    const rows = [['PO#', 'Supplier', 'Status', 'Items', 'Total', 'Created', 'Expected Date', 'Notes']];
    pos.forEach(po => {
      rows.push([
        po.poNumber || po.id,
        po.supplierName || '',
        po.status || '',
        po.items ? po.items.reduce((s, i) => s + i.qty, 0) : 0,
        po.total || 0,
        po.createdAt ? po.createdAt.slice(0, 10) : '',
        po.expectedDate || '',
        (po.notes || '').replace(/,/g, ';')
      ]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `purchase-orders-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    UI.toast(`Exported ${pos.length} PO(s) to CSV.`, 'success');
  },

  // ============================
  // UTILITY
  // ============================

  _getStatusBadge(status) {
    const map = {
      draft: 'badge-system', pending: 'badge-admin', approved: 'badge-cashier',
      partial: 'badge-warning', received: 'badge-cashier', cancelled: 'badge-action'
    };
    return `<span class="badge ${map[status] || 'badge-system'}" style="text-transform:capitalize;">${status || 'unknown'}</span>`;
  }
};

export default Purchasing;
