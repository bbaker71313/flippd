# ScanForProfit — Scope Templates

Copy-paste these scope lines at the start of any Claude chat session.
Adapt the task description. Keep the file list — it orients Claude to the right context immediately.

---

## [APP] — React Native Mobile

```
We are working on the ScanForProfit mobile app.

Read before starting: CLAUDE.md, HANDOFF.md, FEATURE_TRIAGE.md, BRAND_IDENTITY.md
Source of truth for business logic and AI prompts: docs/ScanForProfit_v5_24.html

Current task: [describe what you want to build]

Stack: React Native + Expo SDK 52 + Expo Router 4 + NativeWind 4
Supabase project: dqgfpchkheznvanfgsmx
EAS project: cc487254-9654-4930-ac52-37ffba835a20

Rules:
- NativeWind only — never StyleSheet.create()
- Never call Anthropic API from client — always via supabase.functions.invoke('claude-proxy')
- Never hardcode: ebayFee, taxReservePct, mileageRate, tier limits
- 5 tabs only: Scout, Inventory, Listing, Trends, Stats
- Files over 500 lines must be refactored
- Run SESSION START verification before writing any code
```

---

## [BACKEND] — Supabase Edge Functions

```
We are working on the ScanForProfit backend.

Read before starting: CLAUDE.md, HANDOFF.md, BACKEND_INTEGRATION.md

Current task: [describe what you want to build]

Supabase project: dqgfpchkheznvanfgsmx
Edge Functions: claude-proxy, auth, stripe-webhook, stripe-checkout, ebay-oauth
Auth: email verification + password — NO magic link, NO /auth/request-link

Rules:
- ANTHROPIC_API_KEY in Supabase secrets only — never in .env or client
- EBAY_CLIENT_ID in Supabase secrets only
- Auth endpoints live: POST /auth/register, GET /auth/verify, POST /auth/login
- Dead endpoints — never reference: /auth/request-link, /auth/verify-link
- Tier enforcement happens in Edge Function, never trust the client
```

---

## [MARKETING] — Landing Page + Copy + Email

```
We are working on ScanForProfit marketing.

Read before starting: CLAUDE.md, product-marketing-context.md, BRAND_IDENTITY.md

Current task: [describe what you want to write or build]

Domain: scanforprofit.com
Email: britt@scanforprofit.com (Resend + React Email)
Personas: Weekend Flipper, Full-Time Reseller, Thrift Specialist

Rules:
- No placeholder metrics — only verified claims
- No fabricated testimonials — only quotes from real users with permission
- Brand voice: direct, reseller-to-reseller, never corporate
- Forbidden words: API, platform, onboarding, leverage, optimize, AI-powered (in headlines)
```

---

## [GROWTH] — Directory Submissions + SEO

```
We are working on ScanForProfit distribution.

Read before starting: CLAUDE.md, directory-tracker.csv, directory-copy.md, submission-readiness.md

Current task: [describe the submission or SEO task]

Submission order: Tier 1 (launch day) → Tier 2 (week 1) → Tier 3 (weeks 1–3)
UTM pattern: ?utm_source=[directory]&utm_medium=directory&utm_campaign=launch
Analytics: PostHog (track directory referral traffic)
```

---

## [STRATEGY] — Pricing + Positioning

```
We are working on ScanForProfit strategy.

Read before starting: CLAUDE.md, product-marketing-context.md, DECISIONS.md, RESEARCH_PRICING_VALIDATION.md

Current task: [describe the strategic question]

Current tiers: Scout (free) · Hustle ($19/mo) · Stack ($49/mo) · Empire ($199/mo)
Pricing status: Proposed — not yet validated with real users

Rules:
- No pricing changes without data from RESEARCH_PRICING_VALIDATION.md
- Any locked decision → add to DECISIONS.md before ending session
```

---

## [RESEARCH] — Customer Interviews + Validation

```
We are working on ScanForProfit customer research.

Read before starting: CLAUDE.md, RESEARCH_INTERVIEW_GUIDE.md, RESEARCH_INTERVIEW_TRACKER.csv

Current task: [describe the research task]

Personas: Weekend Flipper, Full-Time Reseller, Thrift Specialist
Minimum: 3 interviews per persona before any major product or pricing decision
Incentive: 1 month free Hustle tier ($19 value) per completed interview

After each session update:
- RESEARCH_INTERVIEW_TRACKER.csv
- RESEARCH_PERSONA_VALIDATION.md (if assumptions confirmed/refuted)
- RESEARCH_FEATURE_PRIORITY.md (if new feature requests surfaced)
- RESEARCH_TESTIMONIAL_COLLECTION.md (if usable quotes captured)
```
