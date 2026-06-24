/**
 * Application entry point.
 *
 * Boot sequence (order matters):
 *  1. Migrate stale localStorage keys (pre-rebrand legacy data)
 *  2. Init auth — wire JWT provider before any API calls
 *  3. Init state slices (items, settings)
 *  4. Wire tab router
 *  5. Restore session (check server for valid JWT)
 *  6. Handle eBay OAuth callback params if present
 *  7. Show initial view (auth wall or app)
 *
 * This file has NO business logic. It delegates everything to
 * features, state slices, and services.
 */

import { migrateStaleKeys }      from './services/storage/local.js';
import { initAuth, restoreSession } from './features/auth.js';
import { initItems }             from './state/ItemsSlice.js';
import { initSettings }          from './state/SettingsSlice.js';
import { initTabRouter, switchTab } from './router/tabs.js';
import { bus }                   from './state/AppState.js';
import { parseOAuthCallback, clearOAuthParams } from './services/ebay.service.js';
import { showToast }             from './ui/components/Toast.js';

// ── Startup ───────────────────────────────────────────────────────────────

async function boot() {
  // Step 1 — migrate legacy storage keys before reading anything
  migrateStaleKeys();

  // Step 2 — wire auth (must happen before any apiFetch calls)
  initAuth();

  // Step 3 — init state
  initSettings();
  initItems();

  // Step 4 — wire navigation
  initTabRouter();

  // Step 5 — restore session
  const user = await restoreSession();

  // Step 6 — handle eBay OAuth callback
  const oauthResult = parseOAuthCallback();
  if (oauthResult.result === 'success') {
    showToast('Connected to eBay!');
    clearOAuthParams();
  } else if (oauthResult.result === 'error') {
    showToast('eBay connection failed: ' + oauthResult.error);
    clearOAuthParams();
  }

  // Step 7 — show initial view
  if (user) {
    showApp();
  } else {
    showAuth();
  }
}

function showApp() {
  const authEl = document.getElementById('auth-screen');
  const appEl  = document.getElementById('app-root');
  if (authEl) authEl.style.display = 'none';
  if (appEl)  appEl.style.display  = 'block';
  switchTab('sourcing');
}

function showAuth() {
  const authEl = document.getElementById('auth-screen');
  const appEl  = document.getElementById('app-root');
  if (authEl) authEl.style.display = 'flex';
  if (appEl)  appEl.style.display  = 'none';
}

// ── Event subscriptions ───────────────────────────────────────────────────

bus.on('auth:loggedIn',  () => showApp());
bus.on('auth:loggedOut', () => showAuth());

// ── Boot ──────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
