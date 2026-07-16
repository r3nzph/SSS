// ===============================
// STORAGE ADAPTER — localStorage
// Swapable: implement the same interface for Firebase, IndexedDB, etc.
// ===============================

const STORAGE_KEY = 'sarisari_pos_data';

/**
 * Read the full dataset from localStorage.
 * @returns {object|null}
 */
function readRaw() {
  try {
    const content = localStorage.getItem(STORAGE_KEY);
    if (!content) return null;
    return JSON.parse(content);
  } catch (e) {
    console.error('[StorageAdapter] Error reading:', e);
    return null;
  }
}

/**
 * Write the full dataset to localStorage.
 * @param {object} data
 * @returns {{ success: boolean, error?: string }}
 */
function writeRaw(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { success: true };
  } catch (e) {
    console.error('[StorageAdapter] Error writing:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Load an entire collection or a single document by id.
 * @param {string} collection
 * @param {string} [id]
 * @returns {*|null} Array of docs, single doc, or null
 */
function load(collection, id) {
  const data = readRaw();
  if (!data) return null;
  const docs = data[collection];
  if (!docs || !Array.isArray(docs)) return null;
  if (id !== undefined) {
    return docs.find(d => d.id === id) || null;
  }
  return docs;
}

/**
 * Save (insert) a new document into a collection.
 * @param {string} collection
 * @param {object} doc — must include an `id` field
 * @returns {{ success: boolean, error?: string }}
 */
function save(collection, doc) {
  const data = readRaw();
  if (!data) return { success: false, error: 'No data store' };
  if (!data[collection]) data[collection] = [];
  if (data[collection].some(d => d.id === doc.id)) {
    return { success: false, error: `Duplicate id "${doc.id}" in ${collection}` };
  }
  data[collection].push(doc);
  return writeRaw(data);
}

/**
 * Update an existing document by id.
 * @param {string} collection
 * @param {string} id
 * @param {object} changes — fields to merge
 * @returns {{ success: boolean, error?: string }}
 */
function update(collection, id, changes) {
  const data = readRaw();
  if (!data) return { success: false, error: 'No data store' };
  const docs = data[collection];
  if (!docs || !Array.isArray(docs)) return { success: false, error: `Collection "${collection}" not found` };
  const idx = docs.findIndex(d => d.id === id);
  if (idx === -1) return { success: false, error: `Document "${id}" not found in ${collection}` };
  Object.assign(docs[idx], changes);
  return writeRaw(data);
}

/**
 * Delete a document by id.
 * @param {string} collection
 * @param {string} id
 * @returns {{ success: boolean, error?: string }}
 */
function del(collection, id) {
  const data = readRaw();
  if (!data) return { success: false, error: 'No data store' };
  const docs = data[collection];
  if (!docs || !Array.isArray(docs)) return { success: false, error: `Collection "${collection}" not found` };
  const idx = docs.findIndex(d => d.id === id);
  if (idx === -1) return { success: false, error: `Document "${id}" not found in ${collection}` };
  docs.splice(idx, 1);
  return writeRaw(data);
}

/**
 * Get the complete raw dataset (for backup/export).
 */
function getFullData() {
  return readRaw();
}

/**
 * Replace the complete dataset (for import/restore).
 */
function setFullData(data) {
  return writeRaw(data);
}

// Interface that a Firebase adapter would also implement
export const StorageAdapter = {
  load,
  save,
  update,
  delete: del,
  getFullData,
  setFullData,
  readRaw,
  writeRaw
};

export default StorageAdapter;
