'use client';

import { useState } from 'react';

const faqs = [
  {
    q: 'What if the scan gets the price wrong?',
    a: "ScanForProfit pulls from recent eBay sold listings — the same data professional resellers use. It can't predict the future, but it gives you a data-backed number in 8 seconds instead of a guess in 5 minutes. You still make the call.",
  },
  {
    q: "I already have eBay's app. Why pay for this?",
    a: "eBay's app searches for you. ScanForProfit decides for you. It calculates profit after fees, ranks items by margin, writes your listing copy, and tracks what you actually made. Those are four things eBay's app doesn't do.",
  },
  {
    q: 'Does it work for the random stuff I find — not just electronics?',
    a: 'Yes. ScanForProfit is built for the long tail of reselling: housewares, tools, vintage items, clothing, toys, collectibles. If it has a sold history on eBay, you get a number. If it does not, you get a signal that the market is thin.',
  },
  {
    q: "I'm not technical. How hard is this to set up?",
    a: "Download the app. Tap the scan button. Point your camera. That's it. If you can use eBay's app, you can use ScanForProfit.",
  },
  {
    q: 'If I cancel, do I lose my inventory history?',
    a: 'No. You can export your full inventory at any time — before or after cancelling. Your data is yours.',
  },
] as const;

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="bg-sfp-surface py-20">
      <div className="max-w-xl mx-auto px-6">
        <h2 className="font-sans font-bold text-sfp-textPrimary text-2xl mb-8">
          The questions most resellers have.
        </h2>

        <div>
          {faqs.map((faq, i) => (
            <div key={i} className="border-b border-sfp-border last:border-0">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                className="w-full flex items-center justify-between py-5 text-left min-h-[44px] gap-4"
              >
                <span className="font-sans font-semibold text-sfp-textPrimary text-sm">
                  {faq.q}
                </span>
                <span
                  className="font-mono text-sfp-textMuted text-xl leading-none flex-shrink-0 select-none inline-block"
                  style={{
                    transform: open === i ? 'rotate(45deg)' : 'rotate(0deg)',
                    transition: 'transform 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  }}
                >
                  +
                </span>
              </button>
              {open === i && (
                <p className="font-mono text-sfp-textSecondary text-sm leading-relaxed pb-5">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
