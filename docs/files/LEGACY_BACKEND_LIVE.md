# Flippd Backend — Live Architecture Reference

**Version:** 3.0.0  
**Live URL:** https://flippd-backend.replit.app  
**Repo:** bbaker71313/flippd-backend (private)  
**Last updated:** 2025-04-30

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ / Express |
| Database | Supabase PostgreSQL (via `pg` Pool) |
| Auth | bcrypt + JWT (90-day expiry) |
| Email | Resend |
| Payments | Stripe (subscriptions) |
| AI | Anthropic proxy (auth-gated) |
| Ops | Telegram bot notifications |
| Hosting | Replit (always-on via keep-alive ping) |

---

## Environment Variables (Replit Secrets)

| Key | Purpose |
|-----|---------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |
| `RESEND_API_KEY` | Resend email API key |
| `EMAIL_FROM` | Sender address (e.g. `Flippd <hello@flippd.tech>`) |
| `APP_URL` | Backend URL — used in verification email links (e.g. `https://flippd-backend.replit.app`) |
| `FRONTEND_URL` | Frontend URL — used for post-verify redirects (e.g. `https://flippd.tech/Flippd_v5.html`) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_HUSTLE_MONTHLY` | Stripe Price ID |
| `STRIPE_PRICE_HUSTLE_ANNUAL` | Stripe Price ID |
| `STRIPE_PRICE_STACK_MONTHLY` | Stripe Price ID |
| `STRIPE_PRICE_STACK_ANNUAL` | Stripe Price ID |
| `STRIPE_PRICE_EMPIRE_MONTHLY` | Stripe Price ID |
| `STRIPE_PRICE_EMPIRE_ANNUAL` | Stripe Price ID |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Telegram chat ID for ops alerts |

---

## Database Schema

### `users` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | Auto-increment |
| `name` | VARCHAR(100) | Required. Used for dashboard greeting |
| `username` | VARCHAR(50) UNIQUE | Required. Letters, numbers, underscores only |
| `email` | VARCHAR(255) UNIQUE | Required |
| `password` | VARCHAR(255) | bcrypt hash |
| `is_verified` | BOOLEAN | Default FALSE. Must be TRUE to log in |
| `verification_token` | VARCHAR(255) | 32-byte hex token, cleared on verify |
| `verification_token_expires` | TIMESTAMP | 24 hours from registration |
| `tier` | VARCHAR(20) | `trial`, `scout`, `hustle`, `stack`, `empire` |
| `trial_ends_at` | TIMESTAMP | 7 days from registration |
| `scan_count_month` | INT | Resets monthly |
| `scan_reset_date` | DATE | Date of last scan count reset |
| `stripe_customer_id` | VARCHAR(255) | Set on first checkout |
| `stripe_subscription_id` | VARCHAR(255) | Active subscription ID |
| `subscription_status` | VARCHAR(50) | `active`, `past_due`, `canceled` |
| `subscription_period_end` | TIMESTAMP | Current billing period end |
| `created_at` | TIMESTAMP | Default NOW() |

### `inventory` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `user_id` | INT FK | References users(id) |
| `item_id` | VARCHAR(100) | Client-generated ID |
| `sku`, `nickname`, `category`, `condition` | VARCHAR | Optional metadata |
| `date_acquired` | DATE | |
| `platform` | VARCHAR(50) | Default 'eBay' |
| `cost`, `sell_price` | NUMERIC(10,2) | |
| `status` | VARCHAR(50) | Default 'Unlisted' |
| `notes` | TEXT | |
| `photos` | JSONB | Array of photo URLs |
| `created_at` | TIMESTAMP | |

---

## Tier Limits

| Tier | Scans/Month | Max Inventory | Notes |
|------|-------------|---------------|-------|
| `scout` | 25 | 10 | Free tier (post-trial) |
| `hustle` | Unlimited | 500 | Paid |
| `stack` | Unlimited | Unlimited | Paid |
| `empire` | Unlimited | Unlimited | Paid + team seats |
| `trial` | Unlimited | Unlimited | 7-day full access |

---

## Auth Flow — Full Walkthrough

### Registration → Verified → Logged In

```
1. User submits: POST /auth/register
   Body: { name, username, email, password }

2. Backend:
   - Validates all fields present
   - Checks password ≥ 6 chars
   - Validates username format (alphanumeric + underscore)
   - Checks username not taken → 409 {field: "username"} if duplicate
   - Checks email not taken → 409 {field: "email"} if duplicate
     (if email exists but unverified → resends verification email)
   - Hashes password with bcrypt (10 rounds)
   - Generates 32-byte hex verification token (expires 24h)
   - Inserts user row (is_verified = FALSE)
   - Sends branded verification email via Resend
   - Returns: { success: true, message: "Check your email..." }

3. User receives email → clicks "Verify My Account →"
   Link: GET /auth/verify?token=<hex_token>

4. Backend:
   - Finds user by token where is_verified = FALSE
   - Checks token not expired
   - Sets is_verified = TRUE, clears token fields
   - Redirects to: FRONTEND_URL?verified=true

5. User logs in: POST /auth/login
   Body: { username, password }
   (username field accepts either username OR email)

6. Backend:
   - Looks up user by username OR email
   - Compares password with bcrypt
   - If is_verified = FALSE → 403 { error: "email_not_verified" }
   - Issues 90-day JWT
   - Returns: { token, user: { name, username, email, tier, trialEndsAt } }

7. App stores JWT in localStorage
   Uses it as Bearer token on all subsequent requests
```

---

## Endpoints Reference

### Auth

#### `POST /auth/register`
Register a new user. Sends verification email. Does NOT return a JWT.

**Request body:**
```json
{
  "name": "Britt Baker",
  "username": "brittflips",
  "email": "britt@example.com",
  "password": "mypassword123"
}
```

**Validation rules:**
- All four fields required
- `password` must be ≥ 6 characters
- `username` must match `/^[a-zA-Z0-9_]+$/`

**Responses:**

| Status | Body | Meaning |
|--------|------|---------|
| 200 | `{ success: true, message: "Check your email..." }` | Registered, email sent |
| 400 | `{ error: "All fields are required" }` | Missing field |
| 400 | `{ error: "Password must be at least 6 characters" }` | Short password |
| 400 | `{ error: "Username can only contain letters, numbers, and underscores" }` | Bad username |
| 409 | `{ error: "Username already taken", field: "username" }` | Duplicate username |
| 409 | `{ error: "An account with this email already exists.", field: "email" }` | Duplicate email (verified) |
| 409 | `{ error: "...We resent your verification link...", field: "email" }` | Duplicate email (unverified) |
| 500 | `{ error: "Registration failed. Please try again." }` | Server error |

---

#### `GET /auth/verify?token=<token>`
Verifies email address. Called when user clicks link in email.

**Redirects to:**
- `FRONTEND_URL?verified=true` — success
- `FRONTEND_URL?verified=already` — already verified
- `FRONTEND_URL?error=token_expired` — token expired (re-register)
- `FRONTEND_URL?error=invalid_token` — no token provided
- `FRONTEND_URL?error=server_error` — server error

---

#### `POST /auth/login`
Authenticate and receive a JWT. Login by username OR email.

**Request body:**
```json
{
  "username": "brittflips",
  "password": "mypassword123"
}
```
> The `username` field accepts either a username or an email address.

**Responses:**

| Status | Body | Meaning |
|--------|------|---------|
| 200 | `{ token, user: { name, username, email, tier, trialEndsAt } }` | Success |
| 400 | `{ error: "Username and password are required" }` | Missing fields |
| 401 | `{ error: "Incorrect username or password" }` | Wrong credentials |
| 403 | `{ error: "email_not_verified", message: "..." }` | Not verified yet |
| 500 | `{ error: "Login failed. Please try again." }` | Server error |

---

#### `GET /auth/me` — 🔒 Auth required
Returns current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": 1,
  "name": "Britt Baker",
  "username": "brittflips",
  "email": "britt@example.com",
  "tier": "trial",
  "trialEndsAt": "2025-05-07T...",
  "subscription": null,
  "scansThisMonth": 0,
  "scanLimit": null,
  "inventoryCount": 0,
  "inventoryLimit": null,
  "limits": { "scansPerMonth": "Infinity", "maxInventory": "Infinity", "features": [...] }
}
```

---

### Stripe

#### `POST /stripe/checkout` — 🔒 Auth required
Create a Stripe Checkout session.

**Body:** `{ "tier": "hustle", "interval": "month" }`  
Valid tiers: `hustle`, `stack`, `empire`  
Valid intervals: `month`, `year`

**Response:** `{ "url": "https://checkout.stripe.com/..." }`

---

#### `POST /stripe/portal` — 🔒 Auth required
Open Stripe Customer Portal to manage subscription.

**Response:** `{ "url": "https://billing.stripe.com/..." }`

---

#### `POST /stripe/webhook`
Stripe webhook handler. Handles: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`.

---

### Inventory — 🔒 Auth required on all

| Method | Path | Description |
|--------|------|-------------|
| GET | `/inventory` | List all items for authenticated user |
| POST | `/inventory` | Add new item |
| PUT | `/inventory/:id` | Update item by item_id |
| DELETE | `/inventory/:id` | Delete item by item_id |

---

### AI Proxy — 🔒 Auth required

#### `POST /v1/messages`
Proxies to Anthropic API. Enforces scan limits by tier.

**Headers:** `Authorization: Bearer <token>`  
**Body:** Standard Anthropic messages API body

**Rate limit errors:**
```json
{
  "error": "scan_limit_reached",
  "tier": "scout",
  "limit": 25,
  "used": 25,
  "message": "You've used all 25 free scans this month...",
  "upgradeUrl": "/stripe/checkout"
}
```

---

### Utility

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Service info + endpoint list |
| GET | `/health` | `{ status: "ok", ts: "..." }` |

---

## Removed Endpoints (v2 → v3)

These endpoints **no longer exist**. Any code calling them will get a 404:

| Old Endpoint | Replacement |
|-------------|-------------|
| `POST /auth/request-link` | `POST /auth/register` (new users) or `POST /auth/login` (returning users) |
| `GET /auth/verify-link` | `GET /auth/verify?token=...` |

---

## Telegram Notifications

The backend sends ops alerts to `@flippd_ops_bot` for:
- New user registration
- Email verified
- New subscription / upgrade / cancellation
- Payment failure
- Scan limit hit
- Server start
- Errors on critical endpoints
