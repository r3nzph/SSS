// ===============================
// SHARED RECEIPT MODULE
// Receipt display, printing, and modal handling
// Wires store settings into receipt view
// ===============================

import { formatCurrency, formatDate, escapeHtml, showModal, hideModal, getStoreSettings } from './utils.js';

const ReceiptViewer = {
  showReceipt(transaction) {
    const items = document.getElementById('receiptItems');
    const total = document.getElementById('receiptTotal');
    const subtotal = document.getElementById('receiptSubtotal');
    const discount = document.getElementById('receiptDiscount');
    const discountRow = document.getElementById('receiptDiscountRow');
    const date = document.getElementById('receiptDate');
    const id = document.getElementById('receiptId');
    const cashier = document.getElementById('receiptCashier');
    const paymentMethod = document.getElementById('receiptPaymentMethod');
    const tendered = document.getElementById('receiptTendered');
    const tenderedRow = document.getElementById('receiptTenderedRow');
    const change = document.getElementById('receiptChange');
    const changeRow = document.getElementById('receiptChangeRow');
    const storeName = document.getElementById('receiptStoreName');
    const storeAddr = document.getElementById('receiptStoreAddress');
    const receiptMsg = document.getElementById('receiptMessage');
    const headerText = document.getElementById('receiptHeaderText');
    const taxInfo = document.getElementById('receiptTaxInfo');

    // Populate items
    if (items) {
      items.innerHTML = (transaction.items || []).map(item => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${item.qty}</td>
          <td>${formatCurrency(item.price)}</td>
          <td>${formatCurrency(item.total)}</td>
        </tr>
      `).join('') || '<tr><td colspan="4">No items</td></tr>';
    }

    // Core receipt data
    if (date) date.textContent = formatDate(transaction.date);
    if (id) id.textContent = transaction.id;
    if (cashier) cashier.textContent = transaction.cashier || '—';

    // Payment summary
    const txSubtotal = transaction.subtotal || transaction.total || 0;
    const txDiscount = transaction.discountAmount || 0;
    if (subtotal) subtotal.textContent = formatCurrency(txSubtotal);
    if (total) total.textContent = formatCurrency(transaction.total || 0);

    // Discount row (show only if discount > 0)
    if (discountRow && discount) {
      if (txDiscount > 0) {
        discountRow.classList.remove('hidden');
        discount.textContent = '−' + formatCurrency(txDiscount);
      } else {
        discountRow.classList.add('hidden');
      }
    }

    // Payment method
    if (paymentMethod) {
      const icons = { cash: '💵 Cash', gcash: '📱 GCash', card: '💳 Card' };
      paymentMethod.textContent = icons[transaction.paymentMethod] || transaction.paymentMethod || 'Cash';
    }

    // Tendered and change (show only for cash payments with tendered > 0)
    const isCash = !transaction.paymentMethod || transaction.paymentMethod === 'cash';
    const txTendered = transaction.amountTendered || 0;
    const txChange = transaction.change || 0;

    if (tenderedRow) {
      if (isCash && txTendered > 0) {
        tenderedRow.classList.remove('hidden');
        if (tendered) tendered.textContent = formatCurrency(txTendered);
      } else {
        tenderedRow.classList.add('hidden');
      }
    }

    if (changeRow) {
      if (isCash && txChange > 0) {
        changeRow.classList.remove('hidden');
        if (change) change.textContent = formatCurrency(txChange);
      } else {
        changeRow.classList.add('hidden');
      }
    }

    // Wire settings into receipt
    const s = getStoreSettings();
    if (storeName) storeName.textContent = s.storeName || 'Sari-Sari Store';
    if (storeAddr) {
      const parts = [s.storeAddress, s.storePhone, s.storeEmail].filter(Boolean);
      storeAddr.textContent = parts.join(' · ') || '';
    }
    if (receiptMsg) receiptMsg.textContent = s.receiptMessage || 'Thank you for your purchase! ❤️';
    if (headerText) headerText.textContent = s.receiptHeader || '';

    // Tax info on receipt (uses stored tx values, falls back to settings)
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

  closeReceipt() { hideModal('receiptModal'); },

  printReceipt() {
    const modal = document.getElementById('receiptModal');
    if (modal) modal.classList.add('printing');
    window.print();
    setTimeout(() => { if (modal) modal.classList.remove('printing'); }, 500);
  }
};

export default ReceiptViewer;
