# ScanForProfit

**Scan the shelf. Know what to buy.**

ScanForProfit is a reseller operating system for solo eBay sellers. It helps you decide what to buy, what to list, what to price, and what to stop buying by combining live market trends, seller-specific profit math, inventory tracking, and business advice in one app.

Live app: [scanforprofit.com/app.html](https://scanforprofit.com/app.html)

---

## What’s live

| Feature | Status |
|---------|--------|
| Profit Scanner — scan one item or a whole shelf photo for HOT / LIST / SKIP decisions | ✅ |
| Business Compass — market trends, category performance, seasonal sourcing, hunt lists, and actionable business advice | ✅ |
| Inventory — cost, sell price, status, photos, and account sync | ✅ |
| AI Listing Generator — drafts titles and descriptions from photos and scan results, based on the condition you select | ✅ |
| CSV Export + ZIP Backup — eBay bulk upload + full backup | ✅ |
| Profit Hub — revenue, expenses, fees, tax reserve, mileage, profit, margin, ROI, category performance, top performers, at-risk items, and sales trends | ✅ |
| Photo Tools — free sharpen/crop/adjust tools plus paid enhancement via remove.bg API | ✅ |
| Configurable math — eBay fee %, packaging, shipping, ROI, tax reserve, and mileage settings | ✅ |
| Stripe upgrade checkout | 🟡 Built — end-to-end verification pending |
| eBay OAuth + listing push + order sync | 🟡 Built — prod E2E pending |

Full status + evidence: [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md)

---

## What makes ScanForProfit different

- Profit Scanner: scan a single item or a whole shelf photo to get HOT / LIST / SKIP decisions backed by real profit math, using your own settings for eBay fees, packaging, shipping, minimum profit, minimum ROI, tax, mileage, and related costs.
- Business Compass: a growth advisor that analyzes your store performance and the live market to surface top-performing categories, seasonal opportunities, trend shifts, and a hunt list of what to source next.
- AI tools: the app helps you improve photos and draft listings quickly, but keeps uncertainty visible so you can verify condition, completeness, and final details before publishing.
- End-to-end workflow: scan → inventory → listing → sync → profit tracking, all in one app.

---

## Get started

### Users

1. Go to [scanforprofit.com/app.html](https://scanforprofit.com/app.html).
2. Sign up with email and password.
3. Verify your email from the inbox link.
4. Log in and scan your first item.

No access codes or invites. The homepage “Get early access” button is a waitlist for updates — it does not gate the app.

### Developers

```bash
git clone https://github.com/bbaker71313/scanforprofit.git
cd scanforprofit
pnpm install
cp .env.example .env    # minimum: fill in NEXT_PUBLIC_SUPABASE_ANON_KEY
pnpm --filter @sfp/web dev
```

The dev server starts at `localhost:3000`. The live product is `apps/web/public/app.html` — edit that file directly; no build step is needed for `/app.html`, since Next.js serves it as a static file through Vercel.

Edge function secrets for Anthropic, Stripe, and eBay are stored in Supabase.

---

## Product overview

ScanForProfit is built for sellers who want to move fast without losing control of the math. It combines visual item scanning, live marketplace signals, configurable profit thresholds, and business dashboards so you can make better sourcing and pricing decisions.

It is designed around a simple workflow:
1. Scan an item or a shelf.
2. Review the profit result and market signals.
3. Decide whether to buy, list, or skip.
4. Draft a listing or add the item to inventory.
5. Track sales, expenses, mileage, and profit over time.

---

## Core features

### Profit Scanner

Profit Scanner is the main decision engine. You can scan one item or a whole shelf photo, and the app returns a HOT / LIST / SKIP decision with estimated profit math, market intelligence, and condition-aware recommendations based on the evidence available and your own settings.

### Business Compass

Business Compass is the growth agent and sourcing advisor. It analyzes your recent sales, inventory, and live eBay trend signals to surface top-performing categories, weak categories, seasonal opportunities, a weekly hunt list, and action items for stale inventory.

### Inventory

Inventory tracks the items you own and sell. It supports unlisted, listed, and sold states, photos, costs, prices, category organization, and sync with your account so you can keep your business organized.

### AI Listing Generator

The listing generator drafts eBay-ready titles, descriptions, and item specifics from photos and scan results. It uses the condition you select and keeps uncertain details flagged for seller review instead of guessing.

### Photo Tools

The Photo tab helps you improve item photos before listing. Basic tools are available for free, including sharpen, crop, and light adjustment. A paid boost path can use the remove.bg API for stronger enhancement and background removal. [web:43][web:59]

### Profit Hub

Profit Hub is the business dashboard. It shows revenue, costs, fees, tax reserve, mileage, net profit, margin, ROI, category performance, top performers, at-risk items, sales trends, recent sales, and expense tracking.

### Expenses

The Expenses tab lets you log business costs such as gas, shipping supplies, storage, platform fees, equipment, and other operating expenses. Those entries feed into your overall profit calculations so you can see a more accurate picture of your business.

### Mileage Logger

The mileage logger records business driving for sourcing, shipping, and other resale-related travel. The app shows your mileage rate in settings and tracking screens; for 2026, the IRS business standard mileage rate is 72.5 cents per mile. [web:44][web:49][web:51]

### Settings

Settings control the math behind the app. You can set your minimum profit, target ROI, maximum days to sell, eBay fee %, packaging cost, sourcing style, tax reserve %, mileage rate, photo API key, backup options, and eBay account controls.

---

## What each tab does

### Dashboard

The dashboard gives you a quick read on current business performance. It summarizes revenue, net profit, fees, ROI, and margin so you can see whether your store is moving in the right direction.

### Expenses

The Expenses tab is for logging operating costs and mileage-related data. It is meant to keep your books closer to reality by capturing the real cost of running your resale business.

### Plan

The Plan tab shows your current subscription state and upgrade options. It also connects to payment and account status so you know whether you are on trial or an active paid plan.

---

## Photo workflow

The photo workflow is designed to be fast and practical. Use the free tools for quick cleanup when you just need a sharper, better-cropped image.

If you want a stronger enhancement pass, the paid boost path can use the remove.bg API to handle background removal and more advanced image cleanup. This is intended to help listings look more polished without requiring external editing software. [web:43][web:59]

---

## Settings details

The settings page includes the main business controls used by the scanner and dashboard.

- Decision thresholds: minimum profit, target ROI, and maximum days to sell.
- Fee assumptions: eBay fee %, packaging cost, and other resale costs.
- Sourcing style: Conservative, Balanced, or Aggressive.
- Tax and mileage: tax reserve % and mileage rate.
- Photo tools: remove.bg API key for paid enhancement.
- Backup and restore: download a full JSON backup or restore from one.
- Account controls: eBay connection, plan status, password reset, and sign out.

Your exact numbers drive the scanner’s decisions, so the app is tuned to your business instead of a generic reseller profile.

---

## Architecture
scanforprofit/ pnpm monorepo + Turborepo
├── apps/web/public/app.html ← LIVE PRODUCT (edit this, no build needed)
├── apps/web/ Next.js 15 shell (routing, deploy, landing page)
├── apps/mobile/ Expo RN scaffold — not shipped
├── apps/video/ Remotion ad compositions
├── packages/shared/ @sfp/shared — types, profit math, tiers
└── supabase/
├── functions/ Edge Functions (Deno/TypeScript)
└── migrations/ PostgreSQL schema + RLS policies


| Layer | Stack |
|-------|-------|
| Live product | `app.html` — vanilla HTML/CSS/JS, no framework |
| Hosting | Vercel (Next.js 15 shell; `/app.html` served as static file) |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth + `auth` edge function |
| AI | Claude Sonnet via `claude-proxy` |
| Payments | Stripe via `stripe-checkout` + `stripe-webhook` |
| eBay | `ebay-oauth` edge function |
| Client storage | JWT + settings in `localStorage`; photos in IndexedDB; inventory on server |

---

## Documentation

| Doc | What it's for |
|-----|---------------|
| [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) | What’s live, what’s pending, and how to sign up |
| [`docs/DOC_HIERARCHY.md`](docs/DOC_HIERARCHY.md) | Which doc wins when sources disagree |
| [`docs/FEATURE_TRIAGE.md`](docs/FEATURE_TRIAGE.md) | Feature inventory + AI prompts |
| [`docs/files/DECISIONS.md`](docs/files/DECISIONS.md) | Locked product and tech decisions |
| [`docs/BRAND_IDENTITY.md`](docs/BRAND_IDENTITY.md) | Logo, colors, typography |
| [`CLAUDE.md`](CLAUDE.md) | Monorepo rules + AI agent session protocol |

---

## Privacy

Inventory and account data are stored on Supabase. Photos are cached in-browser in IndexedDB, and scan photos are sent to the AI API for analysis only.

See [privacy.html](https://scanforprofit.com/privacy.html) and [terms.html](https://scanforprofit.com/terms.html) for the full legal text. [web:24]

---

## Support

- Email: [support@scanforprofit.com](mailto:support@scanforprofit.com)
- Issues: [github.com/bbaker71313/scanforprofit/issues](https://github.com/bbaker71313/scanforprofit/issues)

---

## Roadmap

**Live:** AI scanning, shelf scan, inventory, listing generator, trends and hunt list, Profit Hub, tier gating.

**Next:** Stripe E2E verification, eBay OAuth prod test, PostHog event audit, mobile rebuild.

**Future:** Cross-listing, team features, public launch.

Details: [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md)

---

**Version:** 3.0.0 · **Updated:** June 2026


