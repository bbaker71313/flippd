# Profit Scanner — Full Code Review (2026-08-30)

**Type:** Read-only review. No application behavior, schema, dependency, or
deployed function was changed by this session.
**Symptom investigated:** every scan returns `LIMITED EVIDENCE` ("Not enough
coherent, comparable marketplace evidence…") instead of HOT/LIST/SKIP.
**Verdict:** Reproduced and root-caused from production data. There is **not
one** bug — there are **four independent P0 defects, all live at once**, any
one of which is sufficient to force `LIMITED EVIDENCE` on effectively every
scan. Two more (P1) disable the fallback tiers that Profit Scanner v2 added
specifically to prevent this failure mode.

---

## 0. Scope and method

Reviewed the complete live scanner path:

`app.html` (scan UI) → `claude-proxy/index.ts` (`handleSingleScan` /
`handleShelfScan` → `resolveMarketplaceEvidenceBundle` → `resolveScanResultCore`)
→ `marketplaceRouter.ts` → `marketplaceProviders.ts` → `marketDataPipeline.ts`
→ `soldCompsProvider.ts` (Trawl) · `ebayBrowse.ts` · `ebayCatalog.ts` ·
`ebayTaxonomy.ts` → `compSelection.ts` → `marketMetrics.ts` →
`evidenceQuality.ts` → `marketplaceOpportunity.ts` → `marketplaceEconomics.ts`
→ `financialEngine.ts` / `maxBuyPrice.ts` → `decisionEngine.ts` →
`scanResultContract.js` → `app.html` render.

Evidence used, in order of authority:

1. **Production `scan_log` rows 60–68** (project `dqgfpchkheznvanfgsmx`),
   including the full `raw_response.decisionAudit` forensic payloads.
2. **The live deployed `claude-proxy` bundle** — fetched and byte-compared
   against repo `HEAD` (`b33678c`). **Live version 93, ACTIVE, 27 files, zero
   drift.** Reviewing the repo *is* reviewing production.
3. **Trawl's published API contract** (`api.trawl.dev/ebay/v1/sold`).
4. Local reproduction of `compSelection.ts` against the real comp titles
   recorded in `scan_log` row 66.

---

## 1. The regression timeline (from production data)

Four consecutive builds each replaced one failure cause with a different one.
This is why the scanner has looked uniformly broken rather than intermittently
broken.

| Scan | When (UTC) | Build | Result | Recorded reason |
|---|---|---|---|---|
| 62 | 08-27 22:41 | v87 | **HOT** | `marketDataSource: verified` |
| 63 | 08-28 13:54 | v87 | **SKIP** | `verified` |
| 64 | 08-28 15:28 | v87 | **HOT** | `verified` |
| 65 | 08-28 18:20 | evidence-remediation | LIMITED | `INSUFFICIENT_VERIFIED_MARKET_DATA` — *"0 raw results"* for a 30-word query |
| 66 | 08-28 21:09 | evidence-remediation | LIMITED | `INSUFFICIENT_VERIFIED_MARKET_DATA` — *"Sold comps qualified, but matching active-market evidence was unavailable or contaminated"* (**9 good comps thrown away**) |
| 67 | 08-29 15:50 | + Trawl (v91) | LIMITED | `PROVIDER_RATE_LIMITED` — *"Trawl rate limit exceeded; retry after 1 seconds"* (queries 1–2 returned **0 raw results**, query 3 was throttled) |
| 68 | 08-29 20:25 | + v2 (v93) | LIMITED | `PROVIDER_RATE_LIMITED` — same, and **the query-level audit trail is now gone** |

The last successful scan was **2026-08-28 15:28**. Nothing has produced a
decision since.

---

## 2. P0 findings — each independently forces LIMITED EVIDENCE

### P0-1 · Trawl requires EVERY query word in the listing title; the cascade emits 6–9 word prose queries

`compSelection.ts:buildSoldCompsQueries()` builds queries from the AI's
`item_name` / `brand` / `model` — routinely 6 to 9 words. Trawl's documented
semantics: *"Finds sold listings whose title contains **EVERY** word in
`query`, in any order (eBay's own matching semantics)."*

The previous provider (`sold-comps.com`) did loose relevance matching, so the
same long queries returned results (34 and 40 raw comps on 08-28). Trawl does
not. Swapping the provider silently changed the meaning of every query the
cascade produces.

Reproduced against the nine genuine GE-radio comp titles recorded in scan 66:

| Query actually generated | Words | Titles matching all words |
|---|---:|---:|
| `general electric unknown model number not visible in photo` | 9 | **0 / 9** |
| `general electric all transistor am table radio 1960s` | 8 | **0 / 9** |
| `all transistor am table radio 1960s` | 6 | **0 / 9** |
| `general electric transistor radio` *(never generated)* | 4 | **6 / 9** |

The cascade is designed to widen precision (`exact_model` → `product_family` →
`substitute`) but **never shortens the query**, so every rung fails identically.
Confirmed in production: scan 67, queries 1 and 2, `rawCompCount: 0`.

**Files:** `_shared/compSelection.ts:51-66`, `_shared/soldCompsProvider.ts:159-201`

---

### P0-2 · `model_number` accepts free prose and is used as an authoritative model identifier

`claude-proxy/index.ts:439-457` (`identityFromAiScan`) assigns
`model = ai.model_number` with no validation. In **every production scan
inspected (62–68)** the AI returned prose, never a model number:

| Scan | `model_number` returned |
|---|---|
| 68 | `Unknown - not visible in photo` |
| 67, 66, 62 | `Unknown - model number not visible in photo` |
| 65 | `P-series (exact model not confirmed - likely P800 or similar tabletop variant)` |
| 64 | `Unknown - likely P800 series or similar GE table radio` |
| 63 | `Unknown - likely GE P807 or similar 1960s table model` |

That string then flows into three places at once:

1. **The `exact_model` query text** — producing
   `"general electric unknown model number not visible in photo"`.
2. **A mandatory hard filter**: `compSelection.ts:101` requires
   `title.includes(model)`. No eBay title contains that sentence, so the
   highest-precision rung excludes **100%** of its results. Production proof —
   scan 66, query 1: 34 raw comps, **34 excluded, all `"model mismatch"`**,
   including obviously unrelated Titanic posters *and* genuine GE radios alike.
3. **`productFamily()` token subtraction**, corrupting the family fallback too.

The prompt (`buildSinglePrompt`) asks for `"model_number":"string or null"` but
never forbids prose, and the code trusts it verbatim.

**Files:** `claude-proxy/index.ts:439-457`, `_shared/compSelection.ts:41-66,101-102`

---

### P0-3 · A Trawl 429 is treated as a fatal error; the documented retry is never performed

`marketDataPipeline.ts:71-80`: any non-ok provider result **returns
immediately**, aborting the entire eBay evidence path.

Trawl's contract distinguishes two 429s:

- **429 *with* `Retry-After`** — a per-second throttle. *"Wait that many seconds
  and retry (**costs nothing**)."*
- **429 *without* `Retry-After`** — monthly allowance exhausted; do not retry.

The code correctly *labels* the two (`soldCompsProvider.ts:178-184`) and then
treats them identically: fatal. Production scans 67 and 68 both failed on
`Retry-After: 1` — a **one-second** wait away from succeeding.

Three things make throttling near-certain rather than incidental:

- The cascade issues **up to 5 sequential Trawl calls per item**, back-to-back,
  with no pacing.
- `handleShelfScan` (`index.ts:639`) runs every detected item through
  `Promise.all` — an 8-item shelf fires **up to 40 concurrent** Trawl requests.
- The Trawl provider uses **raw `fetch`**, bypassing this repo's own hardened
  `externalCall` helper, which already implements exactly the needed behavior:
  429 detection, `Retry-After` parsing, and bounded backoff-with-jitter
  (`externalCall.ts:167-168`). `ebayBrowse.ts` and `ebayAppAuth.ts` use it.
  `soldCompsProvider.ts` does not.

**Files:** `_shared/soldCompsProvider.ts:159-210`, `_shared/marketDataPipeline.ts:71-80`, `claude-proxy/index.ts:639`

---

### P0-4 · The product-family overlap filter rejects genuinely comparable comps

`compSelection.ts:103-107` requires each comp title to contain **at least half**
of the "product family" tokens, at *every* precision level. Those tokens are
derived from the AI's descriptive `item_name`, so marketing prose becomes a hard
matching requirement.

For `"General Electric All Transistor AM Table Radio Vintage 1960s"` the family
tokens are `all, transistor, table, radio, 1960s` → **3 of 5 required**. Real
eBay sellers write `"1960'S Vintage General Electric P-806A AM Transistor Radio"`
— which contains 2. Excluded.

Reproduced locally against six *perfect* comps, **with a clean identity
(`model: null`, so P0-2 is not in play)**: **0 of 6 retained**, at every cascade
rung. In production (scan 66, query 2) only 9 of 40 survived — a 22% retention
rate on the one query that did return data.

Two aggravating details:

- `normalize()` converts `1960'S` → `1960 s`, so the identity token `1960s`
  can *never* match a title written with an apostrophe.
- Matching is `title.includes(token)` — raw substring, not word-boundary — so
  it is simultaneously too strict on real tokens and too loose on short ones
  (`all` matches `wall`, `metallic`).

**Files:** `_shared/compSelection.ts:41-49,91-107`

---

## 3. P1 findings — the v2 resilience tiers are unreachable

### P1-5 · Active-market evidence is discarded unless **all 20** sampled listings pass the identity matcher

`marketDataPipeline.ts:138`:

```ts
if (!sampleAsSold.length || activeSelection.retained.length !== sampleAsSold.length) activeMarketEvidence = null;
```

One imperfect listing out of ~20 eBay Browse results voids the entire active
population. Given P0-4's filter strictness, this essentially never passes.

Consequences:

- Scan 66's exact failure: *"Sold comps qualified, but matching active-market
  evidence was unavailable or contaminated"* — **9 valid sold comps discarded**
  because the active sample wasn't unanimous.
- Two of the four `assessEvidenceQuality` tiers become **dead code**: the
  "1–2 exact sold comps + active support → moderate" tier and the
  "no sold evidence, 5+ coherent active listings → moderate" tier
  (`evidenceQuality.ts:60-61`).
- `sellThroughRate`, `avgDaysToSell`, and `demandLevel` are computed only when
  `qualified && activeMarketEvidence` (`marketDataPipeline.ts:187`), so they are
  now **permanently null** — which also degrades Inventory's `SourcingMeta` and
  the Listing Generator prompt downstream.

Net effect: evidence quality is decided **solely** by sold comps, and needs
≥3 surviving coherent comps. Below that → `weak` → LIMITED EVIDENCE.

---

### P1-6 · eBay is the only real evidence provider, so its failure is unrecoverable by design

`marketplaceProviders.ts:105-127`: Etsy, Reverb, Discogs, Amazon, Mercari, and
Poshmark all return `NOT_CONFIGURED`. `facebook_local` has no provider and only
borrows a valuation from an already-qualifying opportunity
(`marketplaceOpportunity.ts:102`). So `buildMarketplaceOpportunities` returns an
empty array whenever the eBay chain fails, `selectBestMarketplace` returns
`null`, and `resolveScanResultCore` returns `noDecisionResult`.

The v2 architecture reads as multi-marketplace but is, operationally, a
single-provider system with no redundancy. (This is a correctly-disclosed
provider boundary, not a defect — but it is why P0-1/2/3/4 have no fallback.)

---

### P1-7 · A mid-cascade provider failure discards evidence already collected

`marketDataPipeline.ts:79` returns on the first provider error, throwing away
any `partial` comps gathered from earlier successful queries **and** skipping
the active-evidence path entirely. Scan 67 collected results from two queries
before the 429 aborted everything.

Related: a query returning ≥3 comps that fail the coherence guard is dropped
entirely and is *not* retained as `partial` (`marketDataPipeline.ts:100`) — so a
5-comp set with one outlier yields **less** usable evidence than a 2-comp set.

---

### P1-8 · An unconfigured sold-data provider is silently skipped

`soldCompsProvider.ts:279-281` documents the contract: *"Callers must treat null
as `SOLDCOMPS_NOT_CONFIGURED`, never silently skip."* `marketDataPipeline.ts:68`
does exactly that — `if (soldProvider) { … }`, no `else`. If `TRAWL_API_KEY` and
`SOLD_COMPS_API_KEY` were both absent, users would see the generic
"not enough evidence" message rather than a configuration error. This is not the
current cause (Trawl is configured and responding), but it is a live
misdiagnosis trap and contradicts Anti-Drift rule 6 (no silent fallbacks).

---

### P1-9 · The real failure reason never reaches the user or the UI

`ScanResultCore` carries no failure-reason field, so `noDecisionResult()`
returns nothing explaining *why*. `app.html:6238` renders one fixed sentence for
every cause: a provider rate limit, an outage, a missing API key, an eBay auth
failure, and a genuine "this item has no comps" all look identical.

This is the direct reason the symptom presented as *"the scanner just says not
enough evidence on everything"* rather than *"our sold-data provider is
throttling us."* The server knows `PROVIDER_RATE_LIMITED`; it simply never says so.

---

### P1-10 · v2 dropped the query-level audit trail (diagnosability regression)

`marketplaceProviders.ts:50-53` (`mapEbayResultToEvidence`) maps only `reason`
and `detail`, discarding `result.audit.attemptedQueries`. Scans 66 and 67 record
every attempted query, its precision, raw/retained comp counts, and per-comp
exclusion reasons — the forensic data that made this review possible. Scan 68,
under v2, records **none of it**. Restoring this should precede any fix, so the
fix can be verified.

---

## 4. P2 findings — correctness and robustness

| # | Finding | Location |
|---|---|---|
| P2-11 | An eBay app-auth failure is **not** contained: `catalogSearch` and `resolveCategory` re-throw `EbayAppAuthError`, which propagates out of `resolveVerifiedMarketData` and is caught in `index.ts` as `PROVIDER_UNAVAILABLE`. Both calls run **after** sold comps have already qualified, and both are documented best-effort/informational (Catalog is known to return 403 — not entitled for this app). A credential/entitlement problem therefore discards a fully-qualified decision. | `ebayCatalog.ts:79`, `ebayTaxonomy.ts:66`, `marketDataPipeline.ts:111-114` |
| P2-12 | Model matching is exact-substring on the normalized string: `X-700` matches `X-700` but not `X700`. Real eBay titles use both. | `compSelection.ts:101` |
| P2-13 | `title.includes(token)` has no word boundary — short family tokens produce false positives. | `compSelection.ts:104` |
| P2-14 | `conditionMismatch` triggers on `new`/`sealed`/`unopened` appearing **anywhere** in the AI's free-text `condition_notes`. A note like *"knobs appear new"* excludes every used comp. | `compSelection.ts:73-80` |
| P2-15 | Trawl hardcodes `bestOfferAccepted: false`, so `excludedBestOfferCount` is always 0 and the p20/p80 coherence guard can no longer exclude Best-Offer noise — an honest-labeling gap versus the SoldComps path. | `soldCompsProvider.ts:147` |
| P2-16 | `evidenceQualityFromCompCount` has a dead branch — `n >= 3` and the fallback both return `'weak'`. | `marketMetrics.ts:48-53` |
| P2-17 | Trawl pagination remains unwired (`page` never sent; single page). Pre-existing, already documented. | `soldCompsProvider.ts:166-171` |
| P2-18 | `facebook_local` inherits the donor's evidence tier **and** gets 0% fees / $0 shipping, so its net profit is always highest — it will win `selectBestMarketplace` nearly whenever routed. The router matches `table` in *"Table Radio"*, so scan 68 routed a tabletop radio to local. **Product decision needed.** | `marketplaceRouter.ts:28`, `marketplaceOpportunity.ts:102-109,125-135` |
| P2-19 | On shelf scans, acquisition cost is unknown by definition, so `buildOneOpportunity` feeds `decide()` synthetic at-threshold values. `qualifies` is then always true when a positive max-buy price exists, making HOT-vs-LIST a pure evidence-tier label rather than an economics judgement. **Product decision needed.** | `marketplaceOpportunity.ts:47-69` |
| P2-20 | `claude-proxy/index.ts` is **1,786 lines** — CLAUDE.md's hard 500-line ceiling. | `claude-proxy/index.ts` |

---

## 5. What is *not* broken

Verified sound, no changes warranted:

- **`financialEngine.ts` / `calcProfit`** — fees, packaging, shipping, net,
  margin, and the `roi === null` semantics for `cost <= 0` are all correct.
- **`maxBuyPrice.ts` / `calcMaxBuyPrice`** — backward solve and `limitedBy`
  attribution are correct, including the `both` epsilon case.
- **`decisionEngine.ts`** — matches the approved v2 contract exactly
  (`HOT` = pass + strong, `LIST` = pass + moderate, `SKIP` = either fails),
  with the null-ROI bypass intact.
- **`marketplaceEconomics.ts`** — correctly delegates to the shared math and
  preserves the user's configured `ebayFee` for eBay.
- **The AI-market-authority boundary holds.** Under every failure above, the
  system refuses to fabricate a decision, price, profit, ROI, or max-buy price.
  It fails **honestly**. The scanner is not producing wrong answers — it is
  producing no answers.
- **Deployment integrity** — live `claude-proxy` v93 is byte-identical to repo
  `HEAD`. No drift, no stale bundle.
- **Test suites** — `packages/shared`: `tsc --noEmit` clean, **70/70 pass**.
  `scanResultContract.test.js`: **32/32 pass**. Note: all four P0 defects sit in
  Deno-only `_shared` code that these suites do not cover.

---

## 6. Recommended remediation order

Sequenced so each step is verifiable before the next. **No code was changed by
this review** — this is a proposal, not an implementation.

1. **Restore diagnosability first** (P1-10, P1-9). Carry `attemptedQueries`
   through `mapEbayResultToEvidence`, and surface the failure `reason` to the
   client so LIMITED EVIDENCE can distinguish a throttle from a real data gap.
   Without this, none of the fixes below can be confirmed in production.
2. **Fix the Trawl call layer** (P0-3). Route the provider through
   `externalCall` with `maxRetries` and `Retry-After` honored; pace the cascade;
   bound shelf-scan concurrency instead of unbounded `Promise.all`.
3. **Validate `model_number`** (P0-2). Reject prose — require a plausible
   alphanumeric model token, else treat as `null`. This alone restores the
   `exact_model` rung.
4. **Make the query cascade provider-aware** (P0-1). Add short, high-signal
   query rungs (brand + 2–3 discriminative nouns) suited to AND-all-words
   matching.
5. **Loosen the comp filter to a scored match** (P0-4, P2-12/13/14) — weight
   brand and model heavily, treat descriptive prose tokens as signal rather than
   as hard requirements, and fix the `1960'S` → `1960 s` normalization asymmetry.
6. **Replace the all-or-nothing active-evidence gate with a proportional
   threshold** (P1-5), restoring the two dead evidence tiers and the
   STR/days-to-sell/demand informational fields.
7. **Contain best-effort eBay calls** (P2-11): catalog/taxonomy failures must
   not discard qualified sold evidence.

Steps 3 and 4 are the smallest changes with the largest effect: together they
would have made scans 65–68 return real comps.

---

## 7. Product decisions required

Per Anti-Drift rule 1, these are **not** implementable without an explicit
product decision — each changes user-visible behavior, financial output, or
HOT/LIST/SKIP semantics:

1. **What comp-match strictness is acceptable?** The current filter is strict
   enough to reject genuine comps (P0-4). Loosening it trades false LIMITED
   EVIDENCE against decisions based on looser comparables. The threshold
   (scored match vs. hard token requirement, and what score qualifies) is a
   product call, not an implementation detail.
2. **Should a provider throttle be retried, and how long may a scan block?**
   Retrying a `Retry-After: 1` throttle is free per Trawl's contract, but it
   adds latency to a scan that already takes ~16s.
3. **Should active-market evidence be required at all**, and at what match
   proportion? This directly determines whether STR / days-to-sell / demand ever
   repopulate for Inventory and the Listing Generator.
4. **`facebook_local` selection** (P2-18): should a $0-fee borrowed-evidence
   local opportunity be allowed to win "Best Market" over the marketplace that
   actually supplied the evidence?
5. **Shelf-scan HOT semantics** (P2-19): with acquisition cost unknown by
   definition, should HOT/LIST reflect anything beyond evidence tier?
6. **Marketplace fee percentages** remain the unverified placeholders flagged in
   the 2026-08-29 handoff.

---

## 8. Assumptions made

- Trawl's published contract (`query` = all-words AND matching; `Retry-After`
  429 = free retryable throttle) is authoritative. It matches the observed
  production behavior exactly — queries that returned 34–40 raw comps from
  `sold-comps.com` on 08-28 returned 0 from Trawl on 08-29.
- The comp titles recorded in scan 66's audit are representative of what Trawl
  would return for the same item, and were used as the local reproduction
  fixture.
- The reviewed user's scans (`user_id: 2`) are representative of the reported
  "every scan" symptom. All 4 scans since 2026-08-28 18:20 failed; the 3 before
  that succeeded.

## 9. Blockers

- **Deno is not installed in this environment** (`deno: command not found`), so
  `supabase/functions/_shared/` and `claude-proxy/` still cannot be type-checked
  or tested. This is the same blocker recorded in the 2026-08-29 handoff and it
  remains open — all four P0 defects live in exactly that untested code.
