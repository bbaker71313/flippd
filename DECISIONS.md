# Flippd — Decision Log

Key product, technical, and business decisions with the reasoning behind them.
This file exists so future sessions don't relitigate settled decisions.

---

## Product Decisions

### Single HTML file, no backend
**Decision:** Flippd is a single HTML/JS file. No server, no database, no build step.
**Why:** The target user is a solo reseller at a thrift store on a phone. They can't install apps, can't manage accounts, and don't have time for setup. A single file opens instantly in any browser, works offline, and can be saved to the home screen. The backend complexity would be invisible to the user but would slow down every feature.
**Future:** A proxy backend (Manus) will be added for API key management only — it doesn't change the app architecture.
**Do not revisit unless:** There's a compelling reason that requires server-side persistence (e.g. multi-device sync, team features, subscription management).

### Access code instead of API key
**Decision:** Users enter a simple access code (e.g. FLIPPD2026) to unlock the app, not an Anthropic API key.
**Why:** The target user doesn't know what an API key is. Sending them to console.anthropic.com is a conversion killer. The original app used `sk-ant-` prefix validation which locked out every non-technical user. The access code approach is simple, friendly, and ready to swap for proxy auth.
**Future:** When the Manus proxy is wired in, the access code becomes a real auth token and users never touch Anthropic directly.

### 5 tabs: SCOUT / INVENTORY / PHOTOS / TRENDS / STATS
**Decision:** 5 tabs only. No more, no fewer.
**Why:** The original 8-tab structure (SOURCING, INVENTORY, PHOTOS, GROWTH, P&L, EXPORT, IMPORT, DASH) didn't fit on a phone screen. Export and Import are utility actions, not primary navigation. P&L belongs with the dashboard — a reseller thinks "let me check my numbers," not "let me switch to P&L mode." The 5-tab structure matches the reseller's mental model: find it (SCOUT), track it (INVENTORY), shoot it (PHOTOS), study the market (TRENDS), count the money (STATS).
**Do not add a 6th tab** without explicit justification and Britt's approval.

### eBay fee is configurable, never hardcoded
**Decision:** eBay fee percentage is always stored in `S.ebayFee` (default 13%). Never use a hardcoded number.
**Why:** eBay's fee structure varies by seller level, category, and store subscription. A reseller with an eBay Store pays different rates than a casual seller. Hardcoding 13% would be wrong for many users and would break trust in the profit calculations — which are the core value of the app.

### No fake metrics or testimonials in any copy
**Decision:** All metrics and testimonials that appeared on the landing page were written speculatively by Claude. They must not be used publicly.
**Why:** Fabricated social proof is a legal liability and a trust killer the moment a real user fact-checks it.
**What to do instead:** Only use verified claims (shelf scan is unique in the market — confirmed by competitive research), and leave placeholder slots for real testimonials once real users provide them.

### Seed data loads on first visit only
**Decision:** Demo inventory items load once on first launch (tracked by `flippd_seeded` flag). After that, the app stays empty when a user clears their data.
**Why:** Seed data is useful for first-time users to understand what the app does. But if a user clears their inventory to start fresh, re-loading seed data would be confusing and frustrating.

---

## Technical Decisions

### getApiUrl() / getApiHeaders() everywhere
**Decision:** All three API fetch calls use `getApiUrl()` and `getApiHeaders()` helper functions, never hardcoded URLs or headers.
**Why:** When the Manus proxy is delivered, updating `PROXY_URL = null` to the real URL is the only change needed. Without this pattern, proxy migration would require hunting through the file for every hardcoded URL.

### IBM Plex Mono font names must be quoted in JS strings
**Decision:** Any JS string (template literal, innerHTML, etc.) that contains a CSS font-family with a space in the name must quote the font name: `font-family:'IBM Plex Mono',monospace`.
**Why:** `font-family:IBM Plex Mono,monospace` inside a JS string causes a syntax error — the parser sees `IBM` as an unexpected identifier. This was the root cause of a full app crash in v4 development that took hours to debug.

### No em dashes or special chars in JS string literals
**Decision:** Never use `—` (em dash, U+2014), box-drawing characters (═══), or other non-ASCII chars in JavaScript string literals or comments that appear inside `<script>` tags.
**Why:** These characters caused a parser crash during v4 development. Use `\u2014` or reword to avoid the character entirely.

### requestAnimationFrame for iOS camera
**Decision:** After cloning and replacing the file input element, defer the `.click()` call with `requestAnimationFrame(() => fresh.click())`.
**Why:** iOS requires the element to be fully committed to the DOM before `.click()` fires. Without this, iOS silently drops the file picker after a few uses. This was a known bug in v2 that required this specific fix.

---

## Business Decisions

### Freemium model with usage-based gates
**Decision:** Scout (free, limited scans), Hustle ($19/mo), Stack ($49/mo), Empire ($199/mo team).
**Why:** The value metric is clear — scans per month. Free users who hit the limit have already experienced the value and have a concrete reason to upgrade. The pricing tier names use reseller language (Scout, Hustle, Stack) not generic SaaS language (Basic, Pro, Enterprise).
**Status:** Proposed model. Not yet live. Pricing has not been validated with real users.

### Competing on shelf scan + integration, not scan speed
**Decision:** Flippd's primary differentiator is shelf scan (one photo ranks everything on a shelf) and the integrated workflow (sourcing → inventory → listing → P&L). Not raw scan speed or barcode support.
**Why:** Underpriced.ai ($12/mo, 30 scans) does single-item AI scanning. ThriftMagic does book shelf scanning (slow, unreliable). No competitor does mixed-category shelf scan + full integrated workflow. That is the defensible position.

### No fake urgency, no fake scarcity
**Decision:** Do not manufacture false urgency or scarcity in copy. "First 500 users get 50% off forever" was placeholder copy — it should only be used if there is a real early access program with a real limit.
**Why:** Resellers are savvy buyers. Fake urgency erodes trust and damages the brand voice (direct, honest, reseller-to-reseller).
