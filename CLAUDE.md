ScanForProfit — Claude Code Instructions
Authoritative rules file for all Claude Code sessions. Read this file completely at the start of every session before touching any code.


CRITICAL: Before Every Session
Read these files in order before doing anything:

docs/CURRENT_STATE.md — authoritative "what exists now"
docs/HANDOFF.md — what changed last session, current state
docs/FEATURE_TRIAGE.md — what to port vs build vs defer

Do NOT create duplicate files. Do NOT recreate files that already exist — update them. Update docs/HANDOFF.md after every github commit


SESSION START — MANDATORY VERIFICATION (do not skip, do not reorder)
Run all 5 checks before writing a single line of code. Show output for each. If any check fails, STOP and report. Do not proceed until resolved.

# 1. Confirm shared package name — must be @sfp/shared

cat packages/shared/package.json | grep '"name"'

# Expected: "name": "@sfp/shared"

# 2. Confirm all 12 UI component files exist

ls apps/mobile/components/ui/

# Expected: BottomSheet.tsx, Button.tsx, Card.tsx, EmptyState.tsx,
#           index.ts, Input.tsx, ItemCard.tsx, PaywallModal.tsx,
#           ProfitBadge.tsx, ScanResult.tsx, SettingsForm.tsx,
#           TabBar.tsx (12 files total)

# 3. Confirm git is initialized and has a clean working tree

git status

# Expected: "On branch main" or named feature branch, "nothing to commit"
# If "not a git repository" → STOP. Run git init prompt before anything else.

# 4. Confirm .env is NOT tracked by git

git ls-files .env

# Expected: empty output (no result)
# If .env appears → STOP. Remove from tracking immediately.

# 5. Confirm docs folder structure exists

ls docs/

# Expected: marketing/ and files/ folders present, plus HANDOFF.md, FEATURE_TRIAGE.md, BRAND_IDENTITY.md
# If marketing/ or files/ are missing → create them: mkdir -p docs/marketing docs/files

STOP RULE: If any check produces unexpected output, do not continue. Document the failure in docs/HANDOFF.md and wait for instruction. Do not guess. Do not self-fix without reporting first.


🗂️ Project Overview
ScanForProfit is a web-first AI-powered sourcing and profit intelligence tool for solo eBay resellers. Scan any item or shelf photo, get instant HOT/LIST/SKIP decisions with real profit math, track inventory, generate eBay listings with AI, and receive weekly business intelligence from the Growth Agent. Live at scanforprofit.com/app.html. Mobile app is roadmap.

Target user: Solo reseller sourcing from thrift stores, garage sales, estate sales. Needs: AI sourcing decisions, inventory tracking, profit math, listing generation, and growth insights — from any browser.

Primary platform: eBay. Future: Poshmark, Mercari, Facebook Marketplace.

Source of truth for business logic: docs/ScanForProfit_v5_24.html. All AI prompts, calculations, and business rules are ported from this file — never rewritten.


📁 Monorepo Structure
scanforprofit/

├── apps/

│   ├── mobile/                    # React Native + Expo (ships first)

│   │   ├── app/                   # Expo Router screens

│   │   │   ├── (auth)/            # _layout.tsx, login.tsx, register.tsx, verify.tsx

│   │   │   ├── (onboarding)/      # _layout.tsx, how-it-works.tsx,

│   │   │   │                      # identity.tsx, permission.tsx,

│   │   │   │                      # result.tsx, upgrade.tsx

│   │   │   └── (tabs)/            # scout.tsx, inventory.tsx,

│   │   │                          # listing.tsx, trends.tsx, stats.tsx

│   │   ├── components/

│   │   │   └── ui/                # Button, Card, Input, BottomSheet,

│   │   │                          # TabBar, ScanResult, ProfitBadge,

│   │   │                          # ItemCard, EmptyState

│   │   ├── lib/                   # supabase.ts, theme.ts, auth.ts

│   │   ├── app.json               # EAS project: cc487254-9654-4930-ac52-37ffba835a20

│   │   └── eas.json

│   ├── web/                       # Next.js 14 App Router

│   │   ├── public/                # LIVE static files served by Vercel

│   │   │   ├── index.html         # Marketing homepage — served at / via next.config.js rewrite

│   │   │   ├── app.html           # Web app — rebranded Flippd HTML; live at /app.html

│   │   │   ├── privacy.html, terms.html

│   │   │   └── robots.txt, favicon.png, apple-touch-icon.png

│   │   ├── app/                   # Next.js App Router — IN PROGRESS, not yet live

│   │   │   ├── (dashboard)/       # auth-gated web app (future)

│   │   │   └── page.tsx           # placeholder — / is currently served by public/index.html

│   │   └── lib/                   # supabase-server.ts, supabase-client.ts

│   └── video/                     # Remotion (@sfp/video) — ad video generation

│       └── src/compositions/      # HeroVideo, SquareAd, StoryAd,

│                                  # TikTokAd, YouTubePreroll

├── packages/

│   └── shared/                    # Shared TypeScript types + utils

│       └── src/

│           ├── types/index.ts     # All interfaces — source of truth

│           ├── utils/calcProfit.ts

│           └── constants/         # theme.ts, categories.ts, tiers.ts

├── supabase/

│   ├── functions/                 # Edge Functions (Deno/TypeScript)

│   └── migrations/                # timestamped — see "Migrations Applied" section below

├── docs/

│   ├── marketing/             # Ad copy, hooks, content calendar, creator outreach

│   │   ├── directory-copy.md

│   │   ├── directory-tracker.csv  # Directory submission tracker

│   │   ├── submission-readiness.md

│   │   └── video-assets/          # Rendered mp4s — hosted externally, NOT in git

│   ├── files/                 # Session artifacts and reference docs
│   │   ├── DECISIONS.md       # Locked product/tech decisions — do not relitigate
│   │   ├── LAUNCH_CHECKLIST.md # Phase 6 launch checklist
│   │   └── product-marketing-context.md # Marketing positioning reference

│   ├── archive/               # Legacy reference docs — do not edit

│   ├── HANDOFF.md             # Session context — update every session

│   ├── FEATURE_TRIAGE.md      # 56 features: port/rebuild/defer

│   ├── BRAND_IDENTITY.md      # Logo, colors, typography, spacing

│   ├── GITHUB_SECRETS.md      # Secret names reference (no values)

│   └── ScanForProfit_v5_24.html  # Source of truth for all business logic

├── .github/

│   └── workflows/                 # mobile.yml (EAS build), web.yml (TypeScript check)

├── .env                           # Never commit — all keys from env

├── .env.example                   # Template — commit this

├── pnpm-workspace.yaml

├── turbo.json

└── CLAUDE.md                      # This file

Hard rule: No file may exceed 500 lines. Refactor into sub-modules before hitting that limit.


💻 Tech Stack
Mobile
Framework: React Native + Expo SDK 52
Navigation: Expo Router 4
Styling: NativeWind 4 (Tailwind classes — no StyleSheet)
Auth storage: expo-secure-store
Camera: expo-camera
Analytics: PostHog RN
Errors: Sentry RN
Payments: Stripe React Native
Web
ARCHITECTURE DECISION (locked): The React Native rebuild was abandoned. The old Flippd HTML
was rebranded as ScanForProfit and is now the live web app at /app.html. The mobile app
will be rebuilt using app.html as its source reference. The Next.js App Router components
(apps/web/app/) are in-progress shells — not yet live. Do not treat page.tsx as the
source of truth for any UI or business logic. Use apps/web/public/app.html instead.

Framework: Next.js 14 App Router (shell only — / served by public/index.html via rewrite)
Language: TypeScript (strict mode)
Styling: Tailwind CSS + shadcn/ui
Auth: @supabase/ssr (cookie-based)
Backend / Database
Platform: Supabase (project: dqgfpchkheznvanfgsmx)
Database: PostgreSQL 17
Edge Functions: Deno / TypeScript (replacing Replit backend)
Auth: Supabase Auth — email verification + username/password
AI proxy: Edge Function calls Anthropic API server-side
Payments
Platform: Stripe
Tiers: Scout (free) · Hustle ($19/mo) · Stack ($49/mo) · Empire ($199/mo)
Billing: Monthly only — annual plans not yet available. Do not show annual toggle or yearly pricing anywhere.
Video Ads
Framework: Remotion 4 (@sfp/video)
Compositions: HeroVideo, SquareAd, StoryAd, TikTokAd, YouTubePreroll
Infrastructure
Monorepo: pnpm 11 workspaces + Turborepo
Deploy mobile: EAS Build
Deploy web: Vercel
Email: Resend + React Email
Automation: Supabase Edge Functions (cron + export-reminder) — no n8n
DNS: Cloudflare
Design
Fonts: Syne (headers, numbers) + IBM Plex Mono (labels, data, meta)
Design tokens: packages/shared/src/constants/theme.ts — single source of truth
Brand: docs/BRAND_IDENTITY.md


🔐 Auth Rules (critical — never change)
Auth is email verification + username/password
NOT magic link — removed in backend v3.0.0
JWT 90-day sessions
Live endpoints: POST /auth/register, GET /auth/verify, POST /auth/login
Dead endpoints — never reference: /auth/request-link, /auth/verify-link


🧱 Data Model
All types defined in packages/shared/src/types/index.ts. All values from Supabase project dqgfpchkheznvanfgsmx.
Core Types
type UserTier = 'trial' | 'scout' | 'hustle' | 'stack' | 'empire'

type ItemCondition = 'New' | 'Like New' | 'Open Box' | 'Good' | 'Used' | 'Fair' | 'Poor'

type ItemStatus = 'Unlisted' | 'Listed' | 'Sold' | 'Ready to Export'

type ScanDecision = 'HOT' | 'LIST' | 'SKIP'

type SourcingStyle = 'conservative' | 'balanced' | 'aggressive'
Tier Limits
Tier
Scans/mo
Items
trial
Unlimited
Unlimited (7 days)
scout
25
10
hustle
250
250
stack
Unlimited
Unlimited
empire
Unlimited
Unlimited (10 seats)

DEFAULTS (never hardcode these)
ebayFee: 13        // configurable — never hardcode

pkgCost: 1.25      // configurable

minProfit: 15      // configurable

targetRoi: 200     // configurable

maxDays: 60        // stale item threshold — configurable

minStr: 0          // configurable

shipping: 'buyer'  // configurable

shipCost: 6.00     // configurable

taxReservePct: 0.25 // configurable — never hardcode

mileageRate: 0.72  // IRS rate — configurable — never hardcode
Supabase Tables
users, inventory, scan_log, settings, pnl_expenses, growth_cache

Migrations applied (9 total — timestamped naming):
20260529010000_initial_schema.sql
20260529010001_rls_enable_tables.sql
20260529010002_rls_auto_enable_trigger.sql
20260530132149_003_rls_policies_users_inventory.sql
20260531123241_create_waitlist_table.sql
20260601143533_waitlist_rls_insert_policy.sql
20260602164748_003_add_waitlist_source.sql
20260602224043_004_rename_min_roi_to_target_roi.sql
20260603000000_005_add_ebay_oauth_columns.sql


💰 Business Logic Rules
Non-negotiable. Getting these wrong breaks profit math.
Fee Calculation
eBay fee is always user-configurable. Never hardcode. Logic lives in packages/shared/src/utils/calcProfit.ts only.

// Always use these exact parameter names

interface CalcProfitInput {

  cost: number       // what you paid

  sellPrice: number  // what you'll sell for

  pkgCost: number    // packaging cost

  shipCost: number   // shipping cost

  ebayFee: number    // percentage — from user settings, never hardcoded

}
Sourcing Decision Logic 
HOT = projected ROI > 150% AND high confidence
LIST = projected ROI > targetRoi (user-configurable) AND reasonable confidence
SKIP = everything else
Style modifier: conservative (+20% ROI threshold), aggressive (-20%)
Currency Rules
Store: numbers in DB (dollars, 2 decimal places)
Display: formatted with $ and 2 decimal places
Never do math on string values — convert first
Dates
Store: UTC ISO 8601
Display: convert to local time at UI layer only


📱 Mobile Tab Structure (5 tabs — never add, rename, or remove)
Tab | Label in App (display) | Tab ID | Feature
Scanner |PROFIT SCANNER | tab-scanner | Profit Scanner — single item + shelf scan mode
Inventory | INVENTORY | tab-inventory | Add/edit/delete items, status tracking, photos
Photos | PHOTOS | tab-photo | AI listing generator, photo management, CSV export
Trends | PROFIT COMPASS | tab-pulse | Growth Agent — weekly business brief
Dash | PROFIT HUB | tab-pnl | P&L dashboard, expenses, mileage


🤖 AI Prompts 
All AI prompts live in docs/FEATURE_TRIAGE.md under "Port Directly". When implementing any AI feature, extract the exact prompt from FEATURE_TRIAGE.md. Do NOT rewrite, summarize, or improve the prompts — they are tested and trusted.

Key prompts documented in FEATURE_TRIAGE.md:

Single item scan (getSingleSys)
Shelf scan (getShelfSys)
Growth Agent (runGrowthAgent)
Listing Generator (generateListingWithAI)
Trending Keywords (fetchTrendingKeywords)
Item detection (invFormDetectItem)

AI model: claude-sonnet-4-6 — never downgrade without explicit instruction. AI calls go through Supabase Edge Functions — never from client directly.


🧩 Supabase Edge Functions
Replace all Replit backend endpoints. One function per domain:

Function
Replaces
claude-proxy
/v1/messages and /v1/messages-with-image
auth
/auth/register, /auth/verify, /auth/login, /auth/me
stripe-webhook
Stripe event handling
stripe-checkout
Stripe Checkout session creation (returns { url })
ebay-oauth
eBay OAuth flow — /authorize, /callback, /status, /disconnect

Rules:

Anthropic API key in Supabase secrets — never in client
eBay client ID in Supabase secrets — set EBAY_CLIENT_ID env var (get new credential from developer.ebay.com)
All keys read from env — never hardcoded


🧪 Testing Requirements
Every feature that touches profit math, inventory, or auth requires tests.
Mobile (Jest + @testing-library/react-native)
Web (Vitest + @testing-library/react)
Shared (Vitest)
Required coverage:

Happy path
Edge case (empty data, zero cost, no API response)
Failure case (API error, bad input, negative profit)

Never hit live Supabase or Stripe in tests — always mock.


✅ Session Protocol
Start of every session:
Read docs/CURRENT_STATE.md — authoritative "what exists now"
Read docs/HANDOFF.md — last 2 sessions only; skip older entries
Read docs/FEATURE_TRIAGE.md — check port vs build vs defer
Read this file — done when you reach this line
Run SESSION START verification above — all 5 checks must pass
During work — Karpathy Rules (all 4, always):
Rule 1 — Think Before Coding: State assumptions before implementing. If multiple interpretations exist, present them — don't pick silently. If something is unclear, stop. Name what's confusing. Ask.

Rule 2 — Simplicity First: Minimum code that solves the problem. No features beyond what was asked. No speculative abstractions. Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

Rule 3 — Surgical Changes: Touch only what you must. Don't improve adjacent code. Don't refactor things that aren't broken. Every changed line must trace directly to the user's request.

Rule 4 — Goal-Driven Execution: Define success criteria before starting. For multi-step tasks, state the plan with a verify step for each:

1. [Step] → verify: [check]

2. [Step] → verify: [check]

Additional rules:

Never delete or overwrite existing code unless explicitly listed in task
Never hardcode: API keys, eBay fee, tax rate, mileage rate, tier limits
Never use <form> tags — use onClick/onChange/addEventListener
If blocked, document the blocker in HANDOFF.md and move to next task
All documents, decisions, and assets go to docs/ subfolders and get committed — never delivered as chat downloads only
End of every session — MANDATORY COMMIT PROTOCOL:
# Step 1 — Type check must be clean

npx tsc --noEmit

# Must return 0 errors. Fix all errors before committing.

# Step 2 — Review what changed

git add -A

git status

# Scan the list. Confirm no .env, no node_modules, no .zip files.
# If anything unexpected appears → remove it before committing.

# Step 3 — Commit with scoped message

git commit -m "[scope]: description of what was built this session"

# scope must be one of: feat / fix / chore / docs / refactor / style

# Step 4 — Push

git push origin main

# Paste the output line showing branch + commit hash in your report.

# Step 5 — Update HANDOFF.md with:
# - What was completed this session (specific files changed)
# - Exact next task for the next session
# - Any decisions made that must not be reversed
# - Any blockers encountered

If push fails: Document exact error in docs/HANDOFF.md, leave working tree with a local commit. Never end a session with uncommitted work and no record.
Session end report format:
FILES CHANGED: [list every file]

COMMIT: [hash]

NEXT TASK: [exact description]

BLOCKERS: [none / description]


⚠️ Things Claude Commonly Gets Wrong — Don't Do These
Hardcoding fee percentages — always from user settings via ebayFee param
Hardcoding mileage rate or tax reserve — always configurable in settings
Using magic link auth — it was removed. Email verification + password only
Rewriting AI prompts — port them verbatim from FEATURE_TRIAGE.md
Adding a 6th tab — 5 tabs only: Scanner (PROFIT SCANNER), Inventory (INVENTORY), Photos (PHOTOS), Trends (PROFIT COMPASS), Dash (PROFIT HUB)
Calling Anthropic API from client — always via Supabase Edge Function
Using StyleSheet in React Native — NativeWind classes only
Using <form> tags — use onClick/onChange handlers
Floating point currency math — use precise arithmetic, store as numbers
Storing dates without timezone — always UTC ISO 8601
Files over 500 lines — refactor proactively
Duplicating types — all types in packages/shared/src/types/index.ts only


🔮 Platform Expansion Pattern
When adding Poshmark, Mercari, or Facebook Marketplace:

// Follow adapter pattern — never add platform conditionals to core logic

interface PlatformFormatter {

  formatTitle(item: InventoryItem): string

  formatDescription(item: InventoryItem): string

  adjustedPrice(targetNetProfit: number, settings: UserSettings): number

}

class PoshmarkFormatter implements PlatformFormatter { }

class MercariFormatter implements PlatformFormatter { }

class FacebookFormatter implements PlatformFormatter { }


📚 Key External Docs
Supabase: https://supabase.com/docs
Expo: https://docs.expo.dev
Expo Router: https://expo.github.io/router/docs
NativeWind: https://www.nativewind.dev/v4/overview
EAS Build: https://docs.expo.dev/build/introduction
Stripe React Native: https://stripe.com/docs/stripe-js/react-native
Next.js 14: https://nextjs.org/docs
eBay Developer Portal: https://developer.ebay.com/develop/apis


🚀 Current Build Status

ARCHITECTURE NOTE (2026-06-17): The React Native mobile app built in Phase 04 was
scrapped — the output was unusable. The live product is apps/web/public/app.html
(Live at scanforprofit.com/app.html). RN scaffold exists in apps/mobile/ but is not
shipped; live product is app.html. Mobile will be rebuilt from app.html as reference.
Authoritative current state: docs/CURRENT_STATE.md.

Phase
Name
Status
01
Validate
✅ Complete
02
Brand & Architecture
✅ Complete
03
Design
✅ Complete (brand/tokens done; mobile components are reference scaffolds only)
04
Build Web App (app.html)
✅ Live on Vercel — 7 Edge Functions active, RLS on all tables
05
Build Mobile App
⬜ Not started — RN scaffold exists; live product is app.html
06
Launch
⬜ Not started
07–09
Monetize / Marketing / Scale
⬜ Not started

Web App Status (apps/web/public/app.html — the live product)
Feature
Status
Auth (register, login, verify, password reset)
✅ Live (Edge Function: auth)
AI scan via claude-proxy Edge Function
✅ Live (17 scan_log rows confirmed)
Inventory CRUD
✅ Live (Supabase: inventory table)
Listing generator
✅ Live
Trends / Growth Agent
✅ Live (Pulse tab)
P&L / Stats
✅ Live
Settings (fee, tax, mileage — all configurable)
✅ Live
eBay OAuth Edge Function
✅ Active (ebay-oauth deployed)
Landing page (index.html)
✅ Live on Vercel
Waitlist capture
✅ Live (1 row confirmed in waitlist table)
Stripe upgrade flow end-to-end
⬜ Not yet verified
PostHog events confirmed
⬜ Not yet verified
Sentry zero-error audit
⬜ Not yet verified
eBay Developer sandbox credentials connected
⬜ Not yet done (0 rows in ebay_connections)
