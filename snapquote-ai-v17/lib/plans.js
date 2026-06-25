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
      notifications: false,
      multiUser: false,
    },
  },
  pro: {
    label: 'Pro',
    tagline: 'Full branding, complete estimate history, and email notifications.',
    features: {
      aiEstimates: true,
      branding: true,
      history: true,
      notifications: true,
      multiUser: false,
    },
  },
  team: {
    label: 'Team',
    tagline: 'Everything in Pro, plus multi-user support for your crew.',
    features: {
      aiEstimates: true,
      branding: true,
      history: true,
      notifications: true,
      multiUser: true,
    },
  },
};

export const PLAN_ORDER = ['solo', 'pro', 'team'];

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
