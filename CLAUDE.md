# Flippd — Claude Instructions

> Read this file completely at the start of every session before touching any code.

---

## 🗂️ Project Overview

**Flippd** is a mobile-first reseller app for solo eBay sellers sourcing from thrift stores, estate sales, and garage sales. It is a **single-file HTML/JS app** (`Flippd_v5.html`) — no backend, no build step, runs in any mobile browser.

**Current version:** v5.1 — API key auto-injected, instructions persistent, fully functional.

**Target user:** Solo reseller, mixed-category thrift (clothing, electronics, home goods). Needs: AI-sourcing decisions, shelf scan, inventory tracking, profit math, photo enhancement, growth insights — all from a phone.

**Primary platform:** eBay. Future: Poshmark, Mercari, Facebook Marketplace.

**Current stage:** Early access working. Fully functional MVP. Manus proxy pending to remove API key hardcoding for public launch.

---

## 📁 Project Files

```
flippd/
├── Flippd_v5.html              # ✅ CANONICAL FILE — single source of truth (v5.1)
├── Flippd_Landing.html         # Marketing landing page
├── CLAUDE.md                   # This file
├── INITIAL.md                  # Feature request template
└── product-marketing-context.md  # ICP, positioning, copy rules, competitive research
```

**There is no backend, no Python, no FastAPI, no database.** Everything lives in `Flippd_v5.html`. If a future session proposes building a backend, that is a separate phase — do not mix it into the HTML app without explicit instruction.

**API key handling:** For early access (v5.0–v5.1), the API key is auto-injected in localStorage. For public launch, this will be replaced by the Manus proxy backend which issues temporary auth tokens.

---

## 🧱 Data Model (localStorage)

All data lives in `localStorage`. Never change key names without a migration shim.

### Storage Keys
| Key | Contents |
|-----|----------|
| `flippd_items_v1` | Inventory items array |
| `fif_api_key` | User's access code / API key |
| `fif_settings` | Settings object (ebayFee, pkgCost, style, etc.) |
| `fef_scan_log` | Sourcing scan history |
| `fef_growth_cache` | Cached growth/trends results |
| `fif_pnl_expenses` | Expenses array |
| `flippd_seeded` | Flag: seed data has been loaded once |
| `flippd_events` | Analytics event log (last 500) |

### Item Object
```json
{
  "id": 1713900000000,
  "sku": "ELC-00001",
  "nickname": "Sony Handycam CCD-F73",
  "category": "Electronics",
  "condition": "Good",
  "dateAcquired": "2026-04-17",
  "platform": "eBay",
  "cost": "12.00",
  "sellPrice": "45.00",
  "status": "Listed",
  "notes": "Viewfinder works, tape door stiff.",
  "photos": ["data:image/jpeg;base64,..."],
  "createdAt": "2026-04-17T14:00:00.000Z"
}
```

**Status lifecycle:** `Unlisted → Listed → Sold` (also `Ended`, `Relisted`).
**cost and sellPrice stored as strings** — always parseFloat before math.

### Settings Object
```json
{
  "ebayFee": 13,
  "pkgCost": 1.25,
  "style": "balanced",
  "minRoi": 50,
  "staledays": 30
}
```

Note: `apiKey` was removed from settings — it now lives only in `fif_api_key`.

---

## 💻 Tech Stack

- **Single file:** Vanilla JS + HTML + CSS. No frameworks, no build tools.
- **Fonts:** `Syne` (headers, numbers, bold UI) + `IBM Plex Mono` (body, labels, meta)
- **No `<form>` tags** — use `onclick` / `oninput` / `addEventListener` handlers
- **Mobile-first** — max-width 540px, sticky header + 5-tab bar

### Design Tokens
```css
--bg: #f2ece0
--surface: #fdf8ef
--card: #fffcf5
--border: #c8b89a
--border-dark: #a08060
--header: #3a2410
--text: #1e1208
--soft: #5c3d20
--muted: #8a6e50
--accent: #8B6A3E
--green: #00bb66
--green-bg: #e6fff2
--green-border: #00993d
--red: #dd0000
--yellow: #c47800
--purple: #6b3fa0
```

---

## 💰 Business Logic Rules — NON-NEGOTIABLE

### Fee Calculation
eBay fee is **always configurable** — stored in `S.ebayFee` (default 13%). **Never hardcode a fee percentage anywhere.**

```js
function calcProfit(cost, price) {
  const p = parseFloat(price) || 0;
  const c = parseFloat(cost) || 0;
  const feePct = (S && S.ebayFee != null) ? S.ebayFee : 13;
  const pkg    = (S && S.pkgCost != null) ? S.pkgCost : 1.25;
  return p - c - (p * feePct / 100) - pkg;
}
```

### Platform Fee Reference (for future cross-listing)
- **eBay:** Configurable % (default 13%) + packaging cost
- **Poshmark:** 20% flat over $15; $2.95 flat under $15
- **Mercari:** 10% + 2.9% + $0.50 payment processing
- **Facebook Marketplace:** 5% per shipment or $0.40 flat under $8

### Sourcing Decisions
- `HOT` = projected ROI > 150% AND high confidence
- `FLIP` = projected ROI > minRoi (user-configurable, default 50%)
- `PASS` = everything else
- Style modifier: `conservative` (+20% threshold), `aggressive` (-20%)

### Currency
- **Store:** strings in localStorage (e.g. "12.00")
- **Math:** always `parseFloat()` first, never do math on raw strings
- **Display:** `.toFixed(2)` for dollars

---

## 🔌 API Config

```js
const PROXY_URL = null; // Replace with Manus proxy URL when delivered
function isUnlocked() { return !!(apiKey && apiKey.length > 0); }
function getApiUrl() { return PROXY_URL || 'https://api.anthropic.com/v1/messages'; }
function getApiHeaders() {
  if (PROXY_URL) return {'Content-Type':'application/json','x-flippd-key':apiKey};
  return {'Content-Type':'application/json','x-api-key':apiKey,
          'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'};
}
```

**When Manus delivers proxy URL:** update `PROXY_URL = null` to the real URL. That is the only change needed to go from direct API to proxy.

**Current model:** `claude-sonnet-4-6` — never downgrade without explicit instruction.

---

## 📱 Tab Structure

| Tab ID | Label | Panel ID | Contents |
|--------|-------|----------|----------|
| `tab-sourcing` | SCOUT | `panel-sourcing` | Single item scan, shelf scan, scan history |
| `tab-inventory` | INVENTORY | `panel-inventory` | Item list, add/edit/delete, export/import buttons |
| `tab-photo` | PHOTOS | `panel-photo` | Photo enhancer, attach to inventory |
| `tab-growth` | TRENDS | `panel-growth` | Live eBay trends, hunt list, stale alerts |
| `tab-dashboard` | STATS | `panel-dashboard` | Overview + P&L sub-nav (expenses, monthly, mileage) |

Export (`panel-csv`) and Import (`panel-import`) panels still exist but are accessed via buttons inside INVENTORY, not top-level tabs.

---

## ✅ Feature Status

| Tab | Feature | Status |
|-----|---------|--------|
| SCOUT | AI FLIP/PASS analysis (single item) | ✅ Live |
| SCOUT | Shelf scan (whole shelf ranked) | ✅ Live |
| SCOUT | Cost input + ROI calculation | ✅ Live |
| SCOUT | Scan history | ✅ Live |
| SCOUT | Auto-injected API key | ✅ Live (v5.1) |
| SCOUT | Persistent instructions | ✅ Live (v5.1) |
| INVENTORY | Add/edit/delete items | ✅ Live |
| INVENTORY | Status + category filtering + search | ✅ Live |
| INVENTORY | CSV export to eBay | ✅ Live |
| INVENTORY | JSON backup + CSV import | ✅ Live |
| PHOTOS | Multi-photo upload + AI enhancement | ✅ Live |
| PHOTOS | Attach photos to inventory items | ✅ Live |
| TRENDS | Stale listing detection | ✅ Live |
| TRENDS | Hunt list (AI-generated buying targets) | ✅ Live |
| TRENDS | Live eBay market trends (web search) | ✅ Live |
| STATS | KPI dashboard (sales, profit, items) | ✅ Live |
| STATS | P&L: revenue, expenses, monthly breakdown | ✅ Live |
| STATS | Mileage logger (IRS rate) | ✅ Live |
| Settings | eBay fee % slider, packaging cost, sourcing style | ✅ Live |
| — | Proxy backend (Manus) | 🔲 Pending |
| — | AI Listing Generator | 🔲 Planned |
| — | Live eBay sold comps (real-time) | 🔲 Planned |
| — | Cross-listing formatter | 🔲 Planned |
| — | Max sourcing price calculator | 🔲 Planned |
| — | Shipping cost estimator | 🔲 Planned |

---

## ⚠️ Things Claude Gets Wrong — Never Do These

1. **Hardcoding fee %** — always use `S.ebayFee`, never `0.13` or `13`
2. **Math on string currency** — always `parseFloat()` first
3. **Adding `sk-ant` checks** — use `isUnlocked()` everywhere
4. **Hardcoding API URL** — always use `getApiUrl()` and `getApiHeaders()`
5. **Touching the tab bar** — 5 tabs only, structure is fixed
6. **Inventing eBay API endpoints** — verify against official docs
7. **Using `<form>` tags** — use event handlers instead
8. **Unquoted font names in JS strings** — `'IBM Plex Mono'` needs quotes inside innerHTML
9. **Em dashes or special chars in JS string literals** — use `\u2014` or plain ASCII
10. **Assuming localStorage keys** — check the key table above, never guess
11. **Skipping skills** — read ALL relevant skills before any work. Marketing skills apply to copy, UX, and feature decisions — not just marketing tasks.

---

## 🧪 Testing

Before delivering any modified version of `Flippd_v4.html`:
1. Run Node.js syntax check: `node -e "new Function(scriptContent)"` on the script block
2. Run Playwright smoke tests: unlock → tabs → inventory empty state → stats P&L
3. Confirm zero page errors and zero console errors

Use binary search on script lines to find any syntax error — don't guess.

---

## 📋 Session Protocol

**Start of every session:**
1. Read `CLAUDE.md` (this file)
2. Read `product-marketing-context.md`
3. Read every skill that could be relevant — when in doubt, read it
4. Only then touch any code or copy

**Rules:**
- Never skip skills because a task "seems like just code" — copy, UX, and business logic decisions require marketing skills too
- Never deliver a file without running the syntax check and Playwright tests
- Never hardcode fees, API keys, or URLs
- Never add tabs beyond the 5 defined above without explicit instruction
- product-marketing-context.md is the source of truth for all copy and positioning decisions
