/**
 * Growth Agent render functions.
 * Accepts structured AI response data and renders it into the DOM.
 * No state or data-fetching — pure render from structured objects.
 */

import { html, mount, trust, esc } from '../util/esc.js';

const _HUNT_ICON = trust(
  '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<circle cx="9" cy="9" r="5.5" stroke="currentColor" stroke-width="1.5"/>' +
  '<circle cx="9" cy="9" r="2" fill="currentColor"/>' +
  '<line x1="9" y1="1" x2="9" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
  '<line x1="9" y1="14" x2="9" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
  '<line x1="1" y1="9" x2="4" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
  '<line x1="14" y1="9" x2="17" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
  '</svg>'
);

/**
 * Render full growth agent results into their fixed DOM containers.
 * @param {object} r  Growth Agent response JSON
 */
export function renderGrowthResults(r) {
  const scoreCard = document.getElementById('growth-score-card');
  if (scoreCard) {
    mount(scoreCard, html`
      <div style="display:flex;align-items:center;gap:18px">
        <div>
          <div class="score-big" style="color:${esc(r.score_color || 'var(--green)')}">${r.business_score}</div>
          <div class="score-label">Business Score</div>
        </div>
        <div class="flex-1">
          <div class="u-syne u-bold9" style="font-size:var(--text-lg);margin-bottom:var(--space-1)">${r.score_label}</div>
          <div class="u-text-base u-soft" style="line-height:1.5">${r.score_summary}</div>
        </div>
      </div>`);
  }

  // Top categories
  const topContent = document.getElementById('growth-top-content');
  if (topContent) {
    const cats = r.top_categories || [];
    if (cats.length) {
      mount(topContent, html`${cats.map(c => html`
        <div class="growth-cat-row">
          <div class="flex-1-min0">
            <div class="growth-cat-name">${c.name}</div>
            <div class="growth-cat-sub">${c.insight}</div>
            <div class="growth-bar-bg"><div class="growth-bar-fill" style="width:${esc(String(c.bar_pct || 0))}%"></div></div>
          </div>
          <div class="growth-profit">${c.profit}</div>
        </div>`)}`);
    } else {
      mount(topContent, html`<div class="u-text-base u-muted" style="padding:var(--space-2) 0">No sales data yet. Keep listing!</div>`);
    }
  }

  // Stale items
  const staleContent = document.getElementById('growth-stale-content');
  if (staleContent) {
    const staleFiltered = (r.stale_actions || []).filter(i => !i.action.toLowerCase().includes('bundle'));
    if (staleFiltered.length) {
      mount(staleContent, html`${staleFiltered.map(item => {
        const act = item.action.toLowerCase();
        const isDropPrice = act.includes('drop') || (act.includes('price') && !act.includes('relist'));
        const isRelist    = act.includes('relist');
        const skuJs = JSON.stringify(item.sku || '');
        const nameJs = JSON.stringify(item.name || '');
        const badge = isDropPrice
          ? html`<span class="stale-action cursor-ptr" onclick="${trust(`App.growth.openDropPrice(${skuJs},${nameJs})`)}" title="View recommended price drop">↓ ${item.action}</span>`
          : isRelist
            ? html`<span class="stale-action" style="cursor:pointer;background:rgba(212,168,67,0.12);border-color:var(--accent);color:var(--accent)" onclick="${trust(`App.growth.openRelist(${skuJs},${nameJs})`)}" title="Relist as new">↺ ${item.action}</span>`
            : html`<span class="stale-action">${item.action}</span>`;
        return html`
          <div class="stale-item cursor-ptr" onclick="${trust(`App.growth.goToStaleItem(${skuJs})`)}" role="button" tabindex="0">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <div class="stale-name">${item.name}</div>
                <div class="stale-meta">${item.sku || ''} · Listed ${item.days} days</div>
                <div class="u-text-sm u-soft u-mt-1">${item.reason}</div>
              </div>
              ${badge}
            </div>
          </div>`;
      })}`);
    } else {
      mount(staleContent, html`<div class="u-text-base u-pos" style="padding:var(--space-2) 0">✓ No stale listings. Great turnover!</div>`);
    }
  }

  // Hunt list
  const huntContent = document.getElementById('growth-hunt-content');
  if (huntContent) {
    const hunts = r.hunt_list || [];
    if (hunts.length) {
      mount(huntContent, html`${hunts.map(h => html`
        <div class="hunt-item">
          <div class="hunt-icon">${h.icon ? esc(h.icon) : _HUNT_ICON}</div>
          <div>
            <div class="hunt-name">${h.item} <span class="hunt-priority ${h.priority === 'HIGH' ? 'is-high' : 'is-warn'}">${h.priority}</span></div>
            <div class="hunt-why">${h.why}</div>
          </div>
        </div>`)}`);
    } else {
      mount(huntContent, html`<div class="u-text-base u-muted" style="padding:var(--space-2) 0">Run refresh to get hunt list</div>`);
    }
  }

  // Market trends
  const trendContent = document.getElementById('growth-market-content');
  if (trendContent) {
    const trends = r.market_trends || [];
    if (trends.length) {
      mount(trendContent, html`${trends.map(t => html`
        <div class="trend-item">
          <div class="trend-arrow">${t.arrow || ''}</div>
          <div>
            <div class="trend-name">${t.category}</div>
            <div class="trend-detail">${t.detail}</div>
          </div>
        </div>`)}`);
    } else {
      mount(trendContent, html`<div class="u-text-base u-muted" style="padding:var(--space-2) 0">Tap Refresh to pull live market data</div>`);
    }
  }

  // Advisor message — may contain basic HTML from AI; DOMPurify in mount() sanitizes it
  const adviceContent = document.getElementById('growth-advice-content');
  if (adviceContent) {
    mount(adviceContent, html`${r.advisor_message || ''}`);
  }

  const resultsEl = document.getElementById('growth-results');
  if (resultsEl) resultsEl.style.display = 'block';
}

/**
 * Render trending keyword panel into a given element.
 * @param {{ hot_tip?: string, keywords: Array, trending_categories?: string[] }} data
 * @param {HTMLElement} el
 */
export function renderTrendingKeywords(data, el) {
  if (!el || !data) return;

  const hotTipSection = data.hot_tip
    ? html`<div style="background:var(--green-bg);border:1px solid var(--green-border);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--green);font-weight:600;margin-bottom:12px">${data.hot_tip}</div>`
    : html``;

  const keywords = (data.keywords || []).map(k => html`
    <div class="trend-keyword">
      <div class="trend-rank">${k.rank}</div>
      <div class="trend-word">${k.word}</div>
      <div class="flex-center-6">
        <div class="trend-bar-wrap"><div class="trend-bar-inner" style="width:${esc(String(k.bar || 50))}%"></div></div>
        <span style="font-size:10px;${k.trend === 'up' ? 'color:var(--green)' : k.trend === 'down' ? 'color:var(--red)' : 'color:var(--muted)'}">${k.trend === 'up' ? '↑' : k.trend === 'down' ? '↓' : '→'}</span>
      </div>
    </div>`);

  const catSection = data.trending_categories?.length
    ? html`
      <div style="font-size:10px;letter-spacing:0.15em;color:var(--muted);font-weight:800;margin:12px 0 6px;text-transform:uppercase;font-family:'IBM Plex Mono',monospace">Trending Categories</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${data.trending_categories.map(c => html`<span style="background:var(--yellow-bg);border:1px solid var(--yellow);border-radius:10px;padding:3px 10px;font-size:12px;color:var(--yellow);font-weight:600">${c}</span>`)}</div>`
    : html``;

  mount(el, html`
    ${hotTipSection}
    <div style="font-size:10px;letter-spacing:0.15em;color:var(--muted);font-weight:800;margin-bottom:8px;text-transform:uppercase;font-family:'IBM Plex Mono',monospace">Top 10 eBay Searches Right Now</div>
    ${keywords}
    ${catSection}`);
}
