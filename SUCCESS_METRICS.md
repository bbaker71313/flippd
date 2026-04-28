# FLIPPD — Success Metrics & KPI Tracking

**Phase:** Early Access Launch (Weeks 1-4)  
**Owner:** Growth Lead  
**Update Frequency:** Daily metrics, weekly summary

---

## PHASE 1 SUCCESS TARGETS (Week 1-4)

| KPI | Week 1 | Week 2 | Week 3 | Week 4 | Overall Target |
|-----|--------|--------|--------|--------|---|
| **Landing Page Views** | 500+ | 1,500+ | 3,000+ | 5,000+ | 10,000+ |
| **Email Signups** | 15+ | 45+ | 90+ | 150+ | 200+ |
| **Conversion Rate (views → signup)** | 3%+ | 3%+ | 3%+ | 3%+ | 3%+ |
| **App Activations (first scan)** | 9+ | 27+ | 54+ | 90+ | 120+ |
| **Activation Rate (signups → first scan)** | 60%+ | 60%+ | 60%+ | 60%+ | 60%+ |
| **Paid Conversions (free → paid)** | 1+ | 3+ | 8+ | 15+ | 20+ |
| **Free → Paid Conversion Rate** | 6%+ | 6%+ | 8%+ | 10%+ | 10%+ |
| **Active Users (scanned this week)** | 9+ | 30+ | 60+ | 100+ | 100+ |
| **Paid Ads CPA** | <$8 | <$6 | <$5 | <$5 | <$5 |
| **Email Open Rate** | 35%+ | 40%+ | 40%+ | 40%+ | 40%+ |
| **Testimonials Collected** | 0 | 2+ | 5+ | 10+ | 10+ |
| **Monthly Churn Rate** | N/A | N/A | N/A | <5% | <5% |

---

## DAILY METRICS LOG

**Create a spreadsheet with these columns:**

```
Date | Landing Views | New Signups | Cumulative Signups | First Scans | Active Users | Paid Signups | Email Opens | Paid Spend | Notes
-----|---|---|---|---|---|---|---|---|---
4/28 | 120 | 4 | 4 | 2 | 2 | 0 | 40% | $0 | Launch day
4/29 | 180 | 6 | 10 | 6 | 6 | 0 | 35% | $50 | Social posts up
4/30 | 200 | 5 | 15 | 8 | 8 | 1 | 42% | $50 | First paid conversion
```

**Daily Check-in (6 PM):**
- Views from GA4 → Engagement → Overview
- Signups from email provider dashboard
- Scans from app logs (if available) or direct user reports
- Email opens from email provider analytics
- Paid spend from ad platform
- Notes: What drove traffic? Any issues?

---

## WEEKLY REVIEW SUMMARY

**Every Friday, 5 PM. Create a new row in summary spreadsheet:**

```
Week | Total Views | Total Signups | Conv Rate | Active Users | First Scans | Paid Conversions | Conversion % | Paid CPA | Key Win | Key Issue
-----|---|---|---|---|---|---|---|---|---|---
1 | 1,000 | 30 | 3.0% | 18 | 18 | 1 | 3.3% | $7.50 | Strong conversion | Slow paid ads |
2 | 2,000 | 60 | 3.0% | 36 | 36 | 4 | 6.7% | $6.00 | Paid improving | Need more content |
```

---

## CHANNEL BREAKDOWN (Track Separately)

### Traffic Sources:

| Channel | Week 1 Views | Week 1 Signups | CPA | Notes |
|---------|---|---|---|---|
| Organic (direct + organic search) | 400 | 12 | Free | Twitter + word of mouth |
| Paid (Meta + Google) | 300 | 9 | $5.56 | Ads test running |
| Social (TikTok + Instagram) | 200 | 6 | Free | 30 posts in queue |
| Creator (influencer DMs) | 100 | 3 | Free | 10 creators contacted |
| **TOTAL** | **1,000** | **30** | **$3.50 avg** | — |

**Update weekly from GA4 utm_source reports**

---

## CONVERSION FUNNEL TRACKING

**Track at each stage:**

```
Stage | Users | Conv Rate | Notes
---|---|---|---
Landing page views | 10,000 | 100% | Baseline
Email form submits | 300 | 3% | 3% conversion rate
Email opens | 120 | 40% | Of those who got email
Click through (to app) | 85 | 70% | From email clicks
Access code entered | 80 | 94% | Lose 5% to friction
First scan completed | 48 | 60% | Primary activation
Item added to inventory | 30 | 37% | Secondary activation
Item marked as sold | 5 | 6% | Power user signal
Subscribed to paid | 3 | 3.8% | Revenue!
```

**Goal:** Identify where users drop off. Optimize that stage.

---

## DIAGNOSTIC METRICS (Deep Dive)

### If Conversion Rate is Low (<2%):

Check:
- [ ] Landing page loading? (>3s load time = people bounce)
- [ ] Form field errors? (Check backend logs)
- [ ] Mobile experience broken? (Test on phone)
- [ ] Variant A vs B — which converts better?
- [ ] Ad traffic quality? (Check if paid traffic is bot/spam)
- [ ] Call-to-action clear? (Test headline variations)

**Action:** Fix highest-impact issue, monitor, adjust

### If Activation Rate is Low (<40%):

Check:
- [ ] Welcome email being delivered? (Check spam folder)
- [ ] App error when entering access code?
- [ ] Camera not working on their device?
- [ ] Instructions unclear? (Test Day 1 help email)
- [ ] Scanning items doesn't work as expected?

**Action:** Send Day-1 help email with step-by-step instructions

### If Paid Conversions Are Low:

Check:
- [ ] CPA too high? (>$8 means not profitable at current pricing)
- [ ] Ad creative resonating? (A/B test different images/copy)
- [ ] Landing page for paid users converting? (Check paid utm source separately)
- [ ] Form working on mobile? (Paid traffic is often mobile)

**Action:** Redesign creative, pause underperforming ads, scale winners

---

## GO/NO-GO DECISION CRITERIA (Day 28)

**By end of Week 4, evaluate against these:**

**GO (Proceed to Beta Phase):**
- ✅ 150+ signups (target hit)
- ✅ 3%+ conversion rate (good landing page)
- ✅ 60%+ activation rate (product resonates)
- ✅ <5% churn rate (people stick around)
- ✅ 10+ real testimonials (social proof ready)
- ✅ Paid ads CPA <$5 (economics work)

**PAUSE/REFINE (Fix one issue, extend test):**
- ⚠️ 100-150 signups (missed target by 50%, but viable)
- ⚠️ 2-3% conversion (acceptable but below target)
- ⚠️ 40-60% activation (product needs improvements)
- ⚠️ $5-8 CPA (profitable but tight margins)
- ⚠️ 5-10 testimonials (enough but weak)

**NO-GO (Diagnose + Major Changes):**
- ❌ <100 signups (demand signal weak)
- ❌ <2% conversion (landing page not working)
- ❌ <40% activation (product needs redesign)
- ❌ >8 CPA (economics don't work)
- ❌ >5% monthly churn (people leaving fast)
- ❌ 0 testimonials (no one loves it)

---

## SECONDARY METRICS (Track but Don't Decide On)

These inform strategy but aren't go/no-go criteria:

| Metric | Target | Why | Owner |
|--------|--------|-----|-------|
| Email open rate | 40%+ | Subject line + send time optimization | Marketing |
| Social engagement rate | 5%+ | Content resonance | Social |
| Average session duration | 2 min+ | Landing page engagement | Growth |
| Bounce rate | <50% | Mobile + page speed | Product |
| Scroll depth (25%/50%/75%) | 50%/35%/20% | Content hierarchy working | Product |
| Return visitor rate | 10%+ | Landing page stickiness | Growth |
| Creator response rate | 30%+ | Outreach messaging quality | Growth |

---

## RED FLAGS (Immediate Action Required)

If any of these happen mid-week, **pause and diagnose immediately:**

- [ ] Conversion rate drops below 1% (form broken? traffic quality bad?)
- [ ] Activation rate drops below 30% (app broken? flow confusing?)
- [ ] CPA spikes above $10 (ads targeting wrong audience)
- [ ] Proxy backend down (users can't scan)
- [ ] Form not submitting (email provider integration broken)
- [ ] No email opens (email not being delivered)
- [ ] Churn >10% weekly (product not working)

**Don't wait for Friday review — fix day-of**

---

## METRIC OWNERSHIP

| Metric | Owner | Measurement Tool |
|--------|-------|---|
| Landing page views/conversion | Growth | GA4 |
| Email signups/opens | Marketing | Mailchimp/ConvertKit |
| App activations | Product | App logs |
| Paid ads CPA | Growth/Ads | Meta Manager + GA4 |
| Social engagement | Social | TikTok/Instagram/Reddit |
| Testimonials | Marketing | Spreadsheet |
| Churn rate | Product | Stripe |
| Overall KPIs | Growth Lead | Master spreadsheet |

---

## WEEKLY CADENCE

**Monday 10 AM:** Review Week N-1 data
**Friday 5 PM:** Summary + decisions for next week
**Daily 6 PM:** Log metrics (ongoing)

---

## REPORTING

**Weekly to Team (Friday):**
- Email with key metrics + graph
- Highlight: top win + biggest issue
- Recommendation for next week

**Monthly to Leadership (or Day 28):**
- Full funnel report
- Go/no-go decision
- Path forward

---

## TEMPLATE: WEEKLY EMAIL REPORT

```
Subject: Flippd Early Access — Week X Summary

Hi team,

Here's Week X (dates) by the numbers:

HEADLINE METRICS:
• Total signups: X (target: Y)
• Conversion rate: X% (target: 3%+)
• Active users: X
• Paid conversions: X
• CPA (if running ads): $X (target: <$5)

TOP WIN THIS WEEK:
[What worked well — e.g., "Social content got 50k views"]

BIGGEST CHALLENGE:
[What needs fixing — e.g., "Paid ads CPA too high"]

DECISION:
[Continue as-is / Adjust X / Pause Y]

NEXT WEEK FOCUS:
[2-3 key things to focus on]

Questions? Reply to this email.

— Growth Lead
```

---

## SUCCESS CASE STUDY (What Does "Good" Look Like?)

**Hypothetical Week 1:**
- 1,000 landing page views
- 30 email signups (3% conversion)
- 18 first scans (60% activation)
- 1 paid conversion
- $0 paid spend (organic launch)
- 12 email opens (40% open rate)

**Analysis:** Strong start. Organic channels working. Ready to test paid ads in Week 2.

**Decision:** Maintain current organic efforts, launch $300 paid ads test next week, collect testimonials.

---

## OWNERSHIP & CADENCE

**Growth Lead:**
- Daily: Log metrics at 6 PM
- Friday 5 PM: Summary + week review
- Day 28: Go/no-go decision

**CFO/Finance:**
- Weekly: Cost tracking (ad spend, software tools)
- Day 28: Unit economics review

**Product Lead:**
- Daily: Monitor activation rate + churn
- Friday: Diagnose product issues (if any)
- Day 28: Feature prioritization based on feedback
