// ===============================
// DASHBOARD MODULE — KPI cards + Canvas charts
// ===============================

import Auth from './auth.js';
import { formatCurrency, getChartTheme } from './utils.js';

const Dashboard = {
  _charts: [],

  renderDashboard() {
    this._initThemeListener();
    try {
      this.renderKPI();
    } catch (e) {
      console.error('[DASHBOARD] KPI render failed:', e);
    }
    try {
      this.renderCharts();
    } catch (e) {
      console.error('[DASHBOARD] Charts render failed:', e);
    }
    try {
      this.renderDashboardLowStock();
    } catch (e) {
      console.error('[DASHBOARD] Low stock render failed:', e);
    }
  },

  /** Re-render charts on theme change (runs once) */
  _initThemeListener() {
    if (this._listenerInitialized) return;
    this._listenerInitialized = true;
    window.addEventListener('theme-changed', () => {
      if (document.getElementById('salesChart') || document.getElementById('profitChart')) {
        this.renderCharts();
      }
    });
  },

  renderDashboardLowStock() {
    const container = document.getElementById('dashboardLowStock');
    if (!container) return;
    const data = Auth.state.db;
    if (!data || !data.products) {
      container.innerHTML = '<p class="no-alerts">✅ No data available.</p>';
      return;
    }
    const low = data.products.filter(p => !p.archived && p.stock <= (p.minStock || 5));
    if (low.length === 0) {
      container.innerHTML = '<p class="no-alerts">✅ All items are well-stocked.</p>';
      return;
    }
    container.innerHTML = low.slice(0, 8).map(p => `
      <div class="alert-item ${p.stock <= 0 ? 'alert-danger' : 'alert-warning'}">
        <span class="alert-icon">${p.stock <= 0 ? '🚫' : '⚠️'}</span>
        <span class="alert-text"><strong>${this._escapeHtml(p.name)}</strong> ${p.stock <= 0 ? 'is out of stock!' : `only ${p.stock} left (min: ${p.minStock || 5})`}</span>
      </div>
    `).join('');
  },

  _escapeHtml(str) {
    if (typeof str !== 'string') return str || '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  renderKPI() {
    const el = document.getElementById('kpiContainer');
    if (!el) {
      console.warn('[DASHBOARD] kpiContainer element not found.');
      return;
    }
    const data = Auth.state.db;
    if (!data) {
      console.warn('[DASHBOARD] Auth.state.db is null — rendering empty state.');
      el.innerHTML = `<div class="kpi-card" style="--kpi-color: var(--text-muted);">
        <div class="kpi-icon">📭</div>
        <div class="kpi-info">
          <div class="kpi-label">No Data</div>
          <div class="kpi-value" style="font-size:0.9rem;">Could not load dashboard data.</div>
        </div>
      </div>`;
      return;
    }
    const s = data.stats || { totalRevenue: 0, totalProfit: 0, totalItemsSold: 0, totalTransactions: 0 };
    const products = data.products || [];
    const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
    const lowStock = products.filter(p => p.stock <= (p.minStock || 5)).length;

    el.innerHTML = `
      <div class="kpi-card" style="--kpi-color: var(--accent-primary);">
        <div class="kpi-icon">💰</div>
        <div class="kpi-info">
          <div class="kpi-label">Total Revenue</div>
          <div class="kpi-value">${formatCurrency(s.totalRevenue || 0)}</div>
          <div class="kpi-trend up">▲ Since inception</div>
        </div>
      </div>
      <div class="kpi-card" style="--kpi-color: var(--success);">
        <div class="kpi-icon">📈</div>
        <div class="kpi-info">
          <div class="kpi-label">Total Profit</div>
          <div class="kpi-value">${formatCurrency(s.totalProfit || 0)}</div>
          <div class="kpi-trend up">▲ ${s.totalRevenue ? Math.round(s.totalProfit / s.totalRevenue * 100) : 0}% margin</div>
        </div>
      </div>
      <div class="kpi-card" style="--kpi-color: var(--info);">
        <div class="kpi-icon">📦</div>
        <div class="kpi-info">
          <div class="kpi-label">Items Sold</div>
          <div class="kpi-value">${(s.totalItemsSold || 0).toLocaleString()}</div>
          <div class="kpi-trend up">▲ ${(s.totalTransactions || 0).toLocaleString()} transactions</div>
        </div>
      </div>
      <div class="kpi-card" style="--kpi-color: var(--warning);">
        <div class="kpi-icon">⚠️</div>
        <div class="kpi-info">
          <div class="kpi-label">Low Stock Items</div>
          <div class="kpi-value">${lowStock}</div>
          <div class="kpi-trend ${lowStock > 0 ? 'down' : 'up'}">${lowStock > 0 ? '▼ Needs attention' : '▲ All stocked'}</div>
        </div>
      </div>
      <div class="kpi-card" style="--kpi-color: var(--accent-secondary);">
        <div class="kpi-icon">🏷️</div>
        <div class="kpi-info">
          <div class="kpi-label">Products</div>
          <div class="kpi-value">${products.length}</div>
          <div class="kpi-trend up">▲ ${formatCurrency(totalValue)} total value</div>
        </div>
      </div>
      <div class="kpi-card" style="--kpi-color: var(--success);">
        <div class="kpi-icon">🧾</div>
        <div class="kpi-info">
          <div class="kpi-label">Avg. Sale</div>
          <div class="kpi-value">${s.totalTransactions ? formatCurrency(s.totalRevenue / s.totalTransactions) : '₱0.00'}</div>
          <div class="kpi-trend up">▲ Per transaction</div>
        </div>
      </div>`;
  },

  renderCharts() { this.renderRevenueChart(); this.renderProfitChart(); },

  /** Helper: get 7-day aggregated data from transactions */
  _getLast7Days() {
    const data = Auth.state.db;
    const transactions = data.transactions || [];
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en', { weekday: 'short' });
      const dayTxns = transactions.filter(tx => tx.date && tx.date.slice(0, 10) === key);
      days.push({ label, key, txns: dayTxns });
    }
    return days;
  },

  /** Render the Revenue Chart (daily sales total) */
  renderRevenueChart() {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;
    // Restore visibility (skeleton may have hidden the canvas)
    canvas.style.opacity = '1';
    const parentEl = canvas.parentElement;
    if (parentEl) {
      const skel = parentEl.querySelector('.skeleton-chart');
      if (skel) skel.remove();
    }

    const data = Auth.state.db;
    const allTxns = data.transactions || [];

    // Resize canvas
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.max(rect.width || 400, 100);
    canvas.height = 220;
    const w = canvas.width, h = canvas.height;
    const ct = getChartTheme();
    ctx.clearRect(0, 0, w, h);

    // Title
    ctx.fillStyle = ct.chartTitle;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Revenue (7 days)', 10, 14);

    // No-data state
    if (allTxns.length === 0) {
      ctx.fillStyle = ct.emptyText;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No transactions yet', w / 2, h / 2);
      return;
    }

    const days = this._getLast7Days();
    const dayData = days.map(d => ({
      label: d.label,
      total: d.txns.reduce((s, tx) => s + (tx.total || 0), 0)
    }));

    const max = Math.max(...dayData.map(d => d.total), 1);
    const pad = { top: 20, bottom: 30, left: 10, right: 10 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const barW = chartW / dayData.length * 0.6;
    const gap = chartW / dayData.length;

    dayData.forEach((day, i) => {
      const x = pad.left + i * gap + (gap - barW) / 2;
      const barH = (day.total / max) * chartH;
      const y = pad.top + chartH - barH;

      const accentPrimary = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim() || '#6D5DFC';
      const grad = ctx.createLinearGradient(x, y, x, pad.top + chartH);
      grad.addColorStop(0, accentPrimary);
      grad.addColorStop(1, accentPrimary + '4D');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
      ctx.fill();

      ctx.fillStyle = ct.axisLabel;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(day.label, x + barW / 2, h - 6);

      if (day.total > 0) {
        ctx.fillStyle = ct.dataValue;
        ctx.font = '9px sans-serif';
        ctx.fillText('₱' + day.total.toFixed(0), x + barW / 2, y - 4);
      }
    });
  },

  /** Render the Profit Chart (daily profit = revenue − cost of goods) */
  renderProfitChart() {
    const canvas = document.getElementById('profitChart');
    if (!canvas) return;
    // Restore visibility (skeleton may have hidden the canvas)
    canvas.style.opacity = '1';
    const parentEl = canvas.parentElement;
    if (parentEl) {
      const skel = parentEl.querySelector('.skeleton-chart');
      if (skel) skel.remove();
    }

    const data = Auth.state.db;
    const products = data.products || [];
    const allTxns = data.transactions || [];

    // Resize canvas
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.max(rect.width || 400, 100);
    canvas.height = 220;
    const w = canvas.width, h = canvas.height;
    const ct = getChartTheme();
    ctx.clearRect(0, 0, w, h);

    // Title
    ctx.fillStyle = ct.chartTitle;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Profit (7 days)', 10, 14);

    // No-data state
    if (allTxns.length === 0) {
      ctx.fillStyle = ct.emptyText;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No transactions yet', w / 2, h / 2);
      return;
    }

    const days = this._getLast7Days();
    const dayProfit = days.map(d => {
      let profit = 0;
      d.txns.forEach(tx => {
        if (tx.items) {
          tx.items.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            const cost = product ? (parseFloat(product.cost) || 0) : 0;
            profit += ((item.price || 0) - cost) * (item.qty || 0);
          });
        }
      });
      return { label: d.label, profit: Math.round(profit * 100) / 100 };
    });

    const maxProfit = Math.max(...dayProfit.map(d => d.profit), 1);
    // If all days have zero profit, show a flat chart
    const hasProfit = dayProfit.some(d => d.profit !== 0);

    const pad = { top: 20, bottom: 30, left: 10, right: 10 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const barW = chartW / dayProfit.length * 0.6;
    const gap = chartW / dayProfit.length;

    if (!hasProfit) {
      ctx.fillStyle = ct.emptyText;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No profit data (items may lack cost price)', w / 2, h / 2);
      return;
    }

    dayProfit.forEach((day, i) => {
      const x = pad.left + i * gap + (gap - barW) / 2;
      const barH = (Math.abs(day.profit) / maxProfit) * chartH;
      const y = day.profit >= 0
        ? pad.top + chartH - barH
        : pad.top + chartH;

      const isPositive = day.profit >= 0;
      const color = isPositive ? '#00B894' : '#FF6B6B';
      const alpha = isPositive ? '4D' : '4D';
      const grad = ctx.createLinearGradient(x, y, x, pad.top + chartH);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + alpha);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
      ctx.fill();

      ctx.fillStyle = ct.axisLabel;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(day.label, x + barW / 2, h - 6);

      if (day.profit !== 0) {
        ctx.fillStyle = ct.dataValue;
        ctx.font = '9px sans-serif';
        ctx.fillText('₱' + Math.abs(day.profit).toFixed(0), x + barW / 2, day.profit >= 0 ? y - 4 : y + barH + 12);
      }
    });
  }
};

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    const r = Array.isArray(radii) ? radii : [radii, radii, radii, radii];
    const [tl, tr, br, bl] = r.map(v => Math.min(v || 0, Math.min(w, h) / 2));
    this.moveTo(x + tl, y); this.lineTo(x + w - tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + tr);
    this.lineTo(x + w, y + h - br); this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    this.lineTo(x + bl, y + h); this.quadraticCurveTo(x, y + h, x, y + h - bl);
    this.lineTo(x, y + tl); this.quadraticCurveTo(x, y, x + tl, y);
    this.closePath(); return this;
  };
}

export default Dashboard;
