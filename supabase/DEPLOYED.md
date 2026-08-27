# Deployed Edge Function Manifest

Auto-updated by `scripts/deploy-edge-functions.sh` after every successful deploy.
Do not hand-edit routine entries — this is a log, not configuration. To check what's
actually live right now, use `mcp__Supabase__list_edge_functions` (or the Supabase
dashboard) directly; this file records what was last *deployed through a recorded
mechanism*, which may lag a manual/ad-hoc deploy done another way.

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
