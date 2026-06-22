function LogoMark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      fill="none"
      className="w-7 h-7 flex-shrink-0"
      aria-hidden="true"
    >
      <style>{`
        @keyframes sfp-pulse { 0%,100% { r:4; } 50% { r:8; } }
      `}</style>
      <circle cx="64" cy="64" r="56" stroke="#d4a843" strokeWidth="2.5" />
      <circle cx="64" cy="64" r="40" stroke="#00e676" strokeWidth="2.5" strokeDasharray="2.5 5" />
      <circle cx="64" cy="64" r="24" stroke="#d4a843" strokeWidth="2" />
      <line x1="24" y1="64" x2="104" y2="64" stroke="#00e676" strokeWidth="2.5" />
      <line x1="64" y1="24" x2="64" y2="104" stroke="#00e676" strokeWidth="2.5" />
      <circle cx="64" cy="64" r="4" fill="#00e676" style={{ animation: 'sfp-pulse 3s ease-in-out infinite' }} />
    </svg>
  );
}

export default function Nav() {
  return (
    <nav className="w-full px-6 py-4">
      <div className="max-w-xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark />
          <span className="font-sans text-xs tracking-[0.12em] text-sfp-background uppercase select-none">
            <span className="font-bold">SCAN</span>
            <span className="font-normal">FORPROFIT</span>
          </span>
        </div>

        <div className="flex items-center gap-5">
          <a
            href="#pricing"
            className="font-mono text-sm text-sfp-textMuted hover:text-sfp-background transition-colors duration-150"
          >
            Pricing
          </a>
          <a
            href="#waitlist"
            className="font-mono text-sm px-4 py-2 bg-sfp-brand text-sfp-textPrimary font-medium rounded hover:bg-sfp-brandDim active:scale-[0.97] min-h-[44px] inline-flex items-center"
            style={{ transition: 'all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
          >
            Get early access
          </a>
        </div>
      </div>
    </nav>
  );
}
