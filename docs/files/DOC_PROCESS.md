# ScanForProfit — Doc Process

Defines how documentation stays in sync with the live product. Companion to `docs/DOC_HIERARCHY.md`.

---

## Definition of Done — Feature PR

Before merging any PR that changes user-visible behavior:

- [ ] **CURRENT_STATE.md** — update the feature's row (✅ / 🟡 / ⬜) if status changed
- [ ] **FEATURE_TRIAGE.md** — update the feature's status column in the triage table
- [ ] **HANDOFF.md** — add one line under the current session: what shipped and the commit hash
- [ ] **Stale-term grep** — run the grep below over files touched by the PR; fix any hits before merging

```bash
# Run from repo root — checks docs + HTML for known stale terms
grep -r --include="*.md" --include="*.html" -l \
  "FLIP\|Flippd\|early access code\|localStorage.*primary\|Replit\|magic link\|LIST or PASS" \
  docs/ apps/web/public/
```

No hits required to merge. Any hit in a file you touched = fix it in the same PR.

---

## Monthly Doc Hygiene (~30 min)

Run at the start of the first session each month (or before any public launch activity).

### 1. Stale-keyword grep

```bash
grep -r --include="*.md" --include="*.html" \
  "FLIP\|Flippd\|early access code\|magic link\|Replit\|LIST or PASS\|47 seconds\|156%\|500 early access" \
  docs/ apps/web/public/ README.md CLAUDE.md
```

Fix every hit or document why it's intentional (e.g., customer vernacular in product-marketing-context.md).

### 2. README link check

Every file linked from `README.md` must exist. Run:

```bash
# Extract markdown links from README and check each path
grep -oP '\[.*?\]\(\K[^)]+' README.md | grep -v "^http" | while read f; do
  [ -f "$f" ] || echo "BROKEN: $f"
done
```

Expected: no output (all links resolve). Fix broken links by creating the file or removing the link.

### 3. Sync launch checklist

Open `docs/files/LAUNCH_CHECKLIST.md`. For each item, verify against `CURRENT_STATE.md`:
- Mark ✅ if the feature is confirmed live
- Update 🟡 items with current blocker
- Remove items that no longer apply

### 4. Update CURRENT_STATE.md date

Change the `Last updated` date at the top and add a changelog row.

---

## Optional: CI link check

Add `.github/workflows/doc-check.yml` to fail PRs that introduce broken doc links:

```yaml
name: Doc link check
on: [pull_request]
jobs:
  check-links:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check README links resolve
        run: |
          broken=0
          while IFS= read -r link; do
            [[ "$link" == http* ]] && continue
            [ -f "$link" ] || { echo "BROKEN: $link"; broken=1; }
          done < <(grep -oP '\[.*?\]\(\K[^)#]+' README.md | grep -v '^http')
          exit $broken
```

Status: **not yet added** — create this file when CI is set up for doc quality.

---

## File ownership

| Doc | Who updates it | When |
|-----|---------------|------|
| `CURRENT_STATE.md` | Any contributor | Every feature ship or status change |
| `FEATURE_TRIAGE.md` | Any contributor | When a feature ships or is deferred |
| `HANDOFF.md` | Claude Code (agents) | Every session |
| `DECISIONS.md` | Human approval required | When a decision is locked |
| `DOC_AUDIT.md` | Monthly hygiene pass | When new debt is found or fixed |
| `CLAUDE.md` | Human approval required | Stack/workflow changes only |
