# ScanForProfit — Chat Index

Six specialized Claude chats, each scoped to one workstream.
Start every session by reading CLAUDE.md + HANDOFF.md.
End every session following END_OF_CHAT_PROTOCOL.md.

---

## Active Chats

| Chat | Scope | Current Status |
|---|---|---|
| [APP] | React Native mobile app — screens, components, UI | Phase 4 pending |
| [BACKEND] | Supabase Edge Functions, auth, DB schema, migrations | Phase 4 priority |
| [MARKETING] | Landing page, copy, email sequences, ASO | Phase 6 pending |
| [GROWTH] | Directory submissions, SEO, organic distribution | Phase 6 pending |
| [STRATEGY] | Pricing validation, positioning, business model | Ongoing |
| [RESEARCH] | Customer interviews, persona validation, pricing validation | Ongoing |

---

## Chat Scopes

### [APP]
**Owns:** `apps/mobile/` — screens, components, navigation, camera, local state
**Does not own:** Edge Functions, database schema, auth logic, payments
**Key files:** `CLAUDE.md`, `HANDOFF.md`, `FEATURE_TRIAGE.md`, `BRAND_IDENTITY.md`, `PHASE_4_CHAT_SETUP.md`
**Source of truth for logic:** `Flippd_v5_23.html` — port prompts and business rules verbatim
**Stack:** React Native + Expo SDK 52 + Expo Router 4 + NativeWind 4
**Rule:** NativeWind classes only — never `StyleSheet.create()`

### [BACKEND]
**Owns:** `supabase/functions/`, `supabase/migrations/`, database schema, RLS policies, Stripe webhook
**Does not own:** Frontend components, mobile screens, marketing copy
**Key files:** `CLAUDE.md`, `HANDOFF.md`, `BACKEND_INTEGRATION.md`, `FEATURE_TRIAGE.md`
**Functions:** `claude-proxy`, `auth`, `stripe-webhook` — nothing else
**Rule:** `ANTHROPIC_API_KEY` in Supabase secrets only — never in `.env` or client

### [MARKETING]
**Owns:** `apps/web/app/page.tsx` (landing page), email sequences, ASO copy, ad copy
**Does not own:** App code, backend, pricing decisions
**Key files:** `CLAUDE.md`, `product-marketing-context.md`, `MARKETING_PHASE_1.md`, `PAID_ADS_STRATEGY.md`, `BRAND_IDENTITY.md`
**Rule:** No placeholder metrics or fabricated testimonials in any public-facing copy

### [GROWTH]
**Owns:** Directory submissions, SEO, backlinks, organic distribution
**Does not own:** App code, landing page design, paid ads
**Key files:** `CLAUDE.md`, `directory-tracker.csv`, `directory-copy.md`, `submission-readiness.md`
**Rule:** Submit Tier 1 directories first (launch day), then Tier 2 (week 1), then Tier 3

### [STRATEGY]
**Owns:** Pricing decisions, positioning, business model, competitive analysis
**Does not own:** Implementation of any feature
**Key files:** `CLAUDE.md`, `product-marketing-context.md`, `DECISIONS.md`, `RESEARCH_PRICING_VALIDATION.md`
**Rule:** No pricing changes without data from `RESEARCH_PRICING_VALIDATION.md`

### [RESEARCH]
**Owns:** Customer interviews, persona validation, testimonial collection, feature priority ranking
**Does not own:** Any implementation decisions
**Key files:** `CLAUDE.md`, `RESEARCH_INTERVIEW_GUIDE.md`, `RESEARCH_INTERVIEW_TRACKER.csv`, `RESEARCH_PERSONA_VALIDATION.md`, `RESEARCH_PRICING_VALIDATION.md`, `RESEARCH_FEATURE_PRIORITY.md`, `RESEARCH_TESTIMONIAL_COLLECTION.md`
**Rule:** Minimum 3 interviews per persona before any major product or pricing decision

---

## Cross-Chat Rules

- Decisions made in any chat → log in `DECISIONS.md` before ending session
- Anything that changes the app UI or copy → update `product-marketing-context.md`
- Anything that changes what features are built or deferred → update `FEATURE_TRIAGE.md`
- Every session ends with `HANDOFF.md` updated — what changed, what's next, any blockers
