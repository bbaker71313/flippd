# ScanForProfit — Profit Scanner Plan Correction Prompt

## Role

Act as a senior Principal Product Engineer / Marketplace Systems Architect reviewing the current ScanForProfit Profit Scanner documentation.

This task is **documentation correction only**.

Do **not** implement scanner behavior.
Do **not** change production code.
Do **not** deploy anything.
Do **not** redesign unrelated features.

Your job is to correct the written source of truth so future implementation work does not continue from a contradictory product contract.

---

## Why this correction is required

The current Profit Scanner documentation contains a conflict between the intended product behavior and the rules currently written into the implementation plan and decision log.

The scanner's intended product behavior is:

> A user scans one item or a whole shelf, and every reasonably identifiable item returns an actionable **HOT / LIST / SKIP** result with estimated resale economics, market intelligence, Best Market / where-to-list guidance, condition-aware recommendations, and listing guidance based on the strongest evidence available.

The current documents still preserve an older rule:

> weak or missing qualifying evidence → `LIMITED EVIDENCE` / `decisionAvailable:false` / no HOT-LIST-SKIP result.

That rule is now incorrect for the current product direction and must be superseded before R2/R3 continue.

For the current phase of the product, **the scanner must not terminate an otherwise successfully identified item with "not enough evidence," "unable to find," "no verified recommendation," or any equivalent no-result market-evidence state.**

Evidence strength may affect confidence, aggressiveness, pricing range, and whether HOT is allowed, but it must not by itself remove the sourcing decision.

---

# What is wrong in the current plan

Review the current:

`docs/files/PROFIT_SCANNER_IMPLEMENTATION_PLAN_2026-08-30.md`

and correct the following conflicts.

## 1. The plan still says weak/no evidence produces no decision

The plan currently preserves language such as:

- weak/no evidence never yields a decision
- `decisionAvailable:false`
- `LIMITED EVIDENCE`
- acceptance criteria expecting some items to return LIMITED EVIDENCE
- shelf logic where weak/none evidence becomes LIMITED EVIDENCE
- evidence-class rules that can terminate decision availability

That is no longer the approved product direction.

### Correct product rule

For every **reasonably identifiable item**:

- the evidence pipeline must continue down an explicit evidence ladder;
- the scanner must still produce **HOT / LIST / SKIP**;
- weaker evidence must produce a more conservative decision and lower-confidence presentation;
- weak evidence must never be presented as strong or verified transaction evidence;
- lack of one provider, one marketplace, or one evidence class must never itself terminate the scan.

The documentation must make clear that evidence quality controls **decision confidence and authority**, not whether the user receives a sourcing decision.

---

## 2. "LIMITED EVIDENCE" is currently modeled as a terminal product outcome

The existing plan treats LIMITED EVIDENCE as a legitimate end state.

That is now incorrect.

The Profit Scanner's normal successful outcome set must be:

- `HOT`
- `LIST`
- `SKIP`

A provider outage, authentication failure, quota exhaustion, or other infrastructure failure may still be recorded internally and surfaced diagnostically, but it must not be confused with an item's economic decision.

The plan must distinguish:

### Market uncertainty

The item is identified, but evidence is weaker than ideal.

This must still resolve to HOT/LIST/SKIP using the strongest defensible evidence available.

### System failure

The system cannot execute the evidence pipeline because of an actual technical failure.

This is an operational error/retry condition, not an economic result and not "insufficient evidence."

Do not rewrite system failures into SKIP.

---

## 3. The current evidence policy is too binary

The plan currently behaves conceptually like:

`qualifying evidence -> decision`
`non-qualifying evidence -> no decision`

That needs to become an explicit **evidence ladder**.

The revised plan must describe the hierarchy of evidence sources that can support a result, while preserving provenance.

At minimum, the documentation must recognize distinct classes such as:

1. verified completed-sale / transaction evidence;
2. specialist transaction-derived price guides;
3. relevant active-market evidence;
4. cross-market evidence from another defensible marketplace;
5. other conservative, explicitly labeled market-derived fallback evidence approved by product.

The plan must **not** authorize AI to invent sold prices, market facts, fees, or profit inputs.

The important correction is that the system should move down the ladder rather than terminate simply because the strongest tier was unavailable.

---

## 4. HOT must remain harder to earn than LIST/SKIP

Do not solve the no-result problem by weakening HOT until everything becomes HOT.

The corrected plan must preserve the distinction between:

- **HOT** — highest-confidence favorable sourcing opportunity and therefore requires the strongest evidence standard;
- **LIST** — financially viable opportunity under the strongest defensible evidence currently available, including moderate/weaker evidence where appropriate;
- **SKIP** — economics do not support buying/listing, or the conservative valuation does not support a worthwhile acquisition.

The exact thresholds and evidence requirements should remain explicit and auditable.

Evidence weakness should bias toward conservative LIST/SKIP rather than fabricate confidence.

---

## 5. The acceptance criteria currently test for the wrong behavior

The current plan includes acceptance criteria that explicitly require certain items to return LIMITED EVIDENCE.

Those tests now conflict with the product objective.

Update the acceptance section so it measures:

- every reasonably identifiable corpus item produces HOT/LIST/SKIP;
- no HOT is produced without the approved strong evidence requirement;
- no result uses fabricated marketplace evidence;
- weak evidence is clearly labeled as weaker evidence;
- provider failure does not silently become an item-level SKIP;
- every shelf item that is reasonably identifiable receives its own result;
- Best Market and market comparison truthfully state what was actually evaluated;
- the GE radio regression reaches an actionable decision rather than LIMITED EVIDENCE.

A deliberately unidentifiable image should be treated separately as an **identification failure test**, not used to preserve a market-evidence "no decision" product state.

---

## 6. R1 diagnostics are still correct and must not be reverted

R1 added failure classification and auditability.

That work is still useful and must remain.

The documentation should explicitly state that:

- `PROVIDER_THROTTLED`
- `PROVIDER_QUOTA_EXHAUSTED`
- `PROVIDER_UNAVAILABLE`
- `PROVIDER_NOT_CONFIGURED`
- `MARKETPLACE_AUTH_FAILED`

remain useful internal/operational diagnostic states.

However, these states must not be mistaken for the final economic classification of an item.

Do not remove the R1 audit trail or failure diagnostics.

---

## 7. R0 findings remain valid

Do not undo or relitigate the R0 findings.

The documentation must preserve the measured facts that:

- Trawl can return usable sold data when queried appropriately;
- the long production-style query failed while a shorter GE transistor-radio query returned substantial sold evidence;
- Trawl has a measured monthly request quota that makes an uncontrolled multi-query cascade unsuitable for production;
- the shared Deno test gate was successfully unblocked.

These findings still inform R2 and the broader provider-budget design.

---

## 8. The multi-provider architecture remains the intended architecture

Do not reduce the scanner back to an eBay-only or Trawl-only system.

The revised plan must preserve the cross-market architecture:

- identify item;
- route to relevant marketplaces;
- query the providers that can supply legitimate evidence;
- preserve each provider's evidence class;
- compute marketplace-specific economics;
- recommend Best Market using explicit rules;
- show meaningful alternative marketplaces;
- return HOT/LIST/SKIP for every reasonably identifiable item.

The provider layer should remain provider-generic.

R2/R3 must not be written in a way that later requires rewriting them for R5 federation.

---

# Documents that must be updated

## Required

### 1. `docs/files/PROFIT_SCANNER_IMPLEMENTATION_PLAN_2026-08-30.md`

Create the next revision of this plan.

The revision history must explicitly state that the previous revision retained an outdated terminal `LIMITED EVIDENCE` rule and that this revision corrects it.

Update every section that conflicts with the new decision contract, including:

- thesis / guiding principles;
- product decisions;
- R1 language where necessary to clarify diagnostics vs economic outcomes;
- R2/R3 decision-availability assumptions;
- shelf semantics;
- evidence-quality behavior;
- federation behavior;
- acceptance criteria;
- risk register;
- sequencing notes;
- open product decisions.

Do not rewrite unrelated parts of the plan.

### 2. `docs/files/DECISIONS.md`

Add a new explicit product decision that **supersedes** the August 29 Profit Scanner v2 rule that weak/no evidence must return `LIMITED EVIDENCE` / `decisionAvailable:false`.

The new decision must state:

- HOT/LIST/SKIP is the normal terminal decision set for every reasonably identifiable item;
- evidence quality controls confidence and the allowed decision strength rather than basic decision availability;
- weaker market evidence must use conservative economics and honest provenance;
- AI may help identify/query/reason but may not fabricate authoritative market or financial inputs;
- infrastructure/provider failures remain errors/diagnostics and must not be disguised as SKIP;
- the old rule requiring weak/no evidence to terminate without a sourcing decision is superseded.

Also note exactly which prior decision text this new entry supersedes so future sessions do not relitigate or accidentally restore it.

---

## Update if these files currently describe the old behavior

### 3. `docs/HANDOFF.md`

Update the current handoff state so the next coding session clearly knows:

- R0 findings remain valid;
- R1 remains valid;
- implementation is paused before R2 until the source-of-truth correction is merged;
- terminal LIMITED EVIDENCE is no longer the approved normal product behavior;
- the next code implementation must follow the corrected plan/decision entry.

### 4. `docs/files/CURRENT_STATE.md` or equivalent current-state document

If it states that weak/no evidence intentionally yields no HOT/LIST/SKIP result, update that wording to match the new decision.

Do not change unrelated status information.

### 5. Any Profit Scanner-specific implementation/remediation document that is still referenced as active source-of-truth

Search the repo for active references to:

- `LIMITED EVIDENCE`
- `decisionAvailable:false`
- `insufficient_market_data`
- `weak/no evidence never`
- `no recommendation`
- `no HOT/LIST/SKIP`

Do not blindly replace every historical occurrence.

Historical reviews and forensic reports should remain historically accurate.

Only update documents that are currently normative or used as active implementation instructions.

---

# Important distinction: historical documents vs active source of truth

Do **not** rewrite historical audit/review documents simply because they recorded the old behavior.

For example, a forensic review saying the scanner returned LIMITED EVIDENCE at that point in time is historical evidence and should remain intact.

The task is to correct **normative documents** that tell future engineers what the product is supposed to do.

Use the repository's document hierarchy to determine which files are normative.

---

# Do not make implementation decisions that are not required for this correction

This task is not asking you to implement the new fallback algorithm.

Do not invent detailed provider weighting, valuation formulas, confidence thresholds, or new API integrations beyond what is necessary to make the written product contract internally consistent.

Where the implementation plan needs a later engineering decision, mark it clearly as an open implementation question.

The purpose of this task is:

> Correct the source of truth so the next engineering phase is solving the right product problem.

---

# Required output

Make the documentation changes only.

Then provide a concise report containing:

1. which documents were changed;
2. which old rule was superseded;
3. which historical documents were intentionally left unchanged;
4. whether any remaining active source-of-truth document still permits terminal market-evidence "no result" behavior;
5. any unresolved contradiction that must be decided before R2.

Do not implement R2.
Do not modify production scanner code.
Do not deploy.
