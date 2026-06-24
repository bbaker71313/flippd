/**
 * Scanner result renderers.
 * Pure render functions — receive data, patch DOM, no business logic.
 *
 * XSS: all AI-sourced strings go through the html`` tagged template which
 * auto-escapes every interpolation. mount() runs DOMPurify as a second layer.
 */

import { getSettings }        from '../../state/SettingsSlice.js';
import { calcMaxCost }        from '../../core/profit.js';
import { showSrcView }        from '../../router/tabs.js';
import { html, mount, escUrl } from '../util/esc.js';

// ── CSS class helpers ────────────────────────────────────────────────────

export const profitClass = p  => p  >= getSettings().minProfit ? 'u-pos'  : 'u-neg';
export const roiClass    = r  => r  >= 200 ? 'u-pos' : r >= 100 ? 'u-warn' : 'u-neg';
export const daysClass   = d  => d  <= 30  ? 'u-pos' : d <= 60  ? 'u-warn' : 'u-neg';
export const strClass    = s  => s  >= 60  ? 'u-pos' : s >= 35  ? 'u-warn' : 'u-neg';
export const confClass   = c  => c  >= 75  ? 'u-pos' : c >= 50  ? 'u-warn' : 'u-neg';
export const demandClass = lv => ({ 'VERY HIGH': 'u-hot', HIGH: 'u-pos', MEDIUM: 'u-warn', LOW: 'u-neg' })[lv] ?? 'u-muted';

// ── Single-item result ────────────────────────────────────────────────────

const D_ICON = { HOT: '[ HOT ]', LIST: '[ LIST ]', SKIP: '[ SKIP ]' };
const D_LBL  = { HOT: 'HIGH DEMAND: BUY NOW', LIST: 'WORTH LISTING', SKIP: 'SKIP THIS ONE' };

/**
 * @param {{ item: object, cost: number, fin: object, dec: 'HOT'|'LIST'|'SKIP' }} data
 */
export function renderSingle({ item, cost, fin, dec }) {
  const el = document.getElementById('results-content');
  if (!el) return;

  const S = getSettings();
  const { profit, roi, fee } = fin;

  // dec is our own validated enum — safe as class suffix
  const decLower = dec.toLowerCase();

  const shipLine = S.shipping === 'free'
    ? html`<span class="dv u-neg">-$${fin.shipCost.toFixed(2)}</span>`
    : html`<span class="dv u-pos" style="font-weight:800">Buyer Pays</span>`;

  const maxCost = calcMaxCost(item.avg_sold_price, S, S.minProfit);
  const maxCostHint = (cost === 0 && maxCost > 0)
    ? html`<div class="d-max-cost">if item is under $${maxCost.toFixed(2)}</div>`
    : html``;

  const kwLinks = (item.search_keywords ?? []).map(k =>
    html`<a href="https://www.ebay.com/sch/i.html?_nkw=${escUrl(k)}&LH_Sold=1&LH_Complete=1" target="_blank" rel="noopener noreferrer" class="tag">${k} ↗</a>`
  );

  const tipItems = (item.listing_tips ?? []).map(t =>
    html`<li class="tip-item"><span class="tip-arrow">→</span>${t}</li>`
  );

  const flagItems = (item.risk_flags ?? []).filter(Boolean).map(f =>
    html`<li class="tip-item u-neg"><span class="tip-arrow u-neg">!</span>${f}</li>`
  );

  const defaultTips = html`
    <li class="tip-item"><span class="tip-arrow">→</span>Search eBay sold listings to verify price before buying</li>
    <li class="tip-item"><span class="tip-arrow">→</span>Use clear photos with neutral background</li>
    <li class="tip-item"><span class="tip-arrow">→</span>Include brand, model, and condition in your title</li>
    <li class="tip-item"><span class="tip-arrow">→</span>Check completed listings for accurate pricing</li>`;

  mount(el, html`
    <button class="back-btn" onclick="App.scanner.clearAndBack()">← New Analysis</button>

    <div class="decision-banner is-${decLower}">
      <span class="d-icon">${D_ICON[dec]}</span>
      <div class="u-flex-col">
        <div class="d-label">${D_LBL[dec]}</div>
        <div class="d-name">${item.item_name}</div>
        ${maxCostHint}
      </div>
      <div class="conf-pill">${item.confidence}%</div>
    </div>
    <div class="source-badge">[ AI ] Estimated · Buyer pays shipping · Verify with real eBay data</div>

    <div class="buy-action-bar">
      <div class="buy-action-title">What do you want to do?</div>
      <div class="buy-action-sub">Tap Buy to add this item to your inventory automatically.</div>
      <div class="buy-action-btns">
        <button class="action-btn action-buy" onclick="App.scanner.buyItem()">LIST<br><span style="font-weight:600;opacity:.9;font-size:var(--text-xs)">Add to Inventory</span></button>
        <button class="action-btn action-pass" onclick="App.scanner.clearAndBack()">SKIP<br><span style="font-weight:600;opacity:.9;font-size:var(--text-xs)">Move On</span></button>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Financial Breakdown</h3>
      <div class="data-row"><span class="dl">Avg Sold Price</span><span class="dv u-syne u-text-lg">$${(item.avg_sold_price ?? 0).toFixed(2)}</span></div>
      <div class="data-row"><span class="dl">Price Range</span><span class="dv">$${item.price_low} – $${item.price_high}</span></div>
      <hr class="divider">
      <div class="data-row"><span class="dl">Your Cost</span><span class="dv">$${cost.toFixed(2)}</span></div>
      <div class="data-row"><span class="dl">eBay Fee (${S.ebayFee}%)</span><span class="dv u-neg">-$${fee.toFixed(2)}</span></div>
      <div class="data-row"><span class="dl">Packaging</span><span class="dv u-neg">-$${S.pkgCost.toFixed(2)}</span></div>
      <div class="data-row"><span class="dl">Shipping</span>${shipLine}</div>
      <hr class="divider">
      <div class="data-row"><span class="dl u-text-md" style="font-weight:900">Net Profit</span><span class="dv u-syne u-text-xl ${profitClass(profit)}">$${profit.toFixed(2)}</span></div>
      <div class="data-row"><span class="dl">ROI</span><span class="dv u-syne u-text-lg ${roiClass(roi)}">${roi.toFixed(0)}%</span></div>
    </div>

    <div class="card">
      <h3 class="card-title">Market Intelligence</h3>
      <div class="data-row"><span class="dl">Demand</span><span class="dv u-text-md ${demandClass(item.demand_level)}">${item.demand_level}</span></div>
      <div class="data-row"><span class="dl">Sell-Through Rate</span><span class="dv ${strClass(item.sell_through_rate)}">${item.sell_through_rate}%</span></div>
      <div class="data-row"><span class="dl">Avg Days to Sell</span><span class="dv ${daysClass(item.avg_days_to_sell)}">${item.avg_days_to_sell} days</span></div>
      <div class="data-row"><span class="dl">Category</span><span class="dv">${item.category}</span></div>
      ${item.brand ? html`<div class="data-row"><span class="dl">Brand</span><span class="dv">${item.brand}</span></div>` : html``}
      <div class="u-mt-3">
        <div class="u-text-base u-soft u-mb-1" style="font-weight:600">AI Confidence: ${item.confidence}%</div>
        <div class="conf-bar-bg"><div class="conf-bar-fill ${confClass(item.confidence)}" style="width:${item.confidence}%"></div></div>
        <div class="u-text-base u-muted u-mt-1" style="line-height:1.5">${item.confidence_reason}</div>
      </div>
    </div>

    <div class="two-col">
      <div class="card">
        <h3 class="card-title">Listing Tips</h3>
        <ul class="tips-list">${tipItems.length ? tipItems : defaultTips}</ul>
      </div>
      <div class="card">
        <h3 class="card-title">Check This</h3>
        <div class="u-text-base u-soft" style="line-height:1.7;font-weight:500">${item.condition_notes || 'Inspect for cracks, missing parts, damage, and verify it powers on / functions correctly.'}</div>
        ${flagItems.length ? html`<ul class="tips-list u-mt-2">${flagItems}</ul>` : html``}
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">eBay Search Terms</h3>
      <div class="tags-wrap">${kwLinks}</div>
    </div>

    ${item.notes ? html`<div class="card"><h3 class="card-title">Notes</h3><div class="u-text-base u-soft" style="line-height:1.7;font-weight:500">${item.notes}</div></div>` : html``}

    <div class="legend-row">
      <span class="legend-item">Min profit: $${S.minProfit}</span>
      <span class="legend-item">Target ROI: ${S.targetRoi}%+</span>
      <span class="legend-item">Max: ${S.maxDays} days</span>
    </div>`);

  showSrcView('results');
}

// ── Shelf result ──────────────────────────────────────────────────────────

const SHELF_ICON = { HOT: '🔥', LIST: '✅', SKIP: '❌' };

/**
 * @param {object[]} shelfItems
 */
export function renderShelf(shelfItems) {
  const el = document.getElementById('shelf-content');
  if (!el) return;

  const S    = getSettings();
  const hot  = shelfItems.filter(i => i.decision === 'HOT');
  const list = shelfItems.filter(i => i.decision === 'LIST');
  const skip = shelfItems.filter(i => i.decision === 'SKIP');

  let gi = 0;
  const renderItem = item => {
    const idx      = gi++;
    const decLower = item.decision.toLowerCase();
    const mc       = calcMaxCost(item.avg_sold_price, S, S.minProfit);
    const mcHint   = mc > 0 ? html`<div class="s-max-cost">if item is under $${mc.toFixed(2)}</div>` : html``;
    return html`
      <div class="shelf-item is-${decLower}">
        <span class="s-badge">${SHELF_ICON[item.decision]} ${item.decision}</span>${mcHint}
        <div class="s-name">${item.item_name}</div>
        <div class="s-detail">
          <span class="u-pos" style="font-weight:900">~$${item.avg_sold_price} sold</span> &nbsp;·&nbsp;
          Est. profit: <span class="${profitClass(item.estimated_profit)}" style="font-weight:900">$${(item.estimated_profit ?? 0).toFixed(2)}</span> &nbsp;·&nbsp;
          <span class="${demandClass(item.demand_level)}">${item.demand_level} demand</span>
        </div>
        <div class="u-text-sm u-soft u-mt-1" style="line-height:1.5">${item.decision_reason}</div>
        ${item.condition_notes ? html`<div class="u-text-xs u-muted" style="margin-top:var(--space-1);font-style:italic">${item.condition_notes}</div>` : html``}
        ${item.decision !== 'SKIP' ? html`<button class="shelf-buy-btn" onclick="App.scanner.buyShelfItem(${idx})">List → Add to Inventory</button>` : html``}
      </div>`;
  };

  mount(el, html`
    <button class="back-btn" onclick="App.scanner.clearAndBack()">← New Scan</button>
    <div class="u-syne" style="font-size:var(--text-2xl);margin-bottom:var(--space-1);color:var(--text);font-weight:900">Shelf Report</div>
    <div class="u-muted" style="font-size:var(--text-base);margin-bottom:var(--space-4);font-weight:500">${shelfItems.length} items · ${hot.length + list.length} worth buying · ${skip.length} to skip</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2);margin-bottom:var(--space-4)">
      <div class="card u-center" style="padding:14px 6px"><div class="shelf-stat-num is-hot">${hot.length}</div><div class="u-text-xs u-muted" style="margin-top:var(--space-1);font-weight:700">HOT</div></div>
      <div class="card u-center" style="padding:14px 6px"><div class="shelf-stat-num is-list">${list.length}</div><div class="u-text-xs u-muted" style="margin-top:var(--space-1);font-weight:700">LIST</div></div>
      <div class="card u-center" style="padding:14px 6px"><div class="shelf-stat-num is-skip">${skip.length}</div><div class="u-text-xs u-muted" style="margin-top:var(--space-1);font-weight:700">SKIP</div></div>
    </div>
    ${hot.length  ? html`<div class="shelf-section-hdr is-hot">Grab These First</div>${hot.map(renderItem)}`        : html``}
    ${list.length ? html`<div class="shelf-section-hdr is-list u-mt-3">Worth Listing</div>${list.map(renderItem)}`  : html``}
    ${skip.length ? html`<div class="shelf-section-hdr is-skip u-mt-3">Skip These</div>${skip.map(renderItem)}`     : html``}`);

  showSrcView('shelf');
}
