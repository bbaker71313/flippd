export default function GuaranteeSection() {
  return (
    <section className="bg-sfp-bg py-20">
      <div className="max-w-[640px] mx-auto px-6 text-center">
        <h2 className="font-sans font-bold text-sfp-body text-2xl sm:text-3xl mb-4">
          You don't have to trust us.
        </h2>
        <p className="font-mono text-sfp-secondary text-sm leading-relaxed mb-4 max-w-md mx-auto">
          Start with the free tier. 25 scans. No card required. If it's not
          faster than whatever you're doing now, don't upgrade.
        </p>
        <p className="font-mono text-sfp-muted text-sm mb-10">
          Export your inventory anytime. Your data leaves with you.
        </p>

        <a
          href="#waitlist"
          className="inline-flex items-center px-8 py-4 bg-sfp-green text-sfp-body font-sans font-bold text-base rounded hover:bg-sfp-green-dim active:scale-[0.97] min-h-[44px]"
          style={{ transition: 'all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
        >
          Get early access — free to start
        </a>
      </div>
    </section>
  );
}
