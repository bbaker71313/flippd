const testimonials = [
  {
    // [PLACEHOLDER — REPLACE BEFORE LAUNCH]
    quote:
      'The shelf scan is insane. I walked through an estate sale and had a buy list in 3 minutes. Bought $180 worth of stuff that should sell for over $900.',
    handle: '@flippin_marcus',
    meta: 'full-time reseller, multi-platform',
  },
  {
    // [PLACEHOLDER — REPLACE BEFORE LAUNCH]
    quote:
      'I used to spend 20 minutes writing one listing. Now I do it in under a minute. Listed more in the last two weeks than the entire previous month.',
    handle: '@thriftqueenATL',
    meta: 'eBay, 200+ items/month',
  },
  {
    // [PLACEHOLDER — REPLACE BEFORE LAUNCH]
    quote:
      'Finally know what I actually made. ScanForProfit showed me I was underpricing electronics by 30%. Changed my whole strategy.',
    handle: '@thatvintageguy',
    meta: 'eBay, electronics specialist',
  },
] as const;

export default function SocialProofSection() {
  return (
    <section className="bg-sfp-header py-20">
      <div className="max-w-xl mx-auto px-6">
        {/* Proof stats — scan speed first, then uniqueness */}
        <div className="flex flex-wrap gap-x-10 gap-y-4 mb-14">
          <div>
            <p className="font-sans font-bold text-sfp-brand text-4xl tracking-tight">8s</p>
            <p className="font-mono text-sfp-border text-xs mt-1">avg scan-to-decision</p>
          </div>
          <div>
            <p className="font-sans font-bold text-sfp-background text-4xl tracking-tight">4 → 1</p>
            <p className="font-mono text-sfp-border text-xs mt-1">tools replaced</p>
          </div>
          <div>
            <p className="font-sans font-bold text-sfp-brand text-4xl tracking-tight">1 photo</p>
            <p className="font-mono text-sfp-border text-xs mt-1">scans an entire shelf</p>
          </div>
        </div>

        {/* PLACEHOLDER testimonials — replace all three before launch */}
        <div className="space-y-8 mb-12">
          {testimonials.map((t) => (
            <div key={t.handle} className="border-l-4 border-sfp-brand pl-5">
              <p className="font-mono text-sfp-background text-sm leading-relaxed mb-3">
                &ldquo;{t.quote}&rdquo;
              </p>
              <p>
                <span className="font-mono text-sfp-brand text-sm">{t.handle}</span>
                <span className="font-mono text-sfp-textMuted text-xs ml-2">— {t.meta}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="bg-sfp-surface rounded p-5">
          <p className="font-sans font-bold text-sfp-textPrimary text-sm mb-2">
            The shelf scan. Nothing else does this.
          </p>
          <p className="font-mono text-sfp-textSecondary text-xs leading-relaxed">
            One photo scans an entire shelf or table. Every item ranked by profit
            potential, fastest to flip first. Walk an estate sale in 3 minutes
            instead of 30.
          </p>
        </div>

        <p className="font-mono text-sfp-textMuted text-xs mt-10 text-center">
          Here's exactly what you get.
        </p>
      </div>
    </section>
  );
}
