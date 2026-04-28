# Flippd Backend — Production API

Backend for Flippd reseller app. Handles auth, subscriptions, inventory, and AI proxy.

## Architecture

```
Flippd App (Flippd_v5.html)
        ↓
   Replit Backend (this repo)
   ├─ Magic Link Auth (Resend)
   ├─ JWT Sessions (90-day expiry)
   ├─ User DB (Replit DB)
   ├─ Inventory (server-side)
   ├─ Anthropic Proxy (tier-gated)
   └─ Stripe Checkout + Webhooks
        ↓
   Stripe (subscriptions)
   Anthropic (AI scans)
   Resend (transactional email)
```

## Tier System

| Tier | Scans | Inventory | Trial |
|------|-------|-----------|-------|
| **Trial** | Unlimited | Unlimited | 7 days, full Empire access |
| **Scout** (free) | 25/mo | 10 items | After trial expires |
| **Hustle** ($19/mo) | Unlimited | 500 items | Paid |
| **Stack** ($49/mo) | Unlimited | Unlimited | Paid |
| **Empire** ($199/mo) | Unlimited | Unlimited | Paid (10 seats) |

After 7-day trial, users auto-downgrade to Scout — no lockout, just feature limits.

---

## Deployment to Replit

### Step 1: Upload to GitHub

Upload these files to a GitHub repo (e.g., `bbaker71313/flippd-backend`):
- `index.js`
- `package.json`
- `.replit`
- `.gitignore`
- `README.md`

### Step 2: Import to Replit

1. Go to https://replit.com
2. **+ Create Repl** → **Import from GitHub**
3. Paste your repo URL
4. Click **Import from GitHub**
5. Replit auto-installs dependencies

### Step 3: Add Secrets

Click the lock icon (🔒 Secrets) and add **all** of these:

```
ANTHROPIC_API_KEY=sk-ant-api03-...
RESEND_API_KEY=re_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... (added after Step 5)
STRIPE_PRICE_HUSTLE_MONTHLY=price_...
STRIPE_PRICE_HUSTLE_ANNUAL=price_...
STRIPE_PRICE_STACK_MONTHLY=price_...
STRIPE_PRICE_STACK_ANNUAL=price_...
STRIPE_PRICE_EMPIRE_MONTHLY=price_...
STRIPE_PRICE_EMPIRE_ANNUAL=price_...
JWT_SECRET=any_random_32_char_string
APP_URL=https://flippd.com (or your Flippd app URL)
API_URL=https://flippd-backend.bbaker71313.repl.co (your Repl URL)
```

### Step 4: Run

Click the green **▶ Run** button. You should see:
```
🚀 Flippd Backend running on port 3000
```

Your URL will be: `https://flippd-backend.bbaker71313.repl.co`

### Step 5: Set Up Stripe Webhook

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click **Add endpoint**
3. Endpoint URL: `https://flippd-backend.bbaker71313.repl.co/stripe/webhook`
4. Events to send:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add it as `STRIPE_WEBHOOK_SECRET` in Replit Secrets
7. Restart your Repl

### Step 6: Update Flippd App

In `Flippd_v5.html`, the auth flow needs updating:
- Replace access code prompt with email signup
- Use JWT from `localStorage.getItem('flippd_jwt')` for API calls
- Update API base URL to your Replit URL

(See `APP_INTEGRATION.md` for details)

---

## API Endpoints

### Authentication

**`POST /auth/request-link`**
```json
{ "email": "user@example.com" }
```
Sends magic link email. First time = creates account + starts 7-day trial.

**`GET /auth/verify?token=...`**
Magic link target. Returns HTML that stores JWT and redirects to app.

**`GET /auth/me`** (requires `Authorization: Bearer <jwt>`)
Returns current user info, tier, limits, scan usage.

### Subscriptions

**`POST /stripe/checkout`** (auth)
```json
{ "tier": "hustle", "interval": "month" }
```
Returns Stripe Checkout URL. Redirect user there.

**`POST /stripe/portal`** (auth)
Returns Stripe Customer Portal URL for self-serve billing.

**`POST /stripe/webhook`**
Handles Stripe events (signature verified). Updates user subscription state.

### Inventory

**`GET /inventory`** (auth) — list user's items
**`POST /inventory`** (auth) — add item (enforces tier limit)
**`PUT /inventory/:id`** (auth) — update item
**`DELETE /inventory/:id`** (auth) — delete item

### AI Proxy

**`POST /v1/messages`** (auth) — proxy to Anthropic, enforces scan limits

---

## Database Schema (Replit DB)

| Key | Value |
|-----|-------|
| `user:<userId>` | User object |
| `email:<email>` | userId (lookup) |
| `magic:<token>` | Magic link payload (15-min TTL) |
| `inventory:<userId>` | Array of inventory items |
| `ebay:<userId>` | eBay OAuth tokens (future) |

### User Object

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "createdAt": "2026-04-27T...",
  "trialEndsAt": "2026-05-04T...",
  "subscription": {
    "stripeSubscriptionId": "sub_...",
    "status": "active",
    "tier": "hustle",
    "interval": "month",
    "currentPeriodEnd": "...",
    "cancelAtPeriodEnd": false
  },
  "stripeCustomerId": "cus_...",
  "scansThisMonth": 12,
  "scansResetAt": "2026-04-01T..."
}
```

---

## Local Development

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... \
RESEND_API_KEY=re_... \
STRIPE_SECRET_KEY=sk_test_... \
node index.js
```

Server runs on `http://localhost:3000`.

---

## Production Checklist

- [ ] Domain verified in Resend (replace `onboarding@resend.dev`)
- [ ] Stripe in live mode (replace test keys with live)
- [ ] Webhook endpoint added in Stripe live mode
- [ ] Custom domain pointed to Replit deployment
- [ ] CORS restricted to `flippd.com` only
- [ ] Rate limiting added to auth endpoints
- [ ] Error monitoring (Sentry) wired up
- [ ] Backups of Replit DB scheduled

---

## Costs

- **Replit:** Free tier supports thousands of users
- **Resend:** 100 emails/day free, $20/mo for 50k
- **Stripe:** 2.9% + $0.30 per transaction
- **Anthropic:** ~$0.02-0.05 per scan
- **Replit DB:** Free, included
