# ScanForProfit — Session Handoff

This file is the persistent session context. Update it at the end of every Claude Code session with what changed.

---

## Project Location

`C:\Users\bbake\OneDrive\Desktop\scanforprofit`

## Repo

github.com/bbaker71313/scanforprofit

---

## Session: 2026-05-29 — Block 2: Fix GitHub Actions CI Failures

### What changed this session

- **`.github/workflows/mobile.yml` updated** — changed `on:` trigger from push-to-main to `workflow_dispatch` only. EAS builds will no longer fire automatically on every push. The `jobs:` block is unchanged and ready for Phase 4. Build step now uses `${{ github.event.inputs.platform || 'all' }}` so platform is selectable when triggered manually.
- **`.github/workflows/web.yml` deleted** — permanently removed. Vercel native Git integration is the authoritative deployment mechanism. No GitHub Actions workflow is needed or desired for web deploys. Do NOT recreate this file.
- **`docs/GITHUB_SECRETS.md` created** — documents what secrets must be added before Phase 4 EAS builds work. See that file for the exact steps.

### Why these changes were made

Both workflows were firing on every push to main and failing with missing secrets (`EXPO_TOKEN`, `VERCEL_TOKEN`, etc.), generating noise email alerts. Vercel native deployment was already working correctly — the web workflow was entirely redundant. The mobile workflow needs `EXPO_TOKEN` which won't exist until Phase 4 Step 8.

### Commits this session

| Hash | Message |
|---|---|
| `aa43093` | chore: disable mobile CI auto-trigger — manual workflow_dispatch only |
| `28cc201` | chore: remove redundant Vercel web CI — Vercel native Git integration handles deployments |
| `c7bc4c2` | docs: add GITHUB_SECRETS.md — document required secrets for Phase 4 EAS build |

### Phase 4 Step 8 note — IMPORTANT

Before starting EAS builds in Phase 4 Step 8:
1. Go to expo.dev → Account Settings → Access Tokens → Create token
2. Add `EXPO_TOKEN` to GitHub → Repository → Settings → Secrets and variables → Actions
3. Update `mobile.yml`: restore the push trigger (replace `on: workflow_dispatch:` with push trigger on `apps/mobile/**` and `packages/shared/**` on main)
See `docs/GITHUB_SECRETS.md` for full reference.

### Decisions made this session (do not reverse)

- `web.yml` deleted permanently. Vercel native is the deployment mechanism. Do not recreate.
- `mobile.yml` is manual-only until Phase 4 Step 8. Do not restore push trigger before adding `EXPO_TOKEN`.

### Next task

**Block 3** — Landing page fix + email capture
- Fix `apps/web/app/page.tsx` landing page
- Add email capture / waitlist form
- Verify Vercel native deployment picks up the change cleanly

---

## Session: 2026-05-27

### What changed this session

- **File system audit** — found 3 copies of the project; OneDrive Desktop confirmed as canonical source
- **Cleanup completed** — moved `FLIPPD/` → `flippd-archive/`, `Ebay/` → `ebay-business/`, `Flippd - Copy` removed; deleted 852MB `FLIPPD.zip` from Projects copy
- **Deleted duplicate** — `C:\Users\bbake\Projects\scanforprofit` removed entirely (required robocopy workaround for MAX_PATH issue in nested skills folder)
- **Git initialized** — `git init`, branch set to `main`
- **.gitignore updated** — added `.expo/`, `.turbo/`, `coverage/`, `*.zip`, `*.tsbuildinfo`
- **docs/ subfolders created** — `docs/decisions/`, `docs/strategy/`, `docs/marketing/` with placeholder READMEs
- **Initial commit** — `c6d2000` — 84 files, 22,689 insertions
- **Remote added** — `https://github.com/bbaker71313/scanforprofit.git`; force-pushed over stale remote history (old single-file Flippd repo)
- **CLAUDE.md written** — `d9ea970` — full session protocol, Karpathy rules, verification checks, build status
- **Type fix** — `apps/web/lib/supabase-server.ts` — added explicit `CookieOptions` types to cookie handler params (6 implicit `any` errors resolved)
- **tsbuildinfo excluded** — `*.tsbuildinfo` added to `.gitignore`, unstaged from git

### Commits this session

| Hash | Message |
|---|---|
| `c6d2000` | chore: initial commit — monorepo scaffold, design system, UI components |
| `d9ea970` | docs: update CLAUDE.md with session protocol, Karpathy rules, verification checks |
| `7a67b3e` | fix: add explicit types to supabase-server cookie handlers, exclude tsbuildinfo |

### Next task

**Phase 3 Step 3** — Component Library rebuild with `frontend-design` skill
- Target: `apps/mobile/components/ui/` (10 components already scaffolded)
- Read `docs/BRAND_IDENTITY.md` and `packages/shared/src/constants/theme.ts` before starting
- Use NativeWind 4 only — no StyleSheet
- Port from `Flippd_v5_23.html` per `docs/FEATURE_TRIAGE.md`

### Decisions made this session (do not reverse)

- OneDrive Desktop (`C:\Users\bbake\OneDrive\Desktop\scanforprofit`) is the canonical project location
- GitHub remote force-pushed — old Flippd single-file history discarded intentionally
- Shared package name is `@sfp/shared` — all mobile components already import from this correctly

---

## Session: 2026-05-26

### What changed this session

- **Created `README.md`** — new file, ScanForProfit branding, current V1 feature set from `docs/FEATURE_TRIAGE.md`, monorepo structure, subscription tiers, dev commands, key constraints.
- **Audited `CLAUDE.md`** — file does not exist yet. Nothing to update.
- **Created `docs/HANDOFF.md`** (this file) — persistent session context established.

### Flippd references found (Task 4 audit — do NOT auto-fix)

All references are in `docs/FEATURE_TRIAGE.md` and one in `packages/shared/src/types/index.ts`. They are intentional: the FEATURE_TRIAGE.md documents the source HTML file (`Flippd_v5_23.html`) and its internal symbols (localStorage keys, function names, URLs from the old app). These are source-archaeology annotations, not app branding.

**`docs/FEATURE_TRIAGE.md` — Flippd references (reported, not fixed):**

| Line | Content |
|------|---------|
| 1 | `# Feature Triage — Flippd v5.23 → ScanForProfit RN` |
| 3 | `Source file: \`Flippd_v5_23.html\`` |
| 10 | `Line numbers reference \`Flippd_v5_23.html\`` |
| 32 | localStorage key `flippd_items_v1` (old app key — documented, not used in RN) |
| 171 | IndexedDB store name `flippd_photos` (old app — documented) |
| 189 | `'https://flippd-backend.replit.app'` (old API_BASE — replaced by Supabase) |
| 370 | localStorage keys `flippd_jwt`, `flippd_user_name` (old app — documented) |
| 372 | `support@flippd.app` (old support email — documented as bug) |
| 402 | eBay client ID `'Brittany-Flippd-PRD-67b75c3f4-fb4ff30c'` (old key — must replace) |
| 403 | redirect URI `'https://flippd-backend.replit.app/ebay/oauth/callback'` (old — must replace) |
| 410 | Function name `_mergeFlippdWithEbay()` (old HTML function — documented) |
| 417 | Function names `handleFlippdImport()`, `exportFlippdBackup()` (old HTML — documented) |
| 458 | localStorage key `flippd_events` (old app — documented) |
| 485 | `support@flippd.app` (old email — documented as bug) |
| 613 | Port-from references to `exportFlippdBackup()`, `handleFlippdImport()` |
| 692 | localStorage key `flippd_user_name` (old app — documented) |
| 738 | "merging Flippd items with eBay-pulled listings" (section title — historical context) |
| 756 | `flippd_events` localStorage key (old app — documented) |
| 780 | `flippd-backend.replit.app` (old backend URL — documented as replaced) |
| 819 | `flippd_events` in dead-code table |
| 825 | `flippd_jwt` in dead-code table |

**`packages/shared/src/types/index.ts` line 1:**
```
// Core domain types for ScanForProfit — aligned to Flippd data model
```
This comment references the old app by name. Safe to update in a future session.

---

## Standing Instructions (apply every session)

- Karpathy guidelines: surgical changes only. Do not add features. Do not refactor.
- Never hardcode eBay fee percent — always read from `settings.ebayFeePercent`.
- Auth is email/password only (no magic link).
- 5 mobile tabs only: Scout, Inventory, Listing, Trends, Stats.
- Supabase Edge Functions replace the old Replit backend entirely.
- Update this file at the end of every session.

---

## Supabase

- Project ID: `dqgfpchkheznvanfgsmx`
- Auth: email/password + verification

## Stripe (livemode)

| Plan | Product ID | Monthly Price ID | Annual Price ID |
|---|---|---|---|
| SFP Hustle | `prod_UaFBtgUANzpzCh` | `price_1Tb4hLId3kJSEdqMH7SYN3a8` ($19/mo) | `price_1Tb4hOId3kJSEdqMiMUrnFm2` ($180/yr) |
| SFP Stack | `prod_UaFBJA9wZ0he0J` | `price_1Tb4hRId3kJSEdqMq9XwGKbZ` ($49/mo) | `price_1Tb4hTId3kJSEdqMB21L5giT` ($480/yr) |
| SFP Empire | `prod_UaFB8CpVCfDjWp` | `price_1Tb4hWId3kJSEdqMFrtyqDkK` ($199/mo) | _(none)_ |
