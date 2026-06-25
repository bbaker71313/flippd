/**
 * Auth panel UI controller.
 * Manages form mode switching and error display.
 * The actual auth logic lives in features/auth.js.
 */

import { html, mount } from '../util/esc.js';

/** @type {'login'|'register'|'verify'|'forgot'|'reset'} */
let _mode = 'login';

export function getCurrentMode() { return _mode; }

/**
 * Switch the auth form between login / register / verify / forgot / reset.
 * @param {'login'|'register'|'verify'|'forgot'|'reset'} mode
 */
export function renderAuthMode(mode) {
  _mode = mode;

  const isRegister = mode === 'register';
  const isVerify   = mode === 'verify';
  const isForgot   = mode === 'forgot';
  const isReset    = mode === 'reset';
  const isLogin    = !isRegister && !isVerify && !isForgot && !isReset;

  // Tab active states
  const tabLogin    = document.getElementById('auth-tab-login');
  const tabRegister = document.getElementById('auth-tab-register');
  if (tabLogin) {
    tabLogin.style.background = isLogin ? 'var(--accent)' : 'transparent';
    tabLogin.style.color      = isLogin ? '#000' : 'var(--muted)';
  }
  if (tabRegister) {
    tabRegister.style.background = isRegister ? 'var(--accent)' : 'transparent';
    tabRegister.style.color      = isRegister ? '#000' : 'var(--muted)';
  }

  // Field group visibility
  _show('auth-login-fields',    isLogin);
  _show('auth-register-fields', isRegister);
  _show('auth-verify-screen',   isVerify);
  _show('auth-forgot-screen',   isForgot);
  _show('auth-reset-screen',    isReset);
  _show('auth-actions',         !isVerify && !isForgot && !isReset);

  // Submit button label
  const submitBtn = document.getElementById('auth-submit-btn');
  if (submitBtn) {
    submitBtn.textContent = isRegister ? 'Create Account →' : 'Log In →';
  }

  // Hint text
  const hintEl = document.getElementById('auth-hint');
  if (hintEl) {
    hintEl.textContent = isRegister
      ? '7-day free trial. No credit card required.'
      : 'Log in to your ScanForProfit account.';
  }

  // Forgot link
  const forgotEl = document.getElementById('auth-forgot');
  if (forgotEl) forgotEl.style.display = isRegister ? 'none' : 'block';

  clearAuthError();
}

/**
 * Show an error message in the auth form.
 * Accepts a plain text message — rendered as text, not HTML.
 * @param {string} message
 */
export function showAuthError(message) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  // Use textContent for plain-text errors to guarantee no HTML injection.
  el.textContent    = message;
  el.style.display  = 'block';
}

/**
 * Show an auth error that contains a safe HTML link (e.g. "log in here").
 * Only call this with a SafeHtml value from html`...`.
 * @param {import('../util/esc.js').SafeHtml} safeTemplate
 */
export function showAuthErrorHtml(safeTemplate) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  mount(el, safeTemplate);
  el.style.display = 'block';
}

export function clearAuthError() {
  const el = document.getElementById('auth-error');
  if (el) {
    el.textContent   = '';
    el.style.display = 'none';
  }
}

/**
 * Set the email address shown on the verify-email screen.
 * @param {string} email
 */
export function showVerifyScreen(email) {
  const emailEl = document.getElementById('auth-verify-email');
  if (emailEl) emailEl.textContent = email; // textContent — safe
  renderAuthMode('verify');
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _show(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? 'block' : 'none';
}
