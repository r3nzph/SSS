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
    const date = document.getElementById('receiptDate');
    const id = document.getElementById('receiptId');
    const cashier = document.getElementById('receiptCashier');
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
    if (total) total.textContent = formatCurrency(transaction.total);
    if (date) date.textContent = formatDate(transaction.date);
    if (id) id.textContent = transaction.id;
    if (cashier) cashier.textContent = transaction.cashier || '—';

    // Wire settings into receipt
    const s = getStoreSettings();
    if (storeName) storeName.textContent = s.storeName || 'Sari-Sari Store';
    if (storeAddr) {
      const parts = [s.storeAddress, s.storePhone, s.storeEmail].filter(Boolean);
      storeAddr.textContent = parts.join(' · ') || '';
    }
    if (receiptMsg) receiptMsg.textContent = s.receiptMessage || 'Thank you for your purchase! ❤️';
    if (headerText) headerText.textContent = s.receiptHeader || '';

    // Tax info on receipt
    if (taxInfo) {
      const taxRate = s.taxRate || 0;
      if (taxRate > 0 && s.showTaxOnReceipt !== false) {
        const taxAmt = (transaction.total || 0) * (taxRate / (100 + taxRate));
        taxInfo.textContent = `VAT (${taxRate}%): ${formatCurrency(taxAmt)}`;
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
