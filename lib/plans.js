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
// Plan key — SINGLE CANONICAL FORM. The whole app, the Stripe-facing
// checkout, the Stripe metadata, and the Supabase `contractors.plan`
// column now all use the SAME keys:
//
//     admin | founder | solo | pro | teams
//
// "teams" is plural everywhere — there is no longer a singular "team"
// internal key. (An earlier version of this app used singular "team"
// internally while Stripe used plural "teams", and translated between
// them in the checkout route. That split was the direct cause of a bug
// where a Teams subscriber's UI silently read as "Solo": a stored
// "teams" missed the singular "team" PLANS entry, and planLabel() fell
// back to Solo. It's fixed by normalizing to one key.)
//
// Any value read from storage still passes through normalizePlan() below
// so a legacy "team" row written before this change maps cleanly to
// "teams" — no data migration is strictly required for correctness,
// though the SQL migration does convert old rows too.
//
// price/priceNote/featureList are pure display data. The `features`
// object is what hasFeature() checks and what canAccessRoute() builds on.

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
  teams: {
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
export const PLAN_ORDER = ['solo', 'founder', 'pro', 'teams'];

// The set of plan keys a real (non-demo) authenticated account can hold.
export const KNOWN_PLANS = ['admin', 'founder', 'solo', 'pro', 'teams'];

// Normalize ANY plan value read from storage / metadata / a stale client
// into one canonical key. This is the single guard that makes the whole
// "one source of truth" guarantee hold even if some old data or some
// other code path still says "team":
//   - legacy singular "team"      -> "teams"
//   - a known key                 -> itself
//   - null / undefined / unknown  -> "solo" (safe floor; never crashes a
//                                    label lookup, never over-grants)
// 'demo' is intentionally NOT forced to solo here — callers that care
// about demo handle it explicitly (canAccessRoute), and most authenticated
// reads never see 'demo' at all.
export function normalizePlan(plan) {
  if (plan === 'team') return 'teams';
  if (plan === 'demo') return 'demo';
  if (KNOWN_PLANS.includes(plan)) return plan;
  return 'solo';
}

export function hasFeature(plan, feature) {
  const p = normalizePlan(plan);
  // Admin unlocks everything — including any feature flag added in the
  // future that someone forgets to set true on the admin entry above.
  if (p === 'admin') return true;
  return Boolean(PLANS[p]?.features?.[feature]);
}

export function planLabel(plan) {
  const p = normalizePlan(plan);
  return PLANS[p]?.label || PLANS.solo.label;
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
