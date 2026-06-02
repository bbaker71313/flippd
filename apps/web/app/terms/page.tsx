import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — ScanForProfit',
  description: 'Terms of service for using ScanForProfit.',
};

export default function TermsPage() {
  return (
    <main className="bg-sfp-background min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="font-mono text-sfp-textMuted text-xs hover:text-sfp-textPrimary transition-colors mb-10 inline-block"
        >
          ← Back
        </Link>

        <h1 className="font-sans font-bold text-sfp-textPrimary text-3xl mb-2">Terms of Service</h1>
        <p className="font-mono text-sfp-textMuted text-xs mb-10">Last updated: June 2, 2026</p>

        <div className="space-y-8 font-mono text-sfp-textSecondary text-sm leading-relaxed">
          <section>
            <h2 className="font-sans font-semibold text-sfp-textPrimary text-base mb-3">Acceptance</h2>
            <p>
              By using ScanForProfit, you agree to these terms. If you don't agree, don't use the
              service. These terms may change — we'll email you if anything significant shifts.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-sfp-textPrimary text-base mb-3">What ScanForProfit is</h2>
            <p>
              ScanForProfit is a tool that pulls publicly available eBay sold-listing data to help
              resellers estimate profit potential. Scan results are estimates based on historical data
              — not guarantees of future sale prices. You make the final call on every purchase.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-sfp-textPrimary text-base mb-3">Your account</h2>
            <p>
              You're responsible for keeping your credentials secure. One account per person.
              Don't use the service to scrape eBay at scale, resell access, or do anything that
              would violate eBay's terms of service or applicable law.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-sfp-textPrimary text-base mb-3">Payments and cancellation</h2>
            <p>
              Paid plans are billed monthly or annually via Stripe. You can cancel at any time — no
              penalty, no questions. Your paid access continues through the end of your billing
              period. Refunds are handled case by case; email us within 7 days of a charge if
              something went wrong.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-sfp-textPrimary text-base mb-3">Limitation of liability</h2>
            <p>
              ScanForProfit is provided as-is. We're not liable for purchasing decisions you make
              based on scan results. In no event will our liability exceed the amount you paid us
              in the 3 months prior to any claim.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-sfp-textPrimary text-base mb-3">Contact</h2>
            <p>
              Questions?{' '}
              <a
                href="mailto:support@scanforprofit.com"
                className="text-sfp-brand hover:underline"
              >
                support@scanforprofit.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
