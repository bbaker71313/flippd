import Nav from './Nav';

function FlipResultCard() {
  return (
    <div className="relative mt-12 max-w-[340px] mx-auto">
      {/* Scan viewfinder brackets — the product's visual motif */}
      <div className="absolute -top-2 -left-2 w-5 h-5 border-t-2 border-l-2 border-sfp-green pointer-events-none" />
      <div className="absolute -top-2 -right-2 w-5 h-5 border-t-2 border-r-2 border-sfp-green pointer-events-none" />
      <div className="absolute -bottom-2 -left-2 w-5 h-5 border-b-2 border-l-2 border-sfp-green pointer-events-none" />
      <div className="absolute -bottom-2 -right-2 w-5 h-5 border-b-2 border-r-2 border-sfp-green pointer-events-none" />

      <div className="bg-sfp-body rounded p-6 border border-sfp-green/20">
        <div className="flex items-center justify-between mb-5">
          <span className="font-mono text-sfp-muted text-xs tracking-widest uppercase">
            Scan result
          </span>
          <span className="font-sans font-bold text-sfp-green text-xs px-2.5 py-1 border border-sfp-green rounded-sm tracking-[0.15em]">
            BUY
          </span>
        </div>

        <p className="font-sans font-semibold text-sfp-bg text-base leading-snug mb-5">
          Vintage Cast Iron Skillet
        </p>

        <div className="space-y-1.5 mb-5">
          <div className="flex justify-between">
            <span className="font-mono text-sfp-muted text-xs">You pay</span>
            <span className="font-mono text-sfp-bg text-xs">$4.00</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-sfp-muted text-xs">Est. sell</span>
            <span className="font-mono text-sfp-bg text-xs">$47.00</span>
          </div>
        </div>

        <div className="border-t border-sfp-secondary/30 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-sfp-muted text-[10px] uppercase tracking-widest">
              Profit after fees
            </span>
            <span className="font-sans font-bold text-sfp-green text-3xl tracking-tight">
              +$38.50
            </span>
          </div>
        </div>

        <p className="font-mono text-sfp-muted text-[10px] mt-3">
          6.2s &middot; 12 sold last 90 days &middot; eBay comps
        </p>
      </div>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section className="bg-sfp-header">
      <Nav />
      <div className="max-w-[640px] mx-auto w-full px-6 pt-10 pb-24">
        <div className="mb-8">
          <h1 className="font-sans font-bold text-sfp-bg text-4xl sm:text-5xl leading-[1.1] mb-4">
            Still guessing<br />what to flip?
          </h1>
          <p className="font-mono text-sfp-border text-base leading-relaxed mb-3">
            Scan it. Know your profit. Buy with confidence.
          </p>
          <p className="font-sans text-sfp-muted text-sm leading-relaxed max-w-md">
            Stop running on vibes and eBay searches. Get a BUY, PASS, or HOT
            decision — profit number included — before you open your wallet.
          </p>
        </div>

        <a
          href="#waitlist"
          className="inline-flex items-center px-8 py-4 bg-sfp-green text-sfp-body font-sans font-bold text-base rounded hover:bg-sfp-green-dim active:scale-[0.97] min-h-[44px]"
          style={{ transition: 'all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
        >
          Get early access — free to start
        </a>

        <FlipResultCard />

        <p className="font-mono text-sfp-muted text-xs text-center mt-10">
          Free to start &middot; No credit card &middot; Decisions in under 8 seconds
        </p>
      </div>
    </section>
  );
}
