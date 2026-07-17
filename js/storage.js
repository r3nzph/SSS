// ===============================
// STORAGE SERVICE — Centralized CRUD API
//
// Every module must use only these methods:
//   StorageService.save(collection, doc)
//   StorageService.load(collection, id?)
//   StorageService.update(collection, id, changes)
//   StorageService.delete(collection, id)
//   StorageService.init()
//
// The underlying adapter (localStorage) can be swapped for Firebase
// without changing any other file.
// ===============================

import { StorageAdapter } from './storage-adapter.js';

// ===============================
// INTERNAL — password hashing (only used during init)
// ===============================

async function _hashPassword(password) {
  try {
    const salt = 'sarisari-pos-salt-';
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    console.error('[Storage] Password hashing failed, using fallback:', e);
    // Fallback: simple hash when crypto is unavailable (e.g., non-HTTPS)
    let hash = 0;
    const str = 'sarisari-pos-salt-' + (password || '');
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

/**
 * Verify a password against a hash. Useful for auth modules.
 */
async function verifyPassword(password, hash) {
  const result = await _hashPassword(password);
  return result === hash;
}

/**
 * Hash a password. Useful for auth/user modules.
 */
async function hashPassword(password) {
  return _hashPassword(password);
}

// ===============================
// INTERNAL — default data blueprint
// ===============================

function getDefaultData() {
  return {
    users: [
      { id: 'u1', username: 'admin', role: 'admin', createdAt: new Date().toISOString(),
        fullName: 'Administrator', email: '', contactNumber: '', status: 'active',
        lastLogin: null, createdBy: 'system', loginAttempts: 0, lockedUntil: null,
        forcePasswordChange: false, profilePicture: '',
        permissions: { dashboard: true, inventory: true, suppliers: true, purchaseOrders: true,
          stockReceiving: true, stockAdjustment: true, salesAudit: true, reports: true,
          userManagement: true, settings: true, cashierPOS: true, backup: true,
          restore: true, deleteRecords: true, exportReports: true } },
      { id: 'u2', username: 'cashier', role: 'cashier', createdAt: new Date().toISOString(),
        fullName: 'Cashier', email: '', contactNumber: '', status: 'active',
        lastLogin: null, createdBy: 'system', loginAttempts: 0, lockedUntil: null,
        forcePasswordChange: false, profilePicture: '',
        permissions: { dashboard: false, inventory: false, suppliers: false, purchaseOrders: false,
          stockReceiving: false, stockAdjustment: false, salesAudit: false, reports: false,
          userManagement: false, settings: false, cashierPOS: true, backup: false,
          restore: false, deleteRecords: false, exportReports: false } }
    ],
    products: [
      { id: '1', name: 'Coke Mismo', price: 20, stock: 50, cost: 12, barcode: '', category: 'Beverages',
        brand: 'Coca-Cola', supplier: '', minStock: 10, unit: 'bottle', description: '', image: '',
        dateAdded: new Date().toISOString(), lastUpdated: new Date().toISOString(), archived: false },
      { id: '2', name: 'Lucky Me Canton', price: 18, stock: 30, cost: 10, barcode: '', category: 'Noodles',
        brand: 'Lucky Me', supplier: '', minStock: 10, unit: 'pack', description: '', image: '',
        dateAdded: new Date().toISOString(), lastUpdated: new Date().toISOString(), archived: false },
      { id: '3', name: 'Fudgee Barr', price: 10, stock: 25, cost: 6, barcode: '', category: 'Snacks',
        brand: 'Fudgee', supplier: '', minStock: 15, unit: 'pack', description: '', image: '',
        dateAdded: new Date().toISOString(), lastUpdated: new Date().toISOString(), archived: false }
    ],
    transactions: [],
    suppliers: [],
    purchaseOrders: [],
    stockAdjustments: [],
    priceHistory: [],
    receivingTransactions: [],
    reportHistory: [],
    userSessions: [],
    auditLogs: [],
    settings: [{ id: 'main',
      storeName: 'Aking Tindahan', storeAddress: '123 Rizal St., Manila',
      receiptFooter: 'Thank you for your purchase!', taxRate: 0, currency: '₱',
      storeLogo: '', contactNumber: '', emailAddress: '',
      timeZone: 'Asia/Manila', dateFormat: 'MM/DD/YYYY', timeFormat: '12h',
      receiptHeader: '', receiptFooterMessage: 'Thank you for your purchase!',
      showLogo: true, showCashierName: true, showStoreAddress: true,
      showChange: true, showDiscount: true, paperWidth: '58mm', autoPrint: false,
      lowStockThreshold: 5, autoGenerateBarcode: false, allowNegativeStock: false,
      defaultCategory: 'General', defaultUnit: 'pcs',
      taxPercentage: 0, enableVAT: false, enableDiscounts: false,
      discountTypes: 'Percentage,Fixed', roundingRules: 'none',
      lowStockAlerts: true, outOfStockAlerts: true,
      dailySalesReminder: false, backupReminder: true,
      autoLogoutMinutes: 30, requirePasswordDelete: true,
      requirePasswordStockAdjust: false, loginAttemptLimit: 5,
      sessionTimeoutMinutes: 30, theme: 'dark',
      sidebarCollapsed: false, dashboardCardLayout: 'grid'
    }],
    stats: { totalRevenue: 0, totalProfit: 0, totalItemsSold: 0, totalTransactions: 0 }
  };
}

// ===============================
// INTERNAL — migration & stats
// ===============================

function calculateStats(transactions, products) {
  const stats = {
    totalRevenue: 0, totalProfit: 0, totalItemsSold: 0,
    totalTransactions: (transactions || []).length
  };
  (transactions || []).forEach(tx => {
    stats.totalRevenue += tx.total || 0;
    if (tx.items) {
      tx.items.forEach(item => {
        stats.totalItemsSold += item.qty || 0;
        const product = products ? products.find(p => p.id === item.productId) : null;
        const cost = product ? (product.cost || 0) : 0;
        stats.totalProfit += ((item.price || 0) - cost) * (item.qty || 0);
      });
    }
  });
  return stats;
}

function migrateIfNeeded(data) {
  let changed = false;

  // Migrate old "sales" to "transactions"
  if (data.sales && Array.isArray(data.sales) && (!data.transactions || data.transactions.length === 0)) {
    data.transactions = data.sales.map(sale => ({
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      items: [{ productId: sale.productId, name: sale.name, price: sale.total / sale.qty, qty: sale.qty, total: sale.total }],
      total: sale.total, cashier: 'admin', date: sale.date || new Date().toISOString()
    }));
    delete data.sales;
    changed = true;
  }

  // Convert settings from object to array format
  if (data.settings && !Array.isArray(data.settings)) {
    data.settings = [{ id: 'main', ...data.settings, currency: data.settings.currency || '₱' }];
    changed = true;
  }

  if (!data.transactions) { data.transactions = []; changed = true; }
  if (!data.auditLogs) { data.auditLogs = []; changed = true; }
  if (!data.stats) { data.stats = calculateStats(data.transactions, data.products); changed = true; }
  if (!data.users) { data.users = getDefaultData().users; changed = true; }

  ['suppliers', 'purchaseOrders', 'stockAdjustments', 'priceHistory', 'receivingTransactions', 'reportHistory', 'userSessions'].forEach(key => {
    if (!data[key]) { data[key] = []; changed = true; }
  });

  // Ensure products have all new fields
  if (data.products) {
    data.products.forEach(p => {
      if (p.cost === undefined) { p.cost = Math.round(p.price * 0.6); changed = true; }
      if (p.barcode === undefined) { p.barcode = ''; changed = true; }
      if (p.category === undefined) { p.category = 'General'; changed = true; }
      if (p.brand === undefined) { p.brand = ''; changed = true; }
      if (p.supplier === undefined) { p.supplier = ''; changed = true; }
      if (p.minStock === undefined) { p.minStock = 5; changed = true; }
      if (p.unit === undefined) { p.unit = 'pcs'; changed = true; }
      if (p.description === undefined) { p.description = ''; changed = true; }
      if (p.image === undefined) { p.image = ''; changed = true; }
      if (p.dateAdded === undefined) { p.dateAdded = new Date().toISOString(); changed = true; }
      if (p.lastUpdated === undefined) { p.lastUpdated = new Date().toISOString(); changed = true; }
      if (p.archived === undefined) { p.archived = false; changed = true; }
    });
  }

  if (changed) StorageAdapter.setFullData(data);
}

// ===============================
// PUBLIC API — only these 5 methods
// ===============================

const StorageService = {

  /**
   * Initialize the data store. Creates defaults if empty, migrates old format.
   * Must be called once at app startup.
   * NEVER throws — catches errors and logs them.
   */
  async init() {
    try {
      const raw = StorageAdapter.getFullData();
      if (!raw) {
        const data = getDefaultData();
        // Hash default passwords
        for (const user of data.users) {
          try { user.password = await _hashPassword(user.password || 'admin123'); } catch (e) {
            console.error('[Storage] Password hash failed during init:', e);
            user.password = 'admin123';
          }
        }
        StorageAdapter.setFullData(data);
      } else {
        try { migrateIfNeeded(raw); } catch (e) {
          console.error('[Storage] Migration failed:', e);
        }
        // Upgrade any plaintext passwords to hashed
        if (raw.users) {
          for (const user of raw.users) {
            if (user.password && user.password.length < 20) {
              try { user.password = await _hashPassword(user.password); } catch (e) {
                console.error('[Storage] Password upgrade failed for user:', user.username, e);
              }
            }
          }
          try { StorageAdapter.setFullData(raw); } catch (e) {
            console.error('[Storage] Failed to save upgraded data:', e);
          }
        }
        // Recalculate stats
        try {
          const data = StorageAdapter.getFullData();
          if (data) {
            data.stats = calculateStats(data.transactions, data.products);
            StorageAdapter.setFullData(data);
          }
        } catch (e) {
          console.error('[Storage] Stats calculation failed:', e);
        }
      }
    } catch (e) {
      console.error('[Storage] Fatal init error:', e);
    }
  },

  /**
   * Load documents from a collection.
   * @param {string} collection — e.g. 'products', 'users', 'settings'
   * @param {string} [id] — optional document id; returns single doc or null
   * @returns {Array|object|null}
   */
  load(collection, id) {
    if (id !== undefined) {
      return StorageAdapter.load(collection, id);
    }
    const docs = StorageAdapter.load(collection);
    return docs || [];
  },

  /**
   * Save (insert) a new document into a collection.
   * The document must include an `id` field.
   * @param {string} collection
   * @param {object} doc
   * @returns {{ success: boolean, error?: string }}
   */
  save(collection, doc) {
    return StorageAdapter.save(collection, doc);
  },

  /**
   * Update an existing document by id.
   * @param {string} collection
   * @param {string} id
   * @param {object} changes — properties to merge
   * @returns {{ success: boolean, error?: string }}
   */
  update(collection, id, changes) {
    return StorageAdapter.update(collection, id, changes);
  },

  /**
   * Delete a document by id.
   * @param {string} collection
   * @param {string} id
   * @returns {{ success: boolean, error?: string }}
   */
  delete(collection, id) {
    return StorageAdapter.delete(collection, id);
  },

  // ---- Convenience helpers (backward-compat, also go through adapter) ----

  /** Export full dataset as JSON string */
  exportData() {
    const data = StorageAdapter.getFullData();
    return { success: true, json: JSON.stringify(data, null, 2) };
  },

  /** Import full dataset from JSON string */
  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.products) return { success: false, error: 'Invalid data format' };
      return StorageAdapter.setFullData(data);
    } catch (e) {
      return { success: false, error: 'Invalid JSON' };
    }
  },

  /** Get the full dataset with recalculated stats */
  readRaw() {
    const data = StorageAdapter.getFullData();
    if (data) {
      data.stats = calculateStats(data.transactions, data.products);
    }
    return data;
  },

  // ---- Password helpers (not storage ops, but commonly needed) ----
  hashPassword,
  verifyPassword
};

export { StorageService, hashPassword, verifyPassword };
export default StorageService;
