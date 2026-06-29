// Feature gates only for the underlying mechanics — billing itself is
// real (see app/api/create-checkout-session/route.js and
// app/api/stripe-webhook/route.js). A contractor's plan is stored on
// their contractors row (Supabase) or settings.plan (localStorage demo
// mode) and read here to decide what to show.
//
// price/priceNote/featureList are pure display data for the pricing
// comparison (landing page, /plans, Settings) — they don't drive any
// gating logic themselves. The `features` object below is what
// hasFeature() actually checks, and what lib/routeAccess.js's
// canAccessRoute() builds on.
//
// Stripe plan-key mapping: Stripe-facing checkout uses
// founder/solo/pro/teams (see STRIPE_PRICE_FOUNDER/SOLO/PRO/TEAMS and
// app/api/create-checkout-session/route.js) — note "teams" is plural
// there. This file's own key has been "team" (singular) since it was
// first built; renaming it now would touch every gate check across the
// app for no functional gain, so the checkout route is the one place
// that translates between the two. The webhook trusts whatever plan key
// arrives in Stripe metadata (which the checkout route already wrote as
// "team", singular) and writes it to Supabase as-is — Stripe metadata
// and the Supabase `plan` column use the same value by the time either
// one is read.

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
      'Limited estimate history',
    ],
    features: {
      aiEstimates: true,
      branding: false,
      history: false, // "limited" in practice — Dashboard caps history at SOLO_HISTORY_LIMIT (5) rather than hiding it outright
      sharing: false,
      multiUser: false,
      founderPricing: false,
    },
  },
  // Limited-time early-access tier — see the landing page's Founding
  // Contractor offer and /plans. Unlocks everything currently active
  // through Pro at a fixed $10/month, for the first 10 active
  // subscribers only (lib/founderSeats.js + count_active_founder_subscribers()
  // in supabase/schema.sql enforce the cap). No payment is faked here —
  // this is the real Stripe Price configured via STRIPE_PRICE_FOUNDER.
  founder: {
    label: 'Founding Contractor',
    tagline: 'First 10 only. $10/month — unlocks everything active through Pro.',
    price: '$10/mo',
    priceNote: 'Limited to first 10 subscribers',
    featureList: [
      'Everything currently active through Pro',
      'Founder badge',
      'Discounted future upgrades',
      'First 10 only',
    ],
    features: {
      aiEstimates: true,
      branding: true,
      history: true,
      sharing: true,
      multiUser: false, // Founder = Pro-level access, not Teams-level multi-user
      founderPricing: true,
    },
  },
  pro: {
    label: 'Pro',
    tagline: 'Full branding, complete estimate history, and sharing.',
    price: '$59/mo',
    priceNote: 'Everything in Solo, plus:',
    featureList: [
      'Everything in Solo',
      'Full branding',
      'Warranty and terms templates',
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
    label: 'Teams',
    tagline: 'Everything in Pro, plus multi-user support for your crew.',
    price: '$99/mo',
    priceNote: 'Everything in Pro, plus:',
    featureList: [
      'Everything in Pro',
      'Up to 3 users',
      'Shared dashboard',
      'Team estimate history',
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
  // Admin — a DATABASE-ONLY role, never sold and never purchasable through
  // Stripe (there is no STRIPE_PRICE_ADMIN and no Plans-page button for it
  // on purpose). The only way a contractor becomes 'admin' is a manual
  // update run against Supabase by someone with service-role/SQL access
  // (see the README and SQL migration). Because the contractors.plan
  // column is writable only by the service-role webhook client — never by
  // the logged-in user themselves (see policies.sql) — a user cannot make
  // themselves admin from the browser any more than they can grant
  // themselves Pro.
  //
  // Admin unlocks EVERYTHING: every feature flag below is true, and
  // canAccessRoute() (lib/routeAccess.js) treats admin as able to reach
  // every route, including the Teams-only sections. It is intentionally
  // NOT shown anywhere in the pricing comparison UI (PricingTable, /plans,
  // Settings tier picker all iterate explicit display orders that omit it).
  admin: {
    label: 'Admin',
    tagline: 'Internal administrator — full access, not a purchasable plan.',
    price: '',
    priceNote: '',
    featureList: [
      'Full access to every feature',
      'No subscription required',
    ],
    features: {
      aiEstimates: true,
      branding: true,
      history: true,
      sharing: true,
      multiUser: true,
      founderPricing: false, // admin isn't a Founder; this flag drives Founder-only badge copy
    },
  },
};

// Feature-gating order only. Deliberately excludes 'admin' — admin is
// handled as an unlock-everything special case in hasFeature() below and
// in canAccessRoute(), and including it here would make planThatUnlocks()
// suggest "Admin" as the upsell tier for a locked feature, which is wrong.
export const PLAN_ORDER = ['solo', 'founder', 'pro', 'team'];

export function hasFeature(plan, feature) {
  // Admin unlocks everything — including any feature flag added in the
  // future that someone forgets to set true on the admin entry above.
  // This is the single source of that guarantee; don't rely on the
  // per-flag booleans alone.
  if (plan === 'admin') return true;
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

// ─────────────────────────────────────────────────────────
// Founder upgrade-step pricing — STRUCTURE AND DOCUMENTATION ONLY.
// No billing logic here actually changes anyone's price; this exists so
// the policy is unambiguous and visible in code before it's ever wired
// to a real Stripe Price change.
//
// Policy: "Founders keep the lowest base plan and get discounted upgrade
// steps as new paid features launch." Concretely: if a future paid
// tier/add-on launches above what Founder already includes (today, that
// ceiling is Pro), a Founder subscriber's upgrade price for that new
// thing should increase in fixed, fair $10 steps from their current
// $10/month — NOT jump straight to that tier's full public price the way
// a non-Founder subscriber's would.
//
// Worked example (illustrative — none of this is implemented yet): if a
// hypothetical future "Premium" tier launched at $89/mo publicly, a
// Founder upgrading into it would step from $10 -> $20 -> $30, etc.,
// rather than $10 -> $89 in one jump. The exact step size, how many
// steps, and which future tier(s) this applies to are intentionally left
// for whoever actually builds that tier to decide — this section is the
// documented commitment, not the implementation.
// ─────────────────────────────────────────────────────────
export const FOUNDER_UPGRADE_STEP_USD = 10;

// Returns the documented upgrade-step policy as a plain object — not
// wired to Stripe, not used to compute a real price anywhere yet. A
// future pass building real future-tier billing should start from here
// rather than re-deciding the policy.
export function founderUpgradePolicy() {
  return {
    stepUsd: FOUNDER_UPGRADE_STEP_USD,
    description:
      'Founders keep the lowest base plan and get discounted upgrade steps as new paid features launch.',
    implemented: false,
  };
}
