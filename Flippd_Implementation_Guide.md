# Flippd Landing Page — Implementation & Tracking Guide

This document covers the technical and operational setup needed to run both landing page variants and measure results accurately.

---

## Part 1: Variant Assignment & Serving

### Option A: Simple (No Backend)

If you're serving static HTML files from a hosting platform, use a small JavaScript wrapper to assign and serve variants.

**Create a file: `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flippd — Early Access</title>
    
    <!-- Google Analytics 4 Tag Manager -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-YOUR_GA4_ID"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-YOUR_GA4_ID', {
            'anonymize_ip': true,
            'allow_google_signals': false
        });
        
        // Assign variant and load page
        function initVariant() {
            // Get or create variant assignment
            let variant = localStorage.getItem('flippd_ab_variant');
            
            if (!variant) {
                // First-time visitor: random 50/50
                variant = Math.random() < 0.5 ? 'honest' : 'featurerich';
                localStorage.setItem('flippd_ab_variant', variant);
                localStorage.setItem('flippd_ab_variant_date', new Date().toISOString());
            }
            
            // Track variant assignment
            gtag('set', { 'variant': variant });
            gtag('event', 'page_view', {
                'variant': variant,
                'page_title': 'Flippd Landing — ' + variant
            });
            
            // Load the correct page
            const iframeUrl = variant === 'honest' 
                ? './Flippd_Landing_Honest.html' 
                : './Flippd_Landing_FeatureRich.html';
            
            // Option 1: Replace entire page (cleanest)
            window.location.href = iframeUrl;
            
            // Option 2: Inject via iframe (if you want to preserve wrapper)
            // const iframe = document.createElement('iframe');
            // iframe.src = iframeUrl;
            // iframe.style.width = '100%';
            // iframe.style.height = '100vh';
            // iframe.style.border = 'none';
            // document.body.innerHTML = '';
            // document.body.appendChild(iframe);
        }
        
        // Run on page load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initVariant);
        } else {
            initVariant();
        }
    </script>
</head>
<body>
    <!-- Fallback for JS disabled -->
    <p>Loading Flippd... if you see this, please enable JavaScript.</p>
</body>
</html>
```

**File structure:**
```
/landing
├── index.html (variant router)
├── Flippd_Landing_Honest.html
├── Flippd_Landing_FeatureRich.html
└── README.md
```

**Deployment:** Upload all three files to your hosting provider (Vercel, Netlify, GitHub Pages, etc.)

---

### Option B: Backend Server (More Control)

If you have a backend (Node.js, Python FastAPI, etc.), handle variant assignment server-side.

**Node.js / Express example:**

```javascript
const express = require('express');
const app = express();

app.get('/landing', (req, res) => {
  // Get or create variant from cookie
  let variant = req.cookies['flippd_variant'];
  
  if (!variant) {
    variant = Math.random() < 0.5 ? 'honest' : 'featurerich';
    res.cookie('flippd_variant', variant, { 
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true 
    });
  }
  
  // Log to analytics
  console.log(`Page view - variant: ${variant}`);
  
  // Serve the variant file
  const file = variant === 'honest' 
    ? 'Flippd_Landing_Honest.html' 
    : 'Flippd_Landing_FeatureRich.html';
  
  res.sendFile(file);
});

app.listen(3000);
```

**Python / FastAPI example:**

```python
from fastapi import FastAPI, Response
from fastapi.responses import FileResponse
import random
from datetime import datetime, timedelta

app = FastAPI()

@app.get("/landing")
async def landing(response: Response):
    # Get variant from cookie or assign new
    variant = request.cookies.get('flippd_variant')
    
    if not variant:
        variant = 'honest' if random.random() < 0.5 else 'featurerich'
        response.set_cookie(
            key='flippd_variant',
            value=variant,
            max_age=30*24*60*60  # 30 days
        )
    
    # Log to backend
    print(f"Page view - variant: {variant} - {datetime.now()}")
    
    # Serve file
    file_path = f"./Flippd_Landing_{variant.title()}.html"
    return FileResponse(file_path)
```

---

## Part 2: Email Capture & Form Handling

Both landing pages have the same form structure. You need a backend endpoint to capture emails.

### Backend Endpoint

**POST `/api/early-access`**

```python
# FastAPI example
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr
from datetime import datetime
import uuid

class EarlyAccessSignup(BaseModel):
    name: str
    email: EmailStr

app = FastAPI()

@app.post("/api/early-access")
async def signup(data: EarlyAccessSignup):
    try:
        # Get variant from cookie (passed in request context)
        # variant = request.cookies.get('flippd_variant', 'unknown')
        
        # Save to database
        signup_record = {
            'id': str(uuid.uuid4()),
            'name': data.name,
            'email': data.email,
            'variant': variant,
            'timestamp': datetime.now().isoformat(),
            'source': 'landing_page'
        }
        
        # INSERT into your database
        db.early_access_signups.insert_one(signup_record)
        
        # Send to email provider (Mailchimp, ConvertKit, etc.)
        email_provider.add_subscriber(
            email=data.email,
            name=data.name,
            tags=['early_access', f'variant_{variant}']
        )
        
        # Log to analytics backend
        log_event('email_signup', {
            'email': data.email,
            'variant': variant,
            'timestamp': datetime.now().isoformat()
        })
        
        return {
            'status': 'success',
            'message': f'Welcome {data.name}! Check your email for early access.'
        }
        
    except Exception as e:
        print(f"Signup error: {e}")
        raise HTTPException(status_code=500, detail="Signup failed")
```

**Node.js / Express example:**

```javascript
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());

app.post('/api/early-access', async (req, res) => {
  try {
    const { name, email } = req.body;
    const variant = req.cookies['flippd_variant'] || 'unknown';
    
    // Validate
    if (!name || !email) {
      return res.status(400).json({ error: 'Missing name or email' });
    }
    
    // Save to database
    const signup = {
      id: require('uuid').v4(),
      name,
      email,
      variant,
      timestamp: new Date().toISOString(),
      source: 'landing_page'
    };
    
    await db.collection('early_access_signups').insertOne(signup);
    
    // Send to email provider
    await mailchimp.addListMember(email, { FNAME: name });
    
    // Log to analytics
    analytics.logEvent('email_signup', { email, variant });
    
    res.json({ 
      status: 'success',
      message: `Welcome ${name}! Check your email for early access.`
    });
    
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});
```

### Update Landing Page Forms

In both `Flippd_Landing_Honest.html` and `Flippd_Landing_FeatureRich.html`, update the form handler:

**Current (local-only):**
```javascript
function handleEmailSignup(e) {
  e.preventDefault();
  alert('Thanks! Check your email for early access.');
  e.target.reset();
}
```

**Updated (with backend):**
```javascript
async function handleEmailSignup(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.querySelector('input[type="text"]').value;
  const email = form.querySelector('input[type="email"]').value;
  
  // Disable button while submitting
  const button = form.querySelector('button[type="submit"]');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Sending...';
  
  try {
    const response = await fetch('/api/early-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Show success message
    alert(`Welcome ${name}! Check your email for early access.`);
    form.reset();
    
  } catch (error) {
    console.error('Signup error:', error);
    alert('Signup failed. Please try again or contact support.');
    
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}
```

---

## Part 3: Analytics & Event Tracking

### GA4 Setup

1. **Create GA4 property** (if you don't have one)
   - Go to Google Analytics → Admin → Create Property
   - Property name: "Flippd Landing"
   - Reporting timezone: Your timezone

2. **Add GA4 tag to index.html (variant router)**
   ```html
   <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'G-XXXXXXXXXX');
   </script>
   ```
   Replace `G-XXXXXXXXXX` with your GA4 Measurement ID

3. **Create custom events in GA4 Admin:**
   - Admin → Events → Create Event
   - Event name: `email_signup`
   - Parameter: `variant` (custom event parameter)

4. **Mark as conversions:**
   - Admin → Conversions → New Conversion Event
   - Select `email_signup`

### Event Tracking Code

Add to both landing page HTML files (in `<head>` section):

```html
<script>
// Initialize GA4 (if not already in parent/index)
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());

// Get variant from localStorage or parent
const variant = localStorage.getItem('flippd_ab_variant') || 'unknown';

// Track page view with variant
gtag('event', 'page_view', {
  'page_title': 'Landing Page — ' + variant,
  'variant': variant
});

// Track scroll depth
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

// Track email signup (called from form submit)
function trackEmailSignup(email) {
  gtag('event', 'email_signup', {
    'variant': variant,
    'email_domain': email.split('@')[1] // Don't track full email for privacy
  });
}

// Call trackEmailSignup from form handler
// In handleEmailSignup function, add: trackEmailSignup(email);
</script>
```

### GA4 Dashboard Setup

Create a custom dashboard to track the test:

**Metrics to monitor:**
- Email Signups (by variant) — Table report, grouped by custom event parameter `variant`
- Conversion Rate (signups / page views) — Calculated metric or BigQuery
- Bounce Rate (by variant)
- Average Session Duration (by variant)
- Scroll Depth (% reaching 25%, 50%, 75%, 100%) — Event count reports

---

## Part 4: Data Analysis & Decision

### Weekly Monitoring Checklist

**Every Monday (or whenever you check results):**

1. **Open GA4 Dashboard**
   - Check signups by variant
   - Check guardrail metrics (bounce rate, session duration)
   - Export data to spreadsheet

2. **Calculate conversion rate**
   ```
   Conversion Rate = (# Email Signups) / (# Page Views)
   
   For variant A: 200 signups / 5,000 views = 4.0%
   For variant B: 150 signups / 5,000 views = 3.0%
   Difference: 1.0 percentage points (33% relative lift)
   ```

3. **Check statistical significance** (once you have ~5k views per variant)
   - Use Chi-square calculator: https://www.evanmiller.org/ab-testing/chi-squared.html
   - Input: variant A conversions, variant B conversions, variant A non-conversions, variant B non-conversions
   - If p-value < 0.05, you have a statistically significant result

4. **Review secondary metrics**
   - Does the winning variant also have higher scroll depth?
   - Is bounce rate similar between variants?
   - Is session duration longer (indicating engagement)?

5. **Document in spreadsheet**

   | Date | Variant A Views | Variant A Signups | Variant A Rate | Variant B Views | Variant B Signups | Variant B Rate | Chi-Sq p-value | Winner |
   |------|---|---|---|---|---|---|---|---|
   | 5/1 | 500 | 18 | 3.6% | 510 | 17 | 3.3% | 0.75 | — |
   | 5/8 | 3,500 | 150 | 4.3% | 3,400 | 102 | 3.0% | 0.02 | A |

### When to Call the Test

- **After 2–3 weeks:** Check sample size and significance
- **If p < 0.05:** Winner found, ship it
- **If p > 0.05 but sample > 5k per variant:** Inconclusive, extend test 1 week
- **If sample < 2k per variant at 3 weeks:** Test is underpowered, need more traffic (consider promoting to more channels)

### Post-Test Action

Once you have a winner:

1. **Ship the winning variant to 100% of traffic**
   - Update index.html to always serve winning variant
   - Or remove variant routing and serve winning page as primary

2. **Archive losing variant** (keep files for reference)

3. **Email early access signups:**
   ```
   Subject: Flippd Early Access — You're In
   
   Hi [Name],
   
   Welcome to Flippd early access! 
   
   Your access code is: [CODE]
   
   Next steps:
   1. Go to https://app.flippd.example.com
   2. Enter your access code
   3. Take a photo of any item to see it in action
   
   Questions? Reply to this email.
   
   —
   Britt
   Flippd founder
   ```

4. **Document learnings:**
   - Which positioning won?
   - Why did it win? (secondary metrics, qualitative feedback)
   - What's next? (new test, feature launch, channel expansion)

---

## Part 5: Troubleshooting

### Issue: Form not submitting

**Check:**
- Is backend endpoint returning 200?
- Are CORS headers set correctly? (backend should allow requests from your domain)
- Is form data being sent correctly? (check Network tab in browser dev tools)

**Fix:**
```javascript
// In form handler, add detailed logging
fetch('/api/early-access', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, email })
})
.then(r => {
  console.log('Response status:', r.status);
  return r.json();
})
.catch(e => console.error('Fetch error:', e));
```

### Issue: Variant not assigning consistently

**Check:**
- Are cookies enabled in browser?
- Is localStorage being cleared by browser on exit?

**Fix:** Ensure your browser/user preferences don't clear local storage. For very safe assignment, use server-side cookies (more reliable than localStorage).

### Issue: GA4 not tracking events

**Check:**
- Is GA tag loaded? (check in Network tab)
- Is gtag() function defined before you call it?
- Are custom parameters spelled correctly?

**Fix:**
```javascript
// Verify gtag is available
if (typeof gtag !== 'undefined') {
  gtag('event', 'test_event');
  console.log('Event sent');
} else {
  console.error('gtag not loaded');
}
```

### Issue: Signups to email list tagged incorrectly

**Check:**
- Is variant being passed to email backend?
- Is email provider tagging based on variant?

**Fix:** Verify your email provider integration:
```python
# Make sure variant is included in every call
await email_provider.add_subscriber(
    email=email,
    name=name,
    tags=['early_access', f'variant_{variant}']  # ← verify this line
)
```

---

## Deployment Checklist

- [ ] Both landing page HTML files created and reviewed
- [ ] Variant router (index.html) created with GA4 tag
- [ ] Backend endpoint for `/api/early-access` created and tested
- [ ] Form handlers updated to call backend
- [ ] GA4 property created and events configured
- [ ] Landing page linked from email list, social, etc.
- [ ] Test plan documented (hypothesis, metrics, sample size)
- [ ] Team briefed on test and results dashboard
- [ ] Analytics dashboard created for weekly monitoring
- [ ] Decision framework ready (how to call winner)
- [ ] Monitoring alert set (to check weekly)

---

## Support & Questions

If anything is unclear or broken:
1. Check the troubleshooting section above
2. Review GA4 docs: https://support.google.com/analytics/answer/9304153
3. Check backend framework docs (Express, FastAPI, etc.)
4. Enable browser dev tools console to see detailed error messages
