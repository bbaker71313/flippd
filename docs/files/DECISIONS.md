# ScanForProfit — Decision Log

Key product, technical, and business decisions with reasoning.
This file exists so future sessions don't relitigate settled decisions.
Add decisions here when something is locked. Reference CLAUDE.md for implementation rules.

---

## Product Decisions

### 5 tabs: Scout / Inventory / Listing / Trends / Stats
**Decision:** 5 tabs only. Never add, rename, or remove.
**Why:** Matches the reseller's mental model: find it (Scout), track it (Inventory), list it (Listing), study the market (Trends), count the money (Stats). Every action a reseller takes maps to one of these.
**Do not add a 6th tab** without explicit justification and Britt's approval.

### eBay fee is configurable, never hardcoded
**Decision:** eBay fee percentage is always from user settings (`ebayFee`). Default 13%. Never hardcode.
**Why:** eBay's fee structure varies by seller level, category, and store subscription. Hardcoding breaks trust in profit calculations — which are the core value of the app.

### No fake metrics or testimonials in any copy
**Decision:** All metrics and testimonials that appeared on the landing page were written speculatively. Must not be used publicly.
**Why:** Fabricated social proof is a legal liability and a trust killer the moment a real user fact-checks it.
**What to do:** Only use verified claims. Leave placeholder slots for real testimonials once users provide them.

### Freemium model with usage-based gates
**Decision:** Scout (free, limited), Hustle ($19/mo), Stack ($49/mo), Empire ($199/mo).
**Why:** The value metric is clear — scans per month. Free users who hit the limit have already experienced the value and have a concrete reason to upgrade. Tier names use reseller language, not generic SaaS language.
**Status:** Model locked. Pricing to be validated with real users via RESEARCH_PRICING_VALIDATION.md.

### Compete on shelf scan + integrated workflow, not scan speed
**Decision:** ScanForProfit's primary differentiators are shelf scan (one photo ranks everything visible) and the integrated workflow (sourcing → inventory → listing → P&L). Not raw speed or barcode support.
**Why:** Underpriced.ai does single-item scanning. ThriftMagic does book shelves (slow, unreliable). No competitor does mixed-category shelf scan + full integrated workflow. That is the defensible position.

---

## Technical Decisions

### Supabase Edge Functions replace Replit backend entirely
**Decision:** All backend logic runs in Supabase Edge Functions (Deno/TypeScript). The old Replit backend is decommissioned.
**Functions:** `claude-proxy`, `auth`, `stripe-webhook`. No others.
**Why:** Supabase is already the database and auth provider. Consolidating removes a dependency, improves latency, and keeps all secrets in one place.
**Do not reference:** `flippd-backend.bbaker71313.repl.co` or any Replit URL. Dead.

### Email verification + password auth only — no magic link
**Decision:** Auth is email verification + username/password. Magic link was removed in backend v3.0.0.
**Why:** Magic link required email round-trips that confused non-technical users and caused support requests. Email + password is universally understood.
**Dead endpoints — never implement:** `/auth/request-link`, `/auth/verify-link`.
**Live endpoints:** `POST /auth/register`, `GET /auth/verify`, `POST /auth/login`.

### AI calls go through Edge Function only — never from client
**Decision:** All Anthropic API calls go through `claude-proxy` Edge Function. The client never touches the Anthropic API directly.
**Why:** API key security. The `ANTHROPIC_API_KEY` lives in Supabase secrets, never in `.env` or client code.
**Pattern:** `supabase.functions.invoke('claude-proxy', { body: { ... } })`

### NativeWind only — no StyleSheet
**Decision:** All React Native styling uses NativeWind 4 (Tailwind classes). Never use `StyleSheet.create()`.
**Why:** Consistent with the web stack (Tailwind), faster iteration, and enforces design system tokens from `packages/shared/src/constants/theme.ts`.

### 500-line file limit
**Decision:** No file may exceed 500 lines. Refactor into sub-modules before hitting the limit.
**Why:** Large files slow down Claude Code context loading and make surgical edits harder. This was learned during single-file app development.

### All configurable values from user settings — never hardcoded
**Decision:** These values are always from user settings or constants files, never hardcoded inline:
- `ebayFee` (default 13%)
- `taxReservePct` (default 0.25)
- `mileageRate` (default 0.67 — IRS rate)
- Tier scan limits
**Why:** User contexts vary. Hardcoding creates incorrect math for many users and makes the app feel broken.

---

## Business Decisions

### No fake urgency or fake scarcity
**Decision:** Do not manufacture false urgency or scarcity in copy.
**Why:** Resellers are savvy buyers. Fake urgency erodes trust and contradicts the brand voice — direct, honest, reseller-to-reseller.

### Android (Google Play) ships before iOS
**Decision:** First mobile distribution is Android via EAS Build + Google Play. iOS (App Store) comes after.
**Why:** Google Play review process is faster and less restrictive for initial launch. Allows real-user testing before the more scrutinous App Store submission.

### Source of truth for business logic is ScanForProfit_v5_24.html
**Decision:** All AI prompts, profit calculations, and business rules are ported from `ScanForProfit_v5_24.html`. Never rewrite from scratch.
**Why:** Those prompts and calculations have been tested in production. Rewriting introduces errors. Port verbatim.
