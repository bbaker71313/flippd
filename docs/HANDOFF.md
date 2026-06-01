# ScanForProfit — Session Handoff

This file is the persistent session context. Update it at the end of every Claude Code session with what changed.

---

## Project Location

`C:\Users\bbake\OneDrive\Desktop\scanforprofit`

## Repo

github.com/bbaker71313/scanforprofit

---

## Session: 2026-06-01 — File Audit

### File Audit

Completed 2026-06-01: Deleted `generate_code.html` (stale Flippd artifact), `https_github_.txt` (single URL, not a file), `scanforprofit-playbook.html` (superseded by sfp-playbook-full.html), `ScanForProfitLanding.jsx` (React duplicate of index.html — index.html is live). Moved docs to correct subfolders per CLAUDE.md structure.

Notes: `generate_code.html`, `https_github_.txt`, `ScanForProfitLanding.jsx` were not found in this repo — likely never committed or already removed before this audit. `scanforprofit-playbook.html` was found at root and deleted. `docs/directory-copy.md` and `docs/submission-readiness.md` moved to `docs/marketing/`.

### Commits this session

| Hash | Message |
|---|---|
| _(this commit)_ | chore: file audit — delete 4 stale files, move docs to subfolders |

---

## Session: 2026-06-01 — Phase 4 Steps 4–6 (HANDOFF recovery note)

> HANDOFF.md was corrupted (UTF-16LE encoding) between commits `08c8ada` and `3f4f01c`. The three session entries below are reconstructed from commit messages. See git log for commit hashes.

### Phase 4 Step 4 — Listing Tab (commit `3b589b5`)

- **`apps/mobile/app/(tabs)/listing.tsx`** — AI listing generator: select inventory item, generate eBay listing via claude-proxy (`listing_generate` handler), title/description/condition/price fields, one-tap copy per field, CSV export.
- **`apps/mobile/lib/listing.ts`** — listing client: `generateListing`, `exportListingCsv`.
- **`supabase/functions/claude-proxy/index.ts`** — added `listing_generate` handler (generateListingWithAI verbatim prompt from FEATURE_TRIAGE.md), `fetchTrendingKeywords` handler.

### Phase 4 Step 5 — Trends Tab (commit `27e1912`)

- **`apps/mobile/app/(tabs)/trends.tsx`** — Growth Agent tab: weekly business brief, 24h cache, tier gate.
- **`apps/mobile/lib/growth.ts`** — growth client: `fetchGrowthBrief` (24h cache check), calls `growth_agent` proxy handler.
- **`supabase/functions/claude-proxy/index.ts`** — added `growth_agent` handler (runGrowthAgent verbatim prompt from FEATURE_TRIAGE.md), writes to `growth_cache`.

### Phase 4 Step 6 — Stats Tab (commit `846c65a`)

- **`apps/mobile/app/(tabs)/stats.tsx`** — P&L dashboard: revenue, expenses, profit, ROI, mileage tracker, Stripe paywall for Hustle+ features.
- **`apps/mobile/lib/stats.ts`** — stats client: `fetchPnlSummary`, `addExpense`, `addMileage`.
- **`apps/mobile/components/ui/PaywallModal.tsx`** — paywall modal component for tier-gated features.
- **`packages/shared/src/utils/calcPnl.ts`** — P&L calculation utility.
- **`packages/shared/src/types/index.ts`** — added PnL, expense, mileage types.

### Next task

**Phase 4 Step 7** — per HANDOFF at `3f4f01c`.

---



## Session: 2026-06-01 — Vercel builds paused

### What changed this session

- **`apps/web/vercel.json`** — created with `{"ignoreCommand":"exit 1"}`. Tells Vercel to skip all builds until Phase 5 web scaffold is ready. Re-enable in Phase 5 by deleting this file or changing ignoreCommand.

### Next task

**Phase 5** — when web scaffold is ready: delete `apps/web/vercel.json` (or remove `ignoreCommand`) to re-enable Vercel builds.

### Commits this session

| Hash | Message |
|---|---|
| `8202588` | chore: disable Vercel builds until Phase 5 web scaffold |

---

## Session: 2026-05-31 (5) — Phase 4 Step 3: Inventory Tab

### What changed this session

- **`apps/mobile/app/(tabs)/inventory.tsx`** — full replacement: FlatList + search + status filter pills (ALL/UNLISTED/LISTED/SOLD), FAB (ADD ITEM), Add/Edit BottomSheet with live profit preview, detail Modal with status change, delete confirm modal, sold-price modal, category/condition picker modals. Tier gate checked before opening Add sheet.
- **`apps/mobile/lib/inventory.ts`** — new proxy-wrapped client: `fetchInventory`, `createItem`, `updateItem`, `deleteItem`, `changeStatus`. All ops routed through claude-proxy (RLS bypass). `mapRow` normalizes JSONB photos column.
- **`apps/mobile/lib/storage.ts`** — new photo helper: `pickAndCompressPhoto` (expo-image-picker + expo-image-manipulator, JPEG 80%), `uploadItemPhoto` (Supabase Storage bucket `item-photos/{userId}/{itemId}/{filename}`), max 1MB enforced.
- **`packages/shared/src/utils/createInventoryItem.ts`** — new pure function: `buildInventoryPayload` validates/defaults fields, `skuPrefix` returns prefix for category. Single source of truth for item creation shape.
- **`packages/shared/src/constants/categories.ts`** — added `CATEGORY_SKU_PREFIX` map (21 eBay categories → 4-char code).
- **`packages/shared/src/index.ts`** — export `createInventoryItem` utils.
- **`apps/mobile/components/ui/ItemCard.tsx`** — fixed UNLISTED badge: now warning gold (was gray). LISTED/SOLD labels uppercased.
- **`supabase/functions/claude-proxy/index.ts`** — added 5 handlers: `inventory_list`, `inventory_create` (tier gate + SKU generation), `inventory_update`, `inventory_delete`, `inventory_status` (transition validation). Added `HttpError` class, `ITEM_LIMITS`, `CATEGORY_SKU_PREFIX`. Deployed as version 3.
- **Supabase Storage** — `item-photos` bucket created (public, 5MB limit, JPEG/PNG/WebP). RLS policies for authenticated upload/delete.
- **`apps/mobile/package.json`** — added `expo-image-picker`, `expo-image-manipulator`.

### Decisions made this session (do not reverse)

- All inventory DB ops go through claude-proxy (service role bypasses `app.user_id` RLS)
- Photos uploaded directly via Supabase Auth session (Storage has its own auth)
- Settings loaded with `inventory_list` response — no separate settings fetch
- Live profit preview uses loaded `settings.ebay_fee` / `pkg_cost` / `ship_cost` — never hardcoded
- SKU generation is server-side (needs DB count) — proxy generates, shared util returns prefix only
- Detail view is a full-screen Modal within inventory.tsx (no new route created)
- `buildInventoryPayload` called by `createItem()` in lib/inventory.ts before proxy call

### Commits this session

| Hash | Message |
|---|---|
| `2f69ee8` | feat: inventory tab — CRUD, photo picker, item card, proxy reads |

### tsc result

`npx tsc --noEmit` — **0 errors** (both `apps/mobile` and `packages/shared`)

### Next task

**Phase 4 Step 4** — Listing Tab: AI listing generator
- Read existing `apps/mobile/app/(tabs)/listing.tsx` stub
- Pull selected inventory item, generate eBay listing via claude-proxy
- Title (80 chars), description (250–400 words), condition notes, category, suggested price
- One-tap copy each field; "Generate" button calls new `listing_generate` proxy handler

---

## Session: 2026-06-01 — Landing Page Fixes

### What changed this session

- **`apps/web/public/index.html`** — 4 surgical changes:
  1. Converted `<form id="early-form">` → `<div>`, button `type="submit"` → `type="button"`, JS listener `submit` → `click` on the button
  2. Converted `<form id="newsletter-form">` → `<div>`, same JS update
  3. Added PostHog web snippet to `<head>` (`__POSTHOG_KEY__` placeholder — user must replace with real key from posthog.com → Project Settings → Project API Key); updated `trackEvent()` to call `posthog.capture()`; added `page_view` on `DOMContentLoaded`; added `waitlist_signup` event on successful form submit
  4. Added `style="display:none"` to `#social-proof` section — was visible despite having `[PLACEHOLDER — REPLACE BEFORE LAUNCH]` markers on all testimonials

### Pre-flight findings (for the record)

- `SUPABASE_ANON_KEY_PLACEHOLDER` never existed in the file — waitlist already calls `/api/waitlist` directly
- All CTA buttons already used `href="#early-access"` — no dead CTAs to fix
- `NEXT_PUBLIC_POSTHOG_KEY` is empty in `.env` — user must fill it in before analytics fire

### Verification results

| Check | Result |
|---|---|
| `grep "<form"` | 0 matches ✅ |
| Banned phrases | 0 matches ✅ |
| `posthog.init` present | ✅ |
| `page_view` event | ✅ |
| `waitlist_signup` event | ✅ |
| `#social-proof display:none` | ✅ |

### What the user must do before PostHog fires

1. Go to posthog.com → your project → Project Settings → Project API Key
2. Replace `__POSTHOG_KEY__` in `apps/web/public/index.html` line 664
3. Also set `NEXT_PUBLIC_POSTHOG_KEY=<key>` in `.env`

### Commits this session

| Hash | Message |
|---|---|
| `a39980d` | fix: landing page — remove form tags, PostHog analytics, hide placeholder social proof |

### Next task

**Phase 4 Step 3** — Inventory Tab: CRUD + photos (unchanged)

---

## Session: 2026-05-31 (4) — Landing Page + Waitlist

### What changed this session

- **`apps/web/public/index.html`** — static ScanForProfit landing page (1438 lines, self-contained HTML/CSS/JS, no build step)
- **`apps/web/next.config.js`** — added `beforeFiles` rewrite `/ → /index.html`; preserved existing `transpilePackages: ["@sfp/shared"]`
- **`apps/web/app/api/waitlist/route.ts`** — POST endpoint, validates email, inserts into Supabase `waitlist` table via service role key
- **Supabase** — `waitlist` table created (`id uuid PK`, `email text UNIQUE NOT NULL`, `created_at timestamptz`), RLS enabled

### Decisions made this session (do not reverse)

- Landing page served via Next.js `beforeFiles` rewrite (not a redirect) so it loads at `/` without changing the URL
- Email form in `index.html` now POSTs to `/api/waitlist` (stub `setTimeout` removed)
- Only service role can read/write waitlist — no user-level RLS policies needed

### Commits this session

| Hash | Message |
|---|---|
| `68682c5` | feat: serve static landing page at scanforprofit.com root |
| `aed53d5` | feat: wire email capture to Supabase waitlist table |

### Completed

- ✅ Static landing page live at scanforprofit.com
- ✅ Email capture wired to Supabase waitlist table
- Landing page file: `apps/web/public/index.html` (1438 lines, static HTML)
- next.config.js: beforeFiles rewrite from / to /index.html

### Master Playbook Status

- m_t1_1: Landing page build → ✅ Done — static HTML live at scanforprofit.com
- m_t1_5: Deploy scanforprofit.com → ✅ Done — serving correctly

### Next task

**Phase 4 Step 3** — Inventory Tab: CRUD + photos (unchanged from prior session)

---

## Session: 2026-05-31 (3) — Phase 4 Step 2.5: Protected Route Guard

### What changed this session

- **`apps/mobile/app/_layout.tsx`** — added auth gate: `useState` for `{ session, checked }`, async `getSession()` on mount (errors → null), `onAuthStateChange` for mid-session changes, blank `#1c1712` loading screen while check runs, `<Redirect href="/(auth)/login">` when unauthenticated on protected route, `<Redirect href="/(tabs)/scout">` when authenticated on auth screen. `auth.ts` unchanged — `getSession()` already existed.

### Decisions made this session (do not reverse)

- Loading state is a solid `#1c1712` (brand inverse) `<View>` — no spinner, no content, eliminates any flash
- `<Redirect>` from expo-router used (not `router.replace`) per brief
- Both redirects are declarative and co-located in the same file — no separate hook file created

### Commits this session

| Hash | Message |
|---|---|
| `a6360d2` | feat: protected route guard — auth gate in root layout |

### tsc result

`npx tsc --noEmit` — **0 errors**

### Next task

**Phase 4 Step 3** — Inventory Tab: CRUD + photos
- `apps/mobile/app/(tabs)/inventory.tsx` — list view, add/edit/delete items
- `apps/mobile/app/(tabs)/listing.tsx` — AI listing generator stub (may be same step)
- Supabase reads from `inventory` table via service-role proxy or direct client RLS
- RLS note: current RLS uses `app.user_id` integer setting, not `auth.uid()` — writes must go through claude-proxy or via a Postgres function

---

## Session: 2026-05-31 (2) — Phase 4 Step 2: Scout Tab

### What changed this session

- **`apps/mobile/lib/camera.ts`** — created; `takePicture(ref)` utility using expo-camera `takePictureAsync({ base64: true, quality: 0.6 })`; no extra dependency needed
- **`apps/mobile/app/(tabs)/scout.tsx`** — full implementation: full-screen CameraView, SINGLE ITEM / SHELF SCAN mode toggle, capture button, Analyzing overlay, ScanResult card for single scans, scrollable ShelfItemRow list for shelf scans, Buy modal (cost input), error states for all failure paths, tier limit handled via Alert
- **`supabase/functions/claude-proxy/index.ts`** — major rewrite: fixed broken `payload.sub as number` (was UUID string, now email-based lookup), added `getOrCreateUser()` (lazy creates users row on first scan), added `handleSingleScan()` (getSingleSys verbatim prompt, calcProfit, getDecision, writes scan_log), added `handleShelfScan()` (getShelfSys verbatim prompt, same logic), added `handleBuyItem()` (inventory insert + scan_log update), added `DEFAULT_SETTINGS` fallback

### Key decisions made this session (do not reverse)

- Proxy bridges Supabase Auth UUID → custom users integer ID by email lookup, with lazy row creation on first use — register.tsx does NOT need to insert into users table
- `expo-image-manipulator` NOT installed — using `takePictureAsync({ quality: 0.6 })` native compression instead
- Estimated thrift cost for display = `avgSoldPrice * 0.10` — user overrides actual cost in Buy modal
- Tier gate returns 429 (matching existing proxy), not 403 as brief specified
- Shelf scan built (it's V2-04 in FEATURE_TRIAGE) per explicit user instruction
- AI prompts are verbatim from FEATURE_TRIAGE.md P-03 and P-04 — not rewritten
- Decision logic from brief: HOT = ROI > 150 AND confidence ≥ 80, FLIP = ROI > adjustedTarget AND confidence ≥ 50; style mod: conservative ×1.2, balanced ×1.0, aggressive ×0.8

### Commits this session

| Hash | Message |
|---|---|
| `a34dece` | feat: scout tab — camera, AI scan, FLIP/PASS/HOT result |

### tsc result

`npx tsc --noEmit` — **0 errors**

### Next task

**Phase 4 Step 3** — Protected route guard + session persistence
- Root `_layout.tsx` needs auth redirect: unauthenticated → `/(auth)/login`, authenticated → `/(tabs)/scout`
- Add `useSession` hook (`apps/mobile/hooks/useSession.ts`) wrapping `supabase.auth.onAuthStateChange`
- On app launch: check session → if null → replace to login; if valid → replace to tabs
- Target files: `apps/mobile/app/_layout.tsx` (update), `apps/mobile/hooks/useSession.ts` (create)
- Also: consider Supabase `realtime` deploy of claude-proxy Edge Function with updated JWT handling

---

## Session: 2026-05-31 — Phase 4 Step 1: Auth Flow

### What changed this session

- **`apps/mobile/app/(auth)/_layout.tsx`** — created; required Expo Router group stack
- **`apps/mobile/app/(auth)/register.tsx`** — full implementation: email + username + password + confirm, calls `signUp`, routes to verify screen on success, error states for all failure cases
- **`apps/mobile/app/(auth)/login.tsx`** — full implementation: email + password, calls `signIn`, routes to `/(tabs)/scout` on success, specific error messages (wrong password, unverified email)
- **`apps/mobile/app/(auth)/verify.tsx`** — new file: 6-digit OTP input, calls `verifyOtp`, routes to `/(tabs)/scout` on success, handles expired/invalid code errors
- **`apps/mobile/lib/auth.ts`** — added `verifyOtp` function + `OtpCredentials` type; all other functions unchanged

### Rules applied

- NativeWind only — no StyleSheet anywhere
- No `<form>` tags — all `onChangeText`/`onPress`
- JWT stored via expo-secure-store adapter already wired in `supabase.ts`
- Email verification OTP only — no magic link, no OAuth
- Error states on all 3 screens

### Commits this session

| Hash | Message |
|---|---|
| `2ae300f` → pushed as `5ca1e51` | feat: auth flow — register, login, verify screens |

### tsc result

`npx tsc --noEmit` — **0 errors**

### Next task

**Phase 4 Step 2** — Protected route guard + session persistence
- Root `_layout.tsx` needs to redirect unauthenticated users to `/(auth)/login`
- Add `useSession` hook in `apps/mobile/lib/auth.ts` or new `apps/mobile/hooks/useSession.ts`
- On app launch: check `getSession()` → if null → redirect to login; if valid → redirect to tabs
- Target files: `apps/mobile/app/_layout.tsx` (update), `apps/mobile/hooks/useSession.ts` (create)

### Decisions made this session (do not reverse)

- Verify screen receives `email` as a route param from register — do not store email in global state
- OTP type is `'email'` — matches Supabase email verification flow, not SMS

---

## Session: 2026-05-29 — Deploy Edge Functions + Base Schema Migration

### What changed this session

- **`supabase/migrations/000_base_schema.sql` created** — creates `public.users` and `public.inventory` (base columns only) on fresh databases so that `001_extend_schema.sql` can run its `ALTER TABLE` statements. Applied to production and committed.
- **`supabase/migrations/001_extend_schema.sql` updated** — added `idx_scan_log_user_created` index (existed in production but was missing from the file).
- **`supabase/migrations/002_align_to_flippd.sql` updated** — added `idx_inventory_ebay_item` and `idx_inventory_platform` indexes (existed in production but were missing from the file).
- **All 3 Edge Functions deployed to production** (project `dqgfpchkheznvanfgsmx`, ACTIVE, version 2):
  - `auth` — register, verify, login, me
  - `claude-proxy` — Anthropic proxy with scan limits
  - `stripe-webhook` — Stripe event handler
- **CI fixed:** Supabase GitHub integration disconnected (no more preview branch failures), Cloudflare flippd-site Worker deleted (no more stale CI checks).
- **Project ID clarified:** `dqgfpchkheznvanfgsmx` IS the correct ScanForProfit project (renamed in dashboard from Flippd). All docs updated to use this ID.

### Function URLs (LIVE)

| Function | URL |
|---|---|
| `auth` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/auth` |
| `claude-proxy` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/claude-proxy` |
| `stripe-webhook` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/stripe-webhook` |

Anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ2ZwY2hraGV6bnZhbmZnc214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjE5MjQsImV4cCI6MjA5MzEzNzkyNH0.mAViqTT9u5_iXikax9ZOr9b2i9UzecrGiY9kLI-Egdo`

### Smoke tests (run from your laptop)

Cloud session network policy blocks outbound calls to Supabase — these must be run locally.

```bash
BASE=https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1
ANON=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ2ZwY2hraGV6bnZhbmZnc214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjE5MjQsImV4cCI6MjA5MzEzNzkyNH0.mAViqTT9u5_iXikax9ZOr9b2i9UzecrGiY9kLI-Egdo

# 1. Auth register — expect {"success":true, ...}
curl -s -X POST $BASE/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"smoketest","email":"smoke@test.invalid","password":"Test1234!"}'

# 2. Claude-proxy health check — expect {"status":"ok", ...}
curl -s -X POST $BASE/claude-proxy \
  -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d '{"type":"health"}'

# 3. Stripe-webhook liveness — expect 400 {"error":"Missing Stripe signature"}
# (400 = function is live and processing requests correctly; secrets not set = 503)
curl -s -X POST $BASE/stripe-webhook \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Secrets that must be set before functions are fully operational

```bash
# CRITICAL — generate a strong secret:
supabase secrets set JWT_SECRET="$(openssl rand -base64 32)" --project-ref dqgfpchkheznvanfgsmx

# AI backend:
supabase secrets set ANTHROPIC_API_KEY="sk-ant-..." --project-ref dqgfpchkheznvanfgsmx

# Email verification:
supabase secrets set RESEND_API_KEY="re_..." --project-ref dqgfpchkheznvanfgsmx

# Stripe (set WEBHOOK_SECRET after adding endpoint in Stripe Dashboard):
supabase secrets set STRIPE_SECRET_KEY="sk_live_..." --project-ref dqgfpchkheznvanfgsmx
supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..." --project-ref dqgfpchkheznvanfgsmx

# eBay:
supabase secrets set EBAY_CLIENT_ID="Brittany-Flippd-PRD-67b75c3f4-fb4ff30c" --project-ref dqgfpchkheznvanfgsmx
```

### Stripe webhook endpoint (do this after setting secrets)

Stripe Dashboard → Developers → Webhooks → Add endpoint:
`https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/stripe-webhook`

Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

Copy the `whsec_...` signing secret → set as `STRIPE_WEBHOOK_SECRET` above.

### Next task

Once smoke tests pass and secrets are set: **Phase 4 — Build mobile app screens against live Edge Functions.**

---

## Session: 2026-05-29 — Edge Function Code Written

### What changed this session

- **`supabase/functions/auth/index.ts` created** — full custom auth. Routes: `POST /register`, `GET /verify`, `POST /login`, `GET /me`. bcryptjs hashing, HMAC-SHA256 90-day JWTs, Resend email.
- **`supabase/functions/claude-proxy/index.ts` created** — Anthropic proxy with tier scan limits. Health check: `{"type":"health"}` needs no auth.
- **`supabase/functions/stripe-webhook/index.ts` created** — handles 4 Stripe events with manual signature verification.

### Decisions made (do not reverse)

- Auth uses custom JWT (HMAC-SHA256, 90-day expiry), NOT Supabase Auth sessions.
- No magic link endpoints — `/auth/request-link` and `/auth/verify-link` must never be added.
- Password hashing: bcryptjs sync (10 rounds) via `https://esm.sh/bcryptjs`.
- Price-to-tier mapping hardcoded in `stripe-webhook/index.ts` — update `PRICE_TIER` map if Stripe products change.
- `verify_jwt: false` on all 3 functions (they implement their own auth).

---

## Session: 2026-05-29 — Fix GitHub Actions CI Failures

### What changed this session

- **`.github/workflows/mobile.yml` updated** — `workflow_dispatch` only (no auto-trigger on push)
- **`.github/workflows/web.yml` deleted** — Vercel native Git integration handles deploys. Do NOT recreate.
- **`docs/GITHUB_SECRETS.md` created** — documents required secrets for Phase 4 EAS builds

### Decisions made (do not reverse)

- `web.yml` deleted permanently.
- `mobile.yml` is manual-only until Phase 4 Step 8 (when `EXPO_TOKEN` is added).

---

## Session: 2026-05-27

### What changed this session

- File system audit, cleanup, git init, initial commit (`c6d2000`), CLAUDE.md written, type fix for supabase-server cookie handlers

### Commits this session

| Hash | Message |
|---|---|
| `c6d2000` | chore: initial commit |
| `d9ea970` | docs: update CLAUDE.md |
| `7a67b3e` | fix: add explicit types to supabase-server cookie handlers |

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
- Auth: custom email/password + verification (NOT Supabase Auth)

## Stripe (livemode)

| Plan | Product ID | Monthly Price ID | Annual Price ID |
|---|---|---|---|
| SFP Hustle | `prod_UaFBtgUANzpzCh` | `price_1Tb4hLId3kJSEdqMH7SYN3a8` ($19/mo) | `price_1Tb4hOId3kJSEdqMiMUrnFm2` ($180/yr) |
| SFP Stack | `prod_UaFBJA9wZ0he0J` | `price_1Tb4hRId3kJSEdqMq9XwGKbZ` ($49/mo) | `price_1Tb4hTId3kJSEdqMB21L5giT` ($480/yr) |
| SFP Empire | `prod_UaFB8CpVCfDjWp` | `price_1Tb4hWId3kJSEdqMFrtyqDkK` ($199/mo) | _(none)_ |
