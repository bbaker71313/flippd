/**
 * Today's scan history card — rendered below the scanner input.
 */

import { loadScanLog }    from '../../services/storage/local.js';
import { html, mount }    from '../util/esc.js';

const decStyle = dec => {
  if (dec === 'HOT' || dec === 'LIST') return 'background:var(--green-bg);color:var(--green)';
  if (dec === 'SKIP')                  return 'background:var(--red-bg);color:var(--red)';
  return 'background:var(--bg);color:var(--muted)';
};

export function renderScanHistory() {
  const el = document.getElementById('scan-history');
  if (!el) return;

  const today      = new Date().toDateString();
  const log        = loadScanLog();
  const todayScans = log.filter(s => new Date(s.ts).toDateString() === today).slice(0, 5);

  if (!log.length) {
    mount(el, html`<div style="text-align:center;padding:20px 16px;color:var(--muted);font-size:12px;line-height:1.6">Your scan history will appear here.<br>Scan an item above to get started.</div>`);
    return;
  }

  if (!todayScans.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';

  const totalPotential = todayScans
    .filter(s => s.bought)
    .reduce((a, s) => a + (s.potentialProfit ?? 0), 0);

  mount(el, html`
    <div class="card" style="margin-top:12px">
      <div class="flex-between-center mb-10">
        <h3 class="card-title mb-0">Today's Scans</h3>
        ${totalPotential > 0
          ? html`<div style="font-size:12px;color:var(--green);font-family:'IBM Plex Mono',monospace;font-weight:700">+$${totalPotential.toFixed(0)} potential</div>`
          : html``}
      </div>
      ${todayScans.map(s => html`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px">
          <div class="flex-1-min0">
            <div style="font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.name || 'Unknown item'}</div>
            <div style="color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:10px">${new Date(s.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:800;font-family:'IBM Plex Mono',monospace;flex-shrink:0;margin-left:8px;${decStyle(s.dec)}">${s.dec || '—'}</span>
        </div>`)}
    </div>`);
}
