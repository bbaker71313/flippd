/**
 * ScanForProfit — Design Token File
 * Single source of truth for mobile (React Native / NativeWind) and web (Next.js / Tailwind).
 * All values sourced from docs/BRAND_IDENTITY.md.
 *
 * Assumptions documented inline where BRAND_IDENTITY.md was silent:
 *   - border / borderStrong: derived warm grays (#ddd6c8 / #b8b0a4), not in brand doc
 *   - scanFlip/scanPass/scanHot: mapped from ScanDecision + semantic palette
 *   - RADIUS: anchored to card-radius=8px from brand doc, scale derived
 *   - SHADOWS: not in brand doc; warm #1c1712 shadow from palette
 *   - lineHeight: converted from multipliers to px (React Native requires px)
 *   - ICONS size keys remapped: sm=16, md=20, lg=24, xl=32 (brand doc: xs/sm/md/lg)
 */

// ─────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────

export const COLORS = {
  // Backgrounds — from §2 Backgrounds
  background:   '#f2ece0', // color.bg.base       — Warm Parchment
  surface:      '#f8f5ee', // color.bg.surface     — Off-White
  elevated:     '#ffffff', // color.bg.elevated    — Pure White
  inverse:      '#1c1712', // color.bg.inverse     — Deep Espresso

  // Brand — from §2 Brand Colors
  brand:        '#00bb66', // color.brand.green    — Profit Green (display/icon only)
  brandDim:     '#00663a', // color.brand.green.text — Deep Profit (AA text on light)
  accent:       '#8B6A3E', // color.brand.gold     — Scout Gold
  accentDim:    '#c9a468', // color.brand.gold.light — Aged Bronze (on dark bg)

  // Semantic — from §2 Semantic Colors
  profit:       '#00bb66', // color.semantic.profit      — display/badges
  profitText:   '#00663a', // color.semantic.profit.text — body text (AA)
  loss:         '#dd0000', // color.semantic.loss        — display/badges
  lossText:     '#b80000', // color.semantic.loss.text   — body text (AA)
  warning:      '#e6850a', // color.semantic.warning     — display/dark-bg
  warningText:  '#945200', // color.semantic.warning.text — body text (AA)
  neutral:      '#5c5248', // color.semantic.neutral     — Pass states, inactive

  // Text — from §2 Text Colors
  textPrimary:   '#1c1712', // color.text.primary   — 13.9:1 AAA
  textSecondary: '#5c5248', // color.text.secondary — 5.7:1 AA
  textMuted:     '#6a5f54', // color.text.muted     — 4.6:1 AA
  textInverse:   '#f2ece0', // color.text.inverse   — on bg.inverse

  // Borders — derived from warm palette (not in BRAND_IDENTITY.md, see file header)
  border:       '#ddd6c8', // subtle warm divider
  borderStrong: '#b8b0a4', // visible warm divider

  // Scan decision card colors — mapped from ScanDecision + semantic palette
  scanFlip:  '#00bb66', // BUY  → profit green
  scanHot:   '#e6850a', // HOT  → warning amber
  scanPass:  '#5c5248', // PASS → neutral warm stone
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
// Not in BRAND_IDENTITY.md. Derived with warm #1c1712 shadow (palette: bg.inverse)
// Each entry supports both iOS (shadow*) and Android (elevation)

export const SHADOWS = {
  sm: {
    shadowColor:   '#1c1712',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius:  2,
    elevation:     2,
  },
  md: {
    shadowColor:   '#1c1712',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  4,
    elevation:     4,
  },
  lg: {
    shadowColor:   '#1c1712',
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
