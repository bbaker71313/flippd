# Flippd — Feature Request Template

<!--
HOW TO USE THIS FILE:
1. Copy this file and rename it to describe your feature (e.g., INITIAL_listing_generator.md)
2. Fill in each section below
3. Give it to Claude with: "Build this feature for Flippd using INITIAL_your_feature.md"

The more detail you provide, the better the output.
Delete these instructions before sharing with Claude.
-->

## FEATURE:
<!--
Be specific. Bad: "Add listing generator." 
Good: "Add an AI listing generator inside the INVENTORY tab that takes the item's existing
photos and details and writes a ready-to-post eBay title, description, and condition note.
Output should be copyable text, not auto-posted."
-->

[Describe the feature here]

---

## WHAT TAB DOES THIS LIVE IN?
<!--
Pick one of the 5 existing tabs, or explain why it needs to be elsewhere.
Adding a 6th tab requires explicit justification.
-->

- [ ] SCOUT (sourcing, scanning)
- [ ] INVENTORY (items, tracking)
- [ ] PHOTOS (photo enhancement)
- [ ] TRENDS (market data, hunt list)
- [ ] STATS (P&L, dashboard)
- [ ] New tab — justification: [explain]

---

## CURRENT STATE:
<!--
What exists today that this feature builds on?
Reference specific functions, UI elements, or localStorage keys from Flippd_v4.html.
-->

- Existing foundation: `Flippd_v4.html`
- Related existing code: [list any functions or sections]
- Current limitation being solved: [what problem does this fix for the reseller]

---

## USER STORY:
<!--
Write this from the reseller's perspective.
"When I'm standing in the thrift store..." or "When I get home and want to list..."
-->

As a reseller, I want to [do X] so that [I can achieve Y without doing Z manually].

---

## RESELLER LANGUAGE:
<!--
How should this feature talk to the user?
Check product-marketing-context.md for approved words/phrases.
-->

- Button label: [e.g., "Generate Listing" or "Write My Listing"]
- Empty state message: [what shows when there's no data yet]
- Success message: [what the toast says when it works]

---

## DATA:
<!--
What data does this feature read or write?
Use exact localStorage key names from CLAUDE.md.
-->

Reads from:
- `flippd_items_v1` — [which fields]
- [other keys if needed]

Writes to:
- [key] — [what it stores]

New fields added to item object (if any):
- `fieldName` (type): description

---

## SUCCESS CRITERIA:
<!--
How do we know this feature is done and working?
Be specific and testable.
-->

- [ ] [Specific behavior that must work]
- [ ] Empty state handled (no data, first use)
- [ ] Error state handled (API failure, bad input)
- [ ] Works on mobile (375px screen)
- [ ] Uses reseller language throughout (no technical jargon)
- [ ] Passes Node.js syntax check
- [ ] Passes Playwright smoke test

---

## PLATFORMS:
<!--
Which selling platforms does this touch?
-->

- [ ] eBay (primary)
- [ ] Poshmark (future)
- [ ] Mercari (future)
- [ ] Facebook Marketplace (future)
- [ ] All / platform-agnostic

---

## OTHER NOTES:
<!--
Anything Claude commonly gets wrong, edge cases, or constraints.
-->

- Fee math must always use `S.ebayFee` — never hardcode
- All API calls must use `getApiUrl()` and `getApiHeaders()`
- Font names in JS innerHTML strings must be quoted: `'IBM Plex Mono'`
- No em dashes in JS string literals — use `\u2014` or reword
