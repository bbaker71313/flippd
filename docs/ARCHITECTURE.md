# Flippd Architecture

## High-Level Overview

```
User Phone/Browser
        ↓
Flippd_v5.html (Single-file app)
        ↓
localStorage (All data stays here)
        ↓
API Calls (Scanning only)
        ↓
Proxy Backend → Anthropic Claude API
```

## Core Design Principles

1. **Single File** — No build step, no bundling, no dependencies
2. **Browser-First** — All data stored locally on device
3. **Minimal Backend** — Proxy only passes through AI requests
4. **Mobile-Ready** — iOS camera integration, responsive design
5. **Offline-First** — Works without internet for viewing, needs internet only for scanning

## Technology Stack

### Frontend
- **Language:** Vanilla JavaScript (ES6+)
- **Styling:** Plain CSS (no Tailwind, no SCSS)
- **Storage:** Browser localStorage (no database)
- **UI Framework:** None (custom HTML)
- **Build:** None (edit HTML file directly)

### Backend
- **API Proxy:** Custom backend (Node.js, Python, whatever you want)
- **AI Model:** Claude Sonnet 4.6 (via Anthropic API)
- **Auth:** Simple access codes (can be upgraded to JWT)

### Infrastructure
- **Hosting:** Any static host (Vercel, Netlify, GitHub Pages, self-hosted)
- **Database:** None (localStorage is the database)
- **Analytics:** Google Analytics 4 (optional)
- **Email:** Third-party provider (Mailchimp, Resend, etc.)
- **Payments:** Stripe (optional, if implementing subscriptions)

## File Structure

```
Flippd_v5.html
├── <head>
│   ├── Metadata
│   ├── CSS (all inline in <style> tag)
│   └── Google Analytics script
│
├── <body>
│   ├── Welcome screen (access code)
│   ├── 5 tabs (SCOUT / INVENTORY / PHOTOS / TRENDS / STATS)
│   ├── Modals (for dialogs)
│   └── Hidden forms (file uploads, etc.)
│
└── <script>
    ├── Data layer (localStorage API)
    ├── UI layer (show/hide elements, event handlers)
    ├── API layer (fetch calls to proxy)
    ├── Business logic (fee calc, profit math, sorting)
    └── Initialization
```

**Total lines of code:** ~5,000 (single file, no imports)

## Data Flow

### Scanning Flow

```
1. User takes photo
   ↓
2. Photo uploaded to form input
   ↓
3. Show loading spinner
   ↓
4. POST photo to proxy backend
   {
     "image": "base64-encoded-photo",
     "user_fee": 13,
     "user_cost": 0
   }
   ↓
5. Proxy forwards to Claude API
   "Analyze this thrift store item. Return: name, category, estimated eBay sell price, profit after 13% fees + $1.25 packaging."
   ↓
6. Claude returns result
   {
     "item_name": "Sony Handycam",
     "sell_price": 67.00,
     "profit": 45.00,
     "decision": "FLIP"
   }
   ↓
7. Display result on screen
   ↓
8. User taps "Add to Inventory"
   ↓
9. Item saved to localStorage (flippd_items_v1)
   ↓
10. Item appears in INVENTORY tab
```

### Inventory Storage

```javascript
// localStorage['flippd_items_v1'] contains:
[
  {
    id: 1713900000000,
    sku: "ELEC-001",
    nickname: "Sony Handycam",
    category: "Electronics",
    condition: "Good",
    cost: "12.00",
    sellPrice: "67.00",
    status: "Unlisted",
    photos: ["data:image/jpeg;base64,/9j/4AAQSkZJRgABA..."],
    createdAt: "2026-04-15T14:00:00.000Z"
  },
  // More items...
]
```

### P&L Calculation

```javascript
// Revenue = sum of items marked as sold
revenue = items
  .filter(i => i.status === "Sold")
  .reduce((sum, i) => sum + parseFloat(i.sellPrice), 0)

// Expenses = logged expenses (shipping, gas, supplies)
expenses = expenseLog
  .reduce((sum, e) => sum + e.amount, 0)

// Profit = revenue - cost - eBay fees - packaging - expenses
profit = items
  .filter(i => i.status === "Sold")
  .reduce((sum, i) => {
    cost = parseFloat(i.cost)
    price = parseFloat(i.sellPrice)
    ebayFee = price * (settings.ebayFee / 100)
    profit = price - cost - ebayFee - settings.pkgCost
    return sum + profit
  }, 0) - expenses
```

## API Proxy

### Purpose
Act as a middleman between Flippd app and Anthropic API.

Why?
- User doesn't need to know about API keys
- Proxy can add rate limiting, logging, error handling
- Can add other AI models later (GPT, Gemini, etc.)

### Simple Proxy Example (Node.js)

```javascript
app.post('/scan', async (req, res) => {
  const { image, user_fee, user_cost } = req.body;
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: image }
        },
        {
          type: 'text',
          text: `Analyze this thrift store item. Return JSON with: item name, estimated eBay sell price, eBay fee (${user_fee}%), and profit after fees and $1.25 packaging.`
        }
      ]
    }]
  });
  
  res.json(response.content[0].text);
});
```

### Alternative: Direct API (No Proxy)

If you don't want to maintain a backend, Flippd can call the Anthropic API directly from the browser.

Trade-off:
- ✅ No backend to maintain
- ❌ Users see your API key (security risk)
- ❌ Can't rate-limit or log requests

## Tab Structure

### SCOUT Tab
- Single item scan (photo + optional cost input)
- Shelf scan (multiple items from one photo)
- Scan history (log of all scans)
- AI decision: FLIP, PASS, HOT

### INVENTORY Tab
- List all items (add/edit/delete)
- Filter by status (Unlisted/Listed/Sold)
- Filter by category
- Search by name
- Bulk export to eBay CSV
- Bulk import from spreadsheet

### PHOTOS Tab
- Multi-photo upload
- AI enhancement (brightness, contrast, background)
- Attach photos to inventory items
- Download enhanced versions

### TRENDS Tab
- Stale items (Listed >30 days, not sold)
- Hunt list (AI-generated buying targets)
- Live eBay market trends (web search)
- Category breakdown (what's selling)

### STATS Tab
- KPI dashboard (total items, revenue, profit)
- P&L breakdown (monthly, by category)
- Expense tracking (shipping, supplies, gas)
- Mileage logger (IRS deduction)

## Security Model

### Data at Rest
- All data stored locally in browser (user controls encryption via OS)
- Flippd has no access to stored data

### Data in Transit
- All API calls are HTTPS encrypted
- Photos sent to proxy → proxy sends to Anthropic
- Photos NOT stored (analyzed and deleted)

### Authentication
- Access code unlocked session (future: JWT tokens)
- No centralized user database (each device is independent)

### Attack Surface (Minimal)
- ❌ No database to hack (there isn't one)
- ❌ No user login system (access code is simple)
- ❌ No sensitive data sent between devices
- ✅ HTTPS protects data in transit

## Performance Characteristics

### Load Time
- **Initial load:** 1-2 seconds (just loading HTML)
- **Refresh:** Instant (browser cache)
- **Scan:** 5-10 seconds (API latency)

### Storage
- **App size:** ~250KB (one HTML file)
- **localStorage limit:** 5-10MB (plenty for 1000+ items with photos)

### Offline
- ✅ View inventory: Yes
- ✅ View P&L: Yes
- ✅ View photos: Yes
- ❌ Scan: No (needs API)
- ❌ Market trends: No (needs web search)

## Scaling Considerations

### Current Architecture Limits
- **Max items:** ~500-1000 (localStorage limit)
- **Max users per device:** 1 (no multi-user)
- **Max photos per item:** ~50 (storage limit)
- **Concurrent scans:** 1 (browser limitation)

### If You Outgrow This
- Add backend database for multi-device sync
- Implement user accounts + authentication
- Move from localStorage to IndexedDB
- Add real-time features (WebSocket)
- Scale proxy backend for high volume

## Future Architecture

**Possible evolution:**

```
Phase 1 (Current):
Browser-only ← localStorage ← Proxy API

Phase 2 (Mature):
Browser ← Backend DB ← Anthropic + eBay APIs

Phase 3 (Enterprise):
Mobile app ← Cloud backend ← Multiple AI models + integrations
```

## Dependencies

### Frontend
- **Zero npm dependencies** (intentional)
- Browser APIs only: fetch, localStorage, File API

### Backend (Proxy)
- Node.js + Express (or any framework)
- `@anthropic-ai/sdk` (Anthropic SDK)

### Third-party Services
- Anthropic API (required for scanning)
- Google Analytics (optional)
- Email provider (optional)
- Stripe (optional, if subscriptions)

## Testing

### Manual Testing
1. Open app in browser
2. Enter access code
3. Take photo of item
4. Verify result appears
5. Check data saved to localStorage
6. Reload page, verify data persists

### Automated Testing
- Playwright tests for core flows (planned)
- No unit tests (no modules to test)
- Manual QA checklist before each release

## Development Workflow

1. **Edit:** Open Flippd_v5.html in your editor
2. **Test:** Reload browser (Cmd+R)
3. **Debug:** Open DevTools (F12) console
4. **Commit:** `git commit -m "description"`
5. **Deploy:** Push to GitHub, Vercel/Netlify auto-deploys

No build step. No bundler. No package manager.

---

## Key Design Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| Single HTML file | No build step, no complexity, runs anywhere |
| localStorage | User data privacy, offline support |
| AI via proxy | Users don't manage API keys |
| No database | Simplicity, user privacy, cost ($0) |
| Vanilla JS | No dependencies, full control, minimal size |
| Responsive CSS | Mobile-first, works on all devices |
| Access codes | Simple auth for MVP, upgradeable later |

---

**For questions about architecture, open an issue or email support@flippd.com**
