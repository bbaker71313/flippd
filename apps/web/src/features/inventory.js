/**
 * Inventory feature controller.
 * Orchestrates item CRUD, server sync, and photo management.
 */

import {
  getItems, getItemById, addItem, updateItem, removeItem, mergeServerItem,
} from '../state/ItemsSlice.js';
import { getSettings }       from '../state/SettingsSlice.js';
import * as InventoryService from '../services/inventory.service.js';
import { savePhotos, loadPhotos, deletePhotos } from '../services/storage/idb.js';
import { nextSKU }           from '../core/sku.js';
import { findDuplicate, validateInventoryItem } from '../core/validators.js';
import { showToast }         from '../ui/components/Toast.js';
import { showInvView }       from '../router/tabs.js';
import { AppState }          from '../state/AppState.js';

// ── Item CRUD ─────────────────────────────────────────────────────────────

/**
 * Create a new inventory item (local + server).
 * @param {object} formData - raw form fields
 * @returns {Promise<{ success: boolean, item?: object, error?: string }>}
 */
export async function saveNewItem(formData) {
  const validation = validateInventoryItem(formData);
  if (!validation.valid) return { success: false, error: validation.error };

  const existing  = getItems();
  const duplicate = findDuplicate(formData, existing);
  if (duplicate) {
    return { success: false, error: `"${duplicate.nickname}" already exists (${duplicate.sku})` };
  }

  const category = formData.category ?? 'Electronics';
  const item = {
    id:           Date.now(),
    sku:          formData.sku || nextSKU(category, existing),
    nickname:     String(formData.nickname).trim(),
    category,
    condition:    formData.condition  ?? 'Good',
    dateAcquired: formData.dateAcquired ?? new Date().toISOString().slice(0, 10),
    cost:         String(formData.cost ?? 0),
    sellPrice:    String(formData.sellPrice ?? 0),
    platform:     formData.platform   ?? 'eBay',
    status:       formData.status     ?? 'Unlisted',
    notes:        String(formData.notes ?? '').trim(),
    createdAt:    new Date().toISOString(),
    photos:       [],
  };

  addItem(item);

  // Save photos to IDB
  if (formData.photos?.length) {
    await savePhotos(item.id, formData.photos);
  }

  // Push to server if logged in (fire-and-forget — local state wins)
  if (AppState.isLoggedIn) {
    InventoryService.createItem(item)
      .then(serverItem => mergeServerItem(serverItem))
      .catch(() => {}); // local data already saved
  }

  showToast(`${item.nickname} added`);
  return { success: true, item };
}

/**
 * Update an existing item.
 * @param {string|number} id
 * @param {object} updates
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function editItem(id, updates) {
  const existing = getItemById(id);
  if (!existing) return { success: false, error: 'Item not found' };

  const merged = { ...existing, ...updates, id };
  updateItem(merged);

  if (updates.photos?.length) {
    await savePhotos(id, updates.photos);
  }

  if (AppState.isLoggedIn) {
    InventoryService.updateItem(id, merged).catch(() => {});
  }

  showToast('Item updated');
  return { success: true };
}

/**
 * Delete an item (local + server + IDB photos).
 * @param {string|number} id
 */
export async function deleteItemById(id) {
  const item = getItemById(id);
  if (!item) return;

  removeItem(id);
  await deletePhotos(id);

  if (AppState.isLoggedIn) {
    InventoryService.deleteItem(id).catch(() => {});
  }

  showToast(`${item.nickname} deleted`);
}

/**
 * Mark an item as sold.
 * @param {string|number} id
 * @param {{ soldPrice: number, soldDate: string }} payload
 */
export async function markItemSold(id, payload) {
  const item = getItemById(id);
  if (!item) return;

  updateItem({ ...item, ...payload, status: 'Sold' });

  if (AppState.isLoggedIn) {
    InventoryService.markSold(id, payload).catch(() => {});
  }

  showToast(`${item.nickname} marked sold`);
}

/**
 * Mark an item as listed.
 * @param {string|number} id
 */
export async function markItemListed(id) {
  const item = getItemById(id);
  if (!item) return;
  updateItem({ ...item, status: 'Listed' });
  showToast(`${item.nickname} marked listed`);
}

/**
 * Relist a sold item (reset to Unlisted).
 * @param {string|number} id
 */
export async function relistItem(id) {
  const item = getItemById(id);
  if (!item) return;
  updateItem({ ...item, status: 'Unlisted', soldPrice: null, soldDate: null });
  showToast(`${item.nickname} relisted`);
}

// ── Server sync ───────────────────────────────────────────────────────────

/**
 * Pull all items from server and merge into local state.
 * @returns {Promise<void>}
 */
export async function syncFromServer() {
  if (!AppState.isLoggedIn) return;
  try {
    const serverItems = await InventoryService.fetchAll();
    serverItems.forEach(mergeServerItem);
  } catch (_) {
    // Silent — user still has local data
  }
}

// ── Photo helpers ─────────────────────────────────────────────────────────

/**
 * Load photos for an item from IDB.
 * @param {string|number} id
 * @returns {Promise<string[]>}
 */
export async function getItemPhotos(id) {
  return loadPhotos(id);
}
