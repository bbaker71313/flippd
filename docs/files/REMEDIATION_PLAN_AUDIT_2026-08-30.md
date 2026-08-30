# Audit — `SFP_PROFIT_SCANNER_FULL_REMEDIATION_PROMPT_20260830.md`

**Date:** 2026-08-30
**Auditor scope:** Read-only audit of the remediation plan against the live repo
(`HEAD` = `b33678c`) and the deployed `claude-proxy` v93. No code changed.
**Companion:** `docs/files/PROFIT_SCANNER_REVIEW_2026-08-30.md`

---

## Verdict

**The plan is fundamentally sound and I'd approve the direction.** It correctly
identifies all twenty findings, sequences diagnosability first (which is the
right call and not the obvious one), resolves every open product decision
instead of deferring, and states hard scope boundaries. Decisions B, C, and E
are well-specified with real numbers.

But it should not be run as written. There are **four blocking problems**, one
of which contradicts the repo's own anti-drift contract, and one of which makes
the plan's own completion criteria unsatisfiable. There is also a substantial
piece of high-yield work missing that is cheaper than the work the plan does
specify.

Recommendation: apply the fixes below, split into two releases, and add a
Phase 0.

---

## 1. Blocking — fix before running the plan

### B1 · No live-Trawl validation before building on the inference

The entire plan rests on one unverified assumption: *shorter queries will
return usable comps from Trawl.* That comes from Trawl's published docs plus my
offline simulation against recorded titles. **Neither is a live call.**

Phases 4, 5, 6, 7 and 12 all sit downstream of it. If the real cause of the
0-result responses is something else — the `date_from` window interacting with
`site`, an account/plan restriction, category defaults — the plan builds a
scoring engine, a pagination layer, and a cascade redesign on a wrong premise
and still ships a broken scanner.

**Add Phase 0 (≈30 minutes, before any code changes):** call Trawl directly
with the recorded identity and record raw results for each:

| # | Query | Purpose |
|---|---|---|
| 1 | `general electric all transistor am table radio 1960s` | reproduce the 0-result failure |
| 2 | `general electric transistor radio` | prove the short-query hypothesis |
| 3 | `general electric radio` | find where breadth stops helping |
| 4 | #2 with `date_from` removed | isolate the window as a variable |
| 5 | #2 with `site` removed | isolate the param as a variable |
| 6 | #2 with `limit=240` vs `limit=40` | confirm limit semantics |

Also capture the `X-RateLimit-Limit` / `-Remaining` / `-Reset` headers on every
call — the plan needs the real per-second limit and nobody has it yet (see H3).

Gate: **if query #2 does not return usable comps, stop and re-plan.** Phases
4–7 are invalid in that case.

### B2 · Phase 7's outlier rejection is undefined and delegates the definition to tests

> "attempt a defensible robust subset/outlier rejection… tests must define the
> allowed robust filtering behavior."

Two problems.

First, this directly contradicts **CLAUDE.md Anti-Drift rule 12**: *"Tests
verify approved behavior; they don't define it."* Letting the test author
decide what price filtering is acceptable is exactly the drift the contract
exists to prevent.

Second, this is the single most dangerous instruction in the document. It
operates on the **price basis that drives every profit number, ROI, max-buy
price, and HOT/LIST/SKIP result**. An implementer told to "find a defensible
subset" when the full set fails coherence will, under pressure to make the GE
radio pass, produce something that selects the cluster that qualifies. The plan
half-sees this ("do not fabricate or cherry-pick") but then provides no rule to
constrain it.

**Fix — specify the rule in the plan, now, or cut the phase:**

- Median Absolute Deviation outlier rejection, drop comps beyond 3·MAD.
- Drop **at most 20%** of the retained set.
- Require **≥3 survivors** after dropping, else the set fails — no rescue.
- Every dropped comp and its reason is recorded in the audit trail.
- If the surviving subset still fails the p20/p80 guard, the set fails.

If that rule can't be agreed now, **cut Phase 7's outlier clause entirely** and
keep only the uncontroversial half (preserve partial evidence across a later
provider error). That half is valuable and carries no cherry-picking risk.

### B3 · The Deno blocker is misdiagnosed, making the plan's own gate unsatisfiable

The plan says: *"If Deno is not installed: install/use the repo-supported Deno
runtime, or stop and report a real environment blocker"* and *"Do not claim
success with Deno tests skipped."*

That remedy does not address the actual blocker. Verified in the repo:

- `npx deno check` **already works** — the 2026-08-29 session ran it
  successfully on `soldCompsProvider.ts`.
- All **10** Deno test files import
  `https://deno.land/std@0.224.0/assert/mod.ts`.
- There is **no `deno.json`**, no import map, and no lockfile/vendor directory.

The blocker is the **remote import**, not the runtime. Installing Deno changes
nothing; the network policy still refuses `deno.land`. So the plan's completion
gate cannot be met, and the likely outcome is either a false "complete" or the
whole remediation stalling at the last step.

**Fix — add an explicit prerequisite task:**

1. Replace `https://deno.land/std@0.224.0/assert/mod.ts` in all 10 test files
   with `node:assert/strict` (Deno supports `node:` builtins natively, zero
   network) or a ~15-line local `_shared/testAssert.ts`.
2. Add a `deno.json` with an import map so any future dependency is pinned and
   vendorable.
3. Verify `npx deno test supabase/functions/_shared/` runs offline **before**
   starting the remediation.

This is ~30 minutes and unblocks every subsequent phase's verification. It is
arguably the highest-leverage single task in the whole effort.

### B4 · Decision C never says which active-listing count feeds evidence quality

Decision C requires *"at least 5 sampled matching listings must remain after
filtering, and at least 60% of the sampled candidate listings must pass."* Both
operate on the **sample** (eBay Browse `limit: 20`).

But `ebayBrowse.ts:79` sets:

```ts
matchingActiveCount: data.total ?? sampledListings.length
```

`data.total` is eBay's total result count for the query — it can be 3,000 while
the sample is 20. And `marketDataPipeline.ts:149` feeds **that** number into
`assessEvidenceQuality` as `activeEvidence.count`, where the rule is
`soldCount === 0 && activeCount >= 5 && activeCoherent → 'moderate'`.

If this isn't changed, the "5+ closely matched active listings" tier is
measuring an unfiltered population count. `data.total >= 5` is true for
essentially any query, so the active-only moderate tier would fire on almost
anything — replacing today's "never qualifies" bug with a "always qualifies"
bug, on the exact path that produces a decision with **zero sold evidence**.

**Fix — state explicitly in Decision C:**
- The **retained-sample count** feeds `assessEvidenceQuality`.
- `data.total` is retained as an informational competition-volume field only,
  clearly named as such (e.g. `totalActiveResultCount`), never as evidence.
- Add a test asserting evidence quality is unchanged when `data.total` swings
  from 6 to 6,000 with the same retained sample.

---

## 2. High-value work the plan is missing

### H1 · Restore identity inputs the cascade already supports but never receives

This is the biggest omission, and it is **cheaper and higher-yield than the
scoring system in Phase 5**.

Three high-signal identity inputs already have full plumbing and are silently
discarded:

| Input | Status | What it unlocks |
|---|---|---|
| `variant` | `index.ts:446` hardcodes `variant: null` | `buildSoldCompsQueries`' `exact_model_variant` rung is **dead code** — it can never fire in the live scanner |
| `gtin` / UPC | hardcoded `null` | `catalogSearchByGtin` is **unreachable**; `inferGtinKind` is dead. And **Decision A's own top tier — "exact identifier matches carry the highest weight" — is unreachable**, because no identifier is ever captured |
| `search_keywords` | AI is asked for *"4 specific eBay search terms for this exact item"*, returned to the client at `index.ts:523`, **never used to build a query** | Ready-made short, high-signal query rungs — exactly what Phase 4 needs |

There is also a whole richer identification module (`itemIdentification.ts`)
with GTIN/variant/MPN support that the scanner path bypasses entirely — it
calls `resolveVerifiedMarketData` directly with `identityFromAiScan`'s output.

**A visible barcode is the single strongest identity signal a reseller app can
capture**, and for a thrift-store user photographing retail packaging it is
often right there in the photo. The plan spends four phases building a scoring
system to compensate for weak identity while ignoring the strongest identity
signal already half-wired.

**Add to Phase 3:** extend the scan prompt to also return `variant` and
`gtin` (UPC/EAN/ISBN digits if legible, else null); validate both with the same
rigor as `model_number`; wire them into `identityFromAiScan`. **Add to Phase
4:** use `search_keywords` as cascade rungs.

### H2 · `externalCall` cannot enforce Decision B's 3-second budget

Decision B mandates *"maximum additional throttle wait budget per scan item: 3
seconds"* and says to use `externalCall`. Verified — `externalCall` **cannot do
this today**:

- It has `maxRetries`, but **no total-wait budget**.
- `externalCall.ts:116` sleeps `result.retryAfterMs` **uncapped**. A
  `Retry-After: 60` sleeps sixty seconds — inside an Edge Function, on a scan
  that already takes ~16s.

The plan reads as though the wrapper already supports the policy. It doesn't.

**Fix:** add `maxRetryAfterMs` and `totalRetryBudgetMs` to `ExternalCallPolicy`;
when the honored delay would exceed the remaining budget, fail fast rather than
sleeping. Add tests. Note this touches a shared helper used by `ebayBrowse` and
`ebayAppAuth` — additive only, defaults preserve current behavior.

### H3 · Pace from Trawl's rate-limit headers instead of guessing

Phase 2 says *"pace sequential query-cascade requests enough to avoid
self-induced per-second throttling"* — with no mechanism and no number, because
**nobody knows Trawl's actual per-second limit.**

Trawl returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and
`X-RateLimit-Reset` on every response. The plan never mentions them.

**Fix:** read those headers, hold them in a warm-instance token bucket shared
across cascade rungs *and* shelf items, and pace from the real limit. Retry
becomes the safety net rather than the primary mechanism — which is the right
shape, since the current failure is **self-inflicted** (the scanner throttles
itself with its own cascade), not external congestion.

### H4 · No shadow mode for the comp scorer

Decision A's `>= 80` / `60–79` / `< 60` thresholds are invented. There is no
calibration data behind them, and the plan's only fixture is one GE radio.

Shipping invented thresholds straight into the path that decides HOT/LIST/SKIP
is how the current outage happened — each previous build was also "obviously
more correct" than the last.

**Fix:** run the new scorer in shadow for a period — compute both old and new
classifications, decide on the old, log both plus the score into
`decisionAudit`. Compare on real traffic, tune, then flip. The audit
infrastructure from Phase 1 makes this nearly free.

### H5 · No rollback plan, and "fixed" has no measurable definition

- **Rollback:** the plan deploys a 16-phase change to the decision-critical path
  with no stated rollback. `supabase/DEPLOYED.md` records two incomplete/stale
  deploys already (v84 missing a file, v86 stale for a full release).
  **Fix:** record the pre-deploy version (currently **v93**) in `DEPLOYED.md` as
  the explicit rollback target before deploying.
- **Acceptance:** success is six manual smoke scans — a judgment call, not a
  measurement. **Fix:** define a number against a labeled fixture corpus, e.g.
  *"≥70% of a 20-item labeled corpus produces a decision, and 0% produce a
  decision without qualifying evidence."* The second half matters more than the
  first: a plan aimed at "stop returning LIMITED EVIDENCE" has a natural bias
  toward loosening until things pass.

### H6 · The fixture corpus is one item

Every regression fixture in the plan traces to the GE radio. That's a real
case, but tuning a scoring system against n=1 will overfit.

**Fix:** before Phase 5, capture 15–20 real identities across categories
(electronics with clean model numbers, clothing, tools, collectibles, books
with ISBNs, no-model vintage items) and hand-label the expected comps. Do this
during Phase 0 while making live Trawl calls anyway.

---

## 3. Scope and sequencing

### S1 · Split into two releases

Phases **10** (Best-Offer honesty), **11** (dead branch), **12** (pagination),
and **16** (modularization) are not causes of the outage. Bundling them delays
the fix, inflates the diff, and violates Karpathy rule 3 / Anti-Drift rule 3 —
which the plan itself invokes.

| Release | Contents |
|---|---|
| **R1 — outage fix** | Phase 0 (new), B3 Deno prerequisite, Phases 1, 2, 3, 4, 5, 6, 7 (constrained per B2), 8, 9, 13, 14 |
| **R2 — hygiene** | Phases 10, 11, 12, 15, 16 |

R1 is already a large change. Getting it verified in production before starting
R2 is worth more than one big merge.

### S2 · Phase 12 (pagination) is actively counterproductive in R1

Pagination **increases request volume against the exact rate limit Phase 2 is
fixing.** And it doesn't address the observed failure: the problem was **zero
results**, not too few pages. Paginating a query that returns nothing returns
nothing, slower.

Defer to R2, after the real rate limit is known from H3 and short queries are
proven to return results.

### S3 · Phase 16 (modularization) carries a deploy risk the plan doesn't note

Splitting a 1,786-line file into modules **while changing decision logic** makes
the diff unreviewable and bisecting impossible.

Repo-specific risk the plan misses: per `supabase/DEPLOYED.md`, `claude-proxy`
deploys require **hand-tracing the transitive dependency closure** (currently 27
files) because there's no automated bundler step. More modules = a larger
closure to trace = more chances of the v84-style incomplete deploy. If Phase 16
proceeds, it should include **automating the closure computation**, not just
splitting files.

Do it in R2, as its own PR, with no behavior change in the diff.

---

## 4. Smaller corrections

| # | Item | Change |
|---|---|---|
| C1 | **Decision A — "conflicting brand or conflicting explicit model is a hard rejection"** | Add explicitly: **absence is not conflict.** The P0-2 bug *was* treating a missing token as a mismatch (`title.includes(model)` false → `"model mismatch"`). Without this sentence an implementer can rebuild the same bug inside the new scorer. |
| C2 | **Decision D — "materially outperform"** | Undefined, while the rest of the plan gives precise numbers (60%, 3s, 2 retries, 3 concurrent). Give it one, e.g. *"local net profit exceeds the donor marketplace's by ≥25% **and** ≥$10 absolute."* |
| C3 | **Decision E — shelf HOT frequency** | Correct as specified, but note the consequence: *any* positive max-buy price qualifies, so HOT will fire on nearly every strongly-identified shelf item. The **max-buy price is the actionable signal**, not the badge. Worth a UI note so shelf HOT doesn't become meaningless. |
| C4 | **Phase 3 — model validator** | Add the negative case *"P-series"* (scan 65). It's a plausible-looking model token that is really a family hint — the interesting boundary case, and the one a naïve alphanumeric regex accepts. |
| C5 | **Documentation** | The plan says to update `DECISIONS.md` with the new decisions. It should also record that Decisions **C, D, E supersede** parts of the 2026-08-29 Profit Scanner v2 entry, following the supersession pattern that entry itself used. |
| C6 | **Phase 1 audit-trail size** | `scan_log.raw_response` already carries per-comp exclusion reasons; scan 66's audit was ~8 KB for one item. A shelf scan × pagination × retries could get large. Add a bound: cap `excludedComps` at ~25 per query with a count of the remainder. |
| C7 | **Phase 6 test table** | *"20 sampled / 12 good => accepted at 60%"* — 12/20 is exactly 60%. Specify the comparison is `>=` and add the 11/20 (55%) reject case the plan already lists. Boundary conditions should be explicit, not inferred. |

---

## 5. What the plan gets right (keep as-is)

- **Diagnosability first (Phase 1).** Correct and non-obvious. Without the audit
  trail and a client-visible failure classification, none of the later fixes are
  verifiable. This ordering alone prevents the next round of blind iteration.
- **Resolving all six product decisions rather than deferring.** Removes exactly
  the ambiguity that Anti-Drift rule 1 would otherwise stall on.
- **Decision B's structure** — distinguishing retryable throttle from allowance
  exhaustion, and forbidding a silent mid-scan provider switch.
- **Decision C's proportional rule** — the right shape, and it correctly
  restores the two dead evidence tiers.
- **Decision E** — explicitly rejecting a synthetic entered cost in favor of real
  max-buy-price semantics.
- **Decision F** — fail-closed on unverified fees. Exactly right.
- **The protected-behavior list** — accurately mirrors what the review verified
  sound; no correct code is put at risk.
- **"Do not report complete while any P0/P1 remains open"** — the right gate,
  and it just needs B3 fixed to be satisfiable.

---

## 6. Recommended revised sequence

```
Phase 0   Live Trawl validation spike + capture rate-limit headers   [NEW, gating]
Phase 0b  Remove deno.land imports, add deno.json, prove tests run   [NEW, B3]
Phase 0c  Capture 15-20 item labeled fixture corpus                  [NEW, H6]
---------------- gate: short queries proven to return comps ----------------
Phase 1   Diagnosability (P1-9, P1-10)          + C6 audit size cap
Phase 2   Trawl reliability (P0-3)              + H2 budget, H3 header pacing
Phase 3   Model validation (P0-2)               + H1 variant/GTIN, C4
Phase 4   Query cascade (P0-1)                  + H1 search_keywords
Phase 5   Comp scoring (P0-4, P2-12/13/14)      + C1, H4 shadow mode
Phase 6   Active evidence (P1-5)                + B4 count fix, C7
Phase 7   Partial evidence (P1-7)               — outlier clause per B2 or cut
Phase 8   Provider not configured (P1-8)
Phase 9   Contain best-effort eBay calls (P2-11)
Phase 13  Facebook/local routing (P2-18)        + C2
Phase 14  Shelf semantics (P2-19)               + C3
---------------- R1 ships; verify in production; H5 rollback target ----------
Phase 10  Best-Offer honesty (P2-15)
Phase 11  Dead branch (P2-16)
Phase 12  Pagination (P2-17)                    — needs Phase 0's real limit
Phase 15  Fee profile guards
Phase 16  Modularization (P2-20)                + automate deploy closure (S3)
```

---

## 7. Summary of changes requested

**Blocking (4):** add the Phase 0 Trawl spike · constrain or cut Phase 7's
outlier clause · fix the misdiagnosed Deno blocker · specify which active count
feeds evidence quality.

**High-value additions (6):** wire variant/GTIN/search_keywords · add a wait
budget to `externalCall` · pace from rate-limit headers · shadow-mode the
scorer · add a rollback target and a numeric acceptance metric · build a real
fixture corpus.

**Sequencing (3):** split R1/R2 · defer pagination · separate the refactor.

**Smaller (7):** C1–C7 above.

**Unchanged:** the plan's diagnosability-first ordering, all six product
decisions in substance, the protected-behavior list, and the completion gate.
