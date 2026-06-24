/**
 * eBay feature controller.
 *
 * Coordinates: ebay.service.js (API calls) + ItemsSlice (state) + inventory.js (sync).
 * Handles: OAuth connect/disconnect/status, listing sync, order sync, client-side dedupe.
 */

import { AppState }              from '../state/AppState.js';
import { getItems, replaceItems, saveItems } from '../state/ItemsSlice.js';
import { connect, disconnect, getStatus,
         pullListings, pullOrders, listItem,
         dropPrice as ebayDropPrice }        from '../services/ebay.service.js';
import { updateItem, deleteItemById }         from './inventory.js';
import { showToast }             from '../ui/components/Toast.js';

// ── OAuth ─────────────────────────────────────────────────────────────────

export async function ebayConnect() {
  if (!AppState.isLoggedIn) { showToast('Log in to connect your eBay account'); return; }
  showToast('Redirecting to eBay...');
  try {
    const { authUrl } = await connect();
    if (!authUrl) throw new Error('missing authUrl');
    location.href = authUrl;
  } catch {
    showToast('Could not start eBay connection. Please try again.');
  }
}

export async function ebayDisconnect() {
  try { await disconnect(); } catch (_) {}
  showToast('eBay account disconnected.');
  _updateConnectUI(false, null);
}

export async function checkEbayStatus() {
  const disp = document.getElementById('ebay-status-display');
  if (!disp) return;
  if (!AppState.isLoggedIn) {
    disp.textContent = 'Log in to connect your eBay account';
    _updateConnectUI(false, null);
    return;
  }
  disp.textContent = 'Checking...';
  try {
    const data = await getStatus();
    if (data.connected) {
      disp.textContent = 'Connected to eBay' + (data.username ? ' as ' + data.username : '');
      _updateConnectUI(true, null);
    } else {
      disp.textContent = 'Not connected';
      _updateConnectUI(false, null);
    }
  } catch {
    disp.textContent = 'Not connected';
    _updateConnectUI(false, null);
  }
}

function _updateConnectUI(connected, _unused) {
  const btn = document.getElementById('ebay-connect-btn');
  const dis = document.getElementById('ebay-disconnect-btn');
  if (btn) btn.style.display = connected ? 'none'  : 'block';
  if (dis) dis.style.display = connected ? 'block' : 'none';
}

// ── Sync panel ────────────────────────────────────────────────────────────

let _syncDays = 90;

export function showEbaySyncPanel() {
  const panel = document.getElementById('ebay-sync-panel');
  if (panel) panel.style.display = 'flex';
  setSyncDays(90);
  const prog = document.getElementById('sync-progress');
  if (prog) prog.textContent = '';
}

export function closeEbaySync() {
  const panel = document.getElementById('ebay-sync-panel');
  if (panel) panel.style.display = 'none';
  const prog = document.getElementById('sync-progress');
  if (prog) prog.textContent = '';
}

export function setSyncDays(d) {
  _syncDays = d;
  ['30', '60', '90'].forEach(x => {
    const b = document.getElementById('sync-' + x);
    if (!b) return;
    const active = x == d;
    b.style.background  = active ? 'var(--accent)' : 'var(--card)';
    b.style.color       = active ? '#000' : 'var(--soft)';
    b.style.border      = active ? 'none' : '1.5px solid var(--border)';
    b.style.fontWeight  = active ? '700' : '400';
  });
}

export async function ebayPullListings(days) {
  const st  = document.getElementById('sync-progress');
  const btn = document.getElementById('sync-start-btn');
  if (st)  { st.style.color = 'var(--soft)'; st.textContent = 'Syncing from eBay...'; }
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }

  try {
    const d = await pullListings(days);
    const total = (d.active || 0) + (d.drafted || 0) + (d.sold || 0);
    let syncMsg = `Synced ${total} items — ${d.active} active, ${d.drafted} drafts, ${d.sold} sold`;

    if (d.clientIdMissing) {
      if (st) st.style.color = 'var(--yellow)';
      syncMsg = `${d.sold} sold order${d.sold !== 1 ? 's' : ''} synced. Active listings require EBAY_CLIENT_ID in Supabase secrets.`;
    } else if (total === 0) {
      if (st) st.style.color = 'var(--yellow)';
      syncMsg = '0 items returned from eBay. Reconnect eBay if you have active listings.';
    } else {
      if (st) st.style.color = 'var(--green)';
    }
    if (st) st.textContent = syncMsg;

    await new Promise(r => setTimeout(r, 1000));
    await window.App?.inventory?.syncFromServer?.();

    // Client-side dedup: keep only newest item per ebay_item_id
    const items = getItems();
    const best  = new Map();
    for (const item of items) {
      if (!item.ebay_item_id) continue;
      const ex = best.get(item.ebay_item_id);
      if (!ex || new Date(item.updatedAt || item.createdAt || 0) > new Date(ex.updatedAt || ex.createdAt || 0)) {
        best.set(item.ebay_item_id, item);
      }
    }
    const deduped = items.filter(i => !i.ebay_item_id || best.get(i.ebay_item_id) === i);
    if (deduped.length !== items.length) {
      replaceItems(deduped);
    }

    window.App?.inventory?.render?.();
    setTimeout(() => runEbayDedupeScan(), 200);
    showToast(syncMsg.substring(0, 80));
    setTimeout(() => closeEbaySync(), 2000);

  } catch (e) {
    if (st) { st.style.color = 'var(--red)'; st.textContent = e.message; }
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}

export async function runEbaySyncPull() {
  await ebayPullListings(_syncDays);
}

export async function handleSyncOrders() {
  if (!AppState.isLoggedIn) { showToast('Log in to sync sold orders'); return; }
  const st  = document.getElementById('sync-progress');
  const btn = document.getElementById('sync-orders-btn');
  if (st)  { st.style.color = 'var(--soft)'; st.textContent = 'Syncing sold orders from eBay...'; }
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
  try {
    const data = await pullOrders();
    if (data.synced === 0 && data.debug?.ordersFound === 0) {
      if (st) { st.style.color = 'var(--yellow)'; st.textContent = '0 orders found. Try disconnecting and reconnecting eBay to refresh the Fulfillment scope.'; }
    } else {
      if (st) { st.style.color = 'var(--green)'; st.textContent = `${data.synced} sold order${data.synced === 1 ? '' : 's'} synced`; }
    }
    await window.App?.inventory?.syncFromServer?.();
    window.App?.dashboard?.render?.();
  } catch (e) {
    if (st) { st.style.color = 'var(--red)'; st.textContent = e.message; }
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}

export async function handleListOnEbay(inventoryId) {
  if (!AppState.isLoggedIn) { showToast('Log in to push listings to eBay'); return; }
  showToast('Pushing to eBay...');
  try {
    await listItem({ inventoryId });
    showToast('Listed on eBay!');
    await window.App?.inventory?.syncFromServer?.();
  } catch (e) {
    showToast(e.message || 'eBay listing failed');
  }
}

// ── Client-side fuzzy dedupe ──────────────────────────────────────────────

const DEDUPE_LOW  = 0.70;
const DEDUPE_HIGH = 0.95;

let _dedupeQueue   = [];
let _dedupeCurrent = null;

function _isEbaySourced(it) {
  if (!it) return false;
  if (it.ebay_item_id || it.ebayItemId) return true;
  if (it.source === 'ebay') return true;
  if (typeof it.image_url === 'string' && it.image_url.includes('ebayimg.com')) return true;
  return false;
}

function _normTitle(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function _similarity(a, b) {
  const ta = new Set(_normTitle(a).split(' ').filter(Boolean));
  const tb = new Set(_normTitle(b).split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  ta.forEach(t => { if (tb.has(t)) inter++; });
  const union = ta.size + tb.size - inter;
  return union > 0 ? inter / union : 0;
}

function _findCandidates() {
  const items      = getItems();
  const ebayItems  = items.filter(_isEbaySourced);
  const localOnly  = items.filter(i => !_isEbaySourced(i));
  if (!ebayItems.length || !localOnly.length) return [];

  const pairs = [];
  const seen  = new Set();

  for (const e of ebayItems) {
    const eTitle = (e.listing?.title) || e.nickname || '';
    let best = null;
    for (const f of localOnly) {
      if (seen.has(f.id)) continue;
      if (e.sku && f.sku && e.sku === f.sku) continue;
      const sim = _similarity(eTitle, f.nickname);
      if (sim >= DEDUPE_LOW && (!best || sim > best.sim)) best = { flippd: f, ebay: e, sim };
    }
    if (best) {
      if (best.sim >= DEDUPE_HIGH) {
        _mergeItems(best.flippd, best.ebay);
        seen.add(best.flippd.id);
      } else {
        pairs.push(best);
        seen.add(best.flippd.id);
      }
    }
  }
  return pairs;
}

function _mergeItems(local, ebayItem) {
  const items = getItems();
  const idx   = items.findIndex(i => i.id === local.id);
  if (idx === -1) return;
  const merged = {
    ...local,
    ebay_item_id: ebayItem.ebay_item_id || ebayItem.ebayItemId || local.ebay_item_id,
    status:       ebayItem.status   || local.status,
    sellPrice:    ebayItem.sellPrice || local.sellPrice,
    platform:     'eBay',
    listing:      ebayItem.listing  || local.listing,
    image_url:    ebayItem.image_url || local.image_url,
    source:       'ebay',
  };
  const updated = [...items];
  updated[idx]  = merged;
  const dupIdx  = updated.findIndex(i => i.id === ebayItem.id);
  if (dupIdx !== -1) updated.splice(dupIdx, 1);
  replaceItems(updated);
  updateItem(merged.id, merged).catch(() => {});
  deleteItemById(ebayItem.id).catch(() => {});
}

export function runEbayDedupeScan() {
  _dedupeQueue = _findCandidates();
  window.App?.inventory?.render?.();
  if (_dedupeQueue.length) _showNextDedupePair();
}

function _showNextDedupePair() {
  _dedupeCurrent = _dedupeQueue.shift();
  if (!_dedupeCurrent) {
    const modal = document.getElementById('ebay-dedupe-modal');
    if (modal) modal.style.display = 'none';
    window.App?.inventory?.render?.();
    showToast('Dedupe complete');
    return;
  }
  const { flippd, ebay } = _dedupeCurrent;
  const fImg   = flippd.photos?.[0] || flippd.image_url || '';
  const eImg   = ebay.image_url     || ebay.photos?.[0]  || '';
  const fTitle = flippd.nickname || '(no title)';
  const eTitle = (ebay.listing?.title) || ebay.nickname || '(no title)';
  const remaining = _dedupeQueue.length;

  const fImgEl = document.getElementById('ebay-dedupe-flippd-img');
  const eImgEl = document.getElementById('ebay-dedupe-ebay-img');
  const fTitleEl = document.getElementById('ebay-dedupe-flippd-title');
  const eTitleEl = document.getElementById('ebay-dedupe-ebay-title');
  const progEl   = document.getElementById('ebay-dedupe-progress');

  if (fImgEl) fImgEl.src = fImg || 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  if (eImgEl) eImgEl.src = eImg || 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  if (fTitleEl) fTitleEl.textContent = fTitle;
  if (eTitleEl) eTitleEl.textContent = eTitle;
  if (progEl) progEl.textContent = remaining > 0 ? `${remaining + 1} pairs to review` : 'Last pair';

  const modal = document.getElementById('ebay-dedupe-modal');
  if (modal) modal.style.display = 'flex';
}

/** User clicked "Yes, merge" in the dedupe modal. */
export function dedupeAccept() {
  if (!_dedupeCurrent) return;
  _mergeItems(_dedupeCurrent.flippd, _dedupeCurrent.ebay);
  _dedupeCurrent = null;
  _showNextDedupePair();
}

/** User clicked "No, keep separate" in the dedupe modal. */
export function dedupeReject() {
  _dedupeCurrent = null;
  _showNextDedupePair();
}
