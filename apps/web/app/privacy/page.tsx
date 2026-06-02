import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — ScanForProfit',
  description: 'How ScanForProfit collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <main className="bg-sfp-background min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="font-mono text-sfp-textMuted text-xs hover:text-sfp-textPrimary transition-colors mb-10 inline-block"
        >
          ← Back
        </Link>

        <h1 className="font-sans font-bold text-sfp-textPrimary text-3xl mb-2">Privacy Policy</h1>
        <p className="font-mono text-sfp-textMuted text-xs mb-10">Last updated: June 2, 2026</p>

        <div className="space-y-8 font-mono text-sfp-textSecondary text-sm leading-relaxed">
          <section>
            <h2 className="font-sans font-semibold text-sfp-textPrimary text-base mb-3">What we collect</h2>
            <p>
              When you sign up for early access, we collect your email address. When you use the app,
              we collect scan data (barcodes and search queries), inventory items you create, and usage
              analytics to improve the product. We do not sell your data.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-sfp-textPrimary text-base mb-3">How we use it</h2>
            <p>
              Your email is used to notify you about early access and product updates. Scan and
              inventory data powers your personal profit dashboard and is never shared with third
              parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-sfp-textPrimary text-base mb-3">Third-party services</h2>
            <p>
              We use Supabase for data storage, Stripe for payments, and PostHog for product
              analytics. Each service operates under its own privacy policy. We use eBay's public
              sold-listing data to power scan results — no personal information is shared with eBay.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-sfp-textPrimary text-base mb-3">Your data, your export</h2>
            <p>
              You can export your full inventory at any time from the app. If you delete your account,
              your personal data is removed within 30 days. Anonymized, aggregated analytics data may
              be retained.
            </p>
          </section>

          <section>
            <h2 className="font-sans font-semibold text-sfp-textPrimary text-base mb-3">Contact</h2>
            <p>
              Questions about your data? Email us at{' '}
              <a
                href="mailto:privacy@scanforprofit.com"
                className="text-sfp-brand hover:underline"
              >
                privacy@scanforprofit.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
