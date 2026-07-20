// ===============================
// SALES MODULE — ES Module
// Checkout pipeline, stock deduction, receipt generation, stats
// Uses only StorageService.save/load/update/delete/readRaw
// ===============================

import Auth from './auth.js';
import Audit from './audit.js';
import { formatCurrency, formatDate, showModal, hideModal, handleError, generateId, getStoreSettings } from './utils.js';
import { calculateTotals, calculateChange } from './calculator.js';
import UI from './ui.js';
import StorageService from './storage.js';

const Sales = {
  /**
   * Process the checkout: validate cart, deduct stock, record transaction, show receipt.
   * Uses StorageService.save('transactions', ...) and StorageService.update('products', ...)
   * instead of the old StorageService.checkout().
   */
  async payCart() {
    const cart = Auth.getCart();
    if (cart.length === 0) {
      UI.toast('Cart is empty!', 'warning');
      return;
    }

    // Check stock availability for all items
    for (const item of cart) {
      const product = StorageService.load('products', item.id);
      if (!product || product.stock < item.qty) {
        UI.toast(`Insufficient stock for "${item.name}"! Available: ${product ? product.stock : 0}, Requested: ${item.qty}`, 'error');
        return;
      }
    }

    // Guard: verify payment is sufficient before proceeding
    const tenderedEl = document.getElementById('posTendered');
    const amountTendered = parseFloat(tenderedEl?.value) || 0;
    const discountPercent = parseFloat(document.getElementById('posDiscountInput')?.value) || 0;
    const { total: totalCheck } = calculateTotals(cart, discountPercent);
    if (amountTendered < totalCheck) {
      UI.toast('Insufficient payment! Cannot process checkout.', 'error');
      return;
    }

    // --- Single source: calculateTotals() from calculator.js ---
    const { subtotal, discountAmt: discountAmount, taxAmt: taxAmount, total } = calculateTotals(cart, discountPercent);

    // Get payment details from CashierPOS module and DOM
    let paymentMethod = 'cash';
    let paymentRef = '';
    try {
      if (window.Cashier) {
        paymentMethod = window.Cashier.getPaymentMethod ? window.Cashier.getPaymentMethod() : 'cash';
        paymentRef = window.Cashier.getPaymentRef ? window.Cashier.getPaymentRef() : '';
      }
    } catch(e) {}

    // Compute change via the shared helper
    const change = Math.max(0, calculateChange(amountTendered, total));

    try {
      // Build the transaction with all payment fields
      const transaction = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase(),
        items: cart.map(item => {
          // Deduct stock inline
          const product = StorageService.load('products', item.id);
          if (product) {
            StorageService.update('products', item.id, {
              stock: product.stock - item.qty,
              lastUpdated: new Date().toISOString()
            });
          }
          return {
            productId: item.id, name: item.name,
            price: item.price, qty: item.qty, total: item.total
          };
        }),
        subtotal,
        discountPercent,
        discountAmount,
        taxRate,
        taxAmount,
        total,
        paymentMethod,
        paymentRef,
        amountTendered,
        change,
        cashier: Auth.state.user || 'unknown',
        date: new Date().toISOString()
      };

      // Save the transaction
      const result = StorageService.save('transactions', transaction);

      if (result.success) {
        // Update local state
        Auth.setDb(StorageService.readRaw());

        // Show receipt
        this.showReceipt(transaction);

        // Store receipt for reprint
        try {
          if (window.Cashier && typeof window.Cashier.setLastReceipt === 'function') {
            window.Cashier.setLastReceipt(transaction);
          }
        } catch(e) {}

        // Log the sale
        await Audit.logAction('SALE',
          `Checkout completed: ${cart.length} item(s), total ${formatCurrency(total)} (${paymentMethod}) by ${Auth.state.user}`
        );

        // Clear cart
        Auth.clearCart();

        // Refresh UI
        if (typeof window.CashierModule !== 'undefined' && typeof window.CashierModule.refreshAll === 'function') {
          window.CashierModule.refreshAll();
        }

        // Auto start new sale
        setTimeout(() => {
          try {
            if (window.Cashier && typeof window.Cashier.newSale === 'function') {
              window.Cashier.newSale();
            }
          } catch(e) {}
        }, 100);

        UI.toast('Checkout successful! 🎉', 'success', 4000);
      } else {
        UI.toast(result.error || 'Checkout failed.', 'error');
      }
    } catch (e) {
      handleError(e, 'Checkout');
      UI.toast('Checkout failed. Please try again.', 'error');
    }
  },

  showReceipt(transaction) {
    const receiptItems = document.getElementById('receiptItems');
    const receiptTotal = document.getElementById('receiptTotal');
    const receiptSubtotal = document.getElementById('receiptSubtotal');
    const receiptDiscount = document.getElementById('receiptDiscount');
    const receiptDiscountRow = document.getElementById('receiptDiscountRow');
    const receiptDate = document.getElementById('receiptDate');
    const receiptId = document.getElementById('receiptId');
    const receiptCashier = document.getElementById('receiptCashier');
    const receiptPaymentMethod = document.getElementById('receiptPaymentMethod');
    const receiptTendered = document.getElementById('receiptTendered');
    const receiptTenderedRow = document.getElementById('receiptTenderedRow');
    const receiptChange = document.getElementById('receiptChange');
    const receiptChangeRow = document.getElementById('receiptChangeRow');
    const storeName = document.getElementById('receiptStoreName');
    const storeAddr = document.getElementById('receiptStoreAddress');
    const receiptMsg = document.getElementById('receiptMessage');
    const headerText = document.getElementById('receiptHeaderText');
    const taxInfo = document.getElementById('receiptTaxInfo');
    const s = getStoreSettings();

    if (receiptItems) {
      receiptItems.innerHTML = (transaction.items || []).map(item => `
        <tr>
          <td>${this._escapeHtml(item.name)}</td>
          <td>${item.qty}</td>
          <td>${formatCurrency(item.price)}</td>
          <td>${formatCurrency(item.total)}</td>
        </tr>
      `).join('');
    }

    // Core receipt data
    if (receiptDate) receiptDate.textContent = formatDate(transaction.date);
    if (receiptId) receiptId.textContent = transaction.id;
    if (receiptCashier) receiptCashier.textContent = transaction.cashier;

    // Payment summary
    const txSubtotal = transaction.subtotal || transaction.total || 0;
    const txDiscount = transaction.discountAmount || 0;
    if (receiptSubtotal) receiptSubtotal.textContent = formatCurrency(txSubtotal);
    if (receiptTotal) receiptTotal.textContent = formatCurrency(transaction.total || 0);

    // Discount row (show only if discount > 0)
    if (receiptDiscountRow && receiptDiscount) {
      if (txDiscount > 0) {
        receiptDiscountRow.classList.remove('hidden');
        receiptDiscount.textContent = '−' + formatCurrency(txDiscount);
      } else {
        receiptDiscountRow.classList.add('hidden');
      }
    }

    // Payment method
    if (receiptPaymentMethod) {
      const icons = { cash: '💵 Cash', gcash: '📱 GCash', card: '💳 Card' };
      receiptPaymentMethod.textContent = icons[transaction.paymentMethod] || transaction.paymentMethod || 'Cash';
    }

    // Tendered and change (show only for cash payments)
    const isCash = !transaction.paymentMethod || transaction.paymentMethod === 'cash';
    const txTendered = transaction.amountTendered || 0;
    const txChange = transaction.change || 0;

    if (receiptTenderedRow) {
      if (isCash && txTendered > 0) {
        receiptTenderedRow.classList.remove('hidden');
        if (receiptTendered) receiptTendered.textContent = formatCurrency(txTendered);
      } else {
        receiptTenderedRow.classList.add('hidden');
      }
    }

    if (receiptChangeRow) {
      if (isCash && txChange > 0) {
        receiptChangeRow.classList.remove('hidden');
        if (receiptChange) receiptChange.textContent = formatCurrency(txChange);
      } else {
        receiptChangeRow.classList.add('hidden');
      }
    }

    // Wire settings into receipt
    if (storeName) storeName.textContent = s.storeName || 'Sari-Sari Store';
    if (storeAddr) {
      const parts = [s.storeAddress, s.storePhone, s.storeEmail].filter(Boolean);
      storeAddr.textContent = parts.join(' \u00b7 ') || '';
    }
    if (receiptMsg) receiptMsg.textContent = s.receiptMessage || 'Thank you for your purchase! \u2764\ufe0f';
    if (headerText) headerText.textContent = s.receiptHeader || '';

    // Tax info on receipt
    if (taxInfo) {
      const txTaxRate = transaction.taxRate || s.taxRate || 0;
      const txTaxAmount = transaction.taxAmount || 0;
      if (txTaxRate > 0 && txTaxAmount > 0) {
        taxInfo.textContent = `VAT (${txTaxRate}%): ${formatCurrency(txTaxAmount)}`;
        taxInfo.classList.remove('hidden');
      } else {
        taxInfo.classList.add('hidden');
      }
    }

    showModal('receiptModal');
  },

  printReceipt() {
    const modal = document.getElementById('receiptModal');
    if (modal) modal.classList.add('printing');
    window.print();
    setTimeout(() => { if (modal) modal.classList.remove('printing'); }, 500);
  },

  closeReceipt() { hideModal('receiptModal'); },

  renderStats() {
    const statsEl = document.getElementById('statsContainer');
    if (!statsEl) return;
    const data = StorageService.readRaw();
    if (!data || !data.stats) return;
    const stats = data.stats;
    statsEl.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon">💰</div>
        <div class="stat-label">Total Revenue</div>
        <div class="stat-value">${formatCurrency(stats.totalRevenue || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📈</div>
        <div class="stat-label">Total Profit</div>
        <div class="stat-value">${formatCurrency(stats.totalProfit || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📦</div>
        <div class="stat-label">Items Sold</div>
        <div class="stat-value">${(stats.totalItemsSold || 0).toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🧾</div>
        <div class="stat-label">Transactions</div>
        <div class="stat-value">${(stats.totalTransactions || 0).toLocaleString()}</div>
      </div>
    `;
  },

  _escapeHtml(str) {
    if (typeof str !== 'string') return str || '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

export default Sales;
