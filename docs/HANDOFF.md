# ScanForProfit — Session Handoff

This file is the persistent session context. Update it at the end of every Claude Code session with what changed.

---

## Project Location

`C:\Users\bbake\OneDrive\Desktop\scanforprofit`

## Repo

github.com/bbaker71313/scanforprofit

---

## Session: 2026-05-29 — Correction: Wrong Supabase Project

### What was discovered

The cloud MCP session had credentials for a different Supabase project (`dqgfpchkheznvanfgsmx`, named "Flippd") that was referenced in older docs. That project is NOT Britt's project.

**Britt's actual Supabase project: `gymuhbscxmmcbqoovvud`**

All three Edge Functions (`auth`, `claude-proxy`, `stripe-webhook`) were deployed to the WRONG project. The code in `supabase/functions/` is correct — it just needs to be deployed to the right place.

### What Britt must do (on her laptop)

**Step 1 — Install Supabase CLI if not already installed**
```bash
npm install -g supabase
```

**Step 2 — Apply migrations to correct project**
```bash
cd "C:\Users\bbake\OneDrive\Desktop\scanforprofit"
supabase db push --project-ref gymuhbscxmmcbqoovvud
```

**Step 3 — Deploy all three functions to correct project**

First check out the branch with the function code:
```bash
git fetch origin
git checkout claude/deploy-edge-functions-kHcBm
```

Then deploy:
```bash
supabase functions deploy auth --project-ref gymuhbscxmmcbqoovvud
supabase functions deploy claude-proxy --project-ref gymuhbscxmmcbqoovvud
supabase functions deploy stripe-webhook --project-ref gymuhbscxmmcbqoovvud
```

**Step 4 — Set secrets**
```bash
supabase secrets set JWT_SECRET="$(openssl rand -base64 32)" --project-ref gymuhbscxmmcbqoovvud
supabase secrets set ANTHROPIC_API_KEY="sk-ant-..." --project-ref gymuhbscxmmcbqoovvud
supabase secrets set RESEND_API_KEY="re_..." --project-ref gymuhbscxmmcbqoovvud
supabase secrets set STRIPE_SECRET_KEY="sk_live_..." --project-ref gymuhbscxmmcbqoovvud
supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..." --project-ref gymuhbscxmmcbqoovvud
supabase secrets set EBAY_CLIENT_ID="Brittany-Flippd-PRD-67b75c3f4-fb4ff30c" --project-ref gymuhbscxmmcbqoovvud
```

**Step 5 — Smoke tests**
```bash
# auth — expect 200
curl -X POST https://gymuhbscxmmcbqoovvud.supabase.co/functions/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"TestPass123!","username":"testuser"}'

# claude-proxy health — expect {"status":"ok"}
curl -X POST https://gymuhbscxmmcbqoovvud.supabase.co/functions/v1/claude-proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [anon key from Supabase dashboard]" \
  -d '{"type":"health"}'

# stripe-webhook — expect 400 (missing signature = function is live)
curl -X POST https://gymuhbscxmmcbqoovvud.supabase.co/functions/v1/stripe-webhook \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Step 6 — Add Stripe webhook endpoint**

Stripe Dashboard → Developers → Webhooks → Add endpoint:
`https://gymuhbscxmmcbqoovvud.supabase.co/functions/v1/stripe-webhook`

Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

Copy the `whsec_...` signing secret → add as `STRIPE_WEBHOOK_SECRET` in Supabase secrets.

---

## Session: 2026-05-29 — Backend Recovery: Edge Function Code Written

### What changed this session

- **`supabase/functions/auth/index.ts` created** — full custom auth Edge Function. `POST /auth/register`, `GET /auth/verify`, `POST /auth/login`, `GET /auth/me`. bcryptjs password hashing, Web Crypto API HMAC-SHA256 90-day JWTs. No magic link endpoints.
- **`supabase/functions/claude-proxy/index.ts` created** — Anthropic API proxy with tier-based scan limit enforcement. Health check at `{"type":"health"}` needs no auth.
- **`supabase/functions/stripe-webhook/index.ts` created** — Stripe webhook handler with manual HMAC-SHA256 signature verification. Handles 4 event types.
- **NOTE:** Functions were deployed to wrong project (`dqgfpchkheznvanfgsmx`) in this session. Britt must redeploy to `gymuhbscxmmcbqoovvud` — see correction session above.

### Function URLs (after correct deployment)

| Function | URL |
|---|---|
| `auth` | `https://gymuhbscxmmcbqoovvud.supabase.co/functions/v1/auth` |
| `claude-proxy` | `https://gymuhbscxmmcbqoovvud.supabase.co/functions/v1/claude-proxy` |
| `stripe-webhook` | `https://gymuhbscxmmcbqoovvud.supabase.co/functions/v1/stripe-webhook` |

### Decisions made this session (do not reverse)

- Auth uses custom JWT (HMAC-SHA256, 90-day expiry), NOT Supabase Auth sessions. JWT secret is `JWT_SECRET` env var.
- No magic link endpoints — `/auth/request-link` and `/auth/verify-link` do not exist and must never be added.
- Password hashing: bcryptjs sync (10 rounds) via `https://esm.sh/bcryptjs`.
- Price-to-tier mapping hardcoded in `stripe-webhook/index.ts` — update `PRICE_TIER` map if new Stripe products are added.

### Next task

Deploy functions to correct project (steps above), run smoke tests, confirm all pass.
Then: **Phase 4 — Build mobile app screens against live Edge Functions.**

---

## Session: 2026-05-29 — Block 2: Fix GitHub Actions CI Failures

### What changed this session

- **`.github/workflows/mobile.yml` updated** — `workflow_dispatch` only (no auto-trigger on push)
- **`.github/workflows/web.yml` deleted** — Vercel native Git integration handles deploys. Do NOT recreate.
- **`docs/GITHUB_SECRETS.md` created** — documents required secrets for Phase 4 EAS builds

### Decisions made this session (do not reverse)

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

- **Project ID: `gymuhbscxmmcbqoovvud`** ← Britt's actual project
- Anon key: get from Supabase Dashboard → Project Settings → API
- Auth: custom email/password + verification (NOT Supabase Auth)

## Stripe (livemode)

| Plan | Product ID | Monthly Price ID | Annual Price ID |
|---|---|---|---|
| SFP Hustle | `prod_UaFBtgUANzpzCh` | `price_1Tb4hLId3kJSEdqMH7SYN3a8` ($19/mo) | `price_1Tb4hOId3kJSEdqMiMUrnFm2` ($180/yr) |
| SFP Stack | `prod_UaFBJA9wZ0he0J` | `price_1Tb4hRId3kJSEdqMq9XwGKbZ` ($49/mo) | `price_1Tb4hTId3kJSEdqMB21L5giT` ($480/yr) |
| SFP Empire | `prod_UaFB8CpVCfDjWp` | `price_1Tb4hWId3kJSEdqMFrtyqDkK` ($199/mo) | _(none)_ |
