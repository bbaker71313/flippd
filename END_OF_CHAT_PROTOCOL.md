# Flippd — End of Chat Protocol

30-second routine to run before closing any chat in this Project.
Keeps CHATS.md, DECISIONS.md, and CHANGELOG.md current so the next chat picks up clean.

---

## The 4-step checkout

Run these in order. Skip steps that don't apply.

### 1. Update CHATS.md (always)
Open CHATS.md and update this chat's entry:
- **Current focus:** what you were just working on (one line)
- **Status:** Active / Paused / Completed
- **Last touched:** today's date

If the chat is done, move it to the "Paused / Completed" section.

### 2. Log decisions in DECISIONS.md (if any settled)
Did this chat settle anything that future chats need to know? Examples:
- Picked a pricing tier structure
- Decided not to build a feature
- Locked in a tech approach
- Chose voice/copy direction

If yes, add an entry to DECISIONS.md in the matching section (Product / Technical / Business). Format:

```
### [Decision title]
**Decision:** [what was decided]
**Why:** [the reasoning]
**Do not revisit unless:** [what would change this]
```

### 3. Log shipped changes in CHANGELOG.md (if code/copy shipped)
Did you ship a new version of Flippd_v5.html, Flippd_Landing.html, or any other file? Add to CHANGELOG.md under the matching version.

If no code/copy shipped, skip this.

### 4. Note follow-ups for other chats (if any spawned)
If this chat spawned work for a different area, drop a line in CHATS.md under the target chat's entry:

```
**Pending from [APP] chat (April 28):** Add max sourcing price calculator to SCOUT — see DECISIONS.md
```

That way when you next open the [APP] chat, you see the handoff immediately.

---

## When NOT to do this

- One-off questions ("what's the eBay fee for this?") — no checkout needed
- Chats that produced no decisions, no code, and no follow-ups — just close
- Chats under 5 messages — usually nothing to log

---

## Why this matters

Without this routine:
- CHATS.md goes stale → you lose track of active work
- Decisions get re-litigated → wasted time
- Cross-chat handoffs get dropped → things slip

With this routine:
- Open any chat and immediately see where you left off
- Next chat in any area picks up with full context
- Nothing falls through the cracks across 6+ active workstreams
