# Feature Triage — ScanForProfit v5.24

Source file: `ScanForProfit_v5_24.html` (6,642 lines)
Analysis date: 2026-05-24
Last status update: 2026-06-16

## Live Product Status (updated 2026-06-24)

**Live product is `apps/web/public/app.html`** — web-first, served at scanforprofit.com/app.html.
The RN mobile app scaffold (`apps/mobile/`) exists but is **not shipped**. Phase 4 RN build was scrapped; all features below are live in the web app, not mobile. Mobile rebuild is Phase 05 (not started), using app.html as reference.

Authoritative feature truth: `docs/CURRENT_STATE.md`.

| Feature area | Web app status | Where implemented |
|---|---|---|
| Auth (register / verify / login / password reset) | ✅ Live | `supabase/functions/auth` |
| Scanner — single item scan (F-01, F-03, F-07, F-08) | ✅ Live | `app.html`, `supabase/functions/claude-proxy` |
| Scanner — shelf scan (F-02, F-04) | ✅ Live | `app.html`, `claude-proxy` |
| Inventory CRUD + photos + status (F-09 to F-18) | ✅ Live | `app.html`, Supabase `inventory` table |
| Listing generator + CSV export + trending keywords (F-28, F-29, F-31) | ✅ Live | `app.html`, `claude-proxy` |
| Growth Agent / Profit Compass (F-27) | ✅ Live | `app.html`, `claude-proxy` |
| P&L / Profit Hub + expenses (F-22 to F-26) | ✅ Live | `app.html` |
| Settings (fee, tax, mileage — all configurable) (F-06) | ✅ Live | `app.html` |
| Profit calculation (P-02, P-12) | ✅ Live | `app.html` + `packages/shared/src/utils/calcProfit.ts` |
| AI prompts (P-03–P-08) | ✅ Live | `supabase/functions/claude-proxy/index.ts` |
| eBay OAuth (F-43 area) | ✅ Active | `supabase/functions/ebay-oauth/index.ts` |
| Stripe payments | ✅ Built | `supabase/functions/stripe-webhook`, `stripe-checkout` — E2E not yet verified |

Features **deferred** (Phase 05+ / mobile rebuild):
- eBay listing push via API (F-30)
- Backup / restore import (P-17, P-18)
- Watch / Save for Later (F-05) — dead stub, low priority
- Mobile-native camera scan — web uses file input

The sections below remain the authoritative reference for **what to port and how**. Use them when rebuilding features in the mobile app or refactoring app.html. Do not rewrite prompts (P-03 through P-08) — they are verbatim from the source file.

---

## Section 1 — Full Feature Inventory

Every distinct feature, exhaustive and ungrouped. Line numbers reference `ScanForProfit_v5_24.html`.

---

### F-01 — Single Item Scan (Hot / List / Skip)
- **Tab:** Scanner
- **Functions:** `analyze()` (L4694), `getSingleSys()` (L4644), `callClaude()` (L4536), `calcFinancials()` (L4666), `getDecision()` (L4673)
- **Data reads:** `S.ebayFee`, `S.pkgCost`, `S.minProfit`, `S.targetRoi`, `S.maxDays`, `S.style`, `imgFile` (raw File ref), `text-input` DOM
- **Data writes:** `fef_scan_log` (localStorage), item name patched back into scan log entry
- **~Lines:** 4644–4716

### F-02 — Shelf Scan (RANK THIS SHELF)
- **Tab:** Sourcing (Scout)
- **Functions:** `analyzeShelf()` (L4734), `getShelfSys()` (L4718), `renderShelf()` (L4900)
- **Data reads:** `imgFile`, `text-input` DOM, `S.ebayFee`, `S.pkgCost`, `S.minProfit`, `S.targetRoi`
- **Data writes:** `currentShelfItems[]` (module-level cache), `fef_scan_log`
- **~Lines:** 4718–4940

### F-03 — Buy Action from Single Scan
- **Tab:** Sourcing (Scout) → modal
- **Functions:** `buyItem()` (L4873), `showBuyConfirm()` (L5085), `confirmBuyItem()` (L5131), `createInventoryItem()` (L2617), `logScan()` (L4864), `logActivity()` (L5001)
- **Data reads:** `lastSingleResult`, editable fields in buy-confirm modal
- **Data writes:** `items[]`, localStorage `flippd_items_v1`, IndexedDB (via `savePhotosIDB`), `fef_scan_log`, `fef_activity_log`, server sync via `pushItemToServer()`
- **~Lines:** 4864–5169

### F-04 — Buy Action from Shelf Scan
- **Tab:** Sourcing (Scout)
- **Functions:** `buyShelfItem()` (L4942), `createInventoryItem()` (L2617)
- **Data reads:** `currentShelfItems[itemIndex]`
- **Data writes:** same as F-03 (no photo attached — shelf photo not transferred)
- **~Lines:** 4942–4991

### F-05 — Watch / Save for Later
- **Tab:** Sourcing (Scout)
- **Functions:** `watchItem()` (L4891)
- **Data reads:** `lastSingleResult`
- **Data writes:** none — stub only, shows "Watch feature coming soon!"
- **Status:** DEAD CODE / STUB
- **~Lines:** 4891–4893

### F-06 — Sourcing Settings
- **Tab:** Sourcing (Scout) → settings sub-view
- **Functions:** `showSourcingSettings()` (L4388), `populateSettingsUI()` (L4394), `updateSetting()` (L4405), `updateStyle()` (L4411), `saveSettings()` (L4381), `resetSettings()` (L4386), `updateFeeHint()` (L4374)
- **Hardcoded defaults (DEFAULTS object L4046):**
  - `minProfit: 15` (⚠️ configurable)
  - `targetRoi: 200` (⚠️ configurable)
  - `maxDays: 60` (⚠️ configurable)
  - `minStr: 0` (sell-through rate minimum)
  - `ebayFee: 13` (⚠️ configurable)
  - `pkgCost: 1.25` (⚠️ configurable)
  - `shipping: 'buyer'`
  - `shipCost: 6.00` (⚠️ configurable)
  - `style: 'balanced'`
- **Data reads:** `S` (settings object), DOM sliders
- **Data writes:** `fif_settings` (localStorage), `S` module-level object
- **~Lines:** 4046–4414

### F-07 — Decision Logic (BUY / HOT / PASS)
- **Tab:** n/a — pure calculation
- **Functions:** `getDecision()` (L4673)
- **Logic:** If `profit < minProfit * styleBias OR days > maxDays / styleBias OR sellThrough < minStr * styleBias` → PASS. If `roi >= targetRoi AND profit >= minProfit*styleBias*1.5 AND days <= maxDays/styleBias*0.5` → HOT. Otherwise → BUY.
- **Style biases:** `{conservative: 1.3, balanced: 1.0, aggressive: 0.75}`
- **~Lines:** 4673–4679

### F-08 — Profit Calculation
- **Tab:** n/a — used everywhere
- **Functions:** `calcProfit()` (L2213), `calcFinancials()` (L4666), `profitStr()` (L2221)
- **Logic:** `price - cost - (price * ebayFee / 100) - pkgCost - shipCost`
- ⚠️ `S.ebayFee` defaults to `13` if `S` is null (L2217) — fallback hardcoded
- ⚠️ `S.pkgCost` defaults to `1.25` if `S` is null (L2217) — fallback hardcoded
- **~Lines:** 2213–2221

### F-09 — Inventory Home (category + status overview)
- **Tab:** Inventory
- **Functions:** `renderInventoryHome()` (L2230), `renderInventory()` (L2349)
- **Data reads:** `items[]`, `S.ebayFee`
- **Data writes:** DOM only
- **~Lines:** 2230–2282

### F-10 — Inventory Filtered List
- **Tab:** Inventory
- **Functions:** `openFilteredList()` (L2286), `renderFilteredList()` (L2296), `setCatFilter()` (L2350), `setStatusFilter()` (L2351), `invHomeSearch()` (L2340)
- **Data reads:** `items[]`, `invListFilter` object
- **Data writes:** DOM only
- **~Lines:** 2284–2351

### F-11 — Inventory Detail View
- **Tab:** Inventory
- **Functions:** `showDetail()` (L2354), `renderPhotoGallery()` (L5174)
- **Data reads:** `items[id]`, `S.ebayFee`, `item.photos[]`
- **Data writes:** DOM only
- **~Lines:** 2354–2402

### F-12 — Add Inventory Item (manual form)
- **Tab:** Inventory
- **Functions:** `openAddForm()` (L2522), `saveInvItem()` (L2663), `updateProfitPreview()` (L2593), `initFormSelects()` (L5584), `generateSKU()` (L2608), `createInventoryItem()` (L2617)
- **Data reads:** all form fields, `CATEGORIES`, `CONDITIONS`, `PLATFORMS`, `STATUSES`, `SKU_PREFIXES`
- **Data writes:** `items[]`, localStorage, IndexedDB, server sync
- **~Lines:** 2418–2741

### F-13 — Edit Inventory Item
- **Tab:** Inventory
- **Functions:** `startEdit()` (L2543), `saveInvItem()` (edit path L2667), `editRemovePhoto()` (L2581)
- **Data reads:** `items[id]`, form fields
- **Data writes:** `items[]`, localStorage, IndexedDB, `updateItemOnServer()`
- **~Lines:** 2543–2591

### F-14 — Delete Inventory Item
- **Tab:** Inventory
- **Functions:** `deleteItem()` (L2723), `showAppConfirm()` (L3969)
- **Data reads:** `items[id]`
- **Data writes:** `items[]`, `deletePhotosIDB()`, `deleteItemFromServer()`
- **~Lines:** 2723–2735

### F-15 — Photo-Based Item Detection (in Add/Edit form)
- **Tab:** Inventory (add/edit form)
- **Functions:** `invFormDetectItem()` (L2459), `invFormHandlePhoto()` (L2424), `invFormClearPhoto()` (L2448)
- **AI Prompt (verbatim, L2472):**
  ```
  Identify this item for an eBay reseller inventory system. Study all visible details — brand, model, labels, features. Return ONLY valid JSON, no markdown: {"name":"specific item name with brand and model","category":"one of: Electronics/Clothing/Shoes/Home & Garden/Collectibles/Toys & Hobbies/Sporting Goods/Books/Automotive/Health & Beauty/Tools/Musical Instruments/Pet Supplies/Baby/Jewelry & Watches","condition":"New/Like New/Good/Fair/Poor","estimated_value":number,"notes":"condition observations and key selling points in one sentence"}
  ```
- **Model:** `claude-sonnet-4-6`, max_tokens: 400
- **Upload:** multipart/form-data, raw File stream (no base64 on device)
- **Data reads:** `invFormImgFile`, form DOM
- **Data writes:** DOM form fields auto-filled
- **~Lines:** 2459–2520

### F-16 — Photo Agent (Photo Enhancer tab)
- **Tab:** Photo (separate tab in HTML, not in RN 5-tab layout)
- **Functions:** `paHandlePhotos()` (L2811), `paApplyFilters()` (L2904), `paApplyToAll()` (L2942), `paDownloadAll()` (L2952), `paSaveToItem()` (L2964), `paReset()` (L2983), `paRenderThumbs()` (L2867), `paSelectPhoto()` (L2876), `paDeletePhoto()` (L2888), `paRemoveExisting()` (L2799), `paLoadItem()` (L2782), `paFilterByCategory()` (L2771), `populatePaDropdown()` (L2758)
- **Canvas filters:** brightness, contrast, saturation (+/- sliders), optional white background
- **Data reads:** `items[]` (to populate dropdown), IndexedDB photos
- **Data writes:** IndexedDB `savePhotosIDB()`, `items[]` (photo array), localStorage metadata
- **Max photos:** 4 per session; combined with existing up to 4 total
- **Max canvas dim:** 1200px (capped to avoid OOM)
- **~Lines:** 2754–3000

### F-17 — Mark Item Sold (Sold Modal)
- **Tab:** Inventory
- **Functions:** `openSoldModal()` (L3409), `confirmSold()` (L3432), `closeSoldModal()` (L3448), `updateSoldProfit()` (L3418)
- **Data reads:** `items[id]`, `soldModalItem`, sale price input
- **Data writes:** `items[id].status = 'Sold'`, notes append "SOLD date for $price", `logActivity()`
- **~Lines:** 3409–3451

### F-18 — Stale Listing Badge
- **Tab:** Inventory (tab button badge)
- **Functions:** `updateStaleBadge()` (L5207)
- **Data reads:** `items[]`, `S.maxDays`, `item.createdAt || item.dateAcquired`
- **Data writes:** DOM badge element on inventory tab button
- **~Lines:** 5207–5223

### F-19 — SKU Auto-Generation
- **Tab:** n/a — utility
- **Functions:** `generateSKU()` (L2608), `generateSku()` (L6371, import variant)
- **Logic:** `{PREFIX}-{zero-padded 5-digit count}` where prefix comes from `SKU_PREFIXES` map
- **Data reads:** `items[]`, `SKU_PREFIXES` constant
- **~Lines:** 2608–2612

### F-20 — Photo Storage (IndexedDB)
- **Tab:** n/a — storage layer
- **Functions:** `openPhotoDB()` (L~1915), `savePhotosIDB()`, `loadPhotosIDB()`, `deletePhotosIDB()`, `hydratePhotos()` (all in lines 1915–1978)
- **Logic:** Photos kept OUT of localStorage. IndexedDB object store `flippd_photos` keyed by `itemId`. `hydratePhotos()` runs at startup to attach photos to items in memory.
- **~Lines:** 1915–1978

### F-21 — localStorage Migration (base64 → IndexedDB)
- **Tab:** n/a — startup
- **Functions:** `loadItems()` (L2002), migration check at L2008
- **Logic:** On load, if any item has `photos[0]` starting with `data:`, moves them to IndexedDB and strips from localStorage.
- **~Lines:** 2002–2043

### F-22 — Category Migration (legacy category names)
- **Tab:** n/a — startup/load
- **Functions:** `migrateCategory()` (L~1990), `CAT_MIGRATE` map
- **Logic:** Maps old category names (e.g. `'FurnitureHome'`, `'FashionCloth'`) to current names. Applied on every load.
- **~Lines:** 1990–1998

### F-23 — Server Sync (cross-device inventory)
- **Tab:** n/a — background
- **Functions:** `syncFromServer()` (L2089), `pushItemToServer()` (L2112), `updateItemOnServer()` (L2126), `deleteItemFromServer()` (L2140), `itemForServer()` (L2073), `mergeServerItem()` (L2079)
- **API_BASE:** `'https://flippd-backend.replit.app'` (⚠️ hardcoded in legacy source)
- **Auth:** `Authorization: Bearer {jwt}`
- **Logic:** Server wins on metadata, local wins on photos. Only metadata synced (no base64 photos).
- **~Lines:** 2068–2151
- ✅ **REPLACED in live app:** All server sync via Supabase (`inventory` table + RLS). Replit backend retired. `API_BASE` no longer used — all calls go through `SUPABASE_URL` + anon key.

### F-24 — P&L Tracker
- **Tab:** P&L (sub-screen of Stats/Dashboard)
- **Functions:** `pnlLoad()`, `pnlSave()`, `pnlCalc()` (L3028), `pnlAddExpense()` (L3091), `pnlDeleteExp()` (L3126), `pnlRenderSales()` (L3058), `pnlRenderExpenses()` (L3106), `pnlRenderReport()` (L3131), `pnlRenderSummary()` (L3042), `pnlSetTab()` (L3015)
- **Storage key:** `fef_expenses_v1`
- **Hardcoded:** tax reserve `0.25` (25%) at L3038 (⚠️ should be configurable)
- **Data reads:** `items[]` filtered by status='Sold', `pnlExpenses[]`, `S.ebayFee`, `S.pkgCost`, `S.shipping`, `S.shipCost`
- **Data writes:** `pnlExpenses[]`, `fef_expenses_v1` localStorage
- **~Lines:** 3004–3164

### F-25 — P&L Monthly Breakdown
- **Tab:** P&L
- **Functions:** `pnlRenderMonthly()` (L5292)
- **Data reads:** `items[]`, `calcProfit()`
- **~Lines:** 5292–5311

### F-26 — Mileage Logging
- **Tab:** P&L
- **Functions:** `pnlLogMileage()` (L5313), `sPnlMiles()` (L5593)
- **Hardcoded:** IRS mileage rate `0.67` at L5316 and L5596 (⚠️ must be configurable — changes annually)
- **Data reads:** miles input field
- **Data writes:** `pnlExpenses[]` (appends expense with category 'Gas & Travel')
- **~Lines:** 5313–5324

### F-27 — Growth Agent
- **Status:** ✅ Implemented (inline) — prompt lives inline in `apps/web/public/app.html` at ~line 4342. This is the canonical version. Do NOT replace with the prompt below. Update the prompt below to match app.html if they diverge.
- **Tab:** Trends / PULSE (Growth)
- **Functions:** `runGrowthAgent()` (L3214), `initGrowthTab()` (L3179), `renderGrowthResults()` (L3338), `loadGrowthCache()` (L3172), `saveGrowthCache()` (L3175)
- **Cache key:** `sfp_growth_cache`, stale after 24 hours (`GROWTH_STALE_HOURS = 24`)
- **Auto-run:** on tab open if cache is missing or stale AND user is logged in
- **AI Prompt (verbatim, L3279–3307):**
  ```
  You are a business growth advisor for an eBay thrift reseller. Analyze their data and provide actionable insights.

  SELLER INVENTORY DATA:
  ${JSON.stringify(inventorySummary, null, 2)}

  SELLER FEE STRUCTURE: ${S.ebayFee}% eBay fee + $${S.pkgCost} packaging per item. Minimum profit target: $${S.minProfit}. Target ROI: ${S.targetRoi}%. Max days to sell: ${S.maxDays}.

  TODAY'S DATE: ${new Date().toLocaleDateString()}

  Based on this real seller data AND your knowledge of current eBay reselling trends for thrift sellers in 2025-2026, return ONLY valid JSON (no markdown, no preamble):
  {
    "business_score": number (0-100),
    "score_label": "Strong/Growing/Steady/Needs Attention",
    "score_color": "#00e676 or #f5a623 or #ff3333",
    "score_summary": "one sentence on overall business health using their actual numbers",
    "top_categories": [
      {"name":"string","profit":"$X","insight":"one sentence specific to their data","bar_pct":number}
    ],
    "stale_actions": [
      {"sku":"string","name":"string","days":number,"action":"Relist / Drop price 10% / Bundle / Donate","reason":"one sentence"}
    ],
    "hunt_list": [
      {"icon":"emoji","item":"string","why":"one sentence why to hunt this now","priority":"HIGH or MED"}
    ],
    "market_trends": [
      {"arrow":"📈 or 📉","category":"string","detail":"one sentence trend insight for thrift resellers"}
    ],
    "advisor_message": "3-4 sentences of direct actionable advice using their actual numbers. Be specific. Tell them exactly what to do differently this week."
  }
  ```
- **Input built from:** `items[]` category stats, stale items (using `S.maxDays`), recent sales, total P&L numbers
- **~Lines:** 3166–3404

### F-28 — Trending Keywords (Growth tab)
- **Tab:** Trends (Growth)
- **Functions:** `fetchTrendingKeywords()` (L5390), `renderTrendingKeywords()` (L5421)
- **Cache key:** `fef_trending`, stale after 6 hours
- **AI Prompt (verbatim, L5402):**
  ```
  Search for the top trending eBay search keywords and most popular resale categories RIGHT NOW today ${new Date().toLocaleDateString()}. What are buyers searching for most on eBay this week? Focus on thrift resale categories: electronics, clothing, collectibles, home goods. Return ONLY valid JSON: {"keywords":[{"rank":1,"word":"string","trend":"up/stable/down","bar":85},...],"trending_categories":["string"],"hot_tip":"one sentence actionable tip for resellers today"}. Include exactly 10 keywords sorted by search volume.
  ```
- **Tool use:** `web_search_20250305` tool passed to Claude for live data
- **Model:** `claude-sonnet-4-6`, max_tokens: 800
- **~Lines:** 5387–5437

### F-29 — eBay Listing Generator
- **Tab:** Inventory (modal, launched from item card or form)
- **Functions:** `openListingModal()` (L3499), `closeListingModal()` (L3515), `showListingSelectionStage()` (L3520), `proceedToPreview()` (L3538), `generateAndShowPreview()` (L3553), `generateListingWithAI()` (L3622), `regenerateListing()` (L3590), `saveListing()` (L3594), `toggleListingDetail()` (L3735), `saveAndGenerateListing()` (L6004)
- **AI Prompt (verbatim, L3637–3656):**
  ```
  You are an expert eBay reseller writing product listings. Generate a title, description, and condition note for this item.

  Item name: ${item.nickname}
  Category: ${item.category}
  Condition: ${condition}
  Seller notes: ${item.notes || 'No additional notes'}

  Focus on: ${categoryHint}

  STRICT REQUIREMENTS:
  - Title: max 80 characters, eBay-optimized keywords first
  - Description: 250-400 words, bullet points for key details, mobile-friendly
  - Condition Note: 50-100 words, specific about condition

  Respond ONLY with valid JSON (no markdown, no backticks):
  {
    "title": "...",
    "description": "...",
    "conditionNote": "..."
  }
  ```
- **`categoryHint` map** (L3623–3635): Electronics→"functional, tested, specifications", Clothing→"fabric, fit, brand, styling", Shoes→"size, brand, condition, fit", Home & Garden→"materials, dimensions, functionality", Collectibles→"authenticity, rarity, condition", Toys & Hobbies→"completeness, vintage value, condition", Books→"author, edition, binding, condition", Sporting Goods→"brand, specifications, condition", Jewelry & Watches→"material, brand, specifications"
- **Model:** `claude-sonnet-4-6`, max_tokens: 1000
- **Data writes:** `item.listing` object, `item.status = 'Ready to Export'` (if export path)
- **~Lines:** 3489–3739

### F-30 — eBay CSV Export (Draft Listings)
- **Tab:** CSV (separate sub-screen in HTML; not in RN 5-tab layout)
- **Functions:** `generateAndDownloadCSV()` (L5523), `renderCsvPreview()` (L5482), `getCsvCandidates()` (L5472), `markExported()` (L5466), `getExportedIds()` (L5462), `conditionToEbayId()` (L5511), `setCsvWindow()` (L5453), `setCsvExportMode()` (L5445), `saveCsvReminder()` (L5566), `loadCsvReminder()` (L5572), `exportListingsToCSV()` (L3672, alternate path)
- **CSV format:** eBay Seller Hub draft listings template (`Version=0.0.2`)
- **Condition ID map:** `{New:'NEW', Like New:'NEW_OTHER', Open Box:'NEW_OTHER', Good:'USED', Used:'USED', Fair:'USED', Poor:'FOR_PARTS_OR_NOT_WORKING'}`
- **Export windows:** 24h / 48h / 168h (1 week)
- **Storage keys:** `fef_csv_exported_ids`, `fef_last_csv_export`, `fef_csv_reminder`
- **Candidates:** `status='Unlisted'`, not previously exported, within time window
- **~Lines:** 5440–5579

### F-31 — eBay Category ID Mapping
- **Tab:** n/a — utility
- **Constants:** `EBAY_CAT_DEFAULTS` (L5329–5344), `EBAY_LEAF_CATEGORIES` (L3456–3478), `EBAY_CONDITION_IDS` (L3480–3486)
- **Functions:** `getEbayCatId()` (L5347), `conditionToEbayId()` (L5511)
- ⚠️ `EBAY_LEAF_CATEGORIES` only has 21 specific leaf categories — not exhaustive
- **~Lines:** 3456–3486, 5329–5352

### F-32 — Dashboard / Stats Overview
- **Tab:** Stats (Dashboard)
- **Functions:** `renderDashboard()` (L3745), `getTimeframeStart()` (L5812), `setDashTimeframe()` (L5827), `updateDashGreeting()` (L5748)
- **KPIs:** Total Sales, Net Profit, Items Sold, Active Listings (filterable by week/month/year)
- **Sections:** Sourcing nav card (today's scans), Inventory nav card, P&L nav card, Photos nav card, Growth nav card, Settings nav card
- **Data reads:** `items[]`, `pnlCalc()`, `fef_scan_log` localStorage, growth cache
- **~Lines:** 3742–3950

### F-33 — Dashboard KPI Drill-Down Modals
- **Tab:** Stats (Dashboard)
- **Functions:** `showKpiDrillDown()` (L5849), `showSourcingDrillDown()` (L5881), `showInventoryDrillDown()` (L5897), `showPhotosDrillDown()` (L5912), `showDrillDownModal()` (L5832)
- **Data reads:** `items[]`, `fef_scan_log`
- **~Lines:** 5832–5934

### F-34 — Dashboard Charts
- **Tab:** Stats (Dashboard)
- **Functions:** `renderProfitChart()` (L5228), `renderTrendLine()` (L5248), `renderBestWorst()` (L5267)
- **Charts:** Bar chart (profit by category), trend line (6 rolling time periods), best/worst performers
- **Logic:** Pure SVG-free HTML bar charts, no chart library
- **~Lines:** 5225–5287

### F-35 — Scan History (Today's Scans)
- **Tab:** Sourcing (Scout)
- **Functions:** `renderScanHistory()` (L5357), `logScan()` (L4864)
- **Storage key:** `fef_scan_log` (max 500 entries)
- **Displays:** last 5 scans for today, total potential profit from bought items
- **~Lines:** 5354–5385

### F-36 — Activity Feed
- **Tab:** Global (slide-in panel from header)
- **Functions:** `toggleActivityFeed()` (L5010), `renderActivityFeed()` (L5019), `logActivity()` (L5001)
- **Storage key:** `fif_activity_log` (max 50 entries, trimmed to 30 on tab switch)
- **~Lines:** 4999–5030

### F-37 — Global Search
- **Tab:** Global (expandable bar in header)
- **Functions:** `toggleGlobalSearch()` (L5035), `runGlobalSearch()` (L5042), `gsGoToItem()` (L5065)
- **Search fields:** nickname, sku, category, notes
- **Results:** up to 10 items shown
- **~Lines:** 5032–5070

### F-38 — Floating Quick-Add (FAB)
- **Tab:** Global
- **Functions:** `fabQuickAdd()` (L5075)
- **Action:** switches to Inventory tab and opens add form
- **~Lines:** 5075–5078

### F-39 — Auth (Register / Login / Session)
- **Tab:** Sourcing (Scout) → setup sub-view
- **Functions:** `submitAuth()` (L5642), `registerUser()` (L5662), `loginUser()` (L5707), `setAuthMode()` (L5600), `showAuthError()` (L5627), `hideAuthError()` (L5633), `updateDashGreeting()` (L5748), `loadUserInfo()` (L5769)
- **Flow:** email+password only. Register → email verification → login. NOT magic link.
- **JWT validation:** 3-part dot-separated string, length > 50
- **Endpoints:** `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- **Storage keys:** `flippd_jwt`, `fif_api_key` (both store the JWT — duplicated), `flippd_user_name`
- **Session restore:** optimistic on load; background `GET /auth/me` validates; 401 → logout
- **Forgot password:** `alert()` with "Email support@flippd.app with your username" — no API call (⚠️ needs proper API endpoint)
- **~Lines:** 5596–5797

### F-40 — Tier Banner / Trial Countdown
- **Tab:** Global (sticky top banner)
- **Functions:** `updateTierBanner()` (L5971)
- **Logic:** If trial, show days left + color warning at ≤2 days. If scout (free), show scans used of 25. If paid tier, hide.
- **~Lines:** 5968–5999

### F-41 — Scan Limit Reached Modal
- **Tab:** Global (overlaid on scan attempt)
- **Functions:** `showLimitReachedModal()` (L5939)
- **Triggered by:** HTTP 429 from backend with `scan_limit` error
- **Free plan limit:** 25 scans/month (displayed from `errorData.limit`)
- **~Lines:** 5936–5966

### F-42 — Subscription Panel
- **Tab:** Stats → Subscription sub-tab
- **Functions:** `renderSubscriptionPanel()` (L6069), `renderSubTierCards()` (L6038), `setSubInterval()` (L6029), `startCheckout()` (L6095), `openCustomerPortal()` (L6107)
- **Tiers (TIER_INFO L6020–6027):**
  - Hustle: $19/mo, $180/yr (unlimited scans, 500 items, listing generator, photo enhancement, P&L)
  - Stack: $49/mo, $468/yr (unlimited inventory, live pricing, growth agent, bulk listing, stale alerts)
  - Empire: $199/mo, $1908/yr (10 team seats, API access, priority support)
- **Stripe checkout:** `POST /stripe/checkout` → redirects to `data.url`
- **Stripe portal:** `POST /stripe/portal` → redirects to `data.url`
- **~Lines:** 6015–6114

### F-43 — eBay Connect / Disconnect / Sync
- **Tab:** Sourcing → Settings sub-view
- **Functions:** `ebayConnect()` (L4052), `ebayDisconnect()` (L4074), `checkEbayStatus()` (L4097), `checkEbayOAuthCallback()` (L4130), `showEbaySyncPanel()` (L4143), `ebayPullListings()` (L4166), `runEbaySyncPull()` (L4214)
- ⚠️ **Hardcoded eBay client ID:** `'Brittany-Flippd-PRD-67b75c3f4-fb4ff30c'` (L4054) — legacy source only
- ⚠️ **Hardcoded redirect URI:** `'https://flippd-backend.replit.app/ebay/oauth/callback'` (L4055) — legacy source only
- ✅ **REPLACED in live app:** `ebay-oauth` Edge Function uses `ebayCreds()` helper — sandbox/prod credentials read from Supabase secrets, callback URL is `SUPABASE_URL/functions/v1/ebay-oauth/callback`.
- **Scopes:** inventory, account, fulfillment, finances, identity.readonly
- **Sync periods:** 30 / 60 / 90 days
- **~Lines:** 4048–4215

### F-44 — eBay Dedupe (fuzzy merge after sync)
- **Tab:** n/a — triggered after eBay pull-listings
- **Functions:** `runEbayDedupeScan()` (L4319), `findEbayDedupeCandidates()` (L4260), `_titleSimilarity()` (L4249), `_normTitle()` (L4241), `_mergeFlippdWithEbay()` (L4295), `showNextEbayDedupePair()` (L4329), `ebayDedupeYes()` (L4353), `ebayDedupeNo()` (L4361)
- **Algorithm:** Jaccard index on word token sets
- **Thresholds:** <0.70 → keep separate, 0.70–0.95 → prompt user, ≥0.95 → auto-merge
- **~Lines:** 4218–4364

### F-45 — Inventory JSON Import / Export
- **Tab:** Import (sub-screen), CSV Export tab
- **Functions:** `handleFlippdImport()` (L6226), `handleCsvImport()` (L6260), `normaliseImportItem()` (L6345), `generateSku()` (L6371), `showImportPreview()` (L6382), `confirmImport()` (L6399), `cancelImport()` (L6439), `exportFlippdBackup()` (L6451), `parseCsvRows()` (L6320), `setImportMode()` (L6202), `resetImportUI()` (L6213)
- **Backup format:** `{version: '2.0', exportedAt, items[], expenses[], scanLog[], settings}`
- **CSV import:** requires `nickname` column, maps standard column names
- **eBay order/listing CSV detection:** rejects those files with a helpful message
- **~Lines:** 6196–6473

### F-46 — App Confirm Modal (replaces browser confirm())
- **Tab:** Global
- **Functions:** `showAppConfirm()` (L3969), `appConfirmRespond()` (L3979)
- **Used by:** `deleteItem()` only
- **~Lines:** 3963–3986

### F-47 — Toast Notification
- **Tab:** Global
- **Functions:** `showToast()` (L3955)
- **Duration:** 2800ms
- **~Lines:** 3955–3960

### F-48 — Tab Navigation + Auth Guard
- **Tab:** Global
- **Functions:** `switchTab()` (L2156), `showSrcView()` (L4438), `showInvView()` (L2743)
- **Auth guard:** any tab except 'sourcing' redirects to login if `!isUnlocked()`
- **Memory cleanup:** Photo Agent state wiped on leaving photo tab; activity log trimmed on leaving sourcing tab
- **~Lines:** 2154–2208

### F-49 — Image Upload (Memory-Safe, No-Decode Path)
- **Tab:** n/a — utility
- **Functions:** `fileToBase64NoDecodeAndThumb()` (L4022), `handleImage()` (L4479), `showPreview()` (L4507), `clearImage()` (L4514), `triggerImageInput()` (L4467)
- **Logic:** Never base64-encodes on device. Raw `File` reference stored; browser streams via `multipart/form-data`. Preview uses `URL.createObjectURL()`. Max upload 25MB.
- **~Lines:** 3988–4042, 4467–4527

### F-50 — API Call Wrapper
- **Tab:** n/a — utility
- **Functions:** `callClaude()` (L4536), `isUnlocked()` (L4424), `getApiHeaders()` (L4426), `getApiUrl()` (L4425)
- **Two paths:** with photo → `POST /v1/messages-with-image` (multipart); without photo → `POST /v1/messages` (JSON)
- **Error handling:** 401/403 → "Session expired", 429 with scan_limit → `showLimitReachedModal()`, 429 other → rate limit toast, 413 → photo too large, 400 → nested error extraction, 5xx → retry toast
- **~Lines:** 4536–4642

### F-51 — Analytics Event Tracking (localStorage)
- **Tab:** n/a — utility
- **Functions:** `trackEvent()` (L6478)
- **Storage key:** `flippd_events` (max 500 entries)
- **Usage:** defined but `_origLogScan` at L6488 captures `logScan` reference but never instruments it — effectively unused/dead
- **~Lines:** 6477–6488

### F-52 — Stats Tab Sub-Navigation (v5.x restructure)
- **Tab:** Stats
- **Functions:** `statsSubTab()` (L6491), `sPnlRender()` (L6521), `sPnlTab()` (L6509), `sPnlMonthly()` (L6558), `sPnlAddExp()` (L6579), `sPnlMiles()` (L6593)
- **Sub-tabs:** Overview (dash), P&L, Subscription
- **Note:** This is a duplicate P&L render path that co-exists with `pnlRender*` functions. Both sets write to `pnlExpenses[]`. Appears to be a newer version.
- **~Lines:** 6490–6603

### F-53 — Category-to-Inventory Mapping (AI category → internal category)
- **Tab:** n/a — utility used after AI responses
- **Functions:** `mapToInvCategory()` (L4840)
- **Logic:** keyword-based string matching (contains 'electron' → 'Electronics', etc.)
- Default fallback: 'Electronics'
- **~Lines:** 4840–4862

### F-54 — Startup / Init
- **Tab:** n/a
- **Functions:** `window.onload` (L6116)
- **Sequence:** JWT migration → `loadItems()` → `hydratePhotos()` → `pnlLoad()` → `initFormSelects()` → JWT restore → `updateFeeHint()` → `populatePaDropdown()` → `renderCsvPreview()` → `updateStaleBadge()` → `renderScanHistory()` → `logActivity('🚀', 'App opened')`
- **~Lines:** 6116–6195

### F-55 — Forgot Password
- **Tab:** Sourcing (Scout) → auth sub-view
- **Functions:** `showForgotPassword()` (L5757)
- **Logic:** shows `alert()` with "Email support@flippd.app with your username" — no API call, no email sent
- ⚠️ Needs proper `/auth/forgot-password` endpoint
- **~Lines:** 5757–5763

### F-56 — Magic Link (Legacy Stub)
- **Tab:** Sourcing (Scout)
- **Functions:** `requestMagicLink()` (L5765)
- **Status:** DEAD CODE — "Legacy stub — no longer used"
- **~Lines:** 5765–5767

---

## Section 2 — Port Directly (1:1 TypeScript)

Logic that translates cleanly with no DOM rewrites. Port these verbatim, adapting types only.

---

### P-01 — Decision Engine
**Port from:** `getDecision()` (L4673), `calcFinancials()` (L4666)
```
packages/shared/src/utils/calcDecision.ts
```
Logic is pure math, no DOM, no side effects. Map `style` to bias multiplier. eBay fee, pkgCost, shipCost all passed as parameters — never hardcoded.

### P-02 — Profit Calculation
**Port from:** `calcProfit()` (L2213), `calcFinancials()` (L4666)
Already exists in `packages/shared/src/utils/calcProfit.ts`. Verify implementation matches HTML version: `price - cost - (price * fee / 100) - pkg - (shipping === 'free' ? shipCost : 0)`.

### P-03 — Single Item AI System Prompt
**Port from:** `getSingleSys()` (L4644–4663)

Exact verbatim prompt (paste into `packages/shared/src/prompts/singleScan.ts`):
```
You are a meticulous eBay sourcing expert with deep product knowledge. Your job is to ACCURATELY identify items and provide REALISTIC eBay sold market data — not retail prices.

IDENTIFICATION (critical):
- Study EVERY visible detail in the photo: brand logos, model numbers on labels/tags, serial plates, color, size, design era, materials, distinctive features.
- Identify the EXACT make, model, and variant — not just a generic category. "Camera" is wrong. "Minolta X-700 35mm SLR Film Camera" is right.
- Use any text description to confirm or narrow your photo identification.
- If you cannot identify specifics, say so clearly in confidence_reason and set confidence below 60.

PRICING (critical):
- avg_sold_price = median of recent actual eBay SOLD listings, not asking price or retail.
- price_low/price_high = realistic 20th-80th percentile of actual sold comps.
- sell_through_rate = % of listings that actually sell (0-100), not just views.
- avg_days_to_sell = realistic median days from listing to sale for this specific item.

This seller's fee structure: ${ebayFee}% eBay fee + $${pkgCost} packaging. Buyer always pays shipping.
Minimum profitable sale for this seller: their cost + fees + $${minProfit} profit.

Return ONLY valid JSON, no markdown:
{"item_name":"specific make model and variant","category":"string","brand":"string or null","model_number":"string or null","estimated_weight_lbs":number,"avg_sold_price":number,"price_low":number,"price_high":number,"sell_through_rate":number,"avg_days_to_sell":number,"demand_level":"LOW|MEDIUM|HIGH|VERY HIGH","confidence":number,"confidence_reason":"what you confirmed and what you could not","condition_notes":"visible condition issues","search_keywords":["4 specific eBay search terms for this exact item"],"listing_tips":["4 actionable selling tips"],"risk_flags":["red flags or empty array"],"notes":"important context about market or item"}
```

### P-04 — Shelf Scan AI System Prompt
**Port from:** `getShelfSys()` (L4718–4731)

Exact verbatim prompt (paste into `packages/shared/src/prompts/shelfScan.ts`):
```
You are a meticulous eBay sourcing expert scanning a shelf photo. Study EVERY item with care.

For each distinct item visible:
- Identify as specifically as possible: brand, model, type, era. Do not be generic.
- Use all visible clues: labels, logos, colors, shapes, text, design era.
- Provide REALISTIC eBay sold prices — actual sold comps, not retail or asking prices.
- Only include items you can identify with at least 40% confidence.
- Calculate estimated_profit as: avg_sold_price - estimated_cost_at_thrift - (avg_sold_price * ${ebayFee}/100) - ${pkgCost}
- Buyer always pays shipping. Min profit threshold for FLIP: $${minProfit}. Target ROI for HOT: ${targetRoi}%.

Return ONLY a valid JSON array, no markdown:
[{"item_name":"specific name with brand and model","category":"string","brand":"string or null","avg_sold_price":number,"estimated_cost_at_thrift":number,"sell_through_rate":number,"avg_days_to_sell":number,"demand_level":"LOW|MEDIUM|HIGH|VERY HIGH","decision":"BUY|HOT|PASS","decision_reason":"one specific sentence with reasoning","estimated_profit":number,"confidence":number,"condition_notes":"string"}]
Sort: HOT first, then BUY, then PASS.
```

### P-05 — Growth Agent AI Prompt
**Status:** ✅ Implemented (inline) — canonical prompt is in `apps/web/public/app.html` at ~line 4342, NOT this file. See F-27 note above.
**Port from:** `runGrowthAgent()` (L3279–3307) — full prompt in Section 1 F-27 above.
All variables injected: `inventorySummary` JSON, `S.ebayFee`, `S.pkgCost`, `S.minProfit`, `S.targetRoi`, `S.maxDays`, today's date.

### P-06 — Listing Generator AI Prompt
**Port from:** `generateListingWithAI()` (L3637–3656) — full prompt in Section 1 F-29 above.
All variables injected: `item.nickname`, `item.category`, `condition`, `item.notes`, `categoryHint`.

### P-07 — Item Detection Prompt (Inventory Form)
**Port from:** `invFormDetectItem()` (L2472) — full prompt in Section 1 F-15 above.
Returns JSON: `{name, category, condition, estimated_value, notes}`.

### P-08 — Trending Keywords Prompt
**Port from:** `fetchTrendingKeywords()` (L5402) — full prompt in Section 1 F-28 above.
Uses `web_search_20250305` tool. Returns `{keywords[], trending_categories[], hot_tip}`.

### P-09 — Category Mapping (AI → Internal)
**Port from:** `mapToInvCategory()` (L4840)
Pure function, keyword string matching, no DOM. Move to `packages/shared/src/utils/mapCategory.ts`.

### P-10 — SKU Generation
**Port from:** `generateSKU()` (L2608), `generateSku()` (L6371)
Pure function. `packages/shared/src/utils/generateSku.ts`.

### P-11 — Growth Agent Inventory Summary Builder
**Port from:** `runGrowthAgent()` lines 3238–3275 (inventorySummary assembly block)
Builds `catStats`, `staleItems`, `recentSales` from items array. Pure data transform.

### P-12 — P&L Calculation
**Port from:** `pnlCalc()` (L3028)
Pure function. Move to `packages/shared/src/utils/calcPnl.ts`. All fee/cost values read from settings, never hardcoded.
⚠️ Tax reserve `0.25` is hardcoded — make it a parameter.

### P-13 — eBay Condition ID Map
**Port from:** `conditionToEbayId()` (L5511), `EBAY_CONDITION_IDS` (L3480–3486)
Two slightly different maps exist — reconcile:
- Listing generator uses: `{New:'NEW', Like New:'LIKE_NEW', Open Box:'OPEN_BOX', Used:'USED_VERY_GOOD', Fair:'USED_ACCEPTABLE'}`
- CSV export uses: `{New:'NEW', Like New:'NEW_OTHER', Open Box:'NEW_OTHER', Good:'USED', Used:'USED', Fair:'USED', Poor:'FOR_PARTS_OR_NOT_WORKING'}`
These are for different eBay APIs (Listing API vs Drafts CSV). Both needed.

### P-14 — eBay Category Defaults
**Port from:** `EBAY_CAT_DEFAULTS` (L5329–5344)
Map of 15 categories to eBay top-level category IDs. Already partially in `packages/shared/src/constants/categories.ts` — verify IDs match exactly.

### P-15 — Decision Style Bias Logic
**Port from:** `getDecision()` (L4673–4679)
`{conservative: 1.3, balanced: 1.0, aggressive: 0.75}` bias multiplier applied to all thresholds.

### P-16 — CSV Row Parser
**Port from:** `parseCsvRows()` (L6320–6342)
Handles quoted fields with embedded commas. Use as-is or replace with a proper CSV library in the web app.

### P-17 — Backup / Restore Format
**Port from:** `exportFlippdBackup()` (L6451), `handleFlippdImport()` (L6226)
Backup shape: `{version: '2.0', exportedAt, items[], expenses[], scanLog[], settings}`. Must maintain backwards compatibility with this format.

### P-18 — Item Normalisation for Import
**Port from:** `normaliseImportItem()` (L6345)
Validates category against known list, validates condition, validates status, generates new IDs to avoid collisions.

### P-19 — eBay CSV Template Format
**Port from:** `generateAndDownloadCSV()` (L5523–5563)
eBay Seller Hub draft listings CSV format with 4-line `#INFO` header. Column order: `Action,Custom label (SKU),Category ID,Title,UPC,Price,Quantity,Item photo URL,Condition ID,Description`.

### P-20 — Stale Item Calculation
**Port from:** `updateStaleBadge()` (L5207), `runGrowthAgent()` stale detection
`status === 'Listed' AND (now - createdAt) / 86400000 > S.maxDays`

### P-21 — Jaccard Similarity for eBay Dedupe
**Port from:** `_titleSimilarity()` (L4249), `_normTitle()` (L4241)
Simple word-overlap (Jaccard) with lowercase normalization. Pure functions, no deps.

---

## Section 3 — Rebuild Cleaner in RN

DOM-specific or HTML-specific patterns that need a proper React Native rewrite.

---

### R-01 — Photo Storage: IndexedDB → expo-file-system / expo-media-library
**Original:** `openPhotoDB()`, `savePhotosIDB()`, `loadPhotosIDB()`, `deletePhotosIDB()`, `hydratePhotos()`
**Problem:** IndexedDB is web-only. React Native has no IndexedDB.
**RN approach:** Store compressed JPEGs in `expo-file-system` under `FileSystem.documentDirectory + 'photos/'`. Store file URIs (not base64) in the item record. `hydratePhotos()` equivalent is not needed — file URIs are persistent.

### R-02 — Image Upload: File/FormData → expo-image-picker + FileSystem
**Original:** `fileToBase64NoDecodeAndThumb()`, `handleImage()`, multipart FormData with raw File object
**Problem:** Web File/FileReader API doesn't exist in RN. `URL.createObjectURL()` doesn't exist.
**RN approach:** `expo-image-picker` returns `{uri, base64?, mimeType}`. For the API call, use `FormData` with `{uri, name, type}` shape (RN's FormData handles multipart from URI). Preview with `<Image source={{uri}}>`.

### R-03 — Photo Agent Canvas → expo-image-manipulator
**Original:** HTML5 Canvas with manual pixel manipulation in `paApplyFilters()`
**Problem:** Canvas API doesn't exist in RN.
**RN approach:** `expo-image-manipulator` for resize/compress. Brightness/contrast/saturation adjustments require either `react-native-image-filter-kit` or a server-side endpoint. Simplest V1: offer brightness only via `expo-image-manipulator`'s built-in actions, or defer full editor to V2.

### R-04 — Photo Gallery → ScrollView / FlatList
**Original:** `renderPhotoGallery()` — horizontal scroll div with dot indicators
**RN approach:** `<ScrollView horizontal pagingEnabled>` with dot indicators as `View` elements. Or `react-native-reanimated-carousel`.

### R-05 — Tab Navigation → Expo Router tabs
**Original:** `switchTab()` manually shows/hides DOM panels, blocks auth guard inline
**RN approach:** Expo Router `(tabs)/_layout.tsx` already scaffolded. Auth guard goes in a root `_layout.tsx` that redirects unauthenticated users. Already done.

### R-06 — Settings Sliders → @react-native-community/slider
**Original:** HTML `<input type="range">` for eBay fee, min profit, etc.
**RN approach:** `@react-native-community/slider` or `@miblanchard/react-native-slider`.

### R-07 — Modals → React Native Modal
**Original:** `style.display = 'flex'` on absolutely-positioned divs
**RN approach:** React Native `<Modal>` component or `@gorhom/bottom-sheet` for bottom sheets.

### R-08 — Toast → react-native-toast-message
**Original:** `showToast()` — single DOM div with CSS animation
**RN approach:** `react-native-toast-message` or custom animated component.

### R-09 — App Confirm Dialog → Alert.alert()
**Original:** `showAppConfirm()` — custom styled DOM modal replacing browser `confirm()`
**RN approach:** `Alert.alert(title, message, [{text:'Cancel'}, {text:'Delete', onPress: cb, style:'destructive'}])`. Already safe on iOS/Android.

### R-10 — Drill-Down Modals → React Navigation / Expo Router Sheet
**Original:** `showDrillDownModal()` — dynamically creates a div and appends to body
**RN approach:** Bottom sheet or modal stack navigation.

### R-11 — CSV Export / Import → expo-file-system + expo-sharing
**Original:** `URL.createObjectURL(blob)` + `<a download>` click
**RN approach:** `FileSystem.writeAsStringAsync()` then `Sharing.shareAsync()`. iOS shows share sheet; Android saves to Downloads.

### R-12 — localStorage → AsyncStorage / expo-secure-store
**Original:** All state in localStorage with ~15 keys
**RN approach:** `expo-secure-store` for JWT (already done in scaffold). `@react-native-async-storage/async-storage` for non-sensitive data (items, settings, scan log, expenses, growth cache). Consider Supabase as the source of truth for all user data (see Section 2 P-17).

### R-13 — Dashboard Date Greeting
**Original:** `updateDashGreeting()` reads `localStorage.getItem('flippd_user_name')` + checks hour
**RN approach:** Same logic, read from auth context / Supabase user object.

### R-14 — Session Restore / JWT Validation
**Original:** `window.onload` reads localStorage JWT, splits on `.`, length check, background `GET /auth/me`
**RN approach:** Supabase handles session. On app start, call `supabase.auth.getSession()`. The scaffold's `getSession()` in `lib/auth.ts` handles this.

### R-15 — eBay OAuth Callback Detection
**Original:** `checkEbayOAuthCallback()` reads `location.search` URL params on page load
**RN approach:** Handle via Expo Router deep link: `scanforprofit://ebay/callback?code=...`. Register `scheme: scanforprofit` (already in app.json).

### R-16 — Scan History Render (Today's Scans)
**Original:** DOM innerHTML manipulation showing last 5 scans for today
**RN approach:** FlatList or mapped Views. Data from AsyncStorage `fef_scan_log`.

### R-17 — Category Filter Dropdown (Photo Agent)
**Original:** `<select>` element populated by `populatePaDropdown()`
**RN approach:** `<Picker>` from `@react-native-picker/picker` or custom flat list picker.

### R-18 — Global Search
**Original:** expandable `<input>` in sticky header with inline results dropdown
**RN approach:** `<TextInput>` in header with `<FlatList>` results below (absolute positioned or in a Modal).

### R-19 — Auto-Run Growth Agent on Tab Open
**Original:** `initGrowthTab()` checks cache age and calls `runGrowthAgent()` in `setTimeout()`
**RN approach:** `useEffect` in the Trends screen component with dependency on `isFocused` (from `useFocusEffect`).

### R-20 — eBay Dedupe Modal (Side-by-Side Comparison)
**Original:** Fixed-position modal with two columns showing images side by side
**RN approach:** `<Modal>` with horizontal two-column layout using flexbox.

---

## Section 4 — Defer to V2

Features that are real but not P1. Omit from initial build.

---

### V2-01 — Photo Agent (full canvas editor)
Brightness/contrast/saturation sliders with live canvas preview, apply-to-all, download. Core photo attachment (add photo to item) is P1; the enhancement editor is V2. Reason: requires canvas polyfill or native module work; most users won't use it on first launch.

### V2-02 — eBay Connect / OAuth / Pull Listings
Full eBay OAuth flow, listing sync, sell-through data enrichment. Reason: requires eBay developer account, production keys, redirect URI registration, and backend changes. High integration complexity. Manual CSV export (V1) covers the listing need.

### V2-03 — eBay Dedupe Modal
Fuzzy matching UI for merging Flippd items with eBay-pulled listings. Depends on V2-02. Defer entirely.

### V2-04 — Shelf Scan Mode
Photo-based scan of an entire store shelf, returns ranked list of all visible items. Reason: useful but not core to the MVP loop (scan → buy → list → sell). Single item scan is P1.

### V2-05 — Watch / Save for Later
`watchItem()` is a dead stub in v5.23. Requires a watchlist data model and UI. Defer.

### V2-06 — Trending Keywords (web_search tool)
Fetches live eBay search trends via Claude's web_search tool. Reason: requires tool-use API path, separate UI component, 6-hour cache management. Growth Agent (V1) already includes market trends from Claude's training knowledge; live web search is an enhancement.

### V2-07 — CSV Export Tab (eBay Draft Listings)
Full eBay Seller Hub CSV format with time-window picker, "exported" tracking, reminder scheduling. The listing generator (P1) saves listing data to inventory items; the CSV export bridge to eBay Seller Hub is a power-user feature. Defer the full CSV tab; a simple "Export CSV" button on individual items is acceptable for V1.

### V2-08 — CSV/JSON Import Tab
Full import flow with preview, CSV detection, eBay order/listing rejection, normalisation. Reason: most new users start fresh; import is a migration tool. A simple JSON backup restore is enough for V1 private beta.

### V2-09 — Analytics Event Tracking
`trackEvent()` writes to `flippd_events` in localStorage. Never read in the app — appears to be a foundation for future PostHog/analytics flush. PostHog is already in the scaffold as a stub. Implement PostHog calls at key events in V2 rather than the localStorage approach.

### V2-10 — KPI Drill-Down Modals (Dashboard)
Tappable KPI cards open detailed drill-down modals with item-level breakdowns. Reason: nice polish, but not needed for core metrics visibility. Basic static KPI cards are sufficient for V1.

### V2-11 — Subscription / Stripe Checkout
Full `TIER_INFO` tier card UI, monthly/annual toggle, Stripe checkout redirect, customer portal. Reason: build the product first; monetization UI is V2. For closed beta, all users can be on a free or trial tier.

### V2-12 — Trial Banner / Scan Limit Modal
`updateTierBanner()` and `showLimitReachedModal()` depend on subscription tiers from the backend user object. Defer with subscription system.

### V2-13 — Monthly P&L Breakdown (standalone view)
`pnlRenderMonthly()` — rolling monthly profit/revenue table. P1 P&L shows current totals; monthly history is V2.

### V2-14 — Dashboard Bar Charts (renderProfitChart, renderTrendLine, renderBestWorst)
SVG-free HTML bar charts. In RN, these need a charting library (e.g. `victory-native`, `react-native-gifted-charts`). Defer; show numeric KPIs only in V1.

### V2-15 — Activity Feed (slide-in panel)
`logActivity()` + `toggleActivityFeed()` — event log visible in a side panel. Informational only; not core flow. Defer.

### V2-16 — eBay Search Link Tags (results view)
In `renderSingle()`, search keywords link to `https://www.ebay.com/sch/...?LH_Sold=1`. In RN these open in `Linking.openURL()`. Defer until RN results screen is built; include in that screen's implementation.

### V2-17 — Server Sync (cross-device inventory)
`syncFromServer()`, `pushItemToServer()`, etc. against `flippd-backend.replit.app`. ScanForProfit uses Supabase for all backend data — server sync rewrites entirely to Supabase queries. V1 is Supabase-native from day one, so the Replit backend is entirely replaced, not ported.

### V2-18 — Forgot Password (proper email API)
Current `showForgotPassword()` is `alert()` with a support email. Needs `POST /auth/forgot-password` → Resend email. Resend is already wired in the scaffold; implement in V2.

### V2-19 — Global FAB (Quick Add)
`fabQuickAdd()` — floating action button to add inventory item from any tab. Nice UX polish but not required for MVP.

### V2-20 — Stale Listing Badge on Tab Bar
Red badge count on Inventory tab showing stale listings. Requires a badge API (Expo Notifications has `setBadgeCountAsync` for app icon; tab badge needs custom implementation). Defer.

---

## Hardcoded Values Requiring Config (All Instances)

| Value | File | Line | Needs |
|-------|------|------|-------|
| eBay fee default `13` | DEFAULTS object | L4046 | `settings.ebayFee` (already in schema) |
| Pkg cost default `1.25` | DEFAULTS object | L4046 | `settings.pkgCost` (already in schema) |
| Min profit default `15` | DEFAULTS object | L4046 | `settings.minProfit` (already in schema) |
| Target ROI default `200` | DEFAULTS object | L4046 | `settings.targetRoi` (already in schema) |
| Max days default `60` | DEFAULTS object | L4046 | `settings.maxDays` (already in schema) |
| Tax reserve `0.25` (25%) | `pnlCalc()`, `sPnlRender()` | L3038, L5526 | Add `tax_reserve_pct` to settings; not in schema yet |
| IRS mileage rate `0.67` | `pnlLogMileage()`, `sPnlMiles()` | L5316, L5596 | Add `mileage_rate` to settings; changes annually |
| eBay fee fallback `13` | `calcProfit()` | L2217 | Remove fallback; require explicit fee param |
| Pkg cost fallback `1.25` | `calcProfit()` | L2217 | Remove fallback; require explicit pkg param |
| eBay client ID | `ebayConnect()` | L4054 | Move to env var `EBAY_CLIENT_ID` |
| eBay redirect URI | `ebayConnect()` | L4055 | Move to env var `EBAY_REDIRECT_URI` |
| Backend URL | `API_BASE` | L4420 | Replace entirely with Supabase + Edge Functions |
| Subscription prices | `TIER_INFO` | L6020–6027 | Move to Stripe product config; not hardcoded in client |

---

## Dead Code / Stubs

| Symbol | Location | Notes |
|--------|----------|-------|
| `requestMagicLink()` | L5765 | "Legacy stub — no longer used" — explicit comment |
| `watchItem()` | L4891 | Shows "Watch feature coming soon!" — never implemented |
| `trackEvent()` / `flippd_events` | L6478 | Written but never read or flushed |
| `_origLogScan` | L6488 | Captures `logScan` but never wraps it |
| `restorePreviewAfterRotation` | removed, comment L5529 | Removed in v5.12 due to OOM crash |
| `makeTinyThumb` | removed, comment L4038 | Removed — `createImageBitmap` causes OOM on Android |
| `window._origShowSettings` | L4049 | Decorator pattern for `showSourcingSettings`; `_origShowSettings` is `undefined` since `showSourcingSettings` is defined AFTER this line — no-op wrapper |
| `sPnlRender()` duplicate P&L | L6521 | Parallel P&L render path alongside `pnlRender*()` functions; both active simultaneously |
| localStorage key `flippd_jwt` AND `fif_api_key` | L5729–5730 | Duplicate JWT storage — both set to same value |
