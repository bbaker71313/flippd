/**
 * P&L Dashboard renderer.
 */

import { getItems }    from '../../state/ItemsSlice.js';
import { getSettings } from '../../state/SettingsSlice.js';
import { html, mount } from '../util/esc.js';

/** @type {'7d'|'30d'|'90d'|'all'} */
let _timeframe = '30d';

export function getTimeframe()     { return _timeframe; }
export function setTimeframe(tf)   { _timeframe = tf; renderDashboard(); }

function timeframeStart(tf) {
  const now = new Date();
  if (tf === '7d')  { const d = new Date(now); d.setDate(d.getDate() - 7);   return d; }
  if (tf === '30d') { const d = new Date(now); d.setDate(d.getDate() - 30);  return d; }
  if (tf === '90d') { const d = new Date(now); d.setDate(d.getDate() - 90);  return d; }
  return new Date(0);
}

export function renderDashboard() {
  const el = document.getElementById('dash-content');
  if (!el) return;

  const items  = getItems();
  const S      = getSettings();
  const tfStart = timeframeStart(_timeframe);

  // Update timeframe button styles
  document.querySelectorAll('.dash-tf-btn').forEach(b => {
    const active = b.dataset.tf === _timeframe;
    b.style.background   = active ? 'var(--accent)' : 'var(--card)';
    b.style.color        = active ? '#000' : 'var(--soft)';
    b.style.borderColor  = active ? 'var(--accent)' : 'var(--border)';
  });

  const dateEl = document.getElementById('dash-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const allSold = items.filter(i => i.status === 'Sold');
  const sold    = allSold.filter(i => new Date(i.soldDate ?? i.sold_at ?? i.createdAt) >= tfStart);

  const sp    = i => parseFloat(i.soldPrice ?? i.sold_price ?? i.sellPrice ?? 0);
  const cost  = i => parseFloat(i.cost) || 0;
  const fee   = i => sp(i) * (S.ebayFee / 100) + S.pkgCost;
  const net   = i => sp(i) - cost(i) - fee(i);

  const totalSales    = sold.reduce((s, i) => s + sp(i), 0);
  const totalCosts    = sold.reduce((s, i) => s + cost(i), 0);
  const totalFees     = sold.reduce((s, i) => s + fee(i), 0);
  const netProfit     = totalSales - totalCosts - totalFees;
  const margin        = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : '0.0';
  const roi           = totalCosts > 0 ? ((netProfit / totalCosts) * 100).toFixed(0) : 'N/A';

  // Category breakdown
  const catMap = {};
  sold.forEach(i => {
    const cat = i.category || 'Other';
    if (!catMap[cat]) catMap[cat] = { profit: 0, count: 0 };
    catMap[cat].profit += net(i);
    catMap[cat].count++;
  });
  const cats = Object.entries(catMap).sort((a, b) => b[1].profit - a[1].profit);

  // Monthly trend (last 6 months)
  const months = [];
  for (let m = 5; m >= 0; m--) {
    const d      = new Date();
    d.setMonth(d.getMonth() - m);
    const label  = d.toLocaleDateString('en-US', { month: 'short' });
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const mEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const mSold  = allSold.filter(i => { const dt = new Date(i.soldDate ?? i.sold_at ?? i.createdAt); return dt >= mStart && dt <= mEnd; });
    months.push({ label, profit: mSold.reduce((s, i) => s + net(i), 0), sales: mSold.reduce((s, i) => s + sp(i), 0) });
  }
  const maxVal = Math.max(...months.map(m => Math.max(m.profit, m.sales)), 1);

  const topItems = [...sold].map(i => ({ ...i, _net: net(i) })).sort((a, b) => b._net - a._net).slice(0, 5);
  const atRisk   = [...sold].map(i => ({ ...i, _net: net(i) })).filter(i => i._net < 0).slice(0, 5);

  const recentSold = [...sold]
    .sort((a, b) => new Date(b.soldDate ?? b.sold_at ?? b.createdAt) - new Date(a.soldDate ?? a.sold_at ?? a.createdAt))
    .slice(0, 10);

  mount(el, html`
    <div class="ph-kpi-grid">
      <div class="ph-kpi"><div class="ph-kpi-val" style="color:var(--green)">$${totalSales.toFixed(0)}</div><div class="ph-kpi-label">Total Sales</div></div>
      <div class="ph-kpi"><div class="ph-kpi-val" style="color:var(--red)">$${totalCosts.toFixed(0)}</div><div class="ph-kpi-label">Total Costs</div></div>
      <div class="ph-kpi"><div class="ph-kpi-val" style="color:var(--yellow)">$${totalFees.toFixed(0)}</div><div class="ph-kpi-label">Total Fees</div></div>
      <div class="ph-kpi"><div class="ph-kpi-val" style="color:${netProfit >= 0 ? 'var(--green)' : 'var(--red)'}">$${netProfit.toFixed(0)}</div><div class="ph-kpi-label">Net Profit</div></div>
      <div class="ph-kpi"><div class="ph-kpi-val">${margin}%</div><div class="ph-kpi-label">Margin</div></div>
      <div class="ph-kpi"><div class="ph-kpi-val">${roi}%</div><div class="ph-kpi-label">ROI</div></div>
    </div>

    <div class="ph-section-title">Sales Trends</div>
    <div class="ph-card">
      <div style="font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;margin-bottom:6px">Monthly Profit (last 6 months)</div>
      <div class="ph-chart-bar-wrap">
        ${months.map(m => html`
          <div style="flex:1;display:flex;flex-direction:column;align-items:center">
            <div class="ph-bar" style="height:${Math.max(2, Math.round((Math.max(0, m.profit) / maxVal) * 56))}px;background:${m.profit >= 0 ? 'var(--green)' : 'var(--red)'}"></div>
            <div class="ph-bar-label">${m.label}</div>
          </div>`)}
      </div>
    </div>

    <div class="ph-section-title">Category Performance</div>
    <div class="ph-card">
      ${cats.length
        ? html`<table class="ph-table">
            <thead><tr><th>Category</th><th>Items</th><th>Profit</th></tr></thead>
            <tbody>${cats.slice(0, 8).map(([cat, d]) => html`
              <tr>
                <td>${cat}</td>
                <td>${d.count}</td>
                <td style="color:${d.profit >= 0 ? 'var(--green)' : 'var(--red)'}">$${d.profit.toFixed(2)}</td>
              </tr>`)}</tbody>
          </table>`
        : html`<div style="font-size:12px;color:var(--muted);padding:8px 0">No sold items this period.</div>`}
    </div>

    <div class="ph-section-title">Top Performers</div>
    <div class="ph-card">
      ${topItems.length
        ? html`<table class="ph-table">
            <thead><tr><th>Item</th><th>Profit</th></tr></thead>
            <tbody>${topItems.map(i => html`
              <tr>
                <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i.nickname}</td>
                <td style="color:var(--green)">$${i._net.toFixed(2)}</td>
              </tr>`)}</tbody>
          </table>`
        : html`<div style="font-size:12px;color:var(--muted);padding:8px 0">No sold items yet.</div>`}
    </div>

    ${atRisk.length ? html`
      <div class="ph-section-title">At Risk Items</div>
      <div class="ph-card">
        <table class="ph-table">
          <thead><tr><th>Item</th><th>Loss</th></tr></thead>
          <tbody>${atRisk.map(i => html`
            <tr>
              <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i.nickname}</td>
              <td style="color:var(--red)">$${i._net.toFixed(2)}</td>
            </tr>`)}</tbody>
        </table>
      </div>` : html``}

    <div class="ph-section-title">Recent Sales</div>
    <div class="ph-card">
      ${recentSold.length
        ? html`<table class="ph-table">
            <thead><tr><th>Item</th><th>Sold $</th><th>Profit</th></tr></thead>
            <tbody>${recentSold.map(i => { const p = net(i); return html`
              <tr>
                <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i.nickname}</td>
                <td>$${sp(i).toFixed(2)}</td>
                <td style="color:${p >= 0 ? 'var(--green)' : 'var(--red)'}">$${p.toFixed(2)}</td>
              </tr>`; })}</tbody>
          </table>`
        : html`<div style="font-size:12px;color:var(--muted);padding:8px 0">No sold items this period.</div>`}
    </div>`);
}
