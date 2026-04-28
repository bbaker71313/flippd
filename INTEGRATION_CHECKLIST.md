# FLIPPD — Integration Checklist (Pre-Launch QA)

**Timeline:** 3-5 days before launch  
**Owner:** Product/QA  
**Goal:** Every critical system tested before users arrive

---

## PROXY BACKEND INTEGRATION

- [ ] **Proxy URL wired into Flippd_v5.html**
  - `PROXY_URL = "https://[your-proxy-url]"` is set correctly
  - No typos in URL
  - Test in both development and production versions

- [ ] **Test 5 scans through proxy**
  - Open app, enter access code
  - Take photo of different items (electronics, clothing, home goods)
  - Verify results come back quickly (<3 seconds)
  - Verify profit math is correct (configurable fee applied)
  - Check that real eBay comps are being used (not hallucinated)

- [ ] **Test error handling**
  - Temporarily break proxy URL (change one character)
  - App should show error gracefully ("Connection failed, try again")
  - Should not crash or show technical error to user
  - Restore URL and verify it works again

- [ ] **Test offline behavior**
  - Disable internet
  - Try to scan (should fail with "No connection" message)
  - Turn internet back on
  - Verify scanning works again
  - Previous scans should be cached (saved locally)

- [ ] **Test API response times**
  - Time how long each scan takes (target: 5-10 seconds)
  - If >15 seconds, diagnose: Is it the proxy? The API? Image processing?
  - Optimize if slow

---

## ACCESS CODE SYSTEM

- [ ] **Test unique access codes work**
  - Generate 50 unique codes
  - Test 3 different codes (they should all unlock)
  - Test expired/revoked code (should be rejected)
  - Test invalid code (should show "Invalid code" error)

- [ ] **Verify codes are distributed correctly**
  - Email system has codes ready
  - Code in each early access email is unique
  - No duplicate codes sent

- [ ] **Test code persistence**
  - Enter code, reload page
  - Code should still be saved (localStorage check)
  - Don't have to re-enter code on every load

- [ ] **Fallback: Manual code reset**
  - If a user loses their code, can you generate a new one?
  - Process is: User emails, you reply with new code, they enter it
  - Test this workflow

---

## LANDING PAGE FORM INTEGRATION

- [ ] **Email capture form submission works**
  - Fill out form (name + email)
  - Submit
  - No errors in console
  - Form clears after submit
  - Success message shows: "Check your email for early access"

- [ ] **Email arrives in your email provider**
  - Check Mailchimp/ConvertKit inbox
  - Email address captured correctly
  - Name captured correctly
  - Timestamp recorded

- [ ] **Form validation works**
  - Try submitting with empty name: should error ("Name required")
  - Try submitting with invalid email: should error ("Valid email required")
  - Try submitting with special characters: should handle gracefully

- [ ] **Both variants' forms work**
  - Test Honest variant form
  - Test Feature-Rich variant form
  - Both should submit to same backend

- [ ] **Mobile form usability**
  - On iPhone: Can you tap the fields?
  - On iPhone: Keyboard doesn't cover submit button?
  - On Android: Same tests

---

## ANALYTICS TRACKING

- [ ] **GA4 tag is installed**
  - Check both landing pages for GA4 code
  - Measurement ID is correct (G-XXXXXXXXXX)
  - Code is in `<head>` section

- [ ] **Events fire correctly**
  - Open GA4 DebugView
  - Load landing page
  - Should see `page_view` event fire immediately
  - Fill out form + submit
  - Should see `email_signup` event fire
  - Scroll down 25%+
  - Should see `scroll_25pct` event fire

- [ ] **Variant assignment tracked**
  - Load page in incognito window
  - Should be assigned to variant A or B (50/50 random)
  - Check GA4 for variant parameter

- [ ] **GA4 Realtime shows data**
  - Wait 5 seconds
  - Go to GA4 → Realtime
  - You should see yourself (as a user) in Realtime users
  - Events should show within 5 seconds

---

## DEVICE TESTING

### iOS (iPhone)

- [ ] **Landing page loads**
  - Open in Safari
  - Page loads fully (<3 seconds)
  - Layout is mobile-optimized (no horizontal scrolling)
  - Text is readable (no tiny fonts)

- [ ] **App (if testing on iOS)**
  - Open Flippd_v5.html in Safari
  - Camera feature works
  - Photos can be taken and selected
  - App doesn't crash on camera open/close

- [ ] **Forms work on iOS**
  - Tap email field
  - Keyboard appears + doesn't cover form
  - Can type email
  - Submit button is tappable
  - Success message appears

- [ ] **Scroll/navigation smooth**
  - Scroll down landing page
  - No lag or jank
  - Smooth animation

### Android (Chrome)

- [ ] Same tests as iOS
  - Landing page loads
  - Mobile layout correct
  - Forms work
  - Camera feature works
  - Navigation smooth

### Desktop (Chrome, Firefox, Safari)

- [ ] **Landing page responsive**
  - Resize browser to mobile width (375px)
  - Should look identical to actual phone
  - Resize to tablet (768px)
  - Should be readable but not mobile layout

- [ ] **Forms work**
  - All fields accessible
  - Submit button works
  - No errors in console

- [ ] **Camera not required**
  - Can fill out form without camera
  - Can still submit
  - Doesn't crash if camera unavailable

---

## BROWSER COMPATIBILITY

### Minimum Support:

- [ ] **Chrome (latest 2 versions)** — Test on current + 1 version back
- [ ] **Firefox (latest 2 versions)** — Test on current + 1 version back
- [ ] **Safari (latest 2 versions)** — Test on current + 1 version back
- [ ] **Edge** — Latest version

### Test:
- [ ] Page loads
- [ ] No console errors
- [ ] Forms work
- [ ] Analytics fires

---

## PERFORMANCE TESTING

- [ ] **Page load time**
  - Target: <2 seconds
  - Measure with Chrome DevTools Network tab
  - If >3 seconds: optimize images, defer scripts

- [ ] **Scan time through proxy**
  - Target: <10 seconds from photo to result
  - If >15 seconds: check proxy latency, API response time

- [ ] **Form submission time**
  - Target: <1 second (instant feedback)
  - If slow: check email provider API

---

## SECURITY & PRIVACY

- [ ] **HTTPS only**
  - Landing page is HTTPS (not HTTP)
  - Check URL starts with `https://`
  - Certificate is valid (no warning)

- [ ] **API calls are HTTPS**
  - When scanning, check Network tab
  - All requests should be HTTPS
  - No credentials in logs or URLs

- [ ] **No sensitive data in console logs**
  - Open DevTools Console
  - Submit form
  - No API keys, no full email addresses, no passwords should appear

- [ ] **CORS headers correct**
  - Frontend is on: flippd.com
  - Backend is on: different domain
  - Requests should have CORS headers (Access-Control-Allow-Origin)
  - Cross-origin requests should work without browser warnings

---

## EMAIL DELIVERY

- [ ] **Welcome email sends automatically**
  - User submits form
  - Check email inbox within 2 minutes
  - Email arrives
  - Subject is correct ("Your Flippd early access code is ready")
  - Body includes unique access code
  - Code is formatted clearly (monospace font helps)

- [ ] **No spam folder**
  - Check spam/promotions folder
  - Email should be in inbox, not spam
  - If in spam: check sender reputation, SPF/DKIM records

- [ ] **Email branding**
  - From line: "Britt <britt@flippd.com>"
  - Looks professional
  - Clear CTA (link to app)

---

## DATA & BACKUP

- [ ] **Landing page data is stored**
  - Submissions are in email provider
  - Submissions are in backend database (if applicable)
  - Can export list of emails for communication

- [ ] **App data persists**
  - Enter access code in app
  - Do a scan
  - Add item to inventory
  - Reload page
  - Data is still there (localStorage working)

- [ ] **Backup exists**
  - GitHub repo has code backed up
  - Landing page files are version controlled
  - Database backups exist (if applicable)

---

## DOCUMENTATION

- [ ] **Code comments updated**
  - Proxy URL location documented
  - New API endpoints documented
  - Changes since last version noted

- [ ] **README updated**
  - Instructions to run app locally
  - Instructions to set up landing page
  - GA4 setup instructions
  - Email provider setup

---

## SIGN-OFF CHECKLIST

**All items must be checked before launch:**

- [ ] Proxy backend working
- [ ] Access codes generating + working
- [ ] Landing page forms submitting
- [ ] Analytics events firing
- [ ] Mobile testing complete
- [ ] No console errors
- [ ] Email delivery working
- [ ] Data persists
- [ ] HTTPS + security verified
- [ ] Team reviews and approves

**If any item is unchecked:** STOP. Do not launch. Fix issue first.

---

## LAUNCH READINESS SIGN-OFF

**Product Lead:** _________________________ Date: _______

**QA Lead:** _________________________ Date: _______

**Marketing Lead:** _________________________ Date: _______

**Final decision:** ☐ GO LIVE ☐ DO NOT LAUNCH (resolve issues)

---

## ROLLBACK PLAN (Just in Case)

If critical issues found after launch:

1. **Landing page is down?**
   - Switch DNS to previous version
   - Notify waitlist that site is temporarily down
   - Fix + redeploy

2. **Proxy is broken?**
   - Replace PROXY_URL with fallback (old Cloudflare URL if available)
   - Or disable scanning temporarily until fixed
   - Email users: "We're having technical issues, please try again in 2 hours"

3. **Forms not submitting?**
   - Check backend status
   - If down: redirect form to Google Form as temporary capture
   - Email captured users manually with access codes

---

## OWNERSHIP

**Product Owner:** Responsible for app QA + sign-off  
**QA Tester:** Responsible for device testing + browser compatibility  
**DevOps:** Responsible for proxy + infrastructure  
**Marketing:** Responsible for landing page + form testing  

**Timeline:** Complete all checks 48 hours before launch
