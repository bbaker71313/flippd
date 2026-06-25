/**
 * CSV export panel — item selection and eBay draft CSV generation.
 */

import { getItems }       from '../../state/ItemsSlice.js';
import { getEbayCatId }   from '../../core/categories.js';
import {
  loadCsvQueue, saveCsvQueue,
  loadExportedIds, markExported,
} from '../../services/storage/local.js';
import { AppState }       from '../../state/AppState.js';
import { html, mount }    from '../util/esc.js';
import { showToast }      from '../components/Toast.js';

// ── eBay condition word map (for draft CSV format) ───────────────────────

const CONDITION_WORD = {
  'New': 'NEW', 'Like New': 'NEW_OTHER', 'Open Box': 'NEW_OTHER',
  'Good': 'USED', 'Used': 'USED', 'Fair': 'USED', 'Poor': 'FOR_PARTS_OR_NOT_WORKING',
};

// ── Candidates ───────────────────────────────────────────────────────────

function getCandidates() {
  return getItems().filter(i => i.status === 'Unlisted' || i.status === 'Ready to Export');
}

// ── Render ───────────────────────────────────────────────────────────────

/**
 * Render the CSV item-selection checklist into #csv-items-list.
 */
export function renderCsvPreview() {
  const listEl = document.getElementById('csv-items-list');
  const btnEl  = document.getElementById('csv-export-btn');
  if (!listEl) return;

  const userId    = AppState.currentUser?.id ?? 'anon';
  const queue     = loadCsvQueue(userId);
  const candidates = getCandidates();

  if (btnEl) btnEl.disabled = queue.size === 0;

  if (!candidates.length) {
    mount(listEl, html`<div class="csv-empty">No Unlisted items to export yet.<br>Add items and set their status to Unlisted to export them.</div>`);
    return;
  }

  const unlistedCount = candidates.filter(i => i.status === 'Unlisted').length;
  const selectAllBtn  = unlistedCount > 0
    ? html`<button onclick="App.csv.selectAllUnlisted()" style="background:none;border:1px solid var(--border);color:var(--soft);border-radius:6px;padding:4px 10px;font-size:11px;font-family:'IBM Plex Mono',monospace;cursor:pointer;margin-bottom:8px">Select All Unlisted (${unlistedCount})</button>`
    : html``;

  mount(listEl, html`
    ${selectAllBtn}
    ${candidates.map(item => html`
      <div class="csv-item-row" style="align-items:center">
        <input type="checkbox" ${queue.has(String(item.id)) ? 'checked' : ''} onchange="App.csv.toggleQueue(${item.id},this.checked)" style="width:16px;height:16px;flex-shrink:0;margin-right:8px;cursor:pointer" aria-label="Select ${item.nickname}">
        <div class="flex-1-min0">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${item.nickname}</div>
          <div style="font-size:10px;color:var(--muted);font-family:'IBM Plex Mono',monospace">${item.sku || ''} · ${item.status}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:10px">
          <div style="font-size:13px;font-weight:700;color:var(--green)">$${item.sellPrice || '0'}</div>
          <div style="font-size:10px;color:var(--muted)">${item.condition}</div>
        </div>
      </div>`)}`);
}

// ── Queue management ──────────────────────────────────────────────────────

export function toggleQueue(id, checked) {
  const userId = AppState.currentUser?.id ?? 'anon';
  const queue  = loadCsvQueue(userId);
  if (checked) queue.add(String(id)); else queue.delete(String(id));
  saveCsvQueue(userId, queue);
  const btn = document.getElementById('csv-export-btn');
  if (btn) btn.disabled = queue.size === 0;
}

export function selectAllUnlisted() {
  const userId     = AppState.currentUser?.id ?? 'anon';
  const queue      = loadCsvQueue(userId);
  getCandidates().filter(i => i.status === 'Unlisted').forEach(i => queue.add(String(i.id)));
  saveCsvQueue(userId, queue);
  renderCsvPreview();
}

// ── CSV generation ────────────────────────────────────────────────────────

/**
 * Generate and trigger download of an eBay draft listings CSV.
 */
export function generateAndDownloadCSV() {
  const userId     = AppState.currentUser?.id ?? 'anon';
  const queue      = loadCsvQueue(userId);
  let candidates   = getCandidates().filter(i => queue.has(String(i.id)));
  if (!candidates.length) candidates = getCandidates(); // legacy fallback
  if (!candidates.length) { showToast('No items to export'); return; }

  const header = [
    `#INFO,Version=0.0.2,Template= eBay-draft-listings-template_US,,,,,,,,`,
    `"#INFO Action and Category ID are required fields. 1) Set Action to Draft 2) Please find the category ID for your listings here: https://pages.ebay.com/sellerinformation/news/categorychanges.html",,,,,,,,,`,
    `"#INFO After you've successfully uploaded your draft from the Seller Hub Reports tab, complete your drafts to active listings here: https://www.ebay.com/sh/lst/drafts",,,,,,,,,`,
    `#INFO,,,,,,,,,`,
    `Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8),Custom label (SKU),Category ID,Title,UPC,Price,Quantity,Item photo URL,Condition ID,Description`,
  ];

  const rows = candidates.map(item => {
    const title   = (item.listing?.title ?? item.nickname ?? '').substring(0, 80).replace(/"/g, '""');
    const desc    = ('<p>' + (item.listing?.description ?? item.notes ?? item.nickname ?? '').replace(/"/g, "'").replace(/\r?\n/g, '<br>') + '</p>').replace(/"/g, '""');
    const catId   = getEbayCatId(item);
    const condId  = CONDITION_WORD[item.condition] ?? 'USED';
    const price   = (parseFloat(item.sellPrice) || 0).toFixed(2);
    const sku     = (item.sku ?? '').replace(/,/g, '-').replace(/"/g, '');
    const photo   = item.image_url ?? (item.photos?.[0] && !item.photos[0].startsWith('data:') ? item.photos[0] : '');
    return `Draft,${sku},${catId},"${title}",,${price},1,${photo},${condId},"${desc}"`;
  });

  const csv  = [...header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  a.href     = url;
  a.download = `eBay-draft-listings-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  markExported(candidates.map(i => String(i.id)));

  // Clear exported items from queue
  candidates.forEach(i => queue.delete(String(i.id)));
  saveCsvQueue(userId, queue);

  showToast(`Exported ${candidates.length} item${candidates.length !== 1 ? 's' : ''}`);
  renderCsvPreview();
}
