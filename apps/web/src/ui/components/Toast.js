/**
 * Toast notification component.
 * Renders into #toast — one active toast at a time with auto-dismiss.
 */

let _dismissTimer = null;

/**
 * Show a toast notification.
 * @param {string} message
 * @param {number} [duration=2500]
 */
export function showToast(message, duration = 2500) {
  const el = document.getElementById('toast');
  if (!el) return;

  el.textContent = message;
  el.classList.add('visible');

  if (_dismissTimer) clearTimeout(_dismissTimer);
  _dismissTimer = setTimeout(() => {
    el.classList.remove('visible');
    _dismissTimer = null;
  }, duration);
}
