# Flippd — Changelog

All notable changes to Flippd are documented here.
Format: [Version] — Date — Summary of changes and *why* they were made.

---

## [v5.2] — April 27, 2026

### Why this version exists
Roadmap Phase 2.1: AI Listing Generator complete. Resellers spend 20+ minutes writing eBay listings manually. v5.2 generates professional titles, descriptions, and condition notes in seconds using Claude AI, then exports directly to eBay CSV format.

### New Features
- **AI Power Listing Generator** — 🚀 Listing button on each inventory item opens two-stage modal
- **Two-stage modal flow:**
  - Stage 1 (Selection): Pick condition (New/Like New/Open Box/Used/Fair) + select eBay leaf category
  - Stage 2 (Preview): AI generates title/description/condition note with live character counts
- **Regenerate button** — Get unlimited variations of the generated copy
- **Persistent listing data** — Generated listing saves to item forever with `item.listing` object (title, description, conditionNote, ebayCategory, ebayConditionId, generatedAt)
- **Two save options:**
  - "💾 Save to Item" — Saves listing, item stays "Unlisted"
  - "📤 Save + Export" — Saves listing AND queues item for CSV export (status → "Ready to Export")
- **Collapsible listing preview** — Inventory cards show "▼ View Generated Listing" when a listing is saved
- **eBay CSV export** — Exports all "Ready to Export" items in exact eBay format with category IDs, condition IDs, and HTML-wrapped descriptions

### Technical Implementation
- **UI:** Modal in INVENTORY tab with selection and preview stages
- **Data:** Uses item.nickname, category, condition, notes for generation context
- **API:** Single Claude call per generation (prompt includes category-specific hints)
- **Categories:** All 21 eBay leaf categories extracted from user's actual listings with correct IDs
- **Condition mapping:** New→NEW, Like New→LIKE_NEW, Open Box→OPEN_BOX, Used→USED_VERY_GOOD, Fair→USED_ACCEPTABLE
- **CSV format:** Exact eBay draft listing template with proper escaping, HTML descriptions, leaf category IDs
- **Storage:** All listings persist in localStorage under `flippd_items_v1`

### Code Changes
- Added EBAY_LEAF_CATEGORIES object (21 categories with IDs)
- Added EBAY_CONDITION_IDS mapping (5 conditions to eBay IDs)
- Added `currentListingModal` state object for modal flow management
- Added functions: `openListingModal()`, `closeListingModal()`, `showListingSelectionStage()`, `proceedToPreview()`, `generateAndShowPreview()`, `regenerateListing()`, `saveListing()`, `generateListingWithAI()`, `exportListingsToCSV()`, `toggleListingDetail()`
- Added modal HTML with two-stage flow, condition/category dropdowns, preview displays
- Added `.listing-btn` CSS (gold accent styling)
- Updated `renderFilteredList()` to include 🚀 Listing button and collapsible listing section
- Added inline listing preview in inventory cards

### Files Affected
- Flippd_v5.html (complete)

### Status
✅ Feature complete, syntax valid, tested with Playwright. All 21 categories hardcoded from user's actual eBay listings. CSV export format validated against eBay template. Ready for use.

---

## [v5.1] — April 27, 2026

### Why this version exists
v5.0 worked but had friction points: API key needed manual entry, instructions disappeared after first scan. v5.1 removes both.

### Changes
- **Auto-inject API key on page load** — API key stored in localStorage on first visit (no manual entry needed)
- **Instructions always visible** — "⚡ Start here" green box now persists across all sessions (removed `display:none` hiding logic)
- **Persistent instruction box** — Removed condition that hid instructions after first scan

### Technical changes
- Line 4246: Modified `window.onload()` to auto-set `fif_api_key` if not present
- Line 3195-3199: Removed scan log check that hid first-scan prompt
- Line 3540-3543: Removed `fsp.style.display = 'none'` from `logScan()` function

### Status
✅ App fully functional. All core features working: SCOUT (scan), INVENTORY (tracking), PHOTOS (enhancement), TRENDS (market insights), STATS (P&L).

---

## [v5.0] — April 26, 2026

### Why this version exists
Full rebuild from wireframe. Original `/mnt/project/Flippd_v5.html` was plain-text wireframe (182 lines). Real app is complete 4,600+ line HTML5 app with dark terminal aesthetic and full feature set.

### Changes
- **Canonical app identified** — Dark-mode HTML5 app (not wireframe) is the source of truth
- **PROXY_URL set to null** — Waiting for Manus proxy. Direct Anthropic API used until proxy ready.
- **Error handling improved** — 401/403 = "Invalid or expired access code", 429 = rate limited, 5xx = server error
- **Access code validation** — Added checks in `callClaude()`, inventory photo detect, and `fetchTrendingKeywords()`

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
