/**
 * Inventory filtered list view (by status or category).
 */

import { getItems }    from '../../state/ItemsSlice.js';
import { html, mount } from '../util/esc.js';

/** @type {{ type: string, value: string }} */
let _filter = { type: 'all', value: 'all' };

export function getFilter()  { return _filter; }
export function setFilter(f) { _filter = f; }

/**
 * Render the filtered item list into #inv-list-items.
 * @param {Map<string|number, string[]>} photoMap  - IDB photo cache keyed by item id
 */
export function renderFilteredList(photoMap = new Map()) {
  const items = getItems();
  const q     = (document.getElementById('inv-search-list')?.value ?? '').toLowerCase();

  let filtered = items;
  if (_filter.type === 'status')   filtered = filtered.filter(i => i.status   === _filter.value);
  if (_filter.type === 'category') filtered = filtered.filter(i => i.category === _filter.value);
  if (q) filtered = filtered.filter(i =>
    i.nickname.toLowerCase().includes(q) || (i.sku ?? '').toLowerCase().includes(q)
  );

  const countEl = document.getElementById('inv-list-count');
  if (countEl) countEl.textContent = `${filtered.length} item${filtered.length !== 1 ? 's' : ''}`;

  const listEl = document.getElementById('inv-list-items');
  if (!listEl) return;

  if (!filtered.length) {
    mount(listEl, html`<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-txt">No items found.</div></div>`);
    return;
  }

  const isUnlistedView = _filter.type === 'status' && _filter.value === 'Unlisted';

  mount(listEl, html`${filtered.map(item => {
    const storedPhotos = photoMap.get(item.id) ?? [];
    const thumbUrl     = (item.photo_urls?.[0]) ?? storedPhotos[0] ?? item.photos?.[0] ?? item.main_photo_url ?? null;
    const isSold       = item.status === 'Sold';
    const isListed     = item.status === 'Listed';
    const isUnlisted   = item.status === 'Unlisted';
    const clickFn      = isSold ? `App.inventory.showSoldDetail(${item.id})` : `App.inventory.startEdit(${item.id})`;

    const thumb = thumbUrl
      ? html`<img class="item-thumb" src="${thumbUrl}" alt="" loading="lazy" onclick="${clickFn}" role="button" tabindex="0" style="width:48px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0;cursor:pointer">`
      : html`<div class="item-thumb" style="width:48px;height:48px;background:var(--bg);display:flex;align-items:center;justify-content:center;border-radius:6px;flex-shrink:0;cursor:pointer;border:1px solid var(--border)" onclick="${clickFn}" role="button" tabindex="0"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h4"/></svg></div>`;

    return html`
      <div class="item-card">
        <div style="display:flex;align-items:flex-start;gap:var(--space-2)">
          ${thumb}
          <div class="flex-1-min0">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;cursor:pointer" onclick="${clickFn}" role="button" tabindex="0">
              <div class="flex-1-min0">
                <div class="item-sku">${item.sku || ''}</div>
                <div class="item-nick">${item.nickname}</div>
              </div>
              ${!isUnlistedView ? html`<span class="status-badge status-${item.status}" style="flex-shrink:0;margin-left:var(--space-1)">${item.status}</span>` : html``}
            </div>
            <div class="item-row-bot" style="gap:var(--space-1);flex-wrap:wrap">
              <span class="u-text-sm u-muted">$${item.sellPrice || '0'}</span>
              ${isListed   ? html`<button class="listing-btn" onclick="App.listings.openModal(${item.id})">Listing Boost</button>` : html``}
              ${isUnlisted ? html`<button class="listing-btn" onclick="App.listings.openModal(${item.id})">Listing</button>` : html``}
              ${isUnlisted && !item.ebay_item_id ? html`<button class="sm-btn" style="background:var(--accent);color:#000;border:none;border-radius:5px;padding:3px 8px;font-size:11px;font-family:'IBM Plex Mono',monospace;cursor:pointer" onclick="event.stopPropagation();App.ebay.listItem(${item.id})">List on eBay</button>` : html``}
              ${isUnlisted ? html`<button class="sm-btn" style="background:var(--card);border:1px solid var(--border);color:var(--soft);border-radius:5px;padding:3px 8px;font-size:11px;font-family:'IBM Plex Mono',monospace;cursor:pointer" onclick="event.stopPropagation();App.inventory.markListed(${item.id})">Mark Listed</button>` : html``}
              ${isListed   ? html`<button class="sold-btn" onclick="event.stopPropagation();App.inventory.openSoldModal(${item.id})">Mark Sold</button>` : html``}
              ${isSold     ? html`<button class="sm-btn" style="background:var(--accent);color:#000;border:none;border-radius:5px;padding:3px 8px;font-size:11px;font-family:'IBM Plex Mono',monospace;cursor:pointer" onclick="event.stopPropagation();App.inventory.confirmRelist(${item.id})">Relist</button>` : html``}
              <button class="sm-btn" style="background:none;border:1px solid var(--red);color:var(--red);border-radius:5px;padding:3px 8px;font-size:11px;font-family:'IBM Plex Mono',monospace;cursor:pointer" onclick="event.stopPropagation();App.inventory.deleteItem(${item.id})">Delete</button>
            </div>
          </div>
        </div>
      </div>`;
  })}`);
}
