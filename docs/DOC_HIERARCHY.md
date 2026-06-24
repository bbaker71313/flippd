# ScanForProfit — Documentation Hierarchy

**Created:** 2026-06-24 (Phase 0 doc cleanup)  
**Purpose:** Single map of which docs are authoritative, what they cover, and when to update them. Read this before editing any documentation.

---

## The rule

When two docs disagree, **the higher tier wins**. Fix the lower tier — do not debate in chat.

---

## Tier 1 — Live product (behavior truth)

| File | Authoritative for | Update when |
|------|-------------------|-------------|
| `apps/web/public/app.html` | Everything users can do today: UI labels, flows, API calls, client logic | Any shipped web feature change |
| `supabase/functions/*/index.ts` | Server endpoints, auth, Stripe, eBay, AI proxy | Any edge function change |
| `packages/shared/src/types/index.ts` | TypeScript types shared across apps | Schema or type changes |
| `packages/shared/src/utils/calcProfit.ts` | Profit math (never duplicate elsewhere) | Calculation rule changes |

---

## Tier 2 — Human-readable current state

| File | Authoritative for | Update when |
|------|-------------------|-------------|
| `docs/CURRENT_STATE.md` | Plain-English summary: what's live, what's not, how to sign up, stack overview | Weekly or at each release |
| `docs/DOC_AUDIT.md` | Known doc debt: stale claims, broken links, grep hits | After each doc cleanup phase |
| `docs/DOC_HIERARCHY.md` | This file — doc architecture and update rules | When doc structure changes |

---

## Tier 3 — Locked decisions and feature specs

| File | Authoritative for | Update when |
|------|-------------------|-------------|
| `docs/files/DECISIONS.md` | Product/tech/business decisions that must not be relitigated | When a decision is finalized |
| `docs/FEATURE_TRIAGE.md` | Feature inventory (F-01…), AI prompts (port verbatim), port/rebuild/defer notes | New feature or prompt change |
| `docs/ScanForProfit_v5_24.html` | Historical business-logic reference (prompts, calculations) | Only if porting a missing rule from legacy |
| `docs/BRAND_IDENTITY.md` | Logo, colors, typography, spacing tokens | Brand changes |

**Note:** `FEATURE_TRIAGE.md` header still claims Phase 4 mobile RN is complete — **contradicts Tier 1**. Treat the feature inventory + prompts as authoritative; treat the build-status header as stale until Phase 3 fix.

---

## Tier 4 — Agent and developer workflow

| File | Authoritative for | Update when |
|------|-------------------|-------------|
| `CLAUDE.md` | Monorepo layout, session protocol, stack, agent rules | Stack or workflow changes only |
| `docs/HANDOFF.md` | Session-to-session context for AI agents | End of every dev session |
| `docs/GITHUB_SECRETS.md` | Secret *names* (never values) | New env var or Supabase secret |
| `.env.example` | Required environment variables for local dev | New env var added |

**Note:** `HANDOFF.md` is a session log, not onboarding docs. Keep recent sessions at top; archive older entries monthly.

---

## Tier 5 — Marketing and launch (must match Tier 1–2)

| File | Authoritative for | Update when |
|------|-------------------|-------------|
| `apps/web/public/index.html` | Live landing page copy and waitlist CTA | Marketing copy changes |
| `docs/marketing/directory-copy.md` | Directory submission copy | Before any directory submit |
| `docs/marketing/submission-readiness.md` | Launch submission checklist | Pre-launch |
| `docs/files/product-marketing-context.md` | Positioning, personas, messaging | Positioning changes |
| `docs/files/LAUNCH_CHECKLIST.md` | Phase 6 launch tasks | Launch planning |

Marketing docs **must not** claim features that Tier 1 does not implement.

---

## Tier 6 — Archive (historical only — do not follow)

Move here in Phase 4; do not delete until reviewed.

| File | Why archived |
|------|--------------|
| `docs/files/LEGACY_APP_INTEGRATION.md` | Flippd + Replit backend — decommissioned |
| `docs/files/LEGACY_BACKEND_LIVE.md` | Replit architecture — decommissioned |
| `docs/SESSION_2_3_PROMPT.md` | One-off design session prompt (FLIP rename) — historical |
| `docs/ScanForProfit_v5_24.html` | Keep in place as reference, but label as legacy source in new docs |

---

## README.md — special case

`README.md` is the **GitHub front door**. It is not authoritative for product behavior. It should:

1. Link only to files that exist
2. Mirror `docs/CURRENT_STATE.md` for feature claims
3. Point developers to `CLAUDE.md` + `DOC_HIERARCHY.md`

**Status (2026-06-24):** Rewritten in Phase 2 — links verified against existing docs.

---

## Update triggers (Definition of Done for features)

When shipping any user-visible feature:

1. **Tier 1** — code in `app.html` / edge functions
2. **Tier 2** — one line in `CURRENT_STATE.md` (once it exists)
3. **Tier 3** — update `FEATURE_TRIAGE.md` status if applicable
4. **Tier 4** — session note in `HANDOFF.md`
5. **Tier 5** — grep marketing docs for stale claims if user-facing copy changed

---

## What NOT to create

- Do **not** write a full PRD — use `CURRENT_STATE.md` + `FEATURE_TRIAGE.md` + `DECISIONS.md`
- Do **not** duplicate architecture docs until `docs/DEV_SETUP.md` / `docs/ARCHITECTURE.md` are actually written (Phase 4)
- Do **not** link to docs that do not exist — remove the link or create the file first

---

## Live vs planned — quick reference (2026-06-24)

Use this table in README, marketing, and `CURRENT_STATE.md`. Full evidence in `DOC_AUDIT.md`.

| Area | Status |
|------|--------|
| Web app at `/app.html` | ✅ Live |
| Auth (register, verify, login, reset) | ✅ Live |
| AI scan (single + shelf) | ✅ Live |
| Inventory + photos | ✅ Live |
| Listing generator + CSV export | ✅ Live |
| Profit Compass (Growth Agent) | ✅ Live |
| Profit Hub (P&L + expenses) | ✅ Live |
| Settings (fees, tax, mileage) | ✅ Live |
| Landing waitlist capture | ✅ Live |
| Stripe upgrade checkout | 🟡 Built — E2E not verified |
| eBay OAuth + listing push + order sync | 🟡 Built — prod E2E pending |
| PostHog event tracking | 🟡 Initialized — not verified |
| Sentry | ⬜ Not in live app |
| Mobile app (Expo) | ⬜ Not shipped |
| App access codes | 🗄️ Removed — never document |
| Replit / Flippd backend | 🗄️ Decommissioned |
