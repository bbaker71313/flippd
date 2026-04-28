# Flippd Architecture

High-level overview of how Flippd is built, how it works, and where code lives.

---

## System Overview

```
┌─────────────────────┐
│  Flippd Frontend    │
│  (Flippd_v5.html)   │
│  • Single HTML file │
│  • Runs on device   │
│  • localStorage DB  │
└──────────┬──────────┘
           │ HTTPS
           ↓
┌─────────────────────────────────────┐
│   Flippd Backend (Replit)           │
│   • Node.js / Express               │
│   • Magic link auth (Resend)        │
│   • JWT sessions                    │
│   • Stripe webhooks                 │
│   • Anthropic proxy                 │
└──────────┬──────────────────────────┘
           │
    ┌──────┴──────┬──────────┬─────────┐
    ↓             ↓          ↓         ↓
 Anthropic    Stripe      Resend   Replit DB
  (Claude)   (Payment)   (Email)  (Storage)
```

---

## Frontend (`Flippd_v5.html`)

**Type:** Single HTML/JS/CSS file  
**Size:** ~9,000 lines  
**Storage:** `localStorage` (client-side only)

### Folder Structure
Not applicable — it's one file. But logically organized by feature:

1. **Config** (lines 1-50)
   - `PROXY_URL` — backend endpoint (or null for local dev)
   - `ACCESS_CODE` — placeholder (replaced by proxy auth)

2. **Helper Functions** (lines 51-200)
   - `getApiUrl()` / `getApiHeaders()` — centralized API calls
   - `trackEvent()` — analytics
   - Currency formatting, date utils

3. **UI Components** (lines 201-5000)
   - Tab navigation (SCOUT / INVENTORY / PHOTOS / TRENDS / STATS)
   - Settings panel
   - Scan input/output
   - Inventory list/add/edit/delete
   - P&L dashboard

4. **State Management** (lines 5001-6000)
   - `S` object — current settings (fee %, packaging cost, thresholds)
   - `loadSettings()` / `saveSettings()` — localStorage sync
   - `items` array — inventory from localStorage

5. **API Calls** (lines 6001-6500)
   - `/v1/messages` (proxy) — AI scans
   - `POST /stripe/checkout` — upgrade prompt
   - `GET /auth/me` — user tier info

6. **Event Handlers** (lines 6501-9000)
   - Photo capture, file input, camera
   - Form submission, settings change
   - Tab switching, data export

### Key Data Structures

**Item (inventory)**
```javascript
{
  id: 1713900000000,           // timestamp
  sku: "ELEC-001",
  nickname: "Sony Handycam",
  category: "Electronics",
  condition: "Good",
  cost: "12.00",               // string, cents stored as $xx.xx
  sellPrice: "45.00",
  status: "Listed",            // "Unlisted" | "Listed" | "Sold"
  notes: "Works great",
  photos: ["data:image/jpeg..."],
  dateAcquired: "2025-04-15",
  createdAt: "2025-04-15T14:00:00Z"
}
```

**Settings**
```javascript
{
  ebayFee: 13,                 // % (default 13)
  pkgCost: 1.25,              // $ (default $1.25)
  minProfit: 15,              // $ min profit to flip
  targetRoi: 200,             // %
  maxDaysToSell: 60,          // days
  style: "balanced"           // "conservative" | "balanced" | "aggressive"
}
```

**Scan Log Entry**
```javascript
{
  ts: "2025-04-15T14:00:00Z",
  item: "Xbox 360",
  dec: "BUY",                 // "FLIP" | "HOT" | "PASS"
  roi: 180,                   // %
  cost: 8.00,
  bought: true
}
```

---

## Backend (Replit / Node.js)

**Type:** Express.js + Node.js  
**Deployment:** Replit  
**Database:** Replit DB (key-value)

### What It Does

1. **Authentication**
   - Magic link auth via Resend
   - JWT token generation (90-day expiry)
   - User creation on first signup

2. **Proxy**
   - Routes requests to Anthropic API
   - Enforces scan limits per tier
   - Masks API key (user never sees it)

3. **Subscriptions**
   - Stripe checkout flow
   - Webhook handlers (charge succeeded, subscription created, etc.)
   - Tier enforcement (Scout: 25 scans/mo, Hustle: unlimited)

4. **Inventory Sync** (future)
   - Store user inventory server-side
   - Multi-device sync
   - Backup restore

### API Endpoints

```
POST   /auth/request-link        → send magic link email
GET    /auth/verify?token=...    → magic link callback
GET    /auth/me                  → current user + tier + limits

POST   /v1/messages              → proxy to Anthropic
GET    /v1/models                → list available models

POST   /stripe/checkout          → create checkout session
POST   /stripe/portal            → customer billing portal
POST   /stripe/webhook           → Stripe event handler

GET    /inventory                → list user items
POST   /inventory                → create item
PUT    /inventory/:id            → update item
DELETE /inventory/:id            → delete item
```

### Database Schema (Replit DB)

| Key | Value | TTL |
|-----|-------|-----|
| `user:<userId>` | User object | permanent |
| `email:<email>` | userId (lookup) | permanent |
| `magic:<token>` | Magic link payload | 15 min |
| `inventory:<userId>` | Array of items | permanent |
| `subscription:<userId>` | Stripe subscription state | permanent |

---

## Feature Dependencies

### Fee Calculation

**Touched by:**
- Frontend: SCOUT tab (profit math on scan results)
- Frontend: STATS tab (P&L dashboard)
- Backend: None (calculation is deterministic)

**Rule:** eBay fee is always `S.ebayFee` (configurable, default 13%). Never hardcode.

```javascript
const ebayFee = sellPrice * (ebayFeePercent / 100);
const pkgCost = 125; // cents
const totalFees = ebayFee + pkgCost;
const profit = sellPrice - cost - totalFees;
```

### Proxy Backend

**Current state:** `PROXY_URL = null` (expects local backend)  
**Future state:** `PROXY_URL = "https://flippd-backend.repl.co"`

One-line change to swap from local to cloud. No other code changes needed.

### Photo Handling

**iOS camera:**
- Use `<input type="file" accept="image/*" capture="environment">`
- On iOS, opens camera directly
- After capture, clone input (prevents double-fire)
- Use `requestAnimationFrame` to defer `.click()`

**Landscape rotation:**
- Listen to `orientationchange` and `screen.orientation` events
- Store preview in `sessionStorage`
- Restore on rotation

### Analytics

**Tracked events:**
- `scan_started`, `scan_completed`
- `item_added`, `item_sold`, `item_deleted`
- `tab_viewed`
- `upgrade_clicked`
- `export_clicked`

**Storage:** `flippd_events` array (last 500 events)  
**Future:** Pipe to Segment or Mixpanel

---

## Data Flow Examples

### Single Item Scan
```
1. User uploads photo in SCOUT tab
2. Frontend: Base64 encode image
3. Frontend: POST /v1/messages (proxy)
4. Backend: Proxy request to Anthropic Claude
5. Claude: Analyze item, return FLIP/PASS + estimated prices
6. Backend: Check scan limit (tier gated)
7. Frontend: Display result with profit math
8. User: [optional] Tap "Add to Inventory"
9. Frontend: Save item to localStorage (+ item.status = "Unlisted")
10. Frontend: trackEvent('item_added')
```

### Shelf Scan (10 items on one photo)
```
1. User uploads wide photo of shelf in SCOUT tab
2. Frontend: Base64 encode image
3. Frontend: POST /v1/messages with custom prompt:
   "Identify every visible item on this shelf.
    For each: name, category, condition.
    Return JSON array."
4. Claude: Analyzes shelf, returns array of ~10 items
5. Frontend: For each item, do individual profit calculation
6. Frontend: Rank by profit (HOT / FLIP / PASS)
7. Frontend: Display ranked list
8. User: Tap items to add to inventory individually
```

### Mark Item as Sold
```
1. User taps item in INVENTORY tab
2. User sets sellPrice and taps "Mark Sold"
3. Frontend: Update item.status = "Sold"
4. Frontend: Calculate profit = sellPrice - cost - fees
5. Frontend: Add to STATS P&L dashboard
6. Frontend: trackEvent('item_sold', {profit, roi})
7. Frontend: Update inventory (remove from "Listed")
```

---

## Key Files & Responsibilities

| File | Owner | Purpose |
|------|-------|---------|
| `Flippd_v5.html` | Britt | Frontend UI, core app logic |
| `index.js` (backend) | Backend dev | Express routes, auth, proxy |
| `.env` | DevOps | Secrets (API keys, stripe keys) |
| `CLAUDE.md` | Product | Development guidelines |
| `ROADMAP.md` | Product | Feature priorities |
| `DECISIONS.md` | Team | Architecture decisions |

---

## Performance Notes

**Frontend:**
- Single page load: ~2 seconds on 4G
- Scan request: ~3-5 seconds (Claude API latency)
- Photo upload: ~1-2 seconds (image encode + network)
- localStorage limit: ~10 MB (supports ~5,000 items at ~2 KB each)

**Backend:**
- Magic link: ~1 second (Resend API)
- JWT validation: <100 ms
- Stripe webhook: <500 ms

---

## Security Considerations

1. **API Keys**
   - Anthropic key stored on backend only (never in frontend JS)
   - Stripe key stored in .env (test/live mode separated)

2. **Auth**
   - Magic link tokens expire after 15 minutes
   - JWT tokens expire after 90 days
   - No password required (simpler, more secure for this use case)

3. **Data**
   - User inventory stored encrypted in Replit DB
   - localStorage on device is unencrypted (user device responsibility)

4. **Rate Limiting**
   - Scan limit enforced server-side (cannot bypass with frontend hacks)
   - Auth endpoints rate-limited to prevent brute force

---

## Scaling Notes

**Current:** Works for hundreds of users  
**At 10k users:** May need to migrate from Replit DB to PostgreSQL  
**At 100k users:** Consider CDN for frontend, separate API gateway

---

## Future Architecture

When Phase 4 (team features) launches:
- Separate auth service (OAuth support)
- PostgreSQL for multi-user data
- GraphQL API for better mobile efficiency
- WebSocket for real-time inventory sync

But for Phase 2-3, this architecture is sufficient and fast to iterate.
