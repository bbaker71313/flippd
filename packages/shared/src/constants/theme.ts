/**
 * ScanForProfit — Design Token File
 * Single source of truth for mobile (React Native / NativeWind) and web (Next.js / Tailwind).
 * All values sourced from docs/BRAND_IDENTITY.md.
 *
 * Assumptions documented inline where BRAND_IDENTITY.md was silent:
 *   - border / borderStrong: from §2 Borders (#383838 / #4a4a4a)
 *   - scanFlip/scanPass/scanHot: mapped from ScanDecision + semantic palette
 *   - RADIUS: anchored to card-radius=8px from brand doc, scale derived
 *   - SHADOWS: not in brand doc; pure-black (#000000) shadow, matches bg.inverse
 *   - lineHeight: converted from multipliers to px (React Native requires px)
 *   - ICONS size keys remapped: sm=16, md=20, lg=24, xl=32 (brand doc: xs/sm/md/lg)
 */

// ─────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────

export const COLORS = {
  // Backgrounds — from §2 Backgrounds
  background:   '#0a0a0a', // color.bg.base       — Near Black
  surface:      '#161616', // color.bg.surface     — Charcoal
  elevated:     '#1c1c1c', // color.bg.elevated    — Raised Charcoal
  inverse:      '#000000', // color.bg.inverse     — Pure Black

  // Brand — from §2 Brand Colors
  brand:        '#00e676', // color.brand.green    — Signal Green
  brandDim:     '#00e676', // color.brand.green    — AAA on dark, no dim variant needed
  accent:       '#d4a843', // color.brand.gold     — Money Gold
  accentDim:    '#8a6c28', // color.brand.gold.dim — Deep Gold (large text only)

  // Semantic — from §2 Semantic Colors
  profit:       '#00e676', // color.semantic.profit      — display/badges
  profitText:   '#00e676', // color.semantic.profit      — AAA on dark, body text ok
  loss:         '#ff3333', // color.semantic.loss        — display/badges
  lossText:     '#ff3333', // color.semantic.loss        — AA on dark, body text ok
  warning:      '#f5a623', // color.semantic.warning     — display/badges
  warningText:  '#f5a623', // color.semantic.warning     — AAA on dark, body text ok
  neutral:      '#8a8070', // color.semantic.neutral     — Pass states, inactive

  // Text — from §2 Text Colors
  textPrimary:   '#f0ead8', // color.text.primary   — 16.5:1 AAA
  textSecondary: '#c8bfb0', // color.text.secondary — 10.9:1 AAA
  textMuted:     '#8a8070', // color.text.muted     — 5.1:1 AA
  textInverse:   '#f0ead8', // color.text.inverse   — on bg.inverse (#000000), 18.0:1 AAA

  // Borders — from §2 Borders
  border:       '#383838', // subtle divider
  borderStrong: '#4a4a4a', // visible divider, input outlines

  // Scan decision card colors — mapped from ScanDecision + semantic palette
  scanFlip:  '#00e676', // BUY  → profit green
  scanHot:   '#f5a623', // HOT  → warning amber
  scanPass:  '#8a8070', // PASS → neutral muted stone
} as const

// ─────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────
// lineHeight values are pixels (multiplier × fontSize, rounded)
// Source: §3 Typography Scale

export const TYPOGRAPHY = {
  display: {
    fontFamily: 'Syne',
    fontSize:   48,
    fontWeight: '800' as const,
    lineHeight: 48,  // 48 × 1.0
  },
  h1: {
    fontFamily: 'Syne',
    fontSize:   32,
    fontWeight: '700' as const,
    lineHeight: 35,  // 32 × 1.1 = 35.2 → 35
  },
  h2: {
    fontFamily: 'Syne',
    fontSize:   24,
    fontWeight: '700' as const,
    lineHeight: 29,  // 24 × 1.2 = 28.8 → 29
  },
  h3: {
    fontFamily: 'Syne',
    fontSize:   20,
    fontWeight: '600' as const,
    lineHeight: 26,  // 20 × 1.3
  },
  body: {
    fontFamily: 'Syne',
    fontSize:   16,
    fontWeight: '400' as const,
    lineHeight: 26,  // 16 × 1.6 = 25.6 → 26
  },
  label: {
    fontFamily: 'IBM Plex Mono',
    fontSize:   11,
    fontWeight: '500' as const,
    lineHeight: 15,  // 11 × 1.4 = 15.4 → 15
  },
  mono: {
    fontFamily: 'IBM Plex Mono',
    fontSize:   14,
    fontWeight: '400' as const,
    lineHeight: 21,  // 14 × 1.5
  },
  caption: {
    fontFamily: 'IBM Plex Mono',
    fontSize:   12,
    fontWeight: '400' as const,
    lineHeight: 17,  // 12 × 1.4 = 16.8 → 17
  },
} as const

// ─────────────────────────────────────────
// SPACING
// ─────────────────────────────────────────
// Base unit: 8px. Source: §4 Spacing Scale

export const SPACING = {
  xs:  4,   // 0.5 × 8
  sm:  8,   // 1 × 8
  md:  16,  // 2 × 8
  lg:  24,  // 3 × 8
  xl:  32,  // 4 × 8
  xxl: 48,  // 6 × 8  (brand doc: "space.2xl")
} as const

// ─────────────────────────────────────────
// RADIUS
// ─────────────────────────────────────────
// Anchor: card border-radius = space.sm = 8px (§4 Layout constants)
// Scale derived (not all values in BRAND_IDENTITY.md — see file header)

export const RADIUS = {
  none: 0,
  sm:   4,    // tight — badge, chip
  md:   8,    // card (= space.sm, from brand doc)
  lg:   16,   // modal, bottom sheet
  full: 9999, // pill button, avatar
} as const

// ─────────────────────────────────────────
// SHADOWS
// ─────────────────────────────────────────
// Not in BRAND_IDENTITY.md. Derived with pure-black #000000 shadow (palette: bg.inverse)
// Each entry supports both iOS (shadow*) and Android (elevation)

export const SHADOWS = {
  sm: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius:  2,
    elevation:     2,
  },
  md: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  4,
    elevation:     4,
  },
  lg: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius:  8,
    elevation:     8,
  },
} as const

// ─────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────
// Source: §5 Icon Style Guide
// Size keys remapped to sm/md/lg/xl (brand doc: xs/sm/md/lg — see file header)

export const ICONS = {
  size: {
    sm:  16,  // inline with body text, badge accents   (brand doc: icon.xs)
    md:  20,  // list-item / button icons               (brand doc: icon.sm)
    lg:  24,  // tab bar (default)                      (brand doc: icon.md)
    xl:  32,  // empty-state / feature cards            (brand doc: icon.lg)
  },
  strokeWidth: 1.5,
} as const

// ─────────────────────────────────────────
// Root theme object + type
// ─────────────────────────────────────────

export const theme = {
  colors:     COLORS,
  typography: TYPOGRAPHY,
  spacing:    SPACING,
  radius:     RADIUS,
  shadows:    SHADOWS,
  icons:      ICONS,
} as const

export type Theme = typeof theme
