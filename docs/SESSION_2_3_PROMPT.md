# ScanForProfit — Claude Code Sessions 2 + 3 (Combined)
> Scout Tab Overhaul + Tab Restructure (Stats → P&L, Trends rename)
> Save to: `docs/SESSION_2_3_PROMPT.md` and commit before starting work.

---

## PRE-WORK: MANDATORY SESSION START PROTOCOL

Run all 5 checks. Show output for each. Stop and report if any fail.

```powershell
# 1. Confirm shared package name
cat packages/shared/package.json | grep '"name"'
# Expected: "name": "@sfp/shared"

# 2. Confirm all 10 UI component files exist
Get-ChildItem apps/mobile/components/ui/ | Select-Object Name
# Expected: BottomSheet.tsx Button.tsx Card.tsx EmptyState.tsx
#           index.ts Input.tsx ItemCard.tsx ProfitBadge.tsx
#           ScanResult.tsx TabBar.tsx

# 3. Git status
git status
# Expected: on branch main, nothing to commit

# 4. Confirm .env is not tracked
git ls-files .env
# Expected: empty output

# 5. Confirm docs folder structure
Get-ChildItem docs/
# Expected: decisions/ strategy/ marketing/ folders present
```

**STOP RULE:** Any unexpected output = stop, document in HANDOFF.md, wait for instruction.

---

## CONTEXT READS (mandatory before any code)

Read these files in order:
1. `docs/HANDOFF.md` — current state
2. `docs/FEATURE_TRIAGE.md` — AI prompts (port verbatim, never rewrite)
3. `docs/BRAND_IDENTITY.md` — all colors, fonts, spacing
4. `packages/shared/src/constants/theme.ts` — design tokens
5. `CLAUDE.md` — all rules

---

## SKILLS TO LOAD (load before starting)

```
/skill load frontend-design
/skill load karpathy-guidelines
/skill load stop-slop
/skill load onboarding-cro
```

**GitHub repos to reference (read-only):**
- `https://github.com/bbaker71313/stop-slop` — copy rules, banned phrases, anti-patterns
- `https://github.com/coreyhaines31/marketingskills` — marketing copy patterns

---

## SCOPE OF THIS SESSION

**What changes:**

### SCOUT TAB (8 changes)
1. Branded scan phrase — propose 5 options, pause for approval before implementing
2. Animated logo placeholder — leave `<!-- LOGO_ASSET_PATH -->` comment, build animation shell
3. Emoji audit — remove all emojis from Scout tab; replace with text labels or Lucide icons
4. Multi-photo AI scan — allow up to 4 images per single-item scan sent to claude-proxy Edge Function
5. First-time onboarding screens — mobile + web, skippable
6. Fix Listing Tips + Check This sections not populating in scan results
7. Full tab branding refresh — colors, typography, spacing per `docs/BRAND_IDENTITY.md`
8. Fix `index.html` mobile sizing — verify it is `index.html`, fix viewport/responsive CSS only

### TAB RESTRUCTURE (replaces Stats tab changes)
9. Rename Stats tab → P&L tab (replace entirely)
10. Rename Trends tab — propose 5 name options, pause for approval before implementing
11. Move everything unique to Stats (action queue, seasonal sourcing advisory) → Trends tab
12. Business Advisory section → moves into (renamed) Trends tab
13. Action queue items → clicking goes to item edit screen, swipe-to-dismiss removes from queue
14. Remove "Needs Attention" label from action queue
15. Remove Net Profit and Items Sold KPI cards from Stats (they move to P&L tab)
16. P&L tab — full P&L screen: Revenue, COGS, Net Profit, ROI%, expenses, mileage, tax reserve callout
17. Add Upcoming Seasonal Sourcing section to Trends tab
18. Move Plans/Upgrade out of its own tab → into Settings screen
19. Remove Week/Month/Year filter toggles
20. Remove Overview card; replace "Hey There" header with purpose-driven branded header

**What does NOT change this session:**
- Inventory tab
- Listing tab
- Auth flow
- Supabase schema (unless P&L tab requires a migration — document it first, don't run it)
- Any file not directly related to the above changes

---

## KARPATHY RULES — ALL 4, EVERY CHANGE

**Rule 1 — State assumptions first.** Before implementing any change, write one sentence naming your assumption. If ambiguous, stop and ask.

**Rule 2 — Minimum code.** No speculative abstractions. No extra error handling for impossible cases. If 50 lines could be 20, use 20.

**Rule 3 — Surgical changes.** Touch only what the change requires. Do not refactor adjacent code. Do not "clean up while you're in there."

**Rule 4 — Success criteria per change.** For each of the 20 changes above, define a verify step before implementing.

---

## CHANGE-BY-CHANGE INSTRUCTIONS

### CHANGE 1 — Branded Scan Phrase

**Before implementing:**
Propose exactly 5 options to replace "FLIP or PASS". Each must:
- Be 3 words or fewer
- Feel like a branded action, not a generic label
- Pass stop-slop check (no "AI-powered", no "instantly", no hype verbs)
- Work as a button label AND as a verb ("I'm going to ___")

Pause. Do not implement until user picks one.

---

### CHANGE 2 — Animated Logo Placeholder

- Do NOT source or embed the actual logo asset yet
- Build the animation container: `<Animated.View>` or CSS keyframes shell
- Leave `{/* TODO: replace with actual logo asset — LOGO_ASSET_PATH */}` comment
- Animation spec: subtle pulse, 2s loop, opacity 0.7→1.0→0.7, brand green (#00bb66)
- Fallback: if asset missing at runtime, show "SFP" in Syne 800 in brand green

---

### CHANGE 3 — Emoji Audit

Run a find across all Scout tab files for emoji characters.
Replace each with either:
- A Lucide React Native icon (stroke, not fill, 1.5px, from `lucide-react-native`)
- A short text label in IBM Plex Mono 11px uppercase

No emojis anywhere in the Scout tab after this change.
Document every replacement as a comment: `{/* was: 🔥 now: <Flame /> */}`

---

### CHANGE 4 — Multi-Photo AI Scan

**Scope:** Single-item scan only (not shelf scan).
Inventory multi-photo already works — do not touch it.

**Implementation:**
- Allow up to 4 photos per scan (UI: photo strip below main input)
- All photos sent as a single API call to `supabase/functions/claude-proxy`
- Edge Function must accept `images: base64[]` array, not single `image: base64`
- Port the exact prompt from `docs/FEATURE_TRIAGE.md` → `getSingleSys` verbatim — do not change a word
- Add images as `image` content blocks in the messages array (most efficient, single call)
- Compress each image client-side before sending: max 800px longest dimension, JPEG 80%

**Verify steps:**
1. UI renders photo strip with add/remove → verified by visual check
2. Edge Function accepts array → verified by console.log of received payload
3. Single Claude API call for multi-image scan → verified in Supabase Edge Function logs
4. getSingleSys prompt unchanged from FEATURE_TRIAGE.md → verified by diff

---

### CHANGE 5 — First-Time Onboarding Screens

**Load onboarding-cro skill guidance before building this.**

**Activation goal for ScanForProfit:** User completes their first scan.
Everything in onboarding must point toward: point phone at item → get result.

**Research step (do this first):**
Use web search to review onboarding flows for:
- Whatnot (mobile reseller app)
- Depop (mobile reseller app)
- One other high-rated mobile commerce app

Note: what makes them feel fast vs. friction-heavy. Apply learnings.

**Flow spec:**
- Trigger: first login only (`hasSeenOnboarding` flag in Supabase `users` table or AsyncStorage)
- Platforms: mobile (bottom-sheet overlay, 3 screens) + web (centered modal, same 3 screens)
- Skippable: "Skip for now" link on every screen (bottom, IBM Plex Mono 12px, textMuted color)
- Mark as seen after skip OR after completion — never show again

**Screen 1 — Welcome**
- Headline (Syne 700 24px): "Know before you buy."
- Body (IBM Plex Mono 14px): What the app does in 2 sentences max. Pull from `docs/product-marketing-context.md`. Run through stop-slop — no hype.
- CTA: "Let's go →" (accent button)

**Screen 2 — Core Function**
- Headline: "Point. Scan. Decide."
- Content: Brief visual or icon set showing the 3-step loop (camera → scan result → inventory)
- Use Lucide icons, not emoji
- Body: 1 sentence max
- CTA: "Got it →"

**Screen 3 — Settings nudge**
- Headline: "Set your eBay fee once."
- Body: "Everything is calculated from your actual fee. Default is 13% — update it in Settings if yours differs."
- This is important: user must know ebayFee is configurable before first scan
- CTA: "Open Settings" (goes to settings) OR "Start Scanning" (goes to Scout tab)

**PostHog events to fire:**
- `onboarding_started`
- `onboarding_skipped` (with `{ screen: number }`)
- `onboarding_completed`

---

### CHANGE 6 — Fix Listing Tips + Check This Not Populating

**Diagnosis first (do not skip):**
1. Check what the claude-proxy Edge Function actually returns for a scan
2. Check how ScanResult component renders `listing_tips` and `risk_flags`
3. Find the mismatch — is it a key name, a null check, a render condition?

**Fix only the root cause.** Do not refactor the component.

Expected fields from `getSingleSys` response (from FEATURE_TRIAGE.md):
```
search_keywords: string[]
listing_tips: string[]
risk_flags: string[]
```

Verify these keys match exactly what the component is trying to read.

---

### CHANGE 7 — Scout Tab Brand Refresh

Reference: `docs/BRAND_IDENTITY.md` and `packages/shared/src/constants/theme.ts`

Apply to every element in the Scout tab:
- Background: `#f2ece0`
- Surface/cards: `#fdf8ef`
- Primary text: `#1e1208`, IBM Plex Mono
- Headers/labels: Syne
- Brand accent: `#8B6A3E` (buttons, active states)
- FLIP/profit: `#00bb66`
- PASS/loss: `#dd0000`
- HOT/warning: `#c47800`

Run stop-slop on all visible copy in the Scout tab after refresh.
No "AI-powered", no "instantly", no em-dashes used incorrectly.

---

### CHANGE 8 — Fix `index.html` Mobile Sizing

**Verify first:** Confirm the file at fault is `index.html` (scanforprofit.com landing page), not any React Native file.

```bash
# Check what viewport meta is currently set to
grep -n "viewport" index.html
```

If the issue is a fixed-pixel width container showing as a small box centered on mobile:
- Fix the container to use `width: 100%` not a fixed `px` width
- Ensure `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` is present
- Do NOT add `user-scalable=no` — accessibility violation
- Test fix mentally: does a 390px viewport now fill the screen?

Surgical fix only — do not rewrite the landing page.

---

### CHANGES 9–20 — Tab Restructure

**Before implementing ANY tab changes:**

**Step 1 — Propose Trends tab rename:**
Generate 5 name options. Each must:
- Be 1–2 words
- Convey: growth intelligence, business insight, sourcing strategy
- Work as a tab label (short) AND as a screen header
- Pass stop-slop check (no "AI", no "Smart", no "Pro")

Pause. Do not rename until user picks one.

**Step 2 — Map current state:**
List every component currently in:
- `apps/mobile/app/(tabs)/stats.tsx`
- `apps/mobile/app/(tabs)/trends.tsx`
Show what exists before moving anything.

**Step 3 — Execute tab restructure in this order:**

#### 9. Create P&L Tab (replaces Stats)
File: `apps/mobile/app/(tabs)/pnl.tsx`
Content: Full P&L screen from FEATURE_TRIAGE.md spec:
- Revenue from sold items (from `inventory` table where `status = 'Sold'`)
- COGS (sum of `cost` on sold items)
- Net Profit = Revenue − COGS − Expenses
- ROI% = (Net Profit / COGS) × 100
- Non-inventory expenses from `pnl_expenses` table
- Mileage log (rate from `settings.mileageRate` — never hardcode 0.67)
- Tax reserve callout: `settings.taxReservePct` × Net Profit (never hardcode 0.25)
- Remove: Net Profit KPI card (now in P&L), Items Sold KPI card
- Remove: Week/Month/Year filter toggles
- Remove: Overview card

All calculations use `packages/shared/src/utils/calcProfit.ts` only.
Never do math inline in the component.

#### 10. Rename Trends Tab (after user picks name)
- Rename file: `trends.tsx` → `[chosen-name].tsx`
- Update tab bar label
- Update all imports and references

#### 11–12. Move Stats content → Trends tab
Move these from `stats.tsx` to `(renamed trends).tsx`:
- Action queue (stale item recommendations)
- Business Advisory section
- Upcoming Seasonal Sourcing (new — see change 17)

#### 13. Action Queue Interactions
- Clicking an action queue item → navigate to `apps/mobile/app/(tabs)/inventory/[id].tsx` edit screen
- After save in edit screen → item disappears from queue (re-query queue on focus)
- Swipe left on item → show "Dismiss" button → tap → remove from queue (soft delete or flag in `growth_cache`)
- Use `react-native-gesture-handler` swipe (already in Expo SDK 52)

#### 14. Remove "Needs Attention" Label
Find and delete all instances of "Needs Attention" text in the codebase.

#### 15. Remove KPI Cards
Remove from Stats (now becoming P&L tab):
- Net Profit card (KPI) — it's now a full section in P&L tab
- Items Sold card (KPI) — remove entirely

Keep: Revenue, ROI%, STR if present.

#### 16. P&L Tab — Already covered in change 9.

#### 17. Upcoming Seasonal Sourcing Section
Add to (renamed) Trends tab, below action queue.
Data source: static seed data to start (no AI call needed yet).
Structure:
```typescript
interface SeasonalTip {
  category: string
  reason: string   // why to source it now
  priority: 'HIGH' | 'MED'
  monthsAhead: number  // how far ahead you're sourcing
}
```
Seed with 4–6 real reseller seasonal categories based on current month.
Use `new Date().getMonth()` to determine current month — do not hardcode.

#### 18. Plans/Upgrade → Settings Screen
- Find current Plans/Upgrade tab or screen
- Remove it from tab bar
- Add an "Upgrade Plan" section at bottom of Settings screen
- Show current tier (from `user.tier`) and upgrade button if not on Empire
- Upgrade button → existing Stripe paywall flow

#### 19. Remove Filter Toggles
Remove Week/Month/Year toggle buttons from any screen that has them.
Do not add replacement date filters.

#### 20. Remove Overview Card + Rebrand Header
- Remove the "Overview" card component
- Remove "Hey There" or any informal greeting header
- Replace with: tab name in Syne 700 28px + subtitle in IBM Plex Mono 13px describing the tab's purpose
- Example for P&L tab: "P&L" / "Your numbers, your business."
- Run stop-slop on all new copy

---

## TAB BAR FINAL STATE

After all changes, the 5 tabs must be:

| Position | Tab | File |
|---|---|---|
| 1 | Scout | `scout.tsx` |
| 2 | Inventory | `inventory.tsx` (untouched) |
| 3 | Listing | `listing.tsx` (untouched) |
| 4 | [User-chosen Trends rename] | renamed file |
| 5 | P&L | `pnl.tsx` |

Verify: exactly 5 tabs. No more. No less.

---

## TYPE CHECK GATE

After all changes, before any commit:

```bash
npx tsc --noEmit
```

Must return 0 errors. Fix all errors before proceeding to commit.

---

## POSTHOG EVENTS TO ADD THIS SESSION

```typescript
// Onboarding
'onboarding_started'
'onboarding_skipped'     // { screen: 1 | 2 | 3 }
'onboarding_completed'

// Multi-photo scan
'scan_initiated'          // { photo_count: number, mode: 'single' | 'shelf' }

// Action queue
'action_queue_item_tapped'   // { action_type: string }
'action_queue_item_dismissed' // { action_type: string }

// Tab
'tab_viewed'             // { tab: string } — already exists, ensure P&L + new Trends name fires
```

---

## END OF SESSION — MANDATORY COMMIT PROTOCOL

```bash
# Step 1 — Type check
npx tsc --noEmit
# Must be 0 errors

# Step 2 — Review staged files
git add -A
git status
# Confirm: no .env, no node_modules, no .zip

# Step 3 — Commit
git commit -m "feat: scout overhaul + tab restructure (P&L tab, trends rename, onboarding)"

# Step 4 — Push
git push origin main

# Step 5 — Update HANDOFF.md
```

**HANDOFF.md must include:**
- Every file changed (full paths)
- Which of the 20 changes are complete vs. blocked
- The Trends tab name the user picked (or "PENDING — user hasn't chosen yet")
- The scan phrase the user picked (or "PENDING")
- Any Supabase migrations needed but not yet run
- Exact next task for next session

---

## SESSION END REPORT FORMAT

```
FILES CHANGED: [list every file with full path]
COMMIT: [hash]
CHANGES COMPLETE: [1–20 checklist]
PENDING USER DECISIONS: [scan phrase, trends tab name]
MIGRATIONS NEEDED: [list or NONE]
NEXT TASK: [exact description]
BLOCKERS: [none / description]
```
