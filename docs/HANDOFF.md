# ScanForProfit — Session Handoff

This file is the persistent session context. Update it at the end of every Claude Code session with what changed.

---

## Session: 2026-06-16 — App-wide hex sweep on app.html

### Context
Continued from 2026-06-15(2) session. Executed the previously-deferred app-wide hex sweep on `apps/web/public/app.html` to eliminate all remaining retired old-palette hex codes.

### What changed this session

**`apps/web/public/app.html`** — commit `90d387b`:
- `.status-Listed`: `rgba(0,150,80,0.15)` + `#00c060` + `#005530` → `var(--green-bg)` + `var(--green)` + `rgba(0,230,118,0.3)`
- `.sold-btn`: `rgba(0,150,80,0.2)` + `#005530` border → `var(--green-bg)` + `rgba(0,230,118,0.3)`
- `.shelf-item.is-buy` border: `#005530` → `rgba(0,230,118,0.3)`
- `.shelf-item.is-buy .s-badge`: `#228844`/`#fff` → `var(--green)`/`#000`
- `.shelf-section-hdr.is-buy` and `.shelf-stat-num.is-buy`: `#228844` → `var(--green)`
- Auth error div bg: `#ffe6e6` → `var(--red-bg)`
- AI listing gradient: `#00bb66` → `#00e676`
- Growth Advisor title+content: `#005522` → `var(--green)` / `var(--text)` (was unreadable dark green on dark bg)
- CSV reminder button: `#c47800`/`#fff` → `var(--yellow)`/`#000`; saved text: `#c47800` → `var(--yellow)`
- Import preview title + summary + result: `#005522` → `var(--green)` / `var(--text)`
- Delete confirm button: `#dd0000` → `var(--red)`
- Confidence bar medium/low: `#c47800`/`#cc0000` → `var(--yellow)`/`var(--red)`
- Scan history decision badges: `#e8fff2`/`#006633` (HOT), `#d4e8e0` (BUY), `#fee` (PASS) → all use `var(--green-bg)`/`var(--green)` or `var(--red-bg)`/`var(--red)`
- Hot tip div text: `#005522` → `var(--green)`
- Stats scan-history PASS badge bg: `#ffe6e6` → `var(--red-bg)`
- Photo coverage warning bg: `#ffe6e6` → `var(--red-bg)`
- Trial/Scout banners: `#fff4d6`/`#c47800` → `var(--yellow-bg)`/`var(--yellow)`, `#ffe6e6` → `var(--red-bg)`
- TIER_INFO Hustle color: `#00bb66` → `#00e676`; Empire color: `#c47800` → `#f5a623`
- Import item nickname: `#005522` → `var(--text)`; status badge: `#005522`/`#fff` → `var(--green)`/`#000`
- Item detect error text: `#cc0000` → `var(--red)`

**`index.html`** — no changes. All remaining old-palette hits were photo-tint gradients on `.inv-thumb`/`.scan-thumb` which are intentionally left per 2026-06-08(3) session decision.

### PR
- PR #58 open (draft): `claude/dazzling-heisenberg-bsqpr6` → `main`

### Decisions made (do not reverse)
- `index.html` photo-tint gradients (`#8b6a3e`, `#3a2410`, `#c47800` inside `linear-gradient` on `.inv-thumb`/`.scan-thumb`) are intentionally untouched — placeholder tints for photo fallbacks, not brand chrome.
- Growth Advisor *body text* uses `var(--text)` (warm cream `#f0ead8`) rather than `var(--green)` — body copy on a green-bg card should be the standard readable text color, not also green.

### Next task
App-wide hex sweep is complete. Merge PR #58 after CI passes, then proceed to Phase 3 Step 3 (Component Library redo with frontend-design skill) or Phase 4 Build Mobile — whichever the user prioritizes.

### Blockers
None.

---

## Session: 2026-06-15(2) — Full rebrand to dark "Industrial Terminal" (docs + mobile + web + video)

### Context
User reported the brand docs/app still used the retired light "Warm Parchment" palette (light brown) instead of the canonical dark "Industrial Terminal" palette already live in `apps/web/public/app.html`/`index.html`. User chose the broadest option: rebrand **everything** (mobile + web + docs + video) to the dark palette.

### What changed this session

**`docs/BRAND_IDENTITY.md`** — fully rewritten as the canonical dark "Industrial Terminal" spec: new logo colors (`#d4a843` brackets / `#00e676` bars, light-bg variant `#8a6c28`), full §2 color palette tables (backgrounds, brand, semantic, text, borders, scan-decision colors) with computed WCAG ratios, icon-style rationale updated for the near-black background. Header note declares Warm Parchment retired.

**`packages/shared/src/constants/theme.ts`** (`@sfp/shared`, single source of truth for mobile) — `COLORS` rewritten to the dark palette (background `#0a0a0a`, surface `#161616`, elevated `#1c1c1c`, inverse `#000000`, brand/profit green `#00e676`, accent gold `#d4a843`/`#8a6c28`, loss `#ff3333`, warning `#f5a623`, neutral `#8a8070`, text/border tokens updated). `SHADOWS.shadowColor` changed from `#1c1712` → `#000000` (matches new bg.inverse). File-header comments updated to match.

**Mobile hardcoded hex fixes** (theme.ts doesn't auto-cascade to literals):
- `apps/mobile/app/_layout.tsx` — splash background `#1c1712` → `#0a0a0a`
- `apps/mobile/app/(tabs)/scout.tsx` — `DECISION_COLOR` map, profit/loss text color, `ActivityIndicator` color all updated to new palette
- `apps/mobile/components/ui/ScanResult.tsx` / `BottomSheet.tsx` — stale hex values in comments updated to match new `COLORS` constants

**Web (`apps/web/`)**:
- `tailwind.config.ts` — all 12 `sfp-*` color tokens rewritten to dark palette (used across landing pages, roadmap/terms/privacy app routes)
- `components/landing/Nav.tsx` — `LogoMark` SVG hex updated (`#c9a468`→`#d4a843`, `#00bb66`→`#00e676`)
- `public/privacy.html` and `public/terms.html` — `:root` palette rewritten to dark tokens (new `--bg`/`--dark`/`--light`/etc.), body bg, `.hero` border, `.section a` link color (was unreadable `var(--dark)`→now `#000000`, switched to gold), `.callout`/`.warning-box` rgba tints updated to new green/gold, `.contact-box p` color, nav/footer Logo SVG hex

**Video (`apps/video/`)** — resolves the brand-divergence flag from the 2026-06-15(1) session:
- `src/lib/brand.ts` — all color tokens rewritten to dark "Industrial Terminal" (was literal "warm parchment" per old PROMPT_1 spec)
- `src/components/Logo.tsx` — removed hardcoded `#c9a468`, `bracketColor` now derives from `brand.accent`/`brand.accentDim`
- `src/compositions/HeroVideo.tsx`, `YouTubePreroll.tsx` — radial-gradient highlight color `#4a2f17` → `#2e2410` (dark-gold glow against new `#0a0a0a` header)

**AI prompt `score_color` field** (3 occurrences, kept in sync per "port verbatim" rule — only the literal hex values changed, not prompt wording):
- `docs/FEATURE_TRIAGE.md`, `supabase/functions/claude-proxy/index.ts` (prompt spec + response normalization fallback + error-path fallback), `apps/web/public/app.html` (prompt spec line only) — `"#00bb66 or #c47800 or #dd0000"` → `"#00e676 or #f5a623 or #ff3333"`

### Explicitly out of scope (untouched, per prior "do not reverse" decisions)
- `apps/web/public/app.html` / `index.html` — all other old-palette hex residuals (photo-tint gradients, etc.) remain part of the previously-deferred "app-wide hex sweep," a separate session.
- `docs/HANDOFF.md`, `docs/ScanForProfit_v5_24.html` — historical/archival, not "current branding."

### Verification
- Repo-wide grep for all retired palette hex codes (`#00bb66`, `#f2ece0`, `#8B6A3E`, `#c9a468`, `#1c1712`, `#dd0000`, `#e6850a`, `#5c5248`, `#c47800`, etc.) across `.ts`/`.tsx`/`.html`/`.md` → only remaining hits are the explicitly-deferred `app.html`/`index.html` app-wide sweep.
- `npx tsc --noEmit` in `packages/shared` → 0 errors. `apps/web`, `apps/mobile`, `apps/video` show only pre-existing module-resolution errors (`node_modules` not installed in this sandbox) unrelated to this change — no new errors introduced by the hex/value-only edits.

### Decisions made (do not reverse)
- Dark "Industrial Terminal" is the single canonical brand palette everywhere (docs, mobile, web, video). Warm Parchment is fully retired — do not reintroduce.
- `COLORS.brandDim`/`profitText`/`lossText`/`warningText` now equal their non-`*Text` counterparts (no separate "deep" variant needed — AAA contrast achieved directly on dark backgrounds).
- `apps/video/src/lib/brand.ts` now matches the app-wide dark palette — the prior "warm parchment vs dark" divergence is resolved.

### Next task
App-wide hex sweep on `apps/web/public/app.html` / `index.html` (previously deferred) — separate session.

### Blockers
None.

---

## Session: 2026-06-15 — New `apps/video/` Remotion pipeline: 5 marketing video compositions rendered

### Context
User (via `PROMPT_1_CLAUDE_CODE_VIDEO.md` + 3 uploaded screen-recording clips) requested a new isolated Remotion video-production app to generate marketing ad creatives from real app footage.

### What changed this session

**New package: `apps/video/`** (`@sfp/video`, Remotion 4.0.477) — added to the pnpm workspace:
- `package.json`, `tsconfig.json`, `remotion.config.ts` (jpeg image format, overwrite output)
- `src/index.ts` — `registerRoot(Root)`
- `src/Root.tsx` — registers all 5 compositions (ids/dimensions/durations, fps=30) + top-of-file comment documenting ffprobe footage triage findings
- `src/lib/brand.ts` — brand tokens **exactly per PROMPT_1's "warm parchment" spec** (bg `#f2ece0`, header `#3a2410`, green `#00bb66`, Syne + IBM Plex Mono, spacing scale)
- `src/lib/fonts.ts` — self-hosted `@fontsource/syne` (400/700/800) + `@fontsource/ibm-plex-mono` (400/500) — avoids runtime fetches to fonts.gstatic.com
- `src/components/` — `Logo.tsx` (ScanMark + wordmark), `PhoneFrame.tsx` (white-bezel device frame), `FlipBadge.tsx` (FLIP/HOT/PASS animated label), `ProfitCounter.tsx` (animated $ counter), `CTAPill.tsx`
- `src/compositions/` — `HeroVideo.tsx` (1920x1080, 30s/900f), `TikTokAd.tsx` & `StoryAd.tsx` & `SquareAd.tsx`/`YouTubePreroll.tsx` per PROMPT_1 scene specs (1080x1920 / 1080x1080 / 1920x1080, 8-15s)
- `public/footage/` — 3 real screen-recording clips copied in (`screen-20260614-140716.mp4`, `-140913.mp4`, `-141341.mp4`)

**Rendered all 5 compositions** → `apps/video/out/*.mp4` (gitignored — added `apps/video/out/` to `.gitignore`), then copied final renders to `docs/marketing/video-assets/`:
- `hero-1920x1080.mp4` (3.1MB), `tiktok-1080x1920.mp4` (9.8MB), `square-1080x1080.mp4` (6.2MB), `youtube-1920x1080.mp4` (0.9MB), `story-1080x1920.mp4` (3.9MB)

`npx tsc --noEmit` in `apps/video` → **0 errors**.

### ⚠️ Brand palette divergence — flagged, not resolved
`apps/video/src/lib/brand.ts` uses PROMPT_1's literal "warm parchment" palette (`#f2ece0` bg, `#3a2410` header/brown, `#00bb66` green). This **does not match** the live web app's current dark "industrial terminal" palette (`#0a0a0a` bg, `#d4a843` gold accent, `#00e676` green — see 2026-06-08(3) session). Followed PROMPT_1 verbatim since this is a new isolated app and the prompt said "use these exact tokens, never substitute." **Next session should decide**: either restyle `apps/video` to match the dark brand, or treat video ads as an intentionally distinct "warm parchment" sub-brand — needs a deliberate brand decision, not a silent fix.

### Environment workarounds (needed to reproduce renders)
- **Chrome binary**: `remotion render` needs `--browser-executable`. Auto-download is blocked (`remotion.media` not in network allowlist). Installed via: `PUPPETEER_DOWNLOAD_BASE_URL=https://storage.googleapis.com/chrome-for-testing-public npx --yes puppeteer browsers install chrome` → binary at `/root/.cache/puppeteer/chrome/linux-149.0.7827.22/chrome-linux64/chrome`.
- **Fonts**: `@remotion/google-fonts` fails (`ERR_CERT_AUTHORITY_INVALID` on fonts.gstatic.com in this sandbox). Use self-hosted `@fontsource/syne` + `@fontsource/ibm-plex-mono` CSS imports instead (already done in `src/lib/fonts.ts`).
- Render command pattern: `npx remotion render <CompositionId> out/<file>.mp4 --browser-executable=<chrome path>`

### Footage triage (documented in `Root.tsx` header comment)
- Clip `screen-20260614-140716.mp4` — coffee maker scan → PASS result
- Clip `screen-20260614-140913.mp4` — shelf scan → Shelf Report, HOT $50-profit modem (best FLIP-style result; used inside `PhoneFrame` for HeroVideo/SquareAd/YouTubePreroll)
- Clip `screen-20260614-141341.mp4` — Goodwill teacups w/ $2.99 tag (best thrift-shelf b-roll; used full-bleed looped in TikTok/Square/StoryAd, `SHELF_CLIP_FRAMES=389`)

### Verification
- `npx tsc --noEmit` (apps/video) → 0 errors
- All 5 renders confirmed correct dimensions/duration via `ffprobe`
- HeroVideo spot-checked visually at 5 timestamps (1s/5s/12s/22s/28s) — all 5 scenes render correctly (logo intro, hook text, PhoneFrame demo footage, FLIP badge + profit counter, outro CTA)
- TikTokAd/SquareAd/YouTubePreroll/StoryAd not individually frame-checked this session — recommend a quick visual spot-check before using in ad campaigns

### Decisions made (do not reverse)
- `apps/video` is a new, isolated pnpm workspace package — does not affect mobile/web/shared
- `apps/video/out/` is gitignored; final renders live in `docs/marketing/video-assets/`
- Brand palette divergence (warm parchment vs. dark industrial) — flagged above, intentionally left unresolved

### Next task
Run `PROMPT_2_COWORK_DISTRIBUTION.md` in Cowork.

### Blockers
None.

---

## Session: 2026-06-10 — Conversion kit adaptation: mobile onboarding flow + hero sell-through signal

### Context
User received a 3-part "conversion rebuild kit" from ChatGPT (homepage rewrite, pricing rewrite, app onboarding flow) aimed at improving conversion. After investigation and user clarification: pricing tiers stay locked (Scout/Hustle/Stack/Empire — no name/price changes), decision terminology stays `BUY`/`HOT`/`PASS` (the kit's invented "MARGIN" tier was dropped), and the mobile onboarding flow (planned in FEATURE_TRIAGE.md, KPI #1: 60%+ first-scan rate, never built) was the real gap to fill.

### What changed this session

**New: 5-screen mobile onboarding flow** — `apps/mobile/app/(onboarding)/`
- `_layout.tsx` — Stack, headerShown: false
- `identity.tsx` — "What kind of reseller are you?" (4 selectable Card options, local state only)
- `permission.tsx` — "Try a scan" — Allow Camera (`useCameraPermissions`) or Scan Sample Item, both → result
- `result.tsx` — renders `ScanResult` with static demo data (BUY, Vintage Cast Iron Skillet, $4→$47, +$38.50, 962% ROI, 92% confidence) + sold-range/sell-through caption
- `how-it-works.tsx` — 4-step trust reinforcement (Scan → BUY/HOT/PASS decision → Inventory → Stats)
- `upgrade.tsx` — Hustle tier teaser via `TIER_CONFIGS.hustle`; both CTAs mark onboarding complete and route to `(tabs)/scout` or `(tabs)/settings`

**New: `apps/mobile/lib/onboarding.ts`** — SecureStore-based one-time gating (`hasCompletedOnboarding`/`markOnboardingComplete`)

**New: `apps/mobile/lib/onboardingDemoData.ts`** — `DEMO_SCAN_RESULT`, `DEMO_SOLD_RANGE`, `DEMO_AVG_DAYS_TO_SELL` (mobile-only demo content, not added to `@sfp/shared`)

**Edited: `apps/mobile/app/_layout.tsx`** — root redirect logic now also checks `hasCompletedOnboarding()` alongside the session check; new redirect rules:
- `!session && !inAuth && !inOnboarding` → `/(auth)/login`
- `session && !onboardingDone && !inOnboarding` → `/(onboarding)/identity`
- `session && onboardingDone && (inAuth || inOnboarding)` → `/(tabs)/scout`

**Edited: `apps/web/components/landing/HeroSection.tsx`** — `FlipResultCard` footer line now reads `6.2s · 12 sold last 90 days · 9 days avg to sell` (was `· eBay comps`).

**Edited: `apps/web/public/index.html`** (the actual live homepage — see "Important discovery" below) — added a 4th `.scout-metric` row to the hero phone mockup's Scout result card: `Sold last 90d → 12 · 9d avg`, matching the same sell-through signal added to the React hero card.

**New: `apps/mobile/nativewind-env.d.ts`** — this file is referenced in `apps/mobile/tsconfig.json`'s `include` array (`"nativewind-env.d.ts"`) but was **missing from the repo entirely**. Its absence caused all 165 of the pre-existing `Property 'className' does not exist` (TS2769/TS2322) errors across the mobile app (ScanResult, Input, BottomSheet, ItemCard, EmptyState, Button, scout.tsx, login/register/verify.tsx, etc.) — `tsc` had no idea NativeWind augments RN component props with `className`. Restored it (standard NativeWind-generated content: `/// <reference types="nativewind/types" />`), plus added one line `declare module "*.css";` to fix the last remaining error (`global.css` side-effect import in `_layout.tsx`, TS2882). **Result: `npx tsc --noEmit` now returns 0 errors in `apps/mobile`, `packages/shared`, and `apps/web`** — previously `apps/mobile` had 166 errors before this fix (unrelated to this session's other changes, but blocking the mandatory 0-error commit gate).

### Important discovery — `apps/web/public/index.html` is the live homepage, not `app/page.tsx`
`apps/web/next.config.js` has a rewrite: `source: '/'` → `destination: '/index.html'`. So **`apps/web/public/index.html` (static file) is what's actually served at scanforprofit.com**, not `apps/web/app/page.tsx` + `components/landing/*`. This was confirmed by running `next dev` and curling `/` — it returned the static `index.html` markup (Vintage Coach satchel, STR 94%, etc.), not the `HeroSection.tsx` "Vintage Cast Iron Skillet" mockup. `app/page.tsx` is an in-progress React rebuild (per many prior HANDOFF sessions: "Rebuild landing page from static HTML → React components") that is not yet wired to a live route.

This session's plan was originally written assuming `app/page.tsx` was live. Both files were edited with the equivalent sell-through-signal addition so the change has actual effect on the live site (`public/index.html`) while staying consistent with the in-progress React rebuild (`HeroSection.tsx`).

**Follow-up for next session:** decide when/how `app/page.tsx` gets wired up to replace the `next.config.js` rewrite to `index.html`, so future "homepage" edits target one source of truth instead of two.

### Verification
- `apps/mobile`, `apps/web`, `packages/shared`: `npx tsc --noEmit` → 0 errors each. ✅
- `apps/web`: ran `next dev`, curled `/`, confirmed `Sold last 90d · 12 · 9d avg` renders in the live hero phone mockup. ✅ (reverted auto-generated `tsconfig.json`/`next-env.d.ts` changes from `next dev` startup — not part of this change)
- `apps/mobile`: no simulator available in this remote environment. Ran `EXPO_OFFLINE=1 npx expo export --platform ios`, which bundled all 2066 modules (including all 5 new onboarding screens and `_layout.tsx`) successfully via Metro/Babel (which understands `className`/JSX). Final Hermes-compile step failed on an unrelated pre-existing `@sentry/react-native` OpenTelemetry dynamic-import issue, not caused by this session's changes.
- Did not run on-device: full onboarding walkthrough (identity → permission → result → how-it-works → upgrade), relaunch persistence check, or returning-user skip check. **Needs manual verification on a simulator/device next session.**

### Decisions made (do not reverse)
- Pricing tiers (Scout/Hustle/Stack/Empire, $0/$19/$49/$199) unchanged — restyling/copy only, ever.
- Decision terminology is `BUY`/`HOT`/`PASS` everywhere — the ChatGPT kit's "MARGIN" tier was rejected.
- Onboarding uses static demo data only (`DEMO_SCAN_RESULT`) — no real AI/API call during onboarding.

### Out of scope / pre-existing, not touched
- `packages/shared/src/constants/tiers.ts` (`TIER_CONFIGS.hustle.limits` shows `scansPerMonth: 300, inventoryItems: 1000`) drifts from CLAUDE.md's table and `PricingSection.tsx` (both say Hustle = unlimited scans / 500 items). Pre-existing, worth reconciling separately.
- "Growth Agent" naming in marketing/docs vs. brand-voice guidance to avoid it — pre-existing, out of scope.

### Next task
1. Run the mobile onboarding flow on a simulator/device: fresh install → register → verify → confirm lands on `/(onboarding)/identity` (not `/(tabs)/scout`); walk all 5 screens; confirm both upgrade CTAs mark onboarding complete and route correctly; relaunch as same user → onboarding does not re-show; existing onboarded users skip onboarding entirely.
2. Decide on `app/page.tsx` vs `public/index.html` as the long-term homepage source of truth (see "Important discovery" above).
3. (Optional, separate task) Reconcile `tiers.ts` Hustle limits drift noted above.

---

## Session: 2026-06-09 (6) — Bold visual pass 2: gradient cards, larger numbers, stronger glows

### What changed this session

User feedback after PR #48 merged: "it still looks the same." Root cause diagnosed: on a `#0a0a0a` background, drop shadows (`rgba(0,0,0,x)`) are invisible — shadows only cast against light surfaces. Fix: applied "Modern Dark Cinema Mobile" design-system recommendations from ui-ux-pro-max skill.

**`apps/web/public/app.html`** — commit `7b3c062`:
- **Gradient card backgrounds**: `.card`, `.kpi-card`, `.nav-card`, `.stat-card`, `.item-card`, `.modal-box`, `.dash-cat-card`, `.inv-stat-card`, `.pnl-sum-card` all get `linear-gradient(160deg, #1d1d1d 0%, #131313 100%)` — creates visible depth against near-black where flat colors had near-zero contrast
- **Paper texture block updated**: combined paper SVG + gradient into multi-layer `background-image` so gradient shows through texture correctly
- **50% larger numbers**: `kpi-val` 18→24px, `stat-num` 20→30px, `inv-stat-num` 22→32px, `pnl-sum-num` 20→28px; glow text-shadow opacity 0.4→0.65
- **Border tokens upgraded**: `--border` #2a2a2a→#383838, `--border-bright` #3a3a3a→#4a4a4a — 50% brighter; propagates to all row separators, dividers, form outlines
- **Border-radius modernized**: cards 6→10px, kpi/nav-card 4→10px, modal 4→16px, shelf-item 4→10px, btn 4→8px, item-card 3→8px
- **Button gradients**: `btn-green` and `btn-amber` get linear-gradient backgrounds; all glow shadows doubled (20→36px spread, opacity doubled)
- **Decision banners**: radius 6→14px, stronger gradient colors; `hotPulse` animation peak glow `rgba(0,240,120,0.9)` + 10px ring spread
- **Item cards**: gold left-border tint at rest `rgba(212,168,67,0.22)` → fully gold on hover; stronger hover shadow
- **Late CSS overrides fixed**: item-card:hover (line 822), inv-status-card:hover, inv-cat-card:hover all had near-invisible `rgba(80,40,0,0.13)` amber glows — replaced with proper `rgba(0,0,0,0.65)` dark shadows
- **Setup card**: stronger gradient (#1e1800→#100c00), bigger radius (6→14px), gold glow tripled
- **Body**: subtle warm top gradient `#100f0c→#0a0a0a` over 25vh (ambient light from gold accent)

**`apps/web/public/index.html`** — commit `7b3c062`:
- Feature cards: gradient bg, radius 6→12px, shadow 0.35→0.55 opacity, stronger hover
- Price cards: gradient bg, radius 6→12px; featured card glow tripled (0.18→0.28 opacity + inset highlight)
- `btn-primary`: gradient background, glow doubled
- FAQ details: gradient bg, radius 6→10px, gold open-state border ring
- Border tokens: same upgrade as app.html
- Body: same warm top gradient

**PR #49** created as draft. CI: Vercel ✅ Ready, Supabase ✅ Skipped, Railway ✅ Building (not a blocking check). No review comments.

### Decisions that should not be reversed (new this session)

- **Gradient card backgrounds are now the standard**: `linear-gradient(160deg, #1d1d1d 0%, #131313 100%)` is the canonical card background for all card-style components in both files. Do not revert to flat `#161616`.
- **Border brightness**: `--border: #383838` and `--border-bright: #4a4a4a` are the new token values. Do not revert to #2a2a2a/#3a3a3a — those were too dark to see on the near-black background.
- **Paper texture block**: the `.card` override block in app.html now uses combined `background-color + background-image: url(paper), gradient`. If adding future CSS overrides to this block, maintain the multi-layer pattern.

### Next task

1. Merge PR #49 after Railway CI completes.
2. If user still says "looks the same": the next escalation is a structural layout change — consider upgrading the app's max-width from 540px to a wider layout on desktop, or adding an ambient glowing blob element behind content using `body::after`.
3. Deferred: emoji→SVG icon system (138 instances, see prior session notes).
4. Deferred: app-wide hex color sweep (#005522, #228844 etc. in Growth Agent / Scout).

### Blockers
None.

---

## Session: 2026-06-08 (5) — Design-system architecture overhaul: token system + component class consolidation

### What changed this session

Executed the approved Phase 2 plan (`/root/.claude/plans/use-the-ui-pro-wild-island.md`). Full inline-style→class migration across both static HTML files. Baseline was ~785 inline style instances in `app.html` and 25 in `index.html`. End result: ~723 in `app.html` (62 eliminated), 16 in `index.html` (all legitimately dynamic or structural).

**`apps/web/public/app.html`** — 10 commits:

- **Phase 0** (already done from prior session): 5 token groups added to `:root` — spacing scale (--space-1→9), border-radius scale (--radius-xs→full), typography scale (--text-2xs→3xl), shadow system (--shadow-sm/md/lg + 3 glow tokens), z-index scale (--z-base through --z-toast).
- **Phase 1** (already done from prior session): ~200 lines of new CSS classes (Groups A–D): decision-banner state variants (.is-hot/.is-buy/.is-pass), threshold utilities (.u-pos/.u-warn/.u-neg), demand text colors, shelf item states (.shelf-item.is-*), typography/spacing utilities (.u-syne, .u-text-*, .u-mt-*, .u-mb-*, .u-muted, .u-soft, .u-accent, .u-bold9, .u-center), empty-state-dashed, edit-photo-* classes, detail-item-* classes, ai-sourced-badge, inventory card helpers.
- **Phase 2 Step 1** — `renderSingle`: removed D/DC/pc/rc/dayc/stc/confColor inline color-lookup objects; added 6 JS classifier helpers (profitClass, roiClass, daysClass, strClass, confClass, demandClass); decision-banner now uses .is-hot/.is-buy/.is-pass CSS; conf-bar-fill color via .u-pos/.u-warn/.u-neg.
- **Phase 2 Step 2** — `renderShelf`: removed SD/DC objects (light-mode hex leak #e8fff2/#f0fff5/#fff0f0); shelf items now use .is-hot/.is-buy/.is-pass; section headers use .shelf-section-hdr.is-*; stat count cards use .shelf-stat-num.is-*; buy button 6-property inline → .shelf-buy-btn; demandClass()/profitClass() reused.
- **Phase 2 Step 3** — `renderInventoryHome`: empty state giant inline → .empty-state-dashed/.empty-title/.empty-body/.empty-icon; status cards remove statusDefs with light-mode hex #D4E8E0/#D4E0EC → .inv-status-card.is-*; category cards 4 inline props each → .inv-cat-name/.inv-cat-meta/.inv-cat-count/.inv-cat-profit.
- **Phase 2 Step 4** — `renderFilteredList`: action row → .item-row-bot + token gap; price label → u-text-sm u-muted (removes redundant font-family); listing detail → token sizing; status badge margin → token; .item-nick truncation moved to CSS class definition.
- **Phase 2 Step 5** — `showDetail` + `startEdit`: SKU/name inline → .detail-item-sku/.detail-item-name; AI-sourced badge #e8fff2 light-mode bug → .ai-sourced-badge; eBay fees color → u-neg; Est.Profit → .detail-profit-val + profitClass(); photo grid inline → .edit-photo-grid/.edit-photo-wrap/.edit-photo-del; updateProfitPreview() val.style.color → val.className = profitClass(p).
- **Phase 2 Step 6** — `pnlRenderMonthly`: empty/meta/profit typography → utility classes + tokens.
- **Phase 2 Step 7** — `renderGrowthResults` + `updateSoldProfit`: score label/summary → u-syne/u-bold9/u-soft; hunt priority badge 7-prop inline → .hunt-priority.is-high/.is-warn (new CSS class); stale reason/success → utility classes; empty messages → token padding; val.style.color → profitClass().

**`apps/web/public/index.html`** — 1 commit (Phase 3):

- Added 4 new CSS classes: .u-green-bdr, .tag-section, .ps-meta, .fine-print.
- Replaced 3× repeated .tag overrides → .tag.tag-section.
- Replaced 2× .ps-title span overrides → .ps-meta.
- Replaced 4× style="color:var(--green-border)" → class="u-green-bdr".
- Tokenized 4× raw margin-top px values (12px→--space-3, 8px→--space-2) and fine-print margin.
- Replaced fine-print style block → class="fine-print".
- Residual 16 inline styles: 6 unique background-image URLs, 4 dynamic bar-fill widths (%),
  3 token-based spacings already converted (expected residual), 2 structural layout one-offs, 1 flex gap.

### Decisions that should not be reversed (new this session)

- **Icon system deferred**: 138 emoji instances (~17 unique emojis) used as functional icons throughout app.html. Orthogonal to token/component architecture; brand-adjacent (icon style = visual identity); no-build-step constraint makes SVG a separate initiative. Good candidate for a dedicated session.
- **App-wide hex sweep deferred**: `#005522`, `#006633`, `#005530`, `#228844`, `#ffe6e6`, `#f0fff5` scattered throughout Growth Agent, Scout, Import, and inventory cards — per plan, a dedicated cross-cutting pass is needed, not bundled with function-level refactors.
- **`.growth-profit` layout properties** (margin-left/flex-shrink) moved into the CSS class definition rather than remaining inline — all usages now rely on the CSS class; don't add inline overrides.
- **`.item-nick` truncation** moved into the CSS class definition — don't add inline white-space/overflow/text-overflow on elements using this class.

### Next task

1. Deploy to Vercel (merge/push branch, verify live deployment) — the Vercel webhook deploys from `scanforprofit` repo's main branch; this work is on `claude/scanforprofit-ui-seo-audit-9xn510`, needs a PR merge.
2. Browser regression check: open `/app.html` and click through Scout (single scan + shelf scan result), Inventory (home, list, detail, empty state), and Growth Agent — confirm HOT/BUY/PASS banners, shelf item cards, status badges, profit colors, AI-sourced badge, and edit-photo grid all render correctly against the dark theme.
3. Consider the app-wide hex color sweep as a follow-up session (see deferred items above).
4. Consider the icon system (emoji→SVG) as a dedicated future session.

### Blockers
None.

---

## Session: 2026-06-08 (4) — Visual + SEO audit fixes: Stats tab polish + homepage cleanup

### What changed this session

User asked for a full visual/SEO audit of scanforprofit.com (homepage) and scanforprofit.com/app.html, specifically calling out "the stats tab looks horrible." Produced an audit + fix plan (`/root/.claude/plans/use-the-ui-pro-wild-island.md`), got it approved, then implemented the fixes. User's explicit mandate: **(a) do NOT add `noindex` to app.html — Google discoverability is "very important"; (b) don't just fix bugs, "make it look the best that it can."**

**`apps/web/public/app.html`** — Stats tab dark-theme color pass:
1. Renamed `class="kpi-num"` → `class="kpi-val"` (4× in `sPnlRender()`) — fixes an undefined-CSS-class bug that left P&L summary numbers unstyled (plain body text instead of bold gold Syne, inconsistent with Dashboard KPI cards).
2. Re-themed both Mileage Logger cards — the Stats > P&L one AND the `#panel-pnl` drill-down's (same component, same bug, fixed both for consistency): hardcoded `#e8b840`/`#c47800`/`var(--yellow-bg,#fffbe6)` light-mode hex → `var(--yellow)`/`var(--yellow-bg)` theme tokens; button text `#fff`→`#000` on gold background (matches the established `.btn-green` convention).
3. Fixed two light-mode badge bugs in `renderSubscriptionPanel()`: FREE-tier badge `background:'#f4f4f4'` (near-white)/`color:'var(--muted)'` → `background:'var(--surface)'`/`color:'var(--soft)'`; low-days trial-warning badge `'#ffe6e6'` (light pink) → `'var(--red-bg)'` — both now use pre-existing dark-theme-correct CSS variables.
4. Removed the duplicate Google Fonts load in `<head>` — folded the `@import`'s extra weight (IBM Plex Mono 700) into the existing `<link rel="stylesheet">` and deleted the redundant `@import url(...)` inside `<style>`.
5. **Did NOT add `<meta name="robots" content="noindex">`** — user explicitly wants the app discoverable via Google search.

**`apps/web/public/index.html`** — homepage SEO/UX cleanup:
1. Added `<link rel="icon" href="/favicon.png">` + `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` — copied `apps/mobile/assets/favicon.png` (32×32) and `icon.png` (1024×1024, renamed `apple-touch-icon.png`) into `apps/web/public/` (no suitable web favicon existed before).
2. Wrapped the page's content sections in a `<main>` landmark (hero through final-CTA, before `<footer>`).
3. **Removed** the hidden `#social-proof` section entirely (markup + its dedicated CSS: `.proof-grid`/`.proof-card`/`.proof-metric`/`.proof-label`/`.proof-quote`/`.proof-attr`/`.avatar*`/`.proof-name`/`.proof-role`, ~70 lines) — it contained fabricated testimonials (fake handles like `@flippin_marcus`, unverified numbers like "$180→$900+") shipped with `display:none`. Decided to delete rather than re-enable: shipping fake social proof on a pre-launch site is a trust/credibility risk, and `display:none` content that's still crawlable is an SEO smell either way.
4. Fixed dead `href="#"` links: both header/footer logo links → `href="/"`; removed all 5 dead "Learn more →" feature-card links (and their now-unused `.feature-link`/`.feature-link:hover` CSS) since no feature detail pages exist — the cards already convey the info and the page CTA is "Get early access," so a non-functional secondary link added no value.
5. **"Contact Sales"** (Empire tier) — was routing to the same `#early-access` waitlist anchor as every other CTA (misleading for a "talk to sales" intent). Changed to `mailto:customerservice@scanforprofit.com?subject=Empire%20plan%20inquiry` — reused the real support address already live in the footer (`<li><a href="mailto:customerservice@scanforprofit.com">Contact</a></li>`), no new infrastructure invented.
6. **Wired the footer newsletter form** to the same `/api/waitlist` endpoint as the hero capture form (it previously had zero backend wiring — just disabled the button and fired an analytics event). Added the same email-regex validation, loading/success/error states, and `trackEvent` calls as the proven `early-form` handler — both forms now behave consistently and actually persist signups to Supabase.

### Decisions that should not be reversed
- **No `noindex` on app.html** — explicit user instruction; Google discoverability of the app shell is a product priority, not an oversight.
- **`#social-proof` deleted, not re-enabled** — the testimonials were fabricated placeholder content (fake usernames/unverified metrics). Don't resurrect this markup; if real testimonials are collected later, build a fresh section with real attributions.
- **`#panel-pnl` is NOT dead code** — corrected a wrong finding from the initial audit (a sub-agent claimed it was orphaned). It's a legitimate drill-down screen reached via the Dashboard's `nav-card onclick="switchTab('pnl')"`. Do not delete it.

### Flagged but explicitly NOT fixed (scope decisions — documented for a future session)
- **Hardcoded `tax = net * 0.25` and `mileageRate = 0.67`** (CLAUDE.md violations — "never hardcode taxReservePct/mileageRate"): on inspection, the live `DEFAULTS`/`S` settings object (app.html line ~4079) has **no `taxReservePct` or `mileageRate` fields at all** — there is no settings infrastructure to read from. Properly fixing this means building a new settings feature (DB columns, settings UI, defaults wiring) — out of scope for "improve Stats visuals." Recommend a dedicated follow-up session.
- **App-wide light-mode hex colors** (`#005522`, `#228844`, `#006633`, `#005530`, `#ffe6e6`, `#f0fff5` etc.) — NOT Stats-specific; they appear throughout Growth Agent, Scout scan results, Import screen, and inventory cards. Re-theming all of them is a large cross-cutting change beyond "fix the Stats tab." Left as-is per surgical-changes rule.
- **Border-radius "normalization"** — the original audit flagged 8px/12px in the Subscription panel as inconsistent, but on reviewing the wider app, 8px/12px are actually the *dominant, established* radii (buttons, cards, modals, dropzones); only `.kpi-card` uses 4px. Normalizing the Subscription panel down would have made it *less* consistent with the rest of the app. No change made.
- **Inline-style consolidation / emoji→icon replacement** — large refactors (`renderSubTierCards`, `renderSubscriptionPanel`, multiple template-string blocks) that go beyond "fix Stats visuals" scope. Recommended as a dedicated follow-up.
- **`.dash-section` (9px label text)** — defined in CSS but has zero usages in markup (`grep -c 'class="dash-section'` → 0); it's dead CSS, not a visible/rendered issue. Left alone.

### Next task
1. Visual spot-check `/app.html` Stats tab (Overview/P&L/Plan sub-tabs) and the homepage in a real browser — confirm badges/numbers/cards read correctly against the dark theme, favicon shows in the browser tab, newsletter signup round-trips to Supabase.
2. Consider the flagged-but-deferred items above for a future session (settings infrastructure for `taxReservePct`/`mileageRate`, app-wide light-mode hex color sweep, inline-style consolidation).
3. Corrected the audit plan file (`/root/.claude/plans/use-the-ui-pro-wild-island.md`) in place — it now reflects what was actually verified/done/deferred and corrects the wrong "`#panel-pnl` is orphaned" claim from the initial pass.

### Blockers
None.

---

## Session: 2026-06-08 (3) — Brand Unification: index.html reworked to match app.html's dark system

### What changed this session

The prior re-audit session flagged something the `impeccable` detector can't catch on its own: `index.html` (marketing landing page) and `app.html` (the actual product) read as two different brands — different fonts (Plus Jakarta Sans + Fira Code vs. the spec's Syne + IBM Plex Mono), different palettes (light warm-beige "editorial" vs. dark "industrial terminal"), different component personalities (soft drop-shadow lift-on-hover vs. quiet glow language). User chose **full unification** over keeping two registers: rework `index.html` end-to-end to match `app.html`'s dark system.

**`apps/web/public/index.html`** — CSS/token rewrite only; copy, structure, IDs, `aria-*`/`role`, every `<a href>`/CTA destination, the PostHog snippet, both JSON-LD blocks (verified byte-for-byte unchanged), `<meta>`/`<link rel="preconnect">` tags, and the hidden `#social-proof` state are all untouched:

1. **Fonts** (line 24): swapped Plus Jakarta Sans + Fira Code → `Syne:wght@700;800;900` + `IBM+Plex+Mono:wght@400;500;600;700` (now matches `app.html` exactly — shared cached font payload, and finally matches the documented spec in `BRAND_IDENTITY.md`).
2. **`:root` palette** (lines 54-77): full swap to app.html's dark tokens (`--bg:#0a0a0a`, `--card:#161616`, `--text:#f0ead8`, `--accent:#d4a843` gold, `--green:#00e676`, etc.), added tokens index lacked (`--card-hover`, `--accent-dim`, `--red-bg`, `--yellow-bg`, translucent `--green-bg`/`--purple-*`).
3. **`--header` deleted** (do-not-reverse decision — see below).
4. **Scanline overlay**: ported `body::before` `repeating-linear-gradient` + `mix-blend-mode:multiply` + `z-index:9000` verbatim from app.html — the signature "industrial terminal" texture.
5. **Nav, buttons, hero, section headings, cards, badges/pills/status, FAQ, final CTA, footer**: retinted to dark tokens; unified card radius to 6px (matches app.html's actual `.card` value), badge/pill radius to 3px; replaced soft-shadow lift-on-hover with app.html's quiet glow language (`background → var(--card-hover)` + `border-color → var(--accent)`, no transform); buttons now glow (`box-shadow: 0 0 20px rgba(0,230,118,0.25)`) and press (`scale(0.97) translateY(1px)` + `brightness(0.9)`) instead of lifting; added focus ring on `.newsletter input` matching app.html's input-focus pattern (`box-shadow: 0 0 0 2px rgba(212,168,67,0.15)`).
6. **Logo** reskinned to match `.app-logo-name` exactly (gold, glow text-shadow, 900 weight, 0.12em tracking).
7. **Locked easing curve**: every new/changed transition uses `cubic-bezier(0.16,1,0.3,1)` (the one approved curve per the prior session's bounce-easing fix — never elastic/overshoot).
8. **Did NOT port** `hotPulse`/`buySweep`/`statFlash` (tied to live decision states that don't exist on a marketing page) or the `.card::before` gold side-stripe (the team actively removed this exact "side-tab" tell from app.html dashboard cards in commit `a5c0f34` — reintroducing it on marketing cards would be regressive).
9. **Remapped every orphaned old-palette literal** found during the rewrite (not all were itemized in the plan — found via systematic grep after the token swap): old green `#00bb66`/`rgba(0,187,102,*)` → new `#00e676`/`rgba(0,230,118,*)`; old card-cream `rgba(253,248,239,*)` → `rgba(240,234,216,*)`; old header-brown `rgba(58,36,16,*)` → near-black/white-translucent equivalents; old yellow `rgba(196,120,0,*)` → `rgba(245,166,35,*)`; old purple `rgba(107,63,160,*)` → `rgba(179,136,255,*)`. Left `.inv-thumb`/`.scout-frame`/`.scan-thumb` photo-tint gradients (`#8b6a3e`, `#3a2410`, etc.) untouched — they're photo placeholder tints, not brand chrome.
10. **Contrast fixes**: applied app.html's `color:#000` convention on bright `--accent`/`--green` backgrounds (`.avatar`, `.feature-card.green .feature-icon`, `.price-card.featured .price-badge`).

### Decision that must NOT be reversed: `--header` token deleted

`index.html` used `--header` (`#3a2410` brown) as a *heading/ink text color* in ~44 places, while `app.html` uses `--header` (`#000000`) as a *background* for nav/tab-bar only — these are semantically incompatible, not interchangeable. **Resolution: deleted `--header` entirely.** All ~44 text-color references became `var(--text)` (app.html's light-ink-on-dark color, `#f0ead8`). The ~10 places where index.html used `--header` as a *background* ("dark chip with light text") got individual case-by-case replacements chosen by finding the closest analog in app.html's actual vocabulary (verified by reading/grepping app.html first — e.g. `.hunt-head`/`.skip-link` → pure-black `#000` bars, matching app.html's only literal `--header:#000000` usage; `.ps-tab.active` → gold accent, matching `.tab-btn.active{color:var(--accent)}`; `.feature-icon`/`.avatar.a2` → translucent `--green-bg` badge pattern). **Do not reintroduce a `--header` token or restore the brown palette** — this was the single largest and most deliberate decision in the rewrite.

### Verification

- Re-ran `node cli/bin/cli.js detect --json apps/web/public/index.html` from `/home/user/impeccable`: the `overused-font` finding is gone (as predicted — fonts now match the documented spec). New `dark-glow` finding appeared, but it's **not a regression** — `app.html` carries the identical `dark-glow` finding (confirmed by running the detector on both files side-by-side), because both pages now intentionally share the same gold-glow "industrial terminal" aesthetic defined in `BRAND_IDENTITY.md`. `em-dash-overuse`, `numbered-section-markers`, `aphoristic-cadence` findings are unchanged copy-voice items, untouched per scope.
- Confirmed 0 remaining `var(--header)` / `var(--border-dark)` / old-palette hex-rgba literals via grep sweep.
- Confirmed both JSON-LD `<script type="application/ld+json">` blocks present and untouched (2 blocks, byte count unchanged).
- No build/typecheck step applies — `index.html` is a static asset (`next.config.js:9` does a plain route rewrite). Verification is visual; recommend opening `index.html` and `app.html` side-by-side in a browser at 375/768/1280px to confirm they now read as one cohesive product.

### Next task

1. Visual spot-check in a real browser at mobile/tablet/desktop widths — confirm fonts render as Syne/IBM Plex Mono, no orphaned light-mode colors, glow/press states feel right, scanline doesn't fight the nav backdrop-filter or hero radial glows.
2. **Recommend updating `docs/BRAND_IDENTITY.md`** to document the dark "industrial terminal" system as the single canonical brand register — the spec currently still defines an unused light "Warm Parchment" token set that no longer matches either surface.
3. Push this work to the existing PR #45 branch (or open a new PR) once visually verified.

### Blockers

None.

---

## Session: 2026-06-08 (2) — Re-audit Confirmation (index.html + app.html)

### What changed this session

No code changes — re-ran the `impeccable` anti-pattern detector fresh on both `apps/web/public/index.html` (scanforprofit.com) and `apps/web/public/app.html` (scanforprofit.com/app.html) to confirm the P2/P3 fixes from the prior session (commit `a5c0f34`) landed cleanly and to capture the current baseline.

**Confirmed fixed (no longer flagged):**
- `side-tab` accent border on `.dash-cat-card` / `.inv-cat-card` — gone
- `bounce-easing` — all 4 animations (`modalIn`, `soldBurst`, `toastIn`, `scoreCount`) now use `cubic-bezier(0.16,1,0.3,1)`, confirmed in source at lines 656/746/754/817

**Findings remaining (identical to last session's list — all previously triaged as false positives or deferred brand/copy decisions, intentionally untouched):**

`index.html` (4 findings):
| Rule | Severity | Detail |
|---|---|---|
| `overused-font` | warning | line 24 — Plus Jakarta Sans |
| `em-dash-overuse` | warning | 6 em-dashes in body text |
| `numbered-section-markers` | advisory | sequence 01, 02, 03, 10, 12 |
| `aphoristic-cadence` | warning | 6 constructions, e.g. "Listed for 60 days. No offers." |

`app.html` (14 findings):
| Rule | Severity | Detail |
|---|---|---|
| `layout-transition` ×3 | warning | lines 604, 1684, 3824 — `transition: height/width` |
| `broken-image` ×8 | warning | lines 1039, 1114, 1235, 1675, 4025, 4522, 6734, 6739 — confirmed false positives (JS-populated `<img>` placeholders) |
| `em-dash-overuse` | warning | 19 em-dashes in body text |
| `dark-glow` | warning | line 172 — gold glow `rgb(212,168,67)` on dark bg, intentional brand aesthetic |

No new findings appeared. No action taken — re-run was confirmation only, per the prior session's "do not change anything that isn't explicitly in this session" decision.

### Next task

Same as prior session's open items: spot-check the re-eased animations/hover states on a real device, and revisit the deferred `dark-glow`/`em-dash-overuse`/`overused-font`/`numbered-section-markers`/`aphoristic-cadence`/`layout-transition` items only if a dedicated brand-voice or perf-profiling session is scheduled.

### Blockers

None.

---

## Session: 2026-06-08 — P2/P3 Audit Fixes (app.html)

### What changed this session

Continuation of the design-audit session below (P0/P1 already merged via PR #43). Re-ran the `impeccable` anti-pattern detector fresh on `index.html` and `app.html` and fixed the P2/P3 findings that were genuine, surgical, low-risk defects:

- **`apps/web/public/app.html`**:
  - **[P2] side-tab accent border** — removed the `border-left:2px solid var(--border)` accent stripe from `.dash-cat-card` (line 527) and `.inv-cat-card` (line 567), the most recognizable "AI-generated UI" tell per the anti-pattern rule. Changed the matching `:hover` rules from `border-left-color:var(--accent)` to `border-color:var(--accent)` so the hover state still highlights the whole card border instead of a now-removed stripe.
  - **[P3] bounce-easing** — replaced all 4 instances of the elastic/overshoot timing function `cubic-bezier(0.34,1.56,0.64,1)` (lines 656 `modalIn`, 746 `soldBurst`, 754 `toastIn`, 817 `scoreCount`) with the smooth exponential ease-out curve `cubic-bezier(0.16,1,0.3,1)` — the anti-pattern rule's own stated recommendation (no overshoot/wobble).

### Decisions made this session — findings investigated and deliberately NOT changed

- **`broken-image` ×8** (app.html lines 1039, 1114, 1235, 1675, 4025, 4522, 6734, 6739) — confirmed false positives: all are dynamically-populated `<img>` placeholders that JS sets `src` on at runtime, or detector matches inside JS string/comments mentioning `<img>`. Fixing would actively break the UX (showing broken-image icons before JS populates them).
- **`dark-glow`** (app.html line 172, gold glow `rgb(212,168,67)` on dark background) — intentional brand aesthetic (the gold-accent "industrial terminal" look defined in BRAND_IDENTITY.md). A redesign decision, not a defect — out of scope for "fix p2/p3" without a brand discussion.
- **`layout-transition` ×3** (app.html lines 604, 1684, 3824) — already identified as P1 and explicitly deferred in the prior session's HANDOFF entry (converting `transition: height/width` to `transform` risks breaking 4+ chart-rendering call sites for negligible real-world gain). Not re-opening per "do not change anything that isn't explicitly in this session."
- **`em-dash-overuse`** (app.html: 19 instances; index.html: 6 instances), **`overused-font`** (index.html line 24, Plus Jakarta Sans), **`numbered-section-markers`** (index.html sequence 01/02/03/10/12), **`aphoristic-cadence`** (index.html: 6 constructions like "Listed for 60 days. No offers.") — all copy-voice / brand / structural decisions requiring subjective judgment and broader consultation, not surgical defect fixes. Left untouched to honor "do not change anything that isn't explicitly in this session."

### Commits this session

| Hash | Message |
|---|---|
| `a5c0f34` | style: remove side-tab accent borders and bounce-easing from app.html |

### Next task

1. Visually spot-check `.dash-cat-card`/`.inv-cat-card` hover states and the 4 re-eased animations (modal open, sold-burst, toast, score count-up) on a real device/browser to confirm they read as smoother/cleaner with no regressions
2. If a brand/copy session is ever scheduled, the deferred findings above (`dark-glow`, `em-dash-overuse`, `overused-font`, `numbered-section-markers`, `aphoristic-cadence`) are the candidate list — each needs a deliberate brand-voice decision, not a mechanical fix
3. Revisit the deferred `layout-transition` → `transform` conversion as its own focused/profiled session if needed

### Blockers

None.

---

## Session: 2026-06-08 — Design Audit + P0/P1 Fixes (index.html + app.html)

### What changed this session

Ran a manual design audit (impeccable framework: a11y, performance, theming, responsive, anti-patterns) on `apps/web/public/index.html` and `apps/web/public/app.html`, then fixed every P0 and P1 finding:

- **`apps/web/public/app.html`**:
  - **[P0]** Removed `maximum-scale=1.0, user-scalable=no` from the viewport meta tag (line 31) — was blocking pinch-to-zoom, fails WCAG 1.4.4 (Resize Text)
  - **[P0]** Added `role="button" tabindex="0"` to all 27 interactive `<div>`/`<img>` elements that only had `onclick` handlers (mode tabs, dropzones, item thumbs, KPI/nav cards, status/category cards, photo dots, drill-down close, etc.), plus one delegated `keydown` listener (Enter/Space → `.click()`) near `window.onload` so all of them are keyboard- and screen-reader-operable — chosen over 27 individual `onkeydown` handlers per "surgical changes" rule
  - **[P0]** Added `aria-label` to the 15 `<input>` elements that relied on `placeholder` alone (auth/register fields, search boxes, cost/miles/sale-price inputs, reminder time)
  - **[P1]** Converted all 33 `<div class="card-title">` elements to semantic `<h3 class="card-title">` — app previously had only 2 real headings (`<h1>`, `<h2>`), breaking screen-reader navigation
  - **[P1]** Added one `@media (min-width: 600px)` rule centering `.app-header`/`.tab-bar` at `max-width: 540px` to match `.tab-panel`, so the app shell doesn't stretch edge-to-edge on tablet/desktop — first responsive breakpoint in the file (previously zero)
- **`apps/web/public/index.html`**:
  - **[P0]** Replaced the fabricated "**156%** avg ROI from testing" hero-trust claim (line 745) with honest copy ("Real eBay fee math, not guesswork") — this was the same fake metric already flagged as a pending task in an earlier HANDOFF entry

### Decisions made this session

- Used one global delegated `keydown` listener for keyboard activation of the 27 clickable divs/imgs instead of per-element handlers — minimizes surface area of the change (Karpathy Rule 3)
- Used `<h3>` (not `<h2>`) for card-title conversion — sits one level below both existing heading contexts (`<h1>` in Scout, `<h2>` in Settings) without creating hierarchy conflicts
- **Deferred** the P1 finding "layout-property transitions" (`transition: height`/`width` on `.bar-fill`, `#buy-conf-bar`, dash chart bars at app.html lines ~600, 1680/1687, 3820/3827) — converting to `transform`-based animation would require restructuring how each bar's size is computed/set across 4+ JS call sites (real risk of breaking chart rendering) for negligible real-world gain (small elements, infrequent triggers, not scroll/frame-linked). Left as-is; flagging for a future dedicated pass if desired.
- Did not touch the `156% ROI` / `$2,847` numbers that appear *inside* the hero phone-mockup illustrations (lines ~774, ~860, ~1123) — those are `aria-hidden` sample-UI screenshots showing what the app looks like, not factual marketing claims (unlike the hero-trust line, which asserted a real test result)

### Commits this session

| Hash | Message |
|---|---|
| `13cef1d` | fix: address P0/P1 audit findings on app.html and index.html |

### Next task

1. **Test on a real device/browser** — verify keyboard nav (Tab + Enter/Space) works on the 27 newly-focusable cards/tabs/dropzones, confirm the new `@media` breakpoint looks right at tablet/desktop widths, and confirm the `<h3>` card-title conversion didn't visually change anything (CSS class selector takes precedence over UA `<h3>` defaults, so it shouldn't have)
2. **Optional follow-up**: revisit the deferred `transition: height/width` → `transform` conversion as its own focused session if performance profiling shows it's actually causing jank
3. Continue with whatever was next on the existing PR #41 / scanner-verification track (this session's branch is `claude/scanforprofit-design-audit-5K3YG`, separate from `claude/serve-app-html`)

### Blockers

None.

---

## Session: 2026-06-06 — Camera Scanner Fix + Photo Scan Typed Endpoint

### What changed this session

- **`apps/web/public/app.html`** — replaced the broken FormData `/v1/messages-with-image` photo scanner with typed claude-proxy endpoints:
  - Added `imgFileToBase64Resized()`: resizes photo to 1568px max on canvas (JPEG 85% quality) before base64 encoding — avoids Anthropic's 5MB image limit, keeps memory bounded vs raw file
  - Added `callScan(type, hint)`: posts `{ type, imageBase64, hint }` JSON to `API_BASE`, handles scan-limit 429 + auth errors, returns structured server response
  - Updated `analyze()`: photo path now calls `callScan('single_scan')` → uses server-side business logic (tier gating, scan counting, BUY/HOT/PASS decision engine, scan_log writes, user settings); text-only path unchanged (still uses `callClaude()`)
  - Updated `analyzeShelf()`: uses `callScan('shelf_scan')`, maps camelCase server response to snake_case `renderShelf()` format

### Decisions made this session

- Photo scan goes through typed endpoint (`single_scan`/`shelf_scan`) — this is the intended architecture from HANDOFF.md Phase 4 design
- Image resized to 1568px on client before sending (canvas + FileReader approach) — acceptable memory trade-off vs the old FormData server-resize approach
- Text-only `analyze()` still uses `callClaude()` → legacy `/v1/messages` path (no image involved, legacy path works fine for this case)
- `invFormDetectItem()` (inventory photo detect) left unchanged — separate feature, will migrate in a future session if needed

### Commits this session

| Hash | Message |
|---|---|
| `50850eb` | feat: replace FormData photo scanner with typed claude-proxy endpoints |

### PR

- PR #41 open: `claude/serve-app-html` → `main`
- Vercel preview deployed: `scanforprofit-git-claude-serv-4bf63a-scan-for-profit-s-projects.vercel.app`

### Next task

1. **Test the scanner on a real device** — take a photo in Scout tab, confirm BUY/HOT/PASS result renders
2. **Fix `invFormDetectItem()`** — also uses legacy FormData path (`/v1/messages-with-image`); migrate to typed endpoint when user confirms scanner is working
3. **Add RESEND_API_KEY to Supabase secrets** — verification emails currently not sending for new signups
4. **Merge PR #41** once scanner is verified working

---

## Session: 2026-06-03 — Phase 4 Step 8: EAS Build + TestFlight

### What changed this session

- **`apps/mobile/eas.json`** — added `ios.buildType=app-store` + `ios.distribution=store` to `production` build profile; added `submit.production.ios.testFlightEnabled=true`
- **`apps/mobile/app.json`** — added `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` to `ios.infoPlist` (required for App Store review); bumped android `versionCode` to 4

### Decisions made this session

- `production` build profile explicitly sets `ios.buildType=app-store` + `distribution=store` (EAS default was ambiguous)
- Privacy usage strings added before build (App Store review requires these for camera/photo library usage)
- Node.js is not in PowerShell PATH — `eas build` must be run from user's own terminal

### Build steps to run manually (open terminal where `node` is available)

```bash
cd C:\Users\bbake\OneDrive\Desktop\scanforprofit\apps\mobile

# 1. Verify auth
eas whoami

# 2. Build for App Store / TestFlight
eas build --platform ios --profile production

# 3. Submit to TestFlight (after build completes ~10-15 min)
eas submit --platform ios --latest

# 4. In App Store Connect → TestFlight: add internal testers
```

### Commits this session

| Hash | Message |
|---|---|
| `05f8a2f` | chore: Phase 4 Step 8 -- EAS build config + iOS privacy keys |

### tsc result

Node.js not in PowerShell PATH — could not run `tsc --noEmit`. No code changes this session.

### What's pending (user must do)

1. `git push origin main` (push blocked by auto-mode classifier — run manually)
2. Run `eas build --platform ios --profile production` in a terminal where Node is available
3. Run `eas submit --platform ios --latest` after build finishes
4. Add internal testers in App Store Connect → TestFlight

### Next task

**Phase 5 — Web App Build** (landing page React scaffold, pricing page, Vercel deploy)

---

## Session: 2026-06-03 — Phase 4 Step 7: Settings Screen

### What changed this session

- **`packages/shared/src/types/index.ts`** — added `SettingsInput` (mutable subset of `UserSettings`, 9 fields)
- **`supabase/functions/claude-proxy/index.ts`** — added `handleSettingsGet` and `handleSettingsUpdate` handlers; routing for `settings_get` and `settings_update`. Scout tier blocked from update (returns 403). Server-side validation for all 9 fields. Deployed as version 8.
- **`apps/mobile/lib/settings.ts`** — created: `fetchSettings()`, `saveSettings()`, `resetToDefaults()`, `DEFAULT_SETTINGS_INPUT`
- **`apps/mobile/components/ui/SettingsForm.tsx`** — created: form with internal string state, client-side validation per field, Pricing / Inventory Rules / Preferences groups, Reset to Defaults button
- **`apps/mobile/app/(tabs)/settings.tsx`** — created: Scout shows read-only preview + PaywallModal offer; Hustle+ sees full editor with save/reset/cancel
- **`apps/mobile/app/(tabs)/_layout.tsx`** — added hidden `settings` Tabs.Screen entry (`href: null` — 5-tab rule preserved)
- **`apps/mobile/app/(tabs)/stats.tsx`** — added gear icon in header (`router.push('/(tabs)/settings')`) to navigate to settings

### Decisions made this session (do not reverse)

- `sourcingStyle` uses existing `'conservative'|'balanced'|'aggressive'` — NOT spec's `'thrift'|'estate'|'retail'|'online'` (proxy/DB already use conservative/balanced/aggressive)
- `shipping` uses existing `'buyer'|'seller'` — NOT spec's `'standard'|'expedited'|'local'` (P&L logic depends on buyer/seller distinction)
- Settings screen is hidden from tab bar (5-tab constraint); accessed via gear icon on Stats header
- SettingsForm uses internal string state for text inputs, parses to numbers only on Save

### Commits this session

| Hash | Message |
|---|---|
| `6b5be8a` | feat: Phase 4 Step 7 -- Settings screen, tier gate, proxy handlers |

### tsc result

Node.js not installed at `C:\Program Files\nodejs\` (PATH entry exists but dir missing) — could not run `tsc --noEmit`. All types reviewed manually; no known issues.

### Next task

**Phase 4 Step 8 — EAS Build + TestFlight**

---

## Session: 2026-06-02 — Full Repo Audit (all 18 branches)

### What was audited

Full audit of the entire GitHub repo across all 18 branches: branch history, edge function code, mobile screens, migrations, web app, and shared packages. No code was changed — audit only.

### Branch cleanup needed

12 of 18 branches are stale Flippd-era dead code and should be deleted:

| Branch | Reason to delete |
|---|---|
| `claude/admin-tier-management-X5Q2i` | Old single-file Flippd HTML work |
| `claude/audit-run-errors-6RmCv` | Old Flippd fixes |
| `claude/brave-brahmagupta-ff7NM` | Old Flippd work |
| `claude/deploy-edge-functions-kHcBm` | Empty |
| `claude/fix-flippd-bugs-nRawD` | Old Flippd eBay API work |
| `claude/gifted-clarke-uPkI6` | Already merged (#32) |
| `claude/new-session-YbaGj` | Already merged |
| `claude/new-session-YbaGj-security-fix` | Already merged |
| `claude/new-session-xpGlD` | Empty |
| `claude/remote-session-setup-MRbJ8` | Old Flippd UI work |
| `claude/update-css-tokens-Fm9lv` | Old Flippd CSS |
| `claude/vibrant-thompson-kGeJA` | Empty |
| `cloudflare/workers-autoconfig` | Cloudflare Worker for old Flippd proxy |
| `railway/fix-deploy-3056c1` | Empty |
| `v0/scanforprofit-56a77671` | v0 scaffold, superseded |
| `vercel/install-vercel-speed-insights-qjw27a` | Auto-created by Vercel, stale |

`pr/phase-4-build` is behind main (main has Steps 4–6 that phase-4 doesn't). The PR should be **closed without merging** — main is already ahead.

### Bugs confirmed (must fix before launch)

**🔴 BUG 1 — JWT_SECRET is a fallback `dev-secret-replace-in-production` string**
- `supabase/functions/claude-proxy/index.ts:993` — falls back to `'dev-secret-replace-in-production'` if `JWT_SECRET` env var is not set
- Mobile uses Supabase Auth JWTs; the `JWT_SECRET` env var must be set to the **Supabase JWT Secret** (Supabase dashboard → Project Settings → API → JWT Secret)
- If not set, the proxy verifies tokens against the wrong secret and all API calls fail in production
- Fix: `supabase secrets set JWT_SECRET="<paste from Supabase dashboard>" --project-ref dqgfpchkheznvanfgsmx`

**🔴 BUG 2 — DB column `min_roi` vs code `target_roi` — breaks ROI calculation for real users**
- Migration `20260529010000_initial_schema.sql:77` creates column `min_roi` in `settings` table
- `claude-proxy/index.ts` reads `s.target_roi` everywhere (lines 47, 123, 190, 839)
- `DEFAULT_SETTINGS` has `target_roi: 200` so new users (no settings row yet) work fine
- Users who exist in the `settings` table get `target_roi = undefined` → HOT/FLIP/PASS decisions break silently
- Fix: add migration to rename column: `ALTER TABLE public.settings RENAME COLUMN min_roi TO target_roi;`

**🟠 BUG 3 — `handleBuyItem` has no tier gate**
- `inventory_create` (line 326) correctly checks `ITEM_LIMITS` before inserting
- `buy_item` handler (line 269) inserts directly with no limit check
- Scout users can bypass the 10-item inventory cap by using Scout tab → "Buy It" instead of Inventory tab → "Add Item"
- Fix: add the same tier gate from `handleInventoryCreate` to `handleBuyItem` (pass `tier` parameter)

**🟡 BUG 4 — `.env.example` is stale Flippd-era content**
- Still references `PROXY_URL`, `GA4_MEASUREMENT_ID`, `MAILCHIMP_*` — none used in this repo
- Missing: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`
- Fix: rewrite `.env.example` to match actual monorepo vars

**🟡 BUG 5 — PostHog key placeholder on live landing page**
- `apps/web/public/index.html` still has `__POSTHOG_KEY__` literal string
- Per HANDOFF note from 2026-06-01 session: user must replace manually
- Analytics are silently not firing on scanforprofit.com

### What's confirmed working on main

- All 6 Phase 4 steps complete (auth → scout → inventory → listing → trends → stats)
- Stripe checkout Edge Function deployed
- P&L math in `packages/shared/src/utils/calcPnl.ts`
- Schema migrations applied to production project `dqgfpchkheznvanfgsmx`
- Landing page live at scanforprofit.com with waitlist capture
- Edge Functions deployed (claude-proxy v6, stripe-webhook, stripe-checkout, auth)

### Bugs fixed this session (all resolved as of 2026-06-02)

| Bug | Fix applied |
|---|---|
| JWT_SECRET fallback to dev string | Set in Supabase Dashboard → Project Settings → Functions → Secrets |
| `min_roi` vs `target_roi` column mismatch | Migration `004_rename_min_roi_to_target_roi` applied to production |
| `handleBuyItem` missing tier gate | Fixed in claude-proxy, redeployed (v6) |
| `.env.example` stale Flippd vars | Rewritten to match actual monorepo vars |
| PostHog key placeholder | Was already a real key — no action needed |

### What's NOT done (pre-launch remaining)

1. **Run `git push origin main`** (blocked by auto-mode classifier — run manually)
2. **Run `eas build --platform ios --profile production`** in a terminal where Node.js is available
3. **Run `eas submit --platform ios --latest`** after build finishes
4. Add internal testers in App Store Connect → TestFlight
5. Set remaining Supabase secrets if not already set: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
6. Register Stripe webhook endpoint in Stripe Dashboard
7. **Phase 5 — Web App Build** (next development phase)

---

## Project Location

`C:\Users\bbake\OneDrive\Desktop\scanforprofit`

## Repo

github.com/bbaker71313/scanforprofit

---

## Phase 4 Status (mobile app build) — last updated 2026-06-02

| Step | Feature | Status | Commit |
|---|---|---|---|
| Step 1 | Auth flow (register, login, verify OTP) | DONE | `5ca1e51` |
| Step 2 | Scout tab (camera, AI scan, FLIP/PASS/HOT, Buy modal) | DONE | `a34dece` |
| Step 2.5 | Protected route guard (auth gate in root layout) | DONE | `a6360d2` |
| Step 3 | Inventory tab (CRUD, photos, status lifecycle, tier gate) | DONE | `2f69ee8` |
| Step 4 | Listing tab (AI generator, CSV export, trending keywords) | DONE | `3b589b5` |
| Step 5 | Trends tab (Growth Agent, hunt list, business score) | DONE | `27e1912` |
| Step 6 | Stats tab (P&L dashboard, expenses, Stripe paywall) | DONE | `846c65a` |
| Step 7 | Settings screen | DONE | `6b5be8a` |
| Step 8 | EAS build + TestFlight | DONE (config) — **run build manually** | `05f8a2f` |

### Current next task
**Phase 5 — Web App Build**
- Rebuild landing page from static HTML → React components
- Create pricing page, product pages, docs
- Set up PostHog + Google Analytics on web
- Deploy to Vercel (remove `ignoreCommand` from `apps/web/vercel.json`)

### Key standing decisions (apply every session)
- All inventory/listing DB ops route through `claude-proxy` Edge Function (service role bypasses `app.user_id` RLS)
- Auth is Supabase Auth JWT — proxy bridges UUID to custom `users` integer ID by email lookup (lazy creates user row)
- NativeWind only — no StyleSheet.create() anywhere
- ebayFee always from `settings` table — never hardcoded
- AI prompts always verbatim from FEATURE_TRIAGE.md — do not rewrite
- Model: `claude-sonnet-4-6` — do not change

### Supabase project
- Project ID: `dqgfpchkheznvanfgsmx`
- URL: `https://dqgfpchkheznvanfgsmx.supabase.co`
- Edge Function `claude-proxy`: deployed, version 6 (+ stats_summary, expenses_list, expenses_add handlers)
- Edge Function `stripe-checkout`: deployed (new in Step 6)
- Storage bucket `item-photos`: created, public, 5MB limit

### tsc status
`npx tsc --noEmit` — 0 errors as of last session

---

## Session: 2026-06-02 — Items 6–8: Form → n8n, Dead Links, Schema Markup

### What changed this session

- **`apps/web/components/landing/EmailCapture.tsx`** — rewired form from `/api/waitlist` to `NEXT_PUBLIC_N8N_EARLY_ACCESS_WEBHOOK_URL`; added `source: 'landing-page-hero'`; updated success copy ("You're in — check your inbox for next steps.") and error copy (includes contact email); clears input on success
- **`apps/web/app/page.tsx`** — removed `/privacy` and `/terms` dead `<a>` links (now plain `<span>`); injected two `<script type="application/ld+json">` blocks (SoftwareApplication + FAQPage schemas) via `dangerouslySetInnerHTML`
- **`apps/web/lib/schema.ts`** — created: exports `softwareAppSchema` and `faqSchema` as const objects (kept out of page.tsx to stay under 500-line limit)
- **`.env.example`** — added `NEXT_PUBLIC_N8N_EARLY_ACCESS_WEBHOOK_URL=` placeholder

### Decisions made this session (do not reverse)

- Env var is `NEXT_PUBLIC_N8N_EARLY_ACCESS_WEBHOOK_URL` (NOT `NEXT_PUBLIC_N8N_WEBHOOK_URL`) — separate from the Stripe subscription webhook
- n8n workflow `iB0bhOJ2Y2gREciM` (`sfp-new-user-welcome`) is for Stripe events only — do NOT point early access form at it
- Actual early access webhook URL must be set in Vercel env vars before going live
- `dangerouslySetInnerHTML` used only for JSON-LD schema — no other usage

### Commits this session

_(no commit yet — run `git add -A && git commit -m "feat: wire form to n8n, fix dead links, add schema markup"` then push)_

### tsc result

`npx tsc --noEmit` — **0 errors**

### Next task

**Items 4–5** — Remove fake metrics (`2,847 scans`, `156% avg ROI`) and replace fabricated testimonials in `SocialProofSection.tsx` with honest placeholder copy.

---

## Session: 2026-06-02 — Web SEO + Form Backend + Schema Markup

### What changed this session

- **`apps/web/public/robots.txt`** — created: allows all crawlers, references sitemap
- **`apps/web/app/sitemap.ts`** — created: Next.js App Router sitemap generator, homepage URL only
- **`apps/web/app/layout.tsx`** — added `metadataBase: new URL('https://www.scanforprofit.com')`
- **`apps/web/lib/schema.ts`** — created: `softwareAppSchema` (SoftwareApplication) + `faqSchema` (FAQPage) JSON-LD objects
- **`apps/web/app/page.tsx`** — added two `<script type="application/ld+json">` blocks using schema imports
- **`apps/web/components/landing/EmailCapture.tsx`** — fixed env var name: `NEXT_PUBLIC_N8N_WEBHOOK_URL` → `NEXT_PUBLIC_N8N_EARLY_ACCESS_WEBHOOK_URL`
- **`.env.example`** — added `NEXT_PUBLIC_N8N_EARLY_ACCESS_WEBHOOK_URL=` placeholder
- **`supabase/migrations/003_add_waitlist_source.sql`** — added `source text` column to `waitlist` table (also applied live)
- **n8n workflow `SFP — Early Access Capture` (ID: `mYoprIglOdv2b7nb`)** — created and active: Webhook POST → Supabase native node (inserts email+source, ignores duplicates) → HTTP Request to Resend (welcome email). Uses `Supabase account` credential for DB insert.

### Decisions made this session (do not reverse)

- Early access form uses `NEXT_PUBLIC_N8N_EARLY_ACCESS_WEBHOOK_URL` (not the old `NEXT_PUBLIC_N8N_WEBHOOK_URL`)
- n8n Supabase insert uses the native Supabase node (not HTTP Request) — avoids `$env` access restriction on n8n Cloud
- Duplicate emails silently ignored via `resolution=ignore-duplicates`
- `source` field distinguishes hero vs footer submissions
- Webhook URL must be set in Vercel env vars (`NEXT_PUBLIC_N8N_EARLY_ACCESS_WEBHOOK_URL=https://scanforprofit.app.n8n.cloud/webhook/sfp-early-access-capture`)

### Commits this session

| Hash | Message |
|---|---|
| `314e861` | chore: add robots.txt and sitemap, fix indexation blockers |
| `4f15348` | feat: wire early access form, fix dead links, add schema markup |

### tsc result

`npx tsc --noEmit` — **0 errors**

### Next task

**Items 4–5** — Remove fake metrics (`2,847 scans`, `156% avg ROI`) and replace fabricated testimonials (`@flippin_marcus`, `@thatvintageguy`, `@thriftqueenATL`) in `apps/web/app/page.tsx` components with honest placeholder copy.

---

## Session: 2026-06-02 — Rebuild HANDOFF.md (corrupted file recovery)

### What changed this session

- **`docs/HANDOFF.md`** — file was corrupted (1.9MB of interleaved repeated content). Rebuilt from clean git history (base: `b48010d`) plus sessions from `89c6970` (Step 5) and `846c65a` (Step 6). File is now ~12KB and readable.

### Commits this session

_(docs-only fix, no code changed)_

---

## Session: 2026-06-01 — Phase 4 Step 6: Stats Tab + P&L + Stripe Paywall

### What changed this session

- **`apps/mobile/app/(tabs)/stats.tsx`** — full replacement (333 lines): period selector (7d/30d/90d/YTD/ALL), P&L summary cards (revenue, COGS, net profit, ROI, sold count, avg sell price), expenses list (FlatList), add-expense modal, Stripe upgrade paywall for Hustle+ features. Scout tier sees summary only; Hustle+ sees full expense tracking.
- **`apps/mobile/components/ui/PaywallModal.tsx`** — new: reusable paywall modal with tier comparison and Stripe checkout link.
- **`apps/mobile/components/ui/index.ts`** — added `PaywallModal` export.
- **`apps/mobile/lib/stats.ts`** — new: `fetchStatsSummary(period)`, `fetchExpenses()`, `addExpense(data)`. All routed through claude-proxy.
- **`packages/shared/src/types/index.ts`** — added `PnlSummary`, `PnlExpense`, `ExpensePeriod`.
- **`packages/shared/src/utils/calcPnl.ts`** — new: `calcPnlSummary(items, expenses, period)` pure function. Single source of truth for P&L math.
- **`packages/shared/src/index.ts`** — export `calcPnl` utils.
- **`supabase/functions/claude-proxy/index.ts`** — added `stats_summary`, `expenses_list`, `expenses_add` (Scout blocked from expenses). Deployed as version 6.
- **`supabase/functions/stripe-checkout/index.ts`** — new Edge Function: creates Stripe checkout session for Hustle/Stack/Empire plans. Returns `url` for `Linking.openURL`.

### Decisions made this session (do not reverse)

- P&L math lives in `packages/shared/src/utils/calcPnl.ts` — not in the proxy or UI
- Scout tier: P&L summary visible; expense tracking gated (PaywallModal shown on add attempt)
- Stripe checkout opens in system browser via `Linking.openURL` — no in-app WebView
- `stripe-checkout` function uses STRIPE_SECRET_KEY from Supabase secrets (already set)
- Expense categories: Supplies, Shipping, Mileage, Storage, Fees, Other

### Commits this session

| Hash | Message |
|---|---|
| `846c65a` | feat: Phase 4 Step 6 -- Stats tab, P&L calculator, Stripe paywall |

### tsc result

`npx tsc --noEmit` — **0 errors**

### Next task

**Phase 4 Step 7** — Settings screen

---

## Session: 2026-06-01 — Vercel Builds Paused

### What changed this session

- **`apps/web/vercel.json`** — created with `{"ignoreCommand":"exit 1"}`. Tells Vercel to skip all builds until Phase 5 web scaffold is ready. Re-enable in Phase 5 by deleting this file or changing `ignoreCommand`.

### Commits this session

| Hash | Message |
|---|---|
| `8202588` | chore: disable Vercel builds until Phase 5 web scaffold |

---

## Session: 2026-05-31 (7) — Phase 4 Step 5: Trends Tab

### What changed this session

- **`apps/mobile/app/(tabs)/trends.tsx`** — full replacement: 5-state machine (loading/empty/generating/ready/error). Empty state at <5 items. Ready state: 7 sections — Business Score card, top categories (Scout gated), stale actions (Scout gated), hunt list (visible to Scout), market trends (Scout gated), advisor message (Scout gated), footer with refresh button.
- **`apps/mobile/lib/growth.ts`** — new: `fetchGrowthReport(forceRefresh?)` wraps `growth_report` proxy call.
- **`packages/shared/src/types/index.ts`** — added `GrowthReport`: `business_score`, `score_label`, `score_color`, `score_summary`, `top_categories[]`, `stale_actions[]`, `hunt_list[]`, `market_trends[]`, `advisor_message`, `generatedAt`, `item_count`.
- **`supabase/functions/claude-proxy/index.ts`** — added `growth_report` handler: checks `growth_cache.cache_data.growth_report` freshness (<24hrs); calls verbatim F-27 prompt; upserts to growth_cache. Static fallback on AI failure. Deployed as version 5.

### Decisions made this session (do not reverse)

- Growth report stored at `growth_cache.cache_data.growth_report` sub-key (same pattern as `trending_keywords` — no schema change needed)
- Empty state at <5 total inventory items, checked before cache lookup
- Scout tier: business score + hunt_list visible; all other sections gated with upgrade prompt
- AI failure returns static fallback — never surfaces as an error to the user
- `forceRefresh=true` bypasses cache; if result is still cached, shows toast instead of re-calling AI

### Commits this session

| Hash | Message |
|---|---|
| `27e1912` | feat: trends tab — growth agent, weekly brief, 24h cache |

### tsc result

`npx tsc --noEmit` — **0 errors**

---

## Session: 2026-05-31 (6) — Phase 4 Step 4: Listing Tab

### What changed this session

- **`apps/mobile/app/(tabs)/listing.tsx`** — full replacement: 3-screen flow (picker → generating → draft). Picker shows Unlisted + Listed only (not Sold). Draft screen: editable title (80-char counter + hard cap), description/condition/price, keyword chips, trending chips, "COPY TO CLIPBOARD" per field, "EXPORT TO EBAY CSV" (Scout = upgrade alert, Hustle+ = share sheet), "MARK AS LISTED" button.
- **`apps/mobile/lib/listing.ts`** — new: `generateListing`, `fetchKeywords`, `markAsListed`, `exportCsv`. CSV: eBay standard columns + `Version=0.0.2` header. File via `expo-file-system` v56 `new File(Paths.cache, name)` + `expo-sharing`.
- **`packages/shared/src/types/index.ts`** — added `ListingDraft`, `TrendingKeyword`, `TrendingKeywordsResult`.
- **`supabase/functions/claude-proxy/index.ts`** — added `listing_generate` (verbatim F-29 prompt, title ≤80 enforced) and `keywords_get` (growth_cache check <24hrs → AI with `web_search_20250305` tool → static fallback). Deployed as version 4.

### Decisions made this session (do not reverse)

- AI prompt verbatim from FEATURE_TRIAGE F-29 — not rewritten
- Trending keywords stored in `growth_cache.cache_data.trending_keywords` sub-key
- expo-file-system v56 new API: `new File(Paths.cache, name)` — NOT `writeAsStringAsync`
- CSV export blocked for Scout tier; Hustle+ gets native share sheet
- Listing does NOT auto-mark as Listed

### Commits this session

| Hash | Message |
|---|---|
| `3b589b5` | feat: listing tab — AI generator, CSV export, trending keywords |

---

## Session: 2026-06-01 (2) — PR + gh CLI Setup

### What changed this session

- **`gh` CLI** — installed via `winget install --id GitHub.cli`
- **PR #20** — https://github.com/bbaker71313/scanforprofit/pull/20 documenting Phase 4 work
- **PAT rotated** — token used was revoked immediately after use

---

## Session: 2026-05-31 (5) — Phase 4 Step 3: Inventory Tab

### What changed this session

- **`apps/mobile/app/(tabs)/inventory.tsx`** — full replacement: FlatList + search + status filter pills (ALL/UNLISTED/LISTED/SOLD), FAB (ADD ITEM), Add/Edit BottomSheet with live profit preview, detail Modal, delete confirm, sold-price modal, category/condition picker modals. Tier gate checked before opening Add sheet.
- **`apps/mobile/lib/inventory.ts`** — new: `fetchInventory`, `createItem`, `updateItem`, `deleteItem`, `changeStatus`. All routed through claude-proxy.
- **`apps/mobile/lib/storage.ts`** — new: `pickAndCompressPhoto` (JPEG 80%), `uploadItemPhoto` (Supabase Storage `item-photos/{userId}/{itemId}/{filename}`).
- **`packages/shared/src/utils/createInventoryItem.ts`** — new: `buildInventoryPayload`, `skuPrefix`.
- **`packages/shared/src/constants/categories.ts`** — added `CATEGORY_SKU_PREFIX` map (21 eBay categories → 4-char code).
- **`supabase/functions/claude-proxy/index.ts`** — added `inventory_list`, `inventory_create` (tier gate + SKU), `inventory_update`, `inventory_delete`, `inventory_status`. Deployed as version 3.
- **Supabase Storage** — `item-photos` bucket created (public, 5MB limit, JPEG/PNG/WebP).

### Decisions made this session (do not reverse)

- All inventory DB ops go through claude-proxy (service role bypasses `app.user_id` RLS)
- Photos uploaded directly via Supabase Auth session (Storage has its own auth)
- SKU generation is server-side — proxy generates, shared util returns prefix only
- Detail view is a full-screen Modal within inventory.tsx (no new route created)

### Commits this session

| Hash | Message |
|---|---|
| `2f69ee8` | feat: inventory tab — CRUD, photo picker, item card, proxy reads |

---

## Session: 2026-06-01 — Landing Page Fixes

### What changed this session

- **`apps/web/public/index.html`** — converted both `<form>` tags to `<div>`, added PostHog snippet, hidden `#social-proof` section.

### Commits this session

| Hash | Message |
|---|---|
| `a39980d` | fix: landing page — remove form tags, PostHog analytics, hide placeholder social proof |

---

## Session: 2026-05-31 (4) — Landing Page + Waitlist

### What changed this session

- **`apps/web/public/index.html`** — static landing page (1438 lines, self-contained)
- **`apps/web/next.config.js`** — `beforeFiles` rewrite `/ → /index.html`
- **`apps/web/app/api/waitlist/route.ts`** — POST endpoint, inserts to `waitlist` table via service role

### Commits this session

| Hash | Message |
|---|---|
| `68682c5` | feat: serve static landing page at scanforprofit.com root |
| `aed53d5` | feat: wire email capture to Supabase waitlist table |

---

## Session: 2026-05-31 (3) — Phase 4 Step 2.5: Protected Route Guard

### What changed this session

- **`apps/mobile/app/_layout.tsx`** — auth gate: `getSession()` on mount, `onAuthStateChange`, `#1c1712` loading screen, `<Redirect>` to login/scout.

### Commits this session

| Hash | Message |
|---|---|
| `a6360d2` | feat: protected route guard — auth gate in root layout |

---

## Session: 2026-05-31 (2) — Phase 4 Step 2: Scout Tab

### What changed this session

- **`apps/mobile/lib/camera.ts`** — `takePicture(ref)` utility
- **`apps/mobile/app/(tabs)/scout.tsx`** — full implementation: full-screen CameraView, SINGLE ITEM / SHELF SCAN toggle, capture, Analyzing overlay, ScanResult, ShelfItemRow, Buy modal
- **`supabase/functions/claude-proxy/index.ts`** — major rewrite: `getOrCreateUser()`, `handleSingleScan()`, `handleShelfScan()`, `handleBuyItem()`. Deployed as version 2.

### Decisions made this session (do not reverse)

- Proxy bridges Supabase Auth UUID → custom users integer ID by email lookup (lazy create)
- register.tsx does NOT insert into users table
- Estimated thrift cost = `avgSoldPrice * 0.10` — user overrides in Buy modal
- AI prompts verbatim from FEATURE_TRIAGE.md P-03 and P-04

### Commits this session

| Hash | Message |
|---|---|
| `a34dece` | feat: scout tab — camera, AI scan, FLIP/PASS/HOT result |

---

## Session: 2026-05-31 — Phase 4 Step 1: Auth Flow

### What changed this session

- **`apps/mobile/app/(auth)/register.tsx`**, **`login.tsx`**, **`verify.tsx`** — full implementations
- **`apps/mobile/lib/auth.ts`** — added `verifyOtp` + `OtpCredentials` type

### Decisions made this session (do not reverse)

- Verify screen receives `email` as route param — no global state
- OTP type is `'email'` — email verification, not SMS
- NativeWind only, no `<form>` tags

### Commits this session

| Hash | Message |
|---|---|
| `5ca1e51` | feat: auth flow — register, login, verify screens |

---

## Session: 2026-05-29 — Deploy Edge Functions + Base Schema

### Function URLs (LIVE)

| Function | URL |
|---|---|
| `auth` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/auth` |
| `claude-proxy` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/claude-proxy` |
| `stripe-webhook` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/stripe-webhook` |
| `stripe-checkout` | `https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/stripe-checkout` |

Anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ2ZwY2hraGV6bnZhbmZnc214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjE5MjQsImV4cCI6MjA5MzEzNzkyNH0.mAViqTT9u5_iXikax9ZOr9b2i9UzecrGiY9kLI-Egdo`

---

## Session: 2026-05-27 — Initial Setup

| Hash | Message |
|---|---|
| `c6d2000` | chore: initial commit |

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

- **Project ID: `dqgfpchkheznvanfgsmx`** (ScanForProfit, ACTIVE_HEALTHY)
- **Project URL:** `https://dqgfpchkheznvanfgsmx.supabase.co`
- **Anon key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ2ZwY2hraGV6bnZhbmZnc214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjE5MjQsImV4cCI6MjA5MzEzNzkyNH0.mAViqTT9u5_iXikax9ZOr9b2i9UzecrGiY9kLI-Egdo`
- Auth: Supabase Auth JWT (email/password + OTP verification)

## Stripe (livemode)

| Plan | Product ID | Monthly Price ID | Annual Price ID |
|---|---|---|---|
| SFP Hustle | `prod_UaFBtgUANzpzCh` | `price_1Tb4hLId3kJSEdqMH7SYN3a8` ($19/mo) | `price_1Tb4hOId3kJSEdqMiMUrnFm2` ($180/yr) |
| SFP Stack | `prod_UaFBJA9wZ0he0J` | `price_1Tb4hRId3kJSEdqMq9XwGKbZ` ($49/mo) | `price_1Tb4hTId3kJSEdqMB21L5giT` ($480/yr) |
| SFP Empire | `prod_UaFB8CpVCfDjWp` | `price_1Tb4hWId3kJSEdqMFrtyqDkK` ($199/mo) | _(none)_ |
