# Flippd App Integration Guide — v3.0.0

**Backend:** https://flippd-backend.replit.app  
**Auth:** Username + password with email verification  
**Token:** JWT, stored in `localStorage`, valid 90 days

---

## 1. Constants

```js
const API_BASE = 'https://flippd-backend.replit.app';

function getToken() {
  return localStorage.getItem('flippd_token');
}

function getApiHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + getToken()
  };
}

function isLoggedIn() {
  return !!getToken();
}
```

---

## 2. Registration Flow

The landing page email capture form should call `POST /auth/register` — NOT the old `/auth/request-link`.

### Landing page (email-only capture)

If your landing page only collects an email address (no password), add a `POST /auth/request-link` compatibility alias — see the backend note below. Or redirect the user to the full sign-up form in the app.

### Full sign-up form (name + username + email + password)

```js
async function register({ name, username, email, password }) {
  const res = await fetch(API_BASE + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, username, email, password })
  });
  const data = await res.json();

  if (res.ok) {
    // Show "check your email" screen — do NOT log in yet
    showCheckEmailScreen();
    return;
  }

  // Handle field-specific errors
  if (data.field === 'username') {
    showFieldError('username', data.error);
  } else if (data.field === 'email') {
    showFieldError('email', data.error);
  } else {
    showFormError(data.error || 'Registration failed');
  }
}
```

**Required fields:**

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Required. Displayed in dashboard greeting |
| `username` | string | Required. Letters, numbers, underscores only |
| `email` | string | Required. Must be valid email |
| `password` | string | Required. Min 6 characters |

---

## 3. Handle Verification Redirect

When the user clicks the email link, they land on:
`https://flippd.tech/Flippd_v5.html?verified=true`

Handle this on app load:

```js
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);

  if (params.get('verified') === 'true') {
    showLoginScreen('Email verified! You can now log in.');
    history.replaceState({}, '', window.location.pathname);
    return;
  }

  if (params.get('verified') === 'already') {
    showLoginScreen('Already verified — just log in.');
    history.replaceState({}, '', window.location.pathname);
    return;
  }

  if (params.get('error') === 'token_expired') {
    showSignupScreen('Verification link expired. Please sign up again.');
    history.replaceState({}, '', window.location.pathname);
    return;
  }

  // Auto-login if token exists
  if (isLoggedIn()) {
    loadUserAndShowApp();
    return;
  }

  showLoginScreen();
});
```

---

## 4. Login

```js
async function login(usernameOrEmail, password) {
  const res = await fetch(API_BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: usernameOrEmail, password })
  });
  const data = await res.json();

  if (res.ok) {
    localStorage.setItem('flippd_token', data.token);
    localStorage.setItem('flippd_user', JSON.stringify(data.user));
    showApp(data.user);
    return;
  }

  if (res.status === 403 && data.error === 'email_not_verified') {
    showError('Please verify your email first. Check your inbox.');
    return;
  }

  showError(data.error || 'Login failed');
}
```

> The `username` field accepts either a username or an email address.

---

## 5. Load User Profile (`/auth/me`)

Call this on app load to get fresh user data (tier, scan count, etc.):

```js
async function loadUserProfile() {
  const res = await fetch(API_BASE + '/auth/me', {
    headers: getApiHeaders()
  });

  if (res.status === 401) {
    localStorage.removeItem('flippd_token');
    showLoginScreen();
    return null;
  }

  const user = await res.json();

  // Dashboard greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greeting').textContent = `${greeting}, ${user.name} \uD83D\uDC4B`;

  // Tier badge
  document.getElementById('tier-badge').textContent = user.tier.toUpperCase();

  // Trial banner
  if (user.tier === 'trial' && user.trialEndsAt) {
    const daysLeft = Math.ceil((new Date(user.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft > 0) {
      document.getElementById('trial-banner').textContent =
        `Trial: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left. Upgrade to keep full access.`;
    }
  }

  return user;
}
```

---

## 6. Logout

```js
function logout() {
  localStorage.removeItem('flippd_token');
  localStorage.removeItem('flippd_user');
  showLoginScreen();
}
```

---

## 7. AI Proxy (`/v1/messages`)

```js
async function callAI(messages, systemPrompt) {
  const res = await fetch(API_BASE + '/v1/messages', {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages
    })
  });

  if (res.status === 429) {
    const data = await res.json();
    if (data.error === 'scan_limit_reached') {
      showUpgradePrompt(data.message);
      return null;
    }
  }

  if (!res.ok) throw new Error('AI request failed');
  return await res.json();
}
```

---

## 8. Stripe Checkout

```js
async function startCheckout(tier, interval) {
  const res = await fetch(API_BASE + '/stripe/checkout', {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify({ tier, interval })
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
}
// startCheckout('hustle', 'month')
// startCheckout('stack', 'year')
// startCheckout('empire', 'month')
```

---

## 9. Stripe Customer Portal

```js
async function openCustomerPortal() {
  const res = await fetch(API_BASE + '/stripe/portal', {
    method: 'POST',
    headers: getApiHeaders()
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
}
```

---

## 10. Inventory

```js
async function loadInventory() {
  const res = await fetch(API_BASE + '/inventory', { headers: getApiHeaders() });
  const data = await res.json();
  return data.items || [];
}

async function addInventoryItem(item) {
  const res = await fetch(API_BASE + '/inventory', {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify(item)
  });
  if (res.status === 403) {
    const data = await res.json();
    if (data.error === 'inventory_limit_reached') {
      showUpgradePrompt(data.message);
      return null;
    }
  }
  return await res.json();
}

async function updateInventoryItem(id, item) {
  const res = await fetch(API_BASE + '/inventory/' + id, {
    method: 'PUT',
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

---

## 11. Error Handling Reference

| HTTP Status | Error | Action |
|-------------|-------|--------|
| 400 | Validation error | Show `data.error` to user |
| 401 | Token missing/invalid/expired | Clear token, redirect to login |
| 403 `email_not_verified` | Not verified | Show "check inbox" message |
| 403 `inventory_limit_reached` | Tier limit | Show upgrade prompt |
| 409 `field: "username"` | Username taken | Highlight username field |
| 409 `field: "email"` | Email taken | Highlight email field |
| 429 `scan_limit_reached` | Scan quota | Show upgrade prompt |
| 500 | Server error | Show generic retry message |

---

## 12. localStorage Keys

| Key | Value | Set When |
|-----|-------|----------|
| `flippd_token` | JWT string | On login |
| `flippd_user` | JSON user object | On login |

---

## Testing Checklist

- [ ] Register with all 4 fields → verification email sent
- [ ] Try login before verifying → `email_not_verified` error shown
- [ ] Click verification link → redirected with `?verified=true`
- [ ] Login → JWT returned, dashboard greeting shows name
- [ ] `/auth/me` returns `name`, `tier`, `trialEndsAt`
- [ ] Duplicate username → `field: "username"` error shown inline
- [ ] Duplicate email → `field: "email"` error shown inline
- [ ] Wrong password → `401 Incorrect username or password`
- [ ] Login with email instead of username → works
- [ ] Stripe checkout → redirects to Stripe
- [ ] Stripe portal → opens for active subscriber
- [ ] AI scan → increments `scansThisMonth`
- [ ] Inventory add/edit/delete → persists in Supabase
