'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { PLANS } from '@/lib/plans';
import { supabase } from '@/lib/supabaseClient';

// Founder-first display order — same reasoning as components/PricingTable.jsx:
// this is a marketing-emphasis choice, separate from lib/plans.js's
// PLAN_ORDER (which exists for feature-gating logic).
const DISPLAY_ORDER = ['founder', 'solo', 'pro', 'team'];

export default function PlansPage() {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);

  // Read-only — never modifies auth state. If a real Supabase session
  // happens to exist, its email/id ride along with the checkout request
  // as optional metadata for a future webhook phase to use; checkout
  // works identically with no change to this app's auth flow either way.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data?.session || null));
  }, []);

  async function handleSubscribe(planKey) {
    setError('');
    setLoadingPlan(planKey);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planKey,
          email: session?.user?.email || undefined,
          clientReferenceId: session?.user?.id || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Could not start checkout.');
      }

      window.location.href = data.url;
    } catch (e) {
      setError(e.message || 'Could not start checkout.');
      setLoadingPlan(null);
    }
  }

  return (
    <main className="min-h-screen px-5 py-10 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Logo />
        <Link href="/dashboard" className="font-display font-semibold text-sm text-ink/70">
          Back to Dashboard
        </Link>
      </header>

      <h1 className="font-display font-extrabold text-3xl mb-2">Plans</h1>
      <p className="text-ink/60 mb-8 max-w-xl">
        Pick a plan to subscribe. You&apos;ll finish payment on Stripe&apos;s secure checkout page.
      </p>

      {error && (
        <p className="mb-6 text-sm font-semibold text-orange bg-orange/10 rounded-card px-4 py-3">
          {error}
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {DISPLAY_ORDER.map((key) => {
          const plan = PLANS[key];
          const isHighlight = key === 'founder';
          return (
            <div
              key={key}
              className={`rounded-card p-5 flex flex-col ${
                isHighlight ? 'border-2 border-orange bg-orange/5' : 'border border-line bg-white'
              }`}
            >
              {isHighlight && (
                <p className="text-[10px] font-display font-bold uppercase tracking-wide text-orange mb-2">
                  Best value while it lasts
                </p>
              )}
              <p className="font-display font-bold text-xl">{plan.label}</p>
              <p className="font-display font-extrabold text-3xl mt-1">{plan.price}</p>
              {plan.priceNote && <p className="text-xs text-ink/50 mt-0.5">{plan.priceNote}</p>}

              <ul className="mt-4 space-y-1.5 text-sm text-ink/75 flex-1">
                {plan.featureList.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className={isHighlight ? 'text-orange' : 'text-site'}>✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Plain native <button>, not BigButton — this is a primary
                  payment action and there's no ambiguity to risk here. */}
              <button
                type="button"
                onClick={() => handleSubscribe(key)}
                disabled={loadingPlan !== null}
                className={`tap-target w-full mt-5 rounded-card font-display font-bold text-base px-6
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isHighlight
                      ? 'bg-orange text-white hover:bg-orange-dark'
                      : 'bg-site text-white hover:bg-site-dark'
                  }`}
              >
                {loadingPlan === key ? 'Starting checkout…' : `Subscribe to ${plan.label}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-ink/40 mt-8 max-w-xl">
        Checkout is handled entirely by Stripe — card details never touch this app. After payment,
        you&apos;ll land on a confirmation page; account activation for a completed subscription is
        a separate step not built yet.
      </p>
    </main>
  );
}
