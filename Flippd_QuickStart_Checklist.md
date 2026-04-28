# Flippd Landing Page — Quick Start Checklist

Use this checklist to go from static pages to live A/B test in the fastest way possible.

---

## Pre-Launch (Complete in 1-2 days)

### Hosting & Deployment

- [ ] **Choose hosting platform**
  - Vercel (recommended, fast, free tier) — https://vercel.com
  - Netlify (also good) — https://netlify.com
  - GitHub Pages (free, limited features) — https://pages.github.com

- [ ] **Upload three files to hosting:**
  - `index.html` (variant router from Flippd_Implementation_Guide.md)
  - `Flippd_Landing_Honest.html`
  - `Flippd_Landing_FeatureRich.html`

- [ ] **Get live domain**
  - If using Vercel/Netlify: Get auto-generated URL (e.g., `flippd.vercel.app`)
  - Or: Point custom domain to hosting provider

- [ ] **Test landing page loads** — Open https://yourdomain.com/index.html in browser

### Analytics Setup

- [ ] **Create GA4 account** (if you don't have one)
  - Go to https://analytics.google.com
  - Click "Create" → "Create account"
  - Fill in account details
  - Get Measurement ID (starts with `G-`)

- [ ] **Add GA4 tag to index.html**
  - Replace `G-YOUR_GA4_ID` in the code with your Measurement ID
  - Redeploy

- [ ] **Verify GA4 is working**
  - Open https://yourdomain.com in a browser
  - Check Network tab for `gtag` requests (should see requests to Google)
  - Check GA4 → Admin → DebugView to see real-time events

### Email Capture Backend

**Choose one option:**

#### Option A: Simple (Zapier/Make)
- [ ] Create free account on https://zapier.com
- [ ] Create a "Zap" that catches POST requests to your endpoint
- [ ] Route to your email provider (Mailchimp, ConvertKit, Substack, etc.)
- [ ] **Advantages:** No coding, setup in 10 minutes
- [ ] **Disadvantages:** Limited tracking of variant, requires email provider API key

#### Option B: Backend Server (Recommended)
- [ ] Set up backend (Node.js/Express, Python/FastAPI, etc.)
- [ ] Create `/api/early-access` endpoint (copy code from Flippd_Implementation_Guide.md)
- [ ] Connect to database (MongoDB, PostgreSQL, or even Google Sheets)
- [ ] Connect to email provider (Mailchimp, ConvertKit, etc.)
- [ ] Deploy backend (Heroku, Railway, Render, AWS, etc.)
- [ ] Update form handler in both landing pages to call your backend
- [ ] **Advantages:** Full control, track variant per signup, flexibility
- [ ] **Disadvantages:** Requires some coding, ~1-2 hours to set up

#### Option C: Google Forms (Fastest Hack)
- [ ] Create a Google Form with fields: Name, Email
- [ ] Copy the form's action URL
- [ ] Embed form in landing pages (or redirect to it)
- [ ] **Advantages:** 5 minutes, no code
- [ ] **Disadvantages:** Can't track variant per signup, adds extra friction

**Recommendation:** Start with Option B (backend) if you can, falls back to Option A (Zapier) if time is tight.

### Form Testing

- [ ] **Test form submission** (whichever option you chose)
  - Open landing page
  - Fill in test name and email
  - Submit form
  - Verify email is captured in your system

- [ ] **Test GA4 email_signup event**
  - Submit test form
  - Check GA4 DebugView for `email_signup` event
  - Should show within 5 seconds

---

## Launch Day (Ready to Go Live)

### Final Checks

- [ ] **Test variant assignment**
  - Open landing page in incognito window → should see one variant
  - Close incognito, open normal window → should see same variant (cookie works)
  - Clear localStorage, open again → should get random new variant
  - Verify in GA4 that both variants are being tracked

- [ ] **Test all CTAs**
  - Click every "Get Early Access" or "Send Me Access Code" button
  - All should scroll to or show the email form
  - Form should be visible and usable on mobile

- [ ] **Mobile test**
  - Open both landing pages on a phone
  - Check that layout is correct (no horizontal scrolling, readable text)
  - Submit form on mobile (should work)

- [ ] **Browser compatibility**
  - Test in Chrome, Firefox, Safari
  - Pages should look good in all

- [ ] **GA4 is running**
  - Real-time view should show 0 events (you're the only visitor)
  - Submit test form → should see `email_signup` event in real-time

### Go Live

- [ ] **Share landing page with first users**
  - Email your existing waitlist
  - Post in Slack communities you're in
  - Share in Reddit r/Flipping
  - Promote on Twitter/social media

- [ ] **Monitor for 4 hours**
  - Check GA4 for events
  - Check email capture system for signups
  - Watch for any errors in browser console

- [ ] **Document go-live time**
  - Write down when test started
  - Note traffic source for first signups
  - Create spreadsheet: Date | Variant A Views | A Signups | Variant B Views | B Signups

---

## Weeks 1-4 (Weekly Monitoring)

### Every Monday (30 minutes)

- [ ] **Download GA4 data**
  - Reports → Engagement → Conversions (or custom event report)
  - Export data to spreadsheet
  - Add row with date and metrics for each variant

- [ ] **Calculate conversion rates**
  ```
  A conversion rate = (Variant A signups) / (Variant A page views) * 100
  B conversion rate = (Variant B signups) / (Variant B page views) * 100
  ```

- [ ] **Check guardrail metrics**
  - Bounce rate per variant — should be <65%
  - Avg. session duration per variant — should be >1 min
  - If either is off, investigate

- [ ] **Review secondary metrics**
  - Scroll depth: what % reach 25%, 50%, 75%, 100%?
  - This tells you what's working on each page

- [ ] **Look for issues**
  - Form not submitting? (check console errors)
  - GA4 not tracking? (check DebugView)
  - One variant getting zero signups? (likely a bug)

### Every two weeks (1 hour)

- [ ] **Statistical significance test**
  - Once you have 5,000+ views per variant, run chi-square test
  - Go to https://www.evanmiller.org/ab-testing/chi-squared.html
  - Input: A conversions, A non-conversions, B conversions, B non-conversions
  - **If p < 0.05:** You have a winner
  - **If p > 0.05:** Continue test

- [ ] **Qualitative feedback**
  - Email 3-5 recent signups from each variant
  - Ask: "What convinced you to sign up for Flippd?"
  - Look for patterns (does Honest group cite speed? Does Feature-Rich cite reassurance?)

- [ ] **Update team**
  - Share current metrics in Slack
  - Note any patterns or issues
  - Plan next steps

---

## Decision Time (After 3-4 weeks or when winner is clear)

### Call the Winner

- [ ] **Run final statistical test**
  - Sample size must be at least 5,000 views per variant
  - Chi-square test p-value < 0.05
  - Confidence interval doesn't overlap

- [ ] **Review secondary metrics**
  - Does winner also have better scroll depth?
  - Is winner's bounce rate lower or similar?
  - Is winner's session duration longer (engagement)?

- [ ] **Document result**
  - Winner: [Honest / Feature-Rich / Inconclusive]
  - Conversion rate A: X%
  - Conversion rate B: Y%
  - p-value: Z
  - Sample size: N per variant

### Ship Winner

- [ ] **Stop A/B test**
  - Update index.html to always serve winning variant
  - Or: Replace index.html with winning variant directly

- [ ] **Monitor for issues**
  - First day after shipping winner: check GA4 every 2 hours
  - If unexpected bounce or signup drop, rollback

- [ ] **Archive losing variant**
  - Keep files for reference
  - Document why winner won
  - Note ideas for losing variant's improvements

### Email Early Signups

- [ ] **Send access code email**
  ```
  Subject: Flippd Early Access — Your Code is Ready
  
  Hi [Name],
  
  Welcome to Flippd! Your early access code is: [CODE]
  
  Next steps:
  1. Go to https://app.flippd.example.com
  2. Enter your access code to unlock
  3. Take a photo of any item to get started
  
  You'll get 3 months free while we refine features based on your feedback.
  
  Questions? Reply to this email.
  
  —
  Britt
  Flippd founder
  ```

- [ ] **Tag signups by variant** (in email provider)
  - Create segments for each variant
  - Use for future analysis ("did Honest or Feature-Rich users have higher retention?")

### Document Learnings

- [ ] **Write up findings**
  - What was the hypothesis?
  - What was the result?
  - Why did the winner win? (support with secondary metrics + quotes)
  - What surprised you?
  - What's the pattern you can reuse elsewhere?

- [ ] **Plan next test**
  - If Honest won: test even shorter variant (500 words)
  - If Feature-Rich won: test comparison table (vs. Underpriced.ai)
  - If inconclusive: test form friction (1 field vs. 2) or CTA copy

---

## Minimal Viable Setup (If You're in a Hurry)

**Do this if you want to launch in < 24 hours:**

1. Upload `Flippd_Landing_Honest.html` directly as your landing page (no variant rotation)
2. Use Google Forms for email capture (embed in page or redirect)
3. Share the link with 50 people you know
4. Collect feedback manually
5. After 1 week, decide to ship Honest or try Feature-Rich

**Why this works:** You'll get real feedback from real users in real time, even without fancy analytics. You can always upgrade to full A/B test later.

---

## Success Signals (You're Doing It Right If...)

✓ Landing page loads in <2 seconds  
✓ GA4 tracking shows real-time events within 5 seconds of page view  
✓ Form submissions appear in your email system  
✓ Test ran for 3+ weeks without changes  
✓ Sample size reached (26k+ views per variant)  
✓ Statistical winner identified (p < 0.05)  
✓ Winner shipped to 100%  
✓ Signups continue at similar rate (no drop after winner ships)  

---

## Common Failures (Watch Out For...)

❌ **Form never submits** — Most common issue. Check browser console for errors. Verify backend endpoint is working.

❌ **GA4 doesn't track variant** — Make sure variant is stored in localStorage and passed to gtag(). Check DebugView.

❌ **Test runs for 2 weeks but sample is tiny** — Traffic too low. Promote more aggressively (email, Reddit, Slack).

❌ **Winner called after 1 week** — Too early. Sample size must be 5k+ per variant. Peeking at results early causes false positives.

❌ **Form requires too many fields** — More fields = lower conversion. Stick to Name + Email only.

❌ **Copy changed mid-test** — Don't do this. You won't know what caused the change.

---

## Questions? Check These Docs

- **How to set up backend?** → Flippd_Implementation_Guide.md
- **How to run statistical test?** → Flippd_ABTest_Framework.md
- **What's the test hypothesis?** → Flippd_Test_Summary.md
- **How do variants differ?** → Flippd_Test_Summary.md (head-to-head comparison)

---

## Let's Go

You have everything you need. Pick your hosting, set up analytics, share the link, and let the data tell you what works.

**Two weeks from now, you'll know which variant converts better. Then you ship it and move on to the next growth lever.**

That's it. Go launch.
