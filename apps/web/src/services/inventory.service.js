/**
 * Inventory CRUD service — Supabase via the auth Edge Function.
 * All server sync flows through here; local persistence is handled
 * separately by ItemsSlice.
 */

import { apiFetch, ENDPOINTS } from './http.js';

/**
 * Normalise a server item to our internal shape.
 * @param {object} s - raw server object
 * @returns {object}
 */
export function fromServer(s) {
  return {
    id:           s.id,
    sku:          s.sku          ?? '',
    nickname:     s.nickname     ?? s.name ?? '',
    category:     s.category     ?? 'Electronics',
    condition:    s.condition    ?? 'Good',
    dateAcquired: s.date_acquired ?? s.dateAcquired ?? new Date().toISOString().slice(0, 10),
    cost:         String(s.cost ?? 0),
    sellPrice:    String(s.sell_price ?? s.sellPrice ?? 0),
    platform:     s.platform     ?? 'eBay',
    status:       s.status       ?? 'Unlisted',
    notes:        s.notes        ?? '',
    createdAt:    s.created_at   ?? s.createdAt ?? new Date().toISOString(),
    photos:       s.photos       ?? [],
    ebayItemId:   s.ebay_item_id ?? null,
    listingUrl:   s.listing_url  ?? null,
    listingTitle: s.listing_title ?? null,
    soldPrice:    s.sold_price   != null ? String(s.sold_price) : null,
    soldDate:     s.sold_date    ?? null,
    _synced:      true,
  };
}

/**
 * Serialise a local item to the shape the server expects.
 * @param {object} item
 * @returns {object}
 */
export function toServer(item) {
  return {
    sku:          item.sku,
    nickname:     item.nickname,
    category:     item.category,
    condition:    item.condition,
    date_acquired: item.dateAcquired,
    cost:         parseFloat(item.cost) || 0,
    sell_price:   parseFloat(item.sellPrice) || 0,
    platform:     item.platform,
    status:       item.status,
    notes:        item.notes ?? '',
  };
}

/**
 * Fetch all inventory items from the server.
 * @returns {Promise<object[]>}
 */
export async function fetchAll() {
  const data = await apiFetch(`${ENDPOINTS.AUTH}/inventory`);
  return (Array.isArray(data) ? data : data.items ?? []).map(fromServer);
}

/**
 * Create a new item on the server.
 * @param {object} item - local item shape
 * @returns {Promise<object>} server-normalised item
 */
export async function createItem(item) {
  const data = await apiFetch(`${ENDPOINTS.AUTH}/inventory`, {
    method: 'POST',
    body: JSON.stringify(toServer(item)),
  });
  return fromServer(data);
}

/**
 * Update an existing item on the server.
 * @param {string|number} id
 * @param {object} item
 * @returns {Promise<object>}
 */
export async function updateItem(id, item) {
  const data = await apiFetch(`${ENDPOINTS.AUTH}/inventory/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(toServer(item)),
  });
  return fromServer(data);
}

/**
 * Delete an item from the server.
 * @param {string|number} id
 * @returns {Promise<void>}
 */
export async function deleteItem(id) {
  await apiFetch(`${ENDPOINTS.AUTH}/inventory/${id}`, { method: 'DELETE' });
}

/**
 * Mark an item as sold on the server.
 * @param {string|number} id
 * @param {{ soldPrice: number, soldDate: string }} payload
 * @returns {Promise<object>}
 */
export async function markSold(id, payload) {
  const data = await apiFetch(`${ENDPOINTS.AUTH}/inventory/${id}/sold`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return fromServer(data);
}
