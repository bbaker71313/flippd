# FLIPPD — Analytics Setup Guide (GA4)

**Goal:** Track landing page performance, email conversions, A/B test results, and paid ads ROI.

---

## STEP 1: CREATE GA4 PROPERTY

### In Google Analytics:

1. Go to: https://analytics.google.com
2. Click **"Create"** (top left)
3. Click **"Create account"**
4. Account name: `Flippd`
5. Check all boxes (you'll adjust later)
6. Click **"Next"**

### Property Setup:

1. Property name: `Flippd Landing Pages`
2. Reporting timezone: Your timezone (e.g., PT)
3. Currency: USD
4. Click **"Next"**

### Business Setup (Optional but recommended):

1. Industry: Software/SaaS
2. Business size: Small
3. Goals: Lead generation, traffic, conversions
4. Click **"Create"**

### Web Data Stream:

1. Website URL: `https://flippd.com` (or your actual domain)
2. Stream name: `Landing Pages`
3. Click **"Create stream"**

### Get Your Measurement ID:

1. You'll see a **Measurement ID** starting with `G-`
2. Copy this ID (example: `G-XXXXXXXXXX`)
3. **Save this ID — you'll need it for every page**

---

## STEP 2: ADD GA4 TAG TO LANDING PAGES

### Update Flippd_Landing_Honest.html:

In the `<head>` section, add:

```html
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX', {
    'anonymize_ip': true,
    'allow_google_signals': false
  });
</script>
```

**Replace `G-XXXXXXXXXX` with your actual Measurement ID**

### Update Flippd_Landing_FeatureRich.html:

Same code, same Measurement ID

### Verify Tag is Working:

1. Open landing page in browser
2. Right-click → Inspect → Network tab
3. Search for "gtag"
4. You should see requests to Google Analytics

---

## STEP 3: SET UP CONVERSION TRACKING

### Create "email_signup" Event:

1. In GA4, go to **Admin** (bottom left)
2. Click **Events** (under Data Collection & Modification)
3. Click **Create Event**
4. Event name: `email_signup`
5. Create condition:
   - Parameter: `event`
   - Operator: `equals`
   - Value: `email_signup`
6. Click **Create**

### Mark as Conversion:

1. Go to **Admin** → **Conversions** (in Data Collection)
2. Click **Create Event** (under Conversion events)
3. Select: `email_signup`
4. Mark as conversion: Yes
5. Save

---

## STEP 4: ADD EMAIL SIGNUP TRACKING

### In Both Landing Pages (HTML):

Find the email form `<form>` element. Update the submit handler:

```javascript
async function handleEmailSignup(e) {
  e.preventDefault();
  
  // Get form data
  const name = document.querySelector('input[name="name"]').value;
  const email = document.querySelector('input[name="email"]').value;
  
  // Track GA4 event
  gtag('event', 'email_signup', {
    'email_domain': email.split('@')[1],  // Domain only, not full email
    'form_location': 'landing_page'
  });
  
  // Send to backend (optional)
  try {
    await fetch('/api/early-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });
  } catch (err) {
    console.log('Form error:', err);
  }
  
  // Show success message
  alert(`Welcome ${name}! Check your email for early access.`);
  e.target.reset();
}
```

---

## STEP 5: TRACK VARIANT ASSIGNMENT

### In index.html (Variant Router):

```javascript
function getVariant() {
  let variant = localStorage.getItem('flippd_ab_variant');
  
  if (!variant) {
    variant = Math.random() < 0.5 ? 'honest' : 'featurerich';
    localStorage.setItem('flippd_ab_variant', variant);
  }
  
  // Track variant assignment in GA4
  gtag('set', { 'variant': variant });
  gtag('event', 'page_view', {
    'variant': variant,
    'page_title': 'Flippd Landing — ' + variant
  });
  
  return variant;
}
```

---

## STEP 6: TRACK SCROLL DEPTH

### Add to Both Landing Pages:

```javascript
let scrollTracked = { 25: false, 50: false, 75: false, 100: false };

document.addEventListener('scroll', () => {
  const scrollPercent = Math.round(
    (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
  );
  
  [25, 50, 75, 100].forEach(mark => {
    if (scrollPercent >= mark && !scrollTracked[mark]) {
      scrollTracked[mark] = true;
      gtag('event', `scroll_${mark}pct`, { 'variant': variant });
    }
  });
});
```

---

## STEP 7: SET UP CUSTOM REPORTS

### Create Dashboard in GA4:

1. **Admin** → **Dashboards** (not in Admin, just in Explore)
2. Actually, skip the dashboard — use **Reports** → **Engagement**
3. Go to **Reports** (left sidebar)
4. Click **Engagement** → **Conversions**
5. Add columns:
   - Dimension: utm_source, utm_medium, variant
   - Metrics: Users, Conversions (email_signup), Conversion Rate

### Useful Reports:

1. **User Acquisition** → See where traffic comes from (organic, ads, direct)
2. **Engagement** → Page views, scroll depth
3. **Conversions** → Email signups by source
4. **User Explorer** → Individual user journeys (debug)

---

## STEP 8: SET UP GOOGLE SEARCH CONSOLE (Optional)

1. Go to: https://search.google.com/search-console
2. Add property (your domain)
3. Verify (add HTML tag to landing page)
4. This helps track organic search traffic → landing page → signups

---

## STEP 9: TEST EVERYTHING

### Checklist:

- [ ] Open landing page → GA4 DebugView shows page_view event
- [ ] Submit email form → GA4 shows email_signup event
- [ ] Scroll down → GA4 shows scroll_25pct, scroll_50pct, etc. events
- [ ] Wait 24 hours → Check GA4 Reports for data
- [ ] Events appear in Realtime → Real-time validation works

### GA4 DebugView (Real-time Testing):

1. **Admin** → **DebugView** (under Data Collection & Modification)
2. Keep this tab open while testing
3. Open landing page in another tab
4. You'll see events fire in real-time
5. Verify: page_view, email_signup, scroll events all appear

---

## STEP 10: CREATE A/B TEST REPORT

### In GA4 Reports:

Create custom report to track both variants:

**Rows:** variant (honest vs. featurerich)  
**Metrics:** Users, Events (email_signup), Conversion Rate  
**Date Range:** Entire early access period

**Report title:** "Landing Page A/B Test Results"

---

## DAILY MONITORING

### Each morning (6 AM):

1. Open GA4 → **Realtime**
2. Check: Traffic incoming? Events firing?
3. Go to **Reports** → **Engagement** → **Overview**
4. Screenshot or note:
   - Users yesterday
   - Events yesterday
   - Top pages

### Weekly (Friday):

1. Go to **Reports** → **Conversions**
2. Check conversion rate
3. Note in spreadsheet:
   - Date
   - Total users this week
   - Total conversions
   - Conversion rate %
   - Paid ads spend (if applicable)

### Monthly (End of month):

1. Run full conversion report
2. Compare variants
3. Decide: winner? Continue testing? Scale?

---

## UTM PARAMETERS (For Ads & Social)

### Use These Parameters:

**Format:** `?utm_source=X&utm_medium=Y&utm_campaign=Z&utm_content=W`

**Examples:**

**Social:**
```
https://flippd.com?utm_source=tiktok&utm_medium=organic&utm_campaign=earlyaccess&utm_content=post_1
https://flippd.com?utm_source=instagram&utm_medium=organic&utm_campaign=earlyaccess&utm_content=post_1
https://flippd.com?utm_source=reddit&utm_medium=organic&utm_campaign=earlyaccess
```

**Paid Ads:**
```
https://flippd.com?utm_source=facebook&utm_medium=cpc&utm_campaign=earlyaccess&utm_content=video_1
https://flippd.com?utm_source=google&utm_medium=cpc&utm_campaign=earlyaccess&utm_content=search
```

**Creator:**
```
https://flippd.com?utm_source=tiktok&utm_medium=creator&utm_campaign=earlyaccess&utm_content=@creator_handle
```

**Email:**
```
https://flippd.com?utm_source=email&utm_medium=welcome&utm_campaign=earlyaccess&utm_content=day_1
```

**In GA4, you'll see these in:**
- **Reports** → **Engagement** → **Traffic source**
- Filter by utm_source, utm_campaign to see performance by channel

---

## TROUBLESHOOTING

### GA4 shows 0 users:

1. Check: Is gtag code in both HTML files?
2. Check: Correct Measurement ID?
3. Test in DebugView
4. Wait 24 hours (GA4 has slight delay)

### Events not firing:

1. Check: Is email form configured correctly?
2. Check: browser console for JavaScript errors
3. Test in DebugView
4. Verify `gtag('event', ...)` is being called

### Data looks wrong:

1. Clear browser cache
2. Test in incognito window
3. Check timezone is correct (Admin → Property Settings → Reporting timezone)

---

## OWNERSHIP & UPDATES

**Owner:** Growth/Analytics  
**Daily Review:** Check Realtime for traffic + events  
**Weekly Review:** Conversion rate, channel breakdown  
**Monthly Review:** Full funnel analysis + test results
