# FLIPPD — Launch Checklist

**Early Access Launch → 4-week early access phase**

---

## PRE-LAUNCH (Week Before Launch)

### Technical (Must Complete)

- [ ] **Proxy backend from Manus integrated and tested**
  - Update `PROXY_URL = null` to real URL in Flippd_v5.html
  - Test 5 scans to verify API calls work
  - Test offline behavior (cache)
  - Test error handling (proxy down fallback)

- [ ] **Landing page A/B test set up**
  - Both Honest and Feature-Rich variants deployed
  - Variant assignment working (localStorage)
  - GA4 property created + Measurement ID in pages
  - Email form backend working
  - Test form submission yourself

- [ ] **Analytics tracking verified**
  - GA4 events firing: page_view, email_signup, scroll_depth
  - Check GA4 DebugView for real-time events
  - Custom events showing in Realtime

- [ ] **Email provider configured**
  - Mailchimp/ConvertKit/Substack account ready
  - 5 email templates created (welcome, day 1, day 3, day 7, day 14)
  - Automation triggers set up
  - Test email to yourself works

- [ ] **Access code system ready**
  - Unique codes for first 50 users generated
  - Codes stored + verifiable
  - Can revoke access if needed
  - Code distribution method ready (email, spreadsheet, form)

### Marketing (Must Complete)

- [ ] **Landing page copy finalized**
  - No placeholder metrics
  - No fake testimonials
  - Links all working (email form, pricing, etc.)
  - Mobile responsiveness tested

- [ ] **Email templates written**
  - Welcome (Day 0)
  - How-to guide (Day 1)
  - Feature spotlight (Day 3)
  - Engagement prompt (Day 7)
  - Upgrade decision (Day 14)
  - Tested in actual email provider

- [ ] **Social content calendar drafted**
  - 30 posts written
  - Scheduled in scheduling tool or ready to post
  - First week ready to go live

- [ ] **Creator outreach list ready**
  - 10 reselling YouTubers/TikTokers identified
  - DM template written
  - Ready to send

- [ ] **Testimonial collection process ready**
  - Survey email template written
  - Incentive offer decided (free month? discount?)
  - Form/spreadsheet to collect responses prepared

### Messaging (Must Complete)

- [ ] **Key messages locked**
  - Positioning: "Scan the shelf. Know what to buy."
  - Elevator pitch: 1 sentence describing Flippd
  - Problem statement: 2 sentences on the pain
  - Solution: 2 sentences on what Flippd does
  - Differentiation: 3 verified differentiators (no fake claims)

- [ ] **Objections pre-answered**
  - "Is it accurate?" → Real eBay comps + ability to verify
  - "How much does it cost?" → Free tier exists, $19/mo for unlimited
  - "Will my data be safe?" → Stays on your phone, no data sharing
  - "What if I don't like it?" → All data exports anytime

---

## LAUNCH DAY (Hour by Hour)

### 6:00 AM — Final Checks

- [ ] Check proxy backend status (is it up?)
- [ ] Check landing page loads (both variants)
- [ ] Check email provider is working
- [ ] Check GA4 DebugView is active
- [ ] Team sync: everyone knows launch is happening

### 9:00 AM — Go Live

- [ ] Deploy landing page (or flip DNS to live)
- [ ] Landing page live + accessible at flippd.com
- [ ] Send first batch of early access codes (to your email list or Slack)
- [ ] Post first social content (TikTok + Instagram)
- [ ] Announce in r/Flipping and r/Ebay (comment in relevant threads, don't spam)

### 10:00 AM — Monitor

- [ ] Watch GA4 Realtime for page views
- [ ] Watch email provider for signups
- [ ] Check for form errors (browser console logs)
- [ ] Respond to any immediate replies/questions

### 12:00 PM — Mid-Day Check

- [ ] Verify both landing page variants are serving 50/50
- [ ] Check conversion rate (views → signups) — aim for 2%+
- [ ] Check for any technical errors
- [ ] All systems green? Continue. Issues? Fix + retest.

### 3:00 PM — Second Social Post

- [ ] Post second content to TikTok + Instagram
- [ ] Engage with comments (reply to every one)
- [ ] Share a behind-the-scenes moment

### 6:00 PM — End of Day Review

- [ ] Total signups by end of day (target: 10-20 first day)
- [ ] Check for errors in logs
- [ ] No major issues found? Good.
- [ ] Issues found? Document + triage for next day

### 8:00 PM — Evening Wrap

- [ ] Send "welcome aboard" email to all new signups
- [ ] Check social mentions/replies
- [ ] Respond to any Slack/Twitter DMs
- [ ] Plan next day's posts

---

## LAUNCH WEEK (Days 1-7)

### Daily Tasks (Every Day)

- [ ] Check GA4 Realtime (10 AM, 3 PM, 6 PM)
- [ ] Monitor landing page variants (are both serving?)
- [ ] Post to social media (1-2 posts/day)
- [ ] Engage with comments on all posts (reply within 2 hours)
- [ ] Monitor email responses (reply to every one)
- [ ] Check app status (no crashes? proxy working?)
- [ ] Check email deliverability (no bounces?)

### Monday (Day 1)

- [ ] Launch complete? (From checklist above)
- [ ] First 10+ signups? (Target: 10-20 first day)
- [ ] Email delivery working? (Welcome email sent?)
- [ ] Social posts getting engagement? (5%+ rate is good)
- [ ] Creator outreach: Send first 3 DMs to YouTubers

**Daily Metrics Log:**
- Signups today: __
- Landing page views: __
- Conversion rate: __%
- Email opens: __%

### Tuesday (Day 2)

- [ ] Cumulative signups: 20+
- [ ] Post Day-1 follow-up email (how-to guide)
- [ ] Monitor: Who's activating? (scanning items?)
- [ ] Respond to all emails/DMs
- [ ] Creator outreach: Send next 3 DMs

**Daily Metrics Log:**
- New signups today: __
- Total cumulative: __
- First scans: __ (activations)
- Email opens: __%

### Wednesday (Day 3)

- [ ] Cumulative signups: 30+
- [ ] Post Day-3 follow-up email (feature spotlight: shelf scan)
- [ ] Check: How many users are still active? (daily active users)
- [ ] Testimonial collection: Start asking active users
- [ ] Creator outreach: Send final 4 DMs

**Daily Metrics Log:**
- New signups today: __
- Total cumulative: __
- Active users (scanned this week): __

### Thursday (Day 4)

- [ ] Cumulative signups: 40+
- [ ] First testimonials coming in? (Start collecting)
- [ ] Check A/B test results so far
  - Variant A views: __ | signups: __ | conversion: __%
  - Variant B views: __ | signups: __ | conversion: __%
  - Which is winning so far?
- [ ] Creator outreach complete (all 10 contacted)

**Daily Metrics Log:**
- New signups today: __
- Total cumulative: __
- Testimonials collected: __

### Friday (Day 5)

- [ ] Cumulative signups: 50+
- [ ] Paid ads test: Launch $300 test campaign (Meta or Google)
  - Set daily budget: $50/day
  - Landing page: Honest variant
  - Audience: Interest-based (eBay, reselling)
  - Objective: Traffic → email signups
  - Track cost per signup

- [ ] A/B test results: Check again
  - Running totals:
  - Variant A: __ views, __ signups, __%
  - Variant B: __ views, __ signups, __%

**Daily Metrics Log:**
- New signups today: __
- Total cumulative: __
- Paid ads spend so far: $__
- Paid ads signups: __
- Paid ads cost per signup: $__

### Saturday (Day 6)

- [ ] Weekly review:
  - Total signups Week 1: __
  - Average conversion rate: __%
  - Paid ads CPA: $__
  - Active users (who scanned): __
  - Email open rate: __%
  - Social engagement rate: __%

- [ ] Testimonials collected: __ (aim for 3+)

- [ ] Issues/learnings this week:
  - What worked: ______
  - What didn't: ______
  - Fix for next week: ______

### Sunday (Day 7)

- [ ] Send Week 1 review email to early access users
  - "Here's what's happened: 50+ signups, users finding great items"
  - "Here's what's next: listing generator in 2 weeks"
  - "Tell me what you love/need"

- [ ] Pause paid ads test (evaluate results)
  - CPA: $__ (target: <$5)
  - Conversion rate: __% (target: 3%+)
  - Decision: Scale budget? Pause? Adjust targeting?

- [ ] Team sync:
  - Celebrate Week 1
  - Review what needs to happen Week 2
  - Adjust strategy based on data

---

## WEEK 2-4 (Days 8-28)

### Daily Recurring Tasks

- [ ] Monitor landing page (GA4)
- [ ] Post social content (1-2x/day)
- [ ] Engage with all comments/replies
- [ ] Check email responses
- [ ] Monitor app status
- [ ] Log daily metrics

### Checkpoints

#### Day 10 (Monday of Week 2)

- [ ] Cumulative signups: 75+
- [ ] Active users (who scanned): 40+
- [ ] Paid ads CPA stable or improving?
- [ ] Testimonials: 5+ collected
- [ ] Replace landing page placeholder quotes with real testimonials
- [ ] Adjust social content based on Week 1 engagement data

#### Day 14 (Friday of Week 2)

- [ ] Cumulative signups: 100+
- [ ] Send Week 2 engagement email to all users
  - "Here's what you've found so far..." (if data available)
  - "Try the shelf scan feature" (if not using it)
  - "Tell us what's working"

- [ ] A/B test analysis:
  - Variant A: __ total signups
  - Variant B: __ total signups
  - Conversion rate A: __%
  - Conversion rate B: __%
  - Winner so far: __
  - Statistical significance: Need 5k+ views per variant (may not have yet)

- [ ] Paid ads performance review:
  - Total spend Week 1-2: $__
  - Total signups from ads: __
  - Cost per signup: $__
  - Decision: Continue, scale, pause, or optimize?

#### Day 18 (Tuesday of Week 3)

- [ ] Cumulative signups: 125+
- [ ] Active users: 70+
- [ ] Testimonials: 8+ (enough to fill landing page)
- [ ] Send Day-14 upgrade email to all trial users
  - "Your trial ends in 7 days"
  - "Here's what Scout (free) vs Hustle ($19) looks like"
  - "Early access upgrade discount (50% off) ends soon"

- [ ] Analyze first cancellations (if any):
  - Why are they leaving?
  - Can we save them?

#### Day 21 (Friday of Week 3)

- [ ] Cumulative signups: 150+
- [ ] Active users: 80+
- [ ] First conversions to paid? (target: 10+)
- [ ] Creator feedback: Did any YouTubers respond?
- [ ] Testimonials: 10+ (more than enough)

#### Day 28 (Friday of Week 4)

- [ ] **FINAL DECISION POINT**

- [ ] Cumulative signups: 200+
- [ ] Paid conversions: 15+ (target: 15%+ conversion)
- [ ] Active users: 100+
- [ ] A/B test: Determine statistical winner
  - Variant A: __ views, __ signups, __%
  - Variant B: __ views, __ signups, __%
  - Chi-square test: p-value __
  - Winner: __ (if p < 0.05)
  - Decision: Ship winner to 100% traffic

- [ ] Paid ads performance final:
  - Total spend: $__
  - Total signups: __
  - Cost per signup: $__
  - Conversion to paid: __%
  - Decision: Scale to $1000/month? Continue at current? Pivot?

- [ ] Early access learnings:
  - What worked best (channels, copy, features)?
  - What didn't work?
  - Top 3 user feedback items?
  - Top objections / why people didn't upgrade?

---

## SUCCESS CRITERIA (Week 4 Review)

**Phase 1 Success Means:**

- [ ] 200+ signups (target: 200)
- [ ] 3%+ conversion rate on landing page
- [ ] 15%+ free-to-paid conversion rate
- [ ] Paid ads CPA <$5
- [ ] 100+ active users (scanned at least once)
- [ ] 10+ real testimonials collected
- [ ] A/B test statistical winner identified
- [ ] <5% monthly churn rate
- [ ] 60%+ first scan rate (new users scan within 7 days)

**If you hit these:** Move to beta phase (scale to 500+ users)

**If you miss 2+ of these:** Pause, diagnose, adjust, and re-test

---

## METRICS TRACKING TEMPLATE

**Create a spreadsheet with:**

| Date | Signups Today | Total Cumulative | Landing Page Views | Conversion % | Email Opens | Paid Spend | Paid Signups | Email Replies | Key Notes |
|------|---|---|---|---|---|---|---|---|---|
| Day 1 | | | | | | | | | |
| Day 2 | | | | | | | | | |
| ... | | | | | | | | | |

**Update daily at 6 PM**

---

## OWNERSHIP & HANDOFF

**Owner:** Growth/Marketing Lead  
**Daily Check-in:** 6 PM update on metrics + next day plan  
**Weekly Review:** Friday 5 PM (full week analysis + adjustments)  
**Go/No-Go Decision:** Day 28 (end of Week 4) — proceed to beta or adjust
