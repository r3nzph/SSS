// ===============================
// ADMIN MODULE — Product management
// Add, edit, delete, stock update
// Uses only StorageService.save/load/update/delete/readRaw
// ===============================

import Auth from './auth.js';
import Audit from './audit.js';
import { getInputValue, generateId, clearInput, setInputValue, escapeHtml, formatCurrency, handleError, getStockLevel } from './utils.js';
import UI from './ui.js';
import StorageService from './storage.js';
import Pricing from './pricing.js';

let editingProductId = null;

const Admin = {
  renderAdmin(filterText) {
    const table = document.getElementById('adminTable');
    if (!table) return;
    const products = StorageService.load('products');
    if (!products) {
      table.innerHTML = '<tr><td colspan="6">No products.</td></tr>';
      return;
    }
    let filtered = products;
    if (filterText) {
      const query = filterText.toLowerCase();
      filtered = products.filter(p => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query));
    }
    if (filtered.length === 0) {
      table.innerHTML = '<tr><td colspan="6">No products match your search.</td></tr>';
      return;
    }
    table.innerHTML = filtered.map(product => {
      const stockClass = (() => {
        if (product.stock <= 0) return 'stock-none';
        if (product.stock <= (product.minStock || 5)) return 'stock-low';
        return 'stock-high';
      })();
      return `<tr>
        <td>${escapeHtml(product.id)}</td>
        <td>${escapeHtml(product.name)}</td>
        <td class="price-cell price-popover-trigger" data-product-id="${product.id}">${formatCurrency(product.price)}
          <button class="btn-icon btn-sm" onclick="Pricing.updateSinglePrice('${product.id}')" title="Change price" style="margin-left:4px;vertical-align:middle;">💰</button>
        </td>
        <td>${formatCurrency(product.cost)}</td>
        <td class="stock-cell ${stockClass}">${product.stock}</td>
        <td class="action-cell">
          <button class="btn-icon btn-edit" onclick="editProduct('${product.id}')" title="Edit product">✎</button>
          <button class="btn-icon btn-delete" onclick="deleteProduct('${product.id}')" title="Delete product">🗑</button>
          <button class="btn-icon btn-stock" onclick="updateStock('${product.id}')" title="Update stock">📦</button>
        </td>
      </tr>`;
    }).join('');
  },

  async addNewProduct() {
    const name = getInputValue('pName');
    const price = parseFloat(getInputValue('pPrice'));
    const cost = parseFloat(getInputValue('pCost'));
    const stock = parseInt(getInputValue('pStock'), 10);
    if (!name || isNaN(price) || price <= 0 || isNaN(stock) || stock < 0) {
      UI.toast('Please fill in all fields correctly.', 'error');
      return;
    }
    if (editingProductId) {
      // Update existing product
      const product = StorageService.load('products', editingProductId);
      if (!product) { UI.toast('Product not found!', 'error'); this.cancelEdit(); return; }
      const updates = {
        name, price,
        cost: isNaN(cost) || cost <= 0 ? Math.round(price * 0.6) : cost,
        stock, lastUpdated: new Date().toISOString()
      };
      StorageService.update('products', editingProductId, updates);
      Auth.setDb(StorageService.readRaw());
      await Audit.logAction('PRODUCT_UPDATE', `Updated product "${name}" (ID: ${editingProductId})`);
      this.cancelEdit();
      UI.toast(`Product "${name}" updated successfully!`, 'success');
    } else {
      // Add new product
      try {
        const now = new Date().toISOString();
        const newProduct = {
          id: generateId(), name, price, stock,
          cost: isNaN(cost) || cost <= 0 ? Math.round(price * 0.6) : cost,
          barcode: '', category: 'General', brand: '', supplier: '',
          minStock: 5, unit: 'pcs', description: '', image: '',
          dateAdded: now, lastUpdated: now, archived: false
        };
        StorageService.save('products', newProduct);
        Auth.setDb(StorageService.readRaw());
        await Audit.logAction('PRODUCT_ADD', `Added product "${name}" at ₱${price} with stock ${stock}`);
        UI.toast(`Product "${name}" added successfully!`, 'success');
        ['pName','pPrice','pCost','pStock'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
        if (typeof window.refreshAll === 'function') window.refreshAll();
      } catch (e) {
        handleError(e, 'addNewProduct');
        UI.toast('Failed to add product.', 'error');
      }
    }
  },

  editProduct(id) {
    if (!Auth.requireAdmin()) return;
    const product = StorageService.load('products', id);
    if (!product) return;
    editingProductId = id;
    setInputValue('pName', product.name);
    setInputValue('pPrice', product.price);
    setInputValue('pCost', product.cost || '');
    setInputValue('pStock', product.stock);
    const btn = document.querySelector('.add-product button');
    if (btn) { btn.textContent = 'Update Product'; btn.classList.add('btn-update-mode'); }
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');
  },

  cancelEdit() {
    editingProductId = null;
    ['pName','pPrice','pCost','pStock'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    const btn = document.querySelector('.add-product button');
    if (btn) { btn.textContent = 'Add Product'; btn.classList.remove('btn-update-mode'); }
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.classList.add('hidden');
  },

  async deleteProduct(id) {
    if (!Auth.requireAdmin()) return;
    const product = StorageService.load('products', id);
    if (!product) return;
    const confirmed = await UI.confirm(`Are you sure you want to delete "${product.name}"?`);
    if (!confirmed) return;
    StorageService.delete('products', id);
    Auth.setDb(StorageService.readRaw());
    await Audit.logAction('PRODUCT_DELETE', `Deleted product "${product.name}" (ID: ${id})`);
    if (typeof window.refreshAll === 'function') window.refreshAll();
    UI.toast(`Product "${product.name}" deleted.`, 'info');
  },

  filterAdminProducts(query) { this.renderAdmin(query); },

  async updateStock(id) {
    if (!Auth.requireAdmin()) return;
    const product = StorageService.load('products', id);
    if (!product) return;
    const newStock = await UI.prompt(`Update stock for "${product.name}":\nCurrent stock: ${product.stock}`, product.stock, 'Update Stock');
    if (newStock === null) return;
    const parsedStock = parseInt(newStock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) { UI.toast('Invalid stock value.', 'error'); return; }
    const oldStock = product.stock;
    StorageService.update('products', id, { stock: parsedStock, lastUpdated: new Date().toISOString() });
    Auth.setDb(StorageService.readRaw());
    await Audit.logAction('STOCK_UPDATE', `Updated stock for "${product.name}": ${oldStock} → ${parsedStock}`);
    if (typeof window.refreshAll === 'function') window.refreshAll();
    UI.toast(`Stock for "${product.name}" updated to ${parsedStock}.`, 'success');
  }
};

export default Admin;
