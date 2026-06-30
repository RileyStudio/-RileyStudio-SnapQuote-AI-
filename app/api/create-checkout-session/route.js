import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { areFounderSeatsAvailable } from '@/lib/founderSeats';

// Checkout only — no webhook logic lives here (see
// app/api/stripe-webhook/route.js for what actually activates a plan).
// Calls Stripe's REST API directly via fetch() instead of the `stripe`
// npm package — zero new dependencies, which matters because this
// environment has no network access to verify a new package would
// resolve, and "build must pass" is explicit.

// Plan keys are now identical everywhere — Stripe-facing, app-internal,
// Stripe metadata, and the Supabase contractors.plan column all use the
// same canonical keys (founder/solo/pro/teams). There is no longer a
// singular "team" to translate to; what's written to metadata.plan is
// exactly what the webhook stores and the UI reads.
const PRICE_ENV_BY_PLAN = {
  founder: 'STRIPE_PRICE_FOUNDER',
  solo: 'STRIPE_PRICE_SOLO',
  pro: 'STRIPE_PRICE_PRO',
  teams: 'STRIPE_PRICE_TEAMS',
};

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Expected a JSON request body.' }, { status: 400 });
  }

  const { plan } = body || {};

  const priceEnvKey = PRICE_ENV_BY_PLAN[plan];
  if (!priceEnvKey) {
    return NextResponse.json(
      { error: `Unknown plan "${plan}". Expected one of: ${Object.keys(PRICE_ENV_BY_PLAN).join(', ')}.` },
      { status: 400 }
    );
  }

  // Require a logged-in Supabase user. The access token is verified
  // server-side via Supabase Auth itself (supabase.auth.getUser with an
  // explicit token does a real round-trip to Supabase, not a local-only
  // check) — a client claiming to be logged in with no real token, or an
  // expired/forged one, is rejected here regardless of what the UI shows.
  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!supabase || !accessToken) {
    return NextResponse.json({ error: 'You must be logged in to subscribe.' }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'You must be logged in to subscribe.' }, { status: 401 });
  }
  const user = userData.user;

  // Founder seat limit — checked server-side regardless of what the
  // Plans page's button state shows, since that can always be bypassed
  // by posting to this route directly.
  if (plan === 'founder') {
    const seatsAvailable = await areFounderSeatsAvailable();
    if (!seatsAvailable) {
      return NextResponse.json({ error: 'Founder seats are sold out.' }, { status: 409 });
    }
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env[priceEnvKey];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  const missing = [
    !secretKey && 'STRIPE_SECRET_KEY',
    !priceId && priceEnvKey,
    !siteUrl && 'NEXT_PUBLIC_SITE_URL',
  ].filter(Boolean);

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Stripe checkout is not configured. Missing: ${missing.join(', ')}.` },
      { status: 503 }
    );
  }

  // The validated `plan` IS the canonical key now (founder/solo/pro/teams)
  // — it's written straight to metadata and stored verbatim by the webhook.
  const appPlanKey = plan;

  // Stripe's REST API uses application/x-www-form-urlencoded with its own
  // bracket-index convention for arrays/nested objects.
  const params = new URLSearchParams();
  params.append('mode', 'subscription');
  params.append('line_items[0][price]', priceId);
  params.append('line_items[0][quantity]', '1');
  params.append('success_url', `${siteUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${siteUrl}/plans`);
  params.append('client_reference_id', user.id);
  params.append('customer_email', user.email || '');
  params.append('metadata[user_id]', user.id);
  params.append('metadata[plan]', appPlanKey);
  params.append('metadata[email]', user.email || '');
  // Checkout Session metadata does NOT automatically carry over onto the
  // Subscription object Stripe creates — setting it explicitly here too
  // means every later webhook event (customer.subscription.updated, etc.)
  // can resolve the right contractor from metadata directly, without
  // depending on checkout.session.completed having already run first.
  params.append('subscription_data[metadata][user_id]', user.id);
  params.append('subscription_data[metadata][plan]', appPlanKey);

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: session?.error?.message || `Stripe request failed (${response.status}).` },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: `Stripe request failed: ${e.message}` }, { status: 502 });
  }
}
