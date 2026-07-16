// ===============================
// INVENTORY MODULE — Full Retail Inventory System
// Add, Edit, Delete, Archive, Restore, Search, Filter, Paginate
// Uses ONLY StorageService — no Electron, no Node.js
// ===============================

import Auth from './auth.js';
import StorageService from './storage.js';
import UI from './ui.js';
import Audit from './audit.js';
import { escapeHtml, formatCurrency, getInputValue, setInputValue, clearInput, generateId, showModal, hideModal, handleError } from './utils.js';

const Inventory = {
  _currentSort: { field: 'name', dir: 'asc' },
  _currentPage: 1, _pageSize: 15,
  _searchQuery: '', _categoryFilter: '', _stockFilter: 'all',
  _selectedIds: new Set(), _editingProductId: null, _modalImage: '',

  // ============================
  // MAIN RENDER
  // ============================

  renderInventory() {
    this.renderInventoryTable();
    this.renderLowStockAlerts();
    this.renderCategoryFilter();
  },

  // ============================
  // LOW STOCK ALERTS
  // ============================

  renderLowStockAlerts() {
    const container = document.getElementById('lowStockAlerts');
    if (!container) return;
    const products = StorageService.load('products');
    const low = products.filter(p => !p.archived && p.stock <= p.minStock);
    if (low.length === 0) {
      container.innerHTML = '<p class="no-alerts">✅ All items are well-stocked.</p>';
      return;
    }
    container.innerHTML = low.map(p => `
      <div class="alert-item ${p.stock <= 0 ? 'alert-danger' : 'alert-warning'}">
        <span class="alert-icon">${p.stock <= 0 ? '🚫' : '⚠️'}</span>
        <span class="alert-text"><strong>${escapeHtml(p.name)}</strong> ${p.stock <= 0 ? 'is out of stock!' : `only ${p.stock} left (min: ${p.minStock})`}</span>
      </div>
    `).join('');
  },

  // ============================
  // INVENTORY TABLE
  // ============================

  renderInventoryTable() {
    const tbody = document.getElementById('inventoryTable');
    if (!tbody) return;
    const products = StorageService.load('products');
    if (!products || products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">No products in inventory.</td></tr>';
      return;
    }

    let filtered = this._getFilteredProducts(products);
    filtered = this._sortProducts(filtered);
    const total = filtered.length, pages = Math.ceil(total / this._pageSize) || 1;
    if (this._currentPage > pages) this._currentPage = pages;
    const start = (this._currentPage - 1) * this._pageSize;
    const page = filtered.slice(start, start + this._pageSize);

    this._renderPagination(total, pages);
    this._renderSummary(total);

    if (page.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">No products match your criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = page.map(p => {
      const stockClass = this._getStockClass(p);
      const stockLabel = this._getStockLabel(p);
      const profit = p.price - (p.cost || 0);
      const profitClass = profit >= 0 ? 'price-cell' : 'stock-cell stock-none';
      const isSelected = this._selectedIds.has(p.id);
      return `<tr class="${stockClass}${isSelected ? ' row-selected' : ''}${p.archived ? ' row-archived' : ''}">
        <td><input type="checkbox" ${isSelected ? 'checked' : ''} onchange="Inventory.toggleSelect('${p.id}')"></td>
        <td>${p.image ? `<img src="${escapeHtml(p.image)}" class="inv-thumb" alt="">` : '<span class="inv-thumb-placeholder">📦</span>'}</td>
        <td>
          <strong>${escapeHtml(p.name)}</strong>
          <div class="inv-meta">
            ${p.barcode ? `<span>🔳 ${escapeHtml(p.barcode)}</span>` : ''}
            ${p.category ? `<span>${escapeHtml(p.category)}</span>` : ''}
            ${p.brand ? `<span>${escapeHtml(p.brand)}</span>` : ''}
            ${p.unit ? `<span>per ${escapeHtml(p.unit)}</span>` : ''}
            ${p.supplier ? `<span>🏭 ${escapeHtml(p.supplier)}</span>` : ''}
          </div>
        </td>
        <td class="price-cell">${formatCurrency(p.price)}</td>
        <td>${formatCurrency(p.cost || 0)}</td>
        <td class="${profitClass}">${formatCurrency(profit)}</td>
        <td>
          <strong class="stock-cell ${stockClass}">${p.stock}</strong>
          <span class="stock-badge ${stockClass}">${stockLabel}</span>
        </td>
        <td class="action-cell">
          <button class="btn-icon btn-sm" onclick="Inventory.editProduct('${p.id}')" title="Edit">✎</button>
          ${p.archived
            ? `<button class="btn-icon btn-sm" onclick="Inventory.restoreProduct('${p.id}')" title="Restore" style="color:var(--success);">↩️</button>`
            : `<button class="btn-icon btn-sm" onclick="Inventory.archiveProduct('${p.id}')" title="Archive" style="color:var(--warning);">📁</button>`}
          <button class="btn-icon btn-sm" onclick="Inventory.deleteProduct('${p.id}')" title="Delete" style="color:var(--danger);">🗑</button>
        </td>
      </tr>`;
    }).join('');
  },

  // ============================
  // FILTERING & SORTING
  // ============================

  _getFilteredProducts(products) {
    let filtered = [...products];
    if (this._searchQuery) {
      const q = this._searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    }
    if (this._categoryFilter) {
      filtered = filtered.filter(p => p.category === this._categoryFilter);
    }
    if (this._stockFilter === 'in') {
      filtered = filtered.filter(p => !p.archived && p.stock > p.minStock);
    } else if (this._stockFilter === 'low') {
      filtered = filtered.filter(p => !p.archived && p.stock > 0 && p.stock <= p.minStock);
    } else if (this._stockFilter === 'out') {
      filtered = filtered.filter(p => !p.archived && p.stock <= 0);
    } else if (this._stockFilter === 'archived') {
      filtered = filtered.filter(p => p.archived);
    } else {
      filtered = filtered.filter(p => !p.archived);
    }
    return filtered;
  },

  _sortProducts(products) {
    const { field, dir } = this._currentSort;
    return [...products].sort((a, b) => {
      let va, vb;
      switch (field) {
        case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
        case 'price': va = a.price; vb = b.price; break;
        case 'cost': va = a.cost || 0; vb = b.cost || 0; break;
        case 'stock': va = a.stock; vb = b.stock; break;
        case 'profit': va = (a.price - (a.cost || 0)); vb = (b.price - (b.cost || 0)); break;
        case 'category': va = (a.category || '').toLowerCase(); vb = (b.category || '').toLowerCase(); break;
        default: va = a.name.toLowerCase(); vb = b.name.toLowerCase();
      }
      return va < vb ? (dir === 'asc' ? -1 : 1) : va > vb ? (dir === 'asc' ? 1 : -1) : 0;
    });
  },

  setSort(field) {
    if (this._currentSort.field === field) {
      this._currentSort.dir = this._currentSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      this._currentSort.field = field;
      this._currentSort.dir = 'asc';
    }
    this._currentPage = 1;
    this.renderInventoryTable();
  },

  setFilter(type, value) {
    if (type === 'search') this._searchQuery = value;
    else if (type === 'category') this._categoryFilter = value;
    else if (type === 'stock') this._stockFilter = value;
    this._currentPage = 1;
    this._selectedIds.clear();
    this.renderInventoryTable();
  },

  setPage(p) { this._currentPage = p; this.renderInventoryTable(); },

  _renderPagination(total, pages) {
    const el = document.getElementById('invPagination');
    if (!el) return;
    if (pages <= 1) { el.innerHTML = ''; return; }
    const p = this._currentPage;
    let h = `<button class="btn btn-icon btn-sm" onclick="Inventory.setPage(${p - 1})" ${p <= 1 ? 'disabled' : ''}>‹</button>`;
    const maxVisible = 5;
    let startPage = Math.max(1, p - Math.floor(maxVisible / 2));
    let endPage = Math.min(pages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    if (startPage > 1) {
      h += `<button class="btn btn-icon btn-sm" onclick="Inventory.setPage(1)">1</button>`;
      if (startPage > 2) h += `<span class="inv-pg-ellipsis">…</span>`;
    }
    for (let i = startPage; i <= endPage; i++) {
      h += `<button class="btn btn-icon btn-sm ${i === p ? 'btn-primary' : 'btn-ghost'}" onclick="Inventory.setPage(${i})">${i}</button>`;
    }
    if (endPage < pages) {
      if (endPage < pages - 1) h += `<span class="inv-pg-ellipsis">…</span>`;
      h += `<button class="btn btn-icon btn-sm" onclick="Inventory.setPage(${pages})">${pages}</button>`;
    }
    h += `<button class="btn btn-icon btn-sm" onclick="Inventory.setPage(${p + 1})" ${p >= pages ? 'disabled' : ''}>›</button>`;
    el.innerHTML = h;
  },

  _renderSummary(total) {
    const el = document.getElementById('invSummary');
    if (!el) return;
    const start = (this._currentPage - 1) * this._pageSize + 1;
    const end = Math.min(start + this._pageSize - 1, total);
    el.textContent = total > 0 ? `Showing ${start}–${end} of ${total} products` : 'No products found';
  },

  // ============================
  // SELECTION & BULK ACTIONS
  // ============================

  toggleSelect(id) {
    if (this._selectedIds.has(id)) this._selectedIds.delete(id); else this._selectedIds.add(id);
    this._updateBulkBar();
    this.renderInventoryTable();
  },

  selectAll() {
    const products = StorageService.load('products');
    if (!products) return;
    const page = this._getFilteredProducts(products).slice((this._currentPage - 1) * this._pageSize, this._currentPage * this._pageSize);
    const allSelected = page.every(p => this._selectedIds.has(p.id));
    page.forEach(p => { if (allSelected) this._selectedIds.delete(p.id); else this._selectedIds.add(p.id); });
    this._updateBulkBar();
    this.renderInventoryTable();
  },

  _updateBulkBar() {
    const bar = document.getElementById('invBulkBar');
    const count = document.getElementById('invBulkCount');
    if (!bar || !count) return;
    const n = this._selectedIds.size;
    if (n > 0) { bar.classList.remove('hidden'); count.textContent = `${n} selected`; }
    else bar.classList.add('hidden');
  },

  async bulkArchive() {
    if (this._selectedIds.size === 0) return;
    const ids = [...this._selectedIds];
    const ok = await UI.confirm(`Archive ${ids.length} product(s)?`, 'Bulk Archive');
    if (!ok) return;
    ids.forEach(id => StorageService.update('products', id, { archived: true }));
    this._selectedIds.clear();
    await Audit.logAction('BULK_ARCHIVE', `Archived ${ids.length} product(s)`);
    this._refresh();
    UI.toast('Products archived.', 'success');
  },

  async bulkRestore() {
    if (this._selectedIds.size === 0) return;
    const ids = [...this._selectedIds];
    ids.forEach(id => StorageService.update('products', id, { archived: false }));
    this._selectedIds.clear();
    await Audit.logAction('BULK_RESTORE', `Restored ${ids.length} product(s)`);
    this._refresh();
    UI.toast('Products restored.', 'success');
  },

  async bulkDelete() {
    if (this._selectedIds.size === 0) return;
    const ids = [...this._selectedIds];
    const ok = await UI.confirm(`Permanently delete ${ids.length} product(s)? This cannot be undone.`, 'Bulk Delete');
    if (!ok) return;
    ids.forEach(id => StorageService.delete('products', id));
    this._selectedIds.clear();
    await Audit.logAction('BULK_DELETE', `Deleted ${ids.length} product(s)`);
    this._refresh();
    UI.toast(`${ids.length} product(s) deleted.`, 'info');
  },

  bulkExport() {
    const products = StorageService.load('products');
    if (!products) return;
    const sel = products.filter(p => this._selectedIds.has(p.id));
    if (sel.length === 0) return;
    const csv = [['ID','Name','Barcode','Category','Brand','Price','Cost','Stock','Min Stock','Unit','Supplier']]
      .concat(sel.map(p => [p.id, p.name, p.barcode, p.category, p.brand, p.price, p.cost, p.stock, p.minStock, p.unit, p.supplier]))
      .map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inventory-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    UI.toast(`Exported ${sel.length} product(s) to CSV.`, 'success');
  },

  // ============================
  // PRODUCT MODAL (Add / Edit)
  // ============================

  showAddModal() {
    this._editingProductId = null;
    this._populateModal(null);
    document.getElementById('invModalTitle').textContent = 'Add Product';
    showModal('invModalOverlay');
  },

  editProduct(id) {
    const p = StorageService.load('products', id);
    if (!p) return;
    this._editingProductId = id;
    this._populateModal(p);
    document.getElementById('invModalTitle').textContent = 'Edit Product';
    showModal('invModalOverlay');
  },

  closeModal() {
    hideModal('invModalOverlay');
    document.getElementById('invModalOverlay').classList.remove('active');
    this._editingProductId = null;
  },

  _populateModal(product) {
    // Clear all fields first
    const fields = ['invName','invBarcode','invCategory','invBrand','invSupplier',
      'invSellPrice','invBuyPrice','invStock','invMinStock','invDescription'];
    fields.forEach(f => clearInput(f));
    // Reset unit to default
    setInputValue('invUnit', 'pcs');
    // Clear image
    this._updateImagePreview('');
    this._modalImage = '';

    if (product) {
      setInputValue('invName', product.name || '');
      setInputValue('invBarcode', product.barcode || '');
      setInputValue('invCategory', product.category || '');
      setInputValue('invBrand', product.brand || '');
      setInputValue('invSupplier', product.supplier || '');
      setInputValue('invSellPrice', product.price || '');
      setInputValue('invBuyPrice', product.cost || '');
      setInputValue('invStock', product.stock || '');
      setInputValue('invMinStock', product.minStock || '');
      setInputValue('invUnit', product.unit || 'pcs');
      setInputValue('invDescription', product.description || '');
      this._updateImagePreview(product.image || '');
    }
  },

  async saveProduct() {
    const name = getInputValue('invName');
    const price = parseFloat(getInputValue('invSellPrice'));
    const cost = parseFloat(getInputValue('invBuyPrice'));
    const stock = parseInt(getInputValue('invStock'), 10);
    const minStock = parseInt(getInputValue('invMinStock'), 10);

    if (!name || isNaN(price) || price <= 0 || isNaN(stock) || stock < 0) {
      UI.toast('Please fill required fields: Name, Selling Price > 0, Stock >= 0.', 'error');
      return;
    }

    const productData = {
      name,
      barcode: getInputValue('invBarcode'),
      category: getInputValue('invCategory') || 'General',
      brand: getInputValue('invBrand'),
      supplier: getInputValue('invSupplier'),
      price,
      cost: isNaN(cost) || cost <= 0 ? Math.round(price * 0.6) : cost,
      stock,
      minStock: isNaN(minStock) || minStock < 0 ? 5 : minStock,
      unit: getInputValue('invUnit') || 'pcs',
      description: getInputValue('invDescription'),
      image: this._modalImage || '',
      lastUpdated: new Date().toISOString(),
      archived: false
    };

    const saveBtn = document.querySelector('#invModalOverlay .btn-success');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    try {
      if (this._editingProductId) {
        // UPDATE existing product
        const r = StorageService.update('products', this._editingProductId, productData);
        if (!r.success) { UI.toast(r.error || 'Update failed.', 'error'); return; }
        await Audit.logAction('PRODUCT_UPDATE', `Updated "${name}" (ID: ${this._editingProductId})`);
        UI.toast(`"${name}" updated.`, 'success');
      } else {
        // ADD new product
        const existingIds = getExistingIds('products');
        productData.id = generateId('p');
        productData.dateAdded = new Date().toISOString();
        const r = StorageService.save('products', productData);
        if (!r.success) { UI.toast(r.error || 'Add failed.', 'error'); return; }
        await Audit.logAction('PRODUCT_ADD', `Added "${name}" at ₱${price} with stock ${stock}`);
        UI.toast(`"${name}" added.`, 'success');
      }

      this.closeModal();
      this._refresh();
      if (typeof window.AdminModule !== 'undefined' && typeof window.AdminModule.refreshAll === 'function') {
        window.AdminModule.refreshAll();
      }
    } catch (e) {
      handleError(e, 'saveProduct');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save Product'; }
    }
  },

  // ============================
  // SINGLE PRODUCT ACTIONS
  // ============================

  async deleteProduct(id) {
    const p = StorageService.load('products', id);
    if (!p) return;
    const ok = await UI.confirm(`Permanently delete "${p.name}"?`, 'Delete Product');
    if (!ok) return;
    StorageService.delete('products', id);
    Auth.setDb(StorageService.readRaw());
    await Audit.logAction('PRODUCT_DELETE', `Deleted "${p.name}" (ID: ${id})`);
    this._refresh();
    if (typeof window.AdminModule !== 'undefined' && typeof window.AdminModule.refreshAll === 'function') {
      window.AdminModule.refreshAll();
    }
    UI.toast(`"${p.name}" deleted.`, 'info');
  },

  async archiveProduct(id) {
    StorageService.update('products', id, { archived: true });
    const p = StorageService.load('products', id);
    if (p) {
      await Audit.logAction('PRODUCT_ARCHIVE', `Archived "${p.name}" (ID: ${id})`);
      UI.toast(`"${p.name}" archived.`, 'info');
    }
    this._refresh();
    if (typeof window.AdminModule !== 'undefined' && typeof window.AdminModule.refreshAll === 'function') {
      window.AdminModule.refreshAll();
    }
  },

  async restoreProduct(id) {
    StorageService.update('products', id, { archived: false });
    const p = StorageService.load('products', id);
    if (p) {
      await Audit.logAction('PRODUCT_RESTORE', `Restored "${p.name}" (ID: ${id})`);
      UI.toast(`"${p.name}" restored.`, 'success');
    }
    this._refresh();
    if (typeof window.AdminModule !== 'undefined' && typeof window.AdminModule.refreshAll === 'function') {
      window.AdminModule.refreshAll();
    }
  },

  // ============================
  // IMAGE UPLOAD
  // ============================

  handleImageUpload(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      UI.toast('Please select an image file.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      UI.toast('Image must be under 2MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      this._modalImage = e.target.result;
      this._updateImagePreview(this._modalImage);
    };
    reader.readAsDataURL(file);
  },

  handleImageDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    this.handleImageUpload(file);
  },

  removeImage() {
    this._modalImage = '';
    this._updateImagePreview('');
  },

  _updateImagePreview(src) {
    const preview = document.getElementById('invImagePreview');
    const placeholder = document.getElementById('invImagePlaceholder');
    if (!preview || !placeholder) return;
    if (src) {
      preview.src = src;
      preview.classList.remove('hidden');
      placeholder.classList.add('hidden');
    } else {
      preview.classList.add('hidden');
      placeholder.classList.remove('hidden');
    }
  },

  // ============================
  // CATEGORY LIST (for filter dropdown)
  // ============================

  _getCategories() {
    const products = StorageService.load('products');
    if (!products) return [];
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return [...cats].sort();
  },

  renderCategoryFilter() {
    const select = document.getElementById('invCategoryFilter');
    if (!select) return;
    const cats = this._getCategories();
    const currentVal = select.value;
    select.innerHTML = '<option value="">All Categories</option>' +
      cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    select.value = currentVal;
  },

  // ============================
  // UTILITY HELPERS
  // ============================

  _getStockClass(product) {
    if (product.archived) return 'stock-archived';
    if (product.stock <= 0) return 'stock-none';
    if (product.stock <= product.minStock) return 'stock-low';
    return 'stock-high';
  },

  _getStockLabel(product) {
    if (product.archived) return 'Archived';
    if (product.stock <= 0) return 'Out of Stock';
    if (product.stock <= product.minStock) return 'Low Stock';
    return 'In Stock';
  },

  getInventorySummary() {
    const products = StorageService.load('products');
    if (!products) return { totalProducts: 0, totalValue: 0, lowStockCount: 0 };
    const active = products.filter(p => !p.archived);
    return {
      totalProducts: active.length,
      totalValue: active.reduce((s, p) => s + p.price * p.stock, 0),
      lowStockCount: active.filter(p => p.stock <= p.minStock).length
    };
  },

  _refresh() {
    Auth.setDb(StorageService.readRaw());
    this.renderInventory();
  }
};

export default Inventory;
