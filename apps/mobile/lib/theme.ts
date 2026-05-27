// Design tokens — 8dp spacing rhythm, semantic color system
// ui-ux-pro-max: semantic tokens, never raw hex in components

export const colors = {
  // Brand
  primary: "#3b82f6",       // blue-500
  primaryDark: "#1d4ed8",   // blue-700

  // Semantic surface
  background: "#f8fafc",    // slate-50 (light)
  backgroundDark: "#0f172a", // slate-900 (dark)
  surface: "#ffffff",
  surfaceDark: "#1e293b",   // slate-800
  border: "#e2e8f0",        // slate-200
  borderDark: "#334155",    // slate-700

  // Semantic text
  textPrimary: "#0f172a",   // slate-900
  textSecondary: "#64748b", // slate-500
  textInverse: "#f8fafc",

  // Semantic states
  success: "#22c55e",       // green-500 — profit/gains
  successBg: "#f0fdf4",
  danger: "#ef4444",        // red-500 — loss/expense
  dangerBg: "#fef2f2",
  warning: "#f59e0b",       // amber-500
  warningBg: "#fffbeb",
  info: "#3b82f6",

  // Tab nav
  tabActive: "#3b82f6",
  tabInactive: "#94a3b8",   // slate-400
} as const;

// 8dp spacing rhythm (ui-ux-pro-max §5)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
} as const;

// Touch target minimum 44pt (ui-ux-pro-max §2)
export const touchTarget = {
  min: 44,
} as const;

export const typography = {
  // Font scale: 12 14 16 18 24 32
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 24,
  "2xl": 32,

  // Weight
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,

  // Line height (1.5–1.75 for body, ui-ux-pro-max §6)
  bodyLineHeight: 1.5,
  headingLineHeight: 1.25,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

export const shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;
