# ScanForProfit — Session Handoff

This file is the persistent session context. Update it at the end of every Claude Code session with what changed.

---

## Project Location

`C:\Users\bbake\OneDrive\Desktop\scanforprofit`

## Repo

github.com/bbaker71313/scanforprofit (not yet initialized as git repo as of 2026-05-26)

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
