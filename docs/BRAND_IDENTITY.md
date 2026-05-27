# ScanForProfit — Brand Identity
> All tokens formatted for direct use in `theme.ts`. Step 2 only.

---

## 1. LOGO CONCEPT

### The Mark: "Scan Bracket"

Two L-shaped corner brackets (scan viewfinder / price-tag reticle) frame three
ascending bar-chart columns. The brackets read as "targeting" while the rising bars
read as "profit." At 32 × 32 px the bars are the dominant element; at 200 px the
brackets read as a precision instrument surrounding a data signal.

**Rules:**
- Two colors only: `#8B6A3E` (brackets) + `#00bb66` (bars)
- Flat fill only — no gradients, no drop shadows
- Minimum clear-space: 4 px on all sides at any render size
- On dark backgrounds, swap bracket stroke to `#c9a468` (lighter gold)

### SVG Mark (32 × 32 viewBox — scales to any size)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <!-- Top-left scan bracket -->
  <path
    d="M3 13 V3 H13"
    stroke="#8B6A3E"
    stroke-width="2.5"
    stroke-linecap="square"
    stroke-linejoin="miter"
  />
  <!-- Bottom-right scan bracket -->
  <path
    d="M19 29 H29 V19"
    stroke="#8B6A3E"
    stroke-width="2.5"
    stroke-linecap="square"
    stroke-linejoin="miter"
  />
  <!-- Rising profit bars -->
  <rect x="6"  y="21" width="4" height="6"  fill="#00bb66"/>
  <rect x="12" y="16" width="4" height="11" fill="#00bb66"/>
  <rect x="18" y="11" width="4" height="16" fill="#00bb66"/>
</svg>
```

### Wordmark (200 px header)

Mark at 40 × 40 px followed by `SCANFORPROFIT` in **Syne 700**, all-caps,
letter-spacing `0.12em`, color `#1c1712`. Render the word in two weights:
`SCAN` in 700, `FORPROFIT` in 400 — same size, same tracking, creates a
subtle reading rhythm.

---

## 2. COLOR PALETTE

### Backgrounds

| Token                  | Hex       | Name            | Notes                                  |
|------------------------|-----------|-----------------|----------------------------------------|
| `color.bg.base`        | `#f2ece0` | Warm Parchment  | App base background (existing)        |
| `color.bg.surface`     | `#f8f5ee` | Off-White       | Card and list-item backgrounds        |
| `color.bg.elevated`    | `#ffffff` | Pure White      | Modals, bottom sheets, overlays       |
| `color.bg.inverse`     | `#1c1712` | Deep Espresso   | Dark mode base, badge backs on light  |
| `color.bg.dark.surface`| `#242016` | Warm Charcoal   | Dark mode card background             |

### Brand Colors

| Token                    | Hex       | Name           | WCAG on bg.base | WCAG on bg.inverse |
|--------------------------|-----------|----------------|-----------------|--------------------|
| `color.brand.green`      | `#00bb66` | Profit Green   | 2.1:1 (display only) | 6.7:1 ✓ AA  |
| `color.brand.green.text` | `#00663a` | Deep Profit    | 5.3:1 ✓ AA      | —                  |
| `color.brand.gold`       | `#8B6A3E` | Scout Gold     | 3.8:1 (large text AA) | —            |
| `color.brand.gold.light` | `#c9a468` | Aged Bronze    | — (display only) | 4.7:1 ✓ AA  |

> **Rule:** `brand.green` is a display/icon color. Use `brand.green.text` whenever
> profit values appear as inline text at body size or smaller.

### Semantic Colors

| Token                      | Hex       | Name           | Use                                    | WCAG on bg.base |
|----------------------------|-----------|----------------|----------------------------------------|-----------------|
| `color.semantic.profit`    | `#00bb66` | Profit Green   | Large badges, icon fills               | Display only    |
| `color.semantic.profit.text` | `#00663a` | Deep Profit  | Profit amounts in body text            | 5.3:1 ✓ AA      |
| `color.semantic.loss`      | `#dd0000` | Signal Red     | Large badges, icon fills (existing)    | 4.3:1 (large AA)|
| `color.semantic.loss.text` | `#b80000` | Deep Red       | Loss amounts in body text              | 5.7:1 ✓ AA      |
| `color.semantic.warning`   | `#e6850a` | Amber          | Warning badges on dark bg              | Display only    |
| `color.semantic.warning.text` | `#945200` | Deep Amber  | Warning text on light bg               | 4.7:1 ✓ AA      |
| `color.semantic.neutral`   | `#5c5248` | Warm Stone     | Pass decisions, inactive states        | 5.7:1 ✓ AA      |

### Text Colors

| Token                  | Hex       | WCAG on bg.base | Use                            |
|------------------------|-----------|-----------------|--------------------------------|
| `color.text.primary`   | `#1c1712` | 13.9:1 ✓ AAA    | Body copy, headings            |
| `color.text.secondary` | `#5c5248` | 5.7:1 ✓ AA      | Supporting text, subtitles     |
| `color.text.muted`     | `#6a5f54` | 4.6:1 ✓ AA      | Timestamps, metadata           |
| `color.text.inverse`   | `#f2ece0` | 13.9:1 ✓ AAA    | Text on `bg.inverse`           |
| `color.text.link`      | `#00663a` | 5.3:1 ✓ AA      | Tappable links on light bg     |

### WCAG Summary

| Pairing                                 | Ratio  | Level   |
|-----------------------------------------|--------|---------|
| text.primary on bg.base                 | 13.9:1 | AAA ✓   |
| text.secondary on bg.base               | 5.7:1  | AA ✓    |
| text.muted on bg.base                   | 4.6:1  | AA ✓    |
| brand.green.text on bg.base             | 5.3:1  | AA ✓    |
| semantic.loss.text on bg.base           | 5.7:1  | AA ✓    |
| semantic.warning.text on bg.base        | 4.7:1  | AA ✓    |
| text.inverse on bg.inverse              | 13.9:1 | AAA ✓   |
| brand.green (display) on bg.inverse     | 6.7:1  | AA ✓    |
| brand.gold.light on bg.inverse          | 4.7:1  | AA ✓    |

> **Do not use** `brand.green (#00bb66)`, `brand.gold (#8B6A3E)`,
> `semantic.loss (#dd0000)`, or `semantic.warning (#e6850a)` as small body text
> on light backgrounds — use the `.text` variants instead.

---

## 3. TYPOGRAPHY SCALE

**Fonts:**
- **Syne** — headers, display numbers, decision labels (Google Fonts)
- **IBM Plex Mono** — all data: prices, SKUs, percentages, timestamps (Google Fonts / IBM CDN)

| Token              | Font         | Size | Weight | Line-height | Use                                 |
|--------------------|--------------|------|--------|-------------|-------------------------------------|
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
|----------------|------------|-------|----------------------------------------------|
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

> **Rationale:** Stroke icons read clearly against the warm beige background
> and scale down to 16px without filling in. Fill icons create visual competition
> with the bar-chart logo mark.

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
