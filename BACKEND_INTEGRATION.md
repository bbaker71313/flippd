# Flippd v5.3 — Backend Integration Complete

**Status:** Production Live  
**Backend:** https://flippd-backend.replit.app  
**GitHub Backend:** github.com/bbaker71313/flippd-backend  

---

## What Changed

Flippd_v5.html now connects to a **live production backend** with:
- ✅ Magic link email authentication (Resend)
- ✅ JWT session management (90-day expiry)
- ✅ Stripe subscriptions (monthly/annual)
- ✅ Server-side inventory tracking
- ✅ Scan limits by tier (enforced)
- ✅ Inventory limits by tier (enforced)
- ✅ Trial period (7 days free, auto-downgrade to Scout)

---

## Integration Details

### 1. API Configuration

```javascript
const API_BASE = 'https://flippd-backend.replit.app';

function getApiUrl() { return API_BASE + '/v1/messages'; }
function getApiHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey  // JWT from magic link
  };
}
```

### 2. Authentication Flow

**Old:** Access code → direct Anthropic API  
**New:** Email → Magic link → JWT → Backend → Anthropic API

```
User emails → Resend sends magic link → User clicks link → JWT stored in localStorage → App unlocked
```

### 3. Welcome Screen

Replaced access code input with email signup:
```html
<input type="email" id="email-input" placeholder="Enter your email"/>
<button onclick="requestMagicLink()">Send Login Link →</button>
```

### 4. New Auth Functions

```javascript
// Request magic link (sends email)
async function requestMagicLink()

// Load user tier, trial status, scan/inventory limits
async function loadUserInfo()

// Start Stripe checkout (open payment modal)
async function startCheckout(tier, interval)  // e.g., 'hustle', 'month'

// Open Stripe customer portal (manage subscription)
async function openCustomerPortal()
```

### 5. Automatic JWT Restoration

Magic links redirect back to app with JWT in URL. App auto-saves JWT and unlocks:
```javascript
window.addEventListener('DOMContentLoaded', () => {
  const jwt = localStorage.getItem('flippd_jwt');
  if (jwt) {
    apiKey = jwt;
    showApp();
    loadUserInfo();
  }
});
```

### 6. Migration from Access Codes

Old access codes automatically cleared on first visit:
```javascript
// Migration: clear old access codes (short strings without dots)
const oldKey = localStorage.getItem('fif_api_key');
if (oldKey && !oldKey.includes('.') && oldKey.length < 100) {
  localStorage.removeItem('fif_api_key');
  apiKey = '';
}
```

---

## Tier System

| Tier | Scans/mo | Items | Trial | Cost |
|------|----------|-------|-------|------|
| **Trial** | Unlimited | Unlimited | 7 days | Free |
| **Scout** | 25 | 10 | After trial | Free |
| **Hustle** | Unlimited | 500 | N/A | $19/mo ($180/yr) |
| **Stack** | Unlimited | Unlimited | N/A | $49/mo ($480/yr) |
| **Empire** | Unlimited | Unlimited | N/A | $199/mo (10 seats) |

After 7-day trial expires: Auto-downgrade to Scout (no lockout, just limits).

---

## Backend Endpoints Used

### Authentication
- `POST /auth/request-link` — Send magic link email
- `GET /auth/verify?token=...` — Verify magic link, return JWT
- `GET /auth/me` — Get current user info, tier, trial status

### AI Proxy
- `POST /v1/messages` — Forward Claude requests (with scan limits enforced)

### Subscriptions
- `POST /stripe/checkout` — Create checkout session (return URL)
- `POST /stripe/portal` — Create customer portal (manage subscription)

### Inventory (Optional - not yet implemented in app)
- `GET /inventory` — List user items
- `POST /inventory` — Add item
- `PUT /inventory/:id` — Update item
- `DELETE /inventory/:id` — Delete item

---

## What Still Uses localStorage

✅ **Inventory items** — Still in localStorage, can sync to server later  
✅ **Scan history** — Still in localStorage  
✅ **P&L expenses** — Still in localStorage  
✅ **Settings** (eBay fee %, sourcing style, etc.) — Still in localStorage  

**Strategy:** localStorage as cache, server as source of truth for auth/subscriptions. Inventory sync coming in v5.4.

---

## Testing the Integration

### 1. Email Signup
- Open app → Enter email → Click "Send Login Link"
- Check email for magic link
- Click link → App auto-unlocks
- You should be in 7-day trial

### 2. Trial Status
- After unlocking, banner shows "Trial: 7 days left"
- Date decreases daily

### 3. Tier Limits
- After 7 days: Auto-downgrade to Scout
- Scout = 25 scans/month, 10 items
- Try 26th scan → Should error
- Try 11th item → Should error

### 4. Stripe Checkout
- While logged in: `startCheckout('hustle', 'month')`
- Opens Stripe payment modal
- Test card: `4242 4242 4242 4242`, exp 12/25, CVC 123
- After payment: Tier upgrades to Hustle

### 5. Customer Portal
- `openCustomerPortal()`
- Opens Stripe dashboard for managing subscription
- Can change plan, cancel, view billing

---

## Error Handling

### 401 Unauthorized
JWT expired or invalid. User automatically logged out, page reloads.

### 403 Forbidden
User exceeded scan limit for their tier.

### 429 Rate Limited
Too many requests. Wait and retry.

### 500+ Server Error
Backend issue. User shown generic error message.

---

## Files Changed

### Updated
- `Flippd_v5.html` — Complete backend integration

### New (in documentation)
- `BACKEND_INTEGRATION.md` — This file
- `BACKEND_CHECKLIST.md` — Testing/deployment checklist

---

## Next Steps

### v5.3.1 (Soon)
- [ ] Server-side inventory sync (optional cache invalidation)
- [ ] Webhook handling for Stripe events
- [ ] Better error messages for tier limits

### v5.4 (Next phase)
- [ ] Full inventory sync to server
- [ ] Cross-device inventory access
- [ ] Auto-synced scan history

### v5.5+ (Future)
- [ ] eBay API integration
- [ ] Auto-pricing engine
- [ ] Team/multi-seat support

---

## Deployment Notes

**Current:** v5.3 deployed to GitHub  
**Backend:** Live at https://flippd-backend.replit.app  
**App:** Works offline-first, connects to backend when online  

No additional deployment needed — app is self-contained HTML file.

---

## Support

For issues:
- Backend errors: Check https://flippd-backend.replit.app status
- Auth issues: Check email spam folder for magic link
- Stripe issues: Check Stripe dashboard (https://dashboard.stripe.com)
- App issues: Open DevTools (F12) and check console for errors

