// Single source of truth for tier limits (§4.3 — fixes the split-brain where
// auth/me reported hustle scans=unlimited/items=500 while claude-proxy enforced
// 250/250). Values match CLAUDE.md tier table. `null` = unlimited.
//
//   Tier    Scans/mo   Items
//   trial   unlimited  unlimited (7-day)
//   scout   25         10
//   hustle  250        250
//   stack   unlimited  unlimited
//   empire  unlimited  unlimited (10 seats)

export const SCAN_LIMITS: Record<string, number | null> = {
  trial: null, scout: 25, hustle: 250, stack: null, empire: null,
};

export const ITEM_LIMITS: Record<string, number | null> = {
  trial: null, scout: 10, hustle: 250, stack: null, empire: null,
};
