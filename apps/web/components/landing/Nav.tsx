function LogoMark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className="w-7 h-7 flex-shrink-0"
      aria-hidden="true"
    >
      <path
        d="M3 13 V3 H13"
        stroke="#c9a468"
        strokeWidth="2.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M19 29 H29 V19"
        stroke="#c9a468"
        strokeWidth="2.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <rect x="6" y="21" width="4" height="6" fill="#00bb66" />
      <rect x="12" y="16" width="4" height="11" fill="#00bb66" />
      <rect x="18" y="11" width="4" height="16" fill="#00bb66" />
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
