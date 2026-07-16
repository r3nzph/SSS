// ===============================
// RECEIVING MODULE — Full Stock Receiving
// Partial receive, damaged/rejected items,
// auto inventory update, PO status tracking
// Uses ONLY StorageService — no Electron, no Node.js
// ===============================

import Auth from './auth.js';
import Audit from './audit.js';
import UI from './ui.js';
import { escapeHtml, formatCurrency, formatDate, getInputValue, clearInput, generateId, getISOTimestamp, showModal, hideModal } from './utils.js';
import StorageService from './storage.js';

const Receiving = {
  _receivingPOId: null,
  _receiveItems: [],

  // ============================
  // INITIATE RECEIVING FROM PO
  // ============================

  startReceiving(poId) {
    const po = StorageService.load('purchaseOrders', poId);
    if (!po) { UI.toast('Purchase order not found.', 'error'); return; }

    if (po.status === 'received') {
      UI.toast('This PO is already fully received.', 'warning');
      return;
    }
    if (po.status === 'cancelled') {
      UI.toast('Cannot receive a cancelled PO.', 'warning');
      return;
    }

    // Calculate already-received quantities from previous receives
    const prevReceives = StorageService.load('receivingTransactions').filter(r => r.poId === poId);
    const prevReceived = {};
    prevReceives.forEach(r => {
      (r.items || []).forEach(item => {
        const key = (item.productName || '').toLowerCase();
        prevReceived[key] = (prevReceived[key] || 0) + (item.receivedQty || 0);
      });
    });

    // Build receive items with remaining quantities
    this._receiveItems = (po.items || []).map(item => {
      const alreadyReceived = prevReceived[(item.productName || '').toLowerCase()] || 0;
      const remaining = Math.max(0, item.qty - alreadyReceived);
      return {
        productName: item.productName,
        orderedQty: item.qty,
        alreadyReceived,
        remaining,
        receivedQty: remaining,
        damagedQty: 0,
        cost: item.cost
      };
    });

    this._receivingPOId = poId;
    this._renderReceiveTable();
    this._updateReceiveTotals();

    document.getElementById('recPOInfo').innerHTML = `
      <strong>${escapeHtml(po.poNumber || po.id)}</strong> — ${escapeHtml(po.supplierName)}
      <span style="color:var(--text-muted);font-size:0.85rem;margin-left:8px;">
        (${this._receiveItems.filter(i => i.remaining > 0).length} items remaining)
      </span>
    `;

    document.getElementById('recNumber').textContent = 'RCT-' + Date.now().toString(36).toUpperCase();
    document.getElementById('recDate').value = new Date().toISOString().slice(0, 10);
    clearInput('recReference');
    clearInput('recNotes');

    showModal('receivingModalOverlay');
  },

  // ============================
  // RECEIVE TABLE
  // ============================

  _renderReceiveTable() {
    const tbody = document.getElementById('recItemsBody');
    if (!tbody) return;

    if (this._receiveItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No items to receive.</td></tr>';
      return;
    }

    const allReceived = this._receiveItems.every(i => i.remaining <= 0);
    if (allReceived) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--success);">✅ All items from this PO have been received!</td></tr>';
      return;
    }

    const totalOrdered = this._receiveItems.reduce((s, i) => s + i.orderedQty, 0);
    const totalReceived = this._receiveItems.reduce((s, i) => s + i.alreadyReceived, 0);
    const pct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

    const progressEl = document.getElementById('recProgress');
    if (progressEl) {
      progressEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="flex:1;height:8px;background:var(--bg-glass);border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--success),var(--accent-primary));border-radius:4px;transition:width 0.5s ease;"></div>
          </div>
          <span style="font-size:0.85rem;color:var(--text-secondary);white-space:nowrap;">${pct}% received</span>
        </div>
      `;
    }

    tbody.innerHTML = this._receiveItems.map((item, idx) => {
      if (item.remaining <= 0) {
        return `
          <tr style="opacity:0.5;">
            <td>${escapeHtml(item.productName)}</td>
            <td>${item.orderedQty}</td>
            <td colspan="2" style="color:var(--success);font-size:0.85rem;">✅ Fully received (${item.alreadyReceived})</td>
            <td class="price-cell">${formatCurrency(item.cost)}</td>
          </tr>`;
      }
      return `
        <tr>
          <td>${escapeHtml(item.productName)}</td>
          <td>${item.orderedQty} <span style="color:var(--text-muted);font-size:0.75rem;">(rec'd: ${item.alreadyReceived})</span></td>
          <td>
            <input type="number" class="rec-qty-input" value="${item.remaining}" min="0" max="${item.remaining}"
              data-idx="${idx}" oninput="Receiving._updateItem(${idx}, 'receivedQty', this.value)">
          </td>
          <td>
            <input type="number" class="rec-qty-input" value="0" min="0"
              data-idx="${idx}" oninput="Receiving._updateItem(${idx}, 'damagedQty', this.value)"
              style="color:var(--danger);">
          </td>
          <td class="price-cell">${formatCurrency(item.cost)}</td>
        </tr>`;
    }).join('');
  },

  _updateItem(idx, field, value) {
    if (idx >= 0 && idx < this._receiveItems.length) {
      const parsed = parseInt(value, 10);
      this._receiveItems[idx][field] = isNaN(parsed) ? 0 : Math.max(0, parsed);
      this._updateReceiveTotals();
    }
  },

  _updateReceiveTotals() {
    const totalReceived = this._receiveItems.reduce((s, i) => s + (i.receivedQty || 0), 0);
    const totalDamaged = this._receiveItems.reduce((s, i) => s + (i.damagedQty || 0), 0);
    const totalCost = this._receiveItems.reduce((s, i) => s + (i.receivedQty || 0) * i.cost, 0);
    const el = document.getElementById('recTotals');
    if (el) {
      el.innerHTML = `
        <span>Receiving: <strong>${totalReceived}</strong> units</span>
        <span>Damaged: <strong style="color:var(--danger);">${totalDamaged}</strong> units</span>
        <span>Total Value: <strong class="price-cell">${formatCurrency(totalCost)}</strong></span>
      `;
    }
  },

  // ============================
  // CONFIRM RECEIVING
  // ============================

  async confirmReceiving() {
    const totalReceived = this._receiveItems.reduce((s, i) => s + (i.receivedQty || 0), 0);
    if (totalReceived <= 0) {
      UI.toast('No items to receive. Enter at least 1 received quantity.', 'warning');
      return;
    }

    // Validate: received + damaged cannot exceed remaining
    const errors = [];
    this._receiveItems.forEach(item => {
      if (item.remaining > 0) {
        const receiving = (item.receivedQty || 0) + (item.damagedQty || 0);
        if (receiving > item.remaining) {
          errors.push(`${item.productName}: Received (${receiving}) exceeds remaining (${item.remaining})`);
        }
      }
    });
    if (errors.length > 0) {
      UI.toast('Validation errors:\n' + errors.join('\n'), 'error');
      return;
    }

    // Check for quantity differences
    const diffs = [];
    this._receiveItems.forEach(item => {
      if (item.remaining > 0 && item.receivedQty !== item.remaining) {
        diffs.push(`${item.productName}: ordered ${item.remaining}, receiving ${item.receivedQty}`);
      }
    });

    let confirmMsg = `Confirm receiving ${totalReceived} units?`;
    if (diffs.length > 0) {
      confirmMsg += `\n\n⚠️ Quantity differences:\n${diffs.join('\n')}`;
    }

    const confirmed = await UI.confirm(confirmMsg, 'Confirm Receiving');
    if (!confirmed) return;

    UI.showLoading('Processing receiving...');

    try {
      const po = StorageService.load('purchaseOrders', this._receivingPOId);
      if (!po) { UI.toast('PO not found!', 'error'); return; }

      const userName = Auth.state.user || 'admin';
      const now = getISOTimestamp();
      const recNumber = 'RCT-' + Date.now().toString(36).toUpperCase();

      // Build receiving transaction items
      const items = this._receiveItems
        .filter(i => i.remaining > 0)
        .map(i => ({
          productName: i.productName,
          orderedQty: i.remaining,
          receivedQty: i.receivedQty || 0,
          damagedQty: i.damagedQty || 0,
          cost: i.cost,
          total: (i.receivedQty || 0) * i.cost
        }));

      const receivingTransaction = {
        id: generateId('rcv'),
        recNumber,
        poId: po.id,
        poNumber: po.poNumber || po.id,
        supplierName: po.supplierName,
        supplierId: po.supplierId,
        items,
        totalItems: totalReceived,
        totalDamaged: this._receiveItems.reduce((s, i) => s + (i.damagedQty || 0), 0),
        totalCost: items.reduce((s, i) => s + i.total, 0),
        receivedBy: userName,
        deliveryDate: getInputValue('recDate'),
        reference: getInputValue('recReference'),
        notes: getInputValue('recNotes'),
        createdAt: now
      };

      // Update inventory: increase stock for received items
      for (const item of items) {
        if (item.receivedQty > 0) {
          const existingProducts = StorageService.load('products');
          const existing = existingProducts.find(p =>
            (p.name || '').toLowerCase() === (item.productName || '').toLowerCase()
          );
          if (existing) {
            StorageService.update('products', existing.id, {
              stock: (existing.stock || 0) + item.receivedQty,
              cost: item.cost,
              lastUpdated: now
            });
          } else {
            const newProd = {
              id: generateId('p'),
              name: item.productName,
              price: Math.round(item.cost * 1.4 * 100) / 100,
              cost: item.cost,
              stock: item.receivedQty,
              minStock: 5, unit: 'pcs', category: 'General',
              supplier: po.supplierName,
              barcode: '', brand: '', description: '', image: '',
              dateAdded: now, lastUpdated: now, archived: false
            };
            StorageService.save('products', newProd);
          }
        }
      }

      // Determine new PO status
      const allReceived =
        this._receiveItems.every(i => i.receivedQty >= i.remaining && i.remaining > 0) ||
        this._receiveItems.every(i => i.remaining <= 0);
      const newStatus = allReceived ? 'received' : 'partial';
      const timelineAction = allReceived ? 'received' : 'partial_received';

      // Update PO status
      const timeline = [...(po.timeline || []), {
        action: timelineAction, date: now, user: userName,
        details: `${totalReceived} units received (${receivingTransaction.totalDamaged} damaged)`
      }];

      StorageService.update('purchaseOrders', po.id, {
        status: newStatus,
        lastUpdated: now,
        timeline,
        ...(allReceived ? { receivedAt: now, receivedBy: userName } : {})
      });

      // Save receiving transaction
      StorageService.save('receivingTransactions', receivingTransaction);

      // Log audit
      const itemDetails = items.filter(i => i.receivedQty > 0).map(i =>
        `${i.receivedQty}x ${i.productName}${i.damagedQty > 0 ? ` (${i.damagedQty} damaged)` : ''}`
      ).join(', ');
      await Audit.logAction('STOCK_RECEIVE',
        `Received ${recNumber} for ${po.poNumber || po.id} from ${po.supplierName}: ${itemDetails}. Status: ${newStatus}`
      );

      // Record stock adjustment entry for tracking
      if (items.some(i => i.receivedQty > 0)) {
        StorageService.save('stockAdjustments', {
          id: generateId('adj'),
          productId: 'RCT:' + recNumber,
          productName: `Receiving: ${recNumber}`,
          previousStock: 0,
          newStock: totalReceived,
          reason: `Received from ${po.supplierName} (PO: ${po.poNumber || po.id})`,
          user: userName,
          createdAt: now
        });
      }

      this._receivingPOId = null;
      this._receiveItems = [];
      hideModal('receivingModalOverlay');

      Auth.setDb(StorageService.readRaw());
      if (typeof window.AdminModule !== 'undefined' && typeof window.AdminModule.refreshAll === 'function') {
        window.AdminModule.refreshAll();
      }
      UI.hideLoading();
      UI.toast(`Receiving ${recNumber} completed! ${totalReceived} units received.`, 'success');

    } catch (e) {
      UI.hideLoading();
      console.error('Receiving error:', e);
      UI.toast('Error processing receiving. Check console for details.', 'error');
    }
  },

  // ============================
  // RECEIVING HISTORY
  // ============================

  renderReceivingHistory() {
    const tbody = document.getElementById('recHistoryBody');
    if (!tbody) return;

    const transactions = StorageService.load('receivingTransactions');
    if (transactions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No receiving transactions yet.</td></tr>';
      return;
    }

    const sorted = [...transactions].reverse().slice(0, 50);
    tbody.innerHTML = sorted.map(r => {
      const itemCount = r.items ? r.items.reduce((s, i) => s + i.receivedQty, 0) : 0;
      const damagedCount = r.totalDamaged || (r.items ? r.items.reduce((s, i) => s + (i.damagedQty || 0), 0) : 0);
      return `
        <tr>
          <td><strong>${escapeHtml(r.recNumber)}</strong></td>
          <td>${escapeHtml(r.poNumber)}</td>
          <td>${escapeHtml(r.supplierName)}</td>
          <td>${itemCount} units ${damagedCount > 0 ? `<span style="color:var(--danger);">(${damagedCount} damaged)</span>` : ''}</td>
          <td class="price-cell">${formatCurrency(r.totalCost || 0)}</td>
          <td>${escapeHtml(formatDate(r.createdAt))}</td>
        </tr>`;
    }).join('');
  },

  // ============================
  // CLOSE
  // ============================

  closeModal() {
    hideModal('receivingModalOverlay');
    this._receivingPOId = null;
    this._receiveItems = [];
  }
};

export default Receiving;
