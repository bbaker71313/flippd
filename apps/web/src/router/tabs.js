/**
 * Tab navigation router.
 * Owns all show/hide logic for tabs and sub-views.
 * No business logic here — pure presentation routing.
 */

import { setActiveTab, setSrcView, setInvView } from '../state/AppState.js';
import { bus } from '../state/AppState.js';

const TABS = ['sourcing', 'inventory', 'photos', 'growth', 'dashboard'];

/**
 * Switch the active top-level tab.
 * @param {string} tab - one of TABS
 */
export function switchTab(tab) {
  if (!TABS.includes(tab)) return;

  TABS.forEach(t => {
    const pane = document.getElementById(`tab-${t}`);
    if (pane) pane.style.display = t === tab ? 'block' : 'none';
  });

  // Update nav button states
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  setActiveTab(tab);
  window.scrollTo(0, 0);
  bus.emit('nav:tabSwitched', { tab });
}

/**
 * Show a scanner sub-view; hide all others.
 * @param {'input'|'results'|'shelf'|'settings'|'setup'} view
 */
export function showSrcView(view) {
  const views = ['setup', 'settings', 'input', 'results', 'shelf', 'reset'];
  views.forEach(v => {
    const el = document.getElementById(`src-view-${v}`);
    if (el) el.style.display = v === view ? 'block' : 'none';
  });
  setSrcView(view);
  window.scrollTo(0, 0);

  if (view === 'input') {
    const prompt = document.getElementById('first-scan-prompt');
    if (prompt) prompt.style.display = 'block';
  }
}

/**
 * Show an inventory sub-view; hide all others.
 * @param {'home'|'list'|'detail'|'form'} view
 */
export function showInvView(view) {
  const views = ['home', 'list', 'detail', 'form'];
  views.forEach(v => {
    const el = document.getElementById(`inv-view-${v}`);
    if (el) el.style.display = v === view ? 'block' : 'none';
  });
  setInvView(view);
  window.scrollTo(0, 0);
}

/**
 * Wire tab button click handlers on DOMContentLoaded.
 * Call once from app.js during bootstrap.
 */
export function initTabRouter() {
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}
