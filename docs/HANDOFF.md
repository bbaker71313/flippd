# ScanForProfit — Session Handoff

This file is the persistent session context. Update it at the end of every Claude Code session with what changed.

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
| Step 7 | Settings screen | TODO | - |
| Step 8 | EAS build + TestFlight | TODO | - |

### Current next task
**Phase 4 Step 7 — Settings Screen**
- User-configurable fields: ebayFee, pkgCost, shipCost, minProfit, targetRoi, maxDays, minStr, sourcingStyle, shipping
- Read from `settings` table via `claude-proxy`; save updates back
- All values must flow through settings — never hardcode any of these

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
