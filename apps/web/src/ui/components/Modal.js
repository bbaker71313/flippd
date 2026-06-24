/**
 * In-app modal/confirm dialogs — replaces native browser confirm().
 * Uses the #app-confirm element in the HTML shell.
 */

/** @type {Function|null} */
let _onConfirm = null;

/**
 * Show a confirm dialog.
 * @param {{ title: string, message: string, okLabel?: string, onConfirm: () => void }} opts
 */
export function showConfirm({ title, message, okLabel = 'OK', onConfirm }) {
  _onConfirm = onConfirm;

  const overlay = document.getElementById('app-confirm');
  const titleEl = document.getElementById('app-confirm-title');
  const msgEl   = document.getElementById('app-confirm-message');
  const okBtn   = document.getElementById('app-confirm-ok');

  if (!overlay) { if (window.confirm(message)) onConfirm(); return; }

  if (titleEl) titleEl.textContent = title;
  if (msgEl)   msgEl.textContent   = message;
  if (okBtn)   okBtn.textContent   = okLabel;

  overlay.style.display = 'flex';
}

/**
 * Handle user response — call from HTML onclick attributes.
 * @param {boolean} confirmed
 */
export function respondConfirm(confirmed) {
  const overlay = document.getElementById('app-confirm');
  if (overlay) overlay.style.display = 'none';

  if (confirmed && _onConfirm) _onConfirm();
  _onConfirm = null;
}

/**
 * Show a drill-down info modal.
 * @param {string} title
 * @param {string} contentHtml
 */
export function showInfoModal(title, contentHtml) {
  const overlay  = document.getElementById('drilldown-modal');
  const titleEl  = document.getElementById('drilldown-title');
  const bodyEl   = document.getElementById('drilldown-body');

  if (!overlay) return;
  if (titleEl) titleEl.textContent = title;
  if (bodyEl)  bodyEl.innerHTML    = contentHtml;
  overlay.style.display = 'flex';
}

/** Close the info/drill-down modal. */
export function closeInfoModal() {
  const overlay = document.getElementById('drilldown-modal');
  if (overlay) overlay.style.display = 'none';
}
