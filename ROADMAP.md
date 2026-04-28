# Flippd — Product Roadmap

Priorities, dependencies, and the "why" behind what gets built next.
Updated as decisions are made. Not a commitment — a direction.

---

## Current State (v4.0)

The app works. Core loop is complete: scan → decide → add to inventory → track P&L.
The proxy backend is the only thing standing between the current build and a real public launch.

**What's live:**
- AI FLIP/PASS sourcing (single item + shelf scan)
- Inventory tracking with add/edit/delete
- Photo enhancer
- Market trends + hunt list + stale alerts
- P&L tracker (revenue, expenses, mileage)
- CSV export to eBay Seller Hub
- JSON backup + CSV import
- Access code unlock (proxy-ready)
- Analytics event tracking (local)

---

## Phase 1 — Launch Ready (Next 2–4 weeks)

Everything here must be done before sharing with any external user.

### 1.1 Proxy Backend (BLOCKING)
**What:** Cloudflare Worker or Vercel function that sits between Flippd and Anthropic API.
**Why:** Without this, every user needs an Anthropic API key. That's a technical barrier that kills adoption for the exact audience Flippd is built for.
**Owner:** Manus
**Status:** In progress — 2pm reminder set for April 26
**How to wire in:** Update `PROXY_URL = null` to the real URL in Flippd_v4.html. One line change.

### 1.2 Real Access Code System
**What:** Replace the current single-code unlock with a system where Britt can give out unique codes to early access users and track who has access.
**Why:** Right now the access code is essentially a single shared password. For early access, you want to be able to revoke access, track users, and eventually tie codes to paid accounts.
**Depends on:** Proxy backend (1.1)
**Options:** Simple: a list of valid codes in the proxy worker. Proper: a lightweight user table in a database.

### 1.3 Landing Page — Honest Version
**What:** Rewrite Flippd_Landing.html with only verified claims. Remove all placeholder metrics and fabricated testimonials. Add email capture.
**Why:** The current landing page has fake testimonials and made-up stats. It cannot be used publicly. The rewrite should be honest about where Flippd is: early access, real tool, real differentiators (shelf scan is genuinely unique), real features.
**Key message:** "Scan the shelf. Know what to buy." — single item or whole shelf, profit math after fees, integrated tracking.
**Email capture:** Simple form that goes to an email list. This is the owned channel. Everything else — social, Product Hunt, reseller communities — should funnel here.

---

## Phase 2 — Early Access (Weeks 4–8)

Share with real resellers. Learn fast.

### 2.1 AI Listing Generator
**What:** Takes an inventory item (photos + details) and writes a ready-to-post eBay title, description, and condition note.
**Why:** "I used to spend 20 minutes writing one listing" is the second most common complaint after bad sourcing decisions. Listing generation is the next highest-value feature after the scan.
**Lives in:** INVENTORY tab — button on each item: "✍️ Write My Listing"
**Output:** Copyable text — title (80 chars, eBay-optimized), description, condition note. Not auto-posted.

### 2.2 Shareable Scan Result Card
**What:** When a scan returns a FLIP or HOT result, users can share a card (screenshot-ready) showing item, estimated profit, and the Flippd branding.
**Why:** Resellers love showing their finds. This is an organic growth loop — every shared card is a Flippd advertisement. The "powered by" effect.
**Lives in:** SCOUT tab — "Share This Find" button on results screen.

### 2.3 Real Testimonials
**What:** Collect real quotes from early access users. Replace placeholder testimonials on landing page.
**Why:** Social proof is the most powerful conversion lever. One real quote from a real reseller beats any copy we write.
**How:** Ask active users directly. Offer a discount or feature unlock in exchange.

### 2.4 Subscription Infrastructure
**What:** Wire up Stripe for paid plans. Tie access codes to subscription status.
**Why:** Can't charge anyone until this exists. The freemium model (Scout free / Hustle $19 / Stack $49) needs a payment system.
**Gate logic:** Scan count tracked in proxy backend. Free tier: 25 scans/month. Hit limit → upgrade prompt.
**Depends on:** Proxy backend (1.1), access code system (1.2)

---

## Phase 3 — Growth (Weeks 8–16)

Once there are paying users and the feedback loop is running.

### 3.1 Live eBay Sold Comps
**What:** Pull real eBay sold listings data for the items being scanned. Currently the AI estimates sold prices from training data — real comps would be more accurate and more trustworthy.
**Why:** "Shows me what it actually sold for, not what people are asking" is how resellers describe a good sourcing tool. Real sold comps are the gold standard.
**How:** eBay Browse API (buy/browse) for sold listings. Requires eBay developer account and OAuth.
**Depends on:** Proxy backend (for API key management)

### 3.2 Max Sourcing Price Calculator
**What:** Given a target profit and expected sell price, calculate the maximum you should pay for an item at the thrift store.
**Why:** Resellers do this math in their head or on paper. Building it in is a small feature with high daily utility.
**Lives in:** SCOUT tab — input field below cost input.
**Formula:** maxCost = sellPrice × (1 - ebayFee/100) - pkgCost - targetProfit

### 3.3 Shipping Cost Estimator
**What:** Based on item dimensions/weight (or category estimate), show estimated shipping cost in the profit calculation.
**Why:** Shipping is a real cost that affects flip decisions, especially for heavy or bulky items. Electronics and home goods category resellers get burned by unexpected shipping costs regularly.
**Lives in:** Settings (default shipping estimate by category) + SCOUT scan results.

### 3.4 Cross-Listing Formatter
**What:** Take an inventory item and format it for Poshmark, Mercari, or Facebook Marketplace — adjusted copy, platform-specific pricing (accounting for different fee structures), formatted description.
**Why:** Most active resellers cross-list. Doing it manually means rewriting every listing 3-4 times.
**Platform fee rules:**
- Poshmark: 20% flat over $15; $2.95 flat under $15
- Mercari: 10% + 2.9% + $0.50
- Facebook Marketplace: 5% or $0.40 flat under $8

### 3.5 Bulk CSV Export Improvements
**What:** Current CSV export works but is basic. Improvements: export all items (not just Unlisted), schedule reminders, better eBay field mapping.
**Why:** Power users list daily and need reliable bulk export.

---

## Phase 4 — Scale (Month 4+)

Only relevant once Phase 3 is solid and there's meaningful revenue.

### 4.1 Team Features (Empire tier)
**What:** Shared inventory, multiple user seats, manager dashboard.
**Why:** Some reselling operations have 2-3 people. The Empire tier at $199/mo targets small teams.
**Depends on:** Real user auth system, backend database.

### 4.2 eBay API Sync
**What:** Pull sold orders directly from eBay into Flippd P&L automatically. No manual "mark as sold."
**Why:** The biggest friction in the current P&L workflow is manually marking items sold. eBay sends webhook notifications when items sell — Flippd should listen and update automatically.
**Depends on:** eBay OAuth, proxy backend, database.

### 4.3 Auto-Pricing Engine
**What:** Rule-based price reduction logic — lower a listing price by X% every N days if it hasn't sold, with a configurable floor.
**Why:** Stale inventory is money sitting on the floor. Automated price drops keep items moving without manual work.
**Depends on:** eBay API sync (4.2)

---

## What We Are NOT Building (and Why)

**Amazon FBA integration** — Wrong audience. FBA sellers use Jungle Scout and Helium 10. Flippd is for thrift resellers.

**Barcode scanner** — eBay's own app already does this for free. Only valuable items at a thrift store rarely have barcodes anyway.

**Social media scheduler** — Out of scope. Resellers who need this use dedicated tools.

**Desktop app** — The value is at the thrift store, on a phone. Desktop doesn't serve the use case.

**Chat/messaging features** — No, this is a business tool, not a community.

---

## North Star Metric

**Scans completed per active user per week.**

This is the number that correlates most strongly with retention and paid conversion. A user who scans 5+ items per week is an active sourcing reseller. That user will pay. A user who opens the app once and never scans is a churned user before they've even started.

Everything in the roadmap should be evaluated against: "does this increase weekly scans per active user?"
