# ScanForProfit — Brand Identity
> All tokens formatted for direct use in `theme.ts`. Step 2 only.
> Canonical brand register: **dark "Industrial Terminal"** — matches the live
> web app (`apps/web/public/app.html`, `index.html`). The previous light
> "Warm Parchment" palette is retired; do not reintroduce it.

---

## 1. LOGO CONCEPT

### The Mark: "Scan Bracket"

Two L-shaped corner brackets (scan viewfinder / price-tag reticle) frame three
ascending bar-chart columns. The brackets read as "targeting" while the rising bars
read as "profit." At 32 × 32 px the bars are the dominant element; at 200 px the
brackets read as a precision instrument surrounding a data signal.

**Rules:**
- Two colors only: `#d4a843` (brackets) + `#00e676` (bars)
- Flat fill only — no gradients, no drop shadows
- Minimum clear-space: 4 px on all sides at any render size
- On light backgrounds (rare — print, favicon on white), swap bracket stroke to `#8a6c28` (darker gold, better contrast on white)

### SVG Mark (32 × 32 viewBox — scales to any size)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <!-- Top-left scan bracket -->
  <path
    d="M3 13 V3 H13"
    stroke="#d4a843"
    stroke-width="2.5"
    stroke-linecap="square"
    stroke-linejoin="miter"
  />
  <!-- Bottom-right scan bracket -->
  <path
    d="M19 29 H29 V19"
    stroke="#d4a843"
    stroke-width="2.5"
    stroke-linecap="square"
    stroke-linejoin="miter"
  />
  <!-- Rising profit bars -->
  <rect x="6"  y="21" width="4" height="6"  fill="#00e676"/>
  <rect x="12" y="16" width="4" height="11" fill="#00e676"/>
  <rect x="18" y="11" width="4" height="16" fill="#00e676"/>
</svg>
```

### Wordmark (200 px header)

Mark at 40 × 40 px followed by `SCANFORPROFIT` in **Syne 700**, all-caps,
letter-spacing `0.12em`, color `#f0ead8` (light text on dark bg). Render the word in two weights:
`SCAN` in 700, `FORPROFIT` in 400 — same size, same tracking, creates a
subtle reading rhythm. On rare light backgrounds, use `#8a6c28` (accent-dim) instead of `#f0ead8`.

---

## 2. COLOR PALETTE — "Industrial Terminal"

### Backgrounds

| Token                  | Hex       | Name            | Notes                                  |
|------------------------|-----------|-----------------|-----------------------------------------|
| `color.bg.base`        | `#0a0a0a` | Near Black      | App base background                    |
| `color.bg.surface`     | `#161616` | Charcoal        | Card and list-item backgrounds         |
| `color.bg.elevated`    | `#1c1c1c` | Raised Charcoal | Modals, bottom sheets, hover states    |
| `color.bg.inverse`     | `#000000` | Pure Black      | Nav/tab bar, backdrop overlays, splash |

### Brand Colors

| Token                    | Hex       | Name        | WCAG on bg.base | WCAG on bg.surface |
|--------------------------|-----------|-------------|-----------------|--------------------|
| `color.brand.green`      | `#00e676` | Signal Green| 11.9:1 ✓ AAA    | 10.8:1 ✓ AAA       |
| `color.brand.gold`       | `#d4a843` | Money Gold  | 8.9:1 ✓ AAA     | 8.1:1 ✓ AAA        |
| `color.brand.gold.dim`   | `#8a6c28` | Deep Gold   | 4.0:1 (large text only) | 3.6:1 (large text only) |

> **Rule:** On this dark-first palette, `brand.green` and `brand.gold` have AAA
> contrast directly on both `bg.base` and `bg.surface` — no separate "deep" text
> variant is needed (unlike the old light-mode palette). Reserve `gold.dim` for
> secondary/label-weight text where less emphasis is wanted.

### Semantic Colors

| Token                      | Hex       | Name        | Use                                    | WCAG on bg.base |
|----------------------------|-----------|-------------|------------------------------------------|-----------------|
| `color.semantic.profit`    | `#00e676` | Signal Green| Profit badges, BUY decision, icon fills  | 11.9:1 ✓ AAA    |
| `color.semantic.loss`      | `#ff3333` | Alert Red   | Loss badges, delete actions, icon fills  | 5.4:1 ✓ AA      |
| `color.semantic.warning`   | `#f5a623` | Amber       | HOT decision, warning badges             | 9.8:1 ✓ AAA     |
| `color.semantic.neutral`   | `#8a8070` | Muted Stone | PASS decision, inactive states           | 5.1:1 ✓ AA      |

### Text Colors

| Token                  | Hex       | WCAG on bg.base | Use                            |
|------------------------|-----------|-----------------|----------------------------------|
| `color.text.primary`   | `#f0ead8` | 16.5:1 ✓ AAA    | Body copy, headings            |
| `color.text.secondary` | `#c8bfb0` | 10.9:1 ✓ AAA    | Supporting text, subtitles     |
| `color.text.muted`     | `#8a8070` | 5.1:1 ✓ AA      | Timestamps, metadata           |
| `color.text.inverse`   | `#f0ead8` | n/a (on bg.inverse `#000000`, 18.0:1 ✓ AAA) | Text on pure-black surfaces (nav, tab bar, backdrops) |
| `color.text.link`      | `#d4a843` | 8.9:1 ✓ AAA     | Tappable links                 |

### Borders

| Token                  | Hex       | Name          | Use                       |
|------------------------|-----------|---------------|---------------------------|
| `color.border`         | `#383838` | Border        | Subtle dividers, card edges |
| `color.border.bright`  | `#4a4a4a` | Border Bright | Visible dividers, input outlines |

### Scan Decision Colors

| Decision | Token                  | Hex       |
|----------|------------------------|-----------|
| BUY      | `color.semantic.profit`  | `#00e676` |
| HOT      | `color.semantic.warning` | `#f5a623` |
| PASS     | `color.semantic.neutral` | `#8a8070` |

### WCAG Summary

| Pairing                                 | Ratio  | Level   |
|-----------------------------------------|--------|---------|
| text.primary on bg.base                 | 16.5:1 | AAA ✓   |
| text.secondary on bg.base               | 10.9:1 | AAA ✓   |
| text.muted on bg.base                   | 5.1:1  | AA ✓    |
| text.inverse on bg.inverse              | 18.0:1 | AAA ✓   |
| brand.green on bg.base                  | 11.9:1 | AAA ✓   |
| brand.gold on bg.base                   | 8.9:1  | AAA ✓   |
| semantic.loss (red) on bg.base          | 5.4:1  | AA ✓    |
| semantic.warning (amber) on bg.base     | 9.8:1  | AAA ✓   |
| semantic.neutral (muted) on bg.base     | 5.1:1  | AA ✓    |

> **Do not use** `brand.gold.dim (#8a6c28)` as small body text — large text /
> labels only (3.6–4.0:1). All other brand/semantic colors above are safe as
> body text directly on `bg.base` or `bg.surface`.

---

## 3. TYPOGRAPHY SCALE

**Fonts:**
- **Syne** — headers, display numbers, decision labels (Google Fonts)
- **IBM Plex Mono** — all data: prices, SKUs, percentages, timestamps (Google Fonts / IBM CDN)

| Token              | Font         | Size | Weight | Line-height | Use                                 |
|--------------------|--------------|------|--------|-------------|---------------------------------------|
| `type.display`     | Syne         | 48px | 800    | 1.0         | Hero profit/loss amount on scan card|
| `type.h1`          | Syne         | 32px | 700    | 1.1         | Screen titles                       |
| `type.h2`          | Syne         | 24px | 700    | 1.2         | Section headers, card group titles  |
| `type.h3`          | Syne         | 20px | 600    | 1.3         | Card titles, list section labels    |
| `type.body`        | Syne         | 16px | 400    | 1.6         | Descriptions, notes, modal copy     |
| `type.label`       | IBM Plex Mono| 11px | 500    | 1.4         | Field labels, category tags         |
| `type.mono`        | IBM Plex Mono| 14px | 400    | 1.5         | Prices, SKUs, percentages, data     |
| `type.caption`     | IBM Plex Mono| 12px | 400    | 1.4         | Timestamps, scan dates, metadata    |

**Usage rules:**
- `type.display`: always `color.semantic.profit` (green) or `color.semantic.loss` (red) — never neutral
- `type.mono`: `color.text.primary` by default; swap to semantic color when the value is a profit/loss figure
- `type.label`: `color.text.muted` — it is furniture, not content
- Letter-spacing: `type.label` +0.06em; `type.display` −0.02em (tight for numbers); all others default

---

## 4. SPACING SCALE

**Base unit: 8px**

| Token          | Multiplier | Value | Use                                          |
|----------------|------------|-------|------------------------------------------------|
| `space.xs`     | 0.5×       | 4px   | Icon-to-label gap, tight badge padding       |
| `space.sm`     | 1×         | 8px   | Internal card padding, list-item row gap     |
| `space.md`     | 2×         | 16px  | Card padding, section content margin        |
| `space.lg`     | 3×         | 24px  | Between cards, modal body padding           |
| `space.xl`     | 4×         | 32px  | Screen horizontal margins, section gaps     |
| `space.2xl`    | 6×         | 48px  | Between major screen sections, hero spacing |

**Layout constants (derive from scale, not arbitrary):**
- Screen horizontal margin: `space.xl` (32px)
- Card border-radius: `space.sm` (8px)
- Button height: `space.2xl` (48px)
- Bottom tab bar height: 56px (`space.lg` + `space.md`)

---

## 5. ICON STYLE GUIDE

### Style

| Property         | Value                   |
|------------------|-------------------------|
| Render style     | **Stroke** (no fills)   |
| Stroke width     | **1.5px** at all sizes  |
| Stroke linecap   | `round`                 |
| Stroke linejoin  | `round`                 |
| Corner radius    | None (radius is in the stroke join, not shape) |
| Color            | Inherits `currentColor` |

> **Rationale:** Stroke icons read clearly against the near-black "industrial
> terminal" background and scale down to 16px without filling in. Fill icons
> create visual competition with the bar-chart logo mark.

### Size Tokens

| Token            | Size | Use                                   |
|------------------|------|---------------------------------------|
| `icon.xs`        | 16px | Inline with body text, badge accents  |
| `icon.sm`        | 20px | List-item leading icons, button icons |
| `icon.md`        | 24px | Tab bar icons (default)              |
| `icon.lg`        | 32px | Empty-state illustrations, feature cards|

### Recommended Library

**Lucide** (`lucide-react` + `lucide-react-native`)

- Consistent 1.5px stroke, round caps, round joins — matches this style guide exactly
- Official React Native package (`lucide-react-native`) — no wrapper needed
- 1,500+ icons, MIT license
- Do not mix with other icon libraries in the same screen

### Critical Icons (must be present at launch)

| Icon name (Lucide) | Use                              |
|--------------------|----------------------------------|
| `ScanLine`         | Scan tab, scan trigger button    |
| `TrendingUp`       | Profit signal, growth card       |
| `TrendingDown`     | Loss signal                      |
| `Package`          | Inventory tab                    |
| `Tag`              | Listing tab                      |
| `BarChart2`        | Stats tab                        |
| `Sparkles`         | AI / Claude analysis             |
| `CheckCircle2`     | BUY decision                     |
| `XCircle`          | PASS decision                    |
| `Flame`            | HOT decision                     |
| `Settings`         | Settings                         |
| `ChevronRight`     | List-item affordance             |
