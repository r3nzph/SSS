// ===============================
// SUPPLIERS MODULE v2 — Full implementation
// Search, filter, pagination, archive/restore,
// modal CRUD, audit logging
// Uses ONLY StorageService — no Electron, no Node.js
// ===============================

import Auth from './auth.js';
import UI from './ui.js';
import Audit from './audit.js';
import { escapeHtml, showModal, hideModal, getInputValue, setInputValue, clearInput, generateId, getISOTimestamp } from './utils.js';
import StorageService from './storage.js';

const Suppliers = {
  _searchQuery: '',
  _statusFilter: 'active',
  _currentPage: 1,
  _pageSize: 10,
  _editingSupplierId: null,

  renderSuppliers() {
    const tbody = document.getElementById('suppliersTable');
    if (!tbody) return;
    const suppliers = StorageService.load('suppliers');
    let filtered = this._getFilteredSuppliers(suppliers);
    filtered.sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / this._pageSize) || 1;
    if (this._currentPage > totalPages) this._currentPage = totalPages;
    const startIdx = (this._currentPage - 1) * this._pageSize;
    const pageItems = filtered.slice(startIdx, startIdx + this._pageSize);

    this._renderPagination(totalItems, totalPages);
    this._renderSummary(totalItems);

    if (pageItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">No suppliers found.</td></tr>';
      return;
    }

    tbody.innerHTML = pageItems.map(s => {
      const statusBadge = s.archived
        ? '<span class="badge badge-system">Archived</span>'
        : s.status === 'inactive'
          ? '<span class="badge" style="background:var(--warning-bg);color:var(--warning);">Inactive</span>'
          : '<span class="badge badge-cashier">Active</span>';
      return `
        <tr class="${s.archived ? 'row-archived' : ''}">
          <td><strong>${escapeHtml(s.companyName || s.name)}</strong></td>
          <td>${escapeHtml(s.contactPerson || s.contact || '—')}</td>
          <td>${escapeHtml(s.phone || '—')}</td>
          <td>${escapeHtml(s.email || '—')}</td>
          <td>${statusBadge}</td>
          <td class="action-cell">
            <button class="btn-icon btn-sm" onclick="Suppliers.editSupplier('${s.id}')" title="Edit">✎</button>
            ${s.archived
              ? `<button class="btn-icon btn-sm" onclick="Suppliers.restoreSupplier('${s.id}')" title="Restore" style="color:var(--success);">↩️</button>`
              : `<button class="btn-icon btn-sm" onclick="Suppliers.archiveSupplier('${s.id}')" title="Archive" style="color:var(--warning);">📁</button>`}
            <button class="btn-icon btn-sm" onclick="Suppliers.deleteSupplier('${s.id}')" title="Delete" style="color:var(--danger);">🗑</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  setFilter(type, value) {
    if (type === 'search') {
      this._searchQuery = value;
    } else if (type === 'status') {
      this._statusFilter = value;
      document.querySelectorAll('.sup-filter-btn').forEach(b => b.classList.remove('active'));
      const btn = document.querySelector(`.sup-filter-btn[data-filter="${value}"]`);
      if (btn) btn.classList.add('active');
    }
    this._currentPage = 1;
    this.renderSuppliers();
  },

  _getFilteredSuppliers(suppliers) {
    let filtered = [...(suppliers || [])];
    if (this._searchQuery) {
      const q = this._searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        (s.companyName || s.name || '').toLowerCase().includes(q) ||
        (s.contactPerson || s.contact || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.id || '').toLowerCase().includes(q)
      );
    }
    if (this._statusFilter === 'active') filtered = filtered.filter(s => !s.archived && s.status !== 'inactive');
    else if (this._statusFilter === 'inactive') filtered = filtered.filter(s => !s.archived && s.status === 'inactive');
    else if (this._statusFilter === 'archived') filtered = filtered.filter(s => s.archived);
    return filtered;
  },

  setPage(page) { this._currentPage = page; this.renderSuppliers(); },

  _renderPagination(totalItems, totalPages) {
    const el = document.getElementById('supPagination');
    if (!el) return;
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    const p = this._currentPage;
    let h = `<button class="btn btn-icon btn-sm" onclick="Suppliers.setPage(${p - 1})" ${p <= 1 ? 'disabled' : ''}>‹</button>`;
    const maxVisible = 5;
    let startPage = Math.max(1, p - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);
    if (startPage > 1) {
      h += `<button class="btn btn-icon btn-sm" onclick="Suppliers.setPage(1)">1</button>`;
      if (startPage > 2) h += `<span class="inv-pg-ellipsis">…</span>`;
    }
    for (let i = startPage; i <= endPage; i++)
      h += `<button class="btn btn-icon btn-sm ${i === p ? 'btn-primary' : 'btn-ghost'}" onclick="Suppliers.setPage(${i})">${i}</button>`;
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) h += `<span class="inv-pg-ellipsis">…</span>`;
      h += `<button class="btn btn-icon btn-sm" onclick="Suppliers.setPage(${totalPages})">${totalPages}</button>`;
    }
    h += `<button class="btn btn-icon btn-sm" onclick="Suppliers.setPage(${p + 1})" ${p >= totalPages ? 'disabled' : ''}>›</button>`;
    el.innerHTML = h;
  },

  _renderSummary(total) {
    const pagination = document.getElementById('supPagination');
    const el = pagination?.parentElement?.querySelector('.inv-summary');
    if (!el) return;
    el.textContent = `${total} supplier(s)`;
  },

  showAddModal() {
    this._editingSupplierId = null;
    this._clearModal();
    document.getElementById('supModalTitle').textContent = 'Add Supplier';
    showModal('supModalOverlay');
  },

  editSupplier(id) {
    const s = StorageService.load('suppliers', id);
    if (!s) return;
    this._editingSupplierId = id;
    setInputValue('supCompany', s.companyName || s.name || '');
    setInputValue('supContact', s.contactPerson || s.contact || '');
    setInputValue('supPhone', s.phone || '');
    setInputValue('supEmail', s.email || '');
    setInputValue('supAddress', s.address || '');
    setInputValue('supNotes', s.notes || '');
    const statusSelect = document.getElementById('supStatus');
    if (statusSelect) statusSelect.value = s.status || 'active';
    document.getElementById('supModalTitle').textContent = 'Edit Supplier';
    showModal('supModalOverlay');
  },

  closeModal() {
    hideModal('supModalOverlay');
    this._editingSupplierId = null;
  },

  _clearModal() {
    ['supCompany', 'supContact', 'supPhone', 'supEmail', 'supAddress', 'supNotes']
      .forEach(id => clearInput(id));
    const statusSelect = document.getElementById('supStatus');
    if (statusSelect) statusSelect.value = 'active';
  },

  async saveSupplier() {
    const companyName = getInputValue('supCompany');
    const contactPerson = getInputValue('supContact');
    const phone = getInputValue('supPhone');
    const email = getInputValue('supEmail');
    const address = getInputValue('supAddress');
    const notes = getInputValue('supNotes');
    const status = document.getElementById('supStatus')?.value || 'active';

    if (!companyName) { UI.toast('Company/Supplier name is required.', 'error'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      UI.toast('Invalid email format.', 'error');
      return;
    }

    const saveBtn = document.querySelector('#supModalOverlay .btn-success');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    try {
      const now = getISOTimestamp();

      if (this._editingSupplierId) {
        // UPDATE
        StorageService.update('suppliers', this._editingSupplierId, {
          companyName, contactPerson, phone, email, address, notes, status, lastUpdated: now
        });
        Auth.setDb(StorageService.readRaw());
        await Audit.logAction('SUPPLIER_UPDATE', `Updated supplier "${companyName}"`);
        UI.toast(`Supplier "${companyName}" updated.`, 'success');
      } else {
        // ADD
        const newId = generateId('s');
        const item = {
          id: newId, companyName, contactPerson, phone, email, address, notes,
          status, archived: false, dateAdded: now, lastUpdated: now
        };
        StorageService.save('suppliers', item);
        Auth.setDb(StorageService.readRaw());
        await Audit.logAction('SUPPLIER_ADD', `Added supplier "${companyName}"`);
        UI.toast(`Supplier "${companyName}" added.`, 'success');
      }

      this.closeModal();
      this.renderSuppliers();
      if (typeof window.AdminModule !== 'undefined' && typeof window.AdminModule.refreshAll === 'function') {
        window.AdminModule.refreshAll();
      }
    } catch (e) {
      console.error('[Suppliers] Save error:', e);
      UI.toast('Failed to save supplier.', 'error');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save Supplier'; }
    }
  },

  async archiveSupplier(id) {
    const s = StorageService.load('suppliers', id);
    if (!s) return;
    const confirmed = await UI.confirm(`Archive supplier "${s.companyName || s.name}"?`, 'Archive Supplier');
    if (!confirmed) return;
    StorageService.update('suppliers', id, { archived: true });
    Auth.setDb(StorageService.readRaw());
    await Audit.logAction('SUPPLIER_ARCHIVE', `Archived supplier "${s.companyName || s.name}"`);
    this.renderSuppliers();
    UI.toast('Supplier archived.', 'info');
  },

  async restoreSupplier(id) {
    StorageService.update('suppliers', id, { archived: false });
    const s = StorageService.load('suppliers', id);
    Auth.setDb(StorageService.readRaw());
    if (s) {
      await Audit.logAction('SUPPLIER_RESTORE', `Restored supplier "${s.companyName || s.name}"`);
      UI.toast('Supplier restored.', 'success');
    }
    this.renderSuppliers();
  },

  async deleteSupplier(id) {
    const s = StorageService.load('suppliers', id);
    if (!s) return;
    const confirmed = await UI.confirm(
      `Permanently delete supplier "${s.companyName || s.name}"? This cannot be undone.`,
      'Delete Supplier'
    );
    if (!confirmed) return;
    StorageService.delete('suppliers', id);
    Auth.setDb(StorageService.readRaw());
    await Audit.logAction('SUPPLIER_DELETE', `Deleted supplier "${s.companyName || s.name}"`);
    this.renderSuppliers();
    UI.toast('Supplier deleted.', 'info');
  },

  /** Get products associated with a supplier by their ID */
  getProductsBySupplier(supplierId) {
    const s = StorageService.load('suppliers', supplierId);
    const supplierName = s ? (s.companyName || s.name) : supplierId;
    const products = StorageService.load('products');
    return products.filter(p => p.supplier === supplierName || p.supplier === supplierId);
  },

  /** Switch to inventory view filtered by a supplier name */
  showSupplierProductsByName(supplierName) {
    const products = StorageService.load('products').filter(p => p.supplier === supplierName);
    if (products.length === 0) {
      UI.toast(`No products from "${supplierName}".`, 'info');
      return;
    }
    if (typeof window.AdminModule !== 'undefined' && typeof window.AdminModule.switchView === 'function') {
      window.AdminModule.switchView('inventory');
    }
    const searchInput = document.getElementById('invSearch');
    if (searchInput) {
      searchInput.value = supplierName;
      if (window.Inventory && typeof Inventory.setFilter === 'function') {
        Inventory.setFilter('search', supplierName);
      }
    }
    UI.toast(`Showing ${products.length} product(s) from "${supplierName}".`, 'success');
  },

  cancelEdit() {
    this._editingSupplierId = null;
    this._clearModal();
  }
};

export default Suppliers;
