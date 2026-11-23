import { uid } from '../utils/helpers.js';

const DB_NAME = 'AutoWordGeneratorDB';
const DB_VERSION = 2;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('folders')) {
        const s = db.createObjectStore('folders', { keyPath: 'id' });
        s.createIndex('parentId', 'parentId', { unique: false });
      }
      if (!db.objectStoreNames.contains('templates')) {
        const s = db.createObjectStore('templates', { keyPath: 'id' });
        s.createIndex('folderId', 'folderId', { unique: false });
        s.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('history')) {
        const s = db.createObjectStore('history', { keyPath: 'id' });
        s.createIndex('templateId', 'templateId', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('activities')) {
        const s = db.createObjectStore('activities', { keyPath: 'id' });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('studentDb')) {
        db.createObjectStore('studentDb', { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Không thể mở IndexedDB.'));
  });
  return dbPromise;
}

async function tx(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error(`Lỗi thao tác kho ${storeName}`));
  });
}

export const db = {
  getAll: (store) => tx(store, 'readonly', (s) => s.getAll()),
  get: (store, id) => tx(store, 'readonly', (s) => s.get(id)),
  put: (store, item) => tx(store, 'readwrite', (s) => s.put(item)),
  delete: (store, id) => tx(store, 'readwrite', (s) => s.delete(id)),
  clear: (store) => tx(store, 'readwrite', (s) => s.clear()),

  async logActivity(action, detail) {
    try {
      await this.put('activities', {
        id: uid('act'),
        action,
        detail,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // ignore non-critical logging error
    }
  },

  async getStorageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      return {
        usage: est.usage || 0,
        quota: est.quota || 0,
      };
    }
    return { usage: 0, quota: 0 };
  },
};
