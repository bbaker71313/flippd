# ScanForProfit — Session Handoff

This file is the persistent session context. Update it at the end of every Claude Code session with what changed.

---

## Project Location

`C:\Users\bbake\OneDrive\Desktop\scanforprofit`

## Repo

github.com/bbaker71313/scanforprofit

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
