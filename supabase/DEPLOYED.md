# Deployed Edge Function Manifest

Auto-updated by `scripts/deploy-edge-functions.sh` after every successful deploy.
Do not hand-edit routine entries — this is a log, not configuration. To check what's
actually live right now, use `mcp__Supabase__list_edge_functions` (or the Supabase
dashboard) directly; this file records what was last *deployed through a recorded
mechanism*, which may lag a manual/ad-hoc deploy done another way.

## Trawl sold-history provider — 2026-08-29

`claude-proxy` was deployed through the Supabase MCP from the current 21-file
repository dependency closure: **v90 → v91**, ACTIVE, with `verify_jwt:false`
unchanged. Live-bundle inspection confirmed the Trawl endpoint,
`TRAWL_API_KEY`, and the existing `SOLD_COMPS_API_KEY` configuration fallback.
An authenticated production scan remains the final end-to-end provider check.

## P0 remediation deploy — 2026-08-27

Production Supabase Edge Functions were found badly stale (see
`docs/HANDOFF.md` for the full incident writeup — `claude-proxy` alone was
running the pre-Chapter-02 fabricated-cost/`getDecision()` path, 2 versions
behind main by commit count and missing the entire verified-market-data
pipeline). This entry was written by hand (the deploy itself used the
Supabase MCP `deploy_edge_function` tool, not this script — the script did
not exist until this same remediation added it) to establish the first
recorded baseline.

| Function | Deployed Git SHA | Old Live Version | New Live Version | Deployed At (UTC) |
|---|---|---:|---:|---|
| auth | `cbddb78c564b5e6687e05c83edbf4bbe1459c4ce` | 65 | 66 | 2026-08-27 |
| claude-proxy | `cbddb78c564b5e6687e05c83edbf4bbe1459c4ce` | 83 | 85 | 2026-08-27 |
| stripe-checkout | `cbddb78c564b5e6687e05c83edbf4bbe1459c4ce` | 63 | 64 | 2026-08-27 |
| stripe-webhook | `cbddb78c564b5e6687e05c83edbf4bbe1459c4ce` | 60 | 61 | 2026-08-27 |
| ebay-oauth | `cbddb78c564b5e6687e05c83edbf4bbe1459c4ce` | 70 | 71 | 2026-08-27 |
| cron | `cbddb78c564b5e6687e05c83edbf4bbe1459c4ce` | 3 | 4 | 2026-08-27 |
| export-reminder | `cbddb78c564b5e6687e05c83edbf4bbe1459c4ce` | 30 | 31 | 2026-08-27 |

`claude-proxy` went through two deploy attempts within this same session
(v84 then v85) — v84 omitted `_shared/marketData.ts` from the bundle (harmless
at runtime, since every reference to it across the codebase is a type-only
import that TypeScript erases before the code ships; still redeployed for
source completeness). v85 is the dependency-complete, verified version.

Diagnostic functions `ebay-marketplace-insights-diagnostic` and `ebay-diag`
were intentionally left untouched — not part of the normal repo-managed
application tree, and this task did not authorize deleting or redeploying them.

## claude-proxy redeploy — 2026-08-28

`main` had advanced past the P0 remediation deploy above (PR #142, commit
`02cfb90`, "decision integrity Release A") without a corresponding Supabase
deploy — `claude-proxy` was still running v86 (the P0-remediation-only
build), missing the Release A fix (`ebayBrowse.ts` failure-vs-zero,
`decisionEngine.ts` weak-evidence-caps-HOT, `evidenceQuality`/
`compMatchPrecision` wired into the scan response). Redeployed via
`mcp__Supabase__deploy_edge_function` with the same 21-file dependency
closure pattern as the P0 entry above (hand-traced from
`claude-proxy/index.ts`'s imports — Python-verified this session, exact same
21 files as before).

| Function | Deployed Git SHA | Old Live Version | New Live Version | Deployed At (UTC) |
|---|---|---:|---:|---|
| claude-proxy | `37528eca81c9b15dd58e3ee104210ca7676390d5` | 86 | 87 | 2026-08-28T15:21:35Z |

Post-deploy verification (fetched live bundle via `mcp__Supabase__get_edge_function`):
`evidenceQuality` present (21 occurrences), `hotCappedByEvidence` present (3),
`compMatchPrecision` present (9), the fabricated-zero pattern
`matchingActiveCount: 0` absent (0 occurrences — confirms `ebayBrowse.ts`'s
failure path now returns `null`, not a fabricated zero), dead pre-Chapter-02
markers `getDecision(`/`estimatedCost = r2` both absent. `verify_jwt`
preserved as `false` (unchanged — same in-body cookie/JWT auth model).

`_shared/marketData.ts` does not appear in the bundle's returned file list —
same harmless omission documented in the P0 entry above: every reference to
it is a type-only import (`import type {...} from "./marketData.ts"`), which
the bundler erases before emitting JS. It was included in the upload; its
absence from the stored file list is not a deploy defect.

No other repo-managed functions (`auth`, `stripe-checkout`, `stripe-webhook`,
`ebay-oauth`, `cron`, `export-reminder`) were touched — `main`'s changes
since the last full-fleet deploy were scoped to `claude-proxy` and its
`_shared` dependencies only (verified via `git diff --stat` against the
prior deployed SHA for `supabase/functions/`).
