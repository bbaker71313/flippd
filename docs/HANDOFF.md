# ScanForProfit — Session Handoff

This file is the persistent session context. Update it at the end of every Claude Code session with what changed.

---

## Project Location

`C:\Users\bbake\OneDrive\Desktop\scanforprofit`

## Repo

github.com/bbaker71313/scanforprofit

---

## Session: 2026-05-29 — Backend Recovery: Edge Function Deployment

### What changed this session

- **`supabase/functions/auth/index.ts` created** — full custom auth Edge Function. Endpoints: `POST /auth/register`, `GET /auth/verify`, `POST /auth/login`, `GET /auth/me`. Uses bcryptjs for password hashing, Web Crypto API (HMAC-SHA256) for 90-day JWTs. No magic link — removed in v3.0.0. Sends verification email via Resend.
- **`supabase/functions/claude-proxy/index.ts` created** — Anthropic API proxy with tier-based scan limit enforcement. Health check at `{"type":"health"}` requires no auth. Accepts custom JWT (issued by auth function) or anon key.
- **`supabase/functions/stripe-webhook/index.ts` created** — Stripe webhook handler. Manual HMAC-SHA256 signature verification. Handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Price-to-tier mapping hardcoded from HANDOFF.md Stripe IDs.
- **All 3 functions deployed to Supabase project `dqgfpchkheznvanfgsmx`** via Supabase MCP `deploy_edge_function`.
- **`supabase.functions.list()` confirmed** — all 3 returned with `status: ACTIVE`.

### Deployed Function URLs

| Function | URL |
|---|---|
| `auth` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/auth` |
| `claude-proxy` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/claude-proxy` |
| `stripe-webhook` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/stripe-webhook` |

### Smoke Test Results

Smoke tests could NOT be run from the remote session environment (outbound calls to Supabase edge function URLs are blocked by the environment's network policy). Functions are confirmed ACTIVE via MCP. **Britt must run these manually from a terminal or browser:**

**Test 1 — auth /register (expected: 200 or 400, NOT 404/500):**
```bash
curl -X POST https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"TestPass123!","username":"testuser"}'
```

**Test 2 — claude-proxy health (expected: 200 with `{"status":"ok"}`):**
```bash
curl -X POST https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/claude-proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ2ZwY2hraGV6bnZhbmZnc214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjE5MjQsImV4cCI6MjA5MzEzNzkyNH0.mAViqTT9u5_iXikax9ZOr9b2i9UzecrGiY9kLI-Egdo" \
  -d '{"type":"health"}'
```

**Test 3 — stripe-webhook reachability (expected: 400 missing signature, NOT 404/500):**
```bash
curl -X POST https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/stripe-webhook \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Secrets Status — ACTION REQUIRED

The Supabase MCP has no tool to read existing secrets. Status cannot be verified programmatically. Britt must check each in: **Supabase Dashboard → Project `dqgfpchkheznvanfgsmx` → Settings → Edge Functions → Secrets**.

| Secret | Required By | Status |
|---|---|---|
| `ANTHROPIC_API_KEY` | claude-proxy | **[UNKNOWN — VERIFY OR ADD]** |
| `STRIPE_SECRET_KEY` | stripe-webhook | **[UNKNOWN — VERIFY OR ADD]** |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | **[UNKNOWN — VERIFY OR ADD]** |
| `RESEND_API_KEY` | auth (email verification) | **[UNKNOWN — VERIFY OR ADD]** |
| `EBAY_CLIENT_ID` | future eBay features | **[UNKNOWN — VERIFY OR ADD]** |
| `JWT_SECRET` | auth (JWT signing — **CRITICAL**) | **[MISSING — YOU MUST ADD THIS]** |
| `APP_URL` | auth (verification email link) | Optional — defaults to Supabase function URL |
| `FRONTEND_URL` | auth (post-verify redirect) | Optional — defaults to `https://scanforprofit.com` |
| `RESEND_FROM_EMAIL` | auth (sender address) | Optional — defaults to `ScanForProfit <hello@scanforprofit.com>` |

**`JWT_SECRET` is required for login to work.** Without it, the auth function falls back to a hardcoded dev secret (`dev-secret-replace-in-production`), which means JWTs issued in testing will not be valid in production once you set the real secret. Add it NOW before any users register.

Recommended: generate with `openssl rand -base64 32`

### Stripe Webhook Endpoint — ACTION REQUIRED

[YOU MUST DO THIS IN STRIPE DASHBOARD]

Stripe → Developers → Webhooks → Add endpoint:
`https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/stripe-webhook`

Events to listen for:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

After adding the endpoint, copy the **Webhook Signing Secret** (`whsec_...`) and add it as `STRIPE_WEBHOOK_SECRET` in Supabase secrets.

### Commits this session

| Hash | Message |
|---|---|
| `bf94f8e` | feat: add auth, claude-proxy, stripe-webhook edge functions |

### Decisions made this session (do not reverse)

- Auth uses custom JWT (HMAC-SHA256, 90-day expiry), NOT Supabase Auth sessions. JWT secret is `JWT_SECRET` env var.
- No magic link endpoints — `/auth/request-link` and `/auth/verify-link` do not exist and must never be added.
- `auth` function routes on path suffix (`.endsWith('/register')` etc.) — works with Supabase's `/functions/v1/auth/register` URL pattern.
- `stripe-webhook` has `verify_jwt: false` — Stripe doesn't send Supabase JWTs.
- Password hashing: bcryptjs sync (10 rounds) via esm.sh CDN.
- Price-to-tier mapping is hardcoded in `stripe-webhook/index.ts` — if new Stripe products are added, update the `PRICE_TIER` map in that file.

### Next task

**Confirm smoke tests pass** (Britt runs the 3 curl commands above)

If any smoke test returns 404 or 500:
- For `auth`: check Supabase Edge Function logs (Dashboard → Edge Functions → auth → Logs)
- Most likely cause: `JWT_SECRET` not set (500 on login), or `bcryptjs` import failed (500 on register)

After smoke tests pass:
1. Add `JWT_SECRET` to Supabase secrets (critical)
2. Verify the other 4 secrets in the table above
3. Add Stripe webhook endpoint in Stripe Dashboard (see above)
4. Re-run smoke tests to confirm end-to-end auth flow works
5. **Phase 4 starts:** Build mobile app screens against live Edge Functions

---

## Session: 2026-05-29 — Block 2: Fix GitHub Actions CI Failures

### What changed this session

- **`.github/workflows/mobile.yml` updated** — changed `on:` trigger from push-to-main to `workflow_dispatch` only. EAS builds will no longer fire automatically on every push. The `jobs:` block is unchanged and ready for Phase 4. Build step now uses `${{ github.event.inputs.platform || 'all' }}` so platform is selectable when triggered manually.
- **`.github/workflows/web.yml` deleted** — permanently removed. Vercel native Git integration is the authoritative deployment mechanism. No GitHub Actions workflow is needed or desired for web deploys. Do NOT recreate this file.
- **`docs/GITHUB_SECRETS.md` created** — documents what secrets must be added before Phase 4 EAS builds work. See that file for the exact steps.

### Why these changes were made

Both workflows were firing on every push to main and failing with missing secrets (`EXPO_TOKEN`, `VERCEL_TOKEN`, etc.), generating noise email alerts. Vercel native deployment was already working correctly — the web workflow was entirely redundant. The mobile workflow needs `EXPO_TOKEN` which won't exist until Phase 4 Step 8.

### Commits this session

| Hash | Message |
|---|---|
| `aa43093` | chore: disable mobile CI auto-trigger — manual workflow_dispatch only |
| `28cc201` | chore: remove redundant Vercel web CI — Vercel native Git integration handles deployments |
| `c7bc4c2` | docs: add GITHUB_SECRETS.md — document required secrets for Phase 4 EAS build |

### Phase 4 Step 8 note — IMPORTANT

Before starting EAS builds in Phase 4 Step 8:
1. Go to expo.dev → Account Settings → Access Tokens → Create token
2. Add `EXPO_TOKEN` to GitHub → Repository → Settings → Secrets and variables → Actions
3. Update `mobile.yml`: restore the push trigger (replace `on: workflow_dispatch:` with push trigger on `apps/mobile/**` and `packages/shared/**` on main)
See `docs/GITHUB_SECRETS.md` for full reference.

### Decisions made this session (do not reverse)

- `web.yml` deleted permanently. Vercel native is the deployment mechanism. Do not recreate.
- `mobile.yml` is manual-only until Phase 4 Step 8. Do not restore push trigger before adding `EXPO_TOKEN`.

---

## Session: 2026-05-27

### What changed this session

- **File system audit** — found 3 copies of the project; OneDrive Desktop confirmed as canonical source
- **Cleanup completed** — moved `FLIPPD/` → `flippd-archive/`, `Ebay/` → `ebay-business/`, `Flippd - Copy` removed; deleted 852MB `FLIPPD.zip` from Projects copy
- **Deleted duplicate** — `C:\Users\bbake\Projects\scanforprofit` removed entirely (required robocopy workaround for MAX_PATH issue in nested skills folder)
- **Git initialized** — `git init`, branch set to `main`
- **.gitignore updated** — added `.expo/`, `.turbo/`, `coverage/`, `*.zip`, `*.tsbuildinfo`
- **docs/ subfolders created** — `docs/decisions/`, `docs/strategy/`, `docs/marketing/` with placeholder READMEs
- **Initial commit** — `c6d2000` — 84 files, 22,689 insertions
- **Remote added** — `https://github.com/bbaker71313/scanforprofit.git`; force-pushed over stale remote history (old single-file Flippd repo)
- **CLAUDE.md written** — `d9ea970` — full session protocol, Karpathy rules, verification checks, build status
- **Type fix** — `apps/web/lib/supabase-server.ts` — added explicit `CookieOptions` types to cookie handler params (6 implicit `any` errors resolved)
- **tsbuildinfo excluded** — `*.tsbuildinfo` added to `.gitignore`, unstaged from git

### Commits this session

| Hash | Message |
|---|---|
| `c6d2000` | chore: initial commit — monorepo scaffold, design system, UI components |
| `d9ea970` | docs: update CLAUDE.md with session protocol, Karpathy rules, verification checks |
| `7a67b3e` | fix: add explicit types to supabase-server cookie handlers, exclude tsbuildinfo |

### Next task

**Phase 3 Step 3** — Component Library rebuild with `frontend-design` skill
- Target: `apps/mobile/components/ui/` (10 components already scaffolded)
- Read `docs/BRAND_IDENTITY.md` and `packages/shared/src/constants/theme.ts` before starting
- Use NativeWind 4 only — no StyleSheet
- Port from `Flippd_v5_23.html` per `docs/FEATURE_TRIAGE.md`

### Decisions made this session (do not reverse)

- OneDrive Desktop (`C:\Users\bbake\OneDrive\Desktop\scanforprofit`) is the canonical project location
- GitHub remote force-pushed — old Flippd single-file history discarded intentionally
- Shared package name is `@sfp/shared` — all mobile components already import from this correctly

---

## Session: 2026-05-26

### What changed this session

- **Created `README.md`** — new file, ScanForProfit branding, current V1 feature set from `docs/FEATURE_TRIAGE.md`, monorepo structure, subscription tiers, dev commands, key constraints.
- **Audited `CLAUDE.md`** — file does not exist yet. Nothing to update.
- **Created `docs/HANDOFF.md`** (this file) — persistent session context established.

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

- Project ID: `dqgfpchkheznvanfgsmx`
- Anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ2ZwY2hraGV6bnZhbmZnc214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjE5MjQsImV4cCI6MjA5MzEzNzkyNH0.mAViqTT9u5_iXikax9ZOr9b2i9UzecrGiY9kLI-Egdo`
- Auth: custom email/password + verification (NOT Supabase Auth)

## Stripe (livemode)

| Plan | Product ID | Monthly Price ID | Annual Price ID |
|---|---|---|---|
| SFP Hustle | `prod_UaFBtgUANzpzCh` | `price_1Tb4hLId3kJSEdqMH7SYN3a8` ($19/mo) | `price_1Tb4hOId3kJSEdqMiMUrnFm2` ($180/yr) |
| SFP Stack | `prod_UaFBJA9wZ0he0J` | `price_1Tb4hRId3kJSEdqMq9XwGKbZ` ($49/mo) | `price_1Tb4hTId3kJSEdqMB21L5giT` ($480/yr) |
| SFP Empire | `prod_UaFB8CpVCfDjWp` | `price_1Tb4hWId3kJSEdqMFrtyqDkK` ($199/mo) | _(none)_ |
