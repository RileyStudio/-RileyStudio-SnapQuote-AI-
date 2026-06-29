import { hasFeature } from './plans';

// plan here is one of:
//   - a real plan key: 'solo' | 'founder' | 'pro' | 'team'
//   - 'demo' — an active localStorage demo session (snapquote.demoSession)
//   - null/undefined — no session and not in demo mode (a cold visitor)
//
// This intentionally does NOT add hard page-level blocks to routes this
// app has always let a cold visitor explore in local/demo-equivalent mode
// (/dashboard, /estimates/new, /billing) — that long-standing,
// deliberately frictionless behavior is unchanged. What this DOES govern
// is the genuinely plan-tiered sub-sections that already show (or now
// show) an upgrade card instead of a blank page: Settings' Branding
// section and Team section, gated the same way either way this function
// is consulted or not.
export function canAccessRoute(plan, route) {
  if (route === '/plans') return true; // anyone, including logged-out visitors
  if (route === '/demo') return plan === 'demo' || plan == null; // entering demo mode, or already in it

  // Admin reaches everything — including the Teams-only sections below —
  // without any Stripe subscription. Checked before the demo/effectivePlan
  // logic so nothing downstream can accidentally narrow it.
  if (plan === 'admin') return true;

  // Demo mode can explore most of the app (that's the point of it), but
  // is treated as Solo-equivalent for the genuinely paid-feature-gated
  // areas below — same as a real Solo account, not a free pass to
  // Pro/Teams-only sections.
  const effectivePlan = plan === 'demo' ? 'solo' : plan;

  if (!effectivePlan) return false;

  if (route === '/dashboard') return true; // any authenticated plan
  if (route === '/billing') return true; // any authenticated plan
  if (route === '/estimates/new') return true; // Solo, Pro, Teams, Founder — i.e. any real plan

  if (route.startsWith('/settings/branding')) {
    return hasFeature(effectivePlan, 'branding'); // Pro, Teams, Founder
  }

  if (route === '/team' || route.startsWith('/team/')) {
    return effectivePlan === 'team'; // Teams only
  }

  // Unknown/unlisted route: default to "any authenticated plan can see
  // it," consistent with most of this app's existing routes never having
  // been plan-gated at all.
  return true;
}
