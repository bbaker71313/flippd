# ScanForProfit â€” Session Handoff

This file is the persistent session context. Update it at the end of every Claude Code session with what changed.

---

## Project Location

`C:\Users\bbake\OneDrive\Desktop\scanforprofit`

## Repo

github.com/bbaker71313/scanforprofit

---

## Session: 2026-06-01 â€” Vercel builds paused

### What changed this session

- **`apps/web/vercel.json`** â€” created with `{"ignoreCommand":"exit 1"}`. Tells Vercel to skip all builds until Phase 5 web scaffold is ready. Re-enable in Phase 5 by deleting this file or changing ignoreCommand.

### Next task

**Phase 5** â€” when web scaffold is ready: delete `apps/web/vercel.json` (or remove `ignoreCommand`) to re-enable Vercel builds.

### Commits this session

| Hash | Message |
|---|---|
| `8202588` | chore: disable Vercel builds until Phase 5 web scaffold |

---

## Session: 2026-06-01 (2) â€” PR + gh CLI setup

### What changed this session

- **`gh` CLI** â€” installed via `winget install --id GitHub.cli`, authenticated via `GH_TOKEN` env var
- **`pr/phase-4-build` branch** â€” created at initial commit `c6d2000`, pushed to origin as a base for the PR
- **PR #20** â€” opened at https://github.com/bbaker71313/scanforprofit/pull/20 documenting all Phase 4 work (auth, scout tab, inventory tab, landing page, route guard, claude-proxy rewrite)
- **PAT rotated** â€” the token used for this session was revoked immediately after use

### gh CLI notes

- Installed at system PATH (winget). For future sessions: `gh auth login` â†’ GitHub.com â†’ HTTPS â†’ browser â€” no token needed
- `GH_TOKEN` env var also works as a fallback for non-interactive environments

### Next task

**Phase 4 Step 4** â€” Listing Tab: AI listing generator (unchanged from prior session)

---

## Session: 2026-05-31 (5) â€” Phase 4 Step 3: Inventory Tab

### What changed this session

- **`apps/mobile/app/(tabs)/inventory.tsx`** â€” full replacement: FlatList + search + status filter pills (ALL/UNLISTED/LISTED/SOLD), FAB (ADD ITEM), Add/Edit BottomSheet with live profit preview, detail Modal with status change, delete confirm modal, sold-price modal, category/condition picker modals. Tier gate checked before opening Add sheet.
- **`apps/mobile/lib/inventory.ts`** â€” new proxy-wrapped client: `fetchInventory`, `createItem`, `updateItem`, `deleteItem`, `changeStatus`. All ops routed through claude-proxy (RLS bypass). `mapRow` normalizes JSONB photos column.
- **`apps/mobile/lib/storage.ts`** â€” new photo helper: `pickAndCompressPhoto` (expo-image-picker + expo-image-manipulator, JPEG 80%), `uploadItemPhoto` (Supabase Storage bucket `item-photos/{userId}/{itemId}/{filename}`), max 1MB enforced.
- **`packages/shared/src/utils/createInventoryItem.ts`** â€” new pure function: `buildInventoryPayload` validates/defaults fields, `skuPrefix` returns prefix for category. Single source of truth for item creation shape.
- **`packages/shared/src/constants/categories.ts`** â€” added `CATEGORY_SKU_PREFIX` map (21 eBay categories â†’ 4-char code).
- **`packages/shared/src/index.ts`** â€” export `createInventoryItem` utils.
- **`apps/mobile/components/ui/ItemCard.tsx`** â€” fixed UNLISTED badge: now warning gold (was gray). LISTED/SOLD labels uppercased.
- **`supabase/functions/claude-proxy/index.ts`** â€” added 5 handlers: `inventory_list`, `inventory_create` (tier gate + SKU generation), `inventory_update`, `inventory_delete`, `inventory_status` (transition validation). Added `HttpError` class, `ITEM_LIMITS`, `CATEGORY_SKU_PREFIX`. Deployed as version 3.
- **Supabase Storage** â€” `item-photos` bucket created (public, 5MB limit, JPEG/PNG/WebP). RLS policies for authenticated upload/delete.
- **`apps/mobile/package.json`** â€” added `expo-image-picker`, `expo-image-manipulator`.

### Decisions made this session (do not reverse)

- All inventory DB ops go through claude-proxy (service role bypasses `app.user_id` RLS)
- Photos uploaded directly via Supabase Auth session (Storage has its own auth)
- Settings loaded with `inventory_list` response â€” no separate settings fetch
- Live profit preview uses loaded `settings.ebay_fee` / `pkg_cost` / `ship_cost` â€” never hardcoded
- SKU generation is server-side (needs DB count) â€” proxy generates, shared util returns prefix only
- Detail view is a full-screen Modal within inventory.tsx (no new route created)
- `buildInventoryPayload` called by `createItem()` in lib/inventory.ts before proxy call

### Commits this session

| Hash | Message |
|---|---|
| `2f69ee8` | feat: inventory tab â€” CRUD, photo picker, item card, proxy reads |

### tsc result

`npx tsc --noEmit` â€” **0 errors** (both `apps/mobile` and `packages/shared`)

### Next task

**Phase 4 Step 4** â€” Listing Tab: AI listing generator
- Read existing `apps/mobile/app/(tabs)/listing.tsx` stub
- Pull selected inventory item, generate eBay listing via claude-proxy
- Title (80 chars), description (250â€“400 words), condition notes, category, suggested price
- One-tap copy each field; "Generate" button calls new `listing_generate` proxy handler

---

## Session: 2026-06-01 â€” Landing Page Fixes

### What changed this session

- **`apps/web/public/index.html`** â€” 4 surgical changes:
  1. Converted `<form id="early-form">` â†’ `<div>`, button `type="submit"` â†’ `type="button"`, JS listener `submit` â†’ `click` on the button
  2. Converted `<form id="newsletter-form">` â†’ `<div>`, same JS update
  3. Added PostHog web snippet to `<head>` (`__POSTHOG_KEY__` placeholder â€” user must replace with real key from posthog.com â†’ Project Settings â†’ Project API Key); updated `trackEvent()` to call `posthog.capture()`; added `page_view` on `DOMContentLoaded`; added `waitlist_signup` event on successful form submit
  4. Added `style="display:none"` to `#social-proof` section â€” was visible despite having `[PLACEHOLDER â€” REPLACE BEFORE LAUNCH]` markers on all testimonials

### Pre-flight findings (for the record)

- `SUPABASE_ANON_KEY_PLACEHOLDER` never existed in the file â€” waitlist already calls `/api/waitlist` directly
- All CTA buttons already used `href="#early-access"` â€” no dead CTAs to fix
- `NEXT_PUBLIC_POSTHOG_KEY` is empty in `.env` â€” user must fill it in before analytics fire

### Verification results

| Check | Result |
|---|---|
| `grep "<form"` | 0 matches âœ… |
| Banned phrases | 0 matches âœ… |
| `posthog.init` present | âœ… |
| `page_view` event | âœ… |
| `waitlist_signup` event | âœ… |
| `#social-proof display:none` | âœ… |

### What the user must do before PostHog fires

1. Go to posthog.com â†’ your project â†’ Project Settings â†’ Project API Key
2. Replace `__POSTHOG_KEY__` in `apps/web/public/index.html` line 664
3. Also set `NEXT_PUBLIC_POSTHOG_KEY=<key>` in `.env`

### Commits this session

| Hash | Message |
|---|---|
| `a39980d` | fix: landing page â€” remove form tags, PostHog analytics, hide placeholder social proof |

### Next task

**Phase 4 Step 3** â€” Inventory Tab: CRUD + photos (unchanged)

---

## Session: 2026-05-31 (4) â€” Landing Page + Waitlist

### What changed this session

- **`apps/web/public/index.html`** â€” static ScanForProfit landing page (1438 lines, self-contained HTML/CSS/JS, no build step)
- **`apps/web/next.config.js`** â€” added `beforeFiles` rewrite `/ â†’ /index.html`; preserved existing `transpilePackages: ["@sfp/shared"]`
- **`apps/web/app/api/waitlist/route.ts`** â€” POST endpoint, validates email, inserts into Supabase `waitlist` table via service role key
- **Supabase** â€” `waitlist` table created (`id uuid PK`, `email text UNIQUE NOT NULL`, `created_at timestamptz`), RLS enabled

### Decisions made this session (do not reverse)

- Landing page served via Next.js `beforeFiles` rewrite (not a redirect) so it loads at `/` without changing the URL
- Email form in `index.html` now POSTs to `/api/waitlist` (stub `setTimeout` removed)
- Only service role can read/write waitlist â€” no user-level RLS policies needed

### Commits this session

| Hash | Message |
|---|---|
| `68682c5` | feat: serve static landing page at scanforprofit.com root |
| `aed53d5` | feat: wire email capture to Supabase waitlist table |

### Completed

- âœ… Static landing page live at scanforprofit.com
- âœ… Email capture wired to Supabase waitlist table
- Landing page file: `apps/web/public/index.html` (1438 lines, static HTML)
- next.config.js: beforeFiles rewrite from / to /index.html

### Master Playbook Status

- m_t1_1: Landing page build â†’ âœ… Done â€” static HTML live at scanforprofit.com
- m_t1_5: Deploy scanforprofit.com â†’ âœ… Done â€” serving correctly

### Next task

**Phase 4 Step 3** â€” Inventory Tab: CRUD + photos (unchanged from prior session)

---

## Session: 2026-05-31 (3) â€” Phase 4 Step 2.5: Protected Route Guard

### What changed this session

- **`apps/mobile/app/_layout.tsx`** â€” added auth gate: `useState` for `{ session, checked }`, async `getSession()` on mount (errors â†’ null), `onAuthStateChange` for mid-session changes, blank `#1c1712` loading screen while check runs, `<Redirect href="/(auth)/login">` when unauthenticated on protected route, `<Redirect href="/(tabs)/scout">` when authenticated on auth screen. `auth.ts` unchanged â€” `getSession()` already existed.

### Decisions made this session (do not reverse)

- Loading state is a solid `#1c1712` (brand inverse) `<View>` â€” no spinner, no content, eliminates any flash
- `<Redirect>` from expo-router used (not `router.replace`) per brief
- Both redirects are declarative and co-located in the same file â€” no separate hook file created

### Commits this session

| Hash | Message |
|---|---|
| `a6360d2` | feat: protected route guard â€” auth gate in root layout |

### tsc result

`npx tsc --noEmit` â€” **0 errors**

### Next task

**Phase 4 Step 3** â€” Inventory Tab: CRUD + photos
- `apps/mobile/app/(tabs)/inventory.tsx` â€” list view, add/edit/delete items
- `apps/mobile/app/(tabs)/listing.tsx` â€” AI listing generator stub (may be same step)
- Supabase reads from `inventory` table via service-role proxy or direct client RLS
- RLS note: current RLS uses `app.user_id` integer setting, not `auth.uid()` â€” writes must go through claude-proxy or via a Postgres function

---

## Session: 2026-05-31 (2) â€” Phase 4 Step 2: Scout Tab

### What changed this session

- **`apps/mobile/lib/camera.ts`** â€” created; `takePicture(ref)` utility using expo-camera `takePictureAsync({ base64: true, quality: 0.6 })`; no extra dependency needed
- **`apps/mobile/app/(tabs)/scout.tsx`** â€” full implementation: full-screen CameraView, SINGLE ITEM / SHELF SCAN mode toggle, capture button, Analyzing overlay, ScanResult card for single scans, scrollable ShelfItemRow list for shelf scans, Buy modal (cost input), error states for all failure paths, tier limit handled via Alert
- **`supabase/functions/claude-proxy/index.ts`** â€” major rewrite: fixed broken `payload.sub as number` (was UUID string, now email-based lookup), added `getOrCreateUser()` (lazy creates users row on first scan), added `handleSingleScan()` (getSingleSys verbatim prompt, calcProfit, getDecision, writes scan_log), added `handleShelfScan()` (getShelfSys verbatim prompt, same logic), added `handleBuyItem()` (inventory insert + scan_log update), added `DEFAULT_SETTINGS` fallback

### Key decisions made this session (do not reverse)

- Proxy bridges Supabase Auth UUID â†’ custom users integer ID by email lookup, with lazy row creation on first use â€” register.tsx does NOT need to insert into users table
- `expo-image-manipulator` NOT installed â€” using `takePictureAsync({ quality: 0.6 })` native compression instead
- Estimated thrift cost for display = `avgSoldPrice * 0.10` â€” user overrides actual cost in Buy modal
- Tier gate returns 429 (matching existing proxy), not 403 as brief specified
- Shelf scan built (it's V2-04 in FEATURE_TRIAGE) per explicit user instruction
- AI prompts are verbatim from FEATURE_TRIAGE.md P-03 and P-04 â€” not rewritten
- Decision logic from brief: HOT = ROI > 150 AND confidence â‰¥ 80, FLIP = ROI > adjustedTarget AND confidence â‰¥ 50; style mod: conservative Ã—1.2, balanced Ã—1.0, aggressive Ã—0.8

### Commits this session

| Hash | Message |
|---|---|
| `a34dece` | feat: scout tab â€” camera, AI scan, FLIP/PASS/HOT result |

### tsc result

`npx tsc --noEmit` â€” **0 errors**

### Next task

**Phase 4 Step 3** â€” Protected route guard + session persistence
- Root `_layout.tsx` needs auth redirect: unauthenticated â†’ `/(auth)/login`, authenticated â†’ `/(tabs)/scout`
- Add `useSession` hook (`apps/mobile/hooks/useSession.ts`) wrapping `supabase.auth.onAuthStateChange`
- On app launch: check session â†’ if null â†’ replace to login; if valid â†’ replace to tabs
- Target files: `apps/mobile/app/_layout.tsx` (update), `apps/mobile/hooks/useSession.ts` (create)
- Also: consider Supabase `realtime` deploy of claude-proxy Edge Function with updated JWT handling

---

## Session: 2026-05-31 â€” Phase 4 Step 1: Auth Flow

### What changed this session

- **`apps/mobile/app/(auth)/_layout.tsx`** â€” created; required Expo Router group stack
- **`apps/mobile/app/(auth)/register.tsx`** â€” full implementation: email + username + password + confirm, calls `signUp`, routes to verify screen on success, error states for all failure cases
- **`apps/mobile/app/(auth)/login.tsx`** â€” full implementation: email + password, calls `signIn`, routes to `/(tabs)/scout` on success, specific error messages (wrong password, unverified email)
- **`apps/mobile/app/(auth)/verify.tsx`** â€” new file: 6-digit OTP input, calls `verifyOtp`, routes to `/(tabs)/scout` on success, handles expired/invalid code errors
- **`apps/mobile/lib/auth.ts`** â€” added `verifyOtp` function + `OtpCredentials` type; all other functions unchanged

### Rules applied

- NativeWind only â€” no StyleSheet anywhere
- No `<form>` tags â€” all `onChangeText`/`onPress`
- JWT stored via expo-secure-store adapter already wired in `supabase.ts`
- Email verification OTP only â€” no magic link, no OAuth
- Error states on all 3 screens

### Commits this session

| Hash | Message |
|---|---|
| `2ae300f` â†’ pushed as `5ca1e51` | feat: auth flow â€” register, login, verify screens |

### tsc result

`npx tsc --noEmit` â€” **0 errors**

### Next task

**Phase 4 Step 2** â€” Protected route guard + session persistence
- Root `_layout.tsx` needs to redirect unauthenticated users to `/(auth)/login`
- Add `useSession` hook in `apps/mobile/lib/auth.ts` or new `apps/mobile/hooks/useSession.ts`
- On app launch: check `getSession()` â†’ if null â†’ redirect to login; if valid â†’ redirect to tabs
- Target files: `apps/mobile/app/_layout.tsx` (update), `apps/mobile/hooks/useSession.ts` (create)

### Decisions made this session (do not reverse)

- Verify screen receives `email` as a route param from register â€” do not store email in global state
- OTP type is `'email'` â€” matches Supabase email verification flow, not SMS

---

## Session: 2026-05-29 â€” Deploy Edge Functions + Base Schema Migration

### What changed this session

- **`supabase/migrations/000_base_schema.sql` created** â€” creates `public.users` and `public.inventory` (base columns only) on fresh databases so that `001_extend_schema.sql` can run its `ALTER TABLE` statements. Applied to production and committed.
- **`supabase/migrations/001_extend_schema.sql` updated** â€” added `idx_scan_log_user_created` index (existed in production but was missing from the file).
- **`supabase/migrations/002_align_to_flippd.sql` updated** â€” added `idx_inventory_ebay_item` and `idx_inventory_platform` indexes (existed in production but were missing from the file).
- **All 3 Edge Functions deployed to production** (project `dqgfpchkheznvanfgsmx`, ACTIVE, version 2):
  - `auth` â€” register, verify, login, me
  - `claude-proxy` â€” Anthropic proxy with scan limits
  - `stripe-webhook` â€” Stripe event handler
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

Cloud session network policy blocks outbound calls to Supabase â€” these must be run locally.

```bash
BASE=https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1
ANON=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ2ZwY2hraGV6bnZhbmZnc214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjE5MjQsImV4cCI6MjA5MzEzNzkyNH0.mAViqTT9u5_iXikax9ZOr9b2i9UzecrGiY9kLI-Egdo

# 1. Auth register â€” expect {"success":true, ...}
curl -s -X POST $BASE/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"smoketest","email":"smoke@test.invalid","password":"Test1234!"}'

# 2. Claude-proxy health check â€” expect {"status":"ok", ...}
curl -s -X POST $BASE/claude-proxy \
  -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d '{"type":"health"}'

# 3. Stripe-webhook liveness â€” expect 400 {"error":"Missing Stripe signature"}
# (400 = function is live and processing requests correctly; secrets not set = 503)
curl -s -X POST $BASE/stripe-webhook \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Secrets that must be set before functions are fully operational

```bash
# CRITICAL â€” generate a strong secret:
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

Stripe Dashboard â†’ Developers â†’ Webhooks â†’ Add endpoint:
`https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/stripe-webhook`

Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

Copy the `whsec_...` signing secret â†’ set as `STRIPE_WEBHOOK_SECRET` above.

### Next task

Once smoke tests pass and secrets are set: **Phase 4 â€” Build mobile app screens against live Edge Functions.**

---

## Session: 2026-05-29 â€” Edge Function Code Written

### What changed this session

- **`supabase/functions/auth/index.ts` created** â€” full custom auth. Routes: `POST /register`, `GET /verify`, `POST /login`, `GET /me`. bcryptjs hashing, HMAC-SHA256 90-day JWTs, Resend email.
- **`supabase/functions/claude-proxy/index.ts` created** â€” Anthropic proxy with tier scan limits. Health check: `{"type":"health"}` needs no auth.
- **`supabase/functions/stripe-webhook/index.ts` created** â€” handles 4 Stripe events with manual signature verification.

### Decisions made (do not reverse)

- Auth uses custom JWT (HMAC-SHA256, 90-day expiry), NOT Supabase Auth sessions.
- No magic link endpoints â€” `/auth/request-link` and `/auth/verify-link` must never be added.
- Password hashing: bcryptjs sync (10 rounds) via `https://esm.sh/bcryptjs`.
- Price-to-tier mapping hardcoded in `stripe-webhook/index.ts` â€” update `PRICE_TIER` map if Stripe products change.
- `verify_jwt: false` on all 3 functions (they implement their own auth).

---

## Session: 2026-05-29 â€” Fix GitHub Actions CI Failures

### What changed this session

- **`.github/workflows/mobile.yml` updated** â€” `workflow_dispatch` only (no auto-trigger on push)
- **`.github/workflows/web.yml` deleted** â€” Vercel native Git integration handles deploys. Do NOT recreate.
- **`docs/GITHUB_SECRETS.md` created** â€” documents required secrets for Phase 4 EAS builds

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
- Never hardcode eBay fee percent â€” always read from `settings.ebayFeePercent`.
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

