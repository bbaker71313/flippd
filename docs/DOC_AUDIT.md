# ScanForProfit — Documentation Audit

**Audit date:** 2026-06-24  
**Method:** Code review of `app.html` + edge functions, cross-reference against all `.md` docs, link existence check, stale-keyword grep.  
**Next action:** Phase 3 — fix CLAUDE.md header + FEATURE_TRIAGE header; archive legacy docs.

---

## Executive summary

| Category | Count |
|----------|-------|
| Broken links from README | 11 |
| Docs with stale architecture claims | 4 |
| Docs referencing Flippd/Replit as live | 2 (legacy files) |
| Docs with wrong feature status | 3 |
| User-facing strings still saying FLIP (in live app) | ~5 locations in `app.html` |
| Edge functions deployed | 7 (docs say 5) |

---

## Phase 1 — Feature truth audit

Legend: ✅ Live · 🟡 Built but unverified E2E · ⬜ Not built · 🗄️ Deprecated

| Feature | Status | Evidence | Docs that disagree |
|---------|--------|----------|-------------------|
| **Auth — register / verify / login** | ✅ Live | `app.html` auth tabs; `supabase/functions/auth` | README says "early access code" |
| **Auth — password reset** | ✅ Live | `?reset=TOKEN` flow in `app.html` | — |
| **AI single-item scan** | ✅ Live | `analyze()`, `claude-proxy` | README roadmap says comps are "coming v2" |
| **Shelf scan** | ✅ Live | `analyzeShelf()`, HOT/LIST/SKIP sections | — |
| **Scan decisions (HOT / LIST / SKIP)** | ✅ Live | `getDecision()` L6085–6088 | CLAUDE.md, product-marketing say FLIP/PASS |
| **Inventory CRUD + photos** | ✅ Live | `syncFromServer()`, Supabase `inventory`, IndexedDB photos | README says localStorage-only |
| **AI listing generator** | ✅ Live | `generateListingWithAI()` | README roadmap: "Coming v2.0" |
| **eBay CSV export + ZIP backup** | ✅ Live | `generateAndDownloadCSV()`, JSZip backup | — |
| **Import (CSV / eBay)** | ✅ Live | Import tab in `app.html` | — |
| **Growth Agent / Profit Compass tab** | ✅ Live | `runGrowthAgent()`, tab label "Profit Compass" | DECISIONS.md tab names outdated |
| **P&L dashboard + expenses** | ✅ Live | `pnlLoad()`, Profit Hub tab | — |
| **Settings (fees, tax, mileage, ROI)** | ✅ Live | Settings panel, synced to server | — |
| **Photo Agent (crop, enhance, remove.bg)** | ✅ Live | Photos tab, `paRemoveBg()` etc. | — |
| **Tier limits + upgrade UI** | ✅ Live | `updateTierBanner()`, upgrade section | — |
| **Stripe checkout** | 🟡 Built, E2E unverified | `STRIPE_BASE`, `stripe-checkout` function | CLAUDE.md correctly marks unverified |
| **PostHog analytics** | 🟡 Initialized, events unverified | `posthog.init()` in `app.html` L1118 | — |
| **Sentry error tracking** | ⬜ Not in live app | No Sentry in `app.html` | CLAUDE.md lists as audit item |
| **eBay OAuth connect** | 🟡 Built, prod E2E pending | Settings eBay section; `ebay-oauth` function; CSRF nonce fix in HANDOFF | CLAUDE.md: 0 connections |
| **eBay create-listing push** | 🟡 Built, E2E unverified | `handleListOnEbay()` → `/create-listing` | FEATURE_TRIAGE: deferred F-30 |
| **eBay order sync** | 🟡 Built, E2E unverified | `handleSyncOrders()` → `/sync-orders` | — |
| **Waitlist / landing capture** | ✅ Live | `index.html` #early-access, waitlist API | Distinct from app access codes |
| **Mobile RN app** | ⬜ Not live product | Scaffold in `apps/mobile/`; live app is `app.html` | FEATURE_TRIAGE header says ✅ complete |
| **Legacy access codes** | 🗄️ Deprecated | JWT-only session; legacy codes rejected L7762–7763 | README, one toast in `app.html` |
| **Replit / Flippd backend** | 🗄️ Deprecated | Supabase edge functions | LEGACY_*.md still describe as live |

### Live app tab names (actual vs documented)

| Tab ID | Display name in `app.html` | DECISIONS.md says | CLAUDE.md says |
|--------|----------------------------|-------------------|----------------|
| `sourcing` | Profit Scanner | Scout | SCANNER |
| `inventory` | Inventory | Inventory | INVENTORY |
| `photo` | Photos | Listing | PHOTOS |
| `growth` | Profit Compass | Trends | PULSE |
| `dashboard` | Profit Hub | Stats | P&L |

**Action (Phase 3):** Update DECISIONS.md and CLAUDE.md tab table to match live labels or document ID vs display name explicitly.

---

## Phase 1 — Link audit

### README.md broken links (file does not exist)

| Link target | Status |
|-------------|--------|
| `docs/INSTALL.md` | ❌ Missing |
| `docs/ARCHITECTURE.md` | ❌ Missing |
| `docs/DEPLOYMENT.md` | ❌ Missing |
| `docs/API_INTEGRATION.md` | ❌ Missing |
| `docs/DATA_MODEL.md` | ❌ Missing |
| `docs/public/PRICING.md` | ❌ Missing (no `docs/public/` folder) |
| `docs/public/FAQ.md` | ❌ Missing |
| `docs/public/ROADMAP.md` | ❌ Missing |
| `legal/PRIVACY.md` | ❌ Missing (privacy lives at `apps/web/public/privacy.html`) |
| `CONTRIBUTING.md` | ❌ Missing |
| `LICENSE` | ❌ Missing |

### README.md links that work

| Link | Status |
|------|--------|
| `https://scanforprofit.com` | ✅ |
| `mailto:support@scanforprofit.com` | ✅ (unverified mailbox) |
| GitHub issues URL | ⚠️ Placeholder `yourusername` |

### Internal doc cross-links to verify in Phase 4

- `DECISIONS.md` → `RESEARCH_PRICING_VALIDATION.md` — file not found in repo
- `CLAUDE.md` → `docs/playbook.html` — ✅ exists

---

## Phase 1 — Stale keyword grep

### "Early access code" / app gatekeeping

| File | Issue | Priority |
|------|-------|----------|
| `README.md` L18–22 | "Enter your early access code" — **false**; auth is email + password | P0 |
| `README.md` L89 | "Early Access" version label | P1 |
| `apps/web/public/app.html` L3164 | Toast: "Access code required" — legacy; should say "Log in required" | P1 |
| `apps/web/public/index.html` | "Get early access" waitlist CTA — **valid** (waitlist ≠ app code) | OK |
| `docs/files/LAUNCH_CHECKLIST.md` | References early access users/discounts — review at launch | P2 |

### "FLIP" (deprecated scan terminology)

| File | Issue | Priority |
|------|-------|----------|
| `CLAUDE.md` L57 | "FLIP/PASS decisions" | P0 |
| `docs/files/product-marketing-context.md` | "FLIP or PASS" one-liner + taglines | P0 |
| `apps/web/public/app.html` | Setting desc "get a FLIP"; empty state "tap FLIP"; AI prompt "Min profit for FLIP" | P1 |
| `apps/web/public/index.html` L805 | Mock UI shows "FLIP" decision badge | P1 |
| `docs/ScanForProfit_v5_24.html` | Legacy source — keep as-is, do not copy to new docs | Archive |
| `apps/web/public/mockups/*` | Design mockups — low priority | P3 |

### "Flippd" / Replit as live stack

| File | Issue | Priority |
|------|-------|----------|
| `docs/files/LEGACY_APP_INTEGRATION.md` | Entire file — Flippd + Replit | Archive P0 |
| `docs/files/LEGACY_BACKEND_LIVE.md` | Entire file — Replit backend | Archive P0 |
| `README.md` L30 | Points to `src/app/ScanForProfit_v5.html` — path wrong | P0 |
| `README.md` L36–38 | Vanilla JS, localStorage primary, no build step | P0 |

### "localStorage as primary storage"

| File | Issue | Priority |
|------|-------|----------|
| `README.md` L38, L56 | Claims all data on device in localStorage | P0 |
| `FEATURE_TRIAGE.md` | Many localStorage refs — accurate for **source HTML porting**, not live architecture | P2 (add header note) |
| `app.html` | Uses localStorage for JWT + settings cache; **inventory/expenses on Supabase** | OK (hybrid) |

### Wrong feature status

| File | Claim | Reality | Priority |
|------|-------|---------|----------|
| `README.md` L76 | Listing generator "Coming v2.0" | Live in app.html | P0 |
| `README.md` L76 | Live eBay comps "Coming v2.0" | Partially live (AI comps + eBay sync built) | P1 |
| `FEATURE_TRIAGE.md` L7–25 | Phase 4 mobile RN ✅ complete | Mobile scrapped; web app.html is live | P0 |
| `CLAUDE.md` L577 | "5 Edge Functions" | 7 functions exist (includes `cron`, `export-reminder`) | P2 |

---

## Priority fix queue

### P0 — Wrong on first read (Phase 3)

1. `README.md` — full rewrite against feature audit
2. `FEATURE_TRIAGE.md` — replace Phase 4 mobile header with web-first status
3. `CLAUDE.md` L57 — FLIP/PASS → HOT/LIST/SKIP (or marketing shorthand per DECISIONS)
4. `docs/files/product-marketing-context.md` — terminology + early access goal
5. Archive `LEGACY_*.md`

### P1 — User-facing strings in live product (separate code PR)

1. `app.html` — replace remaining FLIP strings and "Access code required" toast
2. `index.html` — update demo FLIP badge to LIST or HOT
3. `DECISIONS.md` — tab names vs display names

### P2 — Fill gaps or remove links (Phase 4)

1. Create `docs/DEV_SETUP.md` OR fold into README (replaces ghost `INSTALL.md`)
2. Create `docs/ARCHITECTURE.md` (~1 page) OR defer and remove README links
3. Trim `HANDOFF.md` — archive sessions older than 2026-06-01

### P3 — Low urgency

1. Mockup HTML files in `apps/web/public/mockups/`
2. `docs/SESSION_2_3_PROMPT.md` → archive
3. `docs/playbook.html` — large HTML playbook; audit separately

---

## Stack truth (for CURRENT_STATE.md)

**What the live product actually is (2026-06-24):**

- **Live app:** `https://scanforprofit.com/app.html` — single-file HTML/JS (`apps/web/public/app.html`)
- **Landing:** `apps/web/public/index.html` (waitlist capture, not app gate)
- **Hosting:** Vercel (Next.js 14 shell; `/` rewrites to `index.html`)
- **Backend:** Supabase project `dqgfpchkheznvanfgsmx`
  - PostgreSQL + RLS
  - Edge Functions: `auth`, `claude-proxy`, `stripe-checkout`, `stripe-webhook`, `ebay-oauth`, `export-reminder`, `cron`
- **Client storage:** Hybrid — Supabase for inventory/settings/expenses; localStorage for JWT + settings cache; IndexedDB for photos
- **Mobile:** Expo RN scaffold exists; **not the shipped product**

---

## Audit commands (re-run monthly)

```powershell
# Stale terminology in docs
rg -i "flip/pass|flip or pass|early access code|access code required" docs/ README.md CLAUDE.md

# Flippd / Replit references
rg -i "flippd|replit" docs/ README.md CLAUDE.md --glob "*.md"

# README links to missing files
rg -o "\]\([^)]+\)" README.md
```

---

## Changelog

| Date | Phase | What was done |
|------|-------|---------------|
| 2026-06-24 | 2 | Created `CURRENT_STATE.md`; rewrote `README.md` |
| 2026-06-24 | 0 + 1 | Created `DOC_HIERARCHY.md`, `DOC_AUDIT.md`; updated `DECISIONS.md` terminology |
