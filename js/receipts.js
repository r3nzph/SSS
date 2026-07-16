// ===============================
// SHARED RECEIPT MODULE
// Receipt display, printing, and modal handling
// ===============================

import { formatCurrency, formatDate, escapeHtml, showModal, hideModal } from './utils.js';

const ReceiptViewer = {
  showReceipt(transaction) {
    const items = document.getElementById('receiptItems');
    const total = document.getElementById('receiptTotal');
    const date = document.getElementById('receiptDate');
    const id = document.getElementById('receiptId');
    const cashier = document.getElementById('receiptCashier');

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

    if (total) total.textContent = formatCurrency(transaction.total);
    if (date) date.textContent = formatDate(transaction.date);
    if (id) id.textContent = transaction.id;
    if (cashier) cashier.textContent = transaction.cashier || '—';

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
