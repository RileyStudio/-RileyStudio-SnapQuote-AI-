'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';

// No webhook yet (out of scope for this pass) — this page is purely a
// confirmation screen for whoever just finished Stripe Checkout. It does
// not verify the session server-side, does not touch Supabase, and does
// not activate anything; it just reads ?session_id= for display.
export default function BillingSuccessPage() {
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    setSessionId(new URLSearchParams(window.location.search).get('session_id'));
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 text-center">
      <Logo size="lg" className="justify-center mb-6" />
      <p className="font-display font-bold text-2xl mb-2">You&apos;re subscribed 🎉</p>
      <p className="text-sm text-ink/60 max-w-sm mb-6">
        Thanks for becoming a SnapQuote customer. Account activation for your subscription is a
        separate step not built yet — check back soon.
      </p>
      {sessionId && (
        <p className="text-xs text-ink/40 mb-6 break-all">Reference: {sessionId}</p>
      )}
      <Link
        href="/dashboard"
        className="tap-target inline-flex items-center justify-center rounded-card bg-orange
          text-white font-display font-bold text-base px-8 hover:bg-orange-dark transition-colors"
      >
        Go to Dashboard
      </Link>
    </main>
  );
}
