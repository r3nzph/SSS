// ===============================
// ANALYTICS — Centralized Statistics Service
// ===============================
// THE single source of truth for ALL dashboard statistics,
// chart data, and report calculations.
//
// Every module (dashboard, reports, storage) MUST use these
// functions instead of duplicating the same calculations.
//
// Available functions:
//   computeAggregateStats(transactions, products)
//   computeOverviewStats(transactions, products)
//   computeInventoryStats(products)
//   computeDailyRevenue(transactions, numDays)
//   computeDailyProfit(transactions, products, numDays)
// ===============================

/**
 * Compute aggregate store statistics (all-time totals).
 * This replaces the old `calculateStats()` in storage.js.
 *
 * @param {Array} transactions — Array of transaction objects
 * @param {Array} products     — Array of product objects
 * @returns {{ totalRevenue: number, totalProfit: number, totalItemsSold: number, totalTransactions: number }}
 */
export function computeAggregateStats(transactions, products) {
  const stats = {
    totalRevenue: 0,
    totalProfit: 0,
    totalItemsSold: 0,
    totalTransactions: (transactions || []).length
  };

  (transactions || []).forEach(tx => {
    stats.totalRevenue += parseFloat(tx.total) || 0;
    if (tx.items) {
      tx.items.forEach(item => {
        const qty = parseFloat(item.qty) || 0;
        stats.totalItemsSold += qty;
        const product = products ? products.find(p => p.id === item.productId) : null;
        const cost = product ? (parseFloat(product.cost) || 0) : 0;
        stats.totalProfit += ((parseFloat(item.price) || 0) - cost) * qty;
      });
    }
  });

  stats.totalRevenue = Math.round(stats.totalRevenue * 100) / 100;
  stats.totalProfit = Math.round(stats.totalProfit * 100) / 100;

  return stats;
}

/**
 * Compute detailed overview statistics for a set of transactions.
 *
 * @param {Array} transactions — Filtered/date-ranged transactions
 * @param {Array} products     — Full product list
 * @returns {{
 *   totalRevenue: number,
 *   totalTransactions: number,
 *   totalItemsSold: number,
 *   avgSaleValue: number,
 *   totalCOGS: number,
 *   grossProfit: number,
 *   margin: string,
 *   activeProducts: number,
 *   lowStockCount: number,
 *   inventoryValue: number
 * }}
 */
export function computeOverviewStats(transactions, products) {
  const txns = transactions || [];
  const prods = products || [];

  const totalRevenue = txns.reduce((s, tx) => s + (parseFloat(tx.total) || 0), 0);
  const totalTransactions = txns.length;
  const totalItemsSold = txns.reduce((s, tx) => {
    return s + (tx.items ? tx.items.reduce((si, item) => si + (parseFloat(item.qty) || 0), 0) : 0);
  }, 0);
  const avgSaleValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  let totalCOGS = 0;
  txns.forEach(tx => {
    if (tx.items) {
      tx.items.forEach(item => {
        const product = prods.find(p => p.id === item.productId);
        const cost = product ? (parseFloat(product.cost) || 0) : 0;
        totalCOGS += cost * (parseFloat(item.qty) || 0);
      });
    }
  });

  const grossProfit = totalRevenue - totalCOGS;
  const margin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  const active = prods.filter(p => !p.archived);
  const lowStockCount = active.filter(p => p.stock <= (p.minStock || 5)).length;
  const inventoryValue = active.reduce((s, p) => s + (parseFloat(p.cost) || 0) * (parseFloat(p.stock) || 0), 0);

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalTransactions,
    totalItemsSold,
    avgSaleValue: Math.round(avgSaleValue * 100) / 100,
    totalCOGS: Math.round(totalCOGS * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    margin,
    activeProducts: active.length,
    lowStockCount,
    inventoryValue: Math.round(inventoryValue * 100) / 100
  };
}

/**
 * Compute inventory statistics from all products.
 *
 * @param {Array} products — Full product list
 * @returns {{ totalProducts: number, totalValue: number, totalCost: number, lowStockCount: number, activeProducts: number }}
 */
export function computeInventoryStats(products) {
  const prods = products || [];
  const active = prods.filter(p => !p.archived);
  return {
    totalProducts: prods.length,
    activeProducts: active.length,
    lowStockCount: active.filter(p => p.stock <= (p.minStock || 5)).length,
    totalValue: Math.round(active.reduce((s, p) => s + (parseFloat(p.price) || 0) * (parseFloat(p.stock) || 0), 0) * 100) / 100,
    totalCost: Math.round(active.reduce((s, p) => s + (parseFloat(p.cost) || 0) * (parseFloat(p.stock) || 0), 0) * 100) / 100
  };
}

/**
 * Group transactions by day and compute daily revenue.
 *
 * @param {Array}  transactions — Transactions to aggregate
 * @param {number} numDays      — Number of days to look back (default 7)
 * @param {Date}   [endDate]    — End date (defaults to today)
 * @returns {Array<{ label: string, total: number }>}
 */
export function computeDailyRevenue(transactions, numDays = 7, endDate) {
  const end = endDate || new Date();
  const days = [];

  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    const dayTotal = (transactions || [])
      .filter(tx => tx.date && tx.date.slice(0, 10) === key)
      .reduce((s, tx) => s + (parseFloat(tx.total) || 0), 0);
    days.push({ label, total: Math.round(dayTotal * 100) / 100 });
  }

  return days;
}

/**
 * Group transactions by day and compute daily profit.
 *
 * Profit per item = (sellingPrice − costPrice) × quantity
 *
 * @param {Array}  transactions — Transactions to aggregate
 * @param {Array}  products     — Product list (for cost lookup)
 * @param {number} numDays      — Number of days to look back (default 7)
 * @param {Date}   [endDate]    — End date (defaults to today)
 * @returns {Array<{ label: string, profit: number, revenue: number }>}
 */
export function computeDailyProfit(transactions, products, numDays = 7, endDate) {
  const end = endDate || new Date();
  const prods = products || [];
  const days = [];

  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en', { weekday: 'short' });
    let dayProfit = 0;
    let dayRevenue = 0;

    (transactions || [])
      .filter(tx => tx.date && tx.date.slice(0, 10) === key)
      .forEach(tx => {
        dayRevenue += parseFloat(tx.total) || 0;
        if (tx.items) {
          tx.items.forEach(item => {
            const product = prods.find(p => p.id === item.productId);
            const cost = product ? (parseFloat(product.cost) || 0) : 0;
            dayProfit += ((parseFloat(item.price) || 0) - cost) * (parseFloat(item.qty) || 0);
          });
        }
      });

    days.push({
      label,
      profit: Math.round(dayProfit * 100) / 100,
      revenue: Math.round(dayRevenue * 100) / 100
    });
  }

  return days;
}
