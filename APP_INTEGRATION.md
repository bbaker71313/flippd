# Flippd App Integration Guide

How to update `Flippd_v5.html` to use the new backend.

---

## What Changes in the App

The app currently uses an "access code" stored in `localStorage` as `fif_api_key`. The new backend uses **JWT tokens** stored under the same key (so existing code continues to work).

The unlock flow changes from:
- ❌ User pastes a code → app unlocks

To:
- ✅ User enters email → gets magic link → clicks link → app unlocks
- ✅ JWT auto-saved, lasts 90 days
- ✅ User can subscribe via in-app upgrade button

---

## Required Changes

### 1. Update API Base URL

Find this in `Flippd_v5.html` (around line 3169):
```js
const PROXY_URL = 'https://flippd-proxy.bbaker71313.workers.dev';
```

Replace with your Replit URL:
```js
const API_BASE = 'https://flippd-backend.bbaker71313.repl.co';
const PROXY_URL = API_BASE; // backwards compat
```

### 2. Update API Headers

The proxy now expects `Authorization: Bearer <jwt>` instead of `x-flippd-key`.

Find `getApiHeaders()` and replace with:
```js
function getApiHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey
  };
}
```

### 3. Replace Welcome Screen — Email Signup

The welcome screen currently asks for an access code. Change it to ask for email.

**New welcome screen logic:**
```html
<div id="welcome-screen">
  <h2>Get started with Flippd</h2>
  <p>Enter your email — we'll send you a magic link to log in.</p>
  <input type="email" id="email-input" placeholder="you@example.com">
  <button onclick="requestMagicLink()">Send Login Link</button>
  <p class="trial-notice">7-day free trial. No credit card required.</p>
</div>
```

```js
async function requestMagicLink() {
  const email = document.getElementById('email-input').value.trim();
  if (!email || !email.includes('@')) {
    alert('Enter a valid email');
    return;
  }
  try {
    const res = await fetch(API_BASE + '/auth/request-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (data.success) {
      alert('Check your email for the login link!');
    } else {
      alert('Error: ' + (data.error || 'Unknown'));
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}
```

### 4. Auto-Unlock on Magic Link Return

When the user clicks the magic link, they're redirected back to the app with the JWT already in `localStorage`. Add this on app load:

```js
window.addEventListener('DOMContentLoaded', () => {
  const jwt = localStorage.getItem('flippd_jwt');
  if (jwt) {
    apiKey = jwt;
    localStorage.setItem('fif_api_key', jwt);
    showApp(); // your existing function to hide welcome and show main UI
  }
});
```

### 5. Show User Tier + Trial Info

Add a function to fetch and display user info:

```js
async function loadUserInfo() {
  try {
    const res = await fetch(API_BASE + '/auth/me', {
      headers: getApiHeaders()
    });
    const user = await res.json();
    
    // Update UI
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('user-tier').textContent = user.tier.toUpperCase();
    
    if (user.tier === 'trial') {
      const daysLeft = Math.ceil((new Date(user.trialEndsAt) - new Date()) / (1000*60*60*24));
      document.getElementById('trial-banner').textContent = 
        `Trial: ${daysLeft} days left of full access. Upgrade to keep all features.`;
    }
    
    return user;
  } catch (err) {
    console.error('Failed to load user:', err);
  }
}
```

### 6. Add Upgrade Buttons

Wherever you want users to upgrade:

```js
async function startCheckout(tier, interval) {
  try {
    const res = await fetch(API_BASE + '/stripe/checkout', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ tier, interval })
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url; // redirect to Stripe Checkout
    }
  } catch (err) {
    alert('Checkout failed: ' + err.message);
  }
}

// Usage:
// startCheckout('hustle', 'month')
// startCheckout('stack', 'year')
```

### 7. Add "Manage Subscription" Button

For users who already subscribed:

```js
async function openCustomerPortal() {
  try {
    const res = await fetch(API_BASE + '/stripe/portal', {
      method: 'POST',
      headers: getApiHeaders()
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  } catch (err) {
    alert('Portal failed: ' + err.message);
  }
}
```

### 8. Inventory: Switch from localStorage to Server

**Optional for now** — the existing localStorage system still works.

When you want to migrate, replace the localStorage inventory functions:

```js
async function loadInventory() {
  const res = await fetch(API_BASE + '/inventory', {
    headers: getApiHeaders()
  });
  const data = await res.json();
  return data.items || [];
}

async function saveInventoryItem(item) {
  const res = await fetch(API_BASE + '/inventory', {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify(item)
  });
  return await res.json();
}

async function deleteInventoryItem(id) {
  await fetch(API_BASE + '/inventory/' + id, {
    method: 'DELETE',
    headers: getApiHeaders()
  });
}
```

Strategy: Keep localStorage as cache, server as source of truth. On app load, fetch from server and update localStorage.

---

## Migration Path for Existing Users

If you have users with the old access code system on Cloudflare:

1. They visit the app
2. See "Please re-authenticate with your email" prompt
3. Enter email
4. Get magic link → log in → JWT saved
5. Their localStorage data stays intact (just gets a new auth token)

Add this check on app load:
```js
const oldAccessCode = localStorage.getItem('fif_api_key');
if (oldAccessCode && !oldAccessCode.includes('.')) {
  // Old format = access code, not JWT (JWTs have dots)
  // Force re-auth
  localStorage.removeItem('fif_api_key');
  showWelcomeScreen();
}
```

---

## Testing Checklist

- [ ] Email signup sends magic link
- [ ] Magic link click logs you in
- [ ] `/auth/me` returns user info
- [ ] Trial users get full access for 7 days
- [ ] After 7 days, tier auto-downgrades to scout
- [ ] Scan limits enforced (try 26th scan on scout tier)
- [ ] Inventory limits enforced (try 11th item on scout tier)
- [ ] Stripe Checkout opens and accepts payment
- [ ] Webhook updates user tier on successful payment
- [ ] Customer portal opens for active subscribers
- [ ] Canceling subscription drops user to scout

---

## Future Enhancements

- [ ] Email verification on signup (Resend)
- [ ] Password reset flow (currently magic link covers this)
- [ ] Two-factor auth
- [ ] Team seats UI for Empire tier
- [ ] Usage dashboard (scans/month chart)
- [ ] Annual upgrade discount banner
