import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Roadmap — ScanForProfit',
  description: "What's coming to ScanForProfit.",
};

const shipped = [
  'Barcode scan → BUY / PASS / HOT decision',
  'Profit calculation after eBay fees',
  'eBay sold-listing comps on every scan',
  'Early access waitlist',
];

const building = [
  'Shelf scan — one photo, whole aisle ranked by profit',
  'Inventory tracker with cost basis',
  'One-tap listing copy for eBay',
  'Profit dashboard with realized gains',
];

const planned = [
  'Multi-marketplace listing (eBay → Facebook, Poshmark)',
  'Growth intelligence — what categories are heating up',
  'Team accounts for multi-seller households',
  'iOS and Android apps',
  'Export to CSV / Google Sheets',
];

export default function RoadmapPage() {
  return (
    <main className="bg-sfp-background min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="font-mono text-sfp-textMuted text-xs hover:text-sfp-textPrimary transition-colors mb-10 inline-block"
        >
          ← Back
        </Link>

        <h1 className="font-sans font-bold text-sfp-textPrimary text-3xl mb-2">Roadmap</h1>
        <p className="font-mono text-sfp-textMuted text-xs mb-10">
          What we're building and what's coming next.
        </p>

        <div className="space-y-10">
          <section>
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-sfp-brand text-xs tracking-widest uppercase">Shipped</span>
              <div className="flex-1 border-t border-sfp-border" />
            </div>
            <ul className="space-y-2">
              {shipped.map((item) => (
                <li key={item} className="font-mono text-sfp-textSecondary text-sm flex items-start gap-3">
                  <span className="text-sfp-brand mt-0.5 flex-shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-sfp-textPrimary text-xs tracking-widest uppercase">Building now</span>
              <div className="flex-1 border-t border-sfp-border" />
            </div>
            <ul className="space-y-2">
              {building.map((item) => (
                <li key={item} className="font-mono text-sfp-textSecondary text-sm flex items-start gap-3">
                  <span className="text-sfp-textMuted mt-0.5 flex-shrink-0">◐</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-sfp-textMuted text-xs tracking-widest uppercase">Planned</span>
              <div className="flex-1 border-t border-sfp-border" />
            </div>
            <ul className="space-y-2">
              {planned.map((item) => (
                <li key={item} className="font-mono text-sfp-textSecondary text-sm flex items-start gap-3">
                  <span className="text-sfp-textMuted mt-0.5 flex-shrink-0">○</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-14 bg-sfp-surface border border-sfp-border rounded p-5">
          <p className="font-sans font-semibold text-sfp-textPrimary text-sm mb-2">Want something on this list?</p>
          <p className="font-mono text-sfp-textSecondary text-xs leading-relaxed">
            Email us at{' '}
            <a href="mailto:feedback@scanforprofit.com" className="text-sfp-brand hover:underline">
              feedback@scanforprofit.com
            </a>
            . Feature requests from early access users get prioritized.
          </p>
        </div>
      </div>
    </main>
  );
}
