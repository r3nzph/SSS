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
import { computeAggregateStats } from './analytics.js';

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

async function verifyPassword(password, hash) {
  const result = await _hashPassword(password);
  return result === hash;
}

async function hashPassword(password) {
  return _hashPassword(password);
}

// ===============================
// INTERNAL — default data blueprint
// ===============================

function getDefaultData() {
  return {
    users: [
      { id: 'u1', username: 'admin', password: 'admin123', role: 'Administrator', createdAt: new Date().toISOString(),
        fullName: 'Administrator', email: '', contactNumber: '', status: 'active',
        lastLogin: null, createdBy: 'system', loginAttempts: 0, lockedUntil: null,
        forcePasswordChange: false, profilePicture: '',
        permissions: { dashboard: true, inventory: true, suppliers: true, purchaseOrders: true,
          stockReceiving: true, stockAdjustment: true, salesAudit: true, reports: true,
          userManagement: true, settings: true, cashierPOS: true, backup: true,
          restore: true, deleteRecords: true, exportReports: true } },
      { id: 'u2', username: 'cashier', password: 'cashier123', role: 'Cashier', createdAt: new Date().toISOString(),
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
    reportHistory: [], userSessions: [], auditLogs: [],
    // Migration: ensure existing data roles are updated
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
// INTERNAL — migration
// ===============================

function migrateIfNeeded(data) {
  let changed = false;

  // Migrate old "sales" to "transactions"
  if (data.sales && Array.isArray(data.sales) && (!data.transactions || data.transactions.length === 0)) {
    data.transactions = data.sales.map(sale => ({
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      items: [{ productId: sale.productId, name: sale.name, price: sale.total / sale.qty, qty: sale.qty, total: sale.total }],
      total: sale.total, cashier: 'Administrator', date: sale.date || new Date().toISOString()
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
  if (!data.stats) { data.stats = computeAggregateStats(data.transactions, data.products); changed = true; }
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

  // ---- Role migration: Update existing lowercase roles to new capitalized format ----
  if (data.users) {
    const roleMap = { admin: 'Administrator', cashier: 'Cashier', superadmin: 'Administrator', inventory: 'Cashier', readonly: 'Cashier' };
    for (const user of data.users) {
      if (roleMap[user.role] && user.role !== roleMap[user.role]) {
        user.role = roleMap[user.role];
        changed = true;
      }
    }
  }

  // ---- Demo password version migration ----
  // Ensures existing localStorage users get the updated default passwords
  // (admin123 for admin, cashier123 for cashier) instead of the old hash.
  if (data.users && Array.isArray(data.settings) && data.settings[0]) {
    const mainSettings = data.settings[0];
    if (!mainSettings._demoPasswordVersion || mainSettings._demoPasswordVersion < 1) {
      const defaultPasswords = { admin: 'admin123', cashier: 'cashier123' };
      for (const user of data.users) {
        if (user.createdBy === 'system' && defaultPasswords[user.username]) {
          user.password = defaultPasswords[user.username];
          changed = true;
        }
      }
      mainSettings._demoPasswordVersion = 1;
      changed = true;
    }
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
            data.stats = computeAggregateStats(data.transactions, data.products);
            StorageAdapter.setFullData(data);
          }
        } catch (e) {
          console.error('[Storage] Stats calculation failed:', e);
        }
      }
    } catch (e) {
      console.error('[Storage] Fatal init error:', e);
    }

    // ===============================
    // VERIFICATION: ensure data actually exists in localStorage
    // If init succeeded but data is missing (e.g. silent write failure),
    // force-create default data.
    // ===============================
    const verify = StorageAdapter.getFullData();
    if (!verify) {
      console.warn('[Storage] init() completed but data is missing from localStorage. Re-creating defaults...');
      try {
        const fallbackData = getDefaultData();
        for (const user of fallbackData.users) {
          try { user.password = await _hashPassword(user.password || 'admin123'); } catch (e) {
            console.error('[Storage] Fallback password hash failed:', e);
            user.password = 'admin123';
          }
        }
        StorageAdapter.setFullData(fallbackData);
        console.log('[Storage] Fallback defaults created successfully.');
      } catch (e2) {
        console.error('[Storage] CRITICAL: Could not create fallback data:', e2);
      }
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
      data.stats = computeAggregateStats(data.transactions, data.products);
    }
    return data;
  },

  /**
   * Force-initialize the data store with defaults.
   * Must be awaited. Used as a fallback when normal init fails to write data.
   * Properly hashes default passwords so login works.
   */
  async forceInit() {
    try {
      const data = getDefaultData();
      for (const user of data.users) {
        try { user.password = await _hashPassword(user.password || 'admin123'); } catch (e) {
          console.error('[Storage] forceInit password hash failed:', e);
          user.password = 'admin123';
        }
      }
      StorageAdapter.setFullData(data);
      console.log('[Storage] forceInit: Defaults written successfully.');
      return true;
    } catch (e) {
      console.error('[Storage] forceInit failed:', e);
      return false;
    }
  },

  // ---- Password helpers (not storage ops, but commonly needed) ----
  hashPassword,
  verifyPassword
};

export { StorageService, hashPassword, verifyPassword };
export default StorageService;
