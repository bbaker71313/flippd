'use client';

import { useState } from 'react';

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

export default function EmailCapture() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<SubmitState>('idle');

  const submit = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) return;
    setState('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      setState(res.ok ? 'success' : 'error');
    } catch {
      setState('error');
    }
  };

  if (state === 'success') {
    return (
      <p
        className="font-mono text-sfp-green text-base"
        style={{ transition: 'opacity 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
      >
        You're on the list. We'll email you when early access opens.
      </p>
    );
  }

  return (
    <div className="w-full max-w-lg">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Your email"
          disabled={state === 'loading'}
          className={[
            'flex-1 px-4 py-3 font-mono text-sm rounded min-h-[44px]',
            'bg-sfp-body text-sfp-bg placeholder:text-sfp-muted',
            'border-2 focus:outline-none',
            'transition-colors duration-150 disabled:opacity-60',
            state === 'error'
              ? 'border-sfp-loss'
              : 'border-sfp-secondary focus:border-sfp-green',
          ].join(' ')}
        />
        <button
          onClick={submit}
          disabled={state === 'loading'}
          className="px-6 py-3 bg-sfp-green text-sfp-body font-sans font-bold text-sm rounded min-h-[44px] hover:bg-sfp-green-dim active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
          style={{ transition: 'all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
        >
          {state === 'loading' ? (
            <span className="opacity-70 animate-pulse">Sending...</span>
          ) : (
            'Get early access'
          )}
        </button>
      </div>
      {state === 'error' && (
        <p
          className="font-mono text-sfp-loss text-xs mt-2"
          style={{ transition: 'opacity 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
        >
          Something went wrong. Try again.
        </p>
      )}
    </div>
  );
}
