export default function PricingSection() {
  return (
    <section id="pricing" className="bg-sfp-background py-20">
      <div className="max-w-xl mx-auto px-6">
        <div className="mb-8">
          <h2 className="font-sans font-bold text-sfp-textPrimary text-2xl sm:text-3xl mb-3">
            What does your time cost?
          </h2>
          <p className="font-mono text-sfp-textSecondary text-sm leading-relaxed">
            2–5 minutes per item. 30 items at a garage sale. That's up to 2.5
            hours of looking things up. Or 4 minutes with ScanForProfit.
          </p>
        </div>

        {/* Accuracy note */}
        <div className="bg-sfp-surface border border-sfp-border rounded p-4 mb-6">
          <p className="font-mono text-sfp-textSecondary text-xs leading-relaxed">
            <span className="font-sans font-semibold text-sfp-textPrimary text-sm">On accuracy: </span>
            ScanForProfit pulls from recent eBay sold listings — the same comps
            professional resellers use. You still make the call. We give you the
            data in 8 seconds.
          </p>
        </div>

        {/* Shelf scan callout — no side-stripe */}
        <div className="bg-sfp-header rounded p-5 mb-10">
          <p className="font-sans font-bold text-sfp-background text-sm mb-1">
            The shelf scan.
          </p>
          <p className="font-mono text-sfp-textMuted text-sm leading-relaxed">
            Point your phone at a shelf. One photo. Every item ranked by profit
            potential. No other app does this. This is what earns the upgrade.
          </p>
        </div>

        {/*
          Mobile order: Hustle (recommended) first, Scout second, Stack third.
          Desktop (sm:) order: Scout | Hustle | Stack via sm:order-*
        */}
        <div className="flex flex-col gap-4 sm:grid sm:grid-cols-3">
          {/* HUSTLE — recommended, shown first on mobile */}
          <div className="sm:order-2 rounded p-5 flex flex-col bg-sfp-header border-2 border-sfp-brand">
            <span className="font-mono text-sfp-brand text-xs tracking-widest uppercase mb-3">
              Recommended
            </span>
            <p className="font-sans font-bold text-sfp-background text-xl mb-1">Hustle</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="font-sans font-bold text-sfp-brand text-3xl">$19</span>
              <span className="font-mono text-sfp-textMuted text-xs">/mo</span>
            </div>
            <p className="font-mono text-sfp-textMuted text-xs mb-5">Most resellers start here.</p>
            <ul className="space-y-2 flex-1 mb-5">
              {[
                'Unlimited scans',
                '500 items in inventory',
                'Shelf scan — one photo, full aisle',
                'One-tap listing copy',
                'Profit dashboard',
                'Export inventory anytime',
              ].map((f) => (
                <li key={f} className="font-mono text-sfp-border text-xs flex items-start gap-2">
                  <span className="text-sfp-brand mt-0.5 flex-shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="#waitlist"
              className="w-full py-3 font-sans font-bold text-sm rounded min-h-[44px] bg-sfp-brand text-sfp-textPrimary text-center hover:bg-sfp-brandDim active:scale-[0.97] flex items-center justify-center"
              style={{ transition: 'all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
            >
              Start with Hustle
            </a>
          </div>

          {/* SCOUT — free tier */}
          <div className="sm:order-1 rounded p-5 flex flex-col bg-sfp-surface border border-sfp-border">
            <span className="font-mono text-sfp-textMuted text-xs tracking-widest uppercase mb-3 opacity-0" aria-hidden>
              &nbsp;
            </span>
            <p className="font-sans font-bold text-sfp-textPrimary text-xl mb-1">Scout</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="font-sans font-bold text-sfp-textPrimary text-3xl">Free</span>
              <span className="font-mono text-sfp-textMuted text-xs">forever</span>
            </div>
            <p className="font-mono text-sfp-textMuted text-xs mb-5">No card required.</p>
            <ul className="space-y-2 flex-1 mb-5">
              {[
                '25 scans/month',
                '10 items in inventory',
                'BUY / PASS / HOT decisions',
                'eBay comps on every scan',
              ].map((f) => (
                <li key={f} className="font-mono text-sfp-textSecondary text-xs flex items-start gap-2">
                  <span className="text-sfp-brand mt-0.5 flex-shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="#waitlist"
              className="w-full py-3 font-sans font-bold text-sm rounded min-h-[44px] border border-sfp-border text-sfp-textSecondary text-center hover:border-sfp-accent hover:text-sfp-accent active:scale-[0.97] flex items-center justify-center"
              style={{ transition: 'all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
            >
              Start for free
            </a>
          </div>

          {/* STACK — full-time resellers */}
          <div className="sm:order-3 rounded p-5 flex flex-col bg-sfp-surface border border-sfp-border">
            <span className="font-mono text-sfp-textMuted text-xs tracking-widest uppercase mb-3 opacity-0" aria-hidden>
              &nbsp;
            </span>
            <p className="font-sans font-bold text-sfp-textPrimary text-xl mb-1">Stack</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="font-sans font-bold text-sfp-textPrimary text-3xl">$49</span>
              <span className="font-mono text-sfp-textMuted text-xs">/mo</span>
            </div>
            <p className="font-mono text-sfp-textMuted text-xs mb-5">
              For resellers scaling past 500 items.
            </p>
            <ul className="space-y-2 flex-1 mb-5">
              {[
                'Everything in Hustle',
                'Unlimited inventory',
                'Growth intelligence',
                'Multi-marketplace listing',
                'Priority support',
              ].map((f) => (
                <li key={f} className="font-mono text-sfp-textSecondary text-xs flex items-start gap-2">
                  <span className="text-sfp-brand mt-0.5 flex-shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="#waitlist"
              className="w-full py-3 font-sans font-bold text-sm rounded min-h-[44px] border border-sfp-border text-sfp-textSecondary text-center hover:border-sfp-accent hover:text-sfp-accent active:scale-[0.97] flex items-center justify-center"
              style={{ transition: 'all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
            >
              Start with Stack
            </a>
          </div>
        </div>

        <p className="font-mono text-sfp-textMuted text-xs text-center mt-6">
          Early access pricing. No charge until you choose to upgrade.
        </p>
      </div>
    </section>
  );
}
