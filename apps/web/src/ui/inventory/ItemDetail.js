/**
 * Item detail views — read-only Sold overlay and editable detail panel.
 */

import { getSettings }    from '../../state/SettingsSlice.js';
import { calcProfit }     from '../../core/profit.js';
import { CAT_ICONS }      from '../../core/categories.js';
import { html, mount }    from '../util/esc.js';
import { showInvView }    from '../../router/tabs.js';

/**
 * Full-screen read-only overlay for a Sold item.
 * Appended to body; removed by the back button.
 * @param {object} item
 * @param {string[]} photos
 */
export function showSoldDetail(item, photos = []) {
  const S          = getSettings();
  const soldPrice  = parseFloat(item.soldPrice ?? item.sold_price ?? 0);
  const cost       = parseFloat(item.cost) || 0;
  const ebayFeeAmt = soldPrice * ((S.ebayFee ?? 13) / 100);
  const pkgAmt     = S.pkgCost ?? 1.25;
  const shipAmt    = S.shipping === 'seller' ? (S.shipCost ?? 6) : 0;
  const netProfit  = soldPrice - cost - ebayFeeAmt - pkgAmt - shipAmt;
  const roi        = cost > 0 ? ((netProfit / cost) * 100).toFixed(0) : 'N/A';

  const thumbUrl = photos[0] ?? item.photo_urls?.[0] ?? item.photos?.[0] ?? item.main_photo_url ?? null;

  const existing = document.getElementById('sold-detail-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'sold-detail-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--bg);z-index:200;overflow-y:auto;padding:16px;box-sizing:border-box';

  mount(overlay, html`
    <button class="back-btn" onclick="document.getElementById('sold-detail-overlay').remove()">← Back</button>
    <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:900;color:var(--text);margin:12px 0 4px">${item.nickname}</div>
    <span class="status-badge status-Sold">Sold</span>
    ${thumbUrl ? html`<img src="${thumbUrl}" loading="lazy" style="width:100%;max-height:200px;object-fit:contain;border-radius:8px;border:1px solid var(--border);margin:12px 0;display:block" alt="">` : html``}
    <div class="card" style="margin:12px 0">
      <div style="font-size:10px;letter-spacing:0.14em;font-weight:800;color:var(--muted);margin-bottom:8px">LISTING DATA</div>
      <div style="font-size:13px;line-height:2;color:var(--text)">
        <b>SKU:</b> ${item.sku || '—'}<br>
        <b>Category:</b> ${item.category || '—'}<br>
        <b>Condition:</b> ${item.condition || '—'}<br>
        ${item.notes ? html`<b>Notes:</b> ${item.notes}` : html``}
      </div>
    </div>
    <div class="card" style="margin:12px 0">
      <div style="font-size:10px;letter-spacing:0.14em;font-weight:800;color:var(--muted);margin-bottom:8px">PROFIT BREAKDOWN</div>
      <div style="font-size:13px;line-height:2.2;color:var(--text)">
        <div class="flex-between"><span>Sale price</span><span>$${soldPrice.toFixed(2)}</span></div>
        <div class="flex-between"><span>Cost paid</span><span>−$${cost.toFixed(2)}</span></div>
        <div class="flex-between"><span>eBay fee (${S.ebayFee ?? 13}%)</span><span>−$${ebayFeeAmt.toFixed(2)}</span></div>
        <div class="flex-between"><span>Packaging</span><span>−$${pkgAmt.toFixed(2)}</span></div>
        ${shipAmt > 0 ? html`<div class="flex-between"><span>Shipping</span><span>−$${shipAmt.toFixed(2)}</span></div>` : html``}
        <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:6px;margin-top:4px;font-weight:700">
          <span>Net Profit</span><span class="${netProfit >= 0 ? 'u-pos' : 'u-neg'}">$${netProfit.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;color:var(--muted);font-size:12px"><span>ROI</span><span>${roi}%</span></div>
      </div>
    </div>
    <button class="btn btn-amber" style="width:100%;margin-top:8px" onclick="document.getElementById('sold-detail-overlay').remove();App.inventory.confirmRelist(${item.id})">Relist This Item</button>`);

  document.body.appendChild(overlay);
}

/**
 * Inventory detail panel (in-page, not full screen).
 * @param {object} item
 * @param {string[]} photos
 */
export function showDetail(item, photos = []) {
  const S       = getSettings();
  const profit  = calcProfit(item.cost, item.sellPrice, S);
  const profitCls = profit >= S.minProfit ? 'u-pos' : 'u-neg';

  const galleryHtml = photos.length
    ? html`<div class="photo-gallery">${photos.map((p, i) => html`<img src="${p}" alt="Photo ${i + 1}" loading="lazy" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">`)}</div>`
    : html``;

  const contentEl = document.getElementById('inv-detail-content');
  if (!contentEl) return;

  mount(contentEl, html`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-3)">
      <div>
        <div class="detail-item-sku">${item.sku || ''}</div>
        <div class="detail-item-name">${item.nickname}</div>
      </div>
      <span class="status-badge status-${item.status}">${item.status}</span>
    </div>
    ${item.created_from && item.created_from !== 'manual'
      ? html`<div class="ai-sourced-badge">AI Sourced${item.sourcing_meta?.scanned_at ? ' · ' + new Date(item.sourcing_meta.scanned_at).toLocaleDateString() : ''}${item.sourcing_meta?.confidence ? ` · ${item.sourcing_meta.confidence}% confidence` : ''}</div>`
      : html``}
    ${galleryHtml}
    <div class="detail-grid">
      <div class="detail-box"><div class="d-lbl">Category</div><div class="d-val">${CAT_ICONS[item.category] || ''} ${item.category}</div></div>
      <div class="detail-box"><div class="d-lbl">Condition</div><div class="d-val">${item.condition}</div></div>
      <div class="detail-box"><div class="d-lbl">Date</div><div class="d-val">${item.dateAcquired}</div></div>
      <div class="detail-box"><div class="d-lbl">Platform</div><div class="d-val">${item.platform}</div></div>
      <div class="detail-box"><div class="d-lbl">Cost</div><div class="d-val">$${item.cost || '0.00'}</div></div>
      <div class="detail-box"><div class="d-lbl">Sell Price</div><div class="d-val">$${item.sellPrice || '0.00'}</div></div>
      <div class="detail-box"><div class="d-lbl">eBay Fees</div><div class="d-val u-neg">-$${((parseFloat(item.sellPrice) || 0) * (S.ebayFee / 100)).toFixed(2)}</div></div>
      <div class="detail-box" style="background:var(--green-bg);border-color:var(--green-border)">
        <div class="d-lbl">Est. Profit</div>
        <div class="detail-profit-val ${profitCls}">$${profit.toFixed(2)}</div>
      </div>
    </div>
    ${item.notes ? html`<div class="notes-box"><div class="d-lbl u-mb-1">Notes / Flaws</div><div class="u-soft" style="font-size:var(--text-base);line-height:1.6">${item.notes}</div></div>` : html``}
    <div class="btn-row">
      <button class="sm-btn sm-btn-primary" onclick="App.inventory.startEdit(${item.id})">Edit</button>
      <button class="sm-btn" style="background:#185FA5;color:#fff" onclick="App.photos.openFor(${item.id})">Photos</button>
      ${item.status !== 'Sold' ? html`<button class="sm-btn" style="background:#2D6B52;color:#fff" onclick="App.inventory.openSoldModal(${item.id})">Mark Sold</button>` : html``}
      <button class="sm-btn sm-btn-danger" onclick="App.inventory.deleteItem(${item.id})">Delete</button>
    </div>`);

  const backBtn = document.getElementById('inv-detail-back');
  if (backBtn) backBtn.onclick = () => showInvView('list');

  showInvView('detail');
}
