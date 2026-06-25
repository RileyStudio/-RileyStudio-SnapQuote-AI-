// Feature gates only — no Stripe, no billing. A contractor's plan is just
// a stored value (Settings → contractors.plan in Supabase, or
// settings.plan in localStorage demo mode) that the app reads to decide
// what to show. Switching plans here is instant and free, by design — the
// gates are real, but enforcing payment for them is a future phase.

export const PLANS = {
  solo: {
    label: 'Solo',
    tagline: 'AI-assisted estimates, nothing else turned on yet.',
    features: {
      aiEstimates: true,
      branding: false,
      history: false,
      sharing: false,
      multiUser: false,
      founderPricing: false,
    },
  },
  // Limited-time early-access tier — see the landing page's Founding
  // Contractor offer. Unlocks the same things Pro does (branding,
  // history, sharing) at locked-in founder pricing, plus the
  // founderPricing flag that turns on the "locked for life" copy in
  // Settings. No payment is actually collected here — see Stripe note above.
  founder: {
    label: 'Founding Contractor',
    tagline: 'First 10 only. $10/month locked for life while subscribed.',
    features: {
      aiEstimates: true,
      branding: true,
      history: true,
      sharing: true,
      multiUser: false,
      founderPricing: true,
    },
  },
  pro: {
    label: 'Pro',
    tagline: 'Full branding, complete estimate history, and sharing.',
    features: {
      aiEstimates: true,
      branding: true,
      history: true,
      sharing: true,
      multiUser: false,
      founderPricing: false,
    },
  },
  team: {
    label: 'Team',
    tagline: 'Everything in Pro, plus multi-user support for your crew.',
    features: {
      aiEstimates: true,
      branding: true,
      history: true,
      sharing: true,
      multiUser: true,
      founderPricing: false,
    },
  },
};

export const PLAN_ORDER = ['solo', 'founder', 'pro', 'team'];

export function hasFeature(plan, feature) {
  return Boolean(PLANS[plan]?.features?.[feature]);
}

export function planLabel(plan) {
  return PLANS[plan]?.label || PLANS.solo.label;
}

// The lowest plan that unlocks a given feature — used for upsell copy
// ("Available on the Pro plan") without hardcoding the tier name in UI code.
export function planThatUnlocks(feature) {
  return PLAN_ORDER.find((p) => PLANS[p].features[feature]) || null;
}
