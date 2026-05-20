# Paste this at the top of your new [APP] chat

---

I'm continuing Flippd app development from a previous chat that had a serious failure. Read these files from the project before doing anything:

1. **KARPATHY_GUIDELINES.md** (NEW — read FIRST, behavioral rules)
2. CLAUDE.md (project rules)
3. DECISIONS.md (past decisions)
4. ROADMAP.md (priority order)
5. SCOPE_v524_CONTINUATION.md (this chat's scope)

**Current state:** Flippd_v5_23.html is deployed = v5.22 baseline + STATS→DASH rename only. The previous chat batched 25+ changes and one of them (Photos/Settings dashboard card removal) corrupted div structure and broke the entire layout. The user only caught it when they opened the file on their phone.

---

## Four Karpathy Principles (apply to EVERY change this chat)

**1. Think Before Coding** — State assumptions explicitly. If multiple interpretations exist, present them. Don't pick silently. Push back if a simpler approach exists.

**2. Simplicity First** — Minimum code that solves the problem. No abstractions for single-use code. No "flexibility" that wasn't requested. If 200 lines could be 50, rewrite it.

**3. Surgical Changes** — Touch only what you must. Every changed line must trace directly to the user's request. Don't "improve" adjacent code, don't refactor what isn't broken.

**4. Goal-Driven Execution** — Strong success criteria. Not "function exists" — "page renders correctly at 400px viewport with all tabs visible and no JS errors."

---

## Workflow rules for this chat (NON-NEGOTIABLE)

1. **One change at a time.** Never batch.
2. **Verify rendering before next change.** Playwright screenshot at 400×800 viewport after every code edit. View the screenshot. If layout differs from baseline, revert immediately.
3. **State the plan before coding.** For every Q-task:
   - Restate what you're changing in one sentence
   - State the verification check
   - THEN make the change
4. **No bulk Python edits.** Only `str_replace` matching full exact HTML blocks.
5. **Div balance check before AND after any structural change.**
6. **No dashboard card removals this chat.** Period.

---

## Pull the current working version first

```bash
curl -sL "https://raw.githubusercontent.com/bbaker71313/flippd/main/index.html" -o /home/claude/Flippd_v5_24.html
```

---

## Implementation order (smallest → largest)

For each item, follow this loop:
```
State plan → State verification → Make change → Screenshot → Verify → Commit OR revert
```

1. **Q13** (5 min) — expense field uses description as title, remove "Packaging Supplies" category
2. **Q10** (5 min) — text contrast on Growth advisory + score (CSS only)
3. **Q26** (10 min) — P&L Report: Monthly/Quarterly/Yearly toggle (default Monthly)
4. **Q14** (15 min) — P&L import for eBay Transaction CSV → eBay Expenses line
5. **Q11** (20 min) — Sales manual sold adder (Category → Item dropdowns)
6. **Q15** (20 min) — Growth card expanded view (4 sections, back button)
7. **Q17** (10 min) — Dashboard advisory section at bottom

**Stop after EACH item.** Show me the screenshot. Ask if I want you to proceed.

---

## Out of scope this chat

- Q16 dashboard card removals → v5.25 (alone, with extra care)
- Q19 eBay OAuth → [BACKEND] chat
- Any photo enhancement → v5.25
- Marketing copy → [MARKETING] chat
- Pricing decisions → [STRATEGY] chat

---

## Deliverables

- `/mnt/user-data/outputs/Flippd_v5_24.html`
- Updated CHANGELOG.md entry
- Playwright test file verifying layout at 400px
- One screenshot per implemented feature

**Start with Q13.** State your plan, state verification, then act.
