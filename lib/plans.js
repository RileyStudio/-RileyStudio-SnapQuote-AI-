// Feature gates only — no Stripe, no billing. A contractor's plan is just
// a stored value (Settings → contractors.plan in Supabase, or
// settings.plan in localStorage demo mode) that the app reads to decide
// what to show. Switching plans here is instant and free, by design — the
// gates are real, but enforcing payment for them is a future phase.
//
// price/priceNote/featureList are pure display data for the pricing
// comparison (landing page + Settings) — they don't drive any gating
// logic themselves. The `features` object below is what hasFeature()
// actually checks.

export const PLANS = {
  solo: {
    label: 'Solo',
    tagline: 'AI-assisted estimates, nothing else turned on yet.',
    price: '$29/mo',
    priceNote: '',
    featureList: [
      '1 user',
      'AI estimate drafting',
      'PDF exports',
      'Customer approval links',
      'Saved estimates',
      'Basic branding',
    ],
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
    price: '$10/mo',
    priceNote: 'Locked for the first 10 customers',
    featureList: [
      '1 user',
      'AI estimate drafting',
      'Branded quotes',
      'PDF exports',
      'Customer approval links',
      'Saved estimate history',
      'Share by email/text link',
      'Future features at discounted access',
    ],
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
    price: '$59/mo',
    priceNote: 'Everything in Solo, plus:',
    featureList: [
      '1 user',
      'AI estimate drafting',
      'PDF exports',
      'Customer approval links',
      'Saved estimates',
      'Advanced branding',
      'Warranty/terms templates',
      'Customer history',
      'Share by email/text link',
      'Priority feature access',
    ],
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
    price: '$99/mo',
    priceNote: 'Everything in Pro, plus:',
    featureList: [
      'Up to 3 users',
      'AI estimate drafting',
      'PDF exports',
      'Customer approval links',
      'Saved estimates',
      'Advanced branding',
      'Warranty/terms templates',
      'Team estimate history',
      'Share by email/text link',
      'Priority feature access',
      'Shared dashboard',
      'Role-ready structure',
    ],
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
