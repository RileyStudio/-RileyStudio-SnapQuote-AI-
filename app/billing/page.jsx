'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabaseClient';
import { planLabel } from '@/lib/plans';

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [contractor, setContractor] = useState(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('contractors')
        .select('plan, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end, founder_overflow')
        .eq('id', userId)
        .maybeSingle();
      setContractor(data || null);
      setLoading(false);
    }
    load();
  }, []);

  async function handleOpenPortal() {
    setError('');
    setOpeningPortal(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        setError('You must be logged in to manage billing.');
        setOpeningPortal(false);
        return;
      }

      const response = await fetch('/api/create-billing-portal-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Could not open billing portal.');
      }

      window.location.href = data.url;
    } catch (e) {
      setError(e.message || 'Could not open billing portal.');
      setOpeningPortal(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-ink/50">Loading…</p>
      </main>
    );
  }

  if (!contractor) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5 text-center">
        <Logo size="lg" className="justify-center mb-6" />
        <p className="text-sm text-ink/60 max-w-sm mb-6">
          Log in to manage your billing, or subscribe to a plan first.
        </p>
        <Link
          href="/login"
          className="tap-target inline-flex items-center justify-center rounded-card bg-orange
            text-white font-display font-bold text-base px-8 hover:bg-orange-dark transition-colors"
        >
          Log in
        </Link>
      </main>
    );
  }

  // Single source of truth: the contractor row written by the Stripe
  // webhook. We deliberately do NOT fall back to Solo when plan is missing —
  // that fallback is exactly what made a just-subscribed (or Teams) user
  // see "$29 / Solo". Instead we model three honest states:
  //   - hasSubscription: an active/known paid plan is on the row.
  //   - isProcessing: payment happened (a Stripe customer or subscription id
  //     exists) but the webhook hasn't written an active plan yet.
  //   - neither: never subscribed.
  const rawPlan = contractor.plan;
  const status = contractor.subscription_status;
  const startedCheckout = Boolean(
    contractor.stripe_customer_id || contractor.stripe_subscription_id
  );
  // A plan is "real/active" only if there's an active-ish status backing it.
  // 'admin' is always real (no Stripe needed).
  const activeStatuses = ['active', 'trialing', 'past_due'];
  const planIsActive =
    rawPlan === 'admin' ||
    (Boolean(rawPlan) && activeStatuses.includes(status));

  // Processing: they paid (Stripe ids present) but no active plan recorded
  // yet — the webhook may still be in flight. A terminal status
  // (canceled/unpaid/etc.) is NOT processing — that's a former subscriber,
  // and telling them to "refresh in a moment" would loop forever.
  const terminalStatuses = ['canceled', 'unpaid', 'incomplete_expired'];
  const isTerminal = terminalStatuses.includes(status);
  const isProcessing = !planIsActive && startedCheckout && !isTerminal;

  const planDisplay = planIsActive ? planLabel(rawPlan) : null;

  return (
    <main className="min-h-screen px-5 py-10 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Logo />
        <Link href="/dashboard" className="font-display font-semibold text-sm text-ink/70">
          Back to Dashboard
        </Link>
      </header>

      <h1 className="font-display font-extrabold text-3xl mb-6">Billing</h1>

      <div className="bg-white rounded-card shadow-card p-5 mb-6">
        <p className="font-display text-xs uppercase tracking-wide text-ink/50 font-semibold mb-1">
          Current plan
        </p>

        {planIsActive ? (
          <p className="font-display font-bold text-xl mb-3">Current plan: {planDisplay}</p>
        ) : isProcessing ? (
          <p className="font-display font-bold text-base mb-3 text-orange-dark">
            Plan activation is processing. Refresh in a moment.
          </p>
        ) : (
          <p className="font-display font-bold text-xl mb-3">No active plan</p>
        )}

        {contractor.founder_overflow && (
          <p className="text-xs text-orange-dark mb-3">
            We received your payment, but all Founder seats were taken at activation. Our team
            will reach out to resolve this — you haven&apos;t lost anything.
          </p>
        )}

        {/* Status + renewal only make sense once something real exists. */}
        {(planIsActive || isProcessing) && (
          <>
            <p className="font-display text-xs uppercase tracking-wide text-ink/50 font-semibold mb-1">
              Subscription status
            </p>
            <p className="text-sm text-ink/80">
              {contractor.subscription_status || 'Processing…'}
            </p>
          </>
        )}

        {planIsActive && contractor.current_period_end && (
          <>
            <p className="font-display text-xs uppercase tracking-wide text-ink/50 font-semibold mb-1 mt-3">
              {contractor.cancel_at_period_end ? 'Access ends' : 'Renews'}
            </p>
            <p className="text-sm text-ink/80">
              {new Date(contractor.current_period_end).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            {contractor.cancel_at_period_end && (
              <p className="text-xs text-orange-dark mt-1">
                Your subscription is set to cancel at the end of the current period.
              </p>
            )}
          </>
        )}
      </div>

      {error && (
        <p className="mb-4 text-sm font-semibold text-orange bg-orange/10 rounded-card px-4 py-3">
          {error}
        </p>
      )}

      {contractor.stripe_customer_id ? (
        <button
          type="button"
          onClick={handleOpenPortal}
          disabled={openingPortal}
          className="tap-target w-full rounded-card bg-orange text-white font-display font-bold
            text-lg px-6 hover:bg-orange-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {openingPortal ? 'Opening…' : 'Manage Billing'}
        </button>
      ) : (
        <Link
          href="/plans"
          className="tap-target w-full flex items-center justify-center rounded-card bg-orange
            text-white font-display font-bold text-lg px-6 hover:bg-orange-dark transition-colors"
        >
          Choose a Plan
        </Link>
      )}
    </main>
  );
}
