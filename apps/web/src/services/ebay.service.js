/**
 * eBay integration service.
 * Handles OAuth flow, listing sync, order pull, and price drops.
 */

import { apiFetch, apiUpload, ENDPOINTS, ApiError } from './http.js';

const BASE = ENDPOINTS.EBAY;

/**
 * @typedef {Object} EbayStatus
 * @property {boolean} connected
 * @property {string|null} username
 * @property {string|null} connectedAt
 */

/**
 * Get the OAuth redirect URL and navigate to eBay.
 * @returns {Promise<void>}
 */
export async function connect() {
  const data = await apiFetch(`${BASE}/authorize`);
  if (!data.authUrl) throw new ApiError('Missing authUrl from eBay OAuth', 500);
  location.href = data.authUrl;
}

/**
 * Disconnect eBay account (best-effort — UI should update regardless).
 * @returns {Promise<void>}
 */
export async function disconnect() {
  try {
    await apiFetch(`${BASE}/disconnect`, { method: 'POST' });
  } catch (_) {}
}

/**
 * Check current eBay connection status.
 * @returns {Promise<EbayStatus>}
 */
export async function getStatus() {
  try {
    const data = await apiFetch(`${BASE}/status`);
    return {
      connected:   !!data.connected,
      username:    data.username ?? null,
      connectedAt: data.connectedAt ?? null,
    };
  } catch (_) {
    return { connected: false, username: null, connectedAt: null };
  }
}

/**
 * Parse eBay OAuth result from the URL query string after redirect.
 * @returns {{ result: 'success'|'error'|null, error?: string }}
 */
export function parseOAuthCallback() {
  const params = new URLSearchParams(location.search);
  if (params.get('ebay_connected') === 'true') return { result: 'success' };
  if (params.has('ebay_error'))                return { result: 'error', error: params.get('ebay_error') };
  return { result: null };
}

/** Remove eBay OAuth params from the URL bar without a page reload. */
export function clearOAuthParams() {
  window.history.replaceState({}, document.title, window.location.pathname);
}

/**
 * Pull active listings from eBay.
 * @param {number} days - how many days back to look
 * @param {(msg: string) => void} onProgress - progress callback
 * @returns {Promise<object[]>} normalised listing objects
 */
export async function pullListings(days, onProgress = () => {}) {
  onProgress('Connecting to eBay...');
  const data = await apiFetch(`${BASE}/pull-listings`, {
    method: 'POST',
    body: JSON.stringify({ days }),
  });
  onProgress('');
  return data.listings ?? [];
}

/**
 * Pull sold orders from eBay.
 * @param {number} days
 * @returns {Promise<object[]>}
 */
export async function pullOrders(days = 30) {
  const data = await apiFetch(`${BASE}/pull-orders`, {
    method: 'POST',
    body: JSON.stringify({ days }),
  });
  return data.orders ?? [];
}

/**
 * Push a price drop for an item to eBay.
 * @param {{ ebayItemId: string, newPrice: number }} payload
 * @returns {Promise<void>}
 */
export async function dropPrice(payload) {
  await apiFetch(`${BASE}/revise-price`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * List an item on eBay from inventory.
 * @param {object} listingPayload
 * @returns {Promise<{ ebayItemId: string, listingUrl: string }>}
 */
export async function listItem(listingPayload) {
  return apiFetch(`${BASE}/list-item`, {
    method: 'POST',
    body: JSON.stringify(listingPayload),
  });
}

// ── Deduplication helpers ─────────────────────────────────────────────────

const DEDUPE_LOW  = 0.70; // <70%  → treat as separate items
const DEDUPE_HIGH = 0.95; // ≥95%  → auto-merge without asking

/** @param {string} s */
function normTitle(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

/**
 * Jaccard token similarity between two title strings.
 * @param {string} a
 * @param {string} b
 * @returns {number} 0–1
 */
export function titleSimilarity(a, b) {
  const setA = new Set(normTitle(a).split(' ').filter(Boolean));
  const setB = new Set(normTitle(b).split(' ').filter(Boolean));
  if (!setA.size || !setB.size) return 0;
  const inter = [...setA].filter(t => setB.has(t)).length;
  const union  = new Set([...setA, ...setB]).size;
  return inter / union;
}

/**
 * Find pairs of local inventory items that might match an eBay listing.
 * @param {object[]} localItems
 * @param {object[]} ebayListings
 * @returns {Array<{ localItem: object, ebayItem: object, similarity: number }>}
 */
export function findDedupeCandidates(localItems, ebayListings) {
  const candidates = [];

  for (const ebay of ebayListings) {
    let best = null, bestScore = 0;
    for (const local of localItems) {
      if (local.ebayItemId) continue; // already linked
      const score = titleSimilarity(local.nickname, ebay.title);
      if (score > bestScore) { bestScore = score; best = local; }
    }

    if (!best) continue;
    if (bestScore < DEDUPE_LOW) continue;
    candidates.push({ localItem: best, ebayItem: ebay, similarity: bestScore });
  }

  return candidates.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Return true if a candidate pair should be auto-merged (very high similarity).
 * @param {{ similarity: number }} candidate
 */
export function shouldAutoMerge(candidate) {
  return candidate.similarity >= DEDUPE_HIGH;
}
