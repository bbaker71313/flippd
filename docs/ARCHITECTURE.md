# ScanForProfit — Architecture

**Last updated:** June 2026  
**Authoritative source for what's live:** [`docs/CURRENT_STATE.md`](CURRENT_STATE.md)

---

## Live product

The shipped product is a single-file web app:

```
apps/web/public/app.html    ← LIVE PRODUCT — edit this directly, no build step
```

Served at `scanforprofit.com/app.html` via Vercel. Vanilla HTML/CSS/JS — no framework, no bundler. All business logic, UI, and client-side state live in this file.

---

## Monorepo layout

```
scanforprofit/                     pnpm 11 workspaces + Turborepo
├── apps/
│   ├── web/                       Next.js 15 App Router
│   │   ├── public/
│   │   │   ├── app.html           ← LIVE PRODUCT
│   │   │   ├── index.html         Landing page (served at / via rewrite)
│   │   │   ├── privacy.html
│   │   │   └── terms.html
│   │   ├── app/                   Next.js App Router shell (not yet live)
│   │   └── lib/                   supabase-server.ts, supabase-client.ts
│   ├── mobile/                    Expo RN scaffold — NOT shipped; future rebuild reference
│   └── video/                     Remotion 4 ad compositions (@sfp/video)
├── packages/
│   └── shared/                    @sfp/shared — types, profit math, tier constants
│       └── src/
│           ├── types/index.ts     All TypeScript interfaces — single source of truth
│           ├── utils/calcProfit.ts
│           └── constants/         theme.ts, categories.ts, tiers.ts
├── supabase/
│   ├── functions/                 Edge Functions (Deno/TypeScript)
│   └── migrations/                PostgreSQL schema + RLS (9 migrations applied)
└── docs/
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Live product | `app.html` — vanilla HTML/CSS/JS |
| Hosting | Vercel (Next.js 15 shell; `/app.html` served as static file) |
| Database | Supabase PostgreSQL 17 (project: `dqgfpchkheznvanfgsmx`) |
| Auth | Supabase Auth — email verification + password (JWT, 90-day sessions) |
| AI | Claude Sonnet via `claude-proxy` Edge Function (never called from client) |
| Payments | Stripe via `stripe-checkout` + `stripe-webhook` Edge Functions |
| eBay | `ebay-oauth` Edge Function (OAuth 2.0) |
| Email | Resend + React Email via `export-reminder` Edge Function |
| Client storage | JWT + settings in `localStorage`; photos in IndexedDB; inventory on Supabase |

---

## Edge Functions (7 deployed)

| Function | Purpose |
|----------|---------|
| `auth` | Register, verify email, login, password reset |
| `claude-proxy` | Proxy all Anthropic API calls (single item scan, shelf scan, listing gen, growth agent) |
| `stripe-checkout` | Create Stripe Checkout session → returns `{ url }` |
| `stripe-webhook` | Handle Stripe events (subscription updates, payment confirmation) |
| `ebay-oauth` | eBay OAuth 2.0 — authorize, callback, status, disconnect |
| `export-reminder` | Scheduled export reminder emails via Resend |
| `cron` | Scheduled background jobs |

All secrets (Anthropic API key, Stripe keys, eBay credentials) live in Supabase secrets — never in client code or `.env`.

---

## Database tables

| Table | Purpose |
|-------|---------|
| `users` | Account, tier, settings, eBay OAuth nonce |
| `inventory` | Items — cost, price, status, category, photos |
| `scan_log` | AI scan history |
| `settings` | Per-user configurable values (fees, tax, mileage, etc.) |
| `pnl_expenses` | Business expenses for P&L |
| `growth_cache` | Cached Growth Agent output |
| `waitlist` | Landing page email captures |
| `ebay_connections` | eBay OAuth tokens per user |

RLS enabled on all tables. 9 migrations applied (see `supabase/migrations/`).

---

## Client storage model

| Data | Where stored |
|------|-------------|
| JWT session token | `localStorage` |
| User settings cache | `localStorage` |
| Item photos | IndexedDB (browser) |
| Inventory, expenses, scan history | Supabase PostgreSQL (server) |

---

## Routing

`/` → `apps/web/public/index.html` (landing page, via Next.js rewrite in `next.config.js`)  
`/app.html` → `apps/web/public/app.html` (live product, served as static file)  
`/privacy.html`, `/terms.html` → static files in `apps/web/public/`

---

## Key constraints

- **No 6th tab.** 5 tabs only: `sourcing` (Profit Scanner) · `inventory` · `photo` (Photos) · `growth` (Profit Compass) · `dashboard` (Profit Hub).
- **No client-side AI calls.** All Anthropic API calls via `claude-proxy` Edge Function.
- **No hardcoded fees.** eBay fee, tax reserve, mileage rate always from user settings.
- **500-line file limit.** Refactor before hitting it.
- **No `<form>` tags.** Use `onClick`/`onChange` handlers.
- **No StyleSheet in RN.** NativeWind classes only (future mobile rebuild).
