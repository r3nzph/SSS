// ===============================
// CASHIER POS MODULE v2 — ES Module
// Professional Point-of-Sale interface with
// product grid, cart, discount, tax, payment, change,
// hold/resume, void, and barcode scanning.
// Electron-free — uses StorageService via Auth state.
// ===============================

import Auth from './auth.js';
import Audit from './audit.js';
import UI from './ui.js';
import { escapeHtml, formatCurrency } from './utils.js';

// Held sales storage (in-memory map)
let _heldSales = [];
let _discountPercent = 0;
let _previousCategory = 'all';
let _paymentMethod = 'cash';  // cash | gcash | card

const CashierPOS = {
  /**
   * Master render — everything the cashier sees.
   */
  renderCashier(filterText) {
    this._renderTopBar();
    this._renderCategories();
    this._renderProductGrid(filterText || '');
    this.renderCart();
    this._startClock();
  },

  // ============================
  // TOP BAR
  // ============================

  _renderTopBar() {
    const nameEl = document.getElementById('posCashierName');
    if (nameEl && Auth.state.user) {
      nameEl.textContent = '👤 ' + (Auth.state.userData?.fullName || Auth.state.user);
    }
    const storeEl = document.getElementById('posStoreName');
    if (storeEl) {
      const name = Auth.state.db?.settings?.storeName || 'Aking Tindahan';
      storeEl.textContent = '🏪 ' + name;
    }
  },

  _startClock() {
    const el = document.getElementById('posDateTime');
    if (!el) return;
    const update = () => {
      const now = new Date();
      el.textContent = now.toLocaleDateString('en-PH', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    };
    update();
    if (this._clockInterval) clearInterval(this._clockInterval);
    this._clockInterval = setInterval(update, 1000);
  },

  // ============================
  // CATEGORIES
  // ============================

  _selectedCategory: 'all',

  _renderCategories() {
    const container = document.getElementById('posCategories');
    if (!container) return;

    const products = Auth.state.db?.products || [];
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

    container.innerHTML = `
      <button class="pos-cat-btn ${this._selectedCategory === 'all' ? 'active' : ''}"
        onclick="Cashier.selectCategory('all')" data-cat="all">📋 All</button>
      ${cats.map(cat => `
        <button class="pos-cat-btn ${this._selectedCategory === cat ? 'active' : ''}"
          onclick="Cashier.selectCategory('${escapeHtml(cat)}')" data-cat="${escapeHtml(cat)}">
          ${escapeHtml(cat)}
        </button>
      `).join('')}
    `;
  },

  selectCategory(cat) {
    this._selectedCategory = cat;
    this._renderCategories();
    const searchInput = document.getElementById('posSearch');
    this._renderProductGrid(searchInput ? searchInput.value : '');
  },

  // ============================
  // PRODUCT GRID
  // ============================

  _renderProductGrid(filterText) {
    const grid = document.getElementById('posProductGrid');
    const skeleton = document.getElementById('posLoadingSkeleton');
    const empty = document.getElementById('posEmptyState');
    if (!grid) return;

    const data = Auth.state.db;
    if (!data || !data.products) {
      if (empty) empty.classList.remove('hidden');
      return;
    }

    let products = data.products.filter(p => !p.archived);

    // Filter by category
    if (this._selectedCategory !== 'all') {
      products = products.filter(p => p.category === this._selectedCategory);
    }

    // Filter by search
    const query = (filterText || '').toLowerCase().trim();
    if (query) {
      products = products.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.barcode || '').toLowerCase().includes(query) ||
        (p.category || '').toLowerCase().includes(query)
      );
    }

    // Empty state
    if (products.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      if (skeleton) skeleton.classList.add('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');
    if (skeleton) skeleton.classList.add('hidden');

    grid.innerHTML = products.map(product => {
      const outOfStock = product.stock <= 0;
      const lowStock = product.stock > 0 && product.stock <= (product.minStock || 5);
      return `
        <div class="pos-product-card ${outOfStock ? 'pos-out-of-stock' : ''}"
          onclick="${outOfStock ? '' : `Cashier.addCart('${product.id}')`}"
          role="button" tabindex="0"
          onkeydown="if(event.key==='Enter'){${outOfStock ? '' : `Cashier.addCart('${product.id}')`}}">
          <div class="pos-product-img">
            ${product.image
              ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">`
              : `<span class="pos-product-emoji">📦</span>`
            }
          </div>
          <div class="pos-product-info">
            <div class="pos-product-name">${escapeHtml(product.name)}</div>
            <div class="pos-product-price">${formatCurrency(product.price)}</div>
            <div class="pos-product-stock ${lowStock ? 'pos-stock-low' : ''}">
              ${outOfStock ? '🚫 Out of stock' : `${product.stock} left`}
            </div>
          </div>
          ${!outOfStock ? '<div class="pos-product-add">+</div>' : ''}
        </div>
      `;
    }).join('');
  },

  // ============================
  // BARCODE SCANNER
  // ============================

  handleBarcode(event) {
    if (event.key !== 'Enter') return;
    const input = event.target;
    const code = input.value.trim();
    if (!code) return;

    const data = Auth.state.db;
    const product = (data.products || []).find(p =>
      p.barcode && p.barcode.trim().toLowerCase() === code.toLowerCase()
    );

    if (product) {
      this.addCart(product.id);
      input.value = '';
      UI.toast(`✅ Scanned: ${product.name}`, 'success', 2000);
    } else {
      UI.toast('❌ Product not found for this barcode', 'error', 3000);
      input.value = '';
    }
  },

  // ============================
  // ADD TO CART
  // ============================

  addCart(id) {
    const data = Auth.state.db;
    if (!data) return;

    const product = data.products.find(p => p.id === id);
    if (!product || product.stock <= 0) {
      UI.toast('Out of stock!', 'error');
      return;
    }

    const cart = Auth.getCart();
    const existing = cart.find(c => c.id === id);

    if (existing) {
      if (existing.qty >= product.stock) {
        UI.toast('Insufficient stock!', 'warning');
        return;
      }
      existing.qty++;
      existing.total = existing.qty * product.price;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        qty: 1,
        total: product.price
      });
    }

    Auth.setCart(cart);
    this.renderCart();

    // Animate the checkout button to grab attention
    const btn = document.getElementById('posCheckoutBtn');
    if (btn) {
      btn.classList.add('pos-pulse');
      setTimeout(() => btn.classList.remove('pos-pulse'), 600);
    }
  },

  // ============================
  // CART RENDER
  // ============================

  renderCart() {
    const container = document.getElementById('posCartItems');
    const countEl = document.getElementById('posCartCount');
    if (!container) return;

    const cart = Auth.getCart();
    const subtotal = cart.reduce((s, i) => s + i.total, 0);
    const discountAmt = subtotal * (_discountPercent / 100);
    const taxable = subtotal - discountAmt;
    const taxRate = Auth.state.db?.settings?.taxRate || 12;
    const taxAmt = taxable * (taxRate / 100);
    const total = taxable + taxAmt;

    if (cart.length === 0) {
      container.innerHTML = `
        <div class="pos-cart-empty">
          <span class="pos-cart-empty-icon">🛒</span>
          <span>Cart is empty</span>
          <span class="pos-cart-empty-hint">Scan or tap products to add</span>
        </div>
      `;
      if (countEl) countEl.textContent = '0 items';
      document.getElementById('posSubtotal').textContent = '₱0.00';
      document.getElementById('posTax').textContent = '₱0.00';
      document.getElementById('posTotal').textContent = '₱0.00';
      document.getElementById('posCheckoutTotal').textContent = '₱0.00';
      document.getElementById('posChangeRow').style.display = 'none';
      document.getElementById('posTendered').value = '';
      return;
    }

    if (countEl) countEl.textContent = `${cart.length} item${cart.length > 1 ? 's' : ''}`;

    container.innerHTML = cart.map((item, idx) => `
      <div class="pos-cart-item ${idx === 0 ? 'pos-cart-item-new' : ''}"
        style="animation-delay:${idx * 0.03}s">
        <div class="pos-cart-item-info">
          <div class="pos-cart-item-name">${escapeHtml(item.name)}</div>
          <div class="pos-cart-item-price">${formatCurrency(item.price)}</div>
        </div>
        <div class="pos-cart-item-controls">
          <button class="pos-qty-btn" onclick="Cashier.updateCartQty('${item.id}', -1)" title="Decrease">−</button>
          <span class="pos-cart-qty">${item.qty}</span>
          <button class="pos-qty-btn" onclick="Cashier.updateCartQty('${item.id}', 1)" title="Increase">+</button>
          <span class="pos-cart-item-total">${formatCurrency(item.total)}</span>
          <button class="pos-cart-remove" onclick="Cashier.removeCartItem('${item.id}')" title="Remove item">✕</button>
        </div>
      </div>
    `).join('');

    // Update summary
    document.getElementById('posSubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('posTax').textContent = formatCurrency(taxAmt);
    document.getElementById('posTotal').textContent = formatCurrency(total);
    document.getElementById('posCheckoutTotal').textContent = formatCurrency(total);

    // Discount row visibility
    const discountRow = document.getElementById('posDiscountRow');
    if (discountAmt > 0) {
      discountRow.style.display = 'flex';
      document.getElementById('posDiscount').textContent = '−' + formatCurrency(discountAmt);
    } else {
      discountRow.style.display = 'none';
    }

    // Recalculate change
    this.calculateChange();
  },

  // ============================
  // QUANTITY CONTROLS
  // ============================

  removeCartItem(id) {
    let cart = Auth.getCart();
    cart = cart.filter(c => c.id !== id);
    Auth.setCart(cart);
    this.renderCart();
  },

  updateCartQty(id, delta) {
    const data = Auth.state.db;
    const cart = Auth.getCart();
    const item = cart.find(c => c.id === id);
    if (!item) return;

    const product = data.products.find(p => p.id === id);
    const newQty = item.qty + delta;

    if (newQty <= 0) {
      this.removeCartItem(id);
      return;
    }

    if (product && newQty > product.stock) {
      UI.toast('Insufficient stock!', 'warning');
      return;
    }

    item.qty = newQty;
    item.total = newQty * item.price;
    Auth.setCart(cart);
    this.renderCart();
  },

  // ============================
  // DISCOUNT
  // ============================

  updateDiscount(value) {
    _discountPercent = parseFloat(value) || 0;
    if (_discountPercent < 0) _discountPercent = 0;
    if (_discountPercent > 100) _discountPercent = 100;
    this.renderCart();
  },

  clearDiscount() {
    _discountPercent = 0;
    document.getElementById('posDiscountInput').value = '';
    this.renderCart();
  },

  // ============================
  // PAYMENT METHOD
  // ============================

  selectPaymentMethod(method) {
    _paymentMethod = method;
    document.querySelectorAll('.pos-pm-btn').forEach(b => b.classList.toggle('active', b.dataset.method === method));

    const cashPay = document.getElementById('posCashPayment');
    const nonCashPay = document.getElementById('posNonCashPayment');
    const changeRow = document.getElementById('posChangeRow');
    const chargeLabel = document.getElementById('posChargeLabel');

    if (method === 'cash') {
      cashPay.style.display = 'block';
      nonCashPay.style.display = 'none';
      changeRow.style.display = 'none';
      if (chargeLabel) chargeLabel.textContent = '💵 Charge';
    } else if (method === 'gcash') {
      cashPay.style.display = 'none';
      nonCashPay.style.display = 'block';
      changeRow.style.display = 'none';
      if (chargeLabel) chargeLabel.textContent = '📱 Pay GCash';
    } else if (method === 'card') {
      cashPay.style.display = 'none';
      nonCashPay.style.display = 'block';
      changeRow.style.display = 'none';
      if (chargeLabel) chargeLabel.textContent = '💳 Pay Card';
    }
  },

  getPaymentMethod() {
    return _paymentMethod;
  },

  getPaymentRef() {
    const el = document.getElementById('posRefNumber');
    return el ? el.value.trim() : '';
  },

  // ============================
  // PAYMENT & CHANGE
  // ============================

  calculateChange() {
    const cart = Auth.getCart();
    const subtotal = cart.reduce((s, i) => s + i.total, 0);
    const discountAmt = subtotal * (_discountPercent / 100);
    const taxable = subtotal - discountAmt;
    const taxRate = Auth.state.db?.settings?.taxRate || 12;
    const taxAmt = taxable * (taxRate / 100);
    const total = taxable + taxAmt;

    const tendered = parseFloat(document.getElementById('posTendered').value) || 0;
    const change = tendered - total;
    const changeRow = document.getElementById('posChangeRow');
    const changeEl = document.getElementById('posChangeAmount');

    if (tendered > 0 && _paymentMethod === 'cash') {
      changeRow.style.display = 'flex';
      changeEl.textContent = formatCurrency(change);
      changeEl.style.color = change >= 0 ? 'var(--success)' : 'var(--danger)';
    } else {
      changeRow.style.display = 'none';
    }
  },

  setTendered(amount) {
    const el = document.getElementById('posTendered');
    if (el) {
      el.value = amount;
      el.focus();
      this.calculateChange();
      // Auto-charge if tendered >= total
      const cart = Auth.getCart();
      if (cart.length > 0) {
        const subtotal = cart.reduce((s, i) => s + i.total, 0);
        const discountAmt = subtotal * (_discountPercent / 100);
        const taxRate = Auth.state.db?.settings?.taxRate || 12;
        const total = (subtotal - discountAmt) * (1 + taxRate / 100);
        if (amount >= total) {
          // Sales.payCart will be called via exposed global window.payCart
          if (typeof window.payCart === 'function') window.payCart();
        }
      }
    }
  },

  // ============================
  // NEW SALE, VOID, CLEAR, HOLD, RESUME
  // ============================

  newSale() {
    Auth.clearCart();
    _discountPercent = 0;
    _paymentMethod = 'cash';
    document.getElementById('posDiscountInput').value = '';
    document.getElementById('posTendered').value = '';
    document.getElementById('posRefNumber').value = '';
    this.selectPaymentMethod('cash');
    this.renderCart();
    document.getElementById('posSearch')?.focus();
  },

  voidLastItem() {
    const cart = Auth.getCart();
    if (cart.length === 0) {
      UI.toast('Cart is empty', 'warning');
      return;
    }
    const last = cart[cart.length - 1];
    UI.toast(`Voided: ${last.name}`, 'info', 2000);
    this.removeCartItem(last.id);
  },

  clearCart() {
    if (Auth.getCart().length === 0) {
      UI.toast('Cart is already empty', 'warning');
      return;
    }
    Auth.clearCart();
    _discountPercent = 0;
    document.getElementById('posDiscountInput').value = '';
    document.getElementById('posTendered').value = '';
    this.renderCart();
    UI.toast('Cart cleared', 'info', 2000);
  },

  suspendSale() {
    const cart = Auth.getCart();
    if (cart.length === 0) {
      UI.toast('Nothing to hold — cart is empty', 'warning');
      return;
    }
    const held = {
      id: 'HOLD-' + Date.now().toString(36).toUpperCase(),
      cart: JSON.parse(JSON.stringify(cart)),
      discount: _discountPercent,
      cashier: Auth.state.user,
      createdAt: new Date().toISOString()
    };
    _heldSales.push(held);
    Auth.clearCart();
    _discountPercent = 0;
    document.getElementById('posDiscountInput').value = '';
    document.getElementById('posTendered').value = '';
    this.renderCart();
    UI.toast(`⏸️ Sale held (${held.id})`, 'success', 3000);
  },

  resumeSale() {
    if (_heldSales.length === 0) {
      UI.toast('No held sales to resume', 'warning');
      return;
    }

    const held = _heldSales[_heldSales.length - 1];
    Auth.setCart(held.cart);
    _discountPercent = held.discount || 0;
    if (_discountPercent > 0) {
      document.getElementById('posDiscountInput').value = _discountPercent;
    }
    _heldSales = _heldSales.filter(s => s.id !== held.id);
    this.renderCart();
    UI.toast(`▶️ Resumed sale ${held.id}`, 'success', 3000);
  },

  // ============================
  // REPRINT
  // ============================

  /**
   * Store last receipt for reprint feature.
   */
  setLastReceipt(receipt) {
    this._lastReceipt = receipt;
  },

  reprintReceipt() {
    if (this._lastReceipt) {
      if (typeof window.showReceipt === 'function') {
        window.showReceipt(this._lastReceipt);
      }
    } else {
      UI.toast('No previous receipt to reprint', 'warning');
    }
  },

  // ============================
  // SEARCH / FILTER
  // ============================

  filterProducts(query) {
    this._renderProductGrid(query);
  }
};

export default CashierPOS;
