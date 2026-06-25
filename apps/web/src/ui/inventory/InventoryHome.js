/**
 * Inventory home view — stat cards + category grid.
 */

import { getItems }          from '../../state/ItemsSlice.js';
import { getSettings }       from '../../state/SettingsSlice.js';
import { calcProfit }        from '../../core/profit.js';
import { CATEGORIES, CAT_ICONS } from '../../core/categories.js';
import { html, mount }       from '../util/esc.js';

/** Tracks which stat card is highlighted. */
let _activeFilter = 'all';

export function getActiveFilter()      { return _activeFilter; }
export function setActiveFilter(v)     { _activeFilter = v; }

export function renderInventoryHome() {
  const items    = getItems();
  const S        = getSettings();
  const statsEl  = document.getElementById('inv-home-stats');
  const catsEl   = document.getElementById('inv-cat-cards');
  if (!statsEl || !catsEl) return;

  if (!items.length) {
    mount(statsEl, html``);
    mount(catsEl, html`
      <div class="empty-state-dashed">
        <div class="empty-icon">📦</div>
        <div class="empty-title">Nothing here yet</div>
        <div class="empty-body">Scan an item in SCOUT and tap FLIP to add it here, or add one manually.</div>
        <button class="btn btn-amber" onclick="App.inventory.openAddForm()">+ Add Your First Item</button>
      </div>`);
    return;
  }

  const unlistedCount = items.filter(i => i.status === 'Unlisted').length;
  const listedCount   = items.filter(i => i.status === 'Listed').length;
  const soldCount     = items.filter(i => i.status === 'Sold').length;

  const estProfit = items
    .filter(i => i.status === 'Unlisted' || i.status === 'Listed')
    .reduce((sum, i) => sum + calcProfit(i.cost, i.sellPrice, S), 0);

  const cardStyle = key => _activeFilter === key ? 'cursor:pointer;border-color:var(--green)' : 'cursor:pointer';

  mount(statsEl, html`
    <div class="inv-stat-card" onclick="App.inventory.statFilter('Unlisted')" role="button" tabindex="0" style="${cardStyle('Unlisted')}">
      <div class="inv-stat-num">${unlistedCount}</div><div class="inv-stat-label">Unlisted</div>
    </div>
    <div class="inv-stat-card" onclick="App.inventory.statFilter('Listed')" role="button" tabindex="0" style="${cardStyle('Listed')}">
      <div class="inv-stat-num">${listedCount}</div><div class="inv-stat-label">Listed</div>
    </div>
    <div class="inv-stat-card" onclick="App.inventory.statFilter('Sold')" role="button" tabindex="0" style="${cardStyle('Sold')}">
      <div class="inv-stat-num">${soldCount}</div><div class="inv-stat-label">Sold</div>
    </div>
    <div class="inv-stat-card" style="cursor:default">
      <div class="inv-stat-num u-pos">$${estProfit.toFixed(0)}</div><div class="inv-stat-label">Est.Profit</div>
    </div>`);

  const catCards = CATEGORIES
    .map(cat => {
      const ci = items.filter(i => i.category === cat && i.status !== 'Sold');
      if (!ci.length) return html``;
      const profit   = ci.reduce((s, i) => s + calcProfit(i.cost, i.sellPrice, S), 0);
      const listedC  = ci.filter(i => i.status === 'Listed').length;
      const unlistedC = ci.filter(i => i.status === 'Unlisted').length;
      return html`
        <div class="inv-cat-card" onclick="App.inventory.openFilteredList('category','${cat}')" role="button" tabindex="0">
          <div style="display:flex;align-items:center;gap:var(--space-2)">
            <div>
              <div class="inv-cat-name">${CAT_ICONS[cat] || ''} ${cat}</div>
              <div class="inv-cat-meta">${listedC} listed · ${unlistedC} unlisted</div>
            </div>
          </div>
          <div class="u-center">
            <div class="inv-cat-count">${ci.length}</div>
            <div class="inv-cat-profit">$${profit.toFixed(0)}</div>
          </div>
        </div>`;
    });

  mount(catsEl, html`${catCards}`);
}
