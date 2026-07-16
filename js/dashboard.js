// ===============================
// DASHBOARD MODULE — KPI cards + Canvas charts
// ===============================

import Auth from './auth.js';
import { formatCurrency } from './utils.js';

const Dashboard = {
  _charts: [],

  renderDashboard() { this.renderKPI(); this.renderCharts(); },

  renderKPI() {
    const el = document.getElementById('kpiContainer');
    if (!el) return;
    const data = Auth.state.db;
    if (!data || !data.stats) return;
    const s = data.stats;
    const products = data.products || [];
    const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
    const lowStock = products.filter(p => p.stock <= (p.minStock || 5)).length;

    el.innerHTML = `
      <div class="kpi-card" style="--kpi-color: var(--accent-primary); animation-delay: 0.05s;">
        <div class="kpi-icon">💰</div>
        <div class="kpi-info">
          <div class="kpi-label">Total Revenue</div>
          <div class="kpi-value">${formatCurrency(s.totalRevenue || 0)}</div>
          <div class="kpi-trend up">▲ Since inception</div>
        </div>
      </div>
      <div class="kpi-card" style="--kpi-color: var(--success); animation-delay: 0.10s;">
        <div class="kpi-icon">📈</div>
        <div class="kpi-info">
          <div class="kpi-label">Total Profit</div>
          <div class="kpi-value">${formatCurrency(s.totalProfit || 0)}</div>
          <div class="kpi-trend up">▲ ${s.totalRevenue ? Math.round(s.totalProfit / s.totalRevenue * 100) : 0}% margin</div>
        </div>
      </div>
      <div class="kpi-card" style="--kpi-color: var(--info); animation-delay: 0.15s;">
        <div class="kpi-icon">📦</div>
        <div class="kpi-info">
          <div class="kpi-label">Items Sold</div>
          <div class="kpi-value">${(s.totalItemsSold || 0).toLocaleString()}</div>
          <div class="kpi-trend up">▲ ${(s.totalTransactions || 0).toLocaleString()} transactions</div>
        </div>
      </div>
      <div class="kpi-card" style="--kpi-color: var(--warning); animation-delay: 0.20s;">
        <div class="kpi-icon">⚠️</div>
        <div class="kpi-info">
          <div class="kpi-label">Low Stock Items</div>
          <div class="kpi-value">${lowStock}</div>
          <div class="kpi-trend ${lowStock > 0 ? 'down' : 'up'}">${lowStock > 0 ? '▼ Needs attention' : '▲ All stocked'}</div>
        </div>
      </div>
      <div class="kpi-card" style="--kpi-color: var(--accent-secondary); animation-delay: 0.25s;">
        <div class="kpi-icon">🏷️</div>
        <div class="kpi-info">
          <div class="kpi-label">Products</div>
          <div class="kpi-value">${products.length}</div>
          <div class="kpi-trend up">▲ ${formatCurrency(totalValue)} total value</div>
        </div>
      </div>
      <div class="kpi-card" style="--kpi-color: var(--success); animation-delay: 0.30s;">
        <div class="kpi-icon">🧾</div>
        <div class="kpi-info">
          <div class="kpi-label">Avg. Sale</div>
          <div class="kpi-value">${s.totalTransactions ? formatCurrency(s.totalRevenue / s.totalTransactions) : '₱0.00'}</div>
          <div class="kpi-trend up">▲ Per transaction</div>
        </div>
      </div>`;
  },

  renderCharts() { this.renderSalesChart(); this.renderTopProductsChart(); },

  renderSalesChart() {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width || 400;
    canvas.height = 220;
    const data = Auth.state.db;
    const transactions = data.transactions || [];
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en', { weekday: 'short' });
      const dayTotal = transactions.filter(tx => tx.date && tx.date.slice(0, 10) === key).reduce((sum, tx) => sum + (tx.total || 0), 0);
      days.push({ label, total: dayTotal });
    }
    const max = Math.max(...days.map(d => d.total), 1);
    const w = canvas.width, h = canvas.height, pad = { top: 20, bottom: 30, left: 10, right: 10 };
    const chartW = w - pad.left - pad.right, chartH = h - pad.top - pad.bottom;
    const barW = chartW / days.length * 0.6, gap = chartW / days.length;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Sales (7 days)', pad.left, 14);
    days.forEach((day, i) => {
      const x = pad.left + i * gap + (gap - barW) / 2;
      const barH = (day.total / max) * chartH;
      const y = pad.top + chartH - barH;
      const grad = ctx.createLinearGradient(x, y, x, pad.top + chartH);
      grad.addColorStop(0, '#6c5ce7'); grad.addColorStop(1, 'rgba(108,92,231,0.3)');
      ctx.fillStyle = grad; ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(day.label, x + barW / 2, h - 6);
      if (day.total > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '9px sans-serif';
        ctx.fillText('₱' + day.total.toFixed(0), x + barW / 2, y - 4);
      }
    });
  },

  renderTopProductsChart() {
    const canvas = document.getElementById('topProductsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width || 400;
    canvas.height = 220;
    const data = Auth.state.db;
    const transactions = data.transactions || [];
    const productSales = {};
    transactions.forEach(tx => { if (tx.items) tx.items.forEach(item => {
      if (!productSales[item.name]) productSales[item.name] = { qty: 0, total: 0 };
      productSales[item.name].qty += item.qty || 0;
      productSales[item.name].total += item.total || 0;
    });});
    const sorted = Object.entries(productSales).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
    const w = canvas.width, h = canvas.height, pad = { top: 20, bottom: 20, left: 100, right: 40 };
    const chartW = w - pad.left - pad.right, chartH = h - pad.top - pad.bottom;
    const barH = Math.min(28, chartH / Math.max(sorted.length, 1) - 6);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Top Products', pad.left, 14);
    if (sorted.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.textAlign = 'center';
      ctx.fillText('No sales data yet', w / 2, h / 2); return;
    }
    const maxQty = Math.max(...sorted.map(s => s[1].qty), 1);
    sorted.forEach(([name, info], i) => {
      const y = pad.top + i * (barH + 8);
      const barW = (info.qty / maxQty) * chartW;
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
      const label = name.length > 12 ? name.slice(0, 12) + '...' : name;
      ctx.fillText(label, pad.left - 8, y + barH / 2 + 4);
      const grad = ctx.createLinearGradient(pad.left, 0, pad.left + chartW, 0);
      const hue = 260 - i * 30;
      grad.addColorStop(0, `hsla(${hue}, 70%, 60%, 0.9)`); grad.addColorStop(1, `hsla(${hue}, 70%, 60%, 0.3)`);
      ctx.fillStyle = grad; ctx.beginPath();
      ctx.roundRect(pad.left, y, barW, barH, [0, 4, 4, 0]); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(info.qty + ' sold', pad.left + barW + 6, y + barH / 2 + 4);
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
