# ScanForProfit — Current State

**Last updated:** 2026-06-24  
**Audience:** Humans onboarding to the project, marketing review, and doc writers.  
**Authoritative for:** What exists today in production. When this disagrees with README or marketing copy, fix the lower-tier doc — not this file without verifying against `app.html`.

For doc architecture see [`DOC_HIERARCHY.md`](DOC_HIERARCHY.md). For known doc debt see [`DOC_AUDIT.md`](DOC_AUDIT.md).

---

## One-liner

ScanForProfit is an AI-powered sourcing and business tool for solo eBay resellers — scan any item or a full shelf, get a **HOT / LIST / SKIP** decision with real profit math, and run inventory, listings, trends, and P&L from one app.

---

## Who it's for

Solo resellers sourcing from thrift stores, estate sales, garage sales, and flea markets. Primary marketplace: **eBay** (Poshmark, Mercari, Facebook Marketplace are future).

---

## How to use it (users)

| Step | Action |
|------|--------|
| 1 | Go to [scanforprofit.com/app.html](https://scanforprofit.com/app.html) |
| 2 | **Sign Up** with email and password |
| 3 | Verify email from the link sent to your inbox |
| 4 | Log in and start scanning |

**There are no access codes, invite codes, or gatekeeper passwords.** The landing page “Get early access” button is a **waitlist** for product updates — it does not unlock the app.

Marketing may use “LIST or PASS” as plain English; in the app, **PASS = SKIP**.

---

## Live URLs

| URL | What it is |
|-----|------------|
| [scanforprofit.com](https://scanforprofit.com) | Marketing homepage + waitlist |
| [scanforprofit.com/app.html](https://scanforprofit.com/app.html) | **Live product** |
| [scanforprofit.com/privacy.html](https://scanforprofit.com/privacy.html) | Privacy policy |
| [scanforprofit.com/terms.html](https://scanforprofit.com/terms.html) | Terms of service |

---

## What's live today

### Core product (✅)

| Feature | Tab / location | Notes |
|---------|----------------|-------|
| Register, login, email verify, password reset | Auth screen | Supabase Auth via `auth` edge function |
| Single-item AI scan | Profit Scanner | Claude via `claude-proxy`; ~8s typical |
| Shelf scan (rank all visible items) | Profit Scanner | Sorted HOT → LIST → SKIP |
| Scan decisions | HOT / LIST / SKIP | Three tiers — FLIP is retired |
| Inventory CRUD + status tracking | Inventory | Synced to Supabase |
| Item photos | Inventory + Photos | IndexedDB client-side; metadata on server |
| AI listing generator | Inventory / listing modal | Title, description, category |
| eBay CSV export + full ZIP backup | Export flow | JSZip backup with inventory, expenses, scan history |
| CSV / eBay import | Import view | Spreadsheet + eBay active listings + orders |
| Profit Compass (Growth Agent) | Profit Compass tab | Weekly-style business brief + trends |
| Profit Hub (P&L + expenses) | Profit Hub tab | Revenue, profit, expenses, mileage |
| Settings | Settings panel | eBay fee %, packaging, shipping, min profit, target ROI, tax reserve, mileage — all configurable |
| Photo Agent | Photos tab | Crop, enhance, optional remove.bg |
| Tier limits + upgrade UI | Banner + Profit Hub → Subscription | Scout free tier with usage gates |
| Waitlist capture | Landing page | Email only — not app access |

### Five tabs (live display names)

| Tab ID | Display name | Purpose |
|--------|--------------|---------|
| `sourcing` | Profit Scanner | AI scan — single item + shelf mode |
| `inventory` | Inventory | Items, cost, sell price, status, photos |
| `photo` | Photos | Photo management + listing prep |
| `growth` | Profit Compass | Market trends + Growth Agent |
| `dashboard` | Profit Hub | P&L, expenses, subscription |

---

## Built but not fully verified (🟡)

These exist in code and have been deployed; end-to-end production verification is still pending.

| Feature | Status | Blocker / next step |
|---------|--------|---------------------|
| Stripe upgrade checkout | 🟡 | Complete a test purchase on production |
| eBay OAuth connect | 🟡 | Apply prod migration + deploy `ebay-oauth` / `auth` (see HANDOFF) |
| eBay listing push (`/create-listing`) | 🟡 | Requires connected eBay account + sandbox/prod credentials |
| eBay order sync (`/sync-orders`) | 🟡 | Same as above |
| PostHog analytics | 🟡 | SDK initialized in app; event coverage not audited |

---

## Not live yet (⬜)

| Item | Notes |
|------|-------|
| Mobile app (Expo / React Native) | Scaffold in `apps/mobile/` — future rebuild from `app.html` |
| Sentry in live web app | Not wired in `app.html` |
| Cross-listing (Poshmark, Mercari, FB) | Future platforms |
| Public launch / App Store | Phase 6 — see `docs/files/LAUNCH_CHECKLIST.md` |

---

## Deprecated — do not document as current (🗄️)

| Item | Replacement |
|------|-------------|
| Flippd / Replit backend | Supabase edge functions |
| App access codes | Email + password auth (JWT) |
| localStorage-only architecture | Supabase Postgres + hybrid client cache |
| FLIP / FLIP-PASS scan labels | HOT / LIST / SKIP |

---

## Pricing tiers (monthly)

Annual plans are **not** offered in the live product UI. Source: `packages/shared/src/constants/tiers.ts`.

| Tier | Price | Scans/mo | Inventory items |
|------|-------|----------|-----------------|
| Trial | Free (7 days) | Unlimited | Unlimited |
| Scout | Free | 25 | 10 |
| Hustle | $19/mo | 250 | 250 |
| Stack | $49/mo | Unlimited | Unlimited |
| Empire | $199/mo | Unlimited | Unlimited (+ team seats in product roadmap) |

Configurable business defaults (never hardcoded in logic): eBay fee 13%, packaging $1.25, min profit $15, target ROI 200%, mileage $0.67/mi — all user-overridable in Settings.

---

## Technology stack

```
scanforprofit/                    pnpm monorepo + Turborepo
├── apps/web/public/app.html      ← LIVE PRODUCT (single-file HTML/JS)
├── apps/web/                     Next.js 15 shell (landing, API routes, deploy)
├── apps/mobile/                  Expo RN — not shipped
├── apps/video/                   Remotion ad compositions
├── packages/shared/              @sfp/shared — types, calcProfit, tiers, theme
└── supabase/
    ├── functions/                Edge Functions (Deno/TypeScript)
    └── migrations/               PostgreSQL schema + RLS
```

| Layer | Technology |
|-------|------------|
| Live UI | Vanilla JS + HTML/CSS in `app.html` |
| Hosting | Vercel |
| Database | Supabase PostgreSQL (`dqgfpchkheznvanfgsmx`) |
| Auth | Supabase Auth + custom `auth` edge function |
| AI | Claude Sonnet 4.6 via `claude-proxy` (key in Supabase secrets) |
| Payments | Stripe via `stripe-checkout` + `stripe-webhook` |
| eBay | `ebay-oauth` edge function |
| Client storage | JWT + settings cache in localStorage; photos in IndexedDB; inventory/expenses on server |

### Edge functions (7)

`auth` · `claude-proxy` · `stripe-checkout` · `stripe-webhook` · `ebay-oauth` · `export-reminder` · `cron`

---

## Local development (quick start)

```bash
git clone https://github.com/bbaker71313/scanforprofit.git
cd scanforprofit
pnpm install
cp .env.example .env          # fill in Supabase + PostHog keys
pnpm --filter @sfp/web dev    # Next.js dev server → localhost:3000
```

- **Live app logic:** edit `apps/web/public/app.html` directly
- **Landing page:** `apps/web/public/index.html`
- **Edge functions:** `supabase/functions/` — deploy with Supabase CLI
- **Secrets:** set via `supabase secrets set` — see `.env.example` comments

Full agent/dev rules: [`CLAUDE.md`](../CLAUDE.md)

---

## Documentation index (files that exist)

| Doc | Purpose |
|-----|---------|
| [`CURRENT_STATE.md`](CURRENT_STATE.md) | This file — what's live now |
| [`DOC_HIERARCHY.md`](DOC_HIERARCHY.md) | Which doc wins when sources disagree |
| [`DOC_AUDIT.md`](DOC_AUDIT.md) | Stale doc inventory + fix queue |
| [`FEATURE_TRIAGE.md`](FEATURE_TRIAGE.md) | Feature specs + AI prompts (port verbatim) |
| [`files/DECISIONS.md`](files/DECISIONS.md) | Locked product/tech decisions |
| [`HANDOFF.md`](HANDOFF.md) | Session log for AI agents |
| [`BRAND_IDENTITY.md`](BRAND_IDENTITY.md) | Logo, colors, typography |
| [`CLAUDE.md`](../CLAUDE.md) | Monorepo rules + session protocol |
| [`files/DOC_PROCESS.md`](files/DOC_PROCESS.md) | Feature PR DoD + monthly doc hygiene checklist |

---

## Roadmap snapshot

**Shipped in v1 web app:** AI scanning, shelf scan, inventory, listing generator, CSV export/import, Profit Compass, Profit Hub, settings, photo tools, tier gating.

**Next verification milestones:** Stripe E2E, eBay OAuth E2E on production, PostHog event audit.

**Future:** Mobile app rebuild, cross-platform listing, team features, public launch (Phase 6).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-24 | Initial version — Phase 2 doc cleanup |
| 2026-06-24 | Phase 4–5 complete: ARCHITECTURE.md created, marketing docs corrected, DOC_PROCESS.md added |
