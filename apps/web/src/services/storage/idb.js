/**
 * IndexedDB adapter for photo storage.
 * Photos are never stored in localStorage (too large).
 * Wraps the raw IDB API in promise-returning functions.
 */

const DB_NAME    = 'sfp_photos';
const STORE_NAME = 'photos';
const DB_VERSION = 1;

/** @returns {Promise<IDBDatabase>} */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = e  => resolve(e.target.result);
    req.onerror   = e  => reject(e.target.error);
  });
}

/**
 * Save photos for an item.
 * @param {string} itemId
 * @param {string[]} photos  - array of base64 data URLs
 * @returns {Promise<void>}
 */
export async function savePhotos(itemId, photos) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.put(photos, String(itemId));
    req.onsuccess = () => resolve();
    req.onerror   = e  => reject(e.target.error);
  });
}

/**
 * Load photos for an item.
 * @param {string} itemId
 * @returns {Promise<string[]>}
 */
export async function loadPhotos(itemId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.get(String(itemId));
      req.onsuccess = e => resolve(e.target.result ?? []);
      req.onerror   = e => reject(e.target.error);
    });
  } catch (_) {
    return [];
  }
}

/**
 * Delete photos for an item.
 * @param {string} itemId
 * @returns {Promise<void>}
 */
export async function deletePhotos(itemId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.delete(String(itemId));
    req.onsuccess = () => resolve();
    req.onerror   = e  => reject(e.target.error);
  });
}

/**
 * @returns {Promise<string[]>} IDs of items that have no IDB photo entry
 */
export async function itemIdsWithoutPhotos(allItemIds) {
  const db = await openDB();
  const result = [];
  for (const id of allItemIds) {
    const photos = await new Promise(resolve => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(String(id));
      req.onsuccess = e => resolve(e.target.result ?? []);
      req.onerror   = () => resolve([]);
    });
    if (!photos.length) result.push(id);
  }
  return result;
}
