# ScanForProfit app.html — Design Audit
**Date:** 2026-06-22  
**Target:** `apps/web/public/app.html` (live at scanforprofit.com/app.html)  
**Frameworks:** impeccable audit · emil-design-eng · taste-design

---

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2/4 | 9px text, divs-as-buttons lack keyboard handlers |
| 2 | Performance | 2/4 | 15+ `transition:all`, circular spinner, no lazy-load |
| 3 | Responsive | 3/4 | Breakpoints solid, minor touch-target gaps |
| 4 | Theming | 3/4 | Good token system, some hardcoded `#000`/`#fff` |
| 5 | Anti-Patterns | 2/4 | 2 absolute bans violated, neon glow on buy button |
| **Total** | | **12/20** | **Acceptable — significant work needed** |

---

## Anti-Patterns Verdict

**Does it read as AI-generated?** No — and this is the single biggest win. Terminal industrial aesthetic with gold/green/red semantic system, `[ HOT ]` bracket notation, IBM Plex Mono + Syne pairing is **intentional and distinctive**. First-order reflex check passes.

But two **absolute bans** (impeccable) are violated:

1. **Side-stripe borders** — `.card::before` (3px left gradient bar on every card) and `.item-card { border-left: 3px solid ... }`. Explicitly banned regardless of aesthetic intent. Replace with full top border or background tint.
2. **`repeating-linear-gradient` stripe background** — `body::before` scanline texture. Banned. CRT intent is valid brand — achieve it differently (SVG grain on `::before`, or CSS noise filter).
3. **Neon outer glow on buy button** — `.action-buy { box-shadow: 0 0 15px rgba(0,230,118,0.3) }`. Banned. Use directional elevation shadow instead: `0 4px 12px rgba(0,230,118,0.2)`.
4. **Uppercase tracked eyebrow on every section** — `.card-title`, `.dash-section`, `.d-label`, `.f-label` all 9–10px uppercase with wide tracking. One named eyebrow system = voice. Reflexive eyebrow on every card/section = AI grammar.
5. **Gold text-shadow glow reflex on all stat numbers** — `.stat-num`, `.kpi-val`, `.inv-stat-num`, `.pnl-sum-num` all share identical `text-shadow: 0 0 28px rgba(212,168,67,0.6)`. Brand glow on the logo is a decision. Same glow on every number class is a reflex. Keep it on 1–2 intentional instances.

---

## Detailed Findings by Severity

### P0 — Blocking (fix immediately)

**[P0] Side-stripe `card::before` left accent bar**
- Location: `app.html` line 232–237 `.card::before`
- Category: Anti-Pattern (Absolute Ban)
- Impact: Every card has a gold 3px left bar — creates visual noise, implies categorization that isn't there.
- Fix: Remove `::before`. Use `border-top: 2px solid var(--accent)` on cards that need accent identity.
- Command: `$impeccable polish`

**[P0] Side-stripe `item-card border-left`**
- Location: `app.html` line 501 `.item-card { border-left: 3px solid rgba(212,168,67,0.22) }`
- Category: Anti-Pattern (Absolute Ban)
- Impact: Same absolute ban. Hover state brightens the stripe — compounds the issue.
- Fix: Remove `border-left`. Use full `border-color: var(--accent)` on hover.
- Command: `$impeccable polish`

**[P0] `repeating-linear-gradient` scanline on `body::before`**
- Location: `app.html` line 143–156
- Category: Anti-Pattern (Absolute Ban)
- Impact: CRT scanline intent is valid brand. This implementation pattern is explicitly banned.
- Fix: Replace with SVG noise grain on the pseudo-element, or a fixed `background-image` with a tiny SVG tile. Or drop entirely — dark bg already reads terminal.
- Command: `$impeccable polish`

---

### P1 — Major (fix before release)

**[P1] `transition: all` — 15+ instances**
- Location: lines 180, 199, 271, 286, 334, 417, 474, 488, 503, 574, 598, 639, 641, 697, 740
- Category: Performance + Animation
- Impact: Animates all CSS properties including layout-triggering ones (`width`, `height`, `padding`). Drops frames on slower mobile devices. Each element needs targeted properties only.

| Before | After | Why |
|---|---|---|
| `transition:all 0.15s` on interactive elements | `transition:transform 0.15s ease-out,border-color 0.15s ease-out,color 0.15s ease-out,opacity 0.15s ease-out` | Only animate GPU-composited properties + color |
| `transition:all 0.12s` on `.btn` | `transition:transform 0.12s ease-out,filter 0.12s ease-out` | Buttons only need transform + filter feedback |

- Command: `$impeccable optimize`

**[P1] No custom easing curves — all browser defaults**
- Location: every transition throughout file
- Category: Animation (Emil)
- Impact: Default CSS easings are too weak. Emil's rule: use `cubic-bezier(0.23, 1, 0.32, 1)` for UI interactions. Current transitions feel generic.
- Fix: Add to `:root`:
  ```css
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  ```
  Replace `ease-out` with `var(--ease-out)` in all transitions.
- Command: `$impeccable animate`

**[P1] Divs-as-buttons missing keyboard activation**
- Location: lines 1151, 1829, 1833, 1881, 2701, 2703, 2705, 2717 + JS-rendered templates
- Category: Accessibility (WCAG 2.1 SC 2.1.1)
- Impact: `role="button" tabindex="0"` divs respond to click but not `Enter`/`Space`. Keyboard-only users cannot activate these controls.
- Fix: Convert to `<button>` elements (preferred). Or add `onkeydown="if(event.key==='Enter'||event.key===' ')this.click()"` to every `role=button` div.
- Command: `$impeccable harden`

**[P1] 9px/10px minimum text sizes**
- Location: `--text-2xs: 9px`, `--text-xs: 10px` — used on badges, labels, status chips
- Category: Accessibility
- Impact: 9px text is unreadable on mobile. Fails mobile usability even if technically WCAG SC 1.4.4 compliant at 200% zoom.
- Fix: `--text-2xs: 11px`, `--text-xs: 12px`. Reflow dependent components.
- Command: `$impeccable harden`

**[P1] Neon outer glow on `.action-buy` button**
- Location: line 477 `.action-buy { box-shadow: 0 0 15px rgba(0,230,118,0.3) }`
- Category: Anti-Pattern
- Impact: Centered outer glow = banned neon pattern. Reads as gaming UI, not tool UI.
- Fix: `box-shadow: 0 4px 12px rgba(0,230,118,0.2)` — directional elevation, not centered glow.
- Command: `$impeccable polish`

---

### P2 — Minor (fix in next pass)

**[P2] `prefers-reduced-motion` nuclear kill-switch**
- Location: line 1113 — `animation-duration: 0.01ms !important` applied to all elements
- Category: Accessibility / Animation
- Impact: Technically compliant but wrong. Emil's principle: "Reduced motion means fewer and gentler animations, not zero." Kills opacity fades that aid comprehension alongside motion animations that cause issues.
- Fix: Replace blanket kill with selective reduction per animation type. Preserve `opacity` and `color` transitions. Remove transform-based motion per component with individual `@media (prefers-reduced-motion: reduce)` blocks.
- Command: `$impeccable animate`

**[P2] Placeholder-only form labels (no visible labels)**
- Location: `.cost-input` (scanner cost field), inline-style inputs in scan view
- Category: Accessibility
- Impact: Label disappears when user fills the field. Screen readers have `aria-label` but sighted users lose context mid-form.
- Fix: Add visible `<label>` elements above inputs. `.f-label` class already exists and is styled — use it.
- Command: `$impeccable harden`

**[P2] Circular spinner — not skeletal**
- Location: line 358–363 `.spinner { border-radius: 50%; animation: spin }`
- Category: Performance / Taste
- Impact: Generic circular spinner. Skeletal loaders that match the result layout create stronger perceived performance — users see the shape of what's loading.
- Fix: When loading scan results, replace spinner with skeleton matching the decision-banner + data-row layout. Use shimmer animation on placeholder bars.
- Command: `$impeccable delight`

**[P2] Gold text-shadow glow reflex on 4 separate number classes**
- Location: `.stat-num`, `.kpi-val`, `.inv-stat-num`, `.pnl-sum-num` — all `text-shadow: 0 0 28px rgba(212,168,67,0.6)`
- Category: Anti-Pattern
- Impact: Brand glow on the logo is intentional. Same glow across every stat number is reflexive. The 5th instance of the same effect reads as a fill, not a choice.
- Fix: Keep glow on logo and the single most important number per view (confidence score). Remove from stat grids and KPI cards. Let size + color carry hierarchy.
- Command: `$impeccable quieter`

**[P2] `transition: all` on modal overlay**
- Location: line 768 `.modal-overlay { transition: all 0.25s }`
- Category: Performance
- Impact: Unnecessarily transitions `z-index`, display state, and other non-GPU properties.
- Fix: `transition: opacity 0.2s var(--ease-out)`.
- Command: `$impeccable optimize`

**[P2] `@keyframes fadeUp` on `results-wrap` — not interruptible**
- Location: line 781 `@keyframes fadeUp { from { opacity:0; transform:translateY(10px) } }`
- Category: Animation (Emil)
- Impact: Keyframe animations restart from zero on re-trigger. If user scans quickly, the second result animation restarts mid-play. CSS transitions retarget smoothly.
- Fix: Replace with `@starting-style`:
  ```css
  .results-wrap {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 0.25s var(--ease-out), transform 0.25s var(--ease-out);
    @starting-style { opacity: 0; transform: translateY(10px); }
  }
  ```
- Command: `$impeccable animate`

---

### P3 — Polish (nice-to-fix, no real user impact)

**[P3] `modalIn` starts from `scale(0.92)` — slightly too dramatic**
- Location: line 753 `@keyframes modalIn { from { opacity:0; transform:scale(0.92) translateY(8px) } }`
- Category: Animation (Emil)
- Impact: Emil's guidance: start from `scale(0.95)` or higher. 0.92 reads as a more aggressive pop-in, slightly jarring on mobile.
- Fix: `scale(0.97) translateY(6px)` — subtler, more natural entry.
- Command: `$impeccable animate`

**[P3] No `:active` press feedback on secondary interactive elements**
- Location: `.hdr-btn` (line 175), `.tag` (line 413), `.filter-btn` (line 483), `.back-btn` (line 368)
- Category: Animation (Emil)
- Impact: Emil: "Buttons must feel responsive to press." Primary `.btn` has correct `scale(0.97)` feedback. These secondary elements have none.
- Fix: Add to each:
  ```css
  .hdr-btn:active, .tag:active, .filter-btn:active, .back-btn:active {
    transform: scale(0.96);
  }
  ```
- Command: `$impeccable animate`

**[P3] Tab panel switches with no transition**
- Location: `.tab-panel { display:none } .tab-panel.active { display:block }` — instant swap
- Category: Animation (Emil)
- Impact: Abrupt panel switch feels low-fidelity on slower devices.
- Fix: Wrap panel content in inner div with `@starting-style` opacity fade, or use JS class toggle + `opacity: 0→1` transition on panel enter.
- Command: `$impeccable animate`

---

## Systemic Issues

1. **`transition:all` is systemic** — 15+ locations. Search-replace won't work safely. Each element needs analysis of which properties it actually transitions.
2. **Eyebrow label reflex** — uppercase tracked small-caps appear on card titles, section headers, data labels, form labels everywhere. Reduce frequency ~60%. Let size + weight carry hierarchy instead.
3. **Gold glow reflex** — 5 separate classes share identical `text-shadow: 0 0 28px rgba(212,168,67,0.6)`. Consolidate to 1–2 intentional uses.
4. **Side-stripe as card default** — both `card::before` and `item-card border-left` use it. The entire card component defaults to this banned pattern. Fix the base `.card` component, then audit every card variant.

---

## What's Working — Keep These

| Pattern | Why it works |
|---|---|
| Terminal industrial identity | Not cream SaaS, not purple AI dashboard. Gold/green/red semantic system serves a profit tool perfectly |
| `[ HOT ]` bracket notation | Memorable, distinctive, tool-native |
| IBM Plex Mono + Syne pairing | Strong contrast axis: mono vs geometric grotesque |
| CSS token system | `--space-*`, `--radius-*`, `--text-*`, `--z-*` are thorough with inline rounding guides |
| Semantic z-index scale | `--z-tabbar:199`, `--z-modal:600`, `--z-toast:9500` — no arbitrary 9999 |
| `.btn:active { transform: scale(0.97) translateY(1px) }` | Correct tactile press feedback on primary buttons |
| `prefers-reduced-motion` exists | Intent is right, implementation needs refinement |
| `@keyframes modalIn` from `scale(0.92)` | Direction is right, just needs subtler starting scale |
| `aria-label` on all form inputs | Comprehensive ARIA coverage in auth and scanner forms |
| `-webkit-tap-highlight-color: transparent` | Consistently applied, removes iOS tap flash |
| Base-8 spacing scale with rounding guide | Excellent, rarely documented this clearly inline |

---

## Recommended Actions (Priority Order)

| Priority | Command | What to fix |
|---|---|---|
| P0 | `$impeccable polish` | Remove `card::before` side-stripe + `item-card border-left`. Fix `.action-buy` neon glow. |
| P0 | `$impeccable polish` | Replace `body::before` repeating-gradient scanline with SVG noise or drop it. |
| P1 | `$impeccable optimize` | Sweep all `transition:all` → specific properties. Add `--ease-out`/`--ease-in-out` curves to `:root`. |
| P1 | `$impeccable harden` | Convert `role="button"` divs to `<button>`. Add visible form labels. Bump `--text-2xs` to 11px. |
| P1 | `$impeccable animate` | Replace `@keyframes fadeUp` with `@starting-style`. Refine `prefers-reduced-motion` to selective. |
| P2 | `$impeccable quieter` | Reduce gold text-shadow glow to 1–2 intentional uses. Reduce eyebrow label frequency. |
| P2 | `$impeccable delight` | Replace circular spinner with scan-result-shaped skeleton loader. |
| P3 | `$impeccable animate` | `:active` press feedback on secondary buttons. Tab-switch fade. Tune `modalIn` to `scale(0.97)`. |
| Final | `$impeccable polish` | Final quality pass after all fixes. |

---

## Impeccable Setup Note

No `PRODUCT.md` found at project root. Run `$impeccable init` at the start of the next design session to generate it — required for full impeccable workflow. Impeccable v3.8.0 is also available: `npx impeccable update` (applies next session).
