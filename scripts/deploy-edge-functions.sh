#!/usr/bin/env bash
# Deterministic deploy for repo-managed Supabase Edge Functions.
#
# Root cause this fixes (P0 incident, 2026-08-27): repo `main` advanced many
# versions past what was actually live — claude-proxy alone was 8+ versions
# stale, still running the pre-Chapter-02 fabricated-cost/getDecision() path.
# No CI/CD step deploys supabase/functions/ (web.yml only typechecks
# apps/web + packages/shared), so every prior deploy was ad hoc, and
# `mcp__Supabase__list_edge_functions` showed the live functions' bundled
# entrypoint_paths rooted at three DIFFERENT depths (source/<fn>/index.ts,
# source/functions/<fn>/index.ts, source/supabase/functions/<fn>/index.ts)
# depending on which past tool/session/cwd produced the deploy. This script
# always runs from the repo root with a fixed set of function names, so the
# upload root is the same every time it's used.
#
# Usage:
#   ./scripts/deploy-edge-functions.sh                  # deploy all repo-managed functions
#   ./scripts/deploy-edge-functions.sh claude-proxy auth # deploy only the named ones
#
# Requires: Supabase CLI (`npm install -g supabase` or see
# https://supabase.com/docs/guides/cli), and either `supabase login` done
# once, or SUPABASE_ACCESS_TOKEN set in the environment.
#
# Does NOT touch: ebay-marketplace-insights-diagnostic, ebay-diag (diagnostic
# functions, not part of the normal repo-managed app tree — see CLAUDE.md
# Anti-Drift Contract rule 11 / the P0 remediation task's "never delete
# diagnostic functions" rule; this script simply never lists them).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_REF="dqgfpchkheznvanfgsmx"
MANIFEST="$REPO_ROOT/supabase/DEPLOYED.md"

# Repo-managed application functions only — keep in sync with
# supabase/config.toml's [functions.*] sections and CLAUDE.md's
# "Supabase Edge Functions" table.
ALL_FUNCTIONS=(auth claude-proxy stripe-checkout stripe-webhook ebay-oauth cron export-reminder)

cd "$REPO_ROOT"

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: Supabase CLI not found. Install it first: https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

if [ "$#" -gt 0 ]; then
  TARGETS=("$@")
else
  TARGETS=("${ALL_FUNCTIONS[@]}")
fi

GIT_SHA="$(git rev-parse HEAD)"
GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
DEPLOY_TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

echo "Deploying from repo root: $REPO_ROOT"
echo "Git SHA: $GIT_SHA ($GIT_BRANCH)"
echo "Project ref: $PROJECT_REF"
echo "Targets: ${TARGETS[*]}"
echo

DEPLOYED_LINES=()

for fn in "${TARGETS[@]}"; do
  valid=false
  for known in "${ALL_FUNCTIONS[@]}"; do
    if [ "$fn" = "$known" ]; then valid=true; fi
  done
  if [ "$valid" = false ]; then
    echo "ERROR: '$fn' is not a repo-managed function (see ALL_FUNCTIONS in this script). Refusing to deploy it." >&2
    exit 1
  fi

  echo "── Deploying $fn ──────────────────────────────────────────────"
  # Always invoked from REPO_ROOT so the upload root is fixed regardless of
  # the caller's cwd — this is the specific bug this script exists to close.
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
  echo "$fn deployed."
  DEPLOYED_LINES+=("| $fn | $GIT_SHA | $DEPLOY_TS |")
  echo
done

# Record what was deployed so "which commit is this function running" has a
# repeatable answer without needing live Supabase access — append-only log,
# newest entries last within each run.
{
  if [ ! -f "$MANIFEST" ]; then
    echo "# Deployed Edge Function Manifest"
    echo
    echo "Auto-updated by \`scripts/deploy-edge-functions.sh\` after every successful deploy."
    echo "Do not hand-edit — this is a log, not configuration. To check what's actually live"
    echo "right now, use \`mcp__Supabase__list_edge_functions\` or the Supabase dashboard;"
    echo "this file records what THIS SCRIPT last deployed, which may lag a manual/ad-hoc"
    echo "deploy done another way."
    echo
    echo "| Function | Deployed Git SHA | Deployed At (UTC) |"
    echo "|---|---|---|"
  fi
  printf '%s\n' "${DEPLOYED_LINES[@]}"
} >> "$MANIFEST"

echo "Manifest updated: $MANIFEST"
echo "Done."
