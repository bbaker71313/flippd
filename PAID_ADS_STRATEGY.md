# FLIPPD — Paid Ads Strategy (Phase 1)

**Goal:** Test $300-500 budget. Find cost-per-signup <$5. Validate landing page + targeting + messaging at scale.

---

## CAMPAIGN STRUCTURE

### Campaign 1: Meta (Facebook/Instagram) Test
**Budget:** $200 over 2 weeks  
**Objective:** Traffic (drive to landing page)  
**Audience:** Interest-based + lookalike  

**Setup:**
- Create Facebook Ads Manager account (if not already done)
- Create campaign: "Flippd_EarlyAccess_MetaTest_Apr2026"
- Daily budget: $50/day (7 days = $350 max)
- Landing page: Flippd_Landing_Honest.html (simpler, faster conversion)
- Conversion event: email_signup (track form submits)

**Targeting:**

| Segment | Interest | Geographic | Age |
|---------|----------|---|---|
| Interest A | eBay selling, Reselling, Side hustle | US | 25-55 |
| Interest B | Thrift shopping, Vintage, Flea markets | US | 25-55 |
| Lookalike A | Lookalike of email list (if >100 emails) | US | 25-55 |

**Creative 1 (Video):**
- 15-second video: Person scanning item, Flippd showing FLIP result, profit breakdown
- Text overlay: "Scan. Know. Profit. Flippd for resellers."
- CTA: "Get Early Access"
- Test different video frames (multiple 3-second cuts)

**Creative 2 (Image):**
- Hero shot: App screenshot showing FLIP result
- Text overlay: "Shelf scan finds $100+ profit items you'd miss"
- CTA: "Get Early Access"

**Success Metrics:**
- Cost per link click: <$1
- Cost per signup: <$5
- Landing page conversion: 3%+
- Click-through rate: 1.5%+

---

### Campaign 2: Google Search Test
**Budget:** $100 over 2 weeks  
**Objective:** Search (high-intent keywords)  
**Audience:** Keyword-based  

**Setup:**
- Create Google Ads account (if not already done)
- Create campaign: "Flippd_EarlyAccess_GoogleTest_Apr2026"
- Daily budget: $25/day (7 days = $175 max, adjust to $100 total)
- Landing page: Flippd_Landing_FeatureRich.html (more convincing for search intent)
- Conversion: form submission
- Match type: Broad (to start), refine to phrase match after 100 clicks

**Keywords to Bid On:**

| Keyword | Bid (approx) | Intent | CPC Est |
|---------|---|---|---|
| eBay profit calculator | $0.50 | Profit math | High |
| reseller profit tool | $0.75 | Solution | High |
| shelf scanner app | $0.40 | Solution | Medium |
| thrift store scanner | $0.35 | Solution | Medium |
| reseller sourcing app | $0.60 | Solution | High |
| eBay reseller app | $0.80 | Solution | High |
| flip items for profit | $0.45 | Intent | Medium |

**Ad Copy #1 (Text Ad):**
```
Headline 1: Scan. Know. Profit.
Headline 2: Shelf scanner for resellers
Headline 3: 8-second sourcing decisions

Description 1: One photo. Instant FLIP or PASS. Profit math after fees.
Description 2: Shelf scan finds items you'd miss. Real eBay comps.
```

**Ad Copy #2 (Text Ad):**
```
Headline 1: Stop Guessing on Buys
Headline 2: Flippd for eBay Resellers
Headline 3: Shelf scanning + profit calc

Description 1: Take a photo. Get profit forecast. Buy with confidence.
Description 2: Unlimited scans. Real comps. Configurable fees.
```

**Success Metrics:**
- Cost per click: $0.50-$1.00
- Cost per signup: $3-$5
- Conversion rate: 3-4%
- Quality score: 6+/10

---

## DAILY BUDGET & PACING

**Week 1 (Days 1-7):**
- Meta: $50/day × 5 days = $250
- Google: $25/day × 5 days = $125
- **Total:** $375 (conservative)

**Pause on Day 5 if:**
- CPA > $10 (money wasted)
- Click-through rate < 1% (bad creative)
- Form errors detected

**Continue if:**
- CPA $3-5 (good)
- CTR 1.5%+ (good engagement)
- Landing page working

---

## TRACKING & MEASUREMENT

**Spreadsheet columns:**

| Date | Platform | Spend | Clicks | CTR | Signups | CPC | CPA | Notes |
|------|----------|-------|--------|-----|---------|-----|-----|-------|
| 4/28 | Meta | $50 | 80 | 1.2% | 12 | $0.63 | $4.17 | Good performance |
| 4/28 | Google | $25 | 60 | 1.8% | 8 | $0.42 | $3.13 | Great CTR |

**Cumulative by end of Week 1:**
- Total spend: $375
- Total clicks: ~500
- Total signups: ~50
- Overall CPA: $7.50 (if 50 signups, adjust budget)

**Adjust by end of Week 1:**
- If CPA < $5: Scale to $1000/month
- If CPA $5-8: Continue, refine targeting
- If CPA > $8: Pause, analyze, redesign

---

## ATTRIBUTION & ANALYTICS

**Add UTM Parameters to Landing Page Links:**

```
Meta:
https://flippd.com?utm_source=facebook&utm_medium=cpc&utm_campaign=earlyaccess&utm_content=video

Google:
https://flippd.com?utm_source=google&utm_medium=cpc&utm_campaign=earlyaccess&utm_content=search
```

**In GA4, create a custom report:**
- Dimension: utm_source
- Metric: Users, Conversions (email_signup), Conversion Rate
- Segment: Source (Google vs Meta)

---

## CREATIVE TESTING PLAN (If CPA is High)

**After Day 7, if CPA > $8:**

**Test 1 — Different Messaging:**
- OLD: "Scan. Know. Profit." (product-focused)
- NEW: "Stop Leaving Money on the Floor" (benefit-focused)

**Test 2 — Different CTA:**
- OLD: "Get Early Access" (generic)
- NEW: "Start Free" or "Try Now" (lower friction)

**Test 3 — Different Visual:**
- OLD: App UI screenshot
- NEW: Before/after split screen (messy sourcing → organized sourcing)

---

## BUDGET ALLOCATION RECOMMENDATIONS

**If you have $500 total:**

**Conservative Approach (Risk-Averse):**
- Meta: $150
- Google: $100
- Organic (social, communities): Free
- Reserve: $250 for next phase based on learnings

**Aggressive Approach (Growth-Focused):**
- Meta: $250
- Google: $150
- Organic: Free
- Reserve: $100

**Recommend:** Start conservative, scale aggressively if CPA < $5

---

## POST-TEST DECISION FRAMEWORK

**Day 14 Review — Choose Path:**

**Path A: CPA < $5 (Success)**
- Decision: Scale budget to $1000/month
- Action: Duplicate winning ads, expand audiences
- Next: Test $500 budget weeks 3-4 to confirm efficiency

**Path B: CPA $5-8 (Acceptable)**
- Decision: Continue test, refine targeting
- Action: Pause low-performing ads, double down on winners
- Next: Optimize for 1-2 more weeks, then scale to $500/month

**Path C: CPA > $8 (Warning)**
- Decision: Redesign or pause
- Action: Change creative/messaging, retest with new angle
- Next: Learn from test, try different approach

**Path D: No Signups / High Bounce (Critical)**
- Decision: Pause immediately
- Action: Check landing page for errors, form validation, mobile responsiveness
- Next: Fix issues, retest before spending more

---

## CHANNELS TO PRIORITIZE (by Phase)

**Phase 1 (Now - Week 4):** Organic + Test Ads
- TikTok/Instagram: Free daily posting
- Reddit/Facebook groups: Free engagement
- Email list: Free once captured
- Paid ads: $300-500 test

**Phase 2 (Weeks 4-8):** Scale Winning Channels
- If organic is working: Scale social content production
- If ads are working: Scale paid budget to $1000-2000/month
- Continue email nurture

**Phase 3 (Weeks 8+):** Multi-Channel
- Organic + Paid + Influencer + Podcasts

---

## METRICS DASHBOARD

**Create a simple dashboard (Google Sheets) with:**

| KPI | Target | Actual | Status |
|-----|--------|--------|--------|
| Total signups from ads | 50 | __ | |
| Cost per signup | <$5 | $__ | |
| Landing page conversion | 3% | __% | |
| Click-through rate | 1.5% | __% | |
| Total ad spend | $300-500 | $__ | |
| Cost per click | <$1 | $__ | |

**Update daily**

---

## OWNERSHIP

**Owner:** Growth/Paid Media  
**Daily Check:** Cost tracking, quality score, form submissions  
**Decision Points:** Day 7 (continue/pause), Day 14 (scale/redesign), Day 28 (multi-month strategy)
