'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { PLANS, normalizePlan } from '@/lib/plans';
import { supabase } from '@/lib/supabaseClient';
import { FOUNDER_SEAT_TOTAL, getFounderSeatDisplay } from '@/lib/founderSeats';

// Founder-first display order (marketing emphasis). All keys are canonical
// now — same form Stripe, metadata, and the contractors.plan column use.
const DISPLAY_ORDER = ['founder', 'solo', 'pro', 'teams'];

// Rank used to decide "Upgrade" vs "Change plan" relative to the user's
// current plan. Founder sits at Pro-level value, so it ranks with Pro for
// this comparison. Admin outranks everything (never sees an upsell).
const PLAN_RANK = { solo: 1, founder: 3, pro: 3, teams: 4, admin: 99 };

export default function PlansPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  // Current plan of the logged-in user, read from the contractor row (the
  // webhook-maintained source of truth). null = not loaded / not logged in.
  const [currentPlan, setCurrentPlan] = useState(null);
  // Seat display fails open to a friendly full-seats default — never "—".
  const [founderSeats, setFounderSeats] = useState({
    activeFounderCount: 0,
    remainingFounderSeats: FOUNDER_SEAT_TOTAL,
    soldOut: false,
  });

  useEffect(() => {
    if (!supabase) {
      setSessionChecked(true);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      const sess = data?.session || null;
      setSession(sess);
      setSessionChecked(true);
      if (sess?.user?.id) {
        const { data: row } = await supabase
          .from('contractors')
          .select('plan, subscription_status')
          .eq('id', sess.user.id)
          .maybeSingle();
        // Only treat the plan as "current" if it's actually active (or
        // admin). A row with no active status shouldn't mark a card as the
        // user's current plan.
        const activeStatuses = ['active', 'trialing', 'past_due'];
        if (row?.plan === 'admin') {
          setCurrentPlan('admin');
        } else if (row?.plan && activeStatuses.includes(row.subscription_status)) {
          setCurrentPlan(normalizePlan(row.plan));
        } else {
          setCurrentPlan(null);
        }
      }
    });
  }, []);

  useEffect(() => {
    getFounderSeatDisplay().then(setFounderSeats);
  }, []);

  const founderSeatsRemaining = founderSeats.remainingFounderSeats;
  const founderSoldOut = founderSeats.soldOut;
  const userIsFounder = currentPlan === 'founder';

  async function handleSubscribe(planKey) {
    setError('');

    if (!session) {
      router.push('/login');
      return;
    }

    if (planKey === 'founder' && founderSoldOut && !userIsFounder) {
      setError('Founder seats are sold out.');
      return;
    }

    setLoadingPlan(planKey);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        // Plan keys are canonical end-to-end now — no translation needed.
        body: JSON.stringify({ plan: planKey }),
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

  // Decide what a given plan card's button should say/do relative to the
  // user's current plan.
  function cardAction(key) {
    const isCurrent = currentPlan && normalizePlan(currentPlan) === key;
    if (isCurrent) return { kind: 'current', label: 'Current plan' };

    // Founder sold out and the user isn't already founder → sold out.
    if (key === 'founder' && founderSoldOut && !userIsFounder) {
      return { kind: 'soldout', label: 'Sold out' };
    }

    if (!currentPlan) {
      // Not subscribed (or not logged in): straightforward subscribe.
      return { kind: 'subscribe', label: session ? `Subscribe to ${PLANS[key].label}` : 'Log in to subscribe' };
    }

    const here = PLAN_RANK[key] ?? 0;
    const mine = PLAN_RANK[normalizePlan(currentPlan)] ?? 0;
    if (here > mine) return { kind: 'upgrade', label: 'Upgrade' };
    // Lower or side-grade → manage via billing portal rather than a fresh
    // checkout (Stripe portal handles downgrades/swaps cleanly).
    return { kind: 'manage', label: 'Change plan' };
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

      {currentPlan && (
        <p className="text-sm font-display font-bold text-ink mb-2">
          Current plan: {PLANS[normalizePlan(currentPlan)]?.label || 'Solo'}
        </p>
      )}

      <p className="text-ink/60 mb-2 max-w-xl">
        Pick a plan to subscribe. You&apos;ll finish payment on Stripe&apos;s secure checkout page.
      </p>
      <p className="text-ink/60 mb-2 max-w-xl">
        Founder includes active Pro-level features for $10/month while seats remain.
      </p>
      <p className="text-sm font-display font-semibold text-orange-dark mb-8">
        {`${founderSeatsRemaining} of ${FOUNDER_SEAT_TOTAL} Founder seats remaining`}
      </p>

      {error && (
        <p className="mb-6 text-sm font-semibold text-orange bg-orange/10 rounded-card px-4 py-3">
          {error}
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {DISPLAY_ORDER.map((key) => {
          // Founder card visibility: show only if seats remain OR the user
          // is already founder. Otherwise it's hidden entirely (never shown
          // below/inside Teams, never as a stray current-plan badge).
          if (key === 'founder' && founderSoldOut && !userIsFounder) {
            return null;
          }

          const plan = PLANS[key];
          const isHighlight = key === 'founder';
          const action = cardAction(key);
          const isCurrent = action.kind === 'current';
          const isDisabled =
            loadingPlan !== null || action.kind === 'soldout' || isCurrent;

          return (
            <div
              key={key}
              className={`rounded-card p-5 flex flex-col ${
                isCurrent
                  ? 'border-2 border-site bg-site/5'
                  : isHighlight
                    ? 'border-2 border-orange bg-orange/5'
                    : 'border border-line bg-white'
              }`}
            >
              {isCurrent ? (
                <p className="text-[10px] font-display font-bold uppercase tracking-wide text-site mb-2">
                  Your plan
                </p>
              ) : isHighlight ? (
                <p className="text-[10px] font-display font-bold uppercase tracking-wide text-orange mb-2">
                  Best value while it lasts
                </p>
              ) : null}

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

              {action.kind === 'manage' ? (
                <Link
                  href="/billing"
                  className="tap-target w-full mt-5 flex items-center justify-center rounded-card
                    font-display font-bold text-base px-6 bg-site text-white hover:bg-site-dark transition-colors"
                >
                  Change plan
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubscribe(key)}
                  disabled={isDisabled}
                  className={`tap-target w-full mt-5 rounded-card font-display font-bold text-base px-6
                    transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isHighlight
                        ? 'bg-orange text-white hover:bg-orange-dark'
                        : 'bg-site text-white hover:bg-site-dark'
                    }`}
                >
                  {loadingPlan === key
                    ? 'Starting checkout…'
                    : !sessionChecked
                      ? 'Subscribe'
                      : action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-ink/40 mt-8 max-w-xl">
        Checkout is handled entirely by Stripe — card details never touch this app. After payment,
        you&apos;ll land on a confirmation page while your plan activates.
      </p>
    </main>
  );
}
