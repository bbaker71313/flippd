# Flippd — Changelog

All notable changes to Flippd are documented here.
Format: [Version] — Date — Summary of changes and *why* they were made.

---

## [v4.0] — April 25, 2026

### Why this version exists
v3 fixed bugs. v4 fixed the product. The app was built from the inside out — written by a developer for a developer. v4 is the first version a stranger could open and understand without explanation.

### Breaking changes
- **API key wall removed.** Users no longer need an Anthropic API key. The welcome screen now accepts a simple access code. The underlying architecture supports a proxy backend (PROXY_URL constant) — when the Manus proxy is wired in, users just open the app and it works.
- **8 tabs collapsed to 5.** EXPORT and IMPORT are no longer top-level tabs — they live as buttons inside INVENTORY. P&L is no longer a separate tab — it lives inside STATS as a sub-nav. This matches how resellers actually think about their workflow.
- **Storage key migrated.** `ebayhq_items_v1` → `flippd_items_v1`. A one-time migration shim runs on first load, preserving all existing data.

### New features
- **Access code unlock** — any non-empty code unlocks the app. Ready to swap for proxy-based auth.
- **PROXY_URL config** — one line change to route all API calls through a backend proxy.
- **Stats + P&L combined** — STATS tab has Overview/P&L sub-nav. Expenses, monthly breakdown, and mileage logger all accessible from one place.
- **Empty states on every tab** — inventory, scan history, photos, trends all have human prompts instead of blank screens.
- **Analytics event tracking** — `trackEvent()` fires on scan_completed, item_added, item_sold, tab_viewed. Stored in `flippd_events` (last 500), ready to pipe to any analytics tool.
- **Seed data on first visit only** — `flippd_seeded` flag prevents demo data from reloading after a user clears their inventory.

### Bug fixes (from v3)
- **claude-sonnet-4-6** — all 3 API calls updated from claude-sonnet-4-5.
- **iOS camera race condition** — `requestAnimationFrame` defers `.click()` until after DOM replacement is committed. Also switched to `addEventListener` to prevent double-fire.
- **Landscape rotation photo loss** — `restorePreviewAfterRotation()` handles both `orientationchange` and `screen.orientation` API. Restores from sessionStorage with imgB64 fallback.
- **Settings not propagating mid-session** — `saveSettings()` now calls `S = loadSrcSettings()` after writing, so new fee/threshold values take effect on next scan without page reload.

### Copy changes
- "AI Reseller OS" → "Scan the shelf. Know what to buy."
- "ANALYZE ITEM" → "FLIP OR PASS?"
- "SOURCING" → "SCOUT"
- "GROWTH" → "TRENDS"
- "DASH" → "STATS"
- "Photo Agent" → "Photo Enhancer"
- "Growth Agent" → "Market Trends"
- "⚙ Change API Key" → "⚙ Change Access Code"
- "Get your free key" removed (API is paid — this was factually wrong)
- All button/hint copy rewritten in reseller language throughout

---

## [v3.0] — April 24, 2026

### Why this version exists
v2 was delivered but had several bugs identified during audit. v3 fixed them before v4 work began.

### Bug fixes
- Model string updated to claude-sonnet-4-6 (was claude-sonnet-4-5)
- Storage key migration shim added (ebayhq_items_v1 → flippd_items_v1)
- iOS camera race condition fixed with requestAnimationFrame
- Landscape orientation photo loss fixed
- Settings propagation mid-session fixed
- `saveApiKey()` alert removed, replaced with toast

---

## [v2.0] — April 2026

### Why this version exists
Full rebrand from eBay HQ to Flippd. Structural changes to support the Flippd product identity.

### Changes
- Rebranded throughout from "eBay HQ" to "Flippd"
- Import tab added (JSON backup restore + CSV import)
- Storage key renamed (ebayhq_items_v1)
- Fee calculation reviewed and confirmed using S.ebayFee

---

## [v1.0 / eBay_HQ_v9] — Early 2026

### Original MVP
Single-file HTML/JS app. Core features: AI sourcing scan, shelf scan, inventory tracking, photo enhancer, growth insights, P&L tracker. Built for personal use by solo eBay reseller.
