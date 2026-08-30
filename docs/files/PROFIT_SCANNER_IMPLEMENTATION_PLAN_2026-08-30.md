# Profit Scanner — Implementation Plan

**Date:** 2026-08-30
**Author:** Engineering
**Status:** Proposed — awaiting product-owner sign-off on §2
**Inputs:** `PROFIT_SCANNER_REVIEW_2026-08-30.md` (root cause) ·
`REMEDIATION_PLAN_AUDIT_2026-08-30.md` (audit of the prior plan)
**Baseline:** repo `HEAD` = `03eb041`; live `claude-proxy` **v93** (byte-identical to HEAD)

---

## 1. The thesis

Four consecutive builds have tuned the scanner's **rules**. The scanner has been
down since 2026-08-28 15:28.

That is the finding. The rules were never the problem:

> **The decision logic is correct. The inputs feeding it are starved, and its
> failures are invisible.**

`decide()`, `calcProfit`, `calcMaxBuyPrice`, and `marketplaceEconomics` are all
verified correct. What is broken is everything *upstream* of them — identity is
polluted with AI prose, queries are malformed for the provider we actually use,
the transport gives up on a one-second throttle, and the filters reject genuine
comparables. And because the failure reason never leaves the server, each build
tuned blind and swapped one cause for another.

**So this plan is ordered by that thesis, not by finding number:**

| | | |
|---|---|---|
| **R0** | Prove the premise, unblock the tests | *Can we even see and verify?* |
| **R1** | Instrumentation + honest failure | *Make the system tell the truth* |
| **R2** | Fix the inputs | *Identity and queries — the actual starvation* |
| **R3** | Fix the filters | *Stop discarding good evidence* |
| **R4** | Hygiene | *Everything that isn't the outage* |

R1 is deployable on day one and converts "we don't know" into "we know" before
a single line of decision-path logic changes. That sequencing is the single most
important choice in this document.

### Guiding principles

1. **Never fabricate.** Preserved absolutely. Every change below either produces
   defensible evidence or an explicit, classified failure. No change in this plan
   makes it easier to invent a number.
2. **Structure in code, parameters from data.** We specify shapes, boundaries,
   and interfaces here. We do **not** freeze magic numbers we cannot yet justify —
   those get calibrated against a real corpus (§3.1) and logged so they stay
   tunable.
3. **One concept per fix.** Where several findings share a root, fix the root.
   Provider capabilities (§4.1) resolves three findings with one interface.
4. **Instrument before you change.** Nothing in R2–R4 ships without the audit
   trail from R1 already live to measure it.

---

## 2. Product decisions — adopted, with three tightenings

The remediation prompt of 2026-08-30 resolved six open product decisions. This
plan **adopts all six as approved** and does not relitigate them. Three need
tightening before they are implementable; these are the only product questions
still open, and they block R3 (not R0–R2).

| | Decision | Status |
|---|---|---|
| **A** | Scored comp matching, not hard token majority | Adopted — **needs T1** |
| **B** | Retry a `Retry-After` 429; 2 retries; 3s budget/item | Adopted as written |
| **C** | Active evidence is supporting, ≥5 retained and ≥60% | Adopted — **needs T2** |
| **D** | `facebook_local` must not auto-win | Adopted — **needs T3** |
| **E** | Shelf: max-buy-price first, then classify | Adopted as written |
| **F** | Fail closed on unverified marketplace fees | Adopted as written |

**T1 — "absence is not conflict."** Decision A says conflicting brand/model is a
hard rejection. It must also say the inverse explicitly: **a token that is merely
missing scores zero, it never rejects.** Treating a missing token as a mismatch
*was* P0-2 — it excluded 34 of 34 comps. Without this sentence in the spec, a new
scorer can rebuild the same defect.

**T2 — which active count is authoritative.** `matchingActiveCount` is currently
eBay's `data.total` (the whole unfiltered result set, often thousands), and that
is what `assessEvidenceQuality` consumes. Decision C's ≥5/≥60% rules operate on
the 20-item sample. **The retained-sample count must be the one that feeds
evidence quality**; `data.total` becomes an informational competition-volume
field. Without this, we replace "never qualifies" with "always qualifies" on the
path that decides with zero sold evidence — a strictly worse bug.

**T3 — "materially outperform" needs a number.** Every other decision carries
one. Proposed: local wins Best Market only when its net profit exceeds the
evidence-donor marketplace's by **≥25% and ≥$10 absolute**, and the item is
local-suitable by category. Confirm or replace the number.

**Explicitly unchanged:** HOT/LIST/SKIP semantics, the $0-cost → `roi: null`
rule, user-configured seller economics, STR/days-to-sell/demand as informational
only, and the rule that weak/no evidence never yields a decision.

---

## 3. Release 0 — Prove the premise, unblock verification

**No product code. ~0.5 day. Everything downstream depends on this.**

### 3.0 The Trawl spike — a hard gate

The entire plan rests on one inference: *shorter queries return comps from
Trawl.* That comes from Trawl's published docs plus an offline simulation
against recorded titles. **Neither is a live call.** R2 and R3 are invalid if it
is wrong.

Run these against live Trawl and record raw results and headers:

| # | Query | Terms | Isolates |
|---|---|---:|---|
| 1 | `general electric all transistor am table radio 1960s` | 8 | reproduces the observed 0-result failure |
| 2 | `general electric transistor radio` | 4 | **the hypothesis** |
| 3 | `general electric radio` | 3 | where breadth stops helping |
| 4 | #2, `date_from` removed | 4 | the 90-day window as a variable |
| 5 | #2, `site` removed | 4 | the `site` param as a variable |
| 6 | #2, `limit=40` vs `limit=240` | 4 | limit semantics |

Capture `X-RateLimit-Limit`, `-Remaining`, `-Reset` on **every** call — the real
per-second ceiling is unknown and R2's pacing needs it.

> **GATE G0.** Query #2 must return usable sold comps.
> **If it does not, stop and re-plan.** Do not start R1.

### 3.1 The labeled corpus

Tuning a matcher against one GE radio will overfit. Before R3, assemble **20
labeled items** across the categories real users scan: consumer electronics with
clean model numbers, no-model vintage goods, clothing, tools, collectibles,
books with ISBNs, and two deliberately unidentifiable items.

For each: the photo, the AI identification output, and a hand-labeled set of
which returned comps are genuinely comparable. Collect during 3.0 while making
live calls anyway. **This corpus is the acceptance instrument** (§8) — not an
afterthought.

### 3.2 Unblock the Deno tests

The recorded blocker ("Deno is not installed") is a misdiagnosis. `npx deno
check` already works. The real blocker: all **10** test files import
`https://deno.land/std@0.224.0/assert/mod.ts`, which this environment's network
policy refuses, and there is no `deno.json`, import map, or vendored copy.

1. Replace that import with `node:assert/strict` (Deno supports `node:` builtins
   natively — zero network) across all 10 files.
2. Add `supabase/functions/deno.json` with an import map so future dependencies
   are pinned and vendorable.
3. Prove `npx deno test supabase/functions/_shared/` runs **offline**.

~30 minutes, and it is the highest-leverage half-hour in the project: without it,
every subsequent release ships unverified into the exact code where all four P0
defects live.

> **GATE G0b.** Deno tests execute offline. No further release ships without this.

---

## 4. Release 1 — Instrumentation and honest failure

**Ships and deploys alone. ~1 day. Zero decision-path behavior change.**

This is the release that ends four builds of blind iteration. It is additive,
low-risk, and independently valuable even if everything after it slips.

### 4.1 Carry the audit trail through (P1-10)

`mapEbayResultToEvidence` currently maps only `reason` and `detail`, discarding
`result.audit.attemptedQueries`. Scans 66–67 carry full forensics; scan 68 under
v2 carries none.

Extend `MarketplaceEvidenceResult` (both branches) with an optional
`audit: MarketEvidenceAudit`, and persist it in
`scan_log.raw_response.decisionAudit.evidenceByMarketplace[*].audit`.

```ts
export interface MarketEvidenceAudit {
  attemptedQueries: Array<{
    query: string
    precision: CompMatchPrecision
    rawCompCount: number
    retainedCompCount: number
    excludedComps: ExcludedComp[]      // capped, see below
    excludedOverflowCount: number
    qualified: boolean
    rejectionReason: string | null
    providerLatencyMs: number
    retryCount: number
  }>
  selectedQuery: string | null
  activeSample: { sampled: number; retained: number; totalResultCount: number | null } | null
}
```

**Bound the payload.** Scan 66's audit was ~8 KB for one item; a shelf scan with
pagination and retries could balloon. Cap `excludedComps` at **25 per query** and
record the remainder as `excludedOverflowCount`. Never log provider credentials
or raw response bodies.

### 4.2 Classify failures honestly (P1-9)

Today a rate limit, an outage, a missing key, and a genuine data gap all render
one identical sentence. The server knows `PROVIDER_RATE_LIMITED`; it never says so.

Add to the response contract:

```ts
export type ScanUnavailableReason =
  | 'PROVIDER_THROTTLED'        // retryable; try again shortly
  | 'PROVIDER_QUOTA_EXHAUSTED'  // monthly allowance spent
  | 'PROVIDER_UNAVAILABLE'      // outage / malformed response
  | 'PROVIDER_NOT_CONFIGURED'   // no sold-data key
  | 'IDENTIFICATION_UNRESOLVED' // could not identify the item
  | 'NO_MARKET_EVIDENCE'        // searched, found nothing comparable
  | 'EVIDENCE_TOO_WEAK'         // found some, not enough to trust
  | 'MARKETPLACE_AUTH_FAILED'   // eBay app credentials/entitlement

// on ScanResultCore, null whenever decisionAvailable is true
unavailableReason: ScanUnavailableReason | null
```

Client maps reason → copy. **The server never sends `detail` to the client** —
detail stays in `scan_log` for us.

| Reason | User-facing copy |
|---|---|
| `PROVIDER_THROTTLED` | Market data is busy right now. Try again in a few seconds. |
| `PROVIDER_QUOTA_EXHAUSTED` | Market data is unavailable today. We're on it. |
| `PROVIDER_UNAVAILABLE` · `MARKETPLACE_AUTH_FAILED` | Market data is temporarily unavailable. Try again shortly. |
| `PROVIDER_NOT_CONFIGURED` | Market data isn't configured. Contact support. |
| `IDENTIFICATION_UNRESOLVED` | We couldn't identify this item clearly. Try a closer photo of the label. |
| `NO_MARKET_EVIDENCE` | No comparable sales found for this item. |
| `EVIDENCE_TOO_WEAK` | Not enough comparable sales to make an honest call. |

Note the copy distinguishes **"try again"** (transient, user should retry) from
**"no comps"** (real, user should judge for themselves). Today's single message
teaches users to distrust the product in both cases.

Tests: `scanResultContract.test.js` — `unavailableReason` is non-null exactly
when `decisionAvailable === false`, and null otherwise.

### 4.3 Deploy and observe

Deploy R1 alone. Record the pre-deploy version (**v93**) in `supabase/DEPLOYED.md`
as the explicit rollback target. Then run 5–10 real scans and read the audit
trail. **We will know, for the first time with certainty, what production is
actually doing** — and that reading may reorder R2/R3 priorities. Expect it to.

---

## 5. Release 2 — Fix the inputs

**~2 days. Transport, identity, queries. This is where the outage ends.**

### 5.1 Provider capabilities — one interface, three findings (P0-1, P2-15, P2-17)

The pipeline is provider-naive: query planning and comp filtering both assume a
relevance-ranked search engine. Trawl is not one. Encode it once:

```ts
export interface SoldProviderCapabilities {
  /** 'all_terms' = every query word must appear in the title (Trawl, eBay). */
  readonly queryMatching: 'all_terms' | 'relevance'
  /** Beyond this, added terms shrink recall faster than they add precision. */
  readonly maxUsefulQueryTerms: number
  readonly supportsPagination: boolean
  /** False => bestOfferAccepted is unknown, not false (P2-15). */
  readonly suppliesBestOfferFlag: boolean
}

// TrawlProvider
readonly capabilities = {
  queryMatching: 'all_terms',
  maxUsefulQueryTerms: 4,        // calibrate in R0 §3.0
  supportsPagination: true,
  suppliesBestOfferFlag: false,
} as const
```

`maxUsefulQueryTerms: 4` is the R0 spike's output, not a guess — if #2 (4 terms)
works and #3 (3 terms) is noisier, 4 is right. Adjust to whatever R0 measures.

This one interface resolves **P0-1** (the planner reads `maxUsefulQueryTerms`),
**P2-15** (best-offer honesty reads `suppliesBestOfferFlag`), and **P2-17**
(pagination reads `supportsPagination`). Three findings, one concept.

### 5.2 Transport reliability (P0-3)

**Extend `externalCall` first.** Decision B mandates a 3-second throttle budget
per scan item, and `externalCall` **cannot enforce it today**: it honors
`Retry-After` uncapped (line 116), so `Retry-After: 60` sleeps sixty seconds
inside an Edge Function.

```ts
export interface ExternalCallPolicy {
  // ...existing...
  /** Refuse a single honored Retry-After longer than this. */
  maxRetryAfterMs?: number
  /** Total sleep across all retries for this call. Exceeded => fail fast. */
  totalRetryBudgetMs?: number
}
```

Additive; defaults preserve current behavior for `ebayBrowse` and `ebayAppAuth`.

**Then move Trawl onto it:** `maxRetries: 2`, `maxRetryAfterMs: 2_000`,
`totalRetryBudgetMs: 3_000`, `isIdempotent: true` (it is a GET). Preserve the
throttle-vs-quota distinction: `Retry-After` present → `PROVIDER_THROTTLED` and
retry; absent → `PROVIDER_QUOTA_EXHAUSTED` and **do not** retry.

**Pace from the real limit, don't guess.** The current throttling is
*self-inflicted* — the scanner trips its own limit with its own cascade. Retry is
the safety net; pacing is the fix.

```ts
// providerRateLimit.ts — warm-instance token bucket, shared across
// cascade rungs AND shelf items.
export function noteRateLimitHeaders(providerId: string, h: Headers): void
export async function acquireSlot(providerId: string, maxWaitMs: number): Promise<boolean>
```

Seed from `X-RateLimit-Limit` / `-Remaining` / `-Reset`; conservative default
until the first response teaches us the real ceiling. This is warm-instance only
and resets on cold start — acceptable, and honestly documented.

**Bound shelf concurrency.** Replace `Promise.all(aiItems.map(...))` with a
worker pool of **3**. An 8-item shelf currently fires up to 40 concurrent Trawl
calls; this is the single largest source of self-throttling.

### 5.3 Identity validation and enrichment (P0-2 + the unused inputs)

**The prose problem.** Every production scan (62–68) returned prose where a model
number belongs: `"Unknown - model number not visible in photo"`,
`"P-series (exact model not confirmed - likely P800 or similar tabletop variant)"`.

```ts
// identityNormalization.ts
export interface ModelParseResult {
  model: string | null            // validated identifier, else null
  modelFamilyHint: string | null  // salvaged family signal, e.g. "p-series"
}
export function parseModelToken(raw: string | null): ModelParseResult
```

Reject when the value: contains a hedge word (`unknown`, `not visible`, `unclear`,
`n/a`, `none`, `likely`, `possibly`, `appears`, `similar`, `approximately`,
`maybe`, `cannot`, `unable`); exceeds 3 whitespace-separated tokens; or carries
sentence punctuation. Accept a compact alphanumeric token of ≤3 parts containing
at least one digit, or a short pure-alpha code.

**Salvage rather than discard.** `"P-series"` is not a model — but it is a real
family signal, and throwing it away loses information. It becomes
`modelFamilyHint`, feeding a query rung (§5.4) and a scoring signal (§6.1). This
is the case a naïve alphanumeric regex wrongly *accepts*; make it an explicit
test.

**Then stop discarding inputs we already collect.** Three high-signal identity
fields have full plumbing and are silently dropped:

| Input | Today | Unlocks |
|---|---|---|
| `variant` | `index.ts:446` hardcodes `null` | the `exact_model_variant` cascade rung — currently **dead code** |
| `gtin` / UPC | hardcoded `null` | `catalogSearchByGtin`; and **Decision A's own top tier — "exact identifier carries highest weight" — is otherwise unreachable** |
| `search_keywords` | AI is asked for *"4 specific eBay search terms for this exact item"*, returned to the client at `index.ts:523`, **never used to build a query** | ready-made short, high-signal rungs — exactly what §5.4 needs |

Extend `buildSinglePrompt` / `buildShelfPrompt` to return `variant` and `gtin`
(barcode digits if legible, else `null`), validate both with the same rigor as
`model_number`, and wire all three into `identityFromAiScan`.

**A legible barcode is the strongest identity signal a sourcing app can capture**,
and for a user photographing retail packaging it is frequently right there. We
were about to build a scoring system to compensate for weak identity while
ignoring the strongest identity signal already half-wired.

### 5.4 Provider-aware query planning (P0-1)

Extract planning out of `compSelection.ts` — it is provider concern, not
matching concern:

```ts
// queryPlanner.ts
export function planSoldCompQueries(
  identity: IdentityCandidate,
  caps: SoldProviderCapabilities,
): QueryCandidate[]
```

For an `all_terms` provider, every rung is **truncated to `maxUsefulQueryTerms`**
and each rung is strictly shorter or broader than the last:

| Rung | Query | Precision |
|---|---|---|
| 1 | `gtin` (if validated) | `exact_identifier` |
| 2 | brand + model + variant | `exact_model_variant` |
| 3 | brand + model | `exact_model` |
| 4 | each `search_keywords[i]`, truncated | `product_family` |
| 5 | brand + `modelFamilyHint` + head noun | `product_family` |
| 6 | brand + head noun | `substitute` |

De-duplicate after truncation; drop empty rungs. For the reviewed radio, rung 4
or 6 must reach something equivalent to `general electric transistor radio` — the
query proven to match 6 of 9 real comps.

**On head-noun selection:** English noun phrases put the head last
(`AM Table Radio` → `radio`), but the most *discriminative* modifier is not
always adjacent (`transistor` beats `table` here — 6/9 versus 1/9 against real
titles). Rather than freeze a linguistic heuristic I cannot yet validate, rung 4
leans on the AI's own `search_keywords`, which is already tuned for exactly this,
and the cascade tries several cheap short rungs in order. **The term-selection
heuristic is a calibrated parameter, not a frozen rule** — tune it against §3.1's
corpus and log the winning rung so it stays tunable.

Tests must assert the cascade **monotonically shortens or broadens**, never
emits >`maxUsefulQueryTerms` terms to an `all_terms` provider, and never emits
prose.

> **GATE G2.** On the §3.1 corpus, ≥80% of items produce ≥1 rung returning ≥3 raw
> comps. This gate tests *retrieval only* — matching comes next. If retrieval is
> still starved, R3 cannot help and we return to R0.

---

## 6. Release 3 — Stop discarding good evidence

**~2.5 days. The filters.**

### 6.1 Scored comparable matching (P0-4, P2-12, P2-13, P2-14)

Restructure `compSelection.ts` into explicit stages: normalize → hard-reject →
score → band → coherence-on-retained.

```ts
export interface CompMatchScore {
  score: number                                  // 0-100
  band: 'exact' | 'usable' | 'reject'
  signals: string[]                              // audit: what scored
  rejection: string | null                       // set iff hard-rejected
}
```

**Hard rejections** (short-circuit, score 0) — and *only* these:
- contamination marker (parts/repair/box/manual/accessory/lot), unless the
  scanned item is itself that type;
- a **conflicting** brand — the title names a competing brand and not ours;
- a **conflicting** model — the title carries a different model token of the same
  shape and not ours.

**Scoring** (additive):

| Signal | Points |
|---|---:|
| GTIN exact match | +45 |
| model token present (hyphen/space-insensitive) | +40 |
| brand present | +25 |
| head noun present | +15 |
| each additional descriptive token present | +10, capped +20 |
| condition conflict (only from a *parsed* condition, never free prose) | −15 |

**Bands:** ≥80 `exact` · 60–79 `usable` · <60 `reject`.

**T1 is load-bearing: a missing token scores zero. It never rejects.** Absence is
not conflict. This is the sentence that prevents rebuilding P0-2.

A property worth stating plainly, because it is a feature rather than a
limitation: **with no validated model, the ceiling is `usable` — never `exact`**
(25 + 15 + 20 = 60). That maps cleanly onto the existing tiers — `usable` →
`product_family` precision → `moderate` evidence → **LIST, never HOT**. Without a
model you genuinely cannot claim exact identity, so the GE radio should land at
LIST (or SKIP on economics), never HOT. The scoring bands reinforce the evidence
model instead of fighting it.

**Normalization** must handle: `X-700` ≡ `X700`; `1960'S` → `1960s` (today
`normalize()` produces `1960 s`, so the token can never match); word-aware
matching so `all` does not match `wall`.

Required regression tests — from §3.1's corpus plus these named cases:
`X-700`/`X700` · `1960s`/`1960'S` · `all` ∌ `wall` · the nine genuine GE titles
from scan 66 survive · wrong model rejected · wrong brand rejected · parts-only
rejected for a working-item scan · **`"knobs appear new"` in condition notes does
not turn the scan into a New-condition requirement**.

**On thresholds — and a revision to my own earlier advice.** My audit recommended
running the scorer in shadow mode before making it authoritative. On reflection
that is the wrong trade *here*. Shadow mode is correct when the current system
works and you are de-risking a replacement. **This product is down.** The cost of
a mis-tuned threshold is one wrong LIST/SKIP; the cost of another week in shadow
is a scanner that still does nothing. So: **ship it authoritative, but log the
full score, band, and every contributing signal for every comp** so thresholds
can be tuned from real traffic within days rather than guessed once. Instrument
heavily, ship, tune — not shadow, wait, ship.

### 6.2 Active evidence as proportional support (P1-5, T2)

Replace `retained.length !== sampled.length` — where one imperfect listing in
twenty voids everything — with the approved proportional rule, and **fix the
count semantics**:

```ts
export interface ActiveMarketEvidence {
  /** eBay's data.total — INFORMATIONAL competition volume. Never evidence. */
  totalActiveResultCount: number | null
  sampledCount: number
  retainedCount: number            // <- the ONLY count feeding evidence quality
  retainedListings: ActiveListingSummary[]
  askingPriceLow: number | null
  askingPriceHigh: number | null
}
```

Support qualifies when `retainedCount >= 5` **and**
`retainedCount / sampledCount >= 0.60` **and** the retained asking prices pass
the coherence guard.

This restores the two dead evidence tiers (1–2 exact sold comps + active support
→ moderate; 0 sold + strong active → moderate) and repopulates
`sellThroughRate` / `avgDaysToSell` / `demandLevel`, which have been permanently
null — silently degrading Inventory's `SourcingMeta` and the Listing Generator.

Tests, with `>=` boundaries explicit: 20/15 accept · **20/12 accept (exactly
60%)** · 20/11 reject (55%) · 20/4 reject (below the floor) · incoherent prices
reject · **evidence quality is unchanged when `totalActiveResultCount` swings
from 6 to 6,000 with an identical retained sample** (the T2 guard).

### 6.3 Preserve partial evidence (P1-7)

A provider error mid-cascade currently returns immediately, discarding partial
comps already collected *and* skipping the active-evidence path entirely.

- Preserve the best partial sold evidence across a later failure.
- Preserve the audit trail for every attempted query.
- On a later failure, still evaluate whether preserved partial + active support
  reaches `moderate`.

**On outlier rejection — specified, not delegated.** The prior plan said to
"attempt a defensible robust subset" and left the definition to the tests. That
inverts the repo's own rule (tests verify approved behavior, they don't define
it) and invites cherry-picking on the price basis behind every profit number,
ROI, and max-buy price. The rule, stated here:

- Median Absolute Deviation; drop comps beyond **3·MAD**.
- Drop **at most 20%** of the retained set.
- Require **≥3 survivors** — otherwise the set fails. No rescue.
- If survivors still fail the p20/p80 guard, the set fails.
- **Every dropped comp and its reason goes in the audit trail.**

If that rule isn't acceptable, cut the outlier clause and keep only partial
preservation — which is valuable and carries no cherry-picking risk.

### 6.4 Contain best-effort calls (P2-11, P1-8)

**P2-11:** `catalogSearch` and `resolveCategory` re-throw `EbayAppAuthError`,
which propagates out of `resolveVerifiedMarketData` and becomes
`PROVIDER_UNAVAILABLE` — **after** sold comps have already qualified. Both are
documented best-effort (Catalog is known-unentitled, returns 403). A credential
problem must not discard a qualified decision. Wrap both; return null metadata;
preserve the evidence; surface `MARKETPLACE_AUTH_FAILED` in diagnostics only.
Fail the whole path only when the failed dependency is genuinely required.

**P1-8:** `marketDataPipeline.ts:68` is `if (soldProvider) { … }` with no `else`
— silently skipping an unconfigured provider, contradicting that provider's own
documented contract. Return `PROVIDER_NOT_CONFIGURED`, preserve identification,
never present a configuration gap as a market gap.

### 6.5 Routing and shelf semantics (P2-18/D, P2-19/E)

**Routing:** remove the generic `table` rule that sends a *table radio* to
furniture/local. Route local on category and bulk suitability, not substring
accident. Mark borrowed valuations as borrowed, never upgrade borrowed evidence
strength, return the donor marketplace in the audit, and apply T3's threshold
before local may win Best Market.

**Shelf:** compute max-buy price first, then classify explicitly — `> 0` +
strong → HOT; `> 0` + moderate → LIST; `<= 0`/null with decisive evidence →
SKIP; weak/none → LIMITED EVIDENCE. Drop the synthetic at-threshold values fed
into `decide()`; express the real rule.

**A consequence worth surfacing to product:** since *any* positive max-buy price
qualifies, shelf HOT will fire on nearly every strongly-identified item. That is
correct per Decision E, but it means **the max-buy price — not the badge — is the
actionable signal on shelf scans.** The UI should lead with the number.

---

## 7. Release 4 — Hygiene

**~2 days. None of this is an outage cause. It ships after R3 is verified.**

- **P2-15 Best-Offer honesty** — Trawl hardcodes `bestOfferAccepted: false`.
  Make it `boolean | null` and gate Best-Offer exclusion on
  `caps.suppliesBestOfferFlag` (§5.1). Don't fabricate `false`.
- **P2-16 dead branch** — `evidenceQualityFromCompCount`'s `n >= 3` and fallback
  both return `'weak'`. Clean it; keep it informational only.
- **P2-17 pagination** — bounded, deduplicated, early-stop, honoring §5.2's
  pacing. **Deliberately last:** pagination *increases* request volume against
  the very rate limit R2 fixes, and it never addressed the observed failure —
  paginating a query that returns nothing returns nothing, slower. It needs R0's
  measured limit to be safe.
- **F fee profiles** — eBay stays user-configured; `NOT_CONFIGURED` marketplaces
  cannot reach financial authority; record `verifiedAt` + source; fail closed.
- **P2-20 modularization** — `claude-proxy/index.ts` at 1,786 lines vs the repo's
  500 ceiling. **Its own PR, zero behavior change in the diff.** And a caveat the
  prior plan missed: per `DEPLOYED.md`, deploys require *hand-tracing* the
  transitive dependency closure (currently 27 files) because there is no
  automated bundler step — that manual process already caused two incomplete
  deploys (v84 missing a file, v86 a full release stale). **More modules means a
  larger manual closure.** This work must include automating closure computation,
  not just splitting files.

---

## 8. Acceptance — defined before any code is written

Six manual smoke scans is a judgment call, not a measurement. A plan whose goal
is "stop returning LIMITED EVIDENCE" has a structural bias toward loosening
until things pass. So the metric is fixed now, and it is two-sided.

Against the §3.1 corpus of 20 labeled items:

| | Criterion | Target |
|---|---|---|
| **A1** | Items producing a decision | **≥ 70%** |
| **A2** | Decisions produced **without** qualifying evidence | **0%** — absolute |
| **A3** | Items correctly returning LIMITED EVIDENCE (the 2 unidentifiable) | **100%** |
| **A4** | GE radio regression: decision reached, ≥3 retained comps, `product_family` | **pass** |
| **A5** | **No HOT without `exact`-band evidence** (validated model or GTIN) | **0 violations** |

**A2 and A5 are the guardrails, and they matter more than A1.** A5 in particular
makes the failure mode we are most at risk of — quietly loosening thresholds
until the scanner says yes — *structurally impossible* rather than merely
discouraged.

Plus, per release: R0 gate G0 · R2 gate G2 · all Deno + shared + contract tests
green · `packages/shared` `tsc --noEmit` clean.

---

## 9. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Short queries still return nothing from Trawl | Low | **Fatal to plan** | Gate G0 before any code (§3.0) |
| Scoring thresholds mis-tuned | **High** | Medium | Log every score + signal; tune from traffic in days; A5 caps the downside |
| Trawl's real rate limit is lower than assumed | Medium | High | Pace from live headers, not assumption (§5.2); bounded shelf concurrency |
| Incomplete Edge Function deploy | **Medium** | High | Precedent: v84, v86. Verify closure post-deploy; automate it in R4 |
| Latency regression (scan already ~16s) | Medium | Medium | Bounded retry budget; measure p50/p95 per release; treat >20s as a regression |
| Loosening filters to hit A1 | Medium | **High** | A2 + A5 guardrails; both are absolute, neither is negotiable |
| GTIN capture proves unreliable from photos | Medium | Low | Purely additive — `null` returns today's behavior exactly |

**Rollback:** every release deploys independently with the prior `claude-proxy`
version recorded in `DEPLOYED.md` as the named rollback target. Current baseline
is **v93**.

---

## 10. Sequencing and effort

| Release | Content | Effort | Ships independently |
|---|---|---:|---|
| **R0** | Trawl spike · corpus · Deno unblock | 0.5d | n/a — no product code |
| **R1** | Audit trail · failure classification | 1.0d | **Yes — deploy first** |
| **R2** | Provider caps · transport · identity · query planner | 2.0d | Yes |
| **R3** | Comp scoring · active evidence · partial · containment · routing · shelf | 2.5d | Yes |
| **R4** | Best-offer · dead branch · pagination · fees · modularization | 2.0d | Yes (separate PRs) |

**~8 engineering days.** The outage is expected to close at the end of **R2**;
R3 is what makes it *stay* closed across the long tail of real items.

### What we are deliberately not doing

- Not adding a marketplace provider. eBay remains the only real one; that is a
  known single point of failure and out of scope here.
- Not touching Inventory, Photos, Listing Generator, Profit Compass, Profit Hub,
  billing, auth, or eBay listing/order sync — beyond keeping response contracts
  compatible.
- Not changing `calcProfit`, `calcMaxBuyPrice`, or `decide()`. They are correct.
- Not reintroducing STR / days-to-sell / demand into decision authority.
- Not rewriting the edge function beyond the scanner modules R4 names.
- Not shadow-running the scorer (§6.1 explains the reversal).

---

## 11. Open items requiring product sign-off

1. **T1** — confirm "absence is not conflict" as explicit matching policy.
2. **T2** — confirm retained-sample count (not `data.total`) is authoritative for
   evidence quality.
3. **T3** — confirm or replace local Best-Market threshold (≥25% **and** ≥$10).
4. **Latency budget** — confirm an acceptable p95 scan time. Current ~16s; the
   retry budget adds up to 3s/item worst case.
5. **A1 target** — confirm 70% decision rate is the right bar for R3 sign-off.

Items 1–3 block R3 only. **R0, R1, and R2 can start immediately** — and R1 is
where we stop guessing.
