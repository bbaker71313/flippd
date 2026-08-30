# ScanForProfit — Profit Scanner Full Remediation Prompt

**Date:** 2026-08-30  
**Repository:** `bbaker71313/scanforprofit`  
**Scope:** Profit Scanner only  
**Source review:** `PROFIT_SCANNER_REVIEW_2026-08-30.md`

You are a **Principal Product Engineer + Marketplace Systems Architect** working directly in the current ScanForProfit repository.

Your task is to **fix every open finding in the 2026-08-30 Profit Scanner review**: P0-1 through P0-4, P1-5 through P1-10, and P2-11 through P2-20.

This is not another partial patch. The goal is to restore a Profit Scanner that can reliably produce a defensible **HOT / LIST / SKIP** result when sufficient real market evidence exists, while preserving the existing rule that weak/no evidence must never fabricate a decision.

---

# Hard Scope Boundary

Change **only the Profit Scanner and code directly required by the Profit Scanner**.

Do not redesign or alter:

- Inventory behavior except where a scanner response contract must remain compatible.
- Photos / photo optimization.
- Listing Generator behavior.
- Profit Compass.
- Profit Hub.
- Billing / subscriptions.
- Auth except where an existing provider-auth error must be contained inside the scanner.
- eBay listing sync / order sync.
- Mobile.
- Any historical `scanforprofit-backend` architecture.

Supabase remains the only backend.

Do not change the existing deterministic financial formulas unless this prompt explicitly says to.

---

# Protected Existing Behavior

The review verified these components as correct. Preserve them:

- `financialEngine.ts` / `calcProfit`
- `maxBuyPrice.ts` / `calcMaxBuyPrice`
- `decisionEngine.ts` v2 contract
- `marketplaceEconomics.ts` delegation to deterministic math
- user-configured eBay fee behavior
- `$0` acquisition cost => `roi: null`
- AI may identify/explain, but may not create authoritative market values
- weak/no evidence must never create HOT/LIST/SKIP, profit, ROI, or max-buy price

Current v2 decision semantics remain:

- **HOT** = profit + ROI pass + **strong** evidence
- **LIST** = profit + ROI pass + **moderate** evidence
- **SKIP** = profit or ROI fails with strong/moderate evidence
- **LIMITED EVIDENCE** = weak/none evidence; not a sourcing decision

Sell-through rate, days-to-sell, and demand remain **informational only** and must not be reintroduced into HOT/LIST/SKIP.

---

# Required Preflight

Before editing:

1. Read `CLAUDE.md` completely.
2. Read `docs/CURRENT_STATE.md`.
3. Read the newest `docs/HANDOFF.md` entries.
4. Read `docs/files/DECISIONS.md`.
5. Read `docs/DOC_HIERARCHY.md` if present.
6. Read the full `PROFIT_SCANNER_REVIEW_2026-08-30.md`.
7. Inspect current `main` for every file named in that review.
8. Confirm production/repo drift status before changing code.
9. Search the repo for every call site of touched functions.
10. Confirm which review findings are still open on current `main`.

The live repository is the source of truth. Do not blindly apply stale line numbers if code moved.

---

# Approved Product Decisions

The review identified six product decisions. They are resolved here.

## Decision A — Comp matching

Replace the current hard family-token majority requirement with a **scored comparable-match system**.

Rules:

- Exact identifier / exact model matches carry the highest weight.
- Brand agreement carries high weight.
- Conflicting brand or conflicting explicit model is a hard rejection.
- Parts-only / repair-only / box-only / manual-only / accessory-only / unrelated lots remain hard rejections unless the scanned item itself is that type.
- Condition conflict can reduce or reject a match when material, but free-form AI prose must not accidentally turn ordinary used comps into mismatches.
- Descriptive tokens such as era, color, style, `table`, `vintage`, `radio`, etc. are supporting signals, not mandatory requirements.
- Normalize punctuation/model variants so examples like `X-700` and `X700`, `1960s` and `1960's`, can match appropriately.
- Use word-aware token matching, not raw substring matching (`all` must not match `wall`).

Initial classification target:

- **Exact / strong comparable:** score >= 80
- **Usable / moderate comparable:** score 60–79
- **Reject:** score < 60

Hard-conflict rules override score.

Add regression fixtures from the GE radio evidence recorded in the review and prove genuine comps are retained while unrelated results are rejected.

## Decision B — Trawl throttling

Yes, retry a Trawl `429` that contains `Retry-After`.

Policy:

- Use the repo's shared `externalCall` reliability wrapper rather than raw `fetch`.
- Honor `Retry-After` when present.
- Maximum **2 retries** for a request.
- Maximum additional throttle wait budget per scan item: **3 seconds**.
- A 429 without `Retry-After` is treated as allowance exhaustion and is not repeatedly retried.
- Do not silently switch to another sold provider mid-scan after Trawl fails.

## Decision C — Active marketplace evidence

Active-market evidence is **supporting evidence only**. It is not required for a decision when sold evidence already qualifies.

For active evidence to count as support:

- at least 5 sampled matching listings must remain after filtering, and
- at least 60% of the sampled candidate listings must pass comparable matching, and
- asking-price evidence must pass the existing coherence guard or an equivalent tested guard.

Do not require 100% of sampled listings to match.

This restores the existing v2 moderate-evidence paths:

- 1–2 exact sold comps + sufficient active support => moderate
- 0 sold comps + strong coherent active evidence => moderate

STR / turnover / demand may be calculated only when sold + active populations are sufficiently comparable, and remain informational only.

## Decision D — Facebook/local

`facebook_local` must **not automatically win** merely because it uses 0% platform fees and no shipping.

Rules:

- It may only be routed for genuinely local-suitable/bulky categories, not because a generic word such as `table` appears inside `table radio`.
- Replace loose keyword routing with category/identity-aware rules that avoid this false route.
- Facebook/local may borrow a defensible valuation from another marketplace, but borrowed evidence must be clearly marked as borrowed.
- A borrowed-evidence local option may be shown as an alternative.
- It may become **Best Market** only when the item is genuinely local-suitable **and** local economics materially outperform the evidence-providing marketplace after shipping/packaging costs.
- Evidence strength must never be upgraded merely because the sale is local.

## Decision E — Shelf scan HOT semantics

Shelf scan remains pre-purchase and must not invent acquisition cost.

Use:

- **HOT** = strong evidence + a positive deterministic max-buy price exists that satisfies the user's profit and ROI thresholds.
- **LIST** = moderate evidence + a positive deterministic max-buy price exists that satisfies the user's thresholds.
- **SKIP** = strong/moderate evidence exists but **no positive acquisition price** can satisfy the user's thresholds.
- **LIMITED EVIDENCE** = weak/none evidence.

Do not add an arbitrary fixed-dollar HOT threshold.

## Decision F — Marketplace fee profiles

Do not allow unverified placeholder fee percentages to silently become production financial authority.

Requirements:

- eBay continues using the user's configured eBay fee.
- For any non-eBay marketplace that is still `NOT_CONFIGURED`, its placeholder fee profile must not affect a real user decision.
- Before any non-eBay evidence provider is activated, verify its current fee schedule from official marketplace documentation and record the effective date/source in the fee configuration documentation.
- If a fee cannot be verified, that marketplace cannot become an authoritative financial opportunity.

---

# Phase 1 — Restore Diagnosability First

Fix **P1-9 and P1-10 before behavioral remediation**.

## P1-10 — Preserve query-level audit trail

`mapEbayResultToEvidence` must carry through the market-data audit information, including at minimum:

- attempted query
- query precision
- raw comp count
- retained comp count
- excluded comp count / reasons
- qualification result
- rejection reason
- selected query when applicable

Persist this in `scan_log.raw_response.decisionAudit` or the current canonical audit location.

Do not expose sensitive provider credentials.

## P1-9 — Surface real failure classification

Add a scanner-safe failure classification to the response contract so the UI can distinguish at least:

- provider throttled
- provider allowance exhausted
- provider unavailable
- provider not configured
- identification unresolved
- no matching market evidence
- evidence found but too weak
- eBay auth/provider failure

User-facing copy should remain concise. Example behavior:

- `LIMITED EVIDENCE — Market data provider is temporarily throttled. Try again.`
- `LIMITED EVIDENCE — Not enough comparable listings were found.`

Do not dump internal errors or secrets into the UI.

Add response-contract tests.

---

# Phase 2 — Fix Trawl Reliability

Fix **P0-3** and the related concurrency behavior.

## Required changes

- Replace Trawl raw `fetch` with the existing shared `externalCall` wrapper.
- Honor `Retry-After` according to Decision B.
- Preserve the distinction between temporary throttle and monthly allowance exhaustion.
- Pace sequential query-cascade requests enough to avoid self-induced per-second throttling.
- Replace unbounded shelf-scan market lookups with bounded concurrency.

### Shelf concurrency

Use a small explicit concurrency limit rather than `Promise.all` over all items.

Initial maximum: **3 concurrent item market-evidence resolutions**.

Do not serialize the entire shelf unless necessary.

## Verification

Tests must prove:

- `429 + Retry-After: 1` retries and can succeed.
- 429 without Retry-After fails without retry storm.
- retry budget is bounded.
- a provider error never becomes zero evidence.
- shelf concurrency is bounded.

---

# Phase 3 — Validate AI Model Numbers

Fix **P0-2**.

`model_number` must never accept free prose as an authoritative model identifier.

Add a validator/normalizer before constructing `IdentityCandidate.model`.

Accept values that look like plausible model identifiers, e.g. compact alphanumeric tokens containing meaningful letters/digits and limited separators.

Reject to `null` values such as:

- `Unknown`
- `Unknown - not visible in photo`
- `model number not visible`
- `likely P800 or similar`
- full explanatory sentences

Also tighten the identification prompt so `model_number` must be either:

- a literal visible/inferred model token, or
- `null`

Never prose.

Add tests using every malformed production example listed in the review.

---

# Phase 4 — Make the Query Cascade Trawl-Aware

Fix **P0-1**.

Trawl matches every query word, so the query planner must intentionally shorten as precision broadens.

The query cascade must include short high-signal rungs.

Example for the GE radio when no real model is known:

1. exact brand + validated model, if available
2. brand + model-family token, if available
3. brand + 2–3 discriminative product nouns
4. brand + product type
5. short product-family fallback

For the reviewed radio, a query equivalent to:

`general electric transistor radio`

must be reachable.

Do not generate prose such as:

`general electric unknown model number not visible in photo`

Provider-specific query behavior should live behind the provider/query-planning boundary rather than contaminating the decision engine.

Add tests proving the cascade genuinely becomes shorter/broader from rung to rung.

---

# Phase 5 — Replace Brittle Comp Filtering

Fix **P0-4, P2-12, P2-13, P2-14** using Decision A.

Refactor `compSelection.ts` into explicit stages:

1. normalize identity/listing fields
2. apply hard contamination/conflict rejections
3. compute comparable-match score
4. classify exact / usable / rejected
5. run price-coherence logic only on retained comparables

## Required normalization

Handle at minimum:

- punctuation differences
- apostrophes
- hyphenated vs unhyphenated model numbers
- plural/era variants where reasonable
- word boundaries

## Required tests

Include real/regression cases for:

- `X-700` vs `X700`
- `1960s` vs `1960'S`
- `all` must not match `wall`
- genuine GE radio titles from scan 66 survive
- wrong model is rejected
- wrong brand is rejected
- parts-only is rejected for a working-item scan
- condition prose such as `knobs appear new` does not turn the whole item into a `new` condition requirement

---

# Phase 6 — Restore Active-Evidence Support

Fix **P1-5** using Decision C.

Replace this all-or-nothing behavior:

`retained.length === sampled.length`

with the approved proportional support rule.

Preserve the actual retained active subset and calculate support from it.

Active evidence may support moderate evidence even when some Browse results are irrelevant.

Add tests for:

- 20 sampled / 15 good => accepted support
- 20 sampled / 12 good => accepted at 60%
- 20 sampled / 11 good => rejected
- fewer than 5 matching listings => insufficient support
- incoherent asking prices => insufficient support

Do not require active evidence when sold evidence already qualifies strong/moderate on its own.

---

# Phase 7 — Preserve Partial Evidence Across Cascade Errors

Fix **P1-7**.

A later provider error must not erase legitimate partial evidence already collected earlier in the same scan.

Rules:

- Preserve the best valid partial sold evidence found so far.
- Preserve audit history for every attempted query.
- If a later query throttles/fails, evaluate whether the preserved partial evidence plus active support qualifies moderate.
- A coherent subset should not be discarded simply because the broader set contained an outlier.
- When >=3 candidate comps fail global coherence, attempt a defensible robust subset/outlier rejection consistent with existing price-stat rules before throwing the whole set away.
- Do not fabricate or cherry-pick a price cluster solely to force qualification; tests must define the allowed robust filtering behavior.

---

# Phase 8 — Correct Missing Provider Configuration Behavior

Fix **P1-8**.

If neither `TRAWL_API_KEY` nor `SOLD_COMPS_API_KEY` is configured:

- return explicit `SOLDCOMPS_NOT_CONFIGURED` / normalized provider-not-configured state
- preserve identification
- do not silently continue as if the market simply lacked evidence
- surface a safe configuration/unavailable classification in diagnostics

Do not expose secret names to ordinary users unless appropriate for an internal/admin diagnostic view.

---

# Phase 9 — Contain Best-Effort eBay Calls

Fix **P2-11**.

Catalog and taxonomy are best-effort/informational after market evidence exists.

A catalog entitlement failure, taxonomy problem, or eBay app-auth issue in a best-effort branch must not discard already-qualified sold evidence.

Requirements:

- isolate these calls
- return null/unknown metadata where appropriate
- preserve qualified sold/active evidence
- preserve diagnostics
- only fail the whole eBay evidence path when the failed dependency is actually required for the evidence being used

Add tests covering known Catalog 403/not-entitled behavior.

---

# Phase 10 — Trawl Best-Offer Honesty

Fix **P2-15**.

The Trawl adapter currently hardcodes `bestOfferAccepted: false`.

Do not claim a Best Offer status that Trawl does not provide.

Choose a truthful representation in the provider contract:

- make Best Offer status nullable/unknown for Trawl, or
- add provider provenance so Best-Offer-specific exclusion logic only runs when the source actually supplies that field.

Do not fabricate `false`.

Update price-stat/coherence code and tests accordingly.

---

# Phase 11 — Clean Evidence-Quality Dead Logic

Fix **P2-16**.

`evidenceQualityFromCompCount` contains a dead/redundant branch.

Clean it so the code and comments match the actual intended informational bucketing.

Do not let this old count-only helper become the authoritative v2 decision-quality engine; `evidenceQuality.ts` remains authoritative for scanner decisions.

Add/adjust tests.

---

# Phase 12 — Trawl Pagination

Fix **P2-17**.

Implement bounded pagination according to the current official Trawl contract.

Requirements:

- do not exceed provider limits
- deduplicate items across pages
- preserve the approved sold-history window
- stop when enough high-quality evidence has been collected or the bounded search limit is reached
- rate-limit/pacing rules from Phase 2 apply to pages as well as query rungs
- no unbounded crawling

Document the maximum page/request budget per scan.

Choose the smallest budget that reliably supports evidence qualification without creating excessive latency/cost.

Add tests for pagination, duplicates, early stop, and rate limits.

---

# Phase 13 — Fix Facebook/Local Routing and Selection

Fix **P2-18** using Decision D.

Requirements:

- remove generic `table` routing that turns `table radio` into furniture/local
- use category-aware/local-suitability logic
- mark local evidence as borrowed when applicable
- never promote borrowed evidence strength
- local may win only when local-suitable and its economics materially outperform remote after shipping/packaging
- return the evidence donor marketplace in the audit/reason

Add tests for:

- tabletop radio => not routed local merely because of `table`
- dresser/sofa/large appliance => local eligible
- local does not automatically beat stronger remote evidence
- local can win for bulky item when shipping makes remote fail financial thresholds

---

# Phase 14 — Make Shelf Semantics Explicit

Fix/document **P2-19** using Decision E.

Remove any confusing synthetic-decision implementation if it obscures the actual rule.

For blank acquisition cost, compute max-buy price first and then classify explicitly:

- maxBuyPrice > 0 + strong => HOT
- maxBuyPrice > 0 + moderate => LIST
- maxBuyPrice <= 0 or null with decisive evidence => SKIP
- weak/none => LIMITED EVIDENCE

The implementation may still reuse `decide()` where clean, but tests and code should express the real shelf semantics directly rather than pretending a fake entered cost exists.

---

# Phase 15 — Verify/Guard Marketplace Fee Profiles

Fix the fee-profile issue recorded under the product decisions.

- Keep eBay user-configured.
- Prevent `NOT_CONFIGURED` marketplaces from affecting real financial authority.
- For any currently enabled non-eBay authoritative provider, verify fee data before allowing it to produce an authoritative opportunity.
- Add `verifiedAt` / documentation provenance where practical.
- Fail closed for an authoritative opportunity whose fee model is unknown/unverified.

Do not change pricing/fee behavior outside the Profit Scanner.

---

# Phase 16 — Modularize `claude-proxy/index.ts`

Fix **P2-20**.

The review found `claude-proxy/index.ts` at ~1,786 lines, violating the repo's 500-line ceiling.

Refactor conservatively, only around scanner responsibilities touched by this remediation.

Suggested extraction boundaries:

- scanner identity mapping / validation
- marketplace evidence orchestration
- scan result core / authority gate
- single/text scan finalization
- shelf scan orchestration
- scanner response mapping

Do not perform a broad unrelated edge-function rewrite.

Preserve public HTTP behavior and response contracts except for the explicitly approved scanner diagnostic additions in this prompt.

After extraction, no newly-created scanner service module should exceed the repo ceiling.

---

# Test Requirements

This remediation is not complete until Deno tests actually run.

If Deno is not installed:

1. install/use the repo-supported Deno runtime if safe and normal for the environment, or
2. stop and report a real environment blocker.

Do not claim success with Deno tests skipped.

At minimum run:

```bash
deno check supabase/functions/_shared/*.ts
deno check supabase/functions/claude-proxy/**/*.ts
deno test supabase/functions/_shared/ supabase/functions/claude-proxy/
```

Also run:

```bash
cd packages/shared
npx tsc --noEmit
node --test "src/**/*.test.ts"

cd ../../apps/web/public
node --test scanResultContract.test.js
```

Run current repo/CI-equivalent validation for any additional touched paths.

Add regression tests covering **every review finding P0-1 through P2-20**.

---

# Production Verification Requirements

After tests pass and code is merged/deployed, run a real authenticated production smoke test.

Use at least:

1. the same/general GE vintage transistor radio case that repeatedly produced LIMITED EVIDENCE,
2. an item with a clean exact model number,
3. an item expected to have only moderate evidence,
4. an item genuinely lacking enough evidence,
5. a bulky/local-suitable item,
6. a multi-item shelf scan.

For each scan verify server audit data shows:

- identification/model normalization
- routed marketplaces
- every generated query
- Trawl attempts/retries/pages
- raw/retained/excluded comps + reasons
- active sample retention ratio
- evidence-quality result
- expected price basis
- best marketplace selection
- profit/ROI or max-buy calculation
- final HOT/LIST/SKIP/LIMITED EVIDENCE result
- failure classification when applicable

The GE radio regression is not considered fixed if it still returns LIMITED EVIDENCE because of:

- prose model text,
- overlong Trawl AND query,
- retryable 429,
- brittle family token matching,
- unanimous active-listing requirement.

---

# Required Documentation Updates

After successful verification:

- update `docs/CURRENT_STATE.md`
- update the newest `docs/HANDOFF.md`
- update `docs/files/DECISIONS.md` with the approved decisions in this prompt
- update `supabase/DEPLOYED.md` if Edge Functions are deployed
- record the exact production version/commit tested
- mark the 2026-08-30 review findings resolved individually

Do not rewrite unrelated documentation.

---

# Required Final Report

Return a concise implementation report containing:

1. **Status of every finding**
   - P0-1 … P0-4
   - P1-5 … P1-10
   - P2-11 … P2-20

2. **Files changed**

3. **Behavior changed**

4. **Tests run and exact results**

5. **Deployment status/version**

6. **Production smoke-test results**

7. **Remaining blockers**, if any

Do not report "complete" while any required test is skipped, any P0/P1 finding remains open, or the production scanner still reproduces the known regression.

---

# Success Criteria

This remediation succeeds only when:

- Trawl receives provider-appropriate search queries.
- retryable throttles are retried safely.
- prose is never treated as a model number.
- genuine comparables survive matching while unrelated comps are rejected.
- active evidence is supportive rather than all-or-nothing.
- partial evidence is not lost because a later query fails.
- real provider/configuration failures are diagnosable.
- best-effort catalog/taxonomy failures do not erase qualified evidence.
- Best Offer provenance is honest.
- Trawl pagination is bounded and correct.
- Facebook/local cannot win through a routing/0%-fee artifact.
- shelf HOT/LIST/SKIP semantics are explicit and deterministic.
- unverified marketplace fees cannot become financial authority.
- the scanner code is modularized within repo constraints.
- all Deno/shared/client tests pass.
- a live authenticated production smoke test proves the regression is resolved.
- no non-scanner product area was behaviorally changed.

