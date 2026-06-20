# ScanForProfit — Session Handoff

This file is the persistent session context. Update it at the end of every Claude Code session with what changed.

---

## Session: 2026-06-20h — Dashboard profit board root cause fix (PR #117)

### What changed this session

**PR #117 — open (draft)** (`claude/scan-memory-ebay-dashboard-fixes`)

Root cause found for "profit board not syncing": `confirmSold()` only updated `localStorage` — it never pushed the sold status to the server. When `syncFromServer()` ran, the DB's version (still Unlisted/Listed) overwrote local state, wiping sold items from the P&L dashboard. Three targeted fixes:

- **`apps/web/public/app.html` — `confirmSold()`**: Added fire-and-forget `fetch(API_BASE, { type: 'inventory_status', id, status: 'Sold', actualSellPrice })` so the sale is persisted to DB immediately after local update.
- **`apps/web/public/app.html` — `renderDashboard()` timeframe filter**: Added `i.created_at` (snake_case) as date fallback alongside existing `i.created_at`. Server items never carry camelCase `createdAt`, so `new Date(undefined)` → `Invalid Date` → all items failed the timeframe filter. Fixed in 3 places (sold filter, monthly trend loop, recent sales sort).
- **`supabase/functions/claude-proxy/index.ts` — `VALID_TRANSITIONS`**: Added `'Sold'` to valid transitions from `'Unlisted'` (was `['Listed']` only). Users skip listing stage at thrift stores; without this the status call returned a 400 and the sale never persisted.
- **`supabase/functions/claude-proxy/index.ts` — `handleInventoryStatus`**: Now sets both `sell_price` and `sold_price` when marking Sold (mirrors eBay orders sync).

**claude-proxy deployed as version 66** (MCP tool — already live in Supabase).

### Files changed
- `apps/web/public/app.html`
- `supabase/functions/claude-proxy/index.ts`

### Commits
- `b14000f` — fix: dashboard profit board not showing sold items after sync

### Next tasks
1. **Merge PR #117** after CI passes — watch TypeScript Check
2. **eBay active listings**: Still 0 in DB. Check Supabase Logs → `ebay-oauth` for `ebay finding-api http error` after next sync. Verify `commerce.identity.readonly` scope at eBay Developer Center.
3. **Stripe checkout verification** — still "not yet verified"
4. **PostHog events** — still "not yet verified"

### Blockers
- None.

---

## Session: 2026-06-20g — Shelf scan error fix, stitchPhotos OOM, eBay sync + dashboard (PRs #115 + #116 merged)

### What changed this session

**PR #115 — merged** (`claude/shelf-scan-errors-memory-40qbad`)
- **`apps/web/public/app.html`**: Fixed `renderShelf()` ReferenceError — `buy.length`/`pass.length` → `list.length`/`skip.length` (the arrays are named `list` and `skip`, not `buy` and `pass`)
- **`apps/web/public/app.html`**: Removed `makeScanThumb()` call from `handleImage()` — thumbnail now sets `_thumbUrl: null` directly. Eliminates OOM path during screen recording.

**PR #116 — merged** (`claude/scan-memory-ebay-dashboard-fixes`)
- **`apps/web/public/app.html`**: `stitchPhotos()` OOM fix — replaced `new Image() + img.src = blobUrl` (decodes full-res JPEG ~48MB to RGBA) with `createImageBitmap(f, { resizeWidth:800, resizeHeight:800, resizeQuality:'medium' })`. Falls back to `new Image()` if browser doesn't support resize options. `bm.close()` called after drawImage. Verified via Playwright: canvas 1606×800 for 2 photos, resize path confirmed.
- **`apps/web/public/app.html`**: `switchTab('dashboard')` now calls `syncFromServer().catch(function(){})` on P&L tab open. Verified via Playwright intercept.
- **`supabase/functions/ebay-oauth/index.ts`**: `handlePullListings()` lazy-fetches `ebay_username` from eBay Commerce Identity API if null in DB, persists to `ebay_connections`.
- **`supabase/functions/ebay-oauth/index.ts`**: `handleCallback()` now logs HTTP status + response body when Identity API returns non-200 (was silently swallowed).

### Live DB state confirmed (post-session)
- `ebay_username = "fureverinframe"` saved in `ebay_connections` for user_id 2
- 14 Sold items in inventory (Fulfillment API working), 0 Listed (Finding API ran but returned 0 active listings)
- Check Supabase logs for `ebay finding-api http error` after next sync if active listings still missing

### Files changed
- `apps/web/public/app.html`
- `supabase/functions/ebay-oauth/index.ts`

### Commits
- `19141bb` — fix: shelf scan 'buy is not defined' error and screen-record low memory crash (PR #115)
- `89aa6ab` — fix: stitchPhotos OOM, eBay username lazy-fetch, dashboard sync on open (PR #116)
- `0553e8b` — fix: log eBay Identity API HTTP status when username lookup fails (PR #116)

### Decisions made (do not reverse)
- `stitchPhotos` uses `createImageBitmap` with resize options — non-square photos stretched to 800×800 (not cropped). Acceptable trade-off for OOM fix.
- No thumbnail generated for scan photos (`_thumbUrl: null`) — prevents OOM during screen recording.

### Next tasks
1. **eBay active listings**: If still 0, check Supabase → Logs → `ebay-oauth` for `ebay finding-api http error` lines. Also verify `commerce.identity.readonly` scope is enabled in eBay Developer Center app settings.
2. **Stripe checkout verification** — still "not yet verified"
3. **PostHog events** — still "not yet verified"

### Blockers
- None. Both PRs merged and deployed.

---

## Session: 2026-06-20f — Thumbnail <img> OOM fix (branch: claude/fix-scanner-thumbnail-oom-decode)

### What changed this session

**1 file changed: `apps/web/public/app.html`**

**Root cause of OOM crash after 1-2 scans (residual bug after PR #112):**

The `renderPhotoStrip()` function displayed thumbnails using `<img src="blob:...">`. Even though the thumbnail is displayed at 80×80px, many Android WebView versions decode the full-resolution source image into a raw bitmap (~48MB for a 12MP camera photo) before scaling for display. CSS display size does not prevent the full-resolution decode.

Memory accumulates across scans because:
1. User takes photo → `<img>` loads → 48MB decoded in WebView memory
2. User taps "← New Analysis" → `clearImage()` revokes the blob URL and clears the DOM
3. User takes another photo → another 48MB decode before GC has freed the first
4. By scan 2-3 → 96-144MB of raw bitmap data → Android kills the WebView process

**Fix:** Replaced the `<img>` element in `renderPhotoStrip()` with a no-decode placeholder div (📷 camera icon + "PHOTO N" label). No `<img>` = no browser image decode = zero memory accumulation between scans. Consistent with the broader no-decode philosophy documented at line 5165-5168 (`createImageBitmap` was also removed for the same reason).

Updated `.scan-thumb` CSS: removed `overflow:hidden` (no longer needed without an img), added `display:flex`, `flex-direction:column`, `align-items:center`, `justify-content:center`, `gap:3px`, and brand-tinted background.

### Files changed
- `apps/web/public/app.html` — `renderPhotoStrip()` + `.scan-thumb` CSS

### Next tasks
1. **Test on Android** — take 3+ scans in a row, confirm no OOM crash
2. **`invFormDetectItem` OOM** (inventory form "Detect Item from Photo" button, line 3166): still calls `compressImageForDetect` — same decode risk, lower frequency. Fix if reported.
3. **`stitchPhotos` OOM** (multi-photo mode, 2-3 photos, line 5755): decodes all photos via `new Image()` + canvas. Only affects multi-photo mode. Fix if reported.
4. Other deferred: Stripe checkout verification, Unlisted items button cleanup, date picker

### Decisions made (do not reverse)
- Scan photo strip shows a no-decode placeholder, not an image preview
- The no-decode principle applies to all scanner paths: no `<img>` elements loading camera photos, no `createImageBitmap`, no `compressImageForDetect` in the scanner flow

### Blockers
- None.

---

## Session: 2026-06-20e — Android AVIF false-positive fix (branch: claude/mobile-memory-profit-scanner-bt1rd9 → PR #112)

### What changed this session

**1 file changed: `supabase/functions/claude-proxy/index.ts`** — deployed as version 65

**Root cause of "HEIC error message on Android":**

Android 12+ Pixel/Samsung phones save gallery photos as AVIF by default. AVIF is also an ISOBMFF container — it has the same `ftyp` magic bytes (0x66 0x74 0x79 0x70) at offset 4-7 as HEIC. The previous HEIC check only tested bytes 4-7, so Android AVIF photos were falsely rejected with the iPhone-specific HEIC error message.

**Fix**: After checking `ftyp` at bytes 4-7, also read the brand code at bytes 8-11. Only reject with the HEIC message if brand is one of `['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1']`. All other ISOBMFF containers (AVIF brand `avif`/`avis`, MP4, MOV) return a generic "This image format is not supported. Please use JPEG, PNG, or WebP." — which does NOT include the iPhone-specific instructions.

```typescript
const hdr = new Uint8Array(buf, 0, 12);
if (hdr[4] === 0x66 && hdr[5] === 0x74 && hdr[6] === 0x79 && hdr[7] === 0x70) {
  const brand = String.fromCharCode(hdr[8], hdr[9], hdr[10], hdr[11]).toLowerCase();
  const isHeic = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand);
  if (isHeic) {
    return json({ error: 'HEIC photos are not supported. On iPhone: Settings → Camera → Format → Most Compatible to save as JPEG.' }, 415);
  }
  return json({ error: 'This image format is not supported. Please use JPEG, PNG, or WebP.' }, 415);
}
```

### Files changed
- `supabase/functions/claude-proxy/index.ts` — brand-specific HEIC detection at bytes 8-11

### Commit / PR
- Deployed as Edge Function v65 (ACTIVE)
- Committed and pushed on branch `claude/mobile-memory-profit-scanner-bt1rd9`
- PR #112 (draft) — already open

### Previous session (2026-06-20d) fixes also in PR #112
1. **HEIC early-reject** (v64): iOS HEIC gallery photos → 415 with actionable message
2. **JSON regex fallback** (v64): Claude preamble text before JSON object no longer crashes — regex extracts embedded JSON or shows user-friendly error
3. **Android OOM fix** (v63, commit `bffd8df`): Removed `compressImageForDetect` from `analyze()` — single-item scan now uses multipart streaming path

### Next tasks
1. **Merge PR #112** — all three fixes in one PR
2. **Test on Android**: AVIF gallery photos should now work (no longer rejected). JPEG photos from camera should still work.
3. **Test on iPhone with HEIC**: Settings → Camera → Format → HEIC mode → try gallery scan → should see actionable error
4. Other deferred: Stripe checkout verification, Unlisted items button cleanup, date picker, multi-photo stitchPhotos OOM

### Decisions made (do not reverse)
- HEIC detection uses brand bytes 8-11, not just the ftyp container marker at 4-7
- AVIF/MP4/MOV get a generic "format not supported" message (no iPhone instructions)
- HEIC gets iPhone-specific instructions to change camera format

### Blockers
- None. Fix deployed (Edge Function v65 ACTIVE).

---

## Session: 2026-06-20c — Android OOM crash fix (branch: claude/mobile-memory-profit-scanner-bt1rd9 → PR #112)

### What changed this session

**1 file changed: `apps/web/public/app.html`** — commit `bffd8df`

**Root cause of persistent "low memory" crash:**
`analyze()` called `compressImageForDetect(primaryFile, 1568, 0.85)` before every single-item scan. This function:
1. `FileReader.readAsDataURL` — reads entire file as base64 string in JS heap
2. `new Image(); img.src = dataUrl` — **fully decodes JPEG to raw RGBA pixels (~48MB for 12MP)**
3. Canvas draw + `toDataURL` — another full-size allocation

On Android WebViews (low-RAM devices like Moto G), step 2 OOM-kills the WebView process → black screen (WebView restarts) → "unable to process due to low memory" error.

**Fix:** Removed `compressImageForDetect` call entirely from `analyze()`. Single-item scan now calls `callScan('single_scan', hint)` without the `imageB64` argument, routing to the multipart/form-data path — browser streams raw File bytes with zero JS-heap decode. Server converts to base64 where memory is unconstrained. **Shelf scan already used this exact path successfully (analyzeShelf() line 6064).**

For multi-photo mode: `imgFile = await stitchPhotos(scanImgFiles)` updates the global so multipart path picks up the stitched file.

### Files changed
- `apps/web/public/app.html` — removed `compressImageForDetect` from `analyze()` (-8 lines, +5 lines)
- `docs/HANDOFF.md` — this entry

### Commit / PR
- Commit `bffd8df` on branch `claude/mobile-memory-profit-scanner-bt1rd9`
- Draft PR #112 — waiting for CI / merge

### Next tasks
1. **Merge PR #112** once CI passes — fixes the persistent Android low-memory crash
2. **Multi-photo stitchPhotos OOM** (separate issue): `stitchPhotos` also decodes images via `new Image()`. For single photo (the reported bug) this is never called — but if multi-photo mode ever crashes, same root cause applies. Fix: upload all files separately and let server stitch, OR only trigger stitchPhotos for small images.
3. Other deferred tasks from PR #107 (multi-photo scanner, desktop camera, Stripe checkout verification, etc.)

### Decisions made (do not reverse)
- Single-item scan uses multipart/form-data upload path — same as shelf scan — no client-side JPEG decode

### Blockers
- None.

---

## Session: 2026-06-20b — HOT/LIST/SKIP, empty cards fix, P&L refresh (branch: claude/merge-pr-103-0457dm → PR #107)

### What changed this session

**PR #107 (draft) on branch `claude/merge-pr-103-0457dm`** — commit `73fafe5`

1. **HOT/LIST/SKIP decision rename** — BUY→LIST, PASS→SKIP throughout `app.html`: CSS classes (`is-buy`→`is-list`, `is-pass`→`is-skip`), decision banners, shelf section headers, shelf stat nums, shelf item classes, scan history badges, drill-down badge, `getDecision()` return values, `D_ICON`/`D_LBL` maps, action buttons, AI prompts in `getShelfSys()`.
2. **HOT criteria expanded** — New `getDecision(profit, roi, days, sellThrough, demandLevel)` fires HOT when `demand_level` is HIGH/VERY HIGH, OR profit ≥ 2× minProfit, OR ROI ≥ 2× targetRoi.
3. **Fix empty Listing Tips / Check This cards** — Critical HTML bug: `</div>` was closing the card immediately after the `<h3>` heading, leaving content rendered outside the card. Fixed to `</h3>` with fallback tip text.
4. **P&L auto-refresh** — `saveItems()` now runs a debounced 400ms `renderDashboard()` call. `handleSyncOrders()` also explicitly calls `renderDashboard()` after eBay order sync.
5. **claude-proxy Edge Function** — `getDecision()` updated to return `HOT | LIST | SKIP`, both callers pass `net` profit and `demandLevel`, shelf prompt uses new decision labels and sort order. Deployed as version 63, ACTIVE.

### Files changed
- `apps/web/public/app.html` — HOT/LIST/SKIP rename, HTML bug fix, P&L refresh, updated getDecision()
- `supabase/functions/claude-proxy/index.ts` — updated getDecision() + shelf prompt

### Commit / PR
- Commit `73fafe5` pushed to `claude/merge-pr-103-0457dm`
- Draft PR #107 created — needs merge to main for Vercel deploy

### Next tasks
1. **Merge PR #107 to main** — get Vercel to deploy updated app.html
2. **Multi-photo scanner** (audit item 5): Single item scan should accept up to 3 photos.
3. **Desktop camera** (audit item 11): "Take Photo" on desktop should open webcam, not file picker.
4. **Verify Stripe checkout** — needs `STRIPE_PRICE_HUSTLE_MONTHLY`, `STRIPE_PRICE_STACK_MONTHLY`, `STRIPE_PRICE_EMPIRE_MONTHLY` in Supabase secrets.
5. **Unlisted items button cleanup**: Remove Enhance Photo, Edit, Unlisted status badge from item cards.
6. **Date picker**: Date Acquired field should open a calendar picker.

### Decisions made (do not reverse)
- HOT/LIST/SKIP replaces HOT/BUY/PASS — all CSS classes, AI prompts, and logic use new labels
- HOT is demand-aware: fires on HIGH/VERY HIGH demand regardless of absolute profit thresholds

### Blockers
- None.

---

## Session: 2026-06-20 — Merge PR #105 (branch: claude/merge-pr-103-0457dm)

### What changed this session

**PR #105 merged to main** — "fix: bug fixes round 2 — 10 UX/functionality issues"

PR #105 was on branch `claude/cool-rubin-mka6bv` and had a merge conflict with main in `apps/web/public/app.html`. The conflict was in the `ebay_item_id` client-side dedup logic:

- **main** had a single-pass dedup that kept both copies of a duplicate when the newer item was encountered first (buggy)
- **PR #105** had a two-pass dedup: build a best-item map first (pass 1), then filter using that map (pass 2) — correct

Resolved by keeping the PR's two-pass version, then squash-merged to main at commit `2c0f39d`.

**10 fixes in PR #105:**
1. Trial banner width overflow fix
2. Shipping cost hint text
3. Shelf scan MIME type — PNG support added (was JPEG-only)
4. Scanner tab renamed to "Profit Scanner"
5. eBay orders CSV import
6. Active listings status → "Listed" (was "Unlisted")
7. Duplicate scan warning
8. Remove.bg discoverability improvement
9. Profit Hub routing fix
10. eBay sync diagnostics (reconnect prompt when 0 results)

### Files changed
- `apps/web/public/app.html` — all 10 bug fixes
- `supabase/functions/claude-proxy/index.ts` — shelf scan PNG support
- `supabase/functions/ebay-oauth/index.ts` — eBay sync diagnostics
- `docs/superpowers/plans/2026-06-19-bug-fixes-round-2.md` — implementation plan (committed with PR)

### Commit / PR
- PR #105 squash-merged → main at `2c0f39d`
- Session branch `claude/merge-pr-103-0457dm` fast-forwarded to match main

### Next tasks
1. **Multi-photo scanner** (audit item 5): Single item scan should accept up to 3 photos. Camera: take → add → repeat. Gallery: multi-select up to 3. Shelf scan stays at 1.
2. **Desktop camera** (audit item 11): "Take Photo" on desktop should open webcam, not file picker.
3. **Verify Stripe checkout** — still needs `STRIPE_PRICE_HUSTLE_MONTHLY`, `STRIPE_PRICE_STACK_MONTHLY`, `STRIPE_PRICE_EMPIRE_MONTHLY` in Supabase secrets (Dashboard → Edge Functions → Secrets).
4. **Unlisted items button cleanup** (audit): Remove Enhance Photo, Edit, Unlisted status badge from item cards — keep only essential actions.
5. **Date picker** (audit): Date Acquired field should open a calendar picker.

### Decisions made (do not reverse)
- `ebay_item_id` dedup uses two-pass logic (best-item map then filter) — single-pass was buggy and has been replaced

### Blockers
- None.

---

## Session: 2026-06-19 — Audit pass + image compression fix (branch: claude/zealous-ritchie-yhxgqc → merged to main as PR #102)

### What changed this session

All changes in `apps/web/public/app.html` unless noted.

**Branding / copy audit (all from 619_AM_AUDIT_FINDINGS.md):**
- Scanner tab renamed: "Scout" / "SCOUT" → "Scanner" / "SCANNER" (display label only; tab-scanner is new internal ID)
- Decision labels: "BUY" → "List", "PASS" → "Skip", "HOT" stays "Hot" (internal DB values unchanged: BUY/HOT/PASS)
- Scan button: "FLIP OR PASS" → "Run Profit Scanner" (both single and shelf modes)
- Shelf scan: "Rank This Shelf" → "Run Profit Scanner"
- Scan headline: "Profit Scanner" subhead copy updated
- Listing modal CTA: "Generate eBay Listing" + "List to eBay"
- Add/Edit form save button: "Save to Inventory"
- Inventory sync buttons: "Import eBay Listings" + "Sync eBay Listings"
- Export CSV: moved to Unlisted view header, removed from dashboard
- eBay Sync panel: date range buttons removed
- Backup & Restore: moved to Settings card
- Onboarding: per-user key (`sfp_onboarding_complete_<username>`)
- Trial banner: overflow fix
- Emoji removed throughout (⏳, ⏱, 🎉, tab category emojis, button emojis)
- Amber glows removed from Scout setup-card, kpi-card hover, nav-card hover, item-card hover

**Image compression fix (critical bug):**
- Anthropic rejects images >10MB; phone photos regularly exceed this
- `callScan()` now accepts optional `imageB64` param — if provided, sends JSON `{type, imageBase64}` instead of multipart FormData
- `analyze()` calls `compressImageForDetect(imgFile, 1568, 0.85)` before `callScan()` — reduces phone photos to ≤1568px JPEG
- Loading state: "Compressing photo..." shown during compression step

**Project file updates:**
- `CLAUDE.md`: tab table updated (Scout → Scanner); "Things Claude Gets Wrong" anti-pattern updated
- `docs/FEATURE_TRIAGE.md`: F-01 renamed "Hot / List / Skip"; Scout tab references → Scanner tab
- `docs/HANDOFF.md`: this entry

### Commits
- `b004b56` — audit pass (branding, UX copy, CSV import, glow removal, emoji cleanup)
- `d960780` — image compression + Run Profit Scanner button rename

### PR
- PR #102 merged to main

### Next tasks
1. **Multi-photo scanner** (audit item 5): Single item scan should accept up to 3 photos. Camera: take → add → repeat. Gallery: multi-select up to 3. Shelf scan stays at 1.
2. **Desktop camera** (audit item 11): "Take Photo" on desktop should open webcam, not file picker.
3. **Unlisted items button cleanup** (audit): Remove Enhance Photo, Edit, Unlisted status badge from item cards — keep only essential actions.
4. **Add/Edit photo multi-select** (audit item 5): Allow adding more than 1 photo per inventory item.
5. **Date picker** (audit): Date Acquired field should open a calendar picker.
6. **Verify Stripe checkout** — still needs price IDs in Supabase secrets.

### Decisions
- Internal `ScanDecision` type stays `'BUY' | 'HOT' | 'PASS'` — only the UI display labels changed (BUY → List, PASS → Skip). DB values not changed.
- Tab internal ID changed from `tab-scout` to `tab-scanner` to match renamed display label.

### Blockers
- None.

---

## Session: 2026-06-19 morning — eBay Sync button + listing policies fix (branch: claude/morning-session-anydn7)

### What changed this session

**eBay Sync button — `apps/web/public/app.html`**
- `showEbaySyncPanel()` existed but had no caller anywhere on the inventory screen
- Added full-width "eBay Sync" button between the Export CSV/Import row and the stats grid on the Inventory home view
- Users can now open the eBay sync panel directly from Inventory without going into Settings

**Listing policies fallback — `supabase/functions/ebay-oauth/index.ts` (v41)**
- `handleCreateListing` was blocked if seller had no prior offers (needed to borrow `listingPolicies` from an existing offer)
- Now falls back to eBay Account API: fetches `fulfillment_policy`, `payment_policy`, `return_policy` directly
- If still no policies: error message now says "eBay Seller Hub → Account → Business Policies" instead of a generic failure
- `sell.account` OAuth scope was already included — no OAuth re-auth needed

**DB findings**
- `ebay_connections` table confirmed exists and is the correct token store (not `users.ebay_access_token`)
- User has eBay connected with token refresh handled automatically

### Commit
`f9d7115` — PR #97 (draft, open)

### CI results (PR #97) — ALL GREEN
- TypeScript Check: ✅
- Vercel Preview: ✅ Ready
- Supabase Preview: ✅ Database/Services/APIs deployed

### Next tasks
1. **Merge PR #97** — all CI green
2. **Test "List on eBay"** — with v41 deployed, click "List on eBay" on an Unlisted item with a sell price set. Error message will now be specific if Business Policies aren't configured in eBay Seller Hub.
3. **Test eBay Sync button** — now visible on Inventory tab home screen; opens the 30/60/90-day sync panel
4. **Verify Stripe checkout** — still needs `STRIPE_PRICE_HUSTLE_MONTHLY`, `STRIPE_PRICE_STACK_MONTHLY`, `STRIPE_PRICE_EMPIRE_MONTHLY` in Supabase secrets (Dashboard → Edge Functions → Secrets)

### Decisions made (do not reverse)
- `ebay_connections` table is canonical for eBay token storage. Prior HANDOFF entries suggesting tokens live in `users` columns are stale.

### Blockers
- None. If "List on eBay" still fails after v41, the error message will be specific enough to diagnose.

---

## Session: 2026-06-19c — Visual polish + CSS refactor (branch: claude/visual-polish-css-refactor-m08ddu)

### What changed this session

All changes in `apps/web/public/app.html` and `apps/web/public/index.html`.

**app.html — 7 targeted fixes from the deferred audit:**

1. **KPI grid breakpoint widened**: `max-width:479px` → `max-width:639px` — 4-col grid now collapses to 2-col on all phones and small tablets (not just sub-480px screens)

2. **prefers-reduced-motion added**: `@media(prefers-reduced-motion:reduce)` block added to app.html `<style>` — matches what index.html already had; disables all CSS animations/transitions for users who prefer reduced motion

3. **Inline style reduction continued**: Added 5 new utility classes (`.flex-center`, `.flex-center-8`, `.flex-between-center`, `.mb-10`, `.mb-16`). Converted repeated flex layout patterns in settings, inventory list, photo workspace, and modal headers. Count: 818 (Session 7) → 673 (Session 7 sweep) → 616 (pre-session) → **608** (post-session)

4. **Gold button contrast fixed — all instances**: `color:#fff` → `color:#000` on all `background:var(--accent)` buttons:
   - Auth tab Login/Register buttons (HTML inline style)
   - `setAuthMode()` JS was overriding the Session 7 HTML fix back to `#fff` — both active states now set `#000`
   - `#sub-bill-month` (Monthly billing toggle)
   - "List on eBay" button (JS template string)
   - "Relist" button (JS template string)
   - "+ Add Item" / "+ Add" inventory buttons

5. **Auth hint copy updated**: "Welcome back. Enter your credentials to continue." → "Log in to your ScanForProfit account." — updated in both HTML (initial render) and `setAuthMode()` JS (login mode switch). The `showToast('✓ Welcome back...')` on successful login is intentionally kept (contextually appropriate celebration message, not placeholder text)

**index.html — 2 fixes:**

6. **Nav link sparseness resolved**: Nav had only "Pricing". Added "Features" (`#features`) and "FAQ" (`#faq`) — links appear at ≥880px per existing `.nav-links` media query

7. **Hero eyebrow copy updated**: "The thrift store scanner for eBay resellers" → "AI-powered profit scanner for eBay resellers" — adds "AI-powered", removes passive "thrift store scanner" phrasing

### Audit items NOT touched (permanently deferred):
- `prefers-reduced-motion` on index.html — already present since Session 7
- `body::before` scanline z-index — already fixed in Session 7 (z-index: 0)
- "Welcome back" toast on login success (`showToast`) — intentionally kept

### Commit
`1a1ea22` — on branch `claude/visual-polish-css-refactor-m08ddu`, PR #96

### CI status (at session end)
- Vercel Preview: ✅ Building → deployed
- Supabase: ✅ Skipped (no supabase/ changes — correct)
- Railway: ✅ Building
- TypeScript Check: ⏳ In progress at session end

### Next tasks
1. Merge PR #96 once all CI passes
2. Verify Stripe checkout end-to-end (still "not yet verified")
3. PR #93 (eBay push listing + sync orders) — merge if not already done

### Blockers
- None from this session

---

## Session: 2026-06-19b — eBay push listing + sync sold orders (branch: claude/stripe-empire-ebay-layout-l8wh8v)

### What changed this session

**eBay create-listing endpoint (NEW) — `ebay-oauth` v40**
- `POST /create-listing` — pushes a ScanForProfit inventory item to eBay as a live fixed-price listing
  1. Loads item from DB (validates sell_price exists)
  2. PUT `/sell/inventory/v1/inventory_item/{sku}` — registers product (title, desc, condition, images)
  3. GET `/sell/inventory/v1/location` — gets/creates merchant location key (`sfp-default` if none)
  4. GET `/sell/inventory/v1/offer?limit=1` — borrows listingPolicies from existing offer (returns 400 with setup instructions if seller has no offers yet)
  5. POST `/sell/inventory/v1/offer` — creates offer (FIXED_PRICE, EBAY_US, category 20082 fallback)
  6. POST `/sell/inventory/v1/offer/{offerId}/publish` — publishes listing
  7. Updates inventory: `status='Listed'`, `ebay_item_id=listingId`, `listed_at=now()`
  8. Returns `{ listingId, listingUrl }`
- Condition mapping: New→NEW, Like New→LIKE_NEW, Open Box→NEW_OTHER, Good/Used→USED_GOOD, Fair→USED_ACCEPTABLE, Poor→FOR_PARTS_OR_NOT_WORKING
- Category fallback: uses `item.ebay_category_id` from DB, or 20082 ("Everything Else")

**eBay sync-orders endpoint (NEW) — `ebay-oauth` v40**
- `POST /sync-orders` — dedicated sold-order sync (90 days) that captures actual sale price
  - Queries eBay Fulfillment API for all orders in last 90 days
  - For each line item: matches by SKU then by `ebay_item_id`
  - Updates DB: `status='Sold'`, `sold_at`, `sold_price` (from `lineItemCost.value`)
  - Returns `{ synced }` count
- Differs from `pull-listings` (which ignores actual sale price)

**Migration: `sold_price` column**
- `supabase/migrations/20260619000000_006_add_sold_price.sql`
- `ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS sold_price numeric;`
- Applied to Supabase project dqgfpchkheznvanfgsmx ✅

**app.html UI changes**
- "List on eBay" button: appears on Unlisted items with no `ebay_item_id`. Calls `handleListOnEbay(id)` → `POST /create-listing` → refreshes inventory.
- "Sync Sold Orders" button: added to eBay sync panel (below "Pull Listings" button). Calls `handleSyncOrders()` → `POST /sync-orders` → shows count + refreshes inventory.
- Both handlers show progress in `#sync-progress` and restore button state in `finally`.

### Commit
`07a0c23` — on branch `claude/stripe-empire-ebay-layout-l8wh8v`, PR #93

### Next tasks
1. **Test push listing**: Click "List on eBay" on an Unlisted item in app.html. First time may need eBay listing policies set up.
2. **Test sync orders**: Use "Sync Sold Orders" button in eBay sync panel.
3. **Merge PR #93** — Vercel deploying as of 2026-06-19 02:16 UTC.
4. **Verify Stripe checkout** — still needs `STRIPE_PRICE_HUSTLE_MONTHLY`, `STRIPE_PRICE_STACK_MONTHLY`, `STRIPE_PRICE_EMPIRE_MONTHLY` in Supabase secrets.

### Blockers
- `handleCreateListing` requires seller to have at least one existing eBay offer (to borrow listing policies). If the seller has never listed via Inventory API, `policies` will be null and the endpoint returns a 400 with setup instructions. Workaround: the user can create one listing manually on eBay first, then all future pushes will work.

---

## Session: 2026-06-19 — Stripe fix, monthly billing, desktop layout, animated logo (branch: claude/stripe-empire-ebay-layout-l8wh8v)

### What changed this session

**Bug fix — Stripe checkout interval mismatch (RESOLVED)**
- Root cause: `app.html` sends `interval: 'month'` but `PRICE_ID_MAP` keys use `'monthly'`/`'annual'`. Every upgrade click returned a silent "Unknown tier: hustle" error.
- Fix: Added normalization in `stripe-checkout/index.ts`: `month→monthly`, `year→annual` before PRICE_ID_MAP lookup.
- Deployed as `stripe-checkout` v46 via Supabase MCP.

**Annual billing removed (monthly only for now)**
- `app.html`: Removed the Monthly/Annual toggle button from the Plan tab. Price cards always render using `d['month']` price. Removed `_subInterval==='year'` conditional display.
- `index.html`: Removed `or $180/yr · Save $48` (Hustle) and `or $480/yr · Save $108` (Stack). Updated tagline to "Monthly billing only. Cancel anytime."
- `CLAUDE.md`: Added "Billing: Monthly only — annual plans not yet available" rule.

**index.html mobile overflow fix**
- Added `overflow-x: hidden` to both `html` and `body` to prevent horizontal overflow that caused mobile browsers to zoom out.

**app.html desktop responsive layout**
- Added two breakpoints so the app fills screen on desktop:
  - `@media (min-width: 860px)` → `max-width: 860px`
  - `@media (min-width: 1100px)` → `max-width: 1100px`
- Applies to `.tab-panel`, `.app-header`, `.tab-bar`.

**Animated logo in index.html**
- Replaced the static gold "S" box (`.logo-mark`) with the pulsing ScanMark SVG in both nav and footer.
- SVG matches the loading indicator in app.html's Pulse tab.

### eBay scopes confirmed (5 total, in `ebay-oauth/index.ts`)
1. `api_scope` — public read
2. `sell.inventory` — create/update/publish/delete listings and offers
3. `sell.account` — fulfillment/payment/return policies
4. `sell.fulfillment` — orders, shipments, tracking
5. `commerce.identity.readonly` — seller username

### CI results (PR #93)
- Vercel: ✅ Deployed
- Supabase: ✅ Preview branch
- TypeScript Check: pending at session end
- Railway: building at session end

### Next task
1. Merge PR #93
2. Decide eBay feature priority (user was asked):
   - **Option A (recommended)**: Push listing to eBay — closes the full scan→add→list loop
   - **Option B**: Sync sold orders — pull fulfilled orders, mark inventory as Sold
3. After merge: verify Stripe checkout end-to-end. IMPORTANT: requires these Supabase secrets to be set in Dashboard → Edge Functions → Secrets:
   - `STRIPE_PRICE_HUSTLE_MONTHLY`
   - `STRIPE_PRICE_STACK_MONTHLY`
   - `STRIPE_PRICE_EMPIRE_MONTHLY`

### Files changed
- `supabase/functions/stripe-checkout/index.ts` — interval normalization, deployed v46
- `apps/web/public/app.html` — remove annual toggle, monthly-only price cards, desktop breakpoints
- `apps/web/public/index.html` — remove annual pricing, overflow fix, animated logo
- `CLAUDE.md` — monthly-only billing rule
- `docs/HANDOFF.md` — this file

### Commit
`31b7276` — PR #93 (draft, open)

### Blockers
- Stripe checkout still requires `STRIPE_PRICE_*_MONTHLY` env vars to be set in Supabase secrets (separate from code fix).

---

## Session: 2026-06-18b — Wire pg_cron trigger for export-reminder (branch: claude/ebay-sync-schema-dhbhir)

### What changed this session

- **Migration** `20260618000001_007_export_reminder_cron.sql` — applied to DB:
  - Enabled `pg_cron` extension
  - Added `export_reminder_enabled` (boolean, default false) and `export_reminder_time` (time, default 09:00) to `settings` table
  - Created `public.send_export_reminders()` SECURITY DEFINER function — queries users with `Ready to Export` items whose reminder hour matches current UTC hour, fires `net.http_post` to the `export-reminder` Edge Function for each
  - Scheduled cron job `export-reminders-hourly` at `0 * * * *` (confirmed active, jobid=1)
- **`supabase/functions/auth/index.ts`** — deployed as v29:
  - Added `PATCH /auth/settings` → `handleSaveSettings` — upserts `export_reminder_enabled` and `export_reminder_time` to `settings` table for the authed user
  - Updated `handleMe` to join `settings` table and include `exportReminderEnabled` and `exportReminderTime` in the `/me` response
- **`apps/web/public/app.html`**:
  - `saveSettings()` now fires a `PATCH /auth/settings` call (fire-and-forget) when the user is logged in, persisting reminder prefs to DB
  - `loadUserInfo()` now reads `exportReminderEnabled` and `exportReminderTime` from the `/me` response and hydrates `S` + localStorage on login

### End-to-end flow
1. User toggles "Export Reminder" on/off or changes the time in Settings → `saveSettings()` → `PATCH /auth/settings` → stored in `settings.export_reminder_enabled/time`
2. pg_cron fires every hour at :00 UTC → `send_export_reminders()` → queries for users matching that UTC hour with `Ready to Export` items → `net.http_post` to `export-reminder` Edge Function per user
3. `export-reminder` queries inventory, looks up email, sends via Resend

### Remaining prerequisite
- `RESEND_API_KEY` must be set in Supabase Dashboard → Settings → Edge Functions → Secrets for emails to actually send

### Next task
Verify Stripe upgrade flow end-to-end (still marked "not yet verified" in CLAUDE.md build status)

---

## Session: 2026-06-18 — Deploy export-reminder Edge Function (branch: claude/ebay-sync-schema-dhbhir)

### What changed this session

**export-reminder Edge Function — DEPLOYED**

Deployed `supabase/functions/export-reminder/index.ts` to Supabase project `dqgfpchkheznvanfgsmx` as `export-reminder` v1 (function id: `bc1f68c3-2814-422d-abb5-dd0d72790c3a`). This was a long-standing deferred task from SESSION_6.

The function:
- Accepts `POST { userId }` (no JWT verification — caller is n8n/cron, not a user browser)
- Queries `inventory` for items with `status = 'Ready to Export'`
- Looks up user email from `users` table
- Sends a Resend email listing the items with a link to `scanforprofit.com/app.html`
- Returns `{ sent: true/false, count, reason }`

**Prerequisites before emails will send:**
- `RESEND_API_KEY` must be set in Supabase project secrets (Dashboard → Settings → Edge Functions → Secrets)
- A cron trigger (n8n or Supabase pg_cron) must call `POST https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/export-reminder` with `{ userId }` at each user's preferred time

### Files changed
- `docs/HANDOFF.md` — this file

### Decisions made (do not reverse)
- `verify_jwt: false` — this function is invoked by cron/n8n, not a user browser session. The `userId` body param is used server-side only — no RLS bypass risk since the service role key is used.
- Cron scheduling is out of scope for this session — function is the prerequisite. Wiring deferred.

### Next task
1. Set `RESEND_API_KEY` in Supabase secrets if not already set.
2. Wire n8n or pg_cron to call `export-reminder` per user's preferred time (`S.exportReminderTime` from localStorage) — requires storing that preference in the DB to be cron-accessible.
3. Connect eBay developer sandbox credential and run end-to-end sync test (0 users have `ebay_access_token` set).
4. Verify Stripe upgrade flow end-to-end.

### Blockers
- None from this session.

---

## Session: 2026-06-18 — eBay Sync Schema Fix (branch: claude/ebay-sync-schema-dhbhir)

### What changed this session

**Change 22 BLOCKER resolved — eBay Sync schema mismatch.**

The HANDOFF from SESSION_6 described this blocker incorrectly. It claimed tokens were in an `ebay_connections` table — but that table does not exist. Tokens were correctly in the `users` table all along (added by migration `005_add_ebay_oauth_columns.sql`). The `ebay-oauth/index.ts` function's `getValidEbayToken()` already read from `users` correctly.

The actual bugs were:

1. **Wrong base URL in `app.html`** (line 5288): `ebayPullListings()` called `API_BASE + '/ebay/pull-listings'` (the `claude-proxy` function), which has no such route. Fixed to `EBAY_BASE + '/pull-listings'`.

2. **Missing endpoint in `ebay-oauth/index.ts`**: No `/pull-listings` handler existed. Added `handlePullListings()` which:
   - Authenticates user via JWT
   - Gets valid eBay token via existing `getValidEbayToken()` (reads from `users` table)
   - Fetches sku→title map from `GET /sell/inventory/v1/inventory_item?limit=200`
   - Fetches active/draft offers from `GET /sell/inventory/v1/offer?limit=200` and upserts to `inventory` table (dedup by `ebay_item_id` then `sku`)
   - Fetches sold orders from `GET /sell/fulfillment/v1/order?filter=creationdate:[since..]` and marks matching inventory items as `Sold`
   - Returns `{ active, drafted, sold }` counts
   - Added route: `POST /pull-listings`

3. **Deployed** `ebay-oauth` v21 to Supabase project `dqgfpchkheznvanfgsmx`.

### Files changed
- `apps/web/public/app.html` — fixed URL at line 5288
- `supabase/functions/ebay-oauth/index.ts` — added `handlePullListings()` + route
- `docs/HANDOFF.md` — this file

### Commit / PR
- `4a3f25b` — fix(ebay): add /pull-listings endpoint and fix wrong base URL
- PR #86 — merged to main ✅

### CI results
- TypeScript Check: ✅
- Vercel Preview: ✅
- Supabase Preview: ✅
- Railway: ✅

### Decisions made (do not reverse)
- There is no `ebay_connections` table. eBay OAuth tokens live in `users` table columns: `ebay_access_token`, `ebay_refresh_token`, `ebay_token_expires_at`, `ebay_username` (added by migration 005). Do not create an `ebay_connections` table.
- `handlePullListings` deduplicates by `ebay_item_id` first, then by `sku`. New items get `created_from: 'ebay_sync'`.
- The `days` parameter (from the sync panel's 30/60/90 day selector) gates the order fetch window only — offers are always fetched without date filter (eBay Inventory API doesn't support date filtering on offers).

### Change 22 status
**RESOLVED** — no longer a blocker.

### Next task
1. Connect a real eBay developer sandbox credential and run an end-to-end sync test (currently 0 rows in `ebay_connections` per CLAUDE.md — now means 0 rows with `ebay_access_token` set in `users` table).
2. Verify Stripe upgrade flow end-to-end (still "not yet verified" in build status).
3. Verify Vercel deploy has `<meta property="og:image">` set in index.html/app.html (from SESSION_8).

### Blockers
- None from this session.
- export-reminder Edge Function still not deployed to Supabase (from SESSION_6 — requires `supabase functions deploy export-reminder --project-ref dqgfpchkheznvanfgsmx`).

---

## Session: 2026-06-18 — SESSION_8 Ship-Blockers (branch: claude/new-session-s9v08a)

### What changed this session

Only one file changed: `apps/web/public/og-image.png` (new binary, 1200×630 PNG).

**Tasks 1–5 — already complete from prior sessions:**
- Task 1 (Remove PostHog from index.html): 0 occurrences — done in an earlier session.
- Task 2 (Fix openRelistConfirm signature mismatch): Only one definition exists at line 4583 `openRelistConfirm(sku, name)`, all three call sites pass `(sku, name)` — already correct.
- Task 3 (Remove FLIPPD v5.24 comment): Line 2 already reads `<!-- ScanForProfit app.html -->` — done in a prior session.
- Task 4 (Remove Watch button from BUY result): BUY action bar (lines 5963–5970) only has BUY and PASS buttons — Watch already removed.
- Task 5 (Remove "Early Access" label): 0 occurrences in app.html — done in a prior session.

**Task 6 — DONE: Generate og-image.png**
- Created `apps/web/public/og-image.png` at exact 1200×630 OG standard dimensions.
- Dark "Industrial Terminal" palette: bg `#0a0a0a`, green `#00e676`, gold `#d4a843`, text `#f0ead8`.
- Logo: Scan Bracket mark (two gold L-brackets + three green rising bars), faithful to BRAND_IDENTITY.md SVG spec.
- Wordmark: "SCAN" in green + "FORPROFIT" in warm white, WorkSans Bold 74px.
- Tagline: "Point. Scan. Know if it flips." in IBM Plex Mono 28px, gold — stop-slop approved (specific, active voice, no filler).
- Domain: "scanforprofit.com" in muted mono, 15px.
- Thin gold top-accent line, subtle scanline texture, vertical gold separator.
- Used warm parchment palette from PROMPT_SHIP_BLOCKERS.md (`#00bb66`, `#f2ece0`, `#3a2410`) was **overridden** with canonical Industrial Terminal palette from BRAND_IDENTITY.md + HANDOFF.md "do not reverse" decision. Prompt tokens are stale.
- Generated via Python/Pillow (no external service). WorkSans Bold + IBM Plex Mono from `/mnt/skills/examples/canvas-design/canvas-fonts/`.

**idb rename (flippd_photos) — explicitly deferred:**
- Accepted as-is, zero user-visible impact, high migration risk. Removed from blockers list.

**TypeScript check:**
- Pre-existing `TS2307`/`TS7026` errors (missing `node_modules` in sandbox) — unchanged, same as all prior sessions. This session introduced no TypeScript files.

### Files changed
- `apps/web/public/og-image.png` — new (1200×630 PNG)
- `docs/HANDOFF.md` — this file

### Next task
1. Merge PR for this branch into main.
2. Verify Vercel deploy picks up og-image.png and `<meta property="og:image">` is set in index.html/app.html.
3. If og:image meta tag is missing, add it pointing to `/og-image.png`.
4. Stripe upgrade flow end-to-end verification (currently "not yet verified" in build status).

### Blockers
- None introduced this session.
- Change 22 (eBay Sync schema mismatch) remains deferred from SESSION_6 — `ebay_connections` table must be used, not `settings`.

---

## Session: 2026-06-18 — Tech Debt (branch: claude/new-session-na4jxe)

### What changed this session

**All primary work in `apps/web/public/app.html`, `CLAUDE.md`, `docs/FEATURE_TRIAGE.md`, `supabase/migrations/`.**

**Task 1 — Hardcoded taxReservePct and mileageRate — DONE**
- Added `taxReservePct: 0.25, mileageRate: 0.67` to DEFAULTS in app.html
- Fixed `sPnlRender()` line ~7912: `net * 0.25` → `net * S.taxReservePct` (was hardcoded, no S reference)
- Removed `?? 0.25` fallback from `pnlCalc()` taxReserve line (~4067) — DEFAULTS now owns the default
- Removed `?? 0.67` fallback from `pnlLogMileage()` (~6481) and `sPnlMiles()` (~7980) — same reason
- Added "Tax & Mileage" card to settings panel UI with number inputs for both fields
- Updated `populateSettingsUI()` to populate/display these fields
- Created DB migration: `supabase/migrations/20260618000000_006_add_tax_mileage_settings.sql` — adds `tax_reserve_pct` and `mileage_rate` columns to `settings` table (applied to `dqgfpchkheznvanfgsmx`)
- Shared types `UserSettings` already had these fields — no change needed
- **Verify:** `grep -n "0\.25\|0\.67" apps/web/public/app.html` — zero matches in business logic paths; DEFAULTS values only

**Task 2 — localStorage key migration (fef_ → sfp_) — DONE**
- Removed `?? localStorage.getItem('fef_trending')` fallback (~line 4262)
- Removed `?? localStorage.getItem('fef_last_csv_export')` fallback (~line 6668)
- Removed `?? localStorage.getItem('fef_csv_reminder')` fallback (~line 6779)
- Migration block at lines ~7441-7447 already existed and handles all fef_ → sfp_ renames for existing users
- `fef_expenses_v1` is IN the migration block (added by a prior session) — migration handles it; no separate read-fallback was needed
- `flippd_photos` IndexedDB rename permanently deferred (high-risk, zero user benefit)
- **Verify:** `grep -n "fef_" apps/web/public/app.html` — only the migration block (5 lines, all correct)

**Task 3 — Fix P&L broken HTML — DONE**
- Line ~4219: `<div class="card"><h3 class="card-title">Expenses by Type</div>...content...</h3>` → correct nesting: `<h3>...</h3>...content...</div>`

**Task 4 — Duplicate CSS keyframes — NO-OP**
- `@keyframes fadeUp` and `@keyframes rowIn` each had only one definition — no duplicates to remove

**Task 5 — HOT animation duplicate — DONE**
- Removed `@keyframes hotPulse { ... }` and `.decision-banner.is-hot { animation: hotPulse 1.8s ... }` that was overwriting `hotGlow`
- `hotGlow` at line 391 is now the only animation for `.is-hot`

**Task 6 — z-index scanline over modals — DONE (partial from Session 7)**
- `body::before` z-index was already set to `0` (hardcoded) by Session 7
- This session updated the CSS variable: `--z-scanline: 9000` → `--z-scanline: 0`
- Both the variable and the element now consistently use 0 (below `--z-modal: 600`)

**Task 7 — CLAUDE.md tab names — DONE**
- Tab table updated: TRENDS → PULSE (tab-pulse), DASH → P&L (tab-pnl)
- Added Tab ID column to table for clarity
- Updated "Things Claude Commonly Gets Wrong" tab list to match

**Task 8 — FEATURE_TRIAGE.md Growth Agent — DONE**
- F-27 entry updated: added "Status: ✅ Implemented (inline)" note
- P-05 entry updated: added "Status: ✅ Implemented (inline)" note
- Both flag app.html at ~line 4342 as canonical prompt location

**Task 9 — Dead code removed — DONE**
- Removed `sessionStorage.removeItem('flippd_preview_src')` from `clearImage()` — dead since v5.11
- Removed 5-line comment block + `sessionStorage.removeItem('flippd_preview_src')` from `window.onload` — dead since v5.12
- `flippd-backend.replit.app` comment: already removed in a prior session — no-op
- Remaining 1 occurrence of `flippd_preview_src` in app.html is the "do NOT remove in tab-switch" documentation comment — kept intentionally

**Task 10 — tiers.ts Hustle limits — NO-OP**
- tiers.ts already shows Hustle: `scansPerMonth: 250, inventoryItems: 250` matching CLAUDE.md exactly

### Files changed
- `apps/web/public/app.html` — Tasks 1, 2, 3, 5, 6, 9
- `CLAUDE.md` — Task 7
- `docs/FEATURE_TRIAGE.md` — Task 8
- `supabase/migrations/20260618000000_006_add_tax_mileage_settings.sql` — new file (Task 1)
- `docs/HANDOFF.md` — this file

### SESSION START check anomaly
- Check 2 found 13 UI component files (expected 12) — `OnboardingSheet.tsx` is present but not in the CLAUDE.md expected list. Added in a prior session (see SESSION_2_3_PROMPT session). Not a blocker.

### Decisions made (do not reverse)
- `fef_expenses_v1` was already migrated to `sfp_expenses_v1` by the migration block added in the PR#67 session — no special read-fallback needed
- `taxReservePct` and `mileageRate` are now in DEFAULTS — S will always have them after `loadSrcSettings()`; no `??` fallbacks needed in calculations
- CLAUDE.md tab names: PULSE and P&L are canonical (not TRENDS and DASH)

### Items permanently deferred (do not add back to active blockers)
- IndexedDB rename (`flippd_photos`): permanently deferred — high-risk, zero user benefit
- `exportFlippdBackup`, `handleFlippdImport` DOM ID cleanup: deferred

### Next task
1. Apply DB migration to Supabase (done via MCP this session — `006_add_tax_mileage_settings`)
2. Merge PR #82 (SESSION_7 deferred audit fixes — PR exists, pending merge)
3. Verify Stripe upgrade flow end-to-end (currently "not yet verified" in build status)
4. Resolve Change 22 BLOCKER from SESSION_6: eBay Sync reads from wrong table (`settings` vs `ebay_connections`)

### Blockers
- Change 22 (eBay Sync): settings table has no OAuth columns; tokens are in `ebay_connections` — requires schema-aware fix
- export-reminder Edge Function: file exists locally but not deployed to Supabase (requires `supabase functions deploy export-reminder --project-ref dqgfpchkheznvanfgsmx`)

---

## Session: 2026-06-18 — SESSION_7 Deferred Audit Fixes (branch: claude/wonderful-shannon-pdnvca)

### What changed this session

All work in `apps/web/public/app.html` and `apps/web/public/index.html`.

**ITEM A — CSS var conflict (`--accent` vs `--accent-color`):** No fix needed. `--accent` is the only declared name in both files. `--accent-color` has 0 occurrences — no broken references existed.

**ITEM B — `body::before` scanline z-index:** Changed from `9000` → `0` in both `app.html` and `index.html`. Scanline texture now renders below all modals (lowest z-index in app: 200).

**ITEM C — Inline style cleanup (`app.html`):** Added 21 utility classes to existing `<style>` block (`.mb-12`, `.mb-14`, `.mb-8`, `.mb-0`, `.text-muted`, `.text-red`, `.text-green`, `.text-yellow`, `.text-accent`, `.text-xs-muted`, `.cursor-ptr`, `.icon-inline`, `.col-full`, `.flex-1`, `.flex-1-mb0`, `.flex-1-min0`, `.flex-gap-8`, `.flex-between`, `.flex-center-6`, `.text-right`, `.w-full`). Inline `style=` count: 818 → 673 (145 removed). Double-class artifacts from sed fixed via Python merge.

**ITEM D — KPI grid mobile fix:** Added `@media(max-width:479px){.kpi-grid{grid-template-columns:repeat(2,1fr)}}` after `.kpi-label` rule. No existing rules changed.

**ITEM E — Login button color:** `auth-tab-login` button `color:#fff` → `color:#000`. Gold (`#d4a843`) background with black text = ~9.3:1 contrast (WCAG AAA). Consistent with `.btn-amber` which already used `color:#000`.

### Files changed
- `apps/web/public/app.html`
- `apps/web/public/index.html`
- `docs/HANDOFF.md` (this file)

### Commit
- `b7d4ef3` — fix: deferred audit items (branch: `claude/wonderful-shannon-pdnvca`)
- PR: https://github.com/bbaker71313/scanforprofit/pull/82

### Items completed
- A: DONE (no-op — no broken references existed)
- B: DONE
- C: DONE
- D: DONE
- E: DONE

### Items still deferred (from SESSION_DEFERRED_FIX_PROMPT.md "WHAT NOT TO TOUCH")
- Unsplash CDN images
- `prefers-reduced-motion`
- Nav link sparseness
- "Welcome back" copy
- Brand_Guidelines.html internal issues
- Brand_Asset_Suite_v2.html SVG deduplication

### Next task
Merge PR #82 then verify Vercel deploy. Then: Stripe upgrade flow end-to-end verification (currently "not yet verified" in build status).

---

## Session: 2026-06-18 — SESSION_6 Inventory Tab changes (branch: claude/new-session-0637zg)

### What changed this session

All work is in `apps/web/public/app.html` unless noted. Committed separately per the spec.

**Change 1** (`e6cc715`) — Fix API Error 546 in `invFormDetectItem()`: Canvas image compression (max 1200px, JPEG 0.85), 15s AbortController timeout, explicit status 546 error message.

**Change 8** (`52789a7`) — Remove unexplained 9+ stale badge from inventory tab icon. Badge update code removed from `updateStaleBadge()`.

**Changes 10, 20, 23** (`845a1e0`) — Restructure stat cards: Unlisted / Listed / Sold / Est. Profit. Sold items excluded from cost/value totals (cost-of-goods-only for active inventory). `inv-stat-num` now shows only active inventory value.

**Changes 14, 13, 17, 12, 19** (`f2cd1fb`) — Photo thumbnails on item cards, sold detail view, button visibility rules (`Listed` → relist/enhance, `Unlisted` → enhance, `Sold` → view detail only), relist to Unlisted, photo enhance button.

**Change 15** (`41510f5`) — `confirmSold()` rewrite: writes sale event to `pnlExpenses` with `category:'sale'` sentinel for audit trail. `pnlCalc()` and `pnlRenderExpenses()` filter out sale entries to avoid double-counting. Sale records shown as green rows in P&L expense log.

**Change 21** (`68f5bfa`) — Multi-photo gallery: `invRenderPhotoGallery()` merges `photo_urls` (Supabase storage URLs) + `photos` (local blobs) for display during edit. Each photo has a remove button. `invFormHandlePhoto()` handles multiple files in edit mode.

**Changes 7, 11** (`10b363d`) — Back buttons on export/import panels; emoji audit removing emojis from nav buttons, card titles, camera buttons, detect button, mode-tab icons.

**Change 9** (`6f1140b`) — eBay draft CSV import: RFC 4180 parser (`parseCsvRows()`), eBay format detection (5 `#INFO` header rows), column mapping (Custom label→SKU, Title→nickname, Price→sellPrice, Description→notes). Duplicate SKU check added to both eBay and standard import paths.

**Changes 2, 3** (`5e2e04e`) — Per-user export queue (`sfp_export_queue_{userId}` localStorage), persisted across sessions. Each item in CSV export panel now has a checkbox. "Select All Unlisted (N)" button. `generateAndDownloadCSV()` exports only checked items (with fallback to all). Queue cleared after export.

**Change 5** (`fa92e62`) — Replace `exportFlippdBackup()` JSON download with JSZip CSV ZIP. Added JSZip CDN to `<head>`. ZIP contains `inventory.csv`, `expenses.csv`, `scan_history.csv`. UI label updated to "Full CSV backup (ZIP)".

**Change 4** (`7236d64`) — Rotate/crop tools in Add Photos flow. ↺ Rotate button uses Canvas API to rotate 90° CW, updates `invFormImgFile` and preview. ✂ Crop button shows a fixed-overlay crop UI with 4 corner drag handles. `invFormCropApply()` uses object-fit:contain math to map crop rect to natural image coordinates.

**Change 6** (`973c385`) — `supabase/functions/export-reminder/index.ts` created: POST handler, queries `inventory` for `status='Ready to Export'`, looks up user email, sends Resend email. Settings UI: "Export Reminder" card added to settings panel with toggle + time picker, stored in `S.exportReminderEnabled` / `S.exportReminderTime` in `sfp_settings`.

**Change 22** — BLOCKED (documented below).

### BLOCKER — Change 22 (eBay Sync)

```
BLOCKER — Change 22 (eBay Sync): settings table does not have ebay_oauth_token / ebay_refresh_token columns.
eBay OAuth tokens are stored in the ebay_connections table (access_token, refresh_token, expires_at).
The eBay Sync Edge Function must read from ebay_connections, not settings.
This is a prerequisite schema mismatch — defer to next session.
```

### Files changed
- `apps/web/public/app.html` (primary — all inventory tab changes)
- `supabase/functions/export-reminder/index.ts` (new)
- `docs/HANDOFF.md` (this file)

### Commits (all on branch `claude/new-session-0637zg`)
- `e6cc715` — Change 1
- `52789a7` — Change 8
- `845a1e0` — Changes 10/20/23
- `f2cd1fb` — Changes 14/13/17/12/19
- `41510f5` — Change 15
- `68f5bfa` — Change 21
- `10b363d` — Changes 7/11
- `6f1140b` — Change 9
- `5e2e04e` — Changes 2/3
- `fa92e62` — Change 5
- `7236d64` — Change 4
- `973c385` — Change 6

### Decisions made (do not reverse)
- `pnlExpenses` sale entries (`category:'sale'`) are excluded from P&L calculations — they're audit records only, not double-counted
- Photo gallery merges `photo_urls` (JSONB array in DB) + `photos` (local blobs via IDB) into a single display row
- JSZip CDN (`cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1`) is now loaded in `<head>` of app.html
- `exportReminderEnabled` and `exportReminderTime` are stored in `sfp_settings` localStorage alongside all other settings
- Export reminder Edge Function uses `RESEND_API_KEY` secret — must be set in Supabase Dashboard before the function can send emails

### What is NOT done (deferred)
- Change 22 — eBay Sync: BLOCKED (see above)
- export-reminder Edge Function deployment — file exists locally but not yet deployed to Supabase (requires `supabase functions deploy export-reminder` from CLI)
- Scheduling the daily reminder — the Edge Function is a fire-and-forget POST; a cron job (n8n or Supabase pg_cron) is needed to call it at the user's preferred time. Not implemented — deferred.

### Next task
1. Push all commits on `claude/new-session-0637zg` and open PR
2. Deploy `export-reminder` Edge Function: `supabase functions deploy export-reminder --project-ref dqgfpchkheznvanfgsmx`
3. Resolve Change 22 BLOCKER: update the eBay Sync feature to read from `ebay_connections` table instead of `settings`
4. Set up n8n or pg_cron to schedule daily export-reminder calls per user preferences

### Blockers
- Change 22: eBay Sync schema mismatch — `settings` table has no OAuth token columns; tokens are in `ebay_connections`
- export-reminder deployment: requires Supabase CLI access

---

## Session: 2026-06-17 (web app sync) — Port SESSION_2_3_PROMPT to app.html — MERGED PR #78

---

## Session: 2026-06-17 (web) — Port SESSION_2_3_PROMPT changes to app.html

### What changed this session

**`apps/web/public/app.html`** — all applicable SESSION_2_3_PROMPT changes ported:

- **Tab bar**: TRENDS→PULSE, STATS→P&L; all tab-bar emojis replaced with inline SVG icons
- **P&L tab (was STATS)**: Removed "Overview" sub-tab button; P&L view is now the default when switching to this tab; added branded header "P&L / Your numbers, your business."; updated `statsSubTab()` and `switchTab()` to default to 'pnl'
- **Timeframe toggles**: Removed Week/Month/Year toggle buttons from the dashboard JS template (Change 19)
- **Pulse tab (was TRENDS)**: Header renamed "Market Trends"→"Pulse"; "Stale Items — Action Needed" section renamed "Action Queue" (Change 14)
- **Scout tab — scan phrase**: "RUN THE NUMBERS" label added below analyze button; button stripped of ⚡ emoji (Change 1)
- **Scout tab — emoji cleanup**: Camera buttons, cost row, analyze/shelf buttons, decision icons `D_ICON` (now `[ HOT ]`/`[ BUY ]`/`[ PASS ]`), AI badge, BUY/WATCH/PASS action buttons all cleaned of emojis (Change 3)
- **Seasonal sourcing**: `SEASONAL_BY_MONTH` constant + `renderSeasonalTips()` function added; section renders in Pulse tab on `initGrowthTab()` (Change 17)
- **Onboarding modal**: 3-screen web-native modal (centered, localStorage key `sfp_onboarding_complete`); fires after first login via `_currentUser` poll; matches mobile OnboardingSheet screens (Change 5)
- **Upgrade section in Settings**: "Upgrade Plan" card added at bottom of Settings panel showing current tier, hides for Empire users; links to Plan sub-tab (Change 18)
- **Settings panel emojis**: ⚙️ gear button → SVG, 🔑/↩ button labels cleaned

### Files changed
- `apps/web/public/app.html`

### Commit
- `d9aa39e` — feat(web): port SESSION_2_3_PROMPT changes to app.html (PR #78)

### Decisions made (do not reverse)
- Web app keeps its dark industrial theme (`#0a0a0a` bg) — brand refresh (Change 7) was NOT applied; that requires a full CSS overhaul and was deferred
- Overview sub-tab removed from P&L/STATS tab but `stats-view-dash` div kept in DOM (JS references it safely)
- Onboarding uses localStorage (no Supabase write) — consistent with mobile's expo-secure-store approach, no DB migration needed

### What was NOT ported (deferred)
- **Change 2** — Animated logo placeholder — web app has no shutter button equivalent; deferred
- **Change 4** — Multi-photo scan — web uses `<input type="file">`; adding a photo strip requires significant JS refactor; deferred
- **Change 7** — Full brand refresh — requires replacing the entire dark CSS theme; deferred to a dedicated session
- **Change 8** — index.html mobile sizing — separate file, separate session
- **Change 11/12** — Moving Stats content to Trends tab — web already has parallel content in both tabs; cleanup deferred
- **Change 13** — Action queue items → navigate to inventory edit — web inventory edit is inline, not a separate screen; deferred

### Commits / PRs
- `d9aa39e` — feat(web): port SESSION_2_3_PROMPT changes to app.html
- `0bd70b7` — docs: update HANDOFF.md
- PR #78 merged to main → squash commit `ad6ba9c`

### TypeScript check
Clean — 0 errors (only pre-existing env-level errors from missing @types/react remain, unrelated to this session).

### Next task
- All SESSION_2_3_PROMPT changes are now live on both mobile (PRs #72, #73) and web (PR #78)
- Next priority: check `docs/FEATURE_TRIAGE.md` for Phase 5 (web app) work, OR begin EAS build / App Store submission prep
- Deferred: web brand refresh (Change 7) — full dark→warm CSS overhaul, needs a dedicated session

---

## Session: 2026-06-17 (continued) — Changes 1, 4, 5, 10 from SESSION_2_3_PROMPT

### What changed this session

**`apps/mobile/app/(tabs)/scout.tsx`** (Changes 1 + 4 + 5):
- Change 1: "RUN THE NUMBERS" label added below shutter button (IBM Plex Mono, 11px, letterSpacing 2)
- Change 4: Single-item mode now accumulates up to 4 photos before analyzing. Photo strip shows thumbnails with × remove badges and a dashed +slot. Counter shows "X/4 PHOTOS". ANALYZE button sends all photos via `{ type: 'single_scan', images: string[] }`. Shelf mode unchanged (single shot → immediate analyze).
- Change 5: `shouldShowOnboarding()` called on mount via `useEffect`; shows `OnboardingSheet` on first launch

**`apps/mobile/components/ui/OnboardingSheet.tsx`** (Change 5 — new file):
- 3-screen bottom-sheet Modal: "Know before you buy." / "Point. Scan. Decide." / "Set your eBay fee once."
- Step dots, SKIP + NEXT + GET STARTED buttons
- `expo-secure-store` key `sfp_onboarding_complete` — shows once per install
- PostHog events: `onboarding_started`, `onboarding_skipped`, `onboarding_completed`

**`apps/mobile/components/ui/index.ts`**:
- Added `export * from './OnboardingSheet'`

**`apps/mobile/app/(tabs)/_layout.tsx`** (Change 10):
- Trends tab `title` changed from `"Trends"` to `"Pulse"`

**`supabase/functions/claude-proxy/index.ts`** (Change 4):
- `callAnthropic` now takes `images: string[]` instead of single `imageBase64`
- Sends all images as content blocks; text prompt adapts ("Analyze these N photos of the same item from different angles.")
- `handleSingleScan` and `handleShelfScan` updated to `images: string[]`
- Router normalizes legacy `imageBase64` → `[imageBase64]` for backwards compat
- Multipart form data handler populates both `imageBase64` and `images`

### Files changed
- `apps/mobile/app/(tabs)/scout.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/components/ui/OnboardingSheet.tsx` (new)
- `apps/mobile/components/ui/index.ts`
- `supabase/functions/claude-proxy/index.ts`

### Commits
- `7697ea2` — scan phrase + Trends→Pulse rename (PR #73)
- `869531c` — multi-photo scan + onboarding sheet (PR #73)
- Both PRs (#72 and #73) merged to `main`

### Status of all 20 SESSION_2_3_PROMPT changes
All 20 changes COMPLETE and merged to main.

### Decisions made (do not reverse)
- Multi-photo scan is single-mode only — shelf mode always uses single shot
- `expo-secure-store` used for onboarding flag (no new dependency needed)
- `callAnthropic` is backwards-compatible — `imageBase64` still accepted via normalization

### Next task
All SESSION_2_3_PROMPT changes done. Next session should pick up from FEATURE_TRIAGE.md for next priority features, or address any EAS build / App Store submission tasks.

---

## Session: 2026-06-17 — Scout Overhaul + Tab Restructure (SESSION_2_3_PROMPT)

### What changed this session

**`apps/mobile/app/(tabs)/pnl.tsx`** (NEW FILE — Change 9/15/16/19/20):
- Created full P&L tab replacing Stats tab as visible nav item
- Header: "P&L" (Syne 700 28px) + subtitle "Your numbers, your business." (IBM Plex Mono 13px)
- Always fetches `fetchStatsSummary('all')` — no period selector (Change 19)
- Net profit shown as full line-item breakdown: Revenue, COGS, fees, packaging, shipping, expenses, mileage
- Inventory snapshot: LISTED + UNLISTED only — no SOLD KPI card (Change 15)
- Tax reserve: informational callout using `summary.taxReserve`, never hardcoded
- Expense log (Scout-gated) and mileage tracker preserved from stats.tsx
- Add expense modal preserved from stats.tsx
- No Overview card, no "Hey There" header (Change 20)

**`apps/mobile/app/(tabs)/_layout.tsx`** (Change 9):
- Added `pnl` tab with `title: "P&L"` as visible 5th tab
- Moved `stats` tab to hidden (`href: null`) — file preserved, removed from tab bar

**`apps/mobile/app/(tabs)/trends.tsx`** (Changes 3/13/14/17):
- Change 3: Replaced 🔭 emoji in empty state with `[ NO DATA ]` text label
- Change 13: Action queue items are now tappable `Pressable` rows — navigates to `/(tabs)/inventory?editSku=` with PostHog `action_queue_item_tapped` event; `×` button dismisses items (PostHog `action_queue_item_dismissed`); dismissed items filtered from view via `dismissedSkus` state
- Change 14: SectionHeader title changed from "Items that need attention" → "Action Queue"
- Change 17: Added seasonal sourcing section before footer using `getSeasonalTips()` and `SEASONAL_BY_MONTH` (12-month static seed)
- Fixed `ACTION_COLORS` to dark-bg-compatible COLORS token values
- Fixed `TS7031`: added `{ pressed: boolean }` type to Pressable style callback

**`apps/mobile/app/(tabs)/settings.tsx`** (Change 18):
- Added `TIER_NEXT` constant and `UpgradeSection` component (shows CURRENT PLAN label + UPGRADE button)
- Non-scout non-empire users see `UpgradeSection` above `SettingsForm`

**`apps/mobile/components/ui/ScanResult.tsx`** (Change 6 + TS fix):
- Added `listingTips?: string[]` and `riskFlags?: string[]` props with rendered sections (LISTING TIPS, CHECK THIS)
- Fixed `TS7031`: added `{ pressed: boolean }` type to both Pressable style callbacks

**`apps/mobile/app/(tabs)/scout.tsx`** (TypeScript fixes):
- `RADIUS.xl` → `RADIUS.lg` (replace_all — no `xl` key on RADIUS type)
- `ShelfItemRow` prop `onBuy` changed from `(item: ShelfItem) => void` to `() => void` (callers always use closures)
- Map params typed explicitly: `(item: ShelfItem, i: number)`

### Pending decisions (AWAITING USER INPUT — do not implement without answer)
1. **Change 1 — Scan phrase**: Options proposed: "Scan to Decide", "Profit or Pass", "Read the Market", "Run the Numbers", "Worth the Flip"
2. **Change 10 — Trends tab rename**: Options proposed: "Signals", "Intel", "Pulse", "Radar", "Edge"

### Deferred (NOT done this session)
- **Change 4**: Multi-photo AI scan UI (photo strip up to 4 images + claude-proxy image array support)
- **Change 5**: First-time onboarding 3-screen bottom-sheet with AsyncStorage flag + PostHog events

### Pre-existing TypeScript errors (NOT caused by this session — requires env fix)
- `TS2307 Cannot find module 'react'/'expo-router'/etc.` — missing `@types/react`, `@types/node`
- `TS17004 Cannot use JSX` — missing `--jsx` flag configuration
- `TS2591 Cannot find name 'process'` — missing `@types/node`
- `TS2322 key prop` — React key prop not recognized without `@types/react` (same in `how-it-works.tsx`, `identity.tsx`)

### Files changed
- `apps/mobile/app/(tabs)/pnl.tsx` (new)
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/trends.tsx`
- `apps/mobile/app/(tabs)/settings.tsx`
- `apps/mobile/app/(tabs)/scout.tsx`
- `apps/mobile/components/ui/ScanResult.tsx`
- `docs/SESSION_2_3_PROMPT.md` (added to repo for reference)

### Commit
`[see below after push]` — branch `claude/new-session-je44s6`

### Decisions made (do not reverse)
- Stats tab hidden (not deleted) — `pnl.tsx` is the new visible 5th tab
- No period filter on P&L screen — always shows "all time"
- ACTION_COLORS use COLORS token-based dark-bg values (not raw light hex)

### Next task
1. Get user decisions on Change 1 (scan phrase) and Change 10 (Trends rename)
2. Implement Change 4 (multi-photo scan) after user approves
3. Implement Change 5 (onboarding bottom-sheet) after user approves

---

## Session: 2026-06-16 — Hunt list SVG + eBay price-change API

### What changed this session

**`apps/web/public/app.html`**:
- Added `HUNT_ICON_SVG` constant (crosshair SVG, gold `var(--accent)`) above `renderGrowthResults()`
- Replaced `h.icon||'🎯'` with `h.icon||HUNT_ICON_SVG` in both render paths (renderGrowthResults + cached stats render)
- Replaced empty-state `🎯` div with equivalent 36×36 SVG
- `syncDropPriceToEbay()` is now async — calls `EBAY_BASE + '/price-change'`, shows success/not-connected/not-found/error toasts, disables button while pending
- `#dp-ebay-btn` id added to eBay sync button; label simplified to "↗ Sync Price to eBay"

**`supabase/functions/ebay-oauth/index.ts`**:
- Added `getValidEbayToken()` helper — reads token from DB, refreshes via `refresh_token` grant if within 60s of expiry, stores new token
- Added `POST /price-change` handler — validates sku + newPrice, gets valid token, GETs offer by SKU from eBay Inventory API, strips read-only fields (`offerId`, `status`, `listing`), PUTs updated price back, returns `{ success, offerId, newPrice }`

### Files changed
- `apps/web/public/app.html`
- `supabase/functions/ebay-oauth/index.ts`

### Commit
`849341e` — direct to `main`

### Decisions made (do not reverse)
- `🎯` in Settings "Decision Thresholds" label and Stats legend are intentionally left — only hunt list fallback was in scope
- eBay price change uses Inventory API `sell/inventory/v1/offer` (not Trading API) — requires item was listed via Inventory API. If not, returns 404 and user sees "No eBay listing found for this SKU — sync manually"
- Token refresh uses `refresh_token` grant without `redirect_uri` (correct per eBay spec)

### Next task
- Phase 3 Step 3: Component Library redo with frontend-design skill (deferred)
- Phase 5: Web App Build (not yet started)

---

## Session: 2026-06-16 — Trends tab redesign — 8 changes (PR #70)

### What changed this session

**`apps/web/public/app.html`** — all 8 Trends tab changes:

1. **Change 1 + 8 (animated logo + emoji audit)** — Loading state brain emoji `🧠` replaced with animated inline SVG ScanMark (gold brackets, green bars that pulse with CSS SVG `<animate>`). Empty state `📈` + `🚀` replaced with static ScanMark SVG. Tab bar TRENDS `📈` replaced with SVG trend-line icon. Stale banner `⏰` replaced with SVG clock. All 6 card titles in `#growth-results` and the trending hot-tip `🔥` replaced with small inline SVG icons (bar-chart, hourglass, target crosshair, signal waves, lightning bolt, flame shape) — no new CSS classes, all inline.

2. **Change 2 (Drop Price modal)** — `stale-action` badge for Drop Price actions is now clickable (`openDropPriceModal(sku, name)`). New `#drop-price-modal` shows current price + recommended −10% price. Accept updates `items[].sellPrice` locally + calls `saveItems()`. Hustle+ tiers (trial/hustle/stack/empire) see an "Also Sync to eBay" button (stub — shows "connect eBay in Settings" toast for now). Scout sees a manual reminder banner.

3. **Change 3 (Filter Bundle)** — `stale_actions` are filtered with `.filter(i => !i.action.toLowerCase().includes('bundle'))` before rendering. Single-item bundle is not actionable.

4. **Change 4 (Relist modal)** — `stale-action` badge for Relist actions is now clickable (`openRelistConfirm(sku, name)`). New `#relist-modal` confirms intent. On confirm: item status set to `'Unlisted'`, `saveItems()` called, switches to Inventory tab, opens edit form via `startEdit(item.id)` after 200ms delay.

5. **Change 5 (Score card branding)** — `#growth-score-card` background changed from warm parchment `linear-gradient(135deg,#fdf5e4,#f5e8cc)` + undefined `--border-dark` → dark branded `linear-gradient(135deg,rgba(212,168,67,0.10) 0%,#131313 100%)` + `rgba(212,168,67,0.30)` border.

6. **Change 6 (Stale item body clickable)** — Each `.stale-item` div has `onclick="goToStaleItemListing(sku)"` + `cursor:pointer`. Action badges use `event.stopPropagation()` to prevent double-firing. `goToStaleItemListing()` finds item by SKU, calls `switchTab('inventory')` + `startEdit(item.id)`.

7. **Change 7 (Advisor moved up)** — `#growth-advice-section` HTML block moved from after market trends to directly after the score card. JS output (`growth-advice-content`) unchanged.

8. **Change 8 (emoji audit)** — See Change 1 above. AI prompt template at line ~3695 (`"arrow":"📈 or 📉"`) intentionally untouched per "never rewrite AI prompts" rule. Hunt list fallback icon `🎯` in JS template literal left as-is (AI response content).

### New functions added
- `goToStaleItemListing(sku)` — navigate to stale item's edit form
- `openDropPriceModal(sku, name)` / `closeDropPriceModal()` / `acceptDropPrice()` / `syncDropPriceToEbay()` — drop price flow
- `openRelistConfirm(sku, name)` / `closeRelistModal()` / `confirmRelist()` — relist flow

### New state vars added
- `let _dpState = null` — tracks open drop price modal state
- `let _relistState = null` — tracks open relist modal state

### Files changed
- `apps/web/public/app.html` — modified

### Commit / PR
Commit `fb8f7de` on branch `claude/trends-tab-redesign-l5f2wp` — PR #70 **MERGED** into `main` (`fc641df`)

### Decisions made (do not reverse)
- Animated ScanMark SVG is the canonical loading indicator for the Trends tab. Do not reintroduce the brain emoji.
- Bundle stale actions are filtered out client-side. If AI returns Bundle it will be silently hidden.
- Score card warm parchment background is permanently retired — use dark branded gradient.

---

## Session: 2026-06-16 — Web App Audit Phase 1: Settings Tab

### What changed this session

**`apps/web/public/app.html`** — 9 Settings Tab audit changes:
1. **TIER_INFO** (line ~6297): Removed `'P&L dashboard'` from Hustle tier features; renamed `'Full listing generator'` → `'Full eBay API Boost Listing'`
2. **Settings sliders** (lines 1240–1291): Added `<input type="number" id="num-{key}">` alongside each of the 5 sliders. Slider and number box stay in sync via `syncFromNum()` / `updateSetting()`.
3. **Removed** `<div id="scan-history">` (Today's Scans card) from the Scout panel HTML — `renderScanHistory()` JS function left in place (returns early when el is null, harmless).
4. **Removed** "Change Access Code" button from the bottom of the settings panel.
5. **Added** Account card to settings: username, email, plan tier — populated by `populateAccountUI()` called from `showSourcingSettings()`.
6. **Added** Sign Out button in Account card — clears `sfp_jwt`, `sfp_user_name`, `sfp_settings` from localStorage (updated to `sfp_*` prefix when merging PR #67), resets `currentUser`, redirects to login.
7. **Added** Reset Password button in Account card — calls `requestPasswordReset()` → `AUTH_BASE + '/reset-request'` using user's stored email.
8. **Added** `src-view-reset` in-app password reset view — reached via email link `?reset=TOKEN`. `window.onload` detects token, shows reset form. `submitPasswordReset()` calls `AUTH_BASE + '/reset-confirm'`.
9. **Fixed** `startCheckout()` — was calling `API_BASE + '/stripe/checkout'` (wrong path on claude-proxy); now calls dedicated `stripe-checkout` Edge Function via `STRIPE_BASE` constant.
- Also replaced legacy `showForgotPassword()` `alert(support@flippd.app)` with proper backend call.
- `showSrcView()` updated to include `'reset'` in the view list.

**`supabase/functions/auth/index.ts`** — Added password reset endpoints:
- `POST /auth/reset-request` — looks up user by email, signs a 1-hour self-expiring JWT reset token (no new DB columns needed), sends reset link via Resend. Always returns success to prevent email enumeration.
- `POST /auth/reset-confirm` — verifies reset JWT, bcrypt-hashes and stores new password.

### Files changed
- `apps/web/public/app.html`
- `supabase/functions/auth/index.ts`

### Commit
`2ec501d` — `feat: Settings tab audit — Phase 1 of 6`

### PR
`bbaker71313/scanforprofit#68` — merging into main (conflict with PR #67 + PR #69 resolved).

### Decisions made (do not reverse)
- `startCheckout()` calls `stripe-checkout` function directly via its own URL — not routed through `claude-proxy`.
- Password reset uses JWT-based tokens (self-expiring, no DB column) — no migration needed.
- `scan-history` div removed from HTML; `renderScanHistory()` JS function left in place (safe — returns early on null el).
- `signOut()` and `populateAccountUI()` use `sfp_jwt` / `sfp_user_name` / `sfp_settings` (aligned with PR #67's `sfp_*` key migration).

### Next task — Phase 2: Scout Tab (STOP and verify with user first)
The user asked to verify Phase 1 before proceeding. Once approved, Phase 2 changes to `apps/web/public/app.html` are:
1. Rebrand "FLIP or PASS?" headline to match current brand voice
2. Animated loading logo (Scanning Sweep SVG) during AI scan
3. Emoji audit — remove out-of-place emojis from Scout panel
4. Multi-photo support for single item scan
5. Fix onboarding flow prompt text
6. Fix "Listing Tips" / "Check This" broken links in scan results
7. Tab branding — update tab bar labels/icons
8. Fix mobile desktop mode (viewport/zoom issues)

### Remaining Flippd remnants in app.html (not yet fixed)
- Line 4444: dead backend URL `flippd-backend.replit.app` (in a dead code comment)
- `sfp_items_v1` STORAGE_KEY and IndexedDB name `flippd_photos` — `sfp_*` key migration done by PR #67; IndexedDB rename deferred (high-risk, zero user benefit)
- DOM element IDs (`exportFlippdBackup`, `handleFlippdImport`) — defer

---

## Session: 2026-06-16 — Photo editor tools enhancement (PR #69)

### What changed this session

**`apps/web/public/app.html`** — commit `63a66af` on branch `claude/photo-editor-tools-enhancement-0apsti`:

1. **Rotate + Square Crop tools** — new toolbar row after thumbnail strip with ↺ Left, ↻ Right, ⬛ Square buttons. `paRotate(deg)` swaps canvas dimensions and draws at ±90°; `paCropSquare()` extracts center square via `getImageData`. Both update `original` + `enhanced` in-place so filters continue to work on the transformed photo.

2. **Remove BG button** — replaced non-functional "White background" checkbox with `🪄 Remove BG` button. `paRemoveBg()` calls the remove.bg API (`POST https://api.remove.bg/v1.0/removebg`); fills white background, draws bg-removed PNG result onto canvas. API key stored in `S.removebgKey` (new field in `DEFAULTS`), entered via new Settings → Photo Tools card, persisted in `fif_settings` localStorage.

3. **Fullscreen popup with zoom** — `onclick="paOpenFullscreen()"` added to `#pa-canvas` (cursor: zoom-in). `paOpenFullscreen()` opens `#pa-fs-overlay` with the enhanced photo; scroll wheel zooms on desktop (wheel event), pinch-to-zoom on mobile (touchstart/touchmove). `paCloseFullscreen()` cleans up all event listeners.

4. **Photo Boost (tier-gated)** — `✨ Boost` button in actions row calls `paPhotoBoost()`. Scout users with expired trial are redirected to upgrade (→ Stats → subscription tab). Hustle+ / active trial users get auto-levels (per-channel histogram stretch) + unsharp mask (sharpen convolution kernel) applied directly to the canvas.

5. **Fix Apply to All Photos** — replaced racy `setTimeout(res, 80)` chain in `paApplyToAll()` with sequential `Promise` chain using new `onDone` callback parameter on `paApplyFilters()`. Each photo's filters now complete before the next photo starts.

6. **Fix Save to Item — redirect** — `paSaveToItem()` now calls `paReset()` then `switchTab('inventory')` + `setTimeout(() => startEdit(targetId), 120)` after saving. User lands on the inventory edit screen showing the enhanced photos.

7. **Fix Save to Item — no item selected** — `paSaveToItem()` calls `paShowSaveDialog()` when `paTargetItemId` is null. Dialog offers: "New Inventory Item" → `paSaveDialogNewItem()` navigates to add form with photos previewed in `inv-form-edit-photos`; "Existing Item" → `paSaveDialogExisting()` focuses category dropdown. `saveInvItem()` hooks into `window._paPreloadPhotos` after new item creation to save photos to IDB and open edit view.

### Files changed
- `apps/web/public/app.html` — modified (228 insertions, 23 deletions)

### Commit / PR
- Commit `63a66af` on branch `claude/photo-editor-tools-enhancement-0apsti`
- PR #69 (draft, open) — Vercel building, Supabase skipped (no DB changes), Railway initializing

### Decisions made (do not reverse)
- `pa-whitebg` checkbox is permanently removed. The old "fill white" behavior is replaced by actual API-based background removal via remove.bg.
- `removebgKey` is stored client-side in `fif_settings` localStorage (same as `ebayFee`, etc.) — it's a user-provided third-party key, not a server secret.
- Photo Boost is pure canvas (auto-levels + sharpen kernel) — no external API, no new edge function needed.
- `paApplyFilters` now accepts an optional `onDone` callback — all existing callers pass nothing and work unchanged.

### Next task
- Merge PR #69 once Vercel CI passes
- Continue with Phase 3 Step 3 (Component Library redo) or Phase 5 (Web App Build) as previously planned

### Blockers
None.

---

## Session: 2026-06-16 — Credentials, metadata, and localStorage cleanup (PR #67)

### What changed this session

**`apps/web/public/app.html`** — multiple changes:
- Forgot-password alert: `support@flippd.app` → `support@scanforprofit.com`
- localStorage keys renamed `flippd_*` → `sfp_*` throughout:
  - `flippd_jwt` → `sfp_jwt`
  - `flippd_user_name` → `sfp_user_name`
  - `flippd_seeded` → `sfp_seeded`
  - `flippd_events` → `sfp_events`
  - `flippd_items_v1` (STORAGE_KEY) → `sfp_items_v1`
- Migration block added at top of STORAGE section (IIFE, runs at parse time): migrates old `flippd_*` and `ebayhq_*` keys to `sfp_*` for existing users before any code reads the keys — data is preserved
- Removed `fif_api_key` write-backs (login no longer redundantly writes to the legacy key); cleanup block in `window.onload` still removes `fif_api_key` as a safety net for old sessions
- IndexedDB name `flippd_photos` and sessionStorage key `flippd_preview_src` intentionally left unchanged — IndexedDB rename requires complex data migration; `flippd_preview_src` is dead-code cleanup (nothing writes it since v5.11)

**`README.md`**:
- Line 20: `[flippd.com](https://flippd.com)` → `[scanforprofit.com](https://scanforprofit.com)`
- Line 64: `support@flippd.com` → `support@scanforprofit.com`

**`package.json`**:
- `"name"`: `"flippd-backend"` → `"scanforprofit"`
- `"description"`: updated to ScanForProfit description
- `"keywords"`: `"flippd"` → `"scanforprofit"`

**`.env.example` line 33**: Redacted old eBay client ID `Brittany-Flippd-PRD-67b75c3f4-fb4ff30c` → placeholder `<your ScanForProfit eBay client ID from developer.ebay.com>`

**`CLAUDE.md`**: Redacted same eBay client ID from edge functions rules section

**`docs/ScanForProfit_v5_24.html`**:
- Line 4078: eBay `clientId` → empty string with comment pointing to Supabase secrets
- Line 4079: Replit `ruName` → empty string with comment pointing to Supabase secrets
- Line 4444: `API_BASE` updated from Replit URL to Supabase function URL
- Lines 5784-5785: `support@flippd.app` → `support@scanforprofit.com`

**`docs/FEATURE_TRIAGE.md`**: Title updated: `Feature Triage — Flippd v5.23 → ScanForProfit RN` → `Feature Triage — ScanForProfit v5.24`

**`docs/files/CHATS.md`**:
- `[APP]` source of truth: `Flippd_v5_23.html` → `docs/ScanForProfit_v5_24.html`
- `[BACKEND]` functions list: added `stripe-checkout`, `ebay-oauth`

**`docs/files/DECISIONS.md`**:
- Functions list: added `stripe-checkout`, `ebay-oauth`
- Source of truth section: `Flippd_v5_23.html` → `docs/ScanForProfit_v5_24.html`

**`BACKEND_LIVE.md`** → **`docs/files/LEGACY_BACKEND_LIVE.md`** (archived — described decommissioned Replit backend)

**`APP_INTEGRATION.md`** → **`docs/files/LEGACY_APP_INTEGRATION.md`** (archived — referenced `flippd-backend.replit.app` as active)

**`CLAUDE.txt`** — deleted (stale duplicate of `CLAUDE.md` with wrong source-file references)

### Files changed
- `apps/web/public/app.html` — modified
- `README.md` — modified
- `package.json` — modified
- `.env.example` — modified
- `CLAUDE.md` — modified
- `docs/ScanForProfit_v5_24.html` — modified
- `docs/FEATURE_TRIAGE.md` — modified
- `docs/files/CHATS.md` — modified
- `docs/files/DECISIONS.md` — modified
- `BACKEND_LIVE.md` → `docs/files/LEGACY_BACKEND_LIVE.md` — renamed
- `APP_INTEGRATION.md` → `docs/files/LEGACY_APP_INTEGRATION.md` — renamed
- `CLAUDE.txt` — deleted

### Commit / PR
Commit `078d651` on branch `claude/cleanup-credentials-metadata-g99z9o` — PR #67 (draft, open)

### Decisions made (do not reverse)
- localStorage key prefix is now `sfp_` everywhere. Do not reintroduce `flippd_` keys.
- `fif_api_key` is a dead legacy key — only remove it in cleanup paths, never write to it again.
- IndexedDB name `flippd_photos` is intentionally kept as-is — renaming it requires migrating photo blobs which is high-risk for zero user-visible benefit.
- `BACKEND_LIVE.md` and `APP_INTEGRATION.md` are permanently archived in `docs/files/LEGACY_*` — do not move them back to root.
- `CLAUDE.txt` is permanently deleted — `CLAUDE.md` at repo root is the only authoritative copy.

### Next task
- Merge PR #67 once Vercel CI completes
- Phase 3 Step 3 (Component Library redo with frontend-design skill) or Phase 5 (Web App Build) — whichever the user prioritizes next

---

## Session: 2026-06-16 — Minor doc conflict cleanup (audit)

### What changed this session

**`docs/files/DECISIONS.md`** — corrected stale source file reference:
- Line 83: heading `Flippd_v5_23.html` → `ScanForProfit_v5_24.html`
- Line 84: body reference `Flippd_v5_23.html` → `ScanForProfit_v5_24.html`

**`docs/files/CHATS.md`** — corrected stale source file reference:
- Line 28: `Flippd_v5_23.html` → `ScanForProfit_v5_24.html`

**`docs/FEATURE_TRIAGE.md`** — corrected title:
- Line 1: `Feature Triage — Flippd v5.23 → ScanForProfit RN` → `Feature Triage — ScanForProfit v5.24 → ScanForProfit RN`

**`packages/shared/src/types/index.ts`** — removed Flippd brand from comments:
- Line 1: `aligned to Flippd data model` → `// Core domain types for ScanForProfit`
- Line 175: `port from Flippd F-24 / P-12` → `port from ScanForProfit_v5_24.html`

**`packages/shared/src/utils/calcPnl.ts`** — corrected comment source reference:
- Line 3: `Port from Flippd pnlCalc() L3028` → `Port from ScanForProfit_v5_24.html pnlCalc() L3028`

**`CLAUDE.txt`** — deleted. Confirmed to be a stale 374-line duplicate of CLAUDE.md (611 lines). CLAUDE.md is the authoritative file.

### Files changed
- `docs/files/DECISIONS.md`
- `docs/files/CHATS.md`
- `docs/FEATURE_TRIAGE.md`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/utils/calcPnl.ts`
- `CLAUDE.txt` — deleted

**`.github/workflows/web.yml`** — fixed pnpm version conflict (commit `97513c5`):
- Removed `version: 10` from `pnpm/action-setup@v4` step — conflicted with `pnpm@10.33.0` in `package.json`'s `packageManager` field. Action now reads version from `package.json` automatically.

### Files changed
- `docs/files/DECISIONS.md`
- `docs/files/CHATS.md`
- `docs/FEATURE_TRIAGE.md`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/utils/calcPnl.ts`
- `CLAUDE.txt` — deleted
- `.github/workflows/web.yml` — workflow fix

### Commits / PR
- `ff94355` — doc cleanup (7 files)
- `97513c5` — workflow fix (web.yml)
- PR #66 **MERGED** into `main` (`5bad345`)

### Decisions made (do not reverse)
- CLAUDE.txt is gone. `CLAUDE.md` is the only authoritative instructions file.
- `ScanForProfit_v5_24.html` is the canonical source-of-truth filename everywhere.

### What is NOT fixed (deferred)
- 🔴 `apps/web/public/app.html` lines 6035–6036: `support@flippd.app` in forgot-password alert (user-facing)
- 🔴 `README.md`: `support@flippd.com` and `flippd.com` link
- 🔴 `apps/web/public/app.html` line 4444: dead backend URL `flippd-backend.replit.app`
- 🟡 `package.json`: `"name": "flippd-backend"`, stale description and keywords
- 🟡 `BACKEND_LIVE.md` / `APP_INTEGRATION.md`: stale Replit-era architecture docs (now moved to `docs/files/LEGACY_*`)
- 🟠 localStorage keys (`flippd_items_v1`, `flippd_jwt`, etc.) — require data migration plan
- 🟠 DOM element IDs and function names in `app.html`
- `.env.example`: eBay client ID `Brittany-Flippd-PRD-67b75c3f4-fb4ff30c` comment

### Next task
Fix 🔴 critical user-facing Flippd remnants: `support@flippd.app` in `app.html` and `README.md` email/link. Then `package.json` metadata.

### Blockers
None.

---

## Session: 2026-06-16 — Repo hygiene: #6 #7 #8 #9 + web.yml

### What changed this session

**`supabase/functions/ebay-oauth/index.ts`** — created, committed, deployed via PR #65 (squash `c563109`):
- Standalone Deno edge function. Routes match `app.html`'s `EBAY_BASE` calls: GET `/authorize`, GET `/callback`, GET `/status`, POST `/disconnect`.
- Extracted from eBay handlers in `auth/index.ts` (ac9d053), which used different route names (`/ebay/connect`, `/ebay-callback`) and is now dead code for eBay. Do not remove auth eBay handlers until EBAY_RUNAME callback URL is confirmed to point at `ebay-oauth/callback`, not `auth/ebay-callback`.

**`.github/workflows/web.yml`** — created (PR #65):
- TypeScript CI for `apps/web` + `@sfp/shared`. Triggers on PRs/pushes touching those paths. Vercel handles deployments separately via its own GitHub integration.

**`CLAUDE.md`** — updated (PR #65):
- Added `stripe-checkout` and `ebay-oauth` to edge functions table.
- Fixed `.github/workflows/` comment: was "web.yml (Vercel)" → "web.yml (TypeScript check)".

**`docs/files/SCOPE_TEMPLATES.md`** — updated (PR #65):
- `[BACKEND]` template: listed all 5 edge functions (was "these three only").
- `[APP]` template: fixed stale source file reference `Flippd_v5_23.html` → `docs/ScanForProfit_v5_24.html`.

**`docs/FEATURE_TRIAGE.md`** — updated directly on main (`e9eb1f0`):
- Added Phase 4 Build Status table at top showing all 13 feature areas built.
- Added `Last status update: 2026-06-16` line.
- Documents 4 deferred features: eBay listing push API, backup/restore import, Watch stub, mobile CSV export.

**Branch cleanup (#8)** — sandbox git proxy blocks remote branch deletion (HTTP 403 on receive-pack). Must be done from local terminal. Command:
```bash
git push origin --delete \
  claude/admin-tier-management-X5Q2i claude/audit-run-errors-6RmCv \
  claude/audit-scanforprofit-sites-jYmtu claude/brave-brahmagupta-ff7NM \
  claude/build-failures-prod-dev-CtYxt claude/claude-md-gaps-g5awyr \
  claude/confident-hamilton-frmya0 claude/dazzling-heisenberg-bsqpr6 \
  claude/deploy-edge-functions-kHcBm claude/docs-clarity-issues-mtpr8k \
  claude/ebay-connection-error-m20gfy claude/fervent-cray-wtiaqc \
  claude/fix-claude-md-supabase-id-fzd5hd claude/fix-flippd-bugs-nRawD \
  claude/gifted-clarke-uPkI6 claude/hopeful-mayer-dx9p8l \
  claude/landing-page-404-error-42PSA claude/missing-edge-functions-workflows-l2dtjg \
  claude/morning-session-7r6bx5 claude/new-session-YbaGj \
  claude/new-session-YbaGj-security-fix claude/new-session-xpGlD \
  claude/photo-enhancement-regression-ogdn1f claude/rebrand-flippd-scanforprofit-ye9oJ \
  claude/remote-session-setup-MRbJ8 claude/scanforprofit-branding-colors-edf40x \
  claude/scanforprofit-design-audit-5K3YG claude/scanforprofit-ui-seo-audit-9xn510 \
  claude/serve-app-html claude/session-vw5pnp claude/update-css-tokens-Fm9lv \
  claude/vibrant-thompson-kGeJA cloudflare/workers-autoconfig pr/phase-4-build \
  railway/fix-deploy-3056c1 v0/scanforprofit-56a77671 \
  vercel/install-vercel-speed-insights-qjw27a
```

### Files changed
- `supabase/functions/ebay-oauth/index.ts` — created
- `.github/workflows/web.yml` — created
- `CLAUDE.md` — modified
- `docs/files/SCOPE_TEMPLATES.md` — modified
- `docs/FEATURE_TRIAGE.md` — modified

### Commits
- PR #65 squash → `c563109` (ebay-oauth, web.yml, CLAUDE.md, SCOPE_TEMPLATES.md)
- `e9eb1f0` — FEATURE_TRIAGE.md Phase 4 status update (direct to main)

### Decisions made (do not reverse)
- `ebay-oauth` is a separate edge function from `auth`. Auth's eBay handlers are dead code — safe to remove only after confirming `EBAY_RUNAME` callback points at `ebay-oauth/callback`.
- `web.yml` is TypeScript CI only — Vercel deployments are not managed via this workflow.
- FEATURE_TRIAGE.md is now dated 2026-06-16. Update the "Last status update" line whenever a new major phase is completed.

### Next task
Phase 3 Step 3 (Component Library redo with frontend-design skill) or Phase 5 (Web App Build) — whichever the user prioritizes. Also: run the branch cleanup command above from local terminal to close out #8.

### Blockers
#8 (branch cleanup) requires local terminal — sandbox cannot delete remote branches.

---

## Session: 2026-06-16 — Fix stale doc references (PR #64)

### What changed this session

**`CLAUDE.md`** — 2 fixes:
- Line 213: Supabase project ID `gymuhbscxmmcbqoovvud` → `dqgfpchkheznvanfgsmx`
- Line 246: Same stale project ID corrected in the Data Model section
- CLAUDE.md was the only file in the repo pointing at the retired project

**`docs/FEATURE_TRIAGE.md`** — 2 fixes:
- Line 3: Source file `Flippd_v5_23.html` → `ScanForProfit_v5_24.html`
- Line 10: Same stale filename in the Section 1 preamble

### Files changed
- `CLAUDE.md` — modified
- `docs/FEATURE_TRIAGE.md` — modified

### Commit / PR
PR #64 merged to main — squash commit `d9771a6`

### Decisions made (do not reverse)
- Active Supabase project is `dqgfpchkheznvanfgsmx`. The retired project `gymuhbscxmmcbqoovvud` must never appear in any file again.
- Source-of-truth HTML file is `docs/ScanForProfit_v5_24.html`. All references to `Flippd_v5_23.html` are stale and incorrect.

### Next task
Resume from prior: Phase 3 Step 3 (Component Library redo) or Phase 5 (Web App Build) — whichever the user prioritizes.

### Blockers
None.

---

## Session: 2026-06-16 — Missing edge functions and workflows (#6, #7, web.yml)

### What changed this session

**`supabase/functions/ebay-oauth/index.ts`** — created (new file):
- Standalone Deno edge function matching what `app.html` calls via `EBAY_BASE`
- Routes: GET `/authorize` (start OAuth, returns `{ authUrl }`), GET `/callback` (exchange code → store tokens → redirect), GET `/status`, POST `/disconnect`
- Route names match `app.html` exactly (`/authorize`, not `/connect` — which was the auth function's route name)
- JWT utilities and eBay handlers extracted from `supabase/functions/auth/index.ts` (where they were added in commit ac9d053 but the app pointed to a separate `ebay-oauth` function per commit b6469c7)
- Requires same Supabase secrets: `JWT_SECRET`, `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_RUNAME`, `FRONTEND_URL`

**`.github/workflows/web.yml`** — created (new file):
- Triggers on push to main or PRs that touch `apps/web/**`, `packages/shared/**`, or `pnpm-workspace.yaml`
- Runs `tsc --noEmit` on `@sfp/shared` and `apps/web` with the `type-check` script
- Uses Node 22, pnpm 10, `--frozen-lockfile`
- Note: Vercel deployments are handled by Vercel's own GitHub integration — this workflow adds TypeScript CI that Vercel's integration does not provide

**`CLAUDE.md`** — 3 changes:
1. Added `stripe-checkout` and `ebay-oauth` to the edge functions table (issue #7 and #6)
2. Fixed workflows comment: "mobile.yml (EAS), web.yml (Vercel)" → "mobile.yml (EAS build), web.yml (TypeScript check)"

**`docs/files/SCOPE_TEMPLATES.md`** — 2 changes:
1. `[BACKEND]` template: `claude-proxy, auth, stripe-webhook (these three only)` → all 5 functions listed
2. `[APP]` template: stale `Flippd_v5_23.html` source reference → `docs/ScanForProfit_v5_24.html`

### Files changed
- `supabase/functions/ebay-oauth/index.ts` — created
- `.github/workflows/web.yml` — created
- `CLAUDE.md` — modified
- `docs/files/SCOPE_TEMPLATES.md` — modified

### Commit / PR
PR #65 merged to main — squash commit `c563109`

### Decisions made (do not reverse)
- `ebay-oauth` is a **separate** edge function from `auth` — even though both have eBay handlers. The `auth` function's eBay routes (`/ebay/connect`, `/ebay-callback`) are now dead code; the app points to `functions/v1/ebay-oauth`. Do not remove them from `auth` without first confirming no live traffic routes there (e.g., if EBAY_RUNAME still points to the auth callback URL).
- `web.yml` is for TypeScript CI only — Vercel handles deployments via its own GitHub integration, not this workflow.

### Next task
No code tasks started this session. Resume from prior: Phase 3 Step 3 (Component Library redo) or Phase 5 (Web App Build) — whichever the user prioritizes.

### Blockers
None.

---

## Session: 2026-06-16 — CLAUDE.md gap fixes (8 documentation errors corrected)

### What changed this session

**`CLAUDE.md`** — 8 documentation gaps corrected (PR #61, merged to main at `46848aa`):

1. **Onboarding flow added to monorepo structure** — `apps/mobile/app/(onboarding)/` with 6 screens (`_layout.tsx`, `how-it-works.tsx`, `identity.tsx`, `permission.tsx`, `result.tsx`, `upgrade.tsx`) was fully built (2026-06-10 session) but missing from the file tree and Phase 4 progress table. Both sections updated.
2. **Migration list corrected** — CLAUDE.md listed 2 stale filenames (`001_extend_schema.sql`, `002_align_to_flippd.sql`); reality is 9 timestamped migrations. Replaced with all 9 correct names.
3. **`apps/video/` (Remotion) added** — built in 2026-06-15 session but absent from both the monorepo structure and tech stack. Added `apps/video/` entry with Remotion 4 (`@sfp/video`), 5 compositions, and a Video Ads section in tech stack.
4. **`docs/` structure fixed** — CLAUDE.md referenced non-existent `decisions/` and `strategy/` subdirs; removed. Removed references to `docs/prototype.html` and `docs/prototype-test-script.md` (never created). Added actual subfolders (`files/`, `marketing/` with its contents) and `GITHUB_SECRETS.md`.
5. **Source-of-truth file updated** — was `Flippd_v5_23.html`; actual file is `docs/ScanForProfit_v5_24.html`.
6. **Duplicate `docs/CLAUDE.md` deleted** — 452-line stale snapshot violated CLAUDE.md's own "Do NOT create duplicate files" rule.
7. **Session Start check #2 fixed** — was PowerShell `Get-ChildItem`; replaced with `ls`.
8. **Session Start check #5 fixed** — expected `decisions/ strategy/ marketing/` (wrong); corrected to `marketing/ and files/` (actual).

### Files changed
- `CLAUDE.md` — modified
- `docs/CLAUDE.md` — deleted

### Commit
`46848aa` — "docs: fix 8 CLAUDE.md gaps — onboarding, migrations, video app, docs structure"

### Decisions made (do not reverse)
- `docs/CLAUDE.md` is permanently deleted — `CLAUDE.md` at repo root is the only authoritative copy.
- `docs/decisions/` and `docs/strategy/` do not exist and should not be created unless explicitly requested.

### Next task
No code tasks were started this session. Resume from the prior session's next task: Phase 3 Step 3 (Component Library redo) or Phase 5 (Web App Build) — whichever the user prioritizes.

### Blockers
None.

---

## Session: 2026-06-16 — App-wide hex sweep on app.html

### Context
Continued from 2026-06-15(2) session. Executed the previously-deferred app-wide hex sweep on `apps/web/public/app.html` to eliminate all remaining retired old-palette hex codes.

### What changed this session

**`apps/web/public/app.html`** — commit `90d387b`:
- `.status-Listed`: `rgba(0,150,80,0.15)` + `#00c060` + `#005530` → `var(--green-bg)` + `var(--green)` + `rgba(0,230,118,0.3)`
- `.sold-btn`: `rgba(0,150,80,0.2)` + `#005530` border → `var(--green-bg)` + `rgba(0,230,118,0.3)`
- `.shelf-item.is-buy` border: `#005530` → `rgba(0,230,118,0.3)`
- `.shelf-item.is-buy .s-badge`: `#228844`/`#fff` → `var(--green)`/`#000`
- `.shelf-section-hdr.is-buy` and `.shelf-stat-num.is-buy`: `#228844` → `var(--green)`
- Auth error div bg: `#ffe6e6` → `var(--red-bg)`
- AI listing gradient: `#00bb66` → `#00e676`
- Growth Advisor title+content: `#005522` → `var(--green)` / `var(--text)` (was unreadable dark green on dark bg)
- CSV reminder button: `#c47800`/`#fff` → `var(--yellow)`/`#000`; saved text: `#c47800` → `var(--yellow)`
- Import preview title + summary + result: `#005522` → `var(--green)` / `var(--text)`
- Delete confirm button: `#dd0000` → `var(--red)`
- Confidence bar medium/low: `#c47800`/`#cc0000` → `var(--yellow)`/`var(--red)`
- Scan history decision badges: `#e8fff2`/`#006633` (HOT), `#d4e8e0` (BUY), `#fee` (PASS) → all use `var(--green-bg)`/`var(--green)` or `var(--red-bg)`/`var(--red)`
- Hot tip div text: `#005522` → `var(--green)`
- Stats scan-history PASS badge bg: `#ffe6e6` → `var(--red-bg)`
- Photo coverage warning bg: `#ffe6e6` → `var(--red-bg)`
- Trial/Scout banners: `#fff4d6`/`#c47800` → `var(--yellow-bg)`/`var(--yellow)`, `#ffe6e6` → `var(--red-bg)`
- TIER_INFO Hustle color: `#00bb66` → `#00e676`; Empire color: `#c47800` → `#f5a623`
- Import item nickname: `#005522` → `var(--text)`; status badge: `#005522`/`#fff` → `var(--green)`/`#000`
- Item detect error text: `#cc0000` → `var(--red)`

**`index.html`** — no changes. All remaining old-palette hits were photo-tint gradients on `.inv-thumb`/`.scan-thumb` which are intentionally left per 2026-06-08(3) session decision.

### PR
- PR #58 open (draft): `claude/dazzling-heisenberg-bsqpr6` → `main`

### Decisions made (do not reverse)
- `index.html` photo-tint gradients (`#8b6a3e`, `#3a2410`, `#c47800` inside `linear-gradient` on `.inv-thumb`/`.scan-thumb`) are intentionally untouched — placeholder tints for photo fallbacks, not brand chrome.
- Growth Advisor *body text* uses `var(--text)` (warm cream `#f0ead8`) rather than `var(--green)` — body copy on a green-bg card should be the standard readable text color, not also green.

### Next task
App-wide hex sweep is complete. Merge PR #58 after CI passes, then proceed to Phase 3 Step 3 (Component Library redo with frontend-design skill) or Phase 4 Build Mobile — whichever the user prioritizes.

### Blockers
None.

---

## Session: 2026-06-15(2) — Full rebrand to dark "Industrial Terminal" (docs + mobile + web + video)

### Context
User reported the brand docs/app still used the retired light "Warm Parchment" palette (light brown) instead of the canonical dark "Industrial Terminal" palette already live in `apps/web/public/app.html`/`index.html`. User chose the broadest option: rebrand **everything** (mobile + web + docs + video) to the dark palette.

### What changed this session

**`docs/BRAND_IDENTITY.md`** — fully rewritten as the canonical dark "Industrial Terminal" spec: new logo colors (`#d4a843` brackets / `#00e676` bars, light-bg variant `#8a6c28`), full §2 color palette tables (backgrounds, brand, semantic, text, borders, scan-decision colors) with computed WCAG ratios, icon-style rationale updated for the near-black background. Header note declares Warm Parchment retired.

**`packages/shared/src/constants/theme.ts`** (`@sfp/shared`, single source of truth for mobile) — `COLORS` rewritten to the dark palette (background `#0a0a0a`, surface `#161616`, elevated `#1c1c1c`, inverse `#000000`, brand/profit green `#00e676`, accent gold `#d4a843`/`#8a6c28`, loss `#ff3333`, warning `#f5a623`, neutral `#8a8070`, text/border tokens updated). `SHADOWS.shadowColor` changed from `#1c1712` → `#000000` (matches new bg.inverse). File-header comments updated to match.

**Mobile hardcoded hex fixes** (theme.ts doesn't auto-cascade to literals):
- `apps/mobile/app/_layout.tsx` — splash background `#1c1712` → `#0a0a0a`
- `apps/mobile/app/(tabs)/scout.tsx` — `DECISION_COLOR` map, profit/loss text color, `ActivityIndicator` color all updated to new palette
- `apps/mobile/components/ui/ScanResult.tsx` / `BottomSheet.tsx` — stale hex values in comments updated to match new `COLORS` constants

**Web (`apps/web/`)**:
- `tailwind.config.ts` — all 12 `sfp-*` color tokens rewritten to dark palette (used across landing pages, roadmap/terms/privacy app routes)
- `components/landing/Nav.tsx` — `LogoMark` SVG hex updated (`#c9a468`→`#d4a843`, `#00bb66`→`#00e676`)
- `public/privacy.html` and `public/terms.html` — `:root` palette rewritten to dark tokens (new `--bg`/`--dark`/`--light`/etc.), body bg, `.hero` border, `.section a` link color (was unreadable `var(--dark)`→now `#000000`, switched to gold), `.callout`/`.warning-box` rgba tints updated to new green/gold, `.contact-box p` color, nav/footer Logo SVG hex

**Video (`apps/video/`)** — resolves the brand-divergence flag from the 2026-06-15(1) session:
- `src/lib/brand.ts` — all color tokens rewritten to dark "Industrial Terminal" (was literal "warm parchment" per old PROMPT_1 spec)
- `src/components/Logo.tsx` — removed hardcoded `#c9a468`, `bracketColor` now derives from `brand.accent`/`brand.accentDim`
- `src/compositions/HeroVideo.tsx`, `YouTubePreroll.tsx` — radial-gradient highlight color `#4a2f17` → `#2e2410` (dark-gold glow against new `#0a0a0a` header)

**AI prompt `score_color` field** (3 occurrences, kept in sync per "port verbatim" rule — only the literal hex values changed, not prompt wording):
- `docs/FEATURE_TRIAGE.md`, `supabase/functions/claude-proxy/index.ts` (prompt spec + response normalization fallback + error-path fallback), `apps/web/public/app.html` (prompt spec line only) — `"#00bb66 or #c47800 or #dd0000"` → `"#00e676 or #f5a623 or #ff3333"`

### Explicitly out of scope (untouched, per prior "do not reverse" decisions)
- `apps/web/public/app.html` / `index.html` — all other old-palette hex residuals (photo-tint gradients, etc.) remain part of the previously-deferred "app-wide hex sweep," a separate session.
- `docs/HANDOFF.md`, `docs/ScanForProfit_v5_24.html` — historical/archival, not "current branding."

### Verification
- Repo-wide grep for all retired palette hex codes (`#00bb66`, `#f2ece0`, `#8B6A3E`, `#c9a468`, `#1c1712`, `#dd0000`, `#e6850a`, `#5c5248`, `#c47800`, etc.) across `.ts`/`.tsx`/`.html`/`.md` → only remaining hits are the explicitly-deferred `app.html`/`index.html` app-wide sweep.
- `npx tsc --noEmit` in `packages/shared` → 0 errors. `apps/web`, `apps/mobile`, `apps/video` show only pre-existing module-resolution errors (`node_modules` not installed in this sandbox) unrelated to this change — no new errors introduced by the hex/value-only edits.

### Decisions made (do not reverse)
- Dark "Industrial Terminal" is the single canonical brand palette everywhere (docs, mobile, web, video). Warm Parchment is fully retired — do not reintroduce.
- `COLORS.brandDim`/`profitText`/`lossText`/`warningText` now equal their non-`*Text` counterparts (no separate "deep" variant needed — AAA contrast achieved directly on dark backgrounds).
- `apps/video/src/lib/brand.ts` now matches the app-wide dark palette — the prior "warm parchment vs dark" divergence is resolved.

### Next task
App-wide hex sweep on `apps/web/public/app.html` / `index.html` (previously deferred) — separate session.

### Blockers
None.

---

## Session: 2026-06-15 — New `apps/video/` Remotion pipeline: 5 marketing video compositions rendered

### Context
User (via `PROMPT_1_CLAUDE_CODE_VIDEO.md` + 3 uploaded screen-recording clips) requested a new isolated Remotion video-production app to generate marketing ad creatives from real app footage.

### What changed this session

**New package: `apps/video/`** (`@sfp/video`, Remotion 4.0.477) — added to the pnpm workspace:
- `package.json`, `tsconfig.json`, `remotion.config.ts` (jpeg image format, overwrite output)
- `src/index.ts` — `registerRoot(Root)`
- `src/Root.tsx` — registers all 5 compositions (ids/dimensions/durations, fps=30) + top-of-file comment documenting ffprobe footage triage findings
- `src/lib/brand.ts` — brand tokens **exactly per PROMPT_1's "warm parchment" spec** (bg `#f2ece0`, header `#3a2410`, green `#00bb66`, Syne + IBM Plex Mono, spacing scale)
- `src/lib/fonts.ts` — self-hosted `@fontsource/syne` (400/700/800) + `@fontsource/ibm-plex-mono` (400/500) — avoids runtime fetches to fonts.gstatic.com
- `src/components/` — `Logo.tsx` (ScanMark + wordmark), `PhoneFrame.tsx` (white-bezel device frame), `FlipBadge.tsx` (FLIP/HOT/PASS animated label), `ProfitCounter.tsx` (animated $ counter), `CTAPill.tsx`
- `src/compositions/` — `HeroVideo.tsx` (1920x1080, 30s/900f), `TikTokAd.tsx` & `StoryAd.tsx` & `SquareAd.tsx`/`YouTubePreroll.tsx` per PROMPT_1 scene specs (1080x1920 / 1080x1080 / 1920x1080, 8-15s)
- `public/footage/` — 3 real screen-recording clips copied in (`screen-20260614-140716.mp4`, `-140913.mp4`, `-141341.mp4`)

**Rendered all 5 compositions** → `apps/video/out/*.mp4` (gitignored — added `apps/video/out/` to `.gitignore`), then copied final renders to `docs/marketing/video-assets/`:
- `hero-1920x1080.mp4` (3.1MB), `tiktok-1080x1920.mp4` (9.8MB), `square-1080x1080.mp4` (6.2MB), `youtube-1920x1080.mp4` (0.9MB), `story-1080x1920.mp4` (3.9MB)

`npx tsc --noEmit` in `apps/video` → **0 errors**.

### ⚠️ Brand palette divergence — flagged, not resolved
`apps/video/src/lib/brand.ts` uses PROMPT_1's literal "warm parchment" palette (`#f2ece0` bg, `#3a2410` header/brown, `#00bb66` green). This **does not match** the live web app's current dark "industrial terminal" palette (`#0a0a0a` bg, `#d4a843` gold accent, `#00e676` green — see 2026-06-08(3) session). Followed PROMPT_1 verbatim since this is a new isolated app and the prompt said "use these exact tokens, never substitute." **Next session should decide**: either restyle `apps/video` to match the dark brand, or treat video ads as an intentionally distinct "warm parchment" sub-brand — needs a deliberate brand decision, not a silent fix.

### Environment workarounds (needed to reproduce renders)
- **Chrome binary**: `remotion render` needs `--browser-executable`. Auto-download is blocked (`remotion.media` not in network allowlist). Installed via: `PUPPETEER_DOWNLOAD_BASE_URL=https://storage.googleapis.com/chrome-for-testing-public npx --yes puppeteer browsers install chrome` → binary at `/root/.cache/puppeteer/chrome/linux-149.0.7827.22/chrome-linux64/chrome`.
- **Fonts**: `@remotion/google-fonts` fails (`ERR_CERT_AUTHORITY_INVALID` on fonts.gstatic.com in this sandbox). Use self-hosted `@fontsource/syne` + `@fontsource/ibm-plex-mono` CSS imports instead (already done in `src/lib/fonts.ts`).
- Render command pattern: `npx remotion render <CompositionId> out/<file>.mp4 --browser-executable=<chrome path>`

### Footage triage (documented in `Root.tsx` header comment)
- Clip `screen-20260614-140716.mp4` — coffee maker scan → PASS result
- Clip `screen-20260614-140913.mp4` — shelf scan → Shelf Report, HOT $50-profit modem (best FLIP-style result; used inside `PhoneFrame` for HeroVideo/SquareAd/YouTubePreroll)
- Clip `screen-20260614-141341.mp4` — Goodwill teacups w/ $2.99 tag (best thrift-shelf b-roll; used full-bleed looped in TikTok/Square/StoryAd, `SHELF_CLIP_FRAMES=389`)

### Verification
- `npx tsc --noEmit` (apps/video) → 0 errors
- All 5 renders confirmed correct dimensions/duration via `ffprobe`
- HeroVideo spot-checked visually at 5 timestamps (1s/5s/12s/22s/28s) — all 5 scenes render correctly (logo intro, hook text, PhoneFrame demo footage, FLIP badge + profit counter, outro CTA)
- TikTokAd/SquareAd/YouTubePreroll/StoryAd not individually frame-checked this session — recommend a quick visual spot-check before using in ad campaigns

### Decisions made (do not reverse)
- `apps/video` is a new, isolated pnpm workspace package — does not affect mobile/web/shared
- `apps/video/out/` is gitignored; final renders live in `docs/marketing/video-assets/`
- Brand palette divergence (warm parchment vs. dark industrial) — flagged above, intentionally left unresolved

### Next task
Run `PROMPT_2_COWORK_DISTRIBUTION.md` in Cowork.

### Blockers
None.

---

## Session: 2026-06-10 — Conversion kit adaptation: mobile onboarding flow + hero sell-through signal

### Context
User received a 3-part "conversion rebuild kit" from ChatGPT (homepage rewrite, pricing rewrite, app onboarding flow) aimed at improving conversion. After investigation and user clarification: pricing tiers stay locked (Scout/Hustle/Stack/Empire — no name/price changes), decision terminology stays `BUY`/`HOT`/`PASS` (the kit's invented "MARGIN" tier was dropped), and the mobile onboarding flow (planned in FEATURE_TRIAGE.md, KPI #1: 60%+ first-scan rate, never built) was the real gap to fill.

### What changed this session

**New: 5-screen mobile onboarding flow** — `apps/mobile/app/(onboarding)/`
- `_layout.tsx` — Stack, headerShown: false
- `identity.tsx` — "What kind of reseller are you?" (4 selectable Card options, local state only)
- `permission.tsx` — "Try a scan" — Allow Camera (`useCameraPermissions`) or Scan Sample Item, both → result
- `result.tsx` — renders `ScanResult` with static demo data (BUY, Vintage Cast Iron Skillet, $4→$47, +$38.50, 962% ROI, 92% confidence) + sold-range/sell-through caption
- `how-it-works.tsx` — 4-step trust reinforcement (Scan → BUY/HOT/PASS decision → Inventory → Stats)
- `upgrade.tsx` — Hustle tier teaser via `TIER_CONFIGS.hustle`; both CTAs mark onboarding complete and route to `(tabs)/scout` or `(tabs)/settings`

**New: `apps/mobile/lib/onboarding.ts`** — SecureStore-based one-time gating (`hasCompletedOnboarding`/`markOnboardingComplete`)

**New: `apps/mobile/lib/onboardingDemoData.ts`** — `DEMO_SCAN_RESULT`, `DEMO_SOLD_RANGE`, `DEMO_AVG_DAYS_TO_SELL` (mobile-only demo content, not added to `@sfp/shared`)

**Edited: `apps/mobile/app/_layout.tsx`** — root redirect logic now also checks `hasCompletedOnboarding()` alongside the session check; new redirect rules:
- `!session && !inAuth && !inOnboarding` → `/(auth)/login`
- `session && !onboardingDone && !inOnboarding` → `/(onboarding)/identity`
- `session && onboardingDone && (inAuth || inOnboarding)` → `/(tabs)/scout`

**Edited: `apps/web/components/landing/HeroSection.tsx`** — `FlipResultCard` footer line now reads `6.2s · 12 sold last 90 days · 9 days avg to sell` (was `· eBay comps`).

**Edited: `apps/web/public/index.html`** (the actual live homepage — see "Important discovery" below) — added a 4th `.scout-metric` row to the hero phone mockup's Scout result card: `Sold last 90d → 12 · 9d avg`, matching the same sell-through signal added to the React hero card.

**New: `apps/mobile/nativewind-env.d.ts`** — this file is referenced in `apps/mobile/tsconfig.json`'s `include` array (`"nativewind-env.d.ts"`) but was **missing from the repo entirely**. Its absence caused all 165 of the pre-existing `Property 'className' does not exist` (TS2769/TS2322) errors across the mobile app (ScanResult, Input, BottomSheet, ItemCard, EmptyState, Button, scout.tsx, login/register/verify.tsx, etc.) — `tsc` had no idea NativeWind augments RN component props with `className`. Restored it (standard NativeWind-generated content: `/// <reference types="nativewind/types" />`), plus added one line `declare module "*.css";` to fix the last remaining error (`global.css` side-effect import in `_layout.tsx`, TS2882). **Result: `npx tsc --noEmit` now returns 0 errors in `apps/mobile`, `packages/shared`, and `apps/web`** — previously `apps/mobile` had 166 errors before this fix (unrelated to this session's other changes, but blocking the mandatory 0-error commit gate).

### Important discovery — `apps/web/public/index.html` is the live homepage, not `app/page.tsx`
`apps/web/next.config.js` has a rewrite: `source: '/'` → `destination: '/index.html'`. So **`apps/web/public/index.html` (static file) is what's actually served at scanforprofit.com**, not `apps/web/app/page.tsx` + `components/landing/*`. This was confirmed by running `next dev` and curling `/` — it returned the static `index.html` markup (Vintage Coach satchel, STR 94%, etc.), not the `HeroSection.tsx` "Vintage Cast Iron Skillet" mockup. `app/page.tsx` is an in-progress React rebuild (per many prior HANDOFF sessions: "Rebuild landing page from static HTML → React components") that is not yet wired to a live route.

This session's plan was originally written assuming `app/page.tsx` was live. Both files were edited with the equivalent sell-through-signal addition so the change has actual effect on the live site (`public/index.html`) while staying consistent with the in-progress React rebuild (`HeroSection.tsx`).

**Follow-up for next session:** decide when/how `app/page.tsx` gets wired up to replace the `next.config.js` rewrite to `index.html`, so future "homepage" edits target one source of truth instead of two.

### Verification
- `apps/mobile`, `apps/web`, `packages/shared`: `npx tsc --noEmit` → 0 errors each. ✅
- `apps/web`: ran `next dev`, curled `/`, confirmed `Sold last 90d · 12 · 9d avg` renders in the live hero phone mockup. ✅ (reverted auto-generated `tsconfig.json`/`next-env.d.ts` changes from `next dev` startup — not part of this change)
- `apps/mobile`: no simulator available in this remote environment. Ran `EXPO_OFFLINE=1 npx expo export --platform ios`, which bundled all 2066 modules (including all 5 new onboarding screens and `_layout.tsx`) successfully via Metro/Babel (which understands `className`/JSX). Final Hermes-compile step failed on an unrelated pre-existing `@sentry/react-native` OpenTelemetry dynamic-import issue, not caused by this session's changes.
- Did not run on-device: full onboarding walkthrough (identity → permission → result → how-it-works → upgrade), relaunch persistence check, or returning-user skip check. **Needs manual verification on a simulator/device next session.**

### Decisions made (do not reverse)
- Pricing tiers (Scout/Hustle/Stack/Empire, $0/$19/$49/$199) unchanged — restyling/copy only, ever.
- Decision terminology is `BUY`/`HOT`/`PASS` everywhere — the ChatGPT kit's "MARGIN" tier was rejected.
- Onboarding uses static demo data only (`DEMO_SCAN_RESULT`) — no real AI/API call during onboarding.

### Out of scope / pre-existing, not touched
- `packages/shared/src/constants/tiers.ts` (`TIER_CONFIGS.hustle.limits` shows `scansPerMonth: 300, inventoryItems: 1000`) drifts from CLAUDE.md's table and `PricingSection.tsx` (both say Hustle = unlimited scans / 500 items). Pre-existing, worth reconciling separately.
- "Growth Agent" naming in marketing/docs vs. brand-voice guidance to avoid it — pre-existing, out of scope.

### Next task
1. Run the mobile onboarding flow on a simulator/device: fresh install → register → verify → confirm lands on `/(onboarding)/identity` (not `/(tabs)/scout`); walk all 5 screens; confirm both upgrade CTAs mark onboarding complete and route correctly; relaunch as same user → onboarding does not re-show; existing onboarded users skip onboarding entirely.
2. Decide on `app/page.tsx` vs `public/index.html` as the long-term homepage source of truth (see "Important discovery" above).
3. (Optional, separate task) Reconcile `tiers.ts` Hustle limits drift noted above.

---

## Session: 2026-06-09 (6) — Bold visual pass 2: gradient cards, larger numbers, stronger glows

### What changed this session

User feedback after PR #48 merged: "it still looks the same." Root cause diagnosed: on a `#0a0a0a` background, drop shadows (`rgba(0,0,0,x)`) are invisible — shadows only cast against light surfaces. Fix: applied "Modern Dark Cinema Mobile" design-system recommendations from ui-ux-pro-max skill.

**`apps/web/public/app.html`** — commit `7b3c062`:
- **Gradient card backgrounds**: `.card`, `.kpi-card`, `.nav-card`, `.stat-card`, `.item-card`, `.modal-box`, `.dash-cat-card`, `.inv-stat-card`, `.pnl-sum-card` all get `linear-gradient(160deg, #1d1d1d 0%, #131313 100%)` — creates visible depth against near-black where flat colors had near-zero contrast
- **Paper texture block updated**: combined paper SVG + gradient into multi-layer `background-image` so gradient shows through texture correctly
- **50% larger numbers**: `kpi-val` 18→24px, `stat-num` 20→30px, `inv-stat-num` 22→32px, `pnl-sum-num` 20→28px; glow text-shadow opacity 0.4→0.65
- **Border tokens upgraded**: `--border` #2a2a2a→#383838, `--border-bright` #3a3a3a→#4a4a4a — 50% brighter; propagates to all row separators, dividers, form outlines
- **Border-radius modernized**: cards 6→10px, kpi/nav-card 4→10px, modal 4→16px, shelf-item 4→10px, btn 4→8px, item-card 3→8px
- **Button gradients**: `btn-green` and `btn-amber` get linear-gradient backgrounds; all glow shadows doubled (20→36px spread, opacity doubled)
- **Decision banners**: radius 6→14px, stronger gradient colors; `hotPulse` animation peak glow `rgba(0,240,120,0.9)` + 10px ring spread
- **Item cards**: gold left-border tint at rest `rgba(212,168,67,0.22)` → fully gold on hover; stronger hover shadow
- **Late CSS overrides fixed**: item-card:hover (line 822), inv-status-card:hover, inv-cat-card:hover all had near-invisible `rgba(80,40,0,0.13)` amber glows — replaced with proper `rgba(0,0,0,0.65)` dark shadows
- **Setup card**: stronger gradient (#1e1800→#100c00), bigger radius (6→14px), gold glow tripled
- **Body**: subtle warm top gradient `#100f0c→#0a0a0a` over 25vh (ambient light from gold accent)

**`apps/web/public/index.html`** — commit `7b3c062`:
- Feature cards: gradient bg, radius 6→12px, shadow 0.35→0.55 opacity, stronger hover
- Price cards: gradient bg, radius 6→12px; featured card glow tripled (0.18→0.28 opacity + inset highlight)
- `btn-primary`: gradient background, glow doubled
- FAQ details: gradient bg, radius 6→10px, gold open-state border ring
- Border tokens: same upgrade as app.html
- Body: same warm top gradient

**PR #49** created as draft. CI: Vercel ✅ Ready, Supabase ✅ Skipped, Railway ✅ Building (not a blocking check). No review comments.

### Decisions that should not be reversed (new this session)

- **Gradient card backgrounds are now the standard**: `linear-gradient(160deg, #1d1d1d 0%, #131313 100%)` is the canonical card background for all card-style components in both files. Do not revert to flat `#161616`.
- **Border brightness**: `--border: #383838` and `--border-bright: #4a4a4a` are the new token values. Do not revert to #2a2a2a/#3a3a3a — those were too dark to see on the near-black background.
- **Paper texture block**: the `.card` override block in app.html now uses combined `background-color + background-image: url(paper), gradient`. If adding future CSS overrides to this block, maintain the multi-layer pattern.

### Next task

1. Merge PR #49 after Railway CI completes.
2. If user still says "looks the same": the next escalation is a structural layout change — consider upgrading the app's max-width from 540px to a wider layout on desktop, or adding an ambient glowing blob element behind content using `body::after`.
3. Deferred: emoji→SVG icon system (138 instances, see prior session notes).
4. Deferred: app-wide hex color sweep (#005522, #228844 etc. in Growth Agent / Scout).

### Blockers
None.

---

## Session: 2026-06-08 (5) — Design-system architecture overhaul: token system + component class consolidation

### What changed this session

Executed the approved Phase 2 plan (`/root/.claude/plans/use-the-ui-pro-wild-island.md`). Full inline-style→class migration across both static HTML files. Baseline was ~785 inline style instances in `app.html` and 25 in `index.html`. End result: ~723 in `app.html` (62 eliminated), 16 in `index.html` (all legitimately dynamic or structural).

**`apps/web/public/app.html`** — 10 commits:

- **Phase 0** (already done from prior session): 5 token groups added to `:root` — spacing scale (--space-1→9), border-radius scale (--radius-xs→full), typography scale (--text-2xs→3xl), shadow system (--shadow-sm/md/lg + 3 glow tokens), z-index scale (--z-base through --z-toast).
- **Phase 1** (already done from prior session): ~200 lines of new CSS classes (Groups A–D): decision-banner state variants (.is-hot/.is-buy/.is-pass), threshold utilities (.u-pos/.u-warn/.u-neg), demand text colors, shelf item states (.shelf-item.is-*), typography/spacing utilities (.u-syne, .u-text-*, .u-mt-*, .u-mb-*, .u-muted, .u-soft, .u-accent, .u-bold9, .u-center), empty-state-dashed, edit-photo-* classes, detail-item-* classes, ai-sourced-badge, inventory card helpers.
- **Phase 2 Step 1** — `renderSingle`: removed D/DC/pc/rc/dayc/stc/confColor inline color-lookup objects; added 6 JS classifier helpers (profitClass, roiClass, daysClass, strClass, confClass, demandClass); decision-banner now uses .is-hot/.is-buy/.is-pass CSS; conf-bar-fill color via .u-pos/.u-warn/.u-neg.
- **Phase 2 Step 2** — `renderShelf`: removed SD/DC objects (light-mode hex leak #e8fff2/#f0fff5/#fff0f0); shelf items now use .is-hot/.is-buy/.is-pass; section headers use .shelf-section-hdr.is-*; stat count cards use .shelf-stat-num.is-*; buy button 6-property inline → .shelf-buy-btn; demandClass()/profitClass() reused.
- **Phase 2 Step 3** — `renderInventoryHome`: empty state giant inline → .empty-state-dashed/.empty-title/.empty-body/.empty-icon; status cards remove statusDefs with light-mode hex #D4E8E0/#D4E0EC → .inv-status-card.is-*; category cards 4 inline props each → .inv-cat-name/.inv-cat-meta/.inv-cat-count/.inv-cat-profit.
- **Phase 2 Step 4** — `renderFilteredList`: action row → .item-row-bot + token gap; price label → u-text-sm u-muted (removes redundant font-family); listing detail → token sizing; status badge margin → token; .item-nick truncation moved to CSS class definition.
- **Phase 2 Step 5** — `showDetail` + `startEdit`: SKU/name inline → .detail-item-sku/.detail-item-name; AI-sourced badge #e8fff2 light-mode bug → .ai-sourced-badge; eBay fees color → u-neg; Est.Profit → .detail-profit-val + profitClass(); photo grid inline → .edit-photo-grid/.edit-photo-wrap/.edit-photo-del; updateProfitPreview() val.style.color → val.className = profitClass(p).
- **Phase 2 Step 6** — `pnlRenderMonthly`: empty/meta/profit typography → utility classes + tokens.
- **Phase 2 Step 7** — `renderGrowthResults` + `updateSoldProfit`: score label/summary → u-syne/u-bold9/u-soft; hunt priority badge 7-prop inline → .hunt-priority.is-high/.is-warn (new CSS class); stale reason/success → utility classes; empty messages → token padding; val.style.color → profitClass().

**`apps/web/public/index.html`** — 1 commit (Phase 3):

- Added 4 new CSS classes: .u-green-bdr, .tag-section, .ps-meta, .fine-print.
- Replaced 3× repeated .tag overrides → .tag.tag-section.
- Replaced 2× .ps-title span overrides → .ps-meta.
- Replaced 4× style="color:var(--green-border)" → class="u-green-bdr".
- Tokenized 4× raw margin-top px values (12px→--space-3, 8px→--space-2) and fine-print margin.
- Replaced fine-print style block → class="fine-print".
- Residual 16 inline styles: 6 unique background-image URLs, 4 dynamic bar-fill widths (%),
  3 token-based spacings already converted (expected residual), 2 structural layout one-offs, 1 flex gap.

### Decisions that should not be reversed (new this session)

- **Icon system deferred**: 138 emoji instances (~17 unique emojis) used as functional icons throughout app.html. Orthogonal to token/component architecture; brand-adjacent (icon style = visual identity); no-build-step constraint makes SVG a separate initiative. Good candidate for a dedicated session.
- **App-wide hex sweep deferred**: `#005522`, `#006633`, `#005530`, `#228844`, `#ffe6e6`, `#f0fff5` scattered throughout Growth Agent, Scout, Import, and inventory cards — per plan, a dedicated cross-cutting pass is needed, not bundled with function-level refactors.
- **`.growth-profit` layout properties** (margin-left/flex-shrink) moved into the CSS class definition rather than remaining inline — all usages now rely on the CSS class; don't add inline overrides.
- **`.item-nick` truncation** moved into the CSS class definition — don't add inline white-space/overflow/text-overflow on elements using this class.

### Next task

1. Deploy to Vercel (merge/push branch, verify live deployment) — the Vercel webhook deploys from `scanforprofit` repo's main branch; this work is on `claude/scanforprofit-ui-seo-audit-9xn510`, needs a PR merge.
2. Browser regression check: open `/app.html` and click through Scout (single scan + shelf scan result), Inventory (home, list, detail, empty state), and Growth Agent — confirm HOT/BUY/PASS banners, shelf item cards, status badges, profit colors, AI-sourced badge, and edit-photo grid all render correctly against the dark theme.
3. Consider the app-wide hex color sweep as a follow-up session (see deferred items above).
4. Consider the icon system (emoji→SVG) as a dedicated future session.

### Blockers
None.

---

## Session: 2026-06-08 (4) — Visual + SEO audit fixes: Stats tab polish + homepage cleanup

### What changed this session

User asked for a full visual/SEO audit of scanforprofit.com (homepage) and scanforprofit.com/app.html, specifically calling out "the stats tab looks horrible." Produced an audit + fix plan (`/root/.claude/plans/use-the-ui-pro-wild-island.md`), got it approved, then implemented the fixes. User's explicit mandate: **(a) do NOT add `noindex` to app.html — Google discoverability is "very important"; (b) don't just fix bugs, "make it look the best that it can."**

**`apps/web/public/app.html`** — Stats tab dark-theme color pass:
1. Renamed `class="kpi-num"` → `class="kpi-val"` (4× in `sPnlRender()`) — fixes an undefined-CSS-class bug that left P&L summary numbers unstyled (plain body text instead of bold gold Syne, inconsistent with Dashboard KPI cards).
2. Re-themed both Mileage Logger cards — the Stats > P&L one AND the `#panel-pnl` drill-down's (same component, same bug, fixed both for consistency): hardcoded `#e8b840`/`#c47800`/`var(--yellow-bg,#fffbe6)` light-mode hex → `var(--yellow)`/`var(--yellow-bg)` theme tokens; button text `#fff`→`#000` on gold background (matches the established `.btn-green` convention).
3. Fixed two light-mode badge bugs in `renderSubscriptionPanel()`: FREE-tier badge `background:'#f4f4f4'` (near-white)/`color:'var(--muted)'` → `background:'var(--surface)'`/`color:'var(--soft)'`; low-days trial-warning badge `'#ffe6e6'` (light pink) → `'var(--red-bg)'` — both now use pre-existing dark-theme-correct CSS variables.
4. Removed the duplicate Google Fonts load in `<head>` — folded the `@import`'s extra weight (IBM Plex Mono 700) into the existing `<link rel="stylesheet">` and deleted the redundant `@import url(...)` inside `<style>`.
5. **Did NOT add `<meta name="robots" content="noindex">`** — user explicitly wants the app discoverable via Google search.

**`apps/web/public/index.html`** — homepage SEO/UX cleanup:
1. Added `<link rel="icon" href="/favicon.png">` + `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` — copied `apps/mobile/assets/favicon.png` (32×32) and `icon.png` (1024×1024, renamed `apple-touch-icon.png`) into `apps/web/public/` (no suitable web favicon existed before).
2. Wrapped the page's content sections in a `<main>` landmark (hero through final-CTA, before `<footer>`).
3. **Removed** the hidden `#social-proof` section entirely (markup + its dedicated CSS: `.proof-grid`/`.proof-card`/`.proof-metric`/`.proof-label`/`.proof-quote`/`.proof-attr`/`.avatar*`/`.proof-name`/`.proof-role`, ~70 lines) — it contained fabricated testimonials (fake handles like `@flippin_marcus`, unverified numbers like "$180→$900+") shipped with `display:none`. Decided to delete rather than re-enable: shipping fake social proof on a pre-launch site is a trust/credibility risk, and `display:none` content that's still crawlable is an SEO smell either way.
4. Fixed dead `href="#"` links: both header/footer logo links → `href="/"`; removed all 5 dead "Learn more →" feature-card links (and their now-unused `.feature-link`/`.feature-link:hover` CSS) since no feature detail pages exist — the cards already convey the info and the page CTA is "Get early access," so a non-functional secondary link added no value.
5. **"Contact Sales"** (Empire tier) — was routing to the same `#early-access` waitlist anchor as every other CTA (misleading for a "talk to sales" intent). Changed to `mailto:customerservice@scanforprofit.com?subject=Empire%20plan%20inquiry` — reused the real support address already live in the footer (`<li><a href="mailto:customerservice@scanforprofit.com">Contact</a></li>`), no new infrastructure invented.
6. **Wired the footer newsletter form** to the same `/api/waitlist` endpoint as the hero capture form (it previously had zero backend wiring — just disabled the button and fired an analytics event). Added the same email-regex validation, loading/success/error states, and `trackEvent` calls as the proven `early-form` handler — both forms now behave consistently and actually persist signups to Supabase.

### Decisions that should not be reversed
- **No `noindex` on app.html** — explicit user instruction; Google discoverability of the app shell is a product priority, not an oversight.
- **`#social-proof` deleted, not re-enabled** — the testimonials were fabricated placeholder content (fake usernames/unverified metrics). Don't resurrect this markup; if real testimonials are collected later, build a fresh section with real attributions.
- **`#panel-pnl` is NOT dead code** — corrected a wrong finding from the initial audit (a sub-agent claimed it was orphaned). It's a legitimate drill-down screen reached via the Dashboard's `nav-card onclick="switchTab('pnl')"`. Do not delete it.

### Flagged but explicitly NOT fixed (scope decisions — documented for a future session)
- **Hardcoded `tax = net * 0.25` and `mileageRate = 0.67`** (CLAUDE.md violations — "never hardcode taxReservePct/mileageRate"): on inspection, the live `DEFAULTS`/`S` settings object (app.html line ~4079) has **no `taxReservePct` or `mileageRate` fields at all** — there is no settings infrastructure to read from. Properly fixing this means building a new settings feature (DB columns, settings UI, defaults wiring) — out of scope for "improve Stats visuals." Recommend a dedicated follow-up session.
- **App-wide light-mode hex colors** (`#005522`, `#228844`, `#006633`, `#005530`, `#ffe6e6`, `#f0fff5` etc.) — NOT Stats-specific; they appear throughout Growth Agent, Scout scan results, Import screen, and inventory cards. Re-theming all of them is a large cross-cutting change beyond "fix the Stats tab." Left as-is per surgical-changes rule.
- **Border-radius "normalization"** — the original audit flagged 8px/12px in the Subscription panel as inconsistent, but on reviewing the wider app, 8px/12px are actually the *dominant, established* radii (buttons, cards, modals, dropzones); only `.kpi-card` uses 4px. Normalizing the Subscription panel down would have made it *less* consistent with the rest of the app. No change made.
- **Inline-style consolidation / emoji→icon replacement** — large refactors (`renderSubTierCards`, `renderSubscriptionPanel`, multiple template-string blocks) that go beyond "fix Stats visuals" scope. Recommended as a dedicated follow-up.
- **`.dash-section` (9px label text)** — defined in CSS but has zero usages in markup (`grep -c 'class="dash-section'` → 0); it's dead CSS, not a visible/rendered issue. Left alone.

### Next task
1. Visual spot-check `/app.html` Stats tab (Overview/P&L/Plan sub-tabs) and the homepage in a real browser — confirm badges/numbers/cards read correctly against the dark theme, favicon shows in the browser tab, newsletter signup round-trips to Supabase.
2. Consider the flagged-but-deferred items above for a future session (settings infrastructure for `taxReservePct`/`mileageRate`, app-wide light-mode hex color sweep, inline-style consolidation).
3. Corrected the audit plan file (`/root/.claude/plans/use-the-ui-pro-wild-island.md`) in place — it now reflects what was actually verified/done/deferred and corrects the wrong "`#panel-pnl` is orphaned" claim from the initial pass.

### Blockers
None.

---

## Session: 2026-06-08 (3) — Brand Unification: index.html reworked to match app.html's dark system

### What changed this session

The prior re-audit session flagged something the `impeccable` detector can't catch on its own: `index.html` (marketing landing page) and `app.html` (the actual product) read as two different brands — different fonts (Plus Jakarta Sans + Fira Code vs. the spec's Syne + IBM Plex Mono), different palettes (light warm-beige "editorial" vs. dark "industrial terminal"), different component personalities (soft drop-shadow lift-on-hover vs. quiet glow language). User chose **full unification** over keeping two registers: rework `index.html` end-to-end to match `app.html`'s dark system.

**`apps/web/public/index.html`** — CSS/token rewrite only; copy, structure, IDs, `aria-*`/`role`, every `<a href>`/CTA destination, the PostHog snippet, both JSON-LD blocks (verified byte-for-byte unchanged), `<meta>`/`<link rel="preconnect">` tags, and the hidden `#social-proof` state are all untouched:

1. **Fonts** (line 24): swapped Plus Jakarta Sans + Fira Code → `Syne:wght@700;800;900` + `IBM+Plex+Mono:wght@400;500;600;700` (now matches `app.html` exactly — shared cached font payload, and finally matches the documented spec in `BRAND_IDENTITY.md`).
2. **`:root` palette** (lines 54-77): full swap to app.html's dark tokens (`--bg:#0a0a0a`, `--card:#161616`, `--text:#f0ead8`, `--accent:#d4a843` gold, `--green:#00e676`, etc.), added tokens index lacked (`--card-hover`, `--accent-dim`, `--red-bg`, `--yellow-bg`, translucent `--green-bg`/`--purple-*`).
3. **`--header` deleted** (do-not-reverse decision — see below).
4. **Scanline overlay**: ported `body::before` `repeating-linear-gradient` + `mix-blend-mode:multiply` + `z-index:9000` verbatim from app.html — the signature "industrial terminal" texture.
5. **Nav, buttons, hero, section headings, cards, badges/pills/status, FAQ, final CTA, footer**: retinted to dark tokens; unified card radius to 6px (matches app.html's actual `.card` value), badge/pill radius to 3px; replaced soft-shadow lift-on-hover with app.html's quiet glow language (`background → var(--card-hover)` + `border-color → var(--accent)`, no transform); buttons now glow (`box-shadow: 0 0 20px rgba(0,230,118,0.25)`) and press (`scale(0.97) translateY(1px)` + `brightness(0.9)`) instead of lifting; added focus ring on `.newsletter input` matching app.html's input-focus pattern (`box-shadow: 0 0 0 2px rgba(212,168,67,0.15)`).
6. **Logo** reskinned to match `.app-logo-name` exactly (gold, glow text-shadow, 900 weight, 0.12em tracking).
7. **Locked easing curve**: every new/changed transition uses `cubic-bezier(0.16,1,0.3,1)` (the one approved curve per the prior session's bounce-easing fix — never elastic/overshoot).
8. **Did NOT port** `hotPulse`/`buySweep`/`statFlash` (tied to live decision states that don't exist on a marketing page) or the `.card::before` gold side-stripe (the team actively removed this exact "side-tab" tell from app.html dashboard cards in commit `a5c0f34` — reintroducing it on marketing cards would be regressive).
9. **Remapped every orphaned old-palette literal** found during the rewrite (not all were itemized in the plan — found via systematic grep after the token swap): old green `#00bb66`/`rgba(0,187,102,*)` → new `#00e676`/`rgba(0,230,118,*)`; old card-cream `rgba(253,248,239,*)` → `rgba(240,234,216,*)`; old header-brown `rgba(58,36,16,*)` → near-black/white-translucent equivalents; old yellow `rgba(196,120,0,*)` → `rgba(245,166,35,*)`; old purple `rgba(107,63,160,*)` → `rgba(179,136,255,*)`. Left `.inv-thumb`/`.scout-frame`/`.scan-thumb` photo-tint gradients (`#8b6a3e`, `#3a2410`, etc.) untouched — they're photo placeholder tints, not brand chrome.
10. **Contrast fixes**: applied app.html's `color:#000` convention on bright `--accent`/`--green` backgrounds (`.avatar`, `.feature-card.green .feature-icon`, `.price-card.featured .price-badge`).

### Decision that must NOT be reversed: `--header` token deleted

`index.html` used `--header` (`#3a2410` brown) as a *heading/ink text color* in ~44 places, while `app.html` uses `--header` (`#000000`) as a *background* for nav/tab-bar only — these are semantically incompatible, not interchangeable. **Resolution: deleted `--header` entirely.** All ~44 text-color references became `var(--text)` (app.html's light-ink-on-dark color, `#f0ead8`). The ~10 places where index.html used `--header` as a *background* ("dark chip with light text") got individual case-by-case replacements chosen by finding the closest analog in app.html's actual vocabulary (verified by reading/grepping app.html first — e.g. `.hunt-head`/`.skip-link` → pure-black `#000` bars, matching app.html's only literal `--header:#000000` usage; `.ps-tab.active` → gold accent, matching `.tab-btn.active{color:var(--accent)}`; `.feature-icon`/`.avatar.a2` → translucent `--green-bg` badge pattern). **Do not reintroduce a `--header` token or restore the brown palette** — this was the single largest and most deliberate decision in the rewrite.

### Verification

- Re-ran `node cli/bin/cli.js detect --json apps/web/public/index.html` from `/home/user/impeccable`: the `overused-font` finding is gone (as predicted — fonts now match the documented spec). New `dark-glow` finding appeared, but it's **not a regression** — `app.html` carries the identical `dark-glow` finding (confirmed by running the detector on both files side-by-side), because both pages now intentionally share the same gold-glow "industrial terminal" aesthetic defined in `BRAND_IDENTITY.md`. `em-dash-overuse`, `numbered-section-markers`, `aphoristic-cadence` findings are unchanged copy-voice items, untouched per scope.
- Confirmed 0 remaining `var(--header)` / `var(--border-dark)` / old-palette hex-rgba literals via grep sweep.
- Confirmed both JSON-LD `<script type="application/ld+json">` blocks present and untouched (2 blocks, byte count unchanged).
- No build/typecheck step applies — `index.html` is a static asset (`next.config.js:9` does a plain route rewrite). Verification is visual; recommend opening `index.html` and `app.html` side-by-side in a browser at 375/768/1280px to confirm they now read as one cohesive product.

### Next task

1. Visual spot-check in a real browser at mobile/tablet/desktop widths — confirm fonts render as Syne/IBM Plex Mono, no orphaned light-mode colors, glow/press states feel right, scanline doesn't fight the nav backdrop-filter or hero radial glows.
2. **Recommend updating `docs/BRAND_IDENTITY.md`** to document the dark "industrial terminal" system as the single canonical brand register — the spec currently still defines an unused light "Warm Parchment" token set that no longer matches either surface.
3. Push this work to the existing PR #45 branch (or open a new PR) once visually verified.

### Blockers

None.

---

## Session: 2026-06-08 (2) — Re-audit Confirmation (index.html + app.html)

### What changed this session

No code changes — re-ran the `impeccable` anti-pattern detector fresh on both `apps/web/public/index.html` (scanforprofit.com) and `apps/web/public/app.html` (scanforprofit.com/app.html) to confirm the P2/P3 fixes from the prior session (commit `a5c0f34`) landed cleanly and to capture the current baseline.

**Confirmed fixed (no longer flagged):**
- `side-tab` accent border on `.dash-cat-card` / `.inv-cat-card` — gone
- `bounce-easing` — all 4 animations (`modalIn`, `soldBurst`, `toastIn`, `scoreCount`) now use `cubic-bezier(0.16,1,0.3,1)`, confirmed in source at lines 656/746/754/817

**Findings remaining (identical to last session's list — all previously triaged as false positives or deferred brand/copy decisions, intentionally untouched):**

`index.html` (4 findings):
| Rule | Severity | Detail |
|---|---|---|
| `overused-font` | warning | line 24 — Plus Jakarta Sans |
| `em-dash-overuse` | warning | 6 em-dashes in body text |
| `numbered-section-markers` | advisory | sequence 01, 02, 03, 10, 12 |
| `aphoristic-cadence` | warning | 6 constructions, e.g. "Listed for 60 days. No offers." |

`app.html` (14 findings):
| Rule | Severity | Detail |
|---|---|---|
| `layout-transition` ×3 | warning | lines 604, 1684, 3824 — `transition: height/width` |
| `broken-image` ×8 | warning | lines 1039, 1114, 1235, 1675, 4025, 4522, 6734, 6739 — confirmed false positives (JS-populated `<img>` placeholders) |
| `em-dash-overuse` | warning | 19 em-dashes in body text |
| `dark-glow` | warning | line 172 — gold glow `rgb(212,168,67)` on dark bg, intentional brand aesthetic |

No new findings appeared. No action taken — re-run was confirmation only, per the prior session's "do not change anything that isn't explicitly in this session" decision.

### Next task

Same as prior session's open items: spot-check the re-eased animations/hover states on a real device, and revisit the deferred `dark-glow`/`em-dash-overuse`/`overused-font`/`numbered-section-markers`/`aphoristic-cadence`/`layout-transition` items only if a dedicated brand-voice or perf-profiling session is scheduled.

### Blockers

None.

---

## Session: 2026-06-08 — P2/P3 Audit Fixes (app.html)

### What changed this session

Continuation of the design-audit session below (P0/P1 already merged via PR #43). Re-ran the `impeccable` anti-pattern detector fresh on `index.html` and `app.html` and fixed the P2/P3 findings that were genuine, surgical, low-risk defects:

- **`apps/web/public/app.html`**:
  - **[P2] side-tab accent border** — removed the `border-left:2px solid var(--border)` accent stripe from `.dash-cat-card` (line 527) and `.inv-cat-card` (line 567), the most recognizable "AI-generated UI" tell per the anti-pattern rule. Changed the matching `:hover` rules from `border-left-color:var(--accent)` to `border-color:var(--accent)` so the hover state still highlights the whole card border instead of a now-removed stripe.
  - **[P3] bounce-easing** — replaced all 4 instances of the elastic/overshoot timing function `cubic-bezier(0.34,1.56,0.64,1)` (lines 656 `modalIn`, 746 `soldBurst`, 754 `toastIn`, 817 `scoreCount`) with the smooth exponential ease-out curve `cubic-bezier(0.16,1,0.3,1)` — the anti-pattern rule's own stated recommendation (no overshoot/wobble).

### Decisions made this session — findings investigated and deliberately NOT changed

- **`broken-image` ×8** (app.html lines 1039, 1114, 1235, 1675, 4025, 4522, 6734, 6739) — confirmed false positives: all are dynamically-populated `<img>` placeholders that JS sets `src` on at runtime, or detector matches inside JS string/comments mentioning `<img>`. Fixing would actively break the UX (showing broken-image icons before JS populates them).
- **`dark-glow`** (app.html line 172, gold glow `rgb(212,168,67)` on dark background) — intentional brand aesthetic (the gold-accent "industrial terminal" look defined in BRAND_IDENTITY.md). A redesign decision, not a defect — out of scope for "fix p2/p3" without a brand discussion.
- **`layout-transition` ×3** (app.html lines 604, 1684, 3824) — already identified as P1 and explicitly deferred in the prior session's HANDOFF entry (converting `transition: height/width` to `transform` risks breaking 4+ chart-rendering call sites for negligible real-world gain). Not re-opening per "do not change anything that isn't explicitly in this session."
- **`em-dash-overuse`** (app.html: 19 instances; index.html: 6 instances), **`overused-font`** (index.html line 24, Plus Jakarta Sans), **`numbered-section-markers`** (index.html sequence 01/02/03/10/12), **`aphoristic-cadence`** (index.html: 6 constructions like "Listed for 60 days. No offers.") — all copy-voice / brand / structural decisions requiring subjective judgment and broader consultation, not surgical defect fixes. Left untouched to honor "do not change anything that isn't explicitly in this session."

### Commits this session

| Hash | Message |
|---|---|
| `a5c0f34` | style: remove side-tab accent borders and bounce-easing from app.html |

### Next task

1. Visually spot-check `.dash-cat-card`/`.inv-cat-card` hover states and the 4 re-eased animations (modal open, sold-burst, toast, score count-up) on a real device/browser to confirm they read as smoother/cleaner with no regressions
2. If a brand/copy session is ever scheduled, the deferred findings above (`dark-glow`, `em-dash-overuse`, `overused-font`, `numbered-section-markers`, `aphoristic-cadence`) are the candidate list — each needs a deliberate brand-voice decision, not a mechanical fix
3. Revisit the deferred `layout-transition` → `transform` conversion as its own focused/profiled session if needed

### Blockers

None.

---

## Session: 2026-06-08 — Design Audit + P0/P1 Fixes (index.html + app.html)

### What changed this session

Ran a manual design audit (impeccable framework: a11y, performance, theming, responsive, anti-patterns) on `apps/web/public/index.html` and `apps/web/public/app.html`, then fixed every P0 and P1 finding:

- **`apps/web/public/app.html`**:
  - **[P0]** Removed `maximum-scale=1.0, user-scalable=no` from the viewport meta tag (line 31) — was blocking pinch-to-zoom, fails WCAG 1.4.4 (Resize Text)
  - **[P0]** Added `role="button" tabindex="0"` to all 27 interactive `<div>`/`<img>` elements that only had `onclick` handlers (mode tabs, dropzones, item thumbs, KPI/nav cards, status/category cards, photo dots, drill-down close, etc.), plus one delegated `keydown` listener (Enter/Space → `.click()`) near `window.onload` so all of them are keyboard- and screen-reader-operable — chosen over 27 individual `onkeydown` handlers per "surgical changes" rule
  - **[P0]** Added `aria-label` to the 15 `<input>` elements that relied on `placeholder` alone (auth/register fields, search boxes, cost/miles/sale-price inputs, reminder time)
  - **[P1]** Converted all 33 `<div class="card-title">` elements to semantic `<h3 class="card-title">` — app previously had only 2 real headings (`<h1>`, `<h2>`), breaking screen-reader navigation
  - **[P1]** Added one `@media (min-width: 600px)` rule centering `.app-header`/`.tab-bar` at `max-width: 540px` to match `.tab-panel`, so the app shell doesn't stretch edge-to-edge on tablet/desktop — first responsive breakpoint in the file (previously zero)
- **`apps/web/public/index.html`**:
  - **[P0]** Replaced the fabricated "**156%** avg ROI from testing" hero-trust claim (line 745) with honest copy ("Real eBay fee math, not guesswork") — this was the same fake metric already flagged as a pending task in an earlier HANDOFF entry

### Decisions made this session

- Used one global delegated `keydown` listener for keyboard activation of the 27 clickable divs/imgs instead of per-element handlers — minimizes surface area of the change (Karpathy Rule 3)
- Used `<h3>` (not `<h2>`) for card-title conversion — sits one level below both existing heading contexts (`<h1>` in Scout, `<h2>` in Settings) without creating hierarchy conflicts
- **Deferred** the P1 finding "layout-property transitions" (`transition: height`/`width` on `.bar-fill`, `#buy-conf-bar`, dash chart bars at app.html lines ~600, 1680/1687, 3820/3827) — converting to `transform`-based animation would require restructuring how each bar's size is computed/set across 4+ JS call sites (real risk of breaking chart rendering) for negligible real-world gain (small elements, infrequent triggers, not scroll/frame-linked). Left as-is; flagging for a future dedicated pass if desired.
- Did not touch the `156% ROI` / `$2,847` numbers that appear *inside* the hero phone-mockup illustrations (lines ~774, ~860, ~1123) — those are `aria-hidden` sample-UI screenshots showing what the app looks like, not factual marketing claims (unlike the hero-trust line, which asserted a real test result)

### Commits this session

| Hash | Message |
|---|---|
| `13cef1d` | fix: address P0/P1 audit findings on app.html and index.html |

### Next task

1. **Test on a real device/browser** — verify keyboard nav (Tab + Enter/Space) works on the 27 newly-focusable cards/tabs/dropzones, confirm the new `@media` breakpoint looks right at tablet/desktop widths, and confirm the `<h3>` card-title conversion didn't visually change anything (CSS class selector takes precedence over UA `<h3>` defaults, so it shouldn't have)
2. **Optional follow-up**: revisit the deferred `transition: height/width` → `transform` conversion as its own focused session if performance profiling shows it's actually causing jank
3. Continue with whatever was next on the existing PR #41 / scanner-verification track (this session's branch is `claude/scanforprofit-design-audit-5K3YG`, separate from `claude/serve-app-html`)

### Blockers

None.

---

## Session: 2026-06-06 — Camera Scanner Fix + Photo Scan Typed Endpoint

### What changed this session

- **`apps/web/public/app.html`** — replaced the broken FormData `/v1/messages-with-image` photo scanner with typed claude-proxy endpoints:
  - Added `imgFileToBase64Resized()`: resizes photo to 1568px max on canvas (JPEG 85% quality) before base64 encoding — avoids Anthropic's 5MB image limit, keeps memory bounded vs raw file
  - Added `callScan(type, hint)`: posts `{ type, imageBase64, hint }` JSON to `API_BASE`, handles scan-limit 429 + auth errors, returns structured server response
  - Updated `analyze()`: photo path now calls `callScan('single_scan')` → uses server-side business logic (tier gating, scan counting, BUY/HOT/PASS decision engine, scan_log writes, user settings); text-only path unchanged (still uses `callClaude()`)
  - Updated `analyzeShelf()`: uses `callScan('shelf_scan')`, maps camelCase server response to snake_case `renderShelf()` format

### Decisions made this session

- Photo scan goes through typed endpoint (`single_scan`/`shelf_scan`) — this is the intended architecture from HANDOFF.md Phase 4 design
- Image resized to 1568px on client before sending (canvas + FileReader approach) — acceptable memory trade-off vs the old FormData server-resize approach
- Text-only `analyze()` still uses `callClaude()` → legacy `/v1/messages` path (no image involved, legacy path works fine for this case)
- `invFormDetectItem()` (inventory photo detect) left unchanged — separate feature, will migrate in a future session if needed

### Commits this session

| Hash | Message |
|---|---|
| `50850eb` | feat: replace FormData photo scanner with typed claude-proxy endpoints |

### PR

- PR #41 open: `claude/serve-app-html` → `main`
- Vercel preview deployed: `scanforprofit-git-claude-serv-4bf63a-scan-for-profit-s-projects.vercel.app`

### Next task

1. **Test the scanner on a real device** — take a photo in Scout tab, confirm BUY/HOT/PASS result renders
2. **Fix `invFormDetectItem()`** — also uses legacy FormData path (`/v1/messages-with-image`); migrate to typed endpoint when user confirms scanner is working
3. **Add RESEND_API_KEY to Supabase secrets** — verification emails currently not sending for new signups
4. **Merge PR #41** once scanner is verified working

---

## Session: 2026-06-03 — Phase 4 Step 8: EAS Build + TestFlight

### What changed this session

- **`apps/mobile/eas.json`** — added `ios.buildType=app-store` + `ios.distribution=store` to `production` build profile; added `submit.production.ios.testFlightEnabled=true`
- **`apps/mobile/app.json`** — added `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` to `ios.infoPlist` (required for App Store review); bumped android `versionCode` to 4

### Decisions made this session

- `production` build profile explicitly sets `ios.buildType=app-store` + `distribution=store` (EAS default was ambiguous)
- Privacy usage strings added before build (App Store review requires these for camera/photo library usage)
- Node.js is not in PowerShell PATH — `eas build` must be run from user's own terminal

### Build steps to run manually (open terminal where `node` is available)

```bash
cd C:\Users\bbake\OneDrive\Desktop\scanforprofit\apps\mobile

# 1. Verify auth
eas whoami

# 2. Build for App Store / TestFlight
eas build --platform ios --profile production

# 3. Submit to TestFlight (after build completes ~10-15 min)
eas submit --platform ios --latest

# 4. In App Store Connect → TestFlight: add internal testers
```

### Commits this session

| Hash | Message |
|---|---|
| `05f8a2f` | chore: Phase 4 Step 8 -- EAS build config + iOS privacy keys |

### tsc result

Node.js not in PowerShell PATH — could not run `tsc --noEmit`. No code changes this session.

### What's pending (user must do)

1. `git push origin main` (push blocked by auto-mode classifier — run manually)
2. Run `eas build --platform ios --profile production` in a terminal where Node is available
3. Run `eas submit --platform ios --latest` after build finishes
4. Add internal testers in App Store Connect → TestFlight

### Next task

**Phase 5 — Web App Build** (landing page React scaffold, pricing page, Vercel deploy)

---

## Session: 2026-06-03 — Phase 4 Step 7: Settings Screen

### What changed this session

- **`packages/shared/src/types/index.ts`** — added `SettingsInput` (mutable subset of `UserSettings`, 9 fields)
- **`supabase/functions/claude-proxy/index.ts`** — added `handleSettingsGet` and `handleSettingsUpdate` handlers; routing for `settings_get` and `settings_update`. Scout tier blocked from update (returns 403). Server-side validation for all 9 fields. Deployed as version 8.
- **`apps/mobile/lib/settings.ts`** — created: `fetchSettings()`, `saveSettings()`, `resetToDefaults()`, `DEFAULT_SETTINGS_INPUT`
- **`apps/mobile/components/ui/SettingsForm.tsx`** — created: form with internal string state, client-side validation per field, Pricing / Inventory Rules / Preferences groups, Reset to Defaults button
- **`apps/mobile/app/(tabs)/settings.tsx`** — created: Scout shows read-only preview + PaywallModal offer; Hustle+ sees full editor with save/reset/cancel
- **`apps/mobile/app/(tabs)/_layout.tsx`** — added hidden `settings` Tabs.Screen entry (`href: null` — 5-tab rule preserved)
- **`apps/mobile/app/(tabs)/stats.tsx`** — added gear icon in header (`router.push('/(tabs)/settings')`) to navigate to settings

### Decisions made this session (do not reverse)

- `sourcingStyle` uses existing `'conservative'|'balanced'|'aggressive'` — NOT spec's `'thrift'|'estate'|'retail'|'online'` (proxy/DB already use conservative/balanced/aggressive)
- `shipping` uses existing `'buyer'|'seller'` — NOT spec's `'standard'|'expedited'|'local'` (P&L logic depends on buyer/seller distinction)
- Settings screen is hidden from tab bar (5-tab constraint); accessed via gear icon on Stats header
- SettingsForm uses internal string state for text inputs, parses to numbers only on Save

### Commits this session

| Hash | Message |
|---|---|
| `6b5be8a` | feat: Phase 4 Step 7 -- Settings screen, tier gate, proxy handlers |

### tsc result

Node.js not installed at `C:\Program Files\nodejs\` (PATH entry exists but dir missing) — could not run `tsc --noEmit`. All types reviewed manually; no known issues.

### Next task

**Phase 4 Step 8 — EAS Build + TestFlight**

---

## Session: 2026-06-02 — Full Repo Audit (all 18 branches)

### What was audited

Full audit of the entire GitHub repo across all 18 branches: branch history, edge function code, mobile screens, migrations, web app, and shared packages. No code was changed — audit only.

### Branch cleanup needed

12 of 18 branches are stale Flippd-era dead code and should be deleted:

| Branch | Reason to delete |
|---|---|
| `claude/admin-tier-management-X5Q2i` | Old single-file Flippd HTML work |
| `claude/audit-run-errors-6RmCv` | Old Flippd fixes |
| `claude/brave-brahmagupta-ff7NM` | Old Flippd work |
| `claude/deploy-edge-functions-kHcBm` | Empty |
| `claude/fix-flippd-bugs-nRawD` | Old Flippd eBay API work |
| `claude/gifted-clarke-uPkI6` | Already merged (#32) |
| `claude/new-session-YbaGj` | Already merged |
| `claude/new-session-YbaGj-security-fix` | Already merged |
| `claude/new-session-xpGlD` | Empty |
| `claude/remote-session-setup-MRbJ8` | Old Flippd UI work |
| `claude/update-css-tokens-Fm9lv` | Old Flippd CSS |
| `claude/vibrant-thompson-kGeJA` | Empty |
| `cloudflare/workers-autoconfig` | Cloudflare Worker for old Flippd proxy |
| `railway/fix-deploy-3056c1` | Empty |
| `v0/scanforprofit-56a77671` | v0 scaffold, superseded |
| `vercel/install-vercel-speed-insights-qjw27a` | Auto-created by Vercel, stale |

`pr/phase-4-build` is behind main (main has Steps 4–6 that phase-4 doesn't). The PR should be **closed without merging** — main is already ahead.

### Bugs confirmed (must fix before launch)

**🔴 BUG 1 — JWT_SECRET is a fallback `dev-secret-replace-in-production` string**
- `supabase/functions/claude-proxy/index.ts:993` — falls back to `'dev-secret-replace-in-production'` if `JWT_SECRET` env var is not set
- Mobile uses Supabase Auth JWTs; the `JWT_SECRET` env var must be set to the **Supabase JWT Secret** (Supabase dashboard → Project Settings → API → JWT Secret)
- If not set, the proxy verifies tokens against the wrong secret and all API calls fail in production
- Fix: `supabase secrets set JWT_SECRET="<paste from Supabase dashboard>" --project-ref dqgfpchkheznvanfgsmx`

**🔴 BUG 2 — DB column `min_roi` vs code `target_roi` — breaks ROI calculation for real users**
- Migration `20260529010000_initial_schema.sql:77` creates column `min_roi` in `settings` table
- `claude-proxy/index.ts` reads `s.target_roi` everywhere (lines 47, 123, 190, 839)
- `DEFAULT_SETTINGS` has `target_roi: 200` so new users (no settings row yet) work fine
- Users who exist in the `settings` table get `target_roi = undefined` → HOT/FLIP/PASS decisions break silently
- Fix: add migration to rename column: `ALTER TABLE public.settings RENAME COLUMN min_roi TO target_roi;`

**🟠 BUG 3 — `handleBuyItem` has no tier gate**
- `inventory_create` (line 326) correctly checks `ITEM_LIMITS` before inserting
- `buy_item` handler (line 269) inserts directly with no limit check
- Scout users can bypass the 10-item inventory cap by using Scout tab → "Buy It" instead of Inventory tab → "Add Item"
- Fix: add the same tier gate from `handleInventoryCreate` to `handleBuyItem` (pass `tier` parameter)

**🟡 BUG 4 — `.env.example` is stale Flippd-era content**
- Still references `PROXY_URL`, `GA4_MEASUREMENT_ID`, `MAILCHIMP_*` — none used in this repo
- Missing: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`
- Fix: rewrite `.env.example` to match actual monorepo vars

**🟡 BUG 5 — PostHog key placeholder on live landing page**
- `apps/web/public/index.html` still has `__POSTHOG_KEY__` literal string
- Per HANDOFF note from 2026-06-01 session: user must replace manually
- Analytics are silently not firing on scanforprofit.com

### What's confirmed working on main

- All 6 Phase 4 steps complete (auth → scout → inventory → listing → trends → stats)
- Stripe checkout Edge Function deployed
- P&L math in `packages/shared/src/utils/calcPnl.ts`
- Schema migrations applied to production project `dqgfpchkheznvanfgsmx`
- Landing page live at scanforprofit.com with waitlist capture
- Edge Functions deployed (claude-proxy v6, stripe-webhook, stripe-checkout, auth)

### Bugs fixed this session (all resolved as of 2026-06-02)

| Bug | Fix applied |
|---|---|
| JWT_SECRET fallback to dev string | Set in Supabase Dashboard → Project Settings → Functions → Secrets |
| `min_roi` vs `target_roi` column mismatch | Migration `004_rename_min_roi_to_target_roi` applied to production |
| `handleBuyItem` missing tier gate | Fixed in claude-proxy, redeployed (v6) |
| `.env.example` stale Flippd vars | Rewritten to match actual monorepo vars |
| PostHog key placeholder | Was already a real key — no action needed |

### What's NOT done (pre-launch remaining)

1. **Run `git push origin main`** (blocked by auto-mode classifier — run manually)
2. **Run `eas build --platform ios --profile production`** in a terminal where Node.js is available
3. **Run `eas submit --platform ios --latest`** after build finishes
4. Add internal testers in App Store Connect → TestFlight
5. Set remaining Supabase secrets if not already set: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
6. Register Stripe webhook endpoint in Stripe Dashboard
7. **Phase 5 — Web App Build** (next development phase)

---

## Project Location

`C:\Users\bbake\OneDrive\Desktop\scanforprofit`

## Repo

github.com/bbaker71313/scanforprofit

---

## Phase 4 Status (mobile app build) — last updated 2026-06-02

| Step | Feature | Status | Commit |
|---|---|---|---|
| Step 1 | Auth flow (register, login, verify OTP) | DONE | `5ca1e51` |
| Step 2 | Scout tab (camera, AI scan, FLIP/PASS/HOT, Buy modal) | DONE | `a34dece` |
| Step 2.5 | Protected route guard (auth gate in root layout) | DONE | `a6360d2` |
| Step 3 | Inventory tab (CRUD, photos, status lifecycle, tier gate) | DONE | `2f69ee8` |
| Step 4 | Listing tab (AI generator, CSV export, trending keywords) | DONE | `3b589b5` |
| Step 5 | Trends tab (Growth Agent, hunt list, business score) | DONE | `27e1912` |
| Step 6 | Stats tab (P&L dashboard, expenses, Stripe paywall) | DONE | `846c65a` |
| Step 7 | Settings screen | DONE | `6b5be8a` |
| Step 8 | EAS build + TestFlight | DONE (config) — **run build manually** | `05f8a2f` |

### Current next task
**Phase 5 — Web App Build**
- Rebuild landing page from static HTML → React components
- Create pricing page, product pages, docs
- Set up PostHog + Google Analytics on web
- Deploy to Vercel (remove `ignoreCommand` from `apps/web/vercel.json`)

### Key standing decisions (apply every session)
- All inventory/listing DB ops route through `claude-proxy` Edge Function (service role bypasses `app.user_id` RLS)
- Auth is Supabase Auth JWT — proxy bridges UUID to custom `users` integer ID by email lookup (lazy creates user row)
- NativeWind only — no StyleSheet.create() anywhere
- ebayFee always from `settings` table — never hardcoded
- AI prompts always verbatim from FEATURE_TRIAGE.md — do not rewrite
- Model: `claude-sonnet-4-6` — do not change

### Supabase project
- Project ID: `dqgfpchkheznvanfgsmx`
- URL: `https://dqgfpchkheznvanfgsmx.supabase.co`
- Edge Function `claude-proxy`: deployed, version 6 (+ stats_summary, expenses_list, expenses_add handlers)
- Edge Function `stripe-checkout`: deployed (new in Step 6)
- Storage bucket `item-photos`: created, public, 5MB limit

### tsc status
`npx tsc --noEmit` — 0 errors as of last session

---

## Session: 2026-06-02 — Items 6–8: Form → n8n, Dead Links, Schema Markup

### What changed this session

- **`apps/web/components/landing/EmailCapture.tsx`** — rewired form from `/api/waitlist` to `NEXT_PUBLIC_N8N_EARLY_ACCESS_WEBHOOK_URL`; added `source: 'landing-page-hero'`; updated success copy ("You're in — check your inbox for next steps.") and error copy (includes contact email); clears input on success
- **`apps/web/app/page.tsx`** — removed `/privacy` and `/terms` dead `<a>` links (now plain `<span>`); injected two `<script type="application/ld+json">` blocks (SoftwareApplication + FAQPage schemas) via `dangerouslySetInnerHTML`
- **`apps/web/lib/schema.ts`** — created: exports `softwareAppSchema` and `faqSchema` as const objects (kept out of page.tsx to stay under 500-line limit)
- **`.env.example`** — added `NEXT_PUBLIC_N8N_EARLY_ACCESS_WEBHOOK_URL=` placeholder

### Decisions made this session (do not reverse)

- Env var is `NEXT_PUBLIC_N8N_EARLY_ACCESS_WEBHOOK_URL` (NOT `NEXT_PUBLIC_N8N_WEBHOOK_URL`) — separate from the Stripe subscription webhook
- n8n workflow `iB0bhOJ2Y2gREciM` (`sfp-new-user-welcome`) is for Stripe events only — do NOT point early access form at it
- Actual early access webhook URL must be set in Vercel env vars before going live
- `dangerouslySetInnerHTML` used only for JSON-LD schema — no other usage

### Commits this session

_(no commit yet — run `git add -A && git commit -m "feat: wire form to n8n, fix dead links, add schema markup"` then push)_

### tsc result

`npx tsc --noEmit` — **0 errors**

### Next task

**Items 4–5** — Remove fake metrics (`2,847 scans`, `156% avg ROI`) and replace fabricated testimonials in `SocialProofSection.tsx` with honest placeholder copy.

---

## Session: 2026-06-02 — Web SEO + Form Backend + Schema Markup

### What changed this session

- **`apps/web/public/robots.txt`** — created: allows all crawlers, references sitemap
- **`apps/web/app/sitemap.ts`** — created: Next.js App Router sitemap generator, homepage URL only
- **`apps/web/app/layout.tsx`** — added `metadataBase: new URL('https://www.scanforprofit.com')`
- **`apps/web/lib/schema.ts`** — created: `softwareAppSchema` (SoftwareApplication) + `faqSchema` (FAQPage) JSON-LD objects
- **`apps/web/app/page.tsx`** — added two `<script type="application/ld+json">` blocks using schema imports
- **`apps/web/components/landing/EmailCapture.tsx`** — fixed env var name: `NEXT_PUBLIC_N8N_WEBHOOK_URL` → `NEXT_PUBLIC_N8N_EARLY_ACCESS_WEBHOOK_URL`
- **`.env.example`** — added `NEXT_PUBLIC_N8N_EARLY_ACCESS_WEBHOOK_URL=` placeholder
- **`supabase/migrations/003_add_waitlist_source.sql`** — added `source text` column to `waitlist` table (also applied live)
- **n8n workflow `SFP — Early Access Capture` (ID: `mYoprIglOdv2b7nb`)** — created and active: Webhook POST → Supabase native node (inserts email+source, ignores duplicates) → HTTP Request to Resend (welcome email). Uses `Supabase account` credential for DB insert.

### Decisions made this session (do not reverse)

- Early access form uses `NEXT_PUBLIC_N8N_EARLY_ACCESS_WEBHOOK_URL` (not the old `NEXT_PUBLIC_N8N_WEBHOOK_URL`)
- n8n Supabase insert uses the native Supabase node (not HTTP Request) — avoids `$env` access restriction on n8n Cloud
- Duplicate emails silently ignored via `resolution=ignore-duplicates`
- `source` field distinguishes hero vs footer submissions
- Webhook URL must be set in Vercel env vars (`NEXT_PUBLIC_N8N_EARLY_ACCESS_WEBHOOK_URL=https://scanforprofit.app.n8n.cloud/webhook/sfp-early-access-capture`)

### Commits this session

| Hash | Message |
|---|---|
| `314e861` | chore: add robots.txt and sitemap, fix indexation blockers |
| `4f15348` | feat: wire early access form, fix dead links, add schema markup |

### tsc result

`npx tsc --noEmit` — **0 errors**

### Next task

**Items 4–5** — Remove fake metrics (`2,847 scans`, `156% avg ROI`) and replace fabricated testimonials (`@flippin_marcus`, `@thatvintageguy`, `@thriftqueenATL`) in `apps/web/app/page.tsx` components with honest placeholder copy.

---

## Session: 2026-06-02 — Rebuild HANDOFF.md (corrupted file recovery)

### What changed this session

- **`docs/HANDOFF.md`** — file was corrupted (1.9MB of interleaved repeated content). Rebuilt from clean git history (base: `b48010d`) plus sessions from `89c6970` (Step 5) and `846c65a` (Step 6). File is now ~12KB and readable.

### Commits this session

_(docs-only fix, no code changed)_

---

## Session: 2026-06-01 — Phase 4 Step 6: Stats Tab + P&L + Stripe Paywall

### What changed this session

- **`apps/mobile/app/(tabs)/stats.tsx`** — full replacement (333 lines): period selector (7d/30d/90d/YTD/ALL), P&L summary cards (revenue, COGS, net profit, ROI, sold count, avg sell price), expenses list (FlatList), add-expense modal, Stripe upgrade paywall for Hustle+ features. Scout tier sees summary only; Hustle+ sees full expense tracking.
- **`apps/mobile/components/ui/PaywallModal.tsx`** — new: reusable paywall modal with tier comparison and Stripe checkout link.
- **`apps/mobile/components/ui/index.ts`** — added `PaywallModal` export.
- **`apps/mobile/lib/stats.ts`** — new: `fetchStatsSummary(period)`, `fetchExpenses()`, `addExpense(data)`. All routed through claude-proxy.
- **`packages/shared/src/types/index.ts`** — added `PnlSummary`, `PnlExpense`, `ExpensePeriod`.
- **`packages/shared/src/utils/calcPnl.ts`** — new: `calcPnlSummary(items, expenses, period)` pure function. Single source of truth for P&L math.
- **`packages/shared/src/index.ts`** — export `calcPnl` utils.
- **`supabase/functions/claude-proxy/index.ts`** — added `stats_summary`, `expenses_list`, `expenses_add` (Scout blocked from expenses). Deployed as version 6.
- **`supabase/functions/stripe-checkout/index.ts`** — new Edge Function: creates Stripe checkout session for Hustle/Stack/Empire plans. Returns `url` for `Linking.openURL`.

### Decisions made this session (do not reverse)

- P&L math lives in `packages/shared/src/utils/calcPnl.ts` — not in the proxy or UI
- Scout tier: P&L summary visible; expense tracking gated (PaywallModal shown on add attempt)
- Stripe checkout opens in system browser via `Linking.openURL` — no in-app WebView
- `stripe-checkout` function uses STRIPE_SECRET_KEY from Supabase secrets (already set)
- Expense categories: Supplies, Shipping, Mileage, Storage, Fees, Other

### Commits this session

| Hash | Message |
|---|---|
| `846c65a` | feat: Phase 4 Step 6 -- Stats tab, P&L calculator, Stripe paywall |

### tsc result

`npx tsc --noEmit` — **0 errors**

### Next task

**Phase 4 Step 7** — Settings screen

---

## Session: 2026-06-01 — Vercel Builds Paused

### What changed this session

- **`apps/web/vercel.json`** — created with `{"ignoreCommand":"exit 1"}`. Tells Vercel to skip all builds until Phase 5 web scaffold is ready. Re-enable in Phase 5 by deleting this file or changing `ignoreCommand`.

### Commits this session

| Hash | Message |
|---|---|
| `8202588` | chore: disable Vercel builds until Phase 5 web scaffold |

---

## Session: 2026-05-31 (7) — Phase 4 Step 5: Trends Tab

### What changed this session

- **`apps/mobile/app/(tabs)/trends.tsx`** — full replacement: 5-state machine (loading/empty/generating/ready/error). Empty state at <5 items. Ready state: 7 sections — Business Score card, top categories (Scout gated), stale actions (Scout gated), hunt list (visible to Scout), market trends (Scout gated), advisor message (Scout gated), footer with refresh button.
- **`apps/mobile/lib/growth.ts`** — new: `fetchGrowthReport(forceRefresh?)` wraps `growth_report` proxy call.
- **`packages/shared/src/types/index.ts`** — added `GrowthReport`: `business_score`, `score_label`, `score_color`, `score_summary`, `top_categories[]`, `stale_actions[]`, `hunt_list[]`, `market_trends[]`, `advisor_message`, `generatedAt`, `item_count`.
- **`supabase/functions/claude-proxy/index.ts`** — added `growth_report` handler: checks `growth_cache.cache_data.growth_report` freshness (<24hrs); calls verbatim F-27 prompt; upserts to growth_cache. Static fallback on AI failure. Deployed as version 5.

### Decisions made this session (do not reverse)

- Growth report stored at `growth_cache.cache_data.growth_report` sub-key (same pattern as `trending_keywords` — no schema change needed)
- Empty state at <5 total inventory items, checked before cache lookup
- Scout tier: business score + hunt_list visible; all other sections gated with upgrade prompt
- AI failure returns static fallback — never surfaces as an error to the user
- `forceRefresh=true` bypasses cache; if result is still cached, shows toast instead of re-calling AI

### Commits this session

| Hash | Message |
|---|---|
| `27e1912` | feat: trends tab — growth agent, weekly brief, 24h cache |

### tsc result

`npx tsc --noEmit` — **0 errors**

---

## Session: 2026-05-31 (6) — Phase 4 Step 4: Listing Tab

### What changed this session

- **`apps/mobile/app/(tabs)/listing.tsx`** — full replacement: 3-screen flow (picker → generating → draft). Picker shows Unlisted + Listed only (not Sold). Draft screen: editable title (80-char counter + hard cap), description/condition/price, keyword chips, trending chips, "COPY TO CLIPBOARD" per field, "EXPORT TO EBAY CSV" (Scout = upgrade alert, Hustle+ = share sheet), "MARK AS LISTED" button.
- **`apps/mobile/lib/listing.ts`** — new: `generateListing`, `fetchKeywords`, `markAsListed`, `exportCsv`. CSV: eBay standard columns + `Version=0.0.2` header. File via `expo-file-system` v56 `new File(Paths.cache, name)` + `expo-sharing`.
- **`packages/shared/src/types/index.ts`** — added `ListingDraft`, `TrendingKeyword`, `TrendingKeywordsResult`.
- **`supabase/functions/claude-proxy/index.ts`** — added `listing_generate` (verbatim F-29 prompt, title ≤80 enforced) and `keywords_get` (growth_cache check <24hrs → AI with `web_search_20250305` tool → static fallback). Deployed as version 4.

### Decisions made this session (do not reverse)

- AI prompt verbatim from FEATURE_TRIAGE F-29 — not rewritten
- Trending keywords stored in `growth_cache.cache_data.trending_keywords` sub-key
- expo-file-system v56 new API: `new File(Paths.cache, name)` — NOT `writeAsStringAsync`
- CSV export blocked for Scout tier; Hustle+ gets native share sheet
- Listing does NOT auto-mark as Listed

### Commits this session

| Hash | Message |
|---|---|
| `3b589b5` | feat: listing tab — AI generator, CSV export, trending keywords |

---

## Session: 2026-06-01 (2) — PR + gh CLI Setup

### What changed this session

- **`gh` CLI** — installed via `winget install --id GitHub.cli`
- **PR #20** — https://github.com/bbaker71313/scanforprofit/pull/20 documenting Phase 4 work
- **PAT rotated** — token used was revoked immediately after use

---

## Session: 2026-05-31 (5) — Phase 4 Step 3: Inventory Tab

### What changed this session

- **`apps/mobile/app/(tabs)/inventory.tsx`** — full replacement: FlatList + search + status filter pills (ALL/UNLISTED/LISTED/SOLD), FAB (ADD ITEM), Add/Edit BottomSheet with live profit preview, detail Modal, delete confirm, sold-price modal, category/condition picker modals. Tier gate checked before opening Add sheet.
- **`apps/mobile/lib/inventory.ts`** — new: `fetchInventory`, `createItem`, `updateItem`, `deleteItem`, `changeStatus`. All routed through claude-proxy.
- **`apps/mobile/lib/storage.ts`** — new: `pickAndCompressPhoto` (JPEG 80%), `uploadItemPhoto` (Supabase Storage `item-photos/{userId}/{itemId}/{filename}`).
- **`packages/shared/src/utils/createInventoryItem.ts`** — new: `buildInventoryPayload`, `skuPrefix`.
- **`packages/shared/src/constants/categories.ts`** — added `CATEGORY_SKU_PREFIX` map (21 eBay categories → 4-char code).
- **`supabase/functions/claude-proxy/index.ts`** — added `inventory_list`, `inventory_create` (tier gate + SKU), `inventory_update`, `inventory_delete`, `inventory_status`. Deployed as version 3.
- **Supabase Storage** — `item-photos` bucket created (public, 5MB limit, JPEG/PNG/WebP).

### Decisions made this session (do not reverse)

- All inventory DB ops go through claude-proxy (service role bypasses `app.user_id` RLS)
- Photos uploaded directly via Supabase Auth session (Storage has its own auth)
- SKU generation is server-side — proxy generates, shared util returns prefix only
- Detail view is a full-screen Modal within inventory.tsx (no new route created)

### Commits this session

| Hash | Message |
|---|---|
| `2f69ee8` | feat: inventory tab — CRUD, photo picker, item card, proxy reads |

---

## Session: 2026-06-01 — Landing Page Fixes

### What changed this session

- **`apps/web/public/index.html`** — converted both `<form>` tags to `<div>`, added PostHog snippet, hidden `#social-proof` section.

### Commits this session

| Hash | Message |
|---|---|
| `a39980d` | fix: landing page — remove form tags, PostHog analytics, hide placeholder social proof |

---

## Session: 2026-05-31 (4) — Landing Page + Waitlist

### What changed this session

- **`apps/web/public/index.html`** — static landing page (1438 lines, self-contained)
- **`apps/web/next.config.js`** — `beforeFiles` rewrite `/ → /index.html`
- **`apps/web/app/api/waitlist/route.ts`** — POST endpoint, inserts to `waitlist` table via service role

### Commits this session

| Hash | Message |
|---|---|
| `68682c5` | feat: serve static landing page at scanforprofit.com root |
| `aed53d5` | feat: wire email capture to Supabase waitlist table |

---

## Session: 2026-05-31 (3) — Phase 4 Step 2.5: Protected Route Guard

### What changed this session

- **`apps/mobile/app/_layout.tsx`** — auth gate: `getSession()` on mount, `onAuthStateChange`, `#1c1712` loading screen, `<Redirect>` to login/scout.

### Commits this session

| Hash | Message |
|---|---|
| `a6360d2` | feat: protected route guard — auth gate in root layout |

---

## Session: 2026-05-31 (2) — Phase 4 Step 2: Scout Tab

### What changed this session

- **`apps/mobile/lib/camera.ts`** — `takePicture(ref)` utility
- **`apps/mobile/app/(tabs)/scout.tsx`** — full implementation: full-screen CameraView, SINGLE ITEM / SHELF SCAN toggle, capture, Analyzing overlay, ScanResult, ShelfItemRow, Buy modal
- **`supabase/functions/claude-proxy/index.ts`** — major rewrite: `getOrCreateUser()`, `handleSingleScan()`, `handleShelfScan()`, `handleBuyItem()`. Deployed as version 2.

### Decisions made this session (do not reverse)

- Proxy bridges Supabase Auth UUID → custom users integer ID by email lookup (lazy create)
- register.tsx does NOT insert into users table
- Estimated thrift cost = `avgSoldPrice * 0.10` — user overrides in Buy modal
- AI prompts verbatim from FEATURE_TRIAGE.md P-03 and P-04

### Commits this session

| Hash | Message |
|---|---|
| `a34dece` | feat: scout tab — camera, AI scan, FLIP/PASS/HOT result |

---

## Session: 2026-05-31 — Phase 4 Step 1: Auth Flow

### What changed this session

- **`apps/mobile/app/(auth)/register.tsx`**, **`login.tsx`**, **`verify.tsx`** — full implementations
- **`apps/mobile/lib/auth.ts`** — added `verifyOtp` + `OtpCredentials` type

### Decisions made this session (do not reverse)

- Verify screen receives `email` as route param — no global state
- OTP type is `'email'` — email verification, not SMS
- NativeWind only, no `<form>` tags

### Commits this session

| Hash | Message |
|---|---|
| `5ca1e51` | feat: auth flow — register, login, verify screens |

---

## Session: 2026-05-29 — Deploy Edge Functions + Base Schema

### Function URLs (LIVE)

| Function | URL |
|---|---|
| `auth` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/auth` |
| `claude-proxy` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/claude-proxy` |
| `stripe-webhook` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/stripe-webhook` |
| `stripe-checkout` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/stripe-checkout` |

Anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ2ZwY2hraGV6bnZhbmZnc214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjE5MjQsImV4cCI6MjA5MzEzNzkyNH0.mAViqTT9u5_iXikax9ZOr9b2i9UzecrGiY9kLI-Egdo`

---

## Session: 2026-05-27 — Initial Setup

| Hash | Message |
|---|---|
| `c6d2000` | chore: initial commit |

---

## Standing Instructions (apply every session)

- Karpathy guidelines: surgical changes only. Do not add features. Do not refactor.
- Never hardcode eBay fee percent — always read from `settings.ebayFeePercent`.
- Auth is email/password only (no magic link).
- 5 mobile tabs only: Scout, Inventory, Listing, Trends, Stats.
- Supabase Edge Functions replace the old Replit backend entirely.
- Update this file at the end of every session.

---

## Supabase

- **Project ID: `dqgfpchkheznvanfgsmx`** (ScanForProfit, ACTIVE_HEALTHY)
- **Project URL:** `https://dqgfpchkheznvanfgsmx.supabase.co`
- **Anon key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ2ZwY2hraGV6bnZhbmZnc214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjE5MjQsImV4cCI6MjA5MzEzNzkyNH0.mAViqTT9u5_iXikax9ZOr9b2i9UzecrGiY9kLI-Egdo`
- Auth: Supabase Auth JWT (email/password + OTP verification)

## Stripe (livemode)

| Plan | Product ID | Monthly Price ID | Annual Price ID |
|---|---|---|---|
| SFP Hustle | `prod_UaFBtgUANzpzCh` | `price_1Tb4hLId3kJSEdqMH7SYN3a8` ($19/mo) | `price_1Tb4hOId3kJSEdqMiMUrnFm2` ($180/yr) |
| SFP Stack | `prod_UaFBJA9wZ0he0J` | `price_1Tb4hRId3kJSEdqMq9XwGKbZ` ($49/mo) | `price_1Tb4hTId3kJSEdqMB21L5giT` ($480/yr) |
| SFP Empire | `prod_UaFB8CpVCfDjWp` | `price_1Tb4hWId3kJSEdqMFrtyqDkK` ($199/mo) | _(none)_ |
