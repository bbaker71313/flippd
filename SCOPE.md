# \[APP\] Flippd v5.24 Scope

**Chat type:** \[APP\] — Flippd\_v5.html only. **Status of v5.23:** Shipped \= v5.22 baseline \+ STATS→DASH rename only. **Required reading:** KARPATHY\_GUIDELINES.md (project root) before any code.

---

## Why this scope is structured this way

The previous chat batched 25+ changes and tested only JS function existence, not page rendering. A Python regex script removed dashboard cards but left orphaned div content, breaking the entire layout. The user caught it only when they saw the broken UI on device.

The four Karpathy principles below are now mandatory for every change in this chat:

1. **Think Before Coding** — State assumptions, surface tradeoffs, ask if unclear  
2. **Simplicity First** — Minimum code, no speculative features  
3. **Surgical Changes** — Touch only what's required, no drive-by edits  
4. **Goal-Driven Execution** — Strong verifiable success criteria, loop until met

---

## Workflow rules (NON-NEGOTIABLE)

1. **One feature at a time.** Apply → screenshot → verify → next.  
2. **Render verification after every change.** Playwright at 400×800 viewport, view the screenshot, compare to baseline.  
3. **State plan before coding:**  
     
   Q\#\#: \[one-line description of change\]  
     
   Verification: \[what makes this 'done'\]  
     
4. **No card removals or structural HTML edits this chat.** Save for v5.25.  
5. **No bulk Python edits.** Only `str_replace` with full exact HTML blocks.  
6. **Div balance check** before AND after any structural change.  
7. **Each commit needs visual proof** (paired before/after screenshot).

---

## In Scope for v5.24

### Tier 1 — Lowest risk, do first

**Q13 — Expense form fixes**

- Description field used as title (currently shows "undefined")  
- Remove "Packaging Supplies" from category dropdown  
- *Plan:* find expense form HTML, change category dropdown, find expense save handler, use description field  
- *Verification:* open expense form, save test entry "Office supplies", verify "Office supplies" shows in list (not "undefined")

**Q10 — Growth text contrast**

- Lighten "Your business advisory says" text  
- Darken "Business score" card text  
- *Plan:* CSS-only changes to .advisory-text and .business-score classes  
- *Verification:* screenshot Growth tab before \+ after, both texts readable

### Tier 2 — Medium risk

**Q26 — P\&L Report tab toggle**

- Monthly/Quarterly/Yearly toggle on Report sub-tab (default Monthly)  
- *Plan:* add three button toggle group, modify date range filter  
- *Verification:* switch each toggle, totals change correctly

**Q14 — P\&L Transaction CSV import**

- "Import eBay Fees" button on P\&L Report tab  
- Parses Transaction Report CSV (Final Value Fee, Insertion Fee, Shipping Label, etc.)  
- Adds total as "eBay Expenses" line  
- Does NOT import revenue  
- *Plan:* add button → file picker → CSV parser → expense list mutation  
- *Verification:* import sample CSV, verify expense line appears with correct sum, verify revenue unchanged

### Tier 3 — Higher risk, last

**Q11 — Sales manual sold adder**

- Category dropdown → Item dropdown (status \!= Sold) → sale price \+ date modal  
- *Plan:* new button on Sales view, dropdown chain, reuse existing sold-flow modal  
- *Verification:* walk full flow with test item, item moves to Sold, sale appears in records

**Q15 — Growth card expanded view**

- Click dashboard card → full view with 4 sections \+ back button  
- *Plan:* new view function, 4 sections in order (Score, Needs Attention, Hunt List, Top 3 categories)  
- *Verification:* open view, all 4 sections render, back returns to dashboard

**Q17 — Dashboard advisory section**

- Bottom of dashboard home  
- *Plan:* reuse "Your Business Advisory Says" block from Growth tab  
- *Verification:* dashboard scrolls, advisory at bottom, updates when Growth scan runs

---

## Out of Scope for v5.24

| Item | Where it goes |
| :---- | :---- |
| Q16 Photos/Settings card removal | v5.25 (alone, with extra care) |
| Q19 eBay OAuth fix | \[BACKEND\] chat |
| Q9 Photo background removal refinement | v5.25 |
| Q1-Q8 Inventory redesign | v5.25 or v5.26 |
| Q12 P\&L sub-tab restructure | v5.25 |
| Marketing copy | \[MARKETING\] chat |
| Pricing decisions | \[STRATEGY\] chat |

---

## Starting state

curl \-sL "https://raw.githubusercontent.com/bbaker71313/flippd/main/index.html" \-o /home/claude/Flippd\_v5\_24.html

Currently deployed v5.23 \= v5.22 \+ DASH rename.

---

## Definition of done for v5.24

- [ ] All Tier 1 items shipped \+ paired screenshots  
- [ ] At least one Tier 2 item shipped \+ screenshots  
- [ ] No layout regressions vs v5.23 (verified by viewing each tab at 400px)  
- [ ] JS syntax passes Node validation  
- [ ] CHANGELOG.md updated  
- [ ] User has tested at least one feature on their device before next chat

If Tier 3 doesn't fit in this chat, defer cleanly to v5.25. Don't rush.  
