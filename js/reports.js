// ===============================
// SALES & REPORTS MODULE (Unified)
// 9 tabs: Overview, Transactions, Analytics, Revenue, Profit,
// Inventory Reports, Product Performance, Export, Print
// Charts drawn with Canvas 2D API — no external libs
// Uses ONLY StorageService — no Electron, no Node.js
// ===============================

// Polyfill CanvasRenderingContext2D.roundRect if not available
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    const r = Array.isArray(radii) ? radii : [radii, radii, radii, radii];
    const [tl, tr, br, bl] = r.map(v => Math.min(v || 0, Math.min(w, h) / 2));
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + tr);
    this.lineTo(x + w, y + h - br);
    this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    this.lineTo(x + bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - bl);
    this.lineTo(x, y + tl);
    this.quadraticCurveTo(x, y, x + tl, y);
    this.closePath();
    return this;
  };
}

import Auth from './auth.js';
import Audit from './audit.js';
import UI from './ui.js';
import { escapeHtml, formatCurrency, formatDate, getChartTheme } from './utils.js';
// Import Sales for receipt viewing (used in viewReceipt)
import Sales from './transactions.js';

const SalesReports = {
  // ============================
  // DATE RANGE HELPERS
  // ============================

  _dateRanges: {
    today: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start.getTime() + 86400000);
      return { start: start.toISOString(), end: end.toISOString(), label: 'Today' };
    },
    yesterday: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start: start.toISOString(), end: end.toISOString(), label: 'Yesterday' };
    },
    last7: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 86400000);
      return { start: start.toISOString(), end: end.toISOString(), label: 'Last 7 Days' };
    },
    last30: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 86400000);
      return { start: start.toISOString(), end: end.toISOString(), label: 'Last 30 Days' };
    },
    thisMonth: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start: start.toISOString(), end: end.toISOString(), label: 'This Month' };
    },
    lastMonth: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: start.toISOString(), end: end.toISOString(), label: 'Last Month' };
    },
    thisYear: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear() + 1, 0, 1);
      return { start: start.toISOString(), end: end.toISOString(), label: 'This Year' };
    }
  },

  _currentDateRange: 'thisMonth',
  _customStart: '',
  _customEnd: '',
  _currentTab: 'overview',

  // Transaction audit state
  _auditSearch: '',
  _auditCashierFilter: '',
  _auditPage: 1,
  _auditPageSize: 20,

  // Report search
  _reportSearch: '',

  // Tab definitions
  TABS: [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'transactions', label: 'Transactions', icon: '🧾' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'revenue', label: 'Revenue', icon: '💰' },
    { id: 'profit', label: 'Profit', icon: '📉' },
    { id: 'inventory_reports', label: 'Inventory Reports', icon: '📦' },
    { id: 'product_performance', label: 'Product Performance', icon: '🏆' },
    { id: 'export', label: 'Export', icon: '📤' },
    { id: 'print', label: 'Print', icon: '🖨️' }
  ],

  // ============================
  // MAIN RENDER
  // ============================

  renderAll() {
    this._initChartThemeListener();
    this._renderTabs();
    this._highlightActiveTab();
    this._highlightActiveRange();
    this._renderTabContent();
    this._renderDateFilterBar();
  },

  /** Re-render overview charts when theme changes (fires once) */
  _initChartThemeListener() {
    if (this._chartListenerInit) return;
    this._chartListenerInit = true;
    window.addEventListener('theme-changed', () => {
      const overviewCharts = ['srRevenueChart','srProfitChart','srBestSellingChart','srCategoryChart','srCashierChart'];
      if (overviewCharts.some(id => document.getElementById(id))) {
        this._drawRevenueChart();
        this._drawProfitChart();
        this._drawBestSellingChart();
        this._drawCategoryChart();
        this._drawCashierChart();
      }
    });
  },

  _renderTabs() {
    const container = document.getElementById('srTabs');
    if (!container) return;

    container.innerHTML = this.TABS.map(tab => `
      <button class="btn btn-sm btn-ghost tab-btn ${tab.id === this._currentTab ? 'active' : ''}"
        data-tab="${tab.id}" onclick="SalesReports.switchTab('${tab.id}')">
        ${tab.icon} ${tab.label}
      </button>
    `).join('');
  },

  _highlightActiveTab() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === this._currentTab);
    });
  },

  _highlightActiveRange() {
    document.querySelectorAll('.range-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.range === this._currentDateRange);
    });
  },

  switchTab(tabId) {
    this._currentTab = tabId;
    this._reportSearch = '';
    this.renderAll();
  },

  // ============================
  // DATE RANGE FILTERING
  // ============================

  _renderDateFilterBar() {
    const container = document.getElementById('srFilterBar');
    if (!container) return;

    container.innerHTML = `
      <button class="btn btn-sm btn-ghost range-btn active" data-range="today" onclick="SalesReports.setDateRange('today')">Today</button>
      <button class="btn btn-sm btn-ghost range-btn" data-range="yesterday" onclick="SalesReports.setDateRange('yesterday')">Yesterday</button>
      <button class="btn btn-sm btn-ghost range-btn" data-range="last7" onclick="SalesReports.setDateRange('last7')">7 Days</button>
      <button class="btn btn-sm btn-ghost range-btn" data-range="last30" onclick="SalesReports.setDateRange('last30')">30 Days</button>
      <button class="btn btn-sm btn-ghost range-btn" data-range="thisMonth" onclick="SalesReports.setDateRange('thisMonth')">This Month</button>
      <button class="btn btn-sm btn-ghost range-btn" data-range="lastMonth" onclick="SalesReports.setDateRange('lastMonth')">Last Month</button>
      <button class="btn btn-sm btn-ghost range-btn" data-range="thisYear" onclick="SalesReports.setDateRange('thisYear')">This Year</button>
      <div class="custom-range">
        <input type="date" id="srCustomStart" >
        <span style="color:var(--text-muted);">→</span>
        <input type="date" id="srCustomEnd" >
        <button class="btn btn-sm btn-ghost" onclick="SalesReports.setCustomRange()">Go</button>
      </div>
    `;
    this._highlightActiveRange();
  },

  _getDateRangeStart() {
    if (this._currentDateRange === 'custom') {
      return this._customStart || this._dateRanges.thisMonth().start;
    }
    const range = this._dateRanges[this._currentDateRange];
    return range ? range().start : this._dateRanges.thisMonth().start;
  },

  _getDateRangeEnd() {
    if (this._currentDateRange === 'custom') {
      return this._customEnd || this._dateRanges.thisMonth().end;
    }
    const range = this._dateRanges[this._currentDateRange];
    return range ? range().end : this._dateRanges.thisMonth().end;
  },

  setDateRange(range) {
    this._currentDateRange = range;
    this._auditPage = 1;
    this.renderAll();
  },

  setCustomRange() {
    const startInput = document.getElementById('srCustomStart');
    const endInput = document.getElementById('srCustomEnd');
    if (startInput && endInput && startInput.value && endInput.value) {
      this._customStart = new Date(startInput.value).toISOString();
      this._customEnd = new Date(new Date(endInput.value).getTime() + 86400000).toISOString();
      this._currentDateRange = 'custom';
      this._auditPage = 1;
      this.renderAll();
    } else {
      UI.toast('Please select both start and end dates.', 'warning');
    }
  },

  _getFilteredTransactions() {
    const data = Auth.state.db;
    const all = data.transactions || [];
    const start = this._getDateRangeStart();
    const end = this._getDateRangeEnd();

    return all.filter(tx => {
      const txDate = tx.date || tx.createdAt || '';
      return txDate >= start && txDate < end;
    });
  },

  // ============================
  // TAB CONTENT RENDERING
  // ============================

  _renderTabContent() {
    const container = document.getElementById('srContent');
    if (!container) return;

    switch (this._currentTab) {
      case 'overview': this._renderOverview(container); break;
      case 'transactions': this._renderTransactions(container); break;
      case 'analytics': this._renderAnalytics(container); break;
      case 'revenue': this._renderRevenue(container); break;
      case 'profit': this._renderProfit(container); break;
      case 'inventory_reports': this._renderInventoryReports(container); break;
      case 'product_performance': this._renderProductPerformance(container); break;
      case 'export': this._renderExport(container); break;
      case 'print': this._renderPrint(container); break;
      default: this._renderOverview(container);
    }
  },

  // ============================
  // OVERVIEW TAB (Dashboard KPIs + Charts)
  // ============================

  _renderOverview(container) {
    const data = Auth.state.db;
    const transactions = this._getFilteredTransactions();
    const products = data.products || [];

    // Calculate KPIs
    const totalRevenue = transactions.reduce((s, tx) => s + (tx.total || 0), 0);
    const totalTransactions = transactions.length;
    const totalItemsSold = transactions.reduce((s, tx) => {
      return s + (tx.items ? tx.items.reduce((si, item) => si + (item.qty || 0), 0) : 0);
    }, 0);
    const avgSaleValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    let totalCOGS = 0;
    transactions.forEach(tx => {
      if (tx.items) {
        tx.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          const cost = product ? (product.cost || 0) : 0;
          totalCOGS += cost * (item.qty || 0);
        });
      }
    });

    const grossProfit = totalRevenue - totalCOGS;
    const margin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';

    const activeProducts = products.filter(p => !p.archived).length;
    const lowStockCount = products.filter(p => !p.archived && p.stock <= (p.minStock || 5)).length;
    const inventoryValue = products.reduce((s, p) => s + (p.cost || 0) * p.stock, 0);

    container.innerHTML = `
      <div class="">
        <!-- KPI Cards -->
        <div class="panel-kpi-grid">
          <div class="panel-kpi-card" style="--card-accent:var(--accent-primary);animation-delay:0.03s;">
            <div class="panel-kpi-icon">💰</div>
            <div class="panel-kpi-info">
              <div class="panel-kpi-label">Total Revenue</div>
              <div class="panel-kpi-value">${formatCurrency(totalRevenue)}</div>
              <div class="panel-kpi-sub">${totalTransactions} transactions</div>
            </div>
          </div>
          <div class="panel-kpi-card" style="--card-accent:var(--success);animation-delay:0.06s;">
            <div class="panel-kpi-icon">📈</div>
            <div class="panel-kpi-info">
              <div class="panel-kpi-label">Gross Profit</div>
              <div class="panel-kpi-value">${formatCurrency(grossProfit)}</div>
              <div class="panel-kpi-sub">${margin}% margin</div>
            </div>
          </div>
          <div class="panel-kpi-card" style="--card-accent:var(--info);animation-delay:0.09s;">
            <div class="panel-kpi-icon">📊</div>
            <div class="panel-kpi-info">
              <div class="panel-kpi-label">COGS</div>
              <div class="panel-kpi-value">${formatCurrency(totalCOGS)}</div>
              <div class="panel-kpi-sub">cost of goods sold</div>
            </div>
          </div>
          <div class="panel-kpi-card" style="--card-accent:var(--accent-secondary);animation-delay:0.12s;">
            <div class="panel-kpi-icon">🧾</div>
            <div class="panel-kpi-info">
              <div class="panel-kpi-label">Avg Sale Value</div>
              <div class="panel-kpi-value">${formatCurrency(avgSaleValue)}</div>
              <div class="panel-kpi-sub">per transaction</div>
            </div>
          </div>
          <div class="panel-kpi-card" style="--card-accent:var(--warning);animation-delay:0.15s;">
            <div class="panel-kpi-icon">📦</div>
            <div class="panel-kpi-info">
              <div class="panel-kpi-label">Items Sold</div>
              <div class="panel-kpi-value">${totalItemsSold.toLocaleString()}</div>
              <div class="panel-kpi-sub">${totalTransactions} transactions</div>
            </div>
          </div>
          <div class="panel-kpi-card" style="--card-accent:var(--danger);animation-delay:0.18s;">
            <div class="panel-kpi-icon">📋</div>
            <div class="panel-kpi-info">
              <div class="panel-kpi-label">Inventory Value</div>
              <div class="panel-kpi-value">${formatCurrency(inventoryValue)}</div>
              <div class="panel-kpi-sub">${activeProducts} products (${lowStockCount} low)</div>
            </div>
          </div>
        </div>

        <!-- Charts Row -->
        <div class="panel-charts-row">
          <div class="panel-chart-card">
            <div class="panel-chart-body"><canvas id="srRevenueChart"></canvas></div>
          </div>
          <div class="panel-chart-card">
            <div class="panel-chart-body"><canvas id="srProfitChart"></canvas></div>
          </div>
        </div>
        <div class="panel-charts-row">
          <div class="panel-chart-card">
            <div class="panel-chart-body"><canvas id="srBestSellingChart"></canvas></div>
          </div>
          <div class="panel-chart-card">
            <div class="panel-chart-body"><canvas id="srCategoryChart"></canvas></div>
          </div>
        </div>

        <!-- Financial Summary -->
        <div class="panel-card">
          <h3 class="panel-card-title">💰 Financial Summary</h3>
          <div class="sr-financial-summary">
            <div class="sr-fin-row">
              <div class="sr-fin-item">
                <span class="sr-fin-label">Gross Revenue</span>
                <span class="sr-fin-value">${formatCurrency(totalRevenue)}</span>
              </div>
              <div class="sr-fin-item">
                <span class="sr-fin-label">COGS</span>
                <span class="sr-fin-value" style="color:var(--danger);">−${formatCurrency(totalCOGS)}</span>
              </div>
              <div class="sr-fin-item">
                <span class="sr-fin-label">Gross Profit</span>
                <span class="sr-fin-value" style="color:var(--success);">${formatCurrency(grossProfit)}</span>
              </div>
              <div class="sr-fin-item">
                <span class="sr-fin-label">Margin</span>
                <span class="sr-fin-value">${margin}%</span>
              </div>
            </div>
            <div class="sr-fin-row">
              <div class="sr-fin-item">
                <span class="sr-fin-label">Transactions</span>
                <span class="sr-fin-value">${totalTransactions}</span>
              </div>
              <div class="sr-fin-item">
                <span class="sr-fin-label">Items Sold</span>
                <span class="sr-fin-value">${totalItemsSold}</span>
              </div>
              <div class="sr-fin-item">
                <span class="sr-fin-label">Avg Item Value</span>
                <span class="sr-fin-value">${totalItemsSold > 0 ? formatCurrency(totalRevenue / totalItemsSold) : '₱0.00'}</span>
              </div>
              <div class="sr-fin-item">
                <span class="sr-fin-label">Net Profit</span>
                <span class="sr-fin-value" style="color:var(--success);">${formatCurrency(grossProfit)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Sales by Cashier -->
        <div class="panel-card">
          <h3 class="panel-card-title">👤 Sales by Cashier</h3>
          <div class="panel-chart-card" style="margin-bottom:0;">
            <div class="panel-chart-body"><canvas id="srCashierChart"></canvas></div>
          </div>
        </div>
      </div>
    `;

    // Draw charts after DOM update
    setTimeout(() => {
      this._drawRevenueChart();
      this._drawProfitChart();
      this._drawBestSellingChart();
      this._drawCategoryChart();
      this._drawCashierChart();
    }, 50);
  },

  // ============================
  // CHARTS (pure Canvas 2D — no libraries)
  // ============================

  _getCanvasContext(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.min(rect.width || 380, 500);
    canvas.height = 200;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return ctx;
  },

  _drawRevenueChart() {
    const ctx = this._getCanvasContext('srRevenueChart');
    if (!ctx) return;

    const transactions = this._getFilteredTransactions();
    const ct = getChartTheme();
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const pad = { top: 22, bottom: 26, left: 8, right: 8 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    const days = [];
    const rangeEnd = new Date(this._getDateRangeEnd());
    for (let i = 6; i >= 0; i--) {
      const d = new Date(rangeEnd);
      d.setDate(d.getDate() - i - 1);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
      const dayTotal = transactions
        .filter(tx => (tx.date || '').slice(0, 10) === key)
        .reduce((s, tx) => s + (tx.total || 0), 0);
      days.push({ label, total: dayTotal });
    }

    const max = Math.max(...days.map(d => d.total), 1);
    const barW = chartW / days.length * 0.55;
    const gap = chartW / days.length;

    ctx.fillStyle = ct.chartTitle;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Daily Revenue Trend', pad.left, 14);

    days.forEach((day, i) => {
      const x = pad.left + i * gap + (gap - barW) / 2;
      const barH = (day.total / max) * chartH;
      const y = pad.top + chartH - barH;

      const accentHex = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim() || '#6D5DFC';
      const grad = ctx.createLinearGradient(x, y, x, pad.top + chartH);
      grad.addColorStop(0, accentHex);
      grad.addColorStop(1, accentHex + '26');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
      ctx.fill();

      ctx.fillStyle = ct.axisLabelDim;
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(day.label, x + barW / 2, h - 4);
      if (day.total > 0) {
        ctx.fillStyle = ct.dataValue;
        ctx.font = '7px sans-serif';
        ctx.fillText('₱' + day.total.toFixed(0), x + barW / 2, y - 3);
      }
    });
  },

  _drawProfitChart() {
    const ctx = this._getCanvasContext('srProfitChart');
    if (!ctx) return;

    const transactions = this._getFilteredTransactions();
    const products = (Auth.state.db.products || []);
    const ct = getChartTheme();
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const pad = { top: 22, bottom: 26, left: 8, right: 8 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    const days = [];
    const rangeEnd = new Date(this._getDateRangeEnd());
    for (let i = 6; i >= 0; i--) {
      const d = new Date(rangeEnd);
      d.setDate(d.getDate() - i - 1);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en', { weekday: 'short' });
      let dayProfit = 0, dayRevenue = 0;
      transactions.filter(tx => (tx.date || '').slice(0, 10) === key).forEach(tx => {
        dayRevenue += tx.total || 0;
        if (tx.items) {
          tx.items.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            const cost = product ? (product.cost || 0) : 0;
            dayProfit += ((item.price || 0) - cost) * (item.qty || 0);
          });
        }
      });
      days.push({ label, profit: dayProfit, revenue: dayRevenue });
    }

    const maxVal = Math.max(...days.map(d => Math.max(d.profit, d.revenue)), 1);
    const barW = chartW / days.length * 0.35;
    const gap = chartW / days.length;

    ctx.fillStyle = ct.chartTitle;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Revenue vs Profit', pad.left, 14);

    days.forEach((day, i) => {
      const cx = pad.left + i * gap + gap / 2;

      const revH = (day.revenue / maxVal) * chartH;
      const revX = cx - barW - 1;
      const revY = pad.top + chartH - revH;
      const grad1 = ctx.createLinearGradient(revX, revY, revX, pad.top + chartH);
      const accentHex2 = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim() || '#6D5DFC';
      grad1.addColorStop(0, accentHex2 + 'CC');
      grad1.addColorStop(1, accentHex2 + '26');
      ctx.fillStyle = grad1;
      ctx.beginPath();
      ctx.roundRect(revX, revY, barW, revH, [3, 3, 0, 0]);
      ctx.fill();

      const profitH = (day.profit / maxVal) * chartH;
      const profitX = cx + 1;
      const profitY = pad.top + chartH - profitH;
      const grad2 = ctx.createLinearGradient(profitX, profitY, profitX, pad.top + chartH);
      grad2.addColorStop(0, 'rgba(0,184,148,0.8)');
      grad2.addColorStop(1, 'rgba(0,184,148,0.15)');
      ctx.fillStyle = grad2;
      ctx.beginPath();
      ctx.roundRect(profitX, profitY, barW, profitH, [3, 3, 0, 0]);
      ctx.fill();

      ctx.fillStyle = ct.axisLabelDim;
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(day.label, cx, h - 4);
    });

    // Legend
    const accentRgba = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim() || '#6D5DFC';
    ctx.fillStyle = accentRgba + 'CC';
    ctx.fillRect(w - 130, 8, 10, 10);
    ctx.fillStyle = ct.legendText;
    ctx.font = '8px sans-serif';
    ctx.fillText('Revenue', w - 116, 16);
    ctx.fillStyle = 'rgba(0,184,148,0.8)';
    ctx.fillRect(w - 70, 8, 10, 10);
    ctx.fillText('Profit', w - 56, 16);
  },

  _drawBestSellingChart() {
    const ctx = this._getCanvasContext('srBestSellingChart');
    if (!ctx) return;

    const transactions = this._getFilteredTransactions();
    const ct = getChartTheme();
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const pad = { top: 22, bottom: 16, left: 90, right: 36 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    const productSales = {};
    transactions.forEach(tx => {
      if (tx.items) {
        tx.items.forEach(item => {
          const name = item.name || 'Unknown';
          if (!productSales[name]) productSales[name] = { qty: 0, revenue: 0 };
          productSales[name].qty += item.qty || 0;
          productSales[name].revenue += item.total || 0;
        });
      }
    });

    const sorted = Object.entries(productSales).sort((a, b) => b[1].qty - a[1].qty).slice(0, 8);

    ctx.fillStyle = ct.chartTitle;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Best Selling Products', pad.left, 14);

    if (sorted.length === 0) {
      ctx.fillStyle = ct.emptyText;
      ctx.textAlign = 'center';
      ctx.font = '11px sans-serif';
      ctx.fillText('No sales data', w / 2, h / 2);
      return;
    }

    const maxQty = Math.max(...sorted.map(s => s[1].qty), 1);
    const barH = Math.min(20, chartH / sorted.length - 4);

    sorted.forEach(([name, info], i) => {
      const y = pad.top + i * (barH + 5);
      const barW = (info.qty / maxQty) * chartW;

      ctx.fillStyle = ct.legendText;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      const label = name.length > 12 ? name.slice(0, 11) + '\u2026' : name;
      ctx.fillText(label, pad.left - 6, y + barH / 2 + 3.5);

      const hue = 180 - i * 18;
      const grad = ctx.createLinearGradient(pad.left, 0, pad.left + chartW, 0);
      grad.addColorStop(0, `hsla(${hue}, 75%, 55%, 0.85)`);
      grad.addColorStop(1, `hsla(${hue}, 75%, 55%, 0.2)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(pad.left, y, barW, barH, [0, 3, 3, 0]);
      ctx.fill();

      ctx.fillStyle = ct.dataValueBold;
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(info.qty + ' sold', pad.left + barW + 5, y + barH / 2 + 3.5);
    });
  },

  _drawCategoryChart() {
    const ctx = this._getCanvasContext('srCategoryChart');
    if (!ctx) return;

    const data = Auth.state.db;
    const products = data.products || [];
    const transactions = this._getFilteredTransactions();
    const ct = getChartTheme();
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const pad = { top: 22, bottom: 16, left: 90, right: 36 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    const categorySales = {};
    transactions.forEach(tx => {
      if (tx.items) {
        tx.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          const cat = product ? (product.category || 'Uncategorized') : 'Uncategorized';
          if (!categorySales[cat]) categorySales[cat] = { qty: 0, revenue: 0 };
          categorySales[cat].qty += item.qty || 0;
          categorySales[cat].revenue += item.total || 0;
        });
      }
    });

    const sorted = Object.entries(categorySales).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6);

    ctx.fillStyle = ct.chartTitle;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Categories by Revenue', pad.left, 14);

    if (sorted.length === 0) {
      ctx.fillStyle = ct.emptyText;
      ctx.textAlign = 'center';
      ctx.font = '11px sans-serif';
      ctx.fillText('No category data', w / 2, h / 2);
      return;
    }

    const maxRev = Math.max(...sorted.map(s => s[1].revenue), 1);
    const barH = Math.min(24, chartH / sorted.length - 4);

    sorted.forEach(([cat, info], i) => {
      const y = pad.top + i * (barH + 5);
      const barW = (info.revenue / maxRev) * chartW;
      ctx.fillStyle = ct.legendText;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      const label = cat.length > 12 ? cat.slice(0, 11) + '\u2026' : cat;
      ctx.fillText(label, pad.left - 6, y + barH / 2 + 3.5);

      const hue = 280 - i * 30;
      const grad = ctx.createLinearGradient(pad.left, 0, pad.left + chartW, 0);
      grad.addColorStop(0, `hsla(${hue}, 65%, 60%, 0.85)`);
      grad.addColorStop(1, `hsla(${hue}, 65%, 60%, 0.2)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(pad.left, y, barW, barH, [0, 3, 3, 0]);
      ctx.fill();

      ctx.fillStyle = ct.dataValueBold;
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(formatCurrency(info.revenue), pad.left + barW + 5, y + barH / 2 + 3.5);
    });
  },

  _drawCashierChart() {
    const ctx = this._getCanvasContext('srCashierChart');
    if (!ctx) return;

    const transactions = this._getFilteredTransactions();
    const ct = getChartTheme();
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const pad = { top: 22, bottom: 16, left: 90, right: 36 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    const cashierMap = {};
    transactions.forEach(tx => {
      const name = tx.cashier || 'Unknown';
      if (!cashierMap[name]) cashierMap[name] = { count: 0, revenue: 0 };
      cashierMap[name].count++;
      cashierMap[name].revenue += tx.total || 0;
    });

    const sorted = Object.entries(cashierMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6);

    ctx.fillStyle = ct.chartTitle;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Sales by Cashier', pad.left, 14);

    if (sorted.length === 0) {
      ctx.fillStyle = ct.emptyText;
      ctx.textAlign = 'center';
      ctx.font = '11px sans-serif';
      ctx.fillText('No cashier data', w / 2, h / 2);
      return;
    }

    const maxRev = Math.max(...sorted.map(s => s[1].revenue), 1);
    const barH = Math.min(26, chartH / sorted.length - 5);

    sorted.forEach(([name, info], i) => {
      const y = pad.top + i * (barH + 6);
      const barW = (info.revenue / maxRev) * chartW;
      ctx.fillStyle = ct.legendText;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      const label = name.length > 12 ? name.slice(0, 11) + '\u2026' : name;
      ctx.fillText(label, pad.left - 6, y + barH / 2 + 3.5);

      const hue = 40 + i * 25;
      const grad = ctx.createLinearGradient(pad.left, 0, pad.left + chartW, 0);
      grad.addColorStop(0, `hsla(${hue}, 80%, 55%, 0.85)`);
      grad.addColorStop(1, `hsla(${hue}, 80%, 55%, 0.2)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(pad.left, y, barW, barH, [0, 3, 3, 0]);
      ctx.fill();

      ctx.fillStyle = ct.dataValueBold;
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(formatCurrency(info.revenue) + ` (${info.count} tx)`, pad.left + barW + 5, y + barH / 2 + 3.5);
    });
  },

  // ============================
  // TRANSACTIONS TAB
  // ============================

  _renderTransactions(container) {
    const data = Auth.state.db;
    const transactions = this._getFilteredTransactions();

    // Apply search filters
    let filtered = [...transactions];
    if (this._auditSearch) {
      const q = this._auditSearch.toLowerCase();
      filtered = filtered.filter(tx =>
        (tx.id || '').toLowerCase().includes(q) ||
        (tx.cashier || '').toLowerCase().includes(q) ||
        (tx.items || []).some(i => (i.name || '').toLowerCase().includes(q))
      );
    }
    if (this._auditCashierFilter) {
      filtered = filtered.filter(tx =>
        (tx.cashier || '').toLowerCase() === this._auditCashierFilter.toLowerCase()
      );
    }

    // Paginate
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / this._auditPageSize) || 1;
    if (this._auditPage > totalPages) this._auditPage = totalPages;
    const start = (this._auditPage - 1) * this._auditPageSize;
    const pageItems = [...filtered].reverse().slice(start, start + this._auditPageSize);

    container.innerHTML = `
      <div class="panel-card" style="margin-bottom:0;">
        <h3 class="panel-card-title">🧾 Transaction Audit</h3>
        <div class="panel-toolbar">
          <div class="inv-search-wrap">
            <input type="text" id="srTxSearch" placeholder="Search by receipt#, cashier, or product..."
              oninput="SalesReports.setSearch(this.value)" class="inv-search-input" value="${escapeHtml(this._auditSearch)}">
          </div>
          <input type="text" id="srCashierFilter" placeholder="Filter by cashier..."
            oninput="SalesReports.setCashierFilter(this.value)" class="inv-search-input" style="max-width:180px;" value="${escapeHtml(this._auditCashierFilter)}">
          <span id="srAuditSummary" class="panel-summary">${totalItems > 0 ? `Showing ${start + 1}–${Math.min(start + this._auditPageSize, totalItems)} of ${totalItems} transactions` : 'No transactions found'}</span>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr><th>Receipt #</th><th>Date</th><th>Items</th><th>Qty</th><th>Total</th><th>Cashier</th><th style="width:40px;"></th></tr>
            </thead>
            <tbody id="srTransactionBody"></tbody>
          </table>
        </div>
        <div class="inv-footer">
          <div id="srAuditPagination" class="inv-pagination"></div>
        </div>
      </div>
    `;

    // Render transaction rows
    const tbody = document.getElementById('srTransactionBody');
    if (!tbody) return;

    if (pageItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px;">No transactions match your criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = pageItems.map(tx => {
      const itemsList = tx.items
        ? tx.items.map(i => `${escapeHtml(i.name)} x${i.qty}`).join(', ')
        : 'N/A';
      const qty = tx.items ? tx.items.reduce((s, i) => s + i.qty, 0) : 0;
      return `
        <tr class="row-clickable" onclick="SalesReports.viewReceipt('${tx.id}')" title="Click to view receipt">
          <td style="font-size:0.8rem;font-family:monospace;">${escapeHtml((tx.id || '').slice(0, 10))}</td>
          <td>${escapeHtml(formatDate(tx.date))}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(itemsList)}">${itemsList}</td>
          <td>${qty}</td>
          <td class="price-cell">${formatCurrency(tx.total)}</td>
          <td>${escapeHtml(tx.cashier || '—')}</td>
          <td><button class="btn btn-icon btn-sm" onclick="event.stopPropagation();SalesReports.viewReceipt('${tx.id}')" title="View receipt">🧾</button></td>
        </tr>
      `;
    }).join('');

    // Render pagination
    this._renderAuditPagination(totalItems, totalPages);
  },

  setSearch(value) {
    this._auditSearch = value;
    this._auditPage = 1;
    this.renderAll();
  },

  setCashierFilter(value) {
    this._auditCashierFilter = value;
    this._auditPage = 1;
    this.renderAll();
  },

  setAuditPage(page) {
    this._auditPage = page;
    this.renderAll();
  },

  _renderAuditPagination(totalItems, totalPages) {
    const container = document.getElementById('srAuditPagination');
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    const p = this._auditPage;
    let html = `<button class="btn btn-icon btn-sm" onclick="SalesReports.setAuditPage(${p - 1})" ${p <= 1 ? 'disabled' : ''}>‹</button>`;
    const maxVisible = 5;
    let startPage = Math.max(1, p - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);
    if (startPage > 1) {
      html += `<button class="btn btn-icon btn-sm" onclick="SalesReports.setAuditPage(1)">1</button>`;
      if (startPage > 2) html += `<span class="inv-pg-ellipsis">…</span>`;
    }
    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="btn btn-icon btn-sm ${i === p ? 'btn-primary' : 'btn-ghost'}" onclick="SalesReports.setAuditPage(${i})">${i}</button>`;
    }
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<span class="inv-pg-ellipsis">…</span>`;
      html += `<button class="btn btn-icon btn-sm" onclick="SalesReports.setAuditPage(${totalPages})">${totalPages}</button>`;
    }
    html += `<button class="btn btn-icon btn-sm" onclick="SalesReports.setAuditPage(${p + 1})" ${p >= totalPages ? 'disabled' : ''}>›</button>`;
    container.innerHTML = html;
  },

  viewReceipt(transactionId) {
    const data = Auth.state.db;
    const tx = data.transactions.find(t => t.id === transactionId);
    if (!tx) { UI.toast('Transaction not found.', 'error'); return; }
    try {
      Sales.showReceipt(tx);
    } catch (e) {
      UI.toast('Receipt view unavailable.', 'warning');
    }
  },

  // ============================
  // ANALYTICS TAB
  // ============================

  _renderAnalytics(container) {
    const data = Auth.state.db;
    const transactions = this._getFilteredTransactions();
    const products = data.products || [];

    // Top 10 products
    const productSales = {};
    transactions.forEach(tx => {
      if (tx.items) {
        tx.items.forEach(item => {
          const name = item.name || 'Unknown';
          if (!productSales[name]) productSales[name] = { qty: 0, revenue: 0, profit: 0 };
          productSales[name].qty += item.qty || 0;
          productSales[name].revenue += item.total || 0;
          const product = products.find(p => p.id === item.productId);
          const cost = product ? (product.cost || 0) : 0;
          productSales[name].profit += ((item.price || 0) - cost) * (item.qty || 0);
        });
      }
    });

    const sortedProducts = Object.entries(productSales).sort((a, b) => b[1].qty - a[1].qty).slice(0, 10);

    // Inventory insights
    const productSalesMap = {};
    transactions.forEach(tx => {
      if (tx.items) {
        tx.items.forEach(item => {
          if (!productSalesMap[item.productId]) productSalesMap[item.productId] = 0;
          productSalesMap[item.productId] += item.qty || 0;
        });
      }
    });
    const active = products.filter(p => !p.archived);
    const outOfStock = active.filter(p => p.stock <= 0);
    const lowStock = active.filter(p => p.stock > 0 && p.stock <= (p.minStock || 5));
    const slowMoving = active.filter(p => (productSalesMap[p.id] || 0) <= 0 && p.stock > 0);

    const categoryRev = {};
    transactions.forEach(tx => {
      if (tx.items) {
        tx.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          const cat = product ? (product.category || 'Uncategorized') : 'Uncategorized';
          if (!categoryRev[cat]) categoryRev[cat] = 0;
          categoryRev[cat] += item.total || 0;
        });
      }
    });
    const topCategory = Object.entries(categoryRev).sort((a, b) => b[1] - a[1])[0];

    let topProfit = { name: '—', profit: 0 };
    transactions.forEach(tx => {
      if (tx.items) {
        tx.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            const profit = ((item.price || 0) - (product.cost || 0)) * (item.qty || 0);
            if (profit > topProfit.profit) topProfit = { name: item.name, profit };
          }
        });
      }
    });

    const topCategoryHtml = topCategory
      ? `<strong>${escapeHtml(topCategory[0])}</strong> — ${formatCurrency(topCategory[1])}`
      : '<span style="color:var(--text-muted);">No data</span>';

    container.innerHTML = `
      <div class="panel-card">
        <h3 class="panel-card-title">🏆 Top 10 Best Selling Products</h3>
        <div class="table-container">
          <table class="">
            <thead><tr><th>#</th><th>Product</th><th>Sold</th><th>Revenue</th><th>Profit</th></tr></thead>
            <tbody>
              ${sortedProducts.length > 0
                ? sortedProducts.map(([name, info], i) => `
                    <tr>
                      <td style="color:var(--text-muted);">${i + 1}</td>
                      <td><strong>${escapeHtml(name)}</strong></td>
                      <td>${info.qty}</td>
                      <td class="price-cell">${formatCurrency(info.revenue)}</td>
                      <td class="price-cell" style="color:${info.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(info.profit)}</td>
                    </tr>
                  `).join('')
                : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">No sales data in this period.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel-card">
        <h3 class="panel-card-title">📊 Inventory Insights</h3>
        <div class="panel-analytics-grid">
          <div class="panel-analytics-card">
            <div class="panel-analytics-card-icon">🏆</div>
            <div class="panel-analytics-card-label">Top Category</div>
            <div class="panel-analytics-card-value">${topCategoryHtml}</div>
          </div>
          <div class="panel-analytics-card">
            <div class="panel-analytics-card-icon">💎</div>
            <div class="panel-analytics-card-label">Highest Profit Product</div>
            <div class="panel-analytics-card-value"><strong>${escapeHtml(topProfit.name)}</strong> — ${formatCurrency(topProfit.profit)}</div>
          </div>
          <div class="panel-analytics-card">
            <div class="panel-analytics-card-icon">🚫</div>
            <div class="panel-analytics-card-label">Out of Stock</div>
            <div class="panel-analytics-card-value" style="color:var(--danger);font-size:1.3rem;">${outOfStock.length}</div>
            <div class="panel-analytics-card-sub">products need restocking</div>
          </div>
          <div class="panel-analytics-card">
            <div class="panel-analytics-card-icon">⚠️</div>
            <div class="panel-analytics-card-label">Low Stock</div>
            <div class="panel-analytics-card-value" style="color:var(--warning);font-size:1.3rem;">${lowStock.length}</div>
            <div class="panel-analytics-card-sub">products below minimum</div>
          </div>
          <div class="panel-analytics-card">
            <div class="panel-analytics-card-icon">🐌</div>
            <div class="panel-analytics-card-label">Slow Moving</div>
            <div class="panel-analytics-card-value" style="color:var(--info);font-size:1.3rem;">${slowMoving.length}</div>
            <div class="panel-analytics-card-sub">products with no sales</div>
          </div>
          <div class="panel-analytics-card">
            <div class="panel-analytics-card-icon">📊</div>
            <div class="panel-analytics-card-label">Total Products</div>
            <div class="panel-analytics-card-value" style="color:var(--accent-secondary);font-size:1.3rem;">${active.length}</div>
            <div class="panel-analytics-card-sub">active in inventory</div>
          </div>
        </div>
      </div>
    `;
  },

  // ============================
  // REVENUE TAB
  // ============================

  _renderRevenue(container) {
    const data = Auth.state.db;
    const transactions = this._getFilteredTransactions();
    const products = data.products || [];

    // Monthly grouping
    const byMonth = {};
    transactions.forEach(tx => {
      const month = tx.date ? tx.date.slice(0, 7) : 'unknown';
      if (!byMonth[month]) byMonth[month] = { count: 0, revenue: 0, profit: 0, items: 0 };
      byMonth[month].count++;
      byMonth[month].revenue += tx.total || 0;
      if (tx.items) {
        tx.items.forEach(item => {
          byMonth[month].items += item.qty || 0;
          const product = products.find(p => p.id === item.productId);
          const cost = product ? (product.cost || 0) : 0;
          byMonth[month].profit += ((item.price || 0) - cost) * (item.qty || 0);
        });
      }
    });

    const totalRevenue = transactions.reduce((s, tx) => s + (tx.total || 0), 0);
    const totalTransactions = transactions.length;
    const totalItems = transactions.reduce((s, tx) => s + (tx.items ? tx.items.reduce((si, i) => si + (i.qty || 0), 0) : 0), 0);

    container.innerHTML = `
      <div class="panel-card">
        <h3 class="panel-card-title">💰 Revenue Overview</h3>
        <div class="panel-kpi-grid" style="margin-bottom:16px;">
          <div class="panel-kpi-card" style="--card-accent:var(--accent-primary);">
            <div class="panel-kpi-icon">💰</div>
            <div class="panel-kpi-info">
              <div class="panel-kpi-label">Total Revenue</div>
              <div class="panel-kpi-value">${formatCurrency(totalRevenue)}</div>
              <div class="panel-kpi-sub">all time</div>
            </div>
          </div>
          <div class="panel-kpi-card" style="--card-accent:var(--success);">
            <div class="panel-kpi-icon">🧾</div>
            <div class="panel-kpi-info">
              <div class="panel-kpi-label">Transactions</div>
              <div class="panel-kpi-value">${totalTransactions}</div>
              <div class="panel-kpi-sub">in this period</div>
            </div>
          </div>
          <div class="panel-kpi-card" style="--card-accent:var(--info);">
            <div class="panel-kpi-icon">📦</div>
            <div class="panel-kpi-info">
              <div class="panel-kpi-label">Items Sold</div>
              <div class="panel-kpi-value">${totalItems}</div>
              <div class="panel-kpi-sub">units</div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel-card">
        <h3 class="panel-card-title">📊 Monthly Sales Summary</h3>
        <div class="table-container">
          <table>
            <thead><tr><th>Month</th><th>Transactions</th><th>Items</th><th>Revenue</th><th>Profit</th><th>Margin</th></tr></thead>
            <tbody>
              ${Object.entries(byMonth).length > 0
                ? Object.entries(byMonth).reverse().map(([month, m]) => {
                    const margin = m.revenue > 0 ? (m.profit / m.revenue * 100).toFixed(1) + '%' : '0%';
                    return `
                      <tr>
                        <td>${month}</td>
                        <td>${m.count}</td>
                        <td>${m.items}</td>
                        <td class="price-cell">${formatCurrency(m.revenue)}</td>
                        <td class="price-cell">${formatCurrency(m.profit)}</td>
                        <td class="price-cell">${margin}</td>
                      </tr>
                    `;
                  }).join('')
                : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;">No transactions recorded.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ============================
  // PROFIT TAB
  // ============================

  _renderProfit(container) {
    const data = Auth.state.db;
    const transactions = this._getFilteredTransactions();
    const products = data.products || [];
    const adjustments = (data.stockAdjustments || []).filter(a => {
      const aDate = a.createdAt || '';
      const start = this._getDateRangeStart();
      const end = this._getDateRangeEnd();
      return aDate >= start && aDate < end;
    });

    const grossRevenue = transactions.reduce((s, tx) => s + (tx.total || 0), 0);
    const totalTx = transactions.length;
    const totalItems = transactions.reduce((s, tx) => s + (tx.items ? tx.items.reduce((si, i) => si + (i.qty || 0), 0) : 0), 0);

    let totalCOGS = 0;
    transactions.forEach(tx => {
      if (tx.items) {
        tx.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          const cost = product ? (product.cost || 0) : 0;
          totalCOGS += cost * (item.qty || 0);
        });
      }
    });

    const grossProfit = grossRevenue - totalCOGS;
    const grossMargin = grossRevenue > 0 ? (grossProfit / grossRevenue * 100).toFixed(1) : '0.0';
    const inventoryValue = products.reduce((s, p) => s + (p.cost || 0) * p.stock, 0);
    const inventoryValueAtSell = products.reduce((s, p) => s + p.price * p.stock, 0);

    container.innerHTML = `
      <div class="panel-card">
        <h3 class="panel-card-title">📈 Profit & Loss Statement</h3>
        <div class="sr-pnl">
          <div class="sr-pnl-section">
            <h4 style="color:var(--success);margin-bottom:8px;">💰 Revenue</h4>
            <div class="sr-pnl-row"><span>Gross Revenue</span><span class="price-cell">${formatCurrency(grossRevenue)}</span></div>
            <div class="sr-pnl-row"><span>Total Transactions</span><span>${totalTx}</span></div>
            <div class="sr-pnl-row"><span>Total Items Sold</span><span>${totalItems}</span></div>
            <div class="sr-pnl-row"><span>Avg Sale Value</span><span class="price-cell">${totalTx > 0 ? formatCurrency(grossRevenue / totalTx) : '₱0.00'}</span></div>
          </div>

          <div class="sr-pnl-section">
            <h4 style="color:var(--danger);margin-bottom:8px;">📉 Cost of Goods Sold</h4>
            <div class="sr-pnl-row"><span>COGS</span><span class="price-cell" style="color:var(--danger);">−${formatCurrency(totalCOGS)}</span></div>
            <div class="sr-pnl-row" style="border-top:1px solid var(--border-glass);padding-top:8px;margin-top:6px;">
              <span style="font-weight:600;">Gross Profit</span>
              <span class="price-cell" style="color:var(--success);font-weight:700;font-size:1.05rem;">${formatCurrency(grossProfit)}</span>
            </div>
            <div class="sr-pnl-row"><span>Gross Margin</span><span style="color:var(--accent-secondary);">${grossMargin}%</span></div>
          </div>

          <div class="sr-pnl-section">
            <h4 style="color:var(--info);margin-bottom:8px;">📊 Adjustments & Inventory</h4>
            <div class="sr-pnl-row"><span>Adjustments (this period)</span><span>${adjustments.length}</span></div>
            <div class="sr-pnl-row"><span>Inventory Value (at cost)</span><span class="price-cell">${formatCurrency(inventoryValue)}</span></div>
            <div class="sr-pnl-row"><span>Inventory Value (at sell)</span><span class="price-cell">${formatCurrency(inventoryValueAtSell)}</span></div>
            <div class="sr-pnl-row"><span>Potential Profit</span><span class="price-cell" style="color:var(--success);">${formatCurrency(inventoryValueAtSell - inventoryValue)}</span></div>
          </div>

          <div class="sr-pnl-section" style="background:var(--bg-glass-strong);border-radius:var(--radius-md);padding:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:700;font-size:1.1rem;">Net Profit</span>
              <span class="price-cell" style="font-weight:700;font-size:1.2rem;color:var(--success);">${formatCurrency(grossProfit)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ============================
  // INVENTORY REPORTS TAB (9 sub-reports)
  // ============================

  _renderInventoryReports(container) {
    const data = Auth.state.db;
    const products = (data.products || []).filter(p => !p.archived);
    const transactions = this._getFilteredTransactions();

    let selectedReport = this._currentReportSubTab || 'inventory';

    container.innerHTML = `
      <div class="report-selector">
        <button class="btn btn-sm btn-ghost report-btn ${selectedReport === 'inventory' ? 'active' : ''}" data-report="inventory" onclick="SalesReports._setReportSubTab('inventory')">📦 Inventory</button>
        <button class="btn btn-sm btn-ghost report-btn ${selectedReport === 'lowstock' ? 'active' : ''}" data-report="lowstock" onclick="SalesReports._setReportSubTab('lowstock')">⚠️ Low Stock</button>
        <button class="btn btn-sm btn-ghost report-btn ${selectedReport === 'outofstock' ? 'active' : ''}" data-report="outofstock" onclick="SalesReports._setReportSubTab('outofstock')">🚫 Out of Stock</button>
        <button class="btn btn-sm btn-ghost report-btn ${selectedReport === 'recently_added' ? 'active' : ''}" data-report="recently_added" onclick="SalesReports._setReportSubTab('recently_added')">🆕 Recent</button>
        <button class="btn btn-sm btn-ghost report-btn ${selectedReport === 'purchase_orders' ? 'active' : ''}" data-report="purchase_orders" onclick="SalesReports._setReportSubTab('purchase_orders')">📥 PO</button>
        <button class="btn btn-sm btn-ghost report-btn ${selectedReport === 'receiving' ? 'active' : ''}" data-report="receiving" onclick="SalesReports._setReportSubTab('receiving')">📤 Receiving</button>
        <button class="btn btn-sm btn-ghost report-btn ${selectedReport === 'adjustments' ? 'active' : ''}" data-report="adjustments" onclick="SalesReports._setReportSubTab('adjustments')">🔧 Adjustments</button>
        <button class="btn btn-sm btn-ghost report-btn ${selectedReport === 'suppliers' ? 'active' : ''}" data-report="suppliers" onclick="SalesReports._setReportSubTab('suppliers')">🏭 Suppliers</button>
        <button class="btn btn-sm btn-ghost report-btn ${selectedReport === 'cashier_performance' ? 'active' : ''}" data-report="cashier_performance" onclick="SalesReports._setReportSubTab('cashier_performance')">👤 Cashier</button>
      </div>

      <div class="panel-toolbar">
        <div class="inv-search-wrap" style="flex:1;">
          <input type="text" id="srReportSearch" placeholder="Search in report..."
            oninput="SalesReports._setReportSearch(this.value)" class="inv-search-input">
        </div>
        <button class="btn btn-sm btn-ghost" onclick="SalesReports._exportCSV()">📄 CSV</button>
        <button class="btn btn-sm btn-primary" onclick="SalesReports._exportJSON()">📦 JSON</button>
      </div>

      <div class="" id="srReportContent"></div>
    `;

    this._renderReportContent(selectedReport);
  },

  _currentReportSubTab: 'inventory',

  _setReportSubTab(reportId) {
    this._currentReportSubTab = reportId;
    this.renderAll();
  },

  _setReportSearch(value) {
    this._reportSearch = value;
    this._renderReportContent(this._currentReportSubTab);
  },

  _renderReportContent(reportId) {
    const container = document.getElementById('srReportContent');
    if (!container) return;

    const reportMap = {
      'inventory': this._renderInvReport.bind(this),
      'lowstock': this._renderLowStockReport.bind(this),
      'outofstock': this._renderOutOfStockReport.bind(this),
      'recently_added': this._renderRecentlyAddedReport.bind(this),
      'purchase_orders': this._renderPOReport.bind(this),
      'receiving': this._renderReceivingReport.bind(this),
      'adjustments': this._renderAdjustmentReport.bind(this),
      'suppliers': this._renderSupplierReport.bind(this),
      'cashier_performance': this._renderCashierPerfReport.bind(this)
    };

    const renderFn = reportMap[reportId] || this._renderInvReport.bind(this);
    renderFn(container);
  },

  _renderInvReport(container) {
    const data = Auth.state.db;
    const products = (data.products || []).filter(p => !p.archived);
    let filtered = [...products];
    if (this._reportSearch) {
      const q = this._reportSearch.toLowerCase();
      filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
    }
    if (filtered.length === 0) {
      container.innerHTML = '<div class="panel-empty">No products found.</div>'; return;
    }
    const totalValue = filtered.reduce((s, p) => s + p.price * p.stock, 0);
    const totalCost = filtered.reduce((s, p) => s + (p.cost || 0) * p.stock, 0);
    container.innerHTML = `
      <div class="panel-summary">${filtered.length} products — Value: ${formatCurrency(totalValue)} — Cost: ${formatCurrency(totalCost)}</div>
      <table class="">
        <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Cost</th><th>Stock</th><th>Value</th><th>Profit Potential</th></tr></thead>
        <tbody>${filtered.map(p => `<tr><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.category || '—')}</td><td class="price-cell">${formatCurrency(p.price)}</td><td class="price-cell">${formatCurrency(p.cost || 0)}</td><td>${p.stock}</td><td class="price-cell">${formatCurrency(p.price * p.stock)}</td><td class="price-cell">${formatCurrency((p.price - (p.cost || 0)) * p.stock)}</td></tr>`).join('')}</tbody>
      </table>`;
  },

  _renderLowStockReport(container) {
    let products = (Auth.state.db.products || []).filter(p => !p.archived && p.stock > 0 && p.stock <= (p.minStock || 5));
    if (this._reportSearch) products = products.filter(p => (p.name || '').toLowerCase().includes(this._reportSearch.toLowerCase()));
    if (products.length === 0) { container.innerHTML = '<div class="panel-empty">✅ All items well-stocked.</div>'; return; }
    container.innerHTML = `
      <div class="panel-summary">${products.length} low stock products</div>
      <table class=""><thead><tr><th>Name</th><th>Category</th><th>Stock</th><th>Min Level</th></tr></thead>
      <tbody>${products.map(p => `<tr><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.category || '—')}</td><td class="stock-low">${p.stock}</td><td>${p.minStock || 5}</td></tr>`).join('')}</tbody></table>`;
  },

  _renderOutOfStockReport(container) {
    let products = (Auth.state.db.products || []).filter(p => !p.archived && p.stock <= 0);
    if (this._reportSearch) products = products.filter(p => (p.name || '').toLowerCase().includes(this._reportSearch.toLowerCase()));
    if (products.length === 0) { container.innerHTML = '<div class="panel-empty">✅ No out of stock items.</div>'; return; }
    container.innerHTML = `
      <div class="panel-summary">${products.length} out of stock products</div>
      <table class=""><thead><tr><th>Name</th><th>Category</th><th>Last Updated</th></tr></thead>
      <tbody>${products.map(p => `<tr><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.category || '—')}</td><td>${p.lastUpdated ? escapeHtml(formatDate(p.lastUpdated)) : '—'}</td></tr>`).join('')}</tbody></table>`;
  },

  _renderRecentlyAddedReport(container) {
    let sorted = [...(Auth.state.db.products || []).filter(p => !p.archived)].sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
    if (this._reportSearch) sorted = sorted.filter(p => (p.name || '').toLowerCase().includes(this._reportSearch.toLowerCase()));
    if (sorted.length === 0) { container.innerHTML = '<div class="panel-empty">No recently added products.</div>'; return; }
    container.innerHTML = `
      <div class="panel-summary">${sorted.length} products — Newest first</div>
      <table class=""><thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Date Added</th></tr></thead>
      <tbody>${sorted.slice(0, 50).map(p => `<tr><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.category || '—')}</td><td class="price-cell">${formatCurrency(p.price)}</td><td>${p.stock}</td><td>${p.dateAdded ? escapeHtml(formatDate(p.dateAdded)) : '—'}</td></tr>`).join('')}</tbody></table>`;
  },

  _renderPOReport(container) {
    const data = Auth.state.db;
    const start = this._getDateRangeStart(), end = this._getDateRangeEnd();
    let pos = (data.purchaseOrders || []).filter(po => (po.createdAt || '') >= start && (po.createdAt || '') < end);
    if (this._reportSearch) pos = pos.filter(po => (po.poNumber || '').toLowerCase().includes(this._reportSearch.toLowerCase()) || (po.supplierName || '').toLowerCase().includes(this._reportSearch.toLowerCase()));
    pos.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    if (pos.length === 0) { container.innerHTML = '<div class="panel-empty">No purchase orders in this period.</div>'; return; }
    container.innerHTML = `
      <div class="panel-summary">${pos.length} purchase orders</div>
      <table class=""><thead><tr><th>PO #</th><th>Supplier</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
      <tbody>${pos.map(po => `<tr><td><strong>${escapeHtml(po.poNumber || po.id)}</strong></td><td>${escapeHtml(po.supplierName || '—')}</td><td>${po.items ? po.items.reduce((s,i) => s+i.qty,0) : 0}</td><td class="price-cell">${formatCurrency(po.total || 0)}</td><td>${escapeHtml(po.status || 'draft')}</td><td>${escapeHtml(formatDate(po.createdAt))}</td></tr>`).join('')}</tbody></table>`;
  },

  _renderReceivingReport(container) {
    const data = Auth.state.db;
    const start = this._getDateRangeStart(), end = this._getDateRangeEnd();
    let receives = (data.receivingTransactions || []).filter(r => (r.createdAt || '') >= start && (r.createdAt || '') < end);
    if (this._reportSearch) receives = receives.filter(r => (r.recNumber || '').toLowerCase().includes(this._reportSearch.toLowerCase()) || (r.supplierName || '').toLowerCase().includes(this._reportSearch.toLowerCase()));
    receives.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    if (receives.length === 0) { container.innerHTML = '<div class="panel-empty">No receiving transactions.</div>'; return; }
    container.innerHTML = `
      <div class="panel-summary">${receives.length} receiving transactions</div>
      <table class=""><thead><tr><th>Receipt #</th><th>PO #</th><th>Supplier</th><th>Items</th><th>Total Cost</th><th>Date</th></tr></thead>
      <tbody>${receives.map(r => `<tr><td><strong>${escapeHtml(r.recNumber)}</strong></td><td>${escapeHtml(r.poNumber)}</td><td>${escapeHtml(r.supplierName)}</td><td>${r.items ? r.items.reduce((s,i) => s+i.receivedQty,0) : 0}</td><td class="price-cell">${formatCurrency(r.totalCost || 0)}</td><td>${escapeHtml(formatDate(r.createdAt))}</td></tr>`).join('')}</tbody></table>`;
  },

  _renderAdjustmentReport(container) {
    const data = Auth.state.db;
    const start = this._getDateRangeStart(), end = this._getDateRangeEnd();
    let adjustments = (data.stockAdjustments || []).filter(a => (a.createdAt || '') >= start && (a.createdAt || '') < end);
    if (this._reportSearch) adjustments = adjustments.filter(a => (a.productName || '').toLowerCase().includes(this._reportSearch.toLowerCase()) || (a.adjustmentTypeLabel || a.adjustmentType || '').toLowerCase().includes(this._reportSearch.toLowerCase()));
    adjustments.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    if (adjustments.length === 0) { container.innerHTML = '<div class="panel-empty">No stock adjustments.</div>'; return; }
    container.innerHTML = `
      <div class="panel-summary">${adjustments.length} adjustments</div>
      <table class=""><thead><tr><th>Adj #</th><th>Product</th><th>Old</th><th>New</th><th>Diff</th><th>Type</th><th>Reason</th><th>By</th></tr></thead>
      <tbody>${adjustments.map(a => { const diff = a.difference || (a.newStock - (a.oldStock || a.previousStock || 0)); return `<tr><td style="font-size:0.8rem;">${escapeHtml(a.adjNumber || (a.id || '').slice(0, 8))}</td><td>${escapeHtml(a.productName)}</td><td>${a.oldStock || a.previousStock || 0}</td><td><strong>${a.newStock}</strong></td><td style="color:${diff >= 0 ? 'var(--success)' : 'var(--danger)'}">${diff > 0 ? '+' : ''}${diff}</td><td>${escapeHtml(a.adjustmentTypeLabel || a.adjustmentType || '—')}</td><td>${escapeHtml(a.reason || '—')}</td><td>${escapeHtml(a.user)}</td></tr>`; }).join('')}</tbody></table>`;
  },

  _renderSupplierReport(container) {
    const data = Auth.state.db;
    let suppliers = (data.suppliers || []).filter(s => !s.archived);
    const products = data.products || [];
    if (this._reportSearch) suppliers = suppliers.filter(s => (s.companyName || s.name || '').toLowerCase().includes(this._reportSearch.toLowerCase()));
    if (suppliers.length === 0) { container.innerHTML = '<div class="panel-empty">No suppliers found.</div>'; return; }
    container.innerHTML = `
      <div class="panel-summary">${suppliers.length} suppliers</div>
      <table class=""><thead><tr><th>Company</th><th>Contact</th><th>Phone</th><th>Email</th><th>Products</th><th>Status</th></tr></thead>
      <tbody>${suppliers.map(s => { const pc = products.filter(p => p.supplier === (s.companyName || s.name)).length; return `<tr><td><strong>${escapeHtml(s.companyName || s.name)}</strong></td><td>${escapeHtml(s.contactPerson || s.contact || '—')}</td><td>${escapeHtml(s.phone || '—')}</td><td>${escapeHtml(s.email || '—')}</td><td>${pc}</td><td>${escapeHtml(s.status || 'active')}</td></tr>`; }).join('')}</tbody></table>`;
  },

  _renderCashierPerfReport(container) {
    const transactions = this._getFilteredTransactions();
    const cashierMap = {};
    transactions.forEach(tx => {
      const name = tx.cashier || 'Unknown';
      if (!cashierMap[name]) cashierMap[name] = { txCount: 0, revenue: 0, items: 0 };
      cashierMap[name].txCount++;
      cashierMap[name].revenue += tx.total || 0;
      if (tx.items) tx.items.forEach(item => { cashierMap[name].items += item.qty || 0; });
    });
    let entries = Object.entries(cashierMap);
    if (this._reportSearch) entries = entries.filter(([name]) => name.toLowerCase().includes(this._reportSearch.toLowerCase()));
    entries.sort((a, b) => b[1].revenue - a[1].revenue);
    if (entries.length === 0) { container.innerHTML = '<div class="panel-empty">No cashier data.</div>'; return; }
    const totalRevenue = entries.reduce((s, [, info]) => s + info.revenue, 0);
    container.innerHTML = `
      <div class="panel-summary">${entries.length} cashiers — Total: ${formatCurrency(totalRevenue)}</div>
      <table class=""><thead><tr><th>Cashier</th><th>Transactions</th><th>Items Sold</th><th>Revenue</th><th>Avg/Transaction</th><th>Share</th></tr></thead>
      <tbody>${entries.map(([name, info]) => { const avg = info.txCount > 0 ? info.revenue / info.txCount : 0; const share = totalRevenue > 0 ? (info.revenue / totalRevenue * 100).toFixed(1) : 0; return `<tr><td><strong>${escapeHtml(name)}</strong></td><td>${info.txCount}</td><td>${info.items}</td><td class="price-cell">${formatCurrency(info.revenue)}</td><td class="price-cell">${formatCurrency(avg)}</td><td>${share}%</td></tr>`; }).join('')}</tbody></table>`;
  },

  // ============================
  // PRODUCT PERFORMANCE TAB
  // ============================

  _renderProductPerformance(container) {
    const data = Auth.state.db;
    const transactions = this._getFilteredTransactions();
    const products = data.products || [];

    const perfMap = {};
    transactions.forEach(tx => {
      if (tx.items) {
        tx.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          const name = item.name || 'Unknown';
          if (!perfMap[name]) perfMap[name] = { qty: 0, revenue: 0, profit: 0, cost: 0 };
          perfMap[name].qty += item.qty || 0;
          perfMap[name].revenue += item.total || 0;
          const cost = product ? (product.cost || 0) : 0;
          perfMap[name].cost += cost * (item.qty || 0);
          perfMap[name].profit += ((item.price || 0) - cost) * (item.qty || 0);
        });
      }
    });

    let entries = Object.entries(perfMap);
    if (this._reportSearch) {
      const q = this._reportSearch.toLowerCase();
      entries = entries.filter(([name]) => name.toLowerCase().includes(q));
    }
    entries.sort((a, b) => b[1].qty - a[1].qty);

    container.innerHTML = `
      <div class="panel-card">
        <h3 class="panel-card-title">🏆 Product Performance</h3>
        <div class="panel-toolbar" style="margin-bottom:12px;">
          <div class="inv-search-wrap" style="flex:1;">
            <input type="text" placeholder="Search products..." oninput="SalesReports._setReportSearch(this.value)" class="inv-search-input">
          </div>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>#</th><th>Product</th><th>Units Sold</th><th>Revenue</th><th>Profit</th><th>Margin</th></tr></thead>
            <tbody>
              ${entries.length > 0
                ? entries.map(([name, info], i) => {
                    const margin = info.revenue > 0 ? (info.profit / info.revenue * 100).toFixed(1) + '%' : '0%';
                    return `
                      <tr>
                        <td style="color:var(--text-muted);">${i + 1}</td>
                        <td><strong>${escapeHtml(name)}</strong></td>
                        <td>${info.qty}</td>
                        <td class="price-cell">${formatCurrency(info.revenue)}</td>
                        <td class="price-cell" style="color:${info.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(info.profit)}</td>
                        <td class="price-cell">${margin}</td>
                      </tr>
                    `;
                  }).join('')
                : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;">No performance data.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ============================
  // EXPORT TAB
  // ============================

  _renderExport(container) {
    const transactions = this._getFilteredTransactions();

    container.innerHTML = `
      <div class="panel-card">
        <h3 class="panel-card-title">📤 Export Data</h3>
        <p style="color:var(--text-secondary);margin-bottom:16px;">Export your sales and report data in various formats. Choose a report type and format below.</p>

        <div class="sr-export-options">
          <div class="sr-export-card">
            <div class="sr-export-icon">📄</div>
            <h4>Export Sales CSV</h4>
            <p>Download all transactions in this period as a CSV file. Includes receipt #, date, items, quantities, totals, and cashier.</p>
            <button class="btn btn-primary btn-sm" onclick="SalesReports._exportCSV()">📄 Export CSV</button>
          </div>

          <div class="sr-export-card">
            <div class="sr-export-icon">📦</div>
            <h4>Export JSON</h4>
            <p>Export full sales data including financial summaries as JSON for backup or external processing.</p>
            <button class="btn btn-success btn-sm" onclick="SalesReports._exportJSON()">📦 Export JSON</button>
          </div>

          <div class="sr-export-card">
            <div class="sr-export-icon">🖨️</div>
            <h4>Print Report</h4>
            <p>Generate a print-friendly report for this period. Opens in a new window with formatted data.</p>
            <button class="btn btn-ghost btn-sm" onclick="SalesReports._printReport()">🖨️ Print Report</button>
          </div>
        </div>
      </div>

      <div class="panel-card">
        <h3 class="panel-card-title">📊 Export Inventory CSV</h3>
        <p style="color:var(--text-secondary);margin-bottom:12px;">Export full inventory report with product names, prices, costs, stock levels, and valuations.</p>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost btn-sm" onclick="SalesReports._exportInventoryCSV()">📄 Export Inventory CSV</button>
          <button class="btn btn-ghost btn-sm" onclick="SalesReports._exportPOsCSV()">📥 Export POs CSV</button>
          <button class="btn btn-ghost btn-sm" onclick="SalesReports._exportAdjustmentsCSV()">🔧 Export Adjustments CSV</button>
        </div>
      </div>

      <div class="panel-card">
        <h3 class="panel-card-title">📈 Monthly Sales Summary</h3>
        <div class="table-container">
          <table>
            <thead><tr><th>Month</th><th>Transactions</th><th>Items</th><th>Revenue</th><th>Profit</th><th>Margin</th></tr></thead>
            <tbody id="srMonthlySalesBody"></tbody>
          </table>
        </div>
      </div>

      <div class="panel-card">
        <h3 class="panel-card-title">📋 Inventory Valuation</h3>
        <div class="table-container">
          <table>
            <thead><tr><th>Product</th><th>Price</th><th>Cost</th><th>Stock</th><th>Value</th><th>Potential Profit</th></tr></thead>
            <tbody id="srInventoryValuationBody"></tbody>
          </table>
        </div>
      </div>
    `;

    // Populate monthly sales table
    this._renderExportMonthlySales();
    // Populate inventory valuation table
    this._renderExportInventoryValuation();
  },

  _renderExportMonthlySales() {
    const tbody = document.getElementById('srMonthlySalesBody');
    if (!tbody) return;
    const data = Auth.state.db;
    const transactions = this._getFilteredTransactions();
    const products = data.products || [];

    const byMonth = {};
    transactions.forEach(tx => {
      const month = tx.date ? tx.date.slice(0, 7) : 'unknown';
      if (!byMonth[month]) byMonth[month] = { count: 0, revenue: 0, profit: 0, items: 0 };
      byMonth[month].count++;
      byMonth[month].revenue += tx.total || 0;
      if (tx.items) {
        tx.items.forEach(item => {
          byMonth[month].items += item.qty || 0;
          const product = products.find(p => p.id === item.productId);
          const cost = product ? (product.cost || 0) : 0;
          byMonth[month].profit += ((item.price || 0) - cost) * (item.qty || 0);
        });
      }
    });

    if (Object.keys(byMonth).length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;">No data.</td></tr>';
      return;
    }

    tbody.innerHTML = Object.entries(byMonth).reverse().map(([month, m]) => {
      const margin = m.revenue > 0 ? (m.profit / m.revenue * 100).toFixed(1) + '%' : '0%';
      return `<tr><td>${month}</td><td>${m.count}</td><td>${m.items}</td><td class="price-cell">${formatCurrency(m.revenue)}</td><td class="price-cell">${formatCurrency(m.profit)}</td><td class="price-cell">${margin}</td></tr>`;
    }).join('');
  },

  _renderExportInventoryValuation() {
    const tbody = document.getElementById('srInventoryValuationBody');
    if (!tbody) return;
    const products = (Auth.state.db.products || []).filter(p => !p.archived);
    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;">No products.</td></tr>';
      return;
    }
    tbody.innerHTML = products.slice(0, 50).map(p => `
      <tr>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td class="price-cell">${formatCurrency(p.price)}</td>
        <td class="price-cell">${formatCurrency(p.cost || 0)}</td>
        <td>${p.stock}</td>
        <td class="price-cell">${formatCurrency(p.price * p.stock)}</td>
        <td class="price-cell">${formatCurrency((p.price - (p.cost || 0)) * p.stock)}</td>
      </tr>
    `).join('');
  },

  // ============================
  // PRINT TAB
  // ============================

  _renderPrint(container) {
    const transactions = this._getFilteredTransactions();
    const data = Auth.state.db;
    const products = data.products || [];

    const totalRevenue = transactions.reduce((s, tx) => s + (tx.total || 0), 0);
    const totalTx = transactions.length;
    const totalItems = transactions.reduce((s, tx) => s + (tx.items ? tx.items.reduce((si, i) => si + (i.qty || 0), 0) : 0), 0);

    let totalCOGS = 0;
    transactions.forEach(tx => {
      if (tx.items) {
        tx.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          const cost = product ? (product.cost || 0) : 0;
          totalCOGS += cost * (item.qty || 0);
        });
      }
    });
    const grossProfit = totalRevenue - totalCOGS;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue * 100).toFixed(1) : '0.0';

    container.innerHTML = `
      <div class="panel-card">
        <h3 class="panel-card-title">🖨️ Print Reports</h3>
        <p style="color:var(--text-secondary);margin-bottom:16px;">Generate print-friendly reports for the current date range. Opens in a new window with formatted data ready for printing.</p>

        <div class="sr-export-options">
          <div class="sr-export-card">
            <div class="sr-export-icon">📊</div>
            <h4>Sales Report</h4>
            <p>Complete sales report with KPIs, financial summary, and transaction list for ${this._currentDateRange.toUpperCase()}.</p>
            <button class="btn btn-ghost btn-sm" onclick="SalesReports._printReport()">🖨️ Print Sales Report</button>
          </div>

          <div class="sr-export-card">
            <div class="sr-export-icon">📦</div>
            <h4>Inventory Report</h4>
            <p>Full inventory valuation report with product details, prices, costs, and stock levels.</p>
            <button class="btn btn-ghost btn-sm" onclick="SalesReports._printInventoryReport()">🖨️ Print Inventory</button>
          </div>

          <div class="sr-export-card">
            <div class="sr-export-icon">📈</div>
            <h4>Profit & Loss Report</h4>
            <p>P&L statement for this period with gross profit, COGS, margin analysis, and inventory values.</p>
            <button class="btn btn-ghost btn-sm" onclick="SalesReports._printPnLReport()">🖨️ Print P&L</button>
          </div>
        </div>

        <div style="margin-top:16px;background:var(--bg-glass);border-radius:var(--radius-md);padding:14px;text-align:center;">
          <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">Report Period: <strong>${this._currentDateRange.toUpperCase()}</strong></div>
          <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">Date Range: ${formatDate(this._getDateRangeStart())} — ${formatDate(this._getDateRangeEnd())}</div>
          <div style="display:flex;justify-content:center;gap:24px;flex-wrap:wrap;">
            <span>Revenue: <strong class="price-cell">${formatCurrency(totalRevenue)}</strong></span>
            <span>Transactions: <strong>${totalTx}</strong></span>
            <span>Items Sold: <strong>${totalItems}</strong></span>
            <span>Gross Profit: <strong class="price-cell" style="color:var(--success);">${formatCurrency(grossProfit)}</strong></span>
          </div>
        </div>
      </div>
    `;
  },

  // ============================
  // CSV EXPORTS
  // ============================

  _exportCSV() {
    const transactions = this._getFilteredTransactions();
    if (transactions.length === 0) { UI.toast('No transactions to export.', 'warning'); return; }
    let csv = 'Receipt #,Date,Cashier,Items,Qty,Total\n';
    transactions.forEach(tx => {
      const items = tx.items ? tx.items.map(i => i.name).join('; ') : '';
      const qty = tx.items ? tx.items.reduce((s, i) => s + i.qty, 0) : 0;
      csv += `"${tx.id}","${tx.date}","${tx.cashier || ''}","${items}",${qty},${tx.total || 0}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sales_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    UI.toast(`Exported ${transactions.length} transactions.`, 'success');
  },

  _exportJSON() {
    const data = Auth.state.db;
    const transactions = this._getFilteredTransactions();
    const products = data.products || [];
    let cogs = 0;
    transactions.forEach(tx => {
      if (tx.items) tx.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        cogs += (product ? (product.cost || 0) : 0) * (item.qty || 0);
      });
    });

    const exportData = {
      exportDate: new Date().toISOString(),
      dateRange: this._currentDateRange,
      periodStart: this._getDateRangeStart(),
      periodEnd: this._getDateRangeEnd(),
      summary: {
        totalRevenue: transactions.reduce((s, tx) => s + (tx.total || 0), 0),
        totalTransactions: transactions.length,
        totalCOGS: cogs,
        grossProfit: transactions.reduce((s, tx) => s + (tx.total || 0), 0) - cogs
      },
      transactions: transactions,
      transactionCount: transactions.length
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sales_data_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    UI.toast('JSON export complete.', 'success');
  },

  _exportInventoryCSV() {
    const products = (Auth.state.db.products || []).filter(p => !p.archived);
    if (products.length === 0) { UI.toast('No products to export.', 'warning'); return; }
    let csv = 'Name,Category,Price,Cost,Stock,Min Stock,Value,Profit Potential\n';
    products.forEach(p => {
      csv += `"${p.name}","${p.category || ''}",${p.price},${p.cost || 0},${p.stock},${p.minStock || 5},${p.price * p.stock},${(p.price - (p.cost || 0)) * p.stock}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    UI.toast(`Exported ${products.length} products.`, 'success');
  },

  _exportPOsCSV() {
    const pos = (Auth.state.db.purchaseOrders || []).filter(po => {
      const poDate = po.createdAt || '';
      return poDate >= this._getDateRangeStart() && poDate < this._getDateRangeEnd();
    });
    if (pos.length === 0) { UI.toast('No POs to export.', 'warning'); return; }
    let csv = 'PO #,Supplier,Items,Total,Status,Date\n';
    pos.forEach(po => {
      csv += `"${po.poNumber || po.id}","${po.supplierName || ''}",${po.items ? po.items.reduce((s,i) => s+i.qty,0) : 0},${po.total || 0},"${po.status || 'draft'}","${po.createdAt || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `purchase_orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    UI.toast(`Exported ${pos.length} POs.`, 'success');
  },

  _exportAdjustmentsCSV() {
    const adjustments = (Auth.state.db.stockAdjustments || []).filter(a => {
      const aDate = a.createdAt || '';
      return aDate >= this._getDateRangeStart() && aDate < this._getDateRangeEnd();
    });
    if (adjustments.length === 0) { UI.toast('No adjustments to export.', 'warning'); return; }
    let csv = 'Product,Old Stock,New Stock,Difference,Type,Reason,User,Date\n';
    adjustments.forEach(a => {
      const diff = a.difference || (a.newStock - (a.oldStock || a.previousStock || 0));
      csv += `"${a.productName}",${a.oldStock || a.previousStock || 0},${a.newStock},${diff},"${a.adjustmentTypeLabel || a.adjustmentType || ''}","${a.reason || ''}","${a.user}","${a.createdAt || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `adjustments_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    UI.toast(`Exported ${adjustments.length} adjustments.`, 'success');
  },

  // ============================
  // PRINT FUNCTIONS
  // ============================

  _printReport() {
    const transactions = this._getFilteredTransactions();
    const data = Auth.state.db;
    const products = data.products || [];

    const totalRevenue = transactions.reduce((s, tx) => s + (tx.total || 0), 0);
    const totalTx = transactions.length;
    const totalItems = transactions.reduce((s, tx) => s + (tx.items ? tx.items.reduce((si, i) => si + (i.qty || 0), 0) : 0), 0);

    let totalCOGS = 0;
    transactions.forEach(tx => {
      if (tx.items) {
        tx.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          const cost = product ? (product.cost || 0) : 0;
          totalCOGS += cost * (item.qty || 0);
        });
      }
    });
    const grossProfit = totalRevenue - totalCOGS;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
      <html><head><title>Sales Report</title>
      <style>
        body { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; padding: 30px; color: #222; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
        th { background: #6D5DFC; color: #fff; padding: 8px 10px; text-align: left; }
        td { padding: 6px 10px; border-bottom: 1px solid #eee; }
        .total-row td { font-weight: bold; border-top: 2px solid #333; }
        .summary { display: flex; gap: 20px; margin-bottom: 20px; }
        .summary-item { background: #f5f5f5; padding: 12px 16px; border-radius: 6px; }
        .summary-item .value { font-size: 18px; font-weight: bold; }
        .summary-item .label { font-size: 11px; color: #666; }
      </style></head><body>
      <h1>🧾 Sales Report</h1>
      <div class="meta">Period: ${this._currentDateRange.toUpperCase()} (${formatDate(this._getDateRangeStart())} — ${formatDate(this._getDateRangeEnd())})</div>
      <div class="summary">
        <div class="summary-item"><div class="value">${formatCurrency(totalRevenue)}</div><div class="label">Total Revenue</div></div>
        <div class="summary-item"><div class="value">${totalTx}</div><div class="label">Transactions</div></div>
        <div class="summary-item"><div class="value">${totalItems}</div><div class="label">Items Sold</div></div>
        <div class="summary-item"><div class="value">${formatCurrency(grossProfit)}</div><div class="label">Gross Profit</div></div>
      </div>
      <table>
        <thead><tr><th>Receipt #</th><th>Date</th><th>Items</th><th>Qty</th><th>Total</th><th>Cashier</th></tr></thead>
        <tbody>${transactions.slice(0, 100).map(tx => {
          const items = tx.items ? tx.items.map(i => `${i.name} x${i.qty}`).join(', ') : '';
          const qty = tx.items ? tx.items.reduce((s, i) => s + i.qty, 0) : 0;
          return `<tr><td>${tx.id}</td><td>${formatDate(tx.date)}</td><td>${items}</td><td>${qty}</td><td>${formatCurrency(tx.total)}</td><td>${tx.cashier || '—'}</td></tr>`;
        }).join('')}</tbody>
      </table>
      <div class="meta" style="margin-top:20px;">Generated on ${new Date().toLocaleString()} | ${transactions.length} transactions shown (max 100)</div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  },

  _printInventoryReport() {
    const products = (Auth.state.db.products || []).filter(p => !p.archived);
    const totalValue = products.reduce((s, p) => s + p.price * p.stock, 0);
    const totalCost = products.reduce((s, p) => s + (p.cost || 0) * p.stock, 0);

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
      <html><head><title>Inventory Report</title>
      <style>
        body { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; padding: 30px; color: #222; }
        h1 { font-size: 20px; }
        .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #6D5DFC; color: #fff; padding: 8px 10px; text-align: left; }
        td { padding: 6px 10px; border-bottom: 1px solid #eee; }
        .summary { display: flex; gap: 20px; margin-bottom: 20px; }
        .summary-item { background: #f5f5f5; padding: 12px 16px; border-radius: 6px; }
        .summary-item .value { font-size: 18px; font-weight: bold; }
        .summary-item .label { font-size: 11px; color: #666; }
      </style></head><body>
      <h1>📦 Inventory Report</h1>
      <div class="meta">Generated on ${new Date().toLocaleString()} | ${products.length} products</div>
      <div class="summary">
        <div class="summary-item"><div class="value">${products.length}</div><div class="label">Products</div></div>
        <div class="summary-item"><div class="value">${formatCurrency(totalValue)}</div><div class="label">Total Value</div></div>
        <div class="summary-item"><div class="value">${formatCurrency(totalCost)}</div><div class="label">Total Cost</div></div>
        <div class="summary-item"><div class="value">${formatCurrency(totalValue - totalCost)}</div><div class="label">Potential Profit</div></div>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Cost</th><th>Stock</th><th>Value</th></tr></thead>
        <tbody>${products.slice(0, 200).map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category || '—')}</td><td>${formatCurrency(p.price)}</td><td>${formatCurrency(p.cost || 0)}</td><td>${p.stock}</td><td>${formatCurrency(p.price * p.stock)}</td></tr>`).join('')}</tbody>
      </table>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  },

  _printPnLReport() {
    const transactions = this._getFilteredTransactions();
    const data = Auth.state.db;
    const products = data.products || [];

    const grossRevenue = transactions.reduce((s, tx) => s + (tx.total || 0), 0);
    const totalTx = transactions.length;
    const totalItems = transactions.reduce((s, tx) => s + (tx.items ? tx.items.reduce((si, i) => si + (i.qty || 0), 0) : 0), 0);

    let totalCOGS = 0;
    transactions.forEach(tx => {
      if (tx.items) tx.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        totalCOGS += (product ? (product.cost || 0) : 0) * (item.qty || 0);
      });
    });
    const grossProfit = grossRevenue - totalCOGS;
    const grossMargin = grossRevenue > 0 ? (grossProfit / grossRevenue * 100).toFixed(1) : '0.0';

    const printWindow = window.open('', '_blank', 'width=600,height=500');
    printWindow.document.write(`
      <html><head><title>Profit & Loss</title>
      <style>
        body { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; padding: 30px; color: #222; }
        h1 { font-size: 20px; }
        .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
        .pnl-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px; }
        .pnl-row.total { font-weight: bold; border-top: 2px solid #333; border-bottom: none; padding-top: 10px; font-size: 15px; }
        .section { margin-bottom: 16px; }
        .section h3 { font-size: 14px; margin-bottom: 6px; }
      </style></head><body>
      <h1>📈 Profit & Loss Statement</h1>
      <div class="meta">Period: ${this._currentDateRange.toUpperCase()} (${formatDate(this._getDateRangeStart())} — ${formatDate(this._getDateRangeEnd())})</div>
      <div class="section">
        <h3>💰 Revenue</h3>
        <div class="pnl-row"><span>Gross Revenue</span><span>${formatCurrency(grossRevenue)}</span></div>
        <div class="pnl-row"><span>Total Transactions</span><span>${totalTx}</span></div>
        <div class="pnl-row"><span>Total Items Sold</span><span>${totalItems}</span></div>
      </div>
      <div class="section">
        <h3>📉 Cost of Goods Sold</h3>
        <div class="pnl-row"><span>COGS</span><span>${formatCurrency(totalCOGS)}</span></div>
      </div>
      <div class="section">
        <div class="pnl-row total"><span>Gross Profit</span><span>${formatCurrency(grossProfit)}</span></div>
        <div class="pnl-row"><span>Gross Margin</span><span>${grossMargin}%</span></div>
      </div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  }
};

export default SalesReports;
