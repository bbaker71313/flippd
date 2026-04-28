# FLIPPD — Retention & Churn Prevention Strategy

**Goal:** Keep users engaged, prevent cancellations, recover churned users. Churn target: <5% monthly.

---

## ACTIVATION PHASE (Days 1-7)

**Primary activation signal:** First scan

**If user doesn't scan by Day 3:**

Email:
```
Subject: Try the shelf scan feature

Hi [Name],

Got your code 3 days ago. Haven't scanned anything yet — no judgment.

The shelf scan is the move most people miss. Instead of scanning one item, take one wide photo of a 
full shelf. Flippd ranks every item by profit potential.

One user found $120 profit on a single shelf of vintage items at an estate sale. Stuff they would have 
walked right past.

Give it a try at your next sourcing trip. You have 11 days left in early access.

— Britt
```

**If user scans but doesn't add to inventory by Day 7:**

Email:
```
Subject: Saw you've been scanning — add to inventory?

Hi [Name],

You've scanned [X] items. That's great. Next step: add the FLIPs to your inventory.

When you tap "Add to Inventory," the item auto-fills with:
- Cost (from what you tell it)
- Expected sell price (from comps)
- Estimated profit (after fees)

This is where you start tracking what you actually own and what it's worth.

Try adding your next flip.

— Britt
```

---

## ENGAGEMENT PHASE (Days 7-14)

**Secondary activation signal:** Items added to inventory

**Milestone 1: First item added**
```
Great! You just added your first item to inventory.

This is the core of Flippd: every item you own, tracked. Cost, profit, status — all in one place.

Next moves:
1. Take photos (PHOTOS tab)
2. Generate listing (when feature ships)
3. Mark as sold when you list it
4. Watch your profit grow

You're doing it right. Keep going.

— Britt
```

**Milestone 2: First item marked sold**
```
You just marked an item SOLD. That's when Flippd gets powerful.

Your P&L is now tracking real data:
- Revenue: [amount]
- Profit after fees: [amount]
- ROI: [amount]%

Most resellers have no idea what their real numbers are. You do.

Keep adding, keep tracking. You'll see patterns emerge.

— Britt
```

---

## ENGAGEMENT LOOP (Ongoing)

**Weekly "Hunt List" Email:**

Subject: What to look for this week

```
Hi [Name],

Based on what you've logged and what's selling on eBay, here's your hunt list for this week:

[Category 1]: [Item type]. Selling $[X]-$[Y] range. Margin: [X]%
[Category 2]: [Item type]. Selling $[X]-$[Y] range. Margin: [X]%
[Category 3]: [Item type]. Selling $[X]-$[Y] range. Margin: [X]%

These categories are hot right now. If you find any of these, you'll flip them fast.

Happy hunting.

— Britt
```

**Monthly P&L Summary Email:**

Subject: Here's what you made this month

```
Hi [Name],

You logged [X] items this month. Here's your breakdown:

Revenue: $[X]
Total costs: $[X]
eBay fees: $[X]
Packaging: $[X]
Net profit: $[X]
ROI: [X]%

[X] items still selling. [X] items waiting to be listed.

You're on pace for $[annual projection] this year. Not bad for part-time work.

Keep going.

— Britt
```

---

## CANCEL FLOW (At Cancellation)

**Step 1: Exit Survey (In-App)**

When user clicks "Cancel Subscription":

```
We'll miss you. Can you tell us why?

[ ] Too expensive
[ ] Not using it enough
[ ] Missing a feature
[ ] Found an alternative
[ ] Other: ___________
```

**Step 2: Dynamic Save Offer (Based on Answer)**

---

### If: "Too expensive"

In-app popup:
```
Wait. We have another option.

25% off Hustle for the next 3 months.

Instead of $19/month = $14.25/month

That's $42.75 for 3 months. One good flip covers it.

[Discount Code: SAVE25_3M]

[Accept Offer] [Cancel anyway]
```

Email follow-up (if they cancel anyway):
```
Subject: One more offer

We offered 25% off, but I want to offer one more thing.

How about this: Try Scout (free tier) for a month. Zero cost. All your data stays.

If you come back and want Hustle, the discount code SAVE25_3M is still good.

No pressure. Happy to help either way.

— Britt
```

---

### If: "Not using it enough"

In-app popup:
```
Instead of canceling, try pausing.

Your data stays. Everything you've logged is safe. No charges while paused.

When you're sourcing again (and you will be), just turn it back on.

[Pause subscription] [Cancel anyway]
```

Email follow-up:
```
Subject: Your subscription is paused

Your data is safe. Your inventory is still there. Everything is waiting.

When you start sourcing again, just log back in and unpause. Your subscription picks up where you left off.

If you decide you want to cancel instead of pause, your export is always available — it's yours.

— Britt
```

---

### If: "Missing a feature"

In-app popup:
```
What's the #1 thing you need?

[ ] Live eBay sold comps
[ ] Auto-pricing (lower price if not selling)
[ ] Cross-listing to Facebook
[ ] Team features
[ ] Other: ___________

[Share feedback] [Cancel anyway]
```

Email follow-up:
```
Subject: Your feature request moved to priority

We got your feedback: [Feature they requested].

This is now on the roadmap. If [X] more users request it, we'll build it next.

If you want to stick around and see it ship, cool. If you want to cancel, totally understand.

Just know: you helped shape what's coming next.

— Britt
```

---

### If: "Found an alternative"

In-app popup:
```
Which tool did you switch to?

(This helps us understand what we're missing)

[ ] Underpriced.ai
[ ] ThriftMagic
[ ] Spreadsheet/manual
[ ] Other: ___________

[Share] [Don't share]
```

Email follow-up:
```
Subject: We'd love to know what we're missing

You switched to [Alternative Tool]. I want to understand why.

What does it do better than Flippd?

No judgment — honest feedback helps. Even if you're gone, I read every reply.

— Britt
```

---

### If: "Other"

In-app popup:
```
Tell us what's going on?

[Open text field]

[Share] [Cancel without sharing]
```

Email follow-up:
```
Subject: Help us understand

You said: "[Their response]"

I want to make this right. What would it take to keep you?

[Free month? Different pricing? Specific feature? Just reply.]

— Britt
```

---

## WIN-BACK SEQUENCE (Post-Cancellation)

**Day 30 After Cancellation:**

Subject: What would bring you back?

```
Hi [Name],

It's been a month since you canceled.

How's the reselling going? Still sourcing?

If Flippd isn't the right fit, totally fine. But if something changes and you want to come back, 
here's what's new since you left:

[List 2-3 features shipped]

Or if there's something specific you need, let me know. I read every reply.

No pressure. Just wanted to stay in touch.

— Britt
```

**Day 90 After Cancellation:**

Subject: Hustle tier got better (and cheaper?)

```
Hi [Name],

Three months since you left. Here's what's shipped:

[Major feature 1]
[Major feature 2]
[Major feature 3]

Most importantly: [Feature that solves their original objection if known]

If you're sourcing regularly, come back. First month is 50% off if you upgrade this week.

Or if you just want to check out what's new without upgrading, your Scout (free) account is still there.

— Britt
```

---

## INVOLUNTARY CHURN (Failed Payment)

**Day 1 of Failed Payment:**

Automated email:
```
Subject: Payment failed — let's fix it

Hi [Name],

Your payment for Flippd didn't go through.

Common reasons:
- Card expired
- Insufficient funds
- Bank flagged it as fraud

Click here to update your payment method: [Link]

Your access is paused until we get a valid payment. Once you update, you're back to full access immediately.

If you have questions, reply to this email.

— Britt
```

**Day 3 of Failed Payment:**

```
Subject: Still having issues with payment?

We tried charging your card again. Still failing.

If you're having payment issues or want to switch to a different card, let me know and I'll help sort it out.

If you want to downgrade to Scout (free) instead, that's easy too — just let me know.

— Britt
```

**Day 7 of Failed Payment:**

Final notice:
```
Subject: Your Flippd subscription expires tomorrow

Your account is set to auto-cancel in 24 hours due to failed payment.

Before we do:

Option 1: Update payment method here [link]
Option 2: Switch to Scout (free) tier [link]
Option 3: I can help troubleshoot [reply to this email]

Your inventory data is safe either way. You can export it anytime.

— Britt
```

---

## RETENTION METRICS & TARGETS

| Metric | Target | Why |
|--------|--------|-----|
| 7-day activation (first scan) | 60%+ | Core value signal |
| 14-day retention (still scanning) | 40%+ | Engaged users |
| 30-day retention | 25%+ | Real stickiness |
| 90-day retention | 18%+ | Long-term value |
| Monthly churn rate | <5% | Unit economics |
| Win-back rate (day 90) | 10%+ | Recovery potential |

---

## EXPANSION REVENUE (Upgrade Opportunities)

### Upgrade Trigger 1: Hitting Free Tier Limits

When user hits 25-scan limit (Scout tier):

```
You've hit your 25-scan limit for April.

Scout is $0/month.
Hustle is $19/month (unlimited scans + cross-listing).

One flip pays for a month of Hustle. Most users find that one good item per sourcing trip.

[Upgrade to Hustle] [Stay on Scout]
```

### Upgrade Trigger 2: Active User (100+ scans logged)

After user logs 100+ items:

```
You've logged 100+ items. You're serious about this.

Your inventory is now 85/100 on Scout tier (10-item limit).

Hustle tier gives you 500 items. Full cross-listing. Better profit tracking.

Most power users upgrade here.

[See Hustle Details]
```

### Upgrade Trigger 3: No Activity in 14 Days

If user hasn't scanned in 2 weeks but previously was active:

```
Haven't seen you in a while.

Still sourcing?

If you're taking a break from reselling, no worries. Your Scout tier stays free and your data is safe.

If you're busy sourcing but haven't had time to log items, remember: Hustle saves you time with 
unlimited scans + cross-listing tools.

Let me know if you need anything.

— Britt
```

---

## OWNERSHIP & METRICS DASHBOARD

**Owner:** Product/Growth  
**Metrics Tracked:** Activation rate, churn rate, win-back rate, monthly revenue retention  
**Review Cadence:** Weekly (for new cancellations), monthly (for trends)

**Create a dashboard tracking:**
- Daily active users (DAU)
- Weekly active users (WAU)
- Monthly active users (MAU)
- Churn rate (% users canceled this month)
- Revenue retention (MRR this month vs. last month)
- Win-back conversions (% of canceled users who returned)

---

## COPY PRINCIPLES

- All emails from "Britt" (personal, not corporate)
- Acknowledge the reality of churn ("No pressure")
- Make it easy to pause vs. cancel
- Offer concrete solutions (discount, feature request, payment fix)
- Read every reply and respond individually (builds trust)
- Never fake urgency ("Last chance!" doesn't work)
- Always make data exportable (users control their info)
