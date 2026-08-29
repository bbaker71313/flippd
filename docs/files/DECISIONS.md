# ScanForProfit — Decision Log

Key product, technical, and business decisions with reasoning.
This file exists so future sessions don't relitigate settled decisions.
Add decisions here when something is locked. Reference `docs/DOC_HIERARCHY.md` for which doc wins when sources disagree. Reference `CLAUDE.md` for implementation rules.

---

## Product Decisions

### Scan decision labels: HOT / LIST / SKIP
**Decision:** In-app scan outcomes are **HOT**, **LIST**, and **SKIP** — not FLIP, not PASS.
**Why:** FLIP was retired in the 2026 rebrand. The live app (`app.html`) implements three tiers: HOT (high-demand buy-now), LIST (worth listing), SKIP (pass on it). Shelf scan sorts HOT → LIST → SKIP.
**Marketing shorthand:** "LIST or SKIP" is acceptable in landing copy as plain English for the binary sourcing question, but PASS always maps to SKIP in product UI and docs. Never use FLIP in new user-facing copy.
**Do not revert** to FLIP/PASS without explicit product approval.

### No app access codes — email registration only
**Decision:** There are no early-access codes, invite codes, or gatekeeper passwords for the app.
**How users get in:** Go to `scanforprofit.com/app.html` → Sign Up → verify email → log in with password. Session is a JWT stored client-side.
**Waitlist vs app access:** The landing page "Get early access" CTA captures waitlist emails — that is **not** an app unlock code. Do not document or build access-code flows.
**Legacy:** Pre-JWT access codes are rejected at session restore. The stale "Access code required" toast was fixed in `app.html` (P2-21, 2026-08-27) — it now shows "Please log in first."

### Live product is the web app (app.html), not the RN scaffold
**Decision:** The shipped product is `apps/web/public/app.html` at `/app.html`. The Expo mobile app in `apps/mobile/` is a future rebuild reference — not live, not authoritative for feature status.
**Why:** Phase 04 RN output was scrapped (2026-06-17). All feature truth audits start from `app.html` + Supabase edge functions.
**Do not mark mobile features as "complete"** in docs unless the mobile app is actually shipped.

### 5 tabs — IDs fixed, display names evolved
**Decision:** 5 tabs only. Never add a 6th without explicit justification and Britt's approval.
**Tab IDs (code):** `sourcing` · `inventory` · `photo` · `growth` · `dashboard`
**Display names (live app, 2026-06-24):** Profit Scanner · Inventory · Photos · Profit Compass · Profit Hub
**Why:** Matches the reseller workflow: scan → track → photos/listings → market pulse → P&L hub. Display names may evolve; tab IDs must not change without a migration plan.
**Do not relitigate** the 5-tab structure. Update copy to match live labels when docs disagree.

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
**Status:** Model locked. Pricing to be validated with real users (research file not yet created).

### Compete on shelf scan + integrated workflow, not scan speed
**Decision:** ScanForProfit's primary differentiators are shelf scan (one photo ranks everything visible) and the integrated workflow (sourcing → inventory → listing → P&L). Not raw speed or barcode support.
**Why:** Underpriced.ai does single-item scanning. ThriftMagic does book shelves (slow, unreliable). No competitor does mixed-category shelf scan + full integrated workflow. That is the defensible position.

### P0 market-data rules: sell-through rate, demand thresholds, Best Offer handling
**Decision (approved 2026-08-26):**
- **Sell-through rate:** `STR = soldCount90d / (soldCount90d + activeCount) * 100`, where `soldCount90d` is verified matching sold listings from SoldComps (90-day window) and `activeCount` is verified matching active listings from eBay Browse. `null` (never a fabricated 0%) when both counts are zero, or when active-listing evidence is unavailable.
- **Demand level:** derived from verified STR + verified market-turnover days, evaluated highest tier down — VERY HIGH (STR≥70% & turnover≤30d), HIGH (STR≥50% & turnover≤45d), MEDIUM (STR≥30% & turnover≤90d), LOW (below those). Missing STR or turnover → `null` (unavailable), never LOW. HOT still requires demand = VERY HIGH plus all other thresholds.
- **Best Offer handling:** `bestOfferAccepted` comps are excluded from the primary median/average sold-price calculation (the displayed price on such a listing is not the confidential accepted amount) but are preserved in evidence via `excludedBestOfferCount` and still count toward sales-velocity (STR/turnover) numerators.
- **Market turnover (previously approved):** `marketTurnoverDays = activeInventory / averageVerifiedSalesPerDay`, `averageVerifiedSalesPerDay = verifiedSoldCount / soldWindowDays`.
**Why:** These were the last undefined pieces of the P0 market-data-authority remediation (replacing AI-generated market facts with verified SoldComps/eBay Browse evidence). AI never computes these — see `packages/shared/src/utils/marketMetrics.ts` (`computeSellThroughRate`, `computeDemandLevel`) and its Deno mirror.
**Do not** reintroduce an AI-confidence-based STR/demand estimate, a `sourcingStyle` modifier on these thresholds, or a Best-Offer down-weighting scheme without new explicit approval.

### AI market estimate must never enter the authoritative decision engine (Chapter 02 follow-up, approved/fixed 2026-08-27)
**Decision:** A scan's HOT/LIST/SKIP decision, net profit, ROI, and max-buy-price may be computed ONLY when verified marketplace evidence (SoldComps sold comps + eBay Browse active listings) is available (`marketDataSource: 'verified'`). When verification fails, the scan result is `decisionAvailable: false` / `decisionStatus: 'insufficient_market_data'` — every authoritative field is `null`, never computed from Claude's own price/STR/days/demand estimate. The AI's estimate may still be shown, but only in a separate `aiEstimate` field, clearly labeled informational-only, structurally never passed into `calcProfit`/`decide`/`calcMaxBuyPrice`.
**Why:** The live implementation previously fell back to feeding the AI's own (non-null) market values into the same deterministic `decide()` engine used for verified evidence. Because those AI values are never `null`, they passed `decide()`'s null-means-missing-evidence checks and could produce a fully authoritative-looking recommendation from an unverified guess — violating Anti-Drift Contract rule 7 ("AI is not market or financial authority"). Fixed in `resolveScanResultCore()`, the single gate now shared by single/text and shelf scan (`supabase/functions/claude-proxy/index.ts`).
**Do not** revert to feeding an AI market estimate into `evaluateScanEconomics`/`decide`/`calcMaxBuyPrice` when verification fails, and do not silently convert "insufficient evidence" into a SKIP, a zero, or a fabricated verified-looking value.

### Profit-scanner evidence qualification and safe fallback (approved 2026-08-28)
**Decision:** Scanner market evidence follows an exact-to-broad query cascade and qualifies only after identity-aware comp filtering. At least 3 coherent matching price comps are required for a limited result, 5 for normal/moderate evidence, and 8 for strong evidence. A retained sample fails qualification when `p80 / p20 > 6`. Expected sale price remains the cleaned median; the displayed conservative/optimistic range uses cleaned 35th/70th percentiles, never raw minimum/maximum. Sold and active evidence must describe the same item population; zero or contaminated active evidence cannot become 0-day turnover or 100% STR.
**Fallback:** When evidence does not qualify, preserve item identification and provide an eBay completed-listings search. Do not request, return, or display AI-created price, range, STR, demand, or days-to-sell values.
**ROI presentation:** Deterministic ROI remains unchanged for decisioning. Display ROI is suppressed for free and positive acquisition costs below $1; cash profit remains visible. `$0` continues to produce `roi: null` and bypasses the ROI threshold under the existing approved rule.
**Why:** Deterministic math is not trustworthy when its comp population is unrelated, incoherent, or too small. These gates address the observed false insufficient-evidence results, `$0.99–$99` ranges, `0 days`, and misleading giant low-cost ROI display without changing seller economics or HOT/LIST/SKIP formulas.
**Do not** restore single-query lookup, raw min/max ranges, one-comp recommendations, zero-active instant-turnover claims, or AI numerical market fallback.

### SoldComps API secret name
**Decision (confirmed 2026-08-26):** The Supabase secret is `SOLD_COMPS_API_KEY` (exact name). No fallback aliases.
**Why:** Two candidate names were floated before the exact one was confirmed; `supabase/functions/_shared/soldCompsProvider.ts` now reads this single name only.

### Profit Scanner v2 — cross-market resale opportunity architecture (approved 2026-08-29)
**Decision:** The Profit Scanner's authoritative HOT/LIST/SKIP decision no longer depends on sell-through rate, days-to-sell, or demand level. The decision engine (`decisionEngine.ts`) is now `netProfit` + `roi` + a marketplace-independent `evidenceQuality` tier only: **HOT** = profit and ROI both pass AND evidence is **STRONG** (3+ coherent, exact-identity-matched verified sold comps, or equivalent); **LIST** = profit and ROI both pass AND evidence is **MODERATE** (broader-precision sold comps, 1-2 verified comps with supporting active-market evidence, or strong active-market evidence alone); **SKIP** = profit or ROI fails with strong/moderate evidence. **LIMITED EVIDENCE** (`decisionAvailable:false`) is a distinct evidence state, not a sourcing decision, for weak/no evidence — no fabricated HOT/LIST/SKIP, profit, ROI, or max-buy price. The scanner is a cross-market resale opportunity engine: a `MarketplaceRouter` (`marketplaceRouter.ts`) routes each identified item to relevant marketplaces by category (eBay always; Etsy/Reverb/Discogs/Poshmark/Mercari/Amazon/Facebook-local by fit), a `MarketplaceOpportunityEngine` (`marketplaceOpportunity.ts`) computes marketplace-specific economics (`marketplaceEconomics.ts` — approximate flat fee-percentage profiles per marketplace, eBay still using the user's own configured `ebayFee`) and selects the best overall opportunity (qualifying beats non-qualifying; stronger evidence beats weaker within the qualifying pool; net profit breaks ties) — never simply the highest asking price. eBay is the only marketplace with a real, live-verified evidence provider (`marketDataPipeline.ts` — Trawl/SoldComps sold evidence + eBay Browse active evidence); Etsy/Reverb/Discogs/Amazon/Mercari/Poshmark are explicit `NOT_CONFIGURED` provider-boundary placeholders (`marketplaceProviders.ts`) — no official API credentials are configured in this environment, so they are never scraped or fabricated. Facebook/local has no evidence provider of its own; it borrows a defensible valuation from the best other marketplace opportunity and applies its own $0-fee/no-shipping local-sale economics.
**Why:** The product owner supplied a detailed implementation spec (`SFP_PROFIT_SCANNER_V2_IMPLEMENTATION_PROMPT.md`) explicitly redesigning the Profit Scanner around this architecture, superseding the STR/demand-gating design below. eBay-sold/active-listing sell-through rate and demand level are eBay-specific signals that don't generalize across marketplaces and made the scanner structurally an "eBay sell-through scanner" rather than a cross-market sourcing tool.
**Supersedes (for the scanner's decision authority specifically):** the "P0 market-data rules: sell-through rate, demand thresholds, Best Offer handling" decision below (STR/demand are no longer decision gates — the STR/demand *formulas* themselves, and the Best-Offer sold-price-exclusion rule, are unchanged and still used for the informational-only `sellThroughRate`/`demandLevel` fields kept for Inventory's `SourcingMeta`/Listing Generator) and the "Decision Integrity remediation (Release A)" `hotCappedByEvidence` comp-count-cap mechanism recorded in the "Profit-scanner evidence qualification and safe fallback" decision below (replaced by the LIMITED EVIDENCE state — weak/none evidence never reaches a decision at all, rather than being capped to LIST). The evidence-qualification cascade (exact-to-broad query, contamination/condition filtering, p20/p80 coherence guard, comp-count minimums) is preserved and reused, feeding the new marketplace-independent evidence-quality assessment (`evidenceQuality.ts`) instead of the old comp-count-only bucketing.
**Do not** reintroduce sell-through-rate/days-to-sell/demand-level as a scanner decision gate, or the `hotCappedByEvidence` cap-to-LIST mechanism, without new explicit product-owner approval. Do not build a real Etsy/Reverb/Discogs/Amazon/Mercari/Poshmark evidence integration without official, supported API access — the provider boundary exists in `marketplaceProviders.ts` for exactly this future work.

### Trawl is the preferred sold-history provider
**Decision (approved 2026-08-29):** When `TRAWL_API_KEY` is configured, the verified market-data pipeline uses Trawl's eBay sold-listings endpoint for the approved 90-day evidence window. The existing `SOLD_COMPS_API_KEY` integration remains a configuration fallback only when Trawl is not configured. A Trawl request failure does not silently switch providers mid-scan.
**Why:** The product owner supplied the Trawl credential and explicitly authorized wiring it into the profit scanner. Keeping provider selection behind `SoldMarketDataProvider` preserves the existing deterministic comp qualification and HOT/LIST/SKIP authority path.
**Do not:** expose the key client-side, call Trawl from `app.html`, use results outside the existing comp-matching pipeline, or convert provider errors into a sourcing decision.

---

## Technical Decisions

### Supabase Edge Functions replace Replit backend entirely
**Decision:** All backend logic runs in Supabase Edge Functions (Deno/TypeScript). The old Replit backend is decommissioned.
**Functions (7 deployed):** `claude-proxy`, `auth`, `stripe-webhook`, `stripe-checkout`, `ebay-oauth`, `export-reminder`, `cron`.
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
- `mileageRate` (default 0.72 — IRS rate)
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
**Status:** Deferred — live product is app.html (web). Mobile rebuild not yet started.

### Source of truth for business logic is ScanForProfit_v5_24.html
**Decision:** All AI prompts, profit calculations, and business rules are ported from `docs/ScanForProfit_v5_24.html`. Never rewrite from scratch.
**Why:** Those prompts and calculations have been tested in production. Rewriting introduces errors. Port verbatim.
