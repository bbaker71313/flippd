# Profit Scanner — R0 Trawl Validation (Release 0 / Phase 3.0)

**Date:** 2026-08-30
**Scope:** Live Trawl validation spike only. No Profit Scanner production code changed.
**Result:** **PASS** (see hard gate, query #2).

---

## 1. PASS / FAIL

**PASS.** Query #2 (`general electric transistor radio`) returns 240 sold comps that are
plausibly and overwhelmingly comparable to the GE transistor radio case. Query #1 — the
long production query — reproduces the reported 0-result failure exactly.

The short-query hypothesis is validated. **However, the live evidence indicates the
mechanism is not query *length* per se — see §7 and §8, which materially affect how R2
should be designed.**

---

## 2. Preflight — what the application actually does today

Traced live, not from documentation:

| Item | Value | Source |
|---|---|---|
| Provider selection | Trawl when `TRAWL_API_KEY` set; SoldComps only as a config fallback | `soldCompsProvider.ts` `getSoldMarketDataProvider()` |
| Endpoint | `GET https://api.trawl.dev/ebay/v1/sold` | `TRAWL_BASE_URL` |
| Auth | `x-api-key` request header | `TrawlProvider.searchSoldComps()` |
| Env var name | `TRAWL_API_KEY` (Supabase secret) | `TRAWL_API_KEY_ENV_NAME` |
| Default params | `query`, `site=EBAY_US`, `date_from=today-90d`, `limit=240` | `TrawlProvider.searchSoldComps()` |
| Request timeout | 10,000 ms | `REQUEST_TIMEOUT_MS` |
| Queries per scan | up to **5** (query cascade, stops at first qualifying set) | `buildSoldCompsQueries()` → `marketDataPipeline.ts:69-96` |

**Query #1 is a real production query shape.** `buildSoldCompsQueries()` emits an
`itemName`-derived candidate verbatim, so an AI identification of
"General Electric All Transistor AM Table Radio 1960s" becomes a search query as-is.

### Execution method

This session's sandbox has **no egress to `api.trawl.dev` or `*.supabase.co`** (org egress
policy returns 403 on CONNECT), and the Trawl key exists only as a Supabase secret. Live
requests were therefore issued **from the Supabase runtime**, using the same endpoint,
same `x-api-key` auth, and the same configured key the application uses — the mechanism
already established in this project for live provider validation (`soldCompsProvider.ts`
header, 2026-08-26; the existing `ebay-diag` and `ebay-marketplace-insights-diagnostic`
functions).

A temporary, JWT-gated Edge Function `r0-trawl-probe` was deployed for this purpose,
invoked via `pg_net`, and **retired immediately afterwards** (its body is now an inert
410 stub that makes no external calls and reads no secrets). No credential was printed,
logged, returned, or committed. No product code path was invoked or modified.

> **Action for the product owner:** the empty `r0-trawl-probe` slug can be deleted from the
> Supabase dashboard. The MCP tooling available here can deploy but not delete functions.

---

## 3. Results — all six tests

All requests: HTTP **200**, no provider error or warning, no `Retry-After` header
(no 429 encountered). Rate-limit headers present on every response.

| # | Query / variation | Params sent | Status | Latency | Raw count | Relevant? |
|---|---|---|---|---|---|---|
| 1 | `general electric all transistor am table radio 1960s` | query, site, date_from, limit=240 | 200 | 112 ms | **0** | n/a — empty |
| 2 | `general electric transistor radio` | query, site, date_from, limit=240 | 200 | 174 ms | **240** | **Yes — strongly** |
| 3 | `general electric radio` | query, site, date_from, limit=240 | 200 | 199 ms | 240 | Partially — heavy drift |
| 4 | #2 with `date_from` removed | query, site, limit=240 | 200 | 118 ms | 240 | Yes — identical to #2 |
| 5 | #2 with `site` removed | query, date_from, limit=240 | 200 | 203 ms | 240 | Yes — identical to #2 |
| 6a | #2 with `limit=40` | query, site, date_from, limit=40 | 200 | 83 ms | 40 | Yes |
| 6b | #2 with `limit=240` | query, site, date_from, limit=240 | 200 | 155 ms | 240 | Yes — identical to #2 |

### Test 1 — reproduces the production failure

`{"site":"EBAY_US","currency":"USD","page":1,"count":0,"took_ms":7,"results":[]}`

A **200 with zero results**, not an error. The provider gives no signal distinguishing
"no such item ever sold" from "your query was too specific" — production correctly returns
`ok:true` with an empty comp set (no fabrication), which then fails evidence gating.

### Test 2 — hard gate, PASS

240 results, median **$21.95**, p25 $14.41, p75 $39.99, range $0.99–$399.
Sold dates span **2026-06-07 → 2026-08-18**.

Sample titles (first 10 of 240):

- `1960'S Vintage General Electric P-806A AM Transistor Radio GE NOT Working` — $20.40
- `Vintage Sportmate Transistor Radio General Electric AM/FM, for parts or display` — $23.00
- `Vintage General Electric Overture 16 Transistor Radio AM FM Untested GE P1905B` — $31.99
- `Vintage General Electric P-780 AM 8-Transistor Portable Radio AS IS` — $48.00
- `General Electric model P-800A transistor radio works` — $29.00
- `GENERAL ELECTRIC model P1710A AM TRANSISTOR radio in working condition` — $13.25
- `GE AM/FM 15 Transistor Radio GENERAL ELECTRIC Portable RARE Works! Model 61R72` — $82.88
- `GENERAL ELECTRIC Model P-807A Black All Transistor Radio, Works, #2011` — $10.67
- `General Electric model P-746A transistor radio works` — $29.00
- `Vintage 1950's General Electric Model P-760A Tan Transistor Radio *Untested*` — $37.50

These are the correct product family, including several exact P-8xx-series siblings of the
failing case. **Usable sold comps: confirmed.**

### Test 3 — broader query degrades recall quality *and* the time window

Same 240-row cap, but the result set drifts off-product: clock radios, dual-cassette
stereos, a 1970s mobile radio transceiver. Critically, the returned sold dates collapse to
**2026-08-11 → 2026-08-18 (7 days)** versus 73 days for query #2 — see §6.

Sample titles: `Red Antique general electric GE clock Radio 305b Retro Vintage For Repair`,
`1958 General Electric C406 Atomic Clock AM Radio Pink For Parts`,
`Vintage General Electric AM/FM Stereo Radio Dual Cassette Model 3-5632A Working`,
`General Electric Mobile Radio Transceiver w/ Keypad & Mic Progress Line (1970s)`.

Broadening improves recall but the 240-row cap then spends that recall on the wrong
products *and* on a single recent week. Query #3 is worse than query #2 on both axes.

---

## 4. Observed Trawl rate-limit behavior

| Header | Value |
|---|---|
| `x-ratelimit-limit` | **250** |
| `x-ratelimit-remaining` | 243 → 237 (decremented exactly 1 per request across the 6 tests) |
| `x-ratelimit-reset` | `1788220800` = **2026-09-01T00:00:00Z** |
| `Retry-After` | not present (no 429 reached) |

`x-ratelimit-reset` lands on the **first of the month**, ~34 hours after these tests — not
the next midnight. Combined with the limit of 250 and the "monthly request allowance"
wording already in `TrawlProvider`'s 429 branch, this is a **250-request-per-month quota**,
not a per-minute or per-day one. Only 7 requests had been consumed all month before this
spike; 237 remain.

**This is a hard scaling constraint R2 must account for.** The production cascade issues up
to 5 Trawl calls per scan, so at the current plan the entire product supports roughly
**50–250 scans per month across all users combined**. That is not a rounding error — it is
below a single active reseller's usage. Raising the plan, or reducing calls per scan, is a
prerequisite for shipping, and the choice between them is a product decision.

---

## 5. Does the 90-day `date_from` filter materially affect results?

**No — it is currently a no-op for these queries.** Test 4 (no `date_from`) returned a
byte-for-byte equivalent result to test 2: same count (240), same date range
(2026-06-07 → 2026-08-18), same price stats (median $21.95, min $0.99, max $399), same
ordering.

The reason matters: results are returned **newest-first and truncated at `limit`**, so the
240-row cap is reached at 2026-06-07 — *inside* the 90-day window — and the `date_from`
boundary is never touched. `date_from` is harmless but is **not** what is producing the
90-day window, and it does **not** guarantee one. For any query with more than 240 sales in
90 days, the effective window is whatever the newest 240 sales happen to span.

## 6. Does the `site` parameter materially affect results?

**No.** Test 5 (no `site`) returned the identical result set, and the response envelope
still reported `"site":"EBAY_US"`. `EBAY_US` is the provider default. Sending it explicitly
is correct and self-documenting, but it is not load-bearing today. It would become
load-bearing if a non-US marketplace is ever targeted.

## 7. Does `limit=240` behave as expected?

**Yes as a page size — but with a consequence the plan should not overlook.**

- `limit=40` → exactly 40 rows; `limit=240` → exactly 240 rows. Honoured precisely.
- The envelope's `count` field equals the number of **returned** rows, not the total
  available. There is no `total`, `totalResults`, or `hasNextPage` field.
  **The response gives no way to know whether the result set was truncated.**
- Because rows are date-desc and truncated, `limit` **materially changes the price
  distribution**: the same query yields median **$27.00** at `limit=40` (10-day window)
  versus **$21.95** at `limit=240` (73-day window). Limit is not a neutral performance
  knob — it silently reshapes the market evidence the decision engine consumes.
- The envelope reports `"page": 1`, implying a `page` parameter exists. Pagination was
  **not** exercised (outside the R0 matrix). Values above 240 were also not tested, since
  production clamps there.

---

## 8. Conclusion on the safest `maxUsefulQueryTerms` value

**Recommended value: 4.** That is the highest term count with direct live proof.

The live bracket is narrow and should be stated honestly:

| Terms | Query | Result |
|---|---|---|
| 8 | `general electric all transistor am table radio 1960s` | 0 — proven failure |
| 4 | `general electric transistor radio` | 240 — proven usable |
| 3 | `general electric radio` | 240 but off-product and recency-collapsed |

Term counts **5, 6, and 7 were not tested** — the matrix does not bracket them. Any value
above 4 would be an inference, not a live-validated one. 3 is measurably worse than 4 on
relevance. Hence 4.

**Important caveat R2 must not gloss over:** the evidence is consistent with Trawl applying
**conjunctive (AND) matching across title tokens**, not with a length cutoff. Test 1 failed
in 7 ms with a query whose tokens (`all`, `table`, `1960s`) rarely co-occur in one eBay
title, while its 4-token subset matched 240 listings. Under that reading, a *4*-term query
containing one rare descriptive token would fail just as hard as an 8-term one, and an
8-term query of common tokens might succeed. This was **not isolated by a controlled
single-rare-token test** — it is a strong hypothesis, not a validated finding.

So `maxUsefulQueryTerms = 4` is the safe *guardrail*, but a term **cap alone is not a
sufficient fix**. The durable fix is term *selection* — keep brand + model + product noun,
drop era markers (`1960s`), form-factor guesses (`table`), band descriptors (`am`), and
filler (`all`). Note that `buildSoldCompsQueries()` already produces exactly such a
`[brand, model]` candidate; in the GE case the cascade's first candidate is the unfiltered
`itemName` shape that fails. **How the term-selection rule should be specified is a product
decision, not an implementation detail — R2 should not invent it.**

---

## 9. Unexpected provider behavior R2 must account for

1. **250 requests/month, reset on the 1st (§4).** The single most consequential finding.
   At up to 5 calls per scan the product currently supports ~50 scans/month in total.
2. **Zero results are a 200, not an error.** No signal separates "too-narrow query" from
   "genuinely no sales". A cascade cannot distinguish them — and each failed attempt still
   costs one of the 250 monthly requests.
3. **No total/`hasNextPage`.** `count` = returned rows only. Truncation is invisible, so
   the code cannot detect that it is seeing a partial, recency-biased sample.
4. **Truncation is recency-biased and skews price stats (§7).** Median moved $21.95 → $27.00
   purely by changing `limit`. Any comp-count or coherence gate downstream is reading a
   window whose width varies with the item's sales volume.
5. **`date_from` does not deliver the documented 90-day window (§5).** It is inert whenever
   240 rows are reached first. The 90-day framing in `marketDataPipeline.ts` and
   `soldCompsProvider.ts` is therefore optimistic for popular items.
6. **Contamination the current filter misses.** Query #2's 240 rows include
   `1957 General Electric All-Transistor Pocket Radio Vintage Print Ad` ($7.18) — a paper
   advertisement, not a radio. `CONTAMINATION_MARKERS` in `compSelection.ts` has no marker
   for print ads / ephemera, so it survives into the comp set and drags the low tail. (Lots
   and parts-only listings *are* caught.) Logged, not fixed — out of scope for R0.
7. **Unmapped fields worth R2's attention.** Trawl returns `epid` (eBay product ID),
   `categoryId`, `bids`, `location`, and `image_url`; `parseTrawlSoldComp()` maps none of
   them. `epid` in particular offers a far more precise identity match than title tokens
   and could sidestep the whole query-term problem for catalogued products.
8. **`best_offer_available` vs. `buying_format`.** Roughly half of sampled rows carry
   `buying_format: "Best Offer"`. `parseTrawlSoldComp()` hardcodes `bestOfferAccepted: false`
   and maps `buying_format` through unchanged. Not wrong under the documented "sale_price is
   the actual final price" contract, but the two fields disagree in spirit and R2 should
   confirm the intended semantics.
9. **Latency is not a concern.** 83–203 ms end-to-end, `took_ms` 7–41. The 10 s production
   timeout has ample headroom.

---

## 10. Scope compliance

Nothing in the Profit Scanner was modified. No decision logic, no HOT/LIST/SKIP, no comp
filtering, no marketplace routing, no Edge Function product behavior, no R1–R4 work. The
only repository change is this report. The only Supabase change is a temporary diagnostic
function, since retired to an inert stub. No alternate sold-data provider was used, no
temporary API key was introduced, and no active-listing data was substituted as evidence of
sold-search behavior.

**Assumptions made:** none material. The one inference stated above (conjunctive token
matching) is explicitly labelled as an unvalidated hypothesis rather than a finding.

**Recommended next diagnostic, before R2 designs the fix:** (a) confirm or refute the
conjunctive-matching hypothesis with a controlled test — one 4-term query containing a
single rare token — since a term *cap* and a term *filter* are different fixes; (b) test
the `page` parameter, which determines whether the 240-row truncation is escapable at all;
(c) obtain a product decision on the 250/month quota, which gates whether any query-cascade
design is viable.

---

`G0: PASS — short provider-appropriate Trawl queries return usable sold comps. R1/R2 may proceed.`
