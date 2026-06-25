/**
 * Items state slice.
 * Owns the items array and all CRUD operations on it.
 * Persists to localStorage on every mutation.
 * Emits bus events so UI components can subscribe to changes.
 */

import { bus } from './AppState.js';
import {
  loadItems as loadFromStorage,
  saveItems as saveToStorage,
  isSeeded, markSeeded,
} from '../services/storage/local.js';
import { migrateCategory } from '../core/categories.js';
import { fromServer } from '../services/inventory.service.js';
import { SEED_ITEMS } from './seed.js';

/** @type {object[]} */
let _items = [];

// ── Initialisation ─────────────────────────────────────────────────────────

/**
 * Load items from localStorage (or seed with demo data on first run).
 * @returns {object[]}
 */
export function initItems() {
  const stored = loadFromStorage();

  if (stored && stored.length > 0) {
    _items = stored.map(i => ({ ...i, category: migrateCategory(i.category) }));
  } else if (!isSeeded()) {
    _items = [...SEED_ITEMS];
    markSeeded();
    saveToStorage(_items);
  } else {
    _items = [];
  }

  return _items;
}

// ── Selectors (read-only views) ─────────────────────────────────────────────

/** @returns {object[]} */
export function getItems() { return _items; }

/** @param {number|string} id @returns {object|undefined} */
export function getItemById(id) {
  return _items.find(i => String(i.id) === String(id));
}

/** @returns {object[]} */
export function getActiveItems() {
  return _items.filter(i => i.status !== 'Sold');
}

/** @returns {object[]} */
export function getSoldItems() {
  return _items.filter(i => i.status === 'Sold');
}

/**
 * @param {number} maxDays - stale threshold from settings
 * @returns {object[]}
 */
export function getStaleItems(maxDays) {
  const now = Date.now();
  return _items.filter(i => {
    if (i.status !== 'Listed') return false;
    const acquired = new Date(i.dateAcquired).getTime();
    return (now - acquired) / 86_400_000 > maxDays;
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

function _persist() {
  saveToStorage(_items);
  bus.emit('items:changed', { items: _items });
}

/**
 * Add a new item to the list.
 * @param {object} item
 * @returns {object} the added item
 */
export function addItem(item) {
  _items = [item, ..._items];
  _persist();
  bus.emit('items:added', { item });
  return item;
}

/**
 * Replace an existing item in-place.
 * @param {object} updated
 */
export function updateItem(updated) {
  _items = _items.map(i => String(i.id) === String(updated.id) ? { ...i, ...updated } : i);
  _persist();
  bus.emit('items:updated', { item: updated });
}

/**
 * Remove an item by id.
 * @param {number|string} id
 */
export function removeItem(id) {
  _items = _items.filter(i => String(i.id) !== String(id));
  _persist();
  bus.emit('items:removed', { id });
}

/**
 * Merge a server item into the local list (upsert by id).
 * Used during sync — prefers server data for all fields.
 * @param {object} serverItem
 */
export function mergeServerItem(serverItem) {
  const normalised = serverItem._synced ? serverItem : fromServer(serverItem);
  const idx = _items.findIndex(i => String(i.id) === String(normalised.id));

  if (idx >= 0) {
    _items[idx] = { ..._items[idx], ...normalised };
  } else {
    _items = [normalised, ..._items];
  }

  _persist();
}

/**
 * Replace the entire items list (e.g. after a full server sync).
 * @param {object[]} items
 */
export function replaceItems(items) {
  _items = items;
  _persist();
}
