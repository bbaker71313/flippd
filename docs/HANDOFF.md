# ScanForProfit — Session Handoff

This file is the persistent session context. Update it at the end of every Claude Code session with what changed.

---

## Project Location

`/home/user/scanforprofit` (remote Claude Code session)
Local path: `C:\Users\bbake\OneDrive\Desktop\scanforprofit`

## Repo

github.com/bbaker71313/scanforprofit — branch: `main`

---

## Current Build Status (as of 2026-06-01)

| Phase | Name | Status |
|---|---|---|
| 01 | Validate | ✅ Complete |
| 02 | Brand & Architecture | ✅ Complete |
| 03 | Design System | ✅ Complete (Steps 1–3) |
| 04 | Build Mobile | 🔄 Steps 1–6 complete — **Step 7 next** |
| 05 | Build Web | ⬜ Not started (Vercel builds paused) |
| 06 | Launch | ⬜ Not started |
| 07–09 | Monetize / Marketing / Scale | ⬜ Not started |

### Phase 4 Step Progress

| Step | Task | Status | Commit |
|---|---|---|---|
| 1 | Auth Flow (register, login, verify screens) | ✅ Done | `2ae300f` |
| 2 | Protected Route Guard (root layout auth gate) | ✅ Done | `a6360d2` |
| 3 | Scout Tab (camera, AI scan, FLIP/PASS/HOT) | ✅ Done | `a34dece` |
| 4 | Inventory Tab (CRUD, photo picker, proxy ops) | ✅ Done | `2f69ee8` |
| 5 | Listing Tab (AI listing generator, CSV export) | ✅ Done | `3b589b5` |
| 6 | Trends Tab (Growth Agent, 24h cache) | ✅ Done | `27e1912` |
| 7 | Stats Tab (P&L, expenses, mileage, Stripe gate) | ✅ Done | `846c65a` |
| **8** | **EAS Build + End-to-End Integration Test** | **⬜ NEXT** | — |

---

## Next Task — Phase 4 Step 8: EAS Build + Integration Test

### Goal
Produce a working development build via EAS and test all 5 tabs end-to-end on a real device or simulator.

### Success Criteria
1. `eas build --platform ios --profile development` completes without error
2. App installs and launches on device/simulator
3. Auth flow works: register → email verify → login
4. Scout tab: camera opens, AI scan returns a BUY/HOT/PASS result
5. Inventory tab: add item → appears in list → edit → delete
6. Listing tab: select item → generate listing → copy fields
7. Trends tab: Growth Agent brief loads (or shows tier gate)
8. Stats tab: P&L summary displays, expense add works

### Files to check if build fails
- `apps/mobile/app.json` — EAS project ID: `cc487254-9654-4930-ac52-37ffba835a20`
- `apps/mobile/eas.json` — build profiles
- `apps/mobile/package.json` — all native deps present
- `.env` / Supabase env vars — must be set in EAS secrets

---

## Complete File Inventory (Phase 4 — all built)

### Mobile App (`apps/mobile/`)

| File | Purpose |
|---|---|
| `app/(auth)/_layout.tsx` | Auth group layout |
| `app/(auth)/register.tsx` | Registration screen |
| `app/(auth)/login.tsx` | Login screen |
| `app/(auth)/verify.tsx` | Email verification screen |
| `app/_layout.tsx` | Root layout with auth gate |
| `app/(tabs)/_layout.tsx` | 5-tab bar layout |
| `app/(tabs)/scout.tsx` | AI scanner — camera + FLIP/PASS/HOT |
| `app/(tabs)/inventory.tsx` | Full CRUD — FlatList, search, filters, modals |
| `app/(tabs)/listing.tsx` | AI listing generator, copy fields, CSV export |
| `app/(tabs)/trends.tsx` | Growth Agent weekly brief, 24h cache, tier gate |
| `app/(tabs)/stats.tsx` | P&L dashboard, expenses, mileage, Stripe paywall |
| `lib/auth.ts` | Auth client: register, login, verifyOtp, session |
| `lib/camera.ts` | Camera helpers: capture, pick from library |
| `lib/inventory.ts` | Inventory proxy client: CRUD + photo upload |
| `lib/storage.ts` | Photo helper: pickAndCompressPhoto, uploadItemPhoto |
| `lib/listing.ts` | Listing client: generateListing, exportListingCsv |
| `lib/growth.ts` | Growth client: fetchGrowthBrief (24h cache) |
| `lib/stats.ts` | Stats client: fetchPnlSummary, addExpense, addMileage |
| `lib/supabase.ts` | Supabase client (anon key, inline fallback) |
| `lib/theme.ts` | Theme tokens |
| `components/ui/Button.tsx` | — |
| `components/ui/Card.tsx` | — |
| `components/ui/Input.tsx` | — |
| `components/ui/BottomSheet.tsx` | — |
| `components/ui/TabBar.tsx` | — |
| `components/ui/ScanResult.tsx` | — |
| `components/ui/ProfitBadge.tsx` | — |
| `components/ui/ItemCard.tsx` | UNLISTED=warning gold, LISTED/SOLD uppercased |
| `components/ui/EmptyState.tsx` | — |
| `components/ui/PaywallModal.tsx` | Tier gate modal for Stripe upgrade |
| `components/ui/index.ts` | Barrel export |

### Shared Package (`packages/shared/src/`)

| File | Purpose |
|---|---|
| `types/index.ts` | All interfaces — single source of truth |
| `utils/calcProfit.ts` | Profit calculation (no hardcoded fees) |
| `utils/calcPnl.ts` | P&L summary calculation |
| `utils/createInventoryItem.ts` | buildInventoryPayload, skuPrefix |
| `constants/theme.ts` | Design tokens |
| `constants/categories.ts` | CATEGORY_SKU_PREFIX map (21 categories) |
| `constants/tiers.ts` | Tier limits |
| `index.ts` | Barrel export |

### Supabase Edge Functions (`supabase/functions/claude-proxy/`)

All handlers in one `index.ts` (version 3, deployed and ACTIVE):

| Handler | Feature |
|---|---|
| `scan_single` | Single item AI scan (getSingleSys prompt verbatim) |
| `scan_shelf` | Shelf scan (getShelfSys prompt verbatim) |
| `inventory_list` | List items + load user settings |
| `inventory_create` | Create item (tier gate + SKU generation) |
| `inventory_update` | Update item |
| `inventory_delete` | Delete item |
| `inventory_status` | Change item status (transition validation) |
| `listing_generate` | AI listing generator (generateListingWithAI prompt verbatim) |
| `fetch_trending` | Trending keywords (fetchTrendingKeywords prompt verbatim) |
| `growth_agent` | Growth Agent brief (runGrowthAgent prompt verbatim, writes growth_cache) |

Auth function (`supabase/functions/auth/`) — deployed ACTIVE:
- `POST /auth/register`, `GET /auth/verify`, `POST /auth/login`, `GET /auth/me`

Stripe webhook function (`supabase/functions/stripe-webhook/`) — deployed ACTIVE.

### Web App (`apps/web/`)

| File | Purpose |
|---|---|
| `public/index.html` | Static landing page (1438 lines, self-contained) |
| `next.config.js` | beforeFiles rewrite: `/ → /index.html` |
| `app/api/waitlist/route.ts` | POST: insert to Supabase waitlist table |
| `vercel.json` | `{"ignoreCommand":"exit 1"}` — Vercel builds PAUSED until Phase 5 |

---

## Locked Decisions (do not reverse)

| Decision | Reason |
|---|---|
| All inventory DB ops go through claude-proxy (service role) | RLS on `app.user_id` column requires service role bypass |
| Photos uploaded directly via Supabase Storage Auth session | Storage has its own auth, not through proxy |
| Settings loaded with inventory_list response | No separate settings fetch needed |
| Live profit preview uses settings.ebay_fee / pkg_cost / ship_cost | Never hardcoded |
| SKU generation is server-side | Needs DB count to pad correctly |
| Detail view is a Modal within inventory.tsx | No new route |
| `buildInventoryPayload` called by createItem() before proxy call | Single source of item shape |
| Auth is email verification + password (NOT magic link) | Removed in backend v3.0.0 — never reintroduce |
| 5 mobile tabs only: Scout, Inventory, Listing, Trends, Stats | Never add or rename |
| Vercel builds paused (`apps/web/vercel.json`) | Re-enable in Phase 5 by deleting vercel.json |
| Landing page served via Next.js `beforeFiles` rewrite | Loads at `/` without URL change |
| Supabase waitlist uses anon key (not service role) | Service role not set in Vercel env vars |

---

## Supabase

- **Project ID:** `dqgfpchkheznvanfgsmx` (ACTIVE_HEALTHY)
- **Project URL:** `https://dqgfpchkheznvanfgsmx.supabase.co`
- **Anon key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ2ZwY2hraGV6bnZhbmZnc214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjE5MjQsImV4cCI6MjA5MzEzNzkyNH0.mAViqTT9u5_iXikax9ZOr9b2i9UzecrGiY9kLI-Egdo`
- **Auth:** custom email/password + verification (NOT Supabase Auth magic link)
- **Tables:** users, inventory, scan_log, settings, pnl_expenses, growth_cache, waitlist
- **Storage bucket:** `item-photos` (public, 5MB limit, JPEG/PNG/WebP)
- **Migrations applied:** 000_base_schema.sql, 001_extend_schema.sql, 002_align_to_flippd.sql

### Edge Function URLs (LIVE)

| Function | URL |
|---|---|
| `auth` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/auth` |
| `claude-proxy` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/claude-proxy` |
| `stripe-webhook` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/stripe-webhook` |

---

## Stripe (livemode)

| Plan | Product ID | Monthly Price ID | Annual Price ID |
|---|---|---|---|
| SFP Hustle | `prod_UaFBtgUANzpzCh` | `price_1Tb4hLId3kJSEdqMH7SYN3a8` ($19/mo) | `price_1Tb4hOId3kJSEdqMiMUrnFm2` ($180/yr) |
| SFP Stack | `prod_UaFBJA9wZ0he0J` | `price_1Tb4hRId3kJSEdqMq9XwGKbZ` ($49/mo) | `price_1Tb4hTId3kJSEdqMB21L5giT` ($480/yr) |
| SFP Empire | `prod_UaFB8CpVCfDjWp` | `price_1Tb4hWId3kJSEdqMFrtyqDkK` ($199/mo) | _(none)_ |

---

## EAS Build

- **EAS Project ID:** `cc487254-9654-4930-ac52-37ffba835a20`
- **CI workflow:** `.github/workflows/mobile.yml` — `workflow_dispatch` only (not auto)
- **Web CI:** `.github/workflows/web.yml` — DELETED permanently. Do NOT recreate.

---

## Known Issues / Watch Items

| Issue | Status |
|---|---|
| Supabase waitlist RLS — must have `INSERT` policy for anon role | If signups still 500, run: `CREATE POLICY "allow_anon_insert" ON waitlist FOR INSERT TO anon WITH CHECK (true);` |
| Vercel env vars — `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set | Inline fallbacks added to `lib/supabase.ts` as stopgap |
| PostHog web snippet — `__POSTHOG_KEY__` placeholder in `index.html` | Replace with real key from posthog.com → Project Settings → Project API Key |

---

## Standing Instructions (apply every session)

- Karpathy guidelines: surgical changes only. Do not add features. Do not refactor.
- Never hardcode eBay fee percent — always read from `settings.ebayFeePercent`.
- Auth is email/password only (no magic link).
- 5 mobile tabs only: Scout, Inventory, Listing, Trends, Stats.
- Supabase Edge Functions replace the old Replit backend entirely.
- Update this file at the end of every session.
- All AI prompts from FEATURE_TRIAGE.md — never rewrite.
- No file over 500 lines — refactor proactively.
