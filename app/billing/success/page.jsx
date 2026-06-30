'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { planLabel as planLabelFor, normalizePlan } from '@/lib/plans';
import { supabase } from '@/lib/supabaseClient';

// Webhook (app/api/stripe-webhook/route.js) is the actual source of
// truth for activation — this page never writes to Supabase. The
// optional /api/checkout-session-status lookup below is purely cosmetic
// (shows which plan Stripe recorded); if it fails for any reason, the
// page still shows a correct, honest confirmation without it.
export default function BillingSuccessPage() {
  const [sessionId, setSessionId] = useState(null);
  const [planKey, setPlanKey] = useState(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('session_id');
    setSessionId(id);
    if (!id) return;

    supabase?.auth.getSession()
      .then(({ data }) => {
        const token = data?.session?.access_token;
        return fetch(`/api/checkout-session-status?session_id=${encodeURIComponent(id)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      })
      .then((res) => (res?.ok ? res.json() : null))
      .then((data) => {
        // Plan keys are canonical now; normalize defensively in case an
        // older in-flight session still carried "team".
        if (data?.plan) setPlanKey(normalizePlan(data.plan));
      })
      .catch(() => {
        // Cosmetic only — a failed lookup just means the generic message
        // below is shown instead of the plan name. Never treated as an error.
      });
  }, []);

  const planLabel = planKey ? planLabelFor(planKey) : null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 text-center">
      <Logo size="lg" className="justify-center mb-6" />
      <p className="font-display font-bold text-2xl mb-2">Payment received 🎉</p>
      <p className="text-sm text-ink/60 max-w-sm mb-2">
        {planLabel
          ? `Thanks for subscribing to the ${planLabel} plan.`
          : 'Thanks for subscribing to SnapQuote.'}
      </p>
      <p className="text-sm text-ink/60 max-w-sm mb-6">
        Your plan is active. If your dashboard still shows the old plan, refresh once.
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
