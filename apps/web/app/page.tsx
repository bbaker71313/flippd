import Link from 'next/link';
import HeroSection from '@/components/landing/HeroSection';
import ProblemSection from '@/components/landing/ProblemSection';
import SocialProofSection from '@/components/landing/SocialProofSection';
import PricingSection from '@/components/landing/PricingSection';
import FaqSection from '@/components/landing/FaqSection';
import GuaranteeSection from '@/components/landing/GuaranteeSection';
import EmailCapture from '@/components/landing/EmailCapture';
import { softwareAppSchema, faqSchema } from '@/lib/schema';

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <ProblemSection />
      <SocialProofSection />
      <PricingSection />
      <FaqSection />
      <GuaranteeSection />

      <section id="waitlist" className="bg-sfp-header py-20">
        <div className="max-w-xl mx-auto px-6">
          <h2 className="font-sans font-bold text-sfp-background text-3xl mb-2">
            Get early access
          </h2>
          <p className="font-mono text-sfp-textMuted text-sm mb-8">
            Free to start. No credit card. Cancel anytime.
          </p>
          <EmailCapture />
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <footer className="bg-sfp-header border-t border-sfp-textSecondary/30 py-8">
        <div className="max-w-xl mx-auto px-6 flex items-center justify-between">
          <p className="font-mono text-sfp-textMuted text-xs">© 2026 ScanForProfit</p>
          <div className="flex gap-4">
            <Link href="/roadmap" className="font-mono text-sfp-textMuted text-xs hover:text-sfp-textSecondary transition-colors">Roadmap</Link>
            <Link href="/privacy" className="font-mono text-sfp-textMuted text-xs hover:text-sfp-textSecondary transition-colors">Privacy</Link>
            <Link href="/terms" className="font-mono text-sfp-textMuted text-xs hover:text-sfp-textSecondary transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
