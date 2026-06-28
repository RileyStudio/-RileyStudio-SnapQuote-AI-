import { NextResponse } from 'next/server';

// Checkout only — no webhook, no subscription management, nothing here
// writes to Supabase or changes a contractor's plan. That's deliberately
// out of scope for this pass; see README → "Stripe checkout" for what's
// still missing before a completed payment actually activates anything.
//
// Calls Stripe's REST API directly (https://api.stripe.com/v1/checkout/sessions)
// instead of using the `stripe` npm package — this route has zero new
// dependencies as a result, which matters because this environment can't
// run `npm install` to verify a new package resolves correctly.

const PRICE_ENV_BY_PLAN = {
  founder: 'STRIPE_PRICE_FOUNDER',
  solo: 'STRIPE_PRICE_SOLO',
  pro: 'STRIPE_PRICE_PRO',
  team: 'STRIPE_PRICE_TEAM',
};

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Expected a JSON request body.' }, { status: 400 });
  }

  const { plan, email, clientReferenceId } = body || {};

  const priceEnvKey = PRICE_ENV_BY_PLAN[plan];
  if (!priceEnvKey) {
    return NextResponse.json(
      { error: `Unknown plan "${plan}". Expected one of: ${Object.keys(PRICE_ENV_BY_PLAN).join(', ')}.` },
      { status: 400 }
    );
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

  // Stripe's REST API uses application/x-www-form-urlencoded with its own
  // bracket-index convention for arrays/nested objects — line_items[0][price]
  // is the documented way to send a single line item without the SDK.
  const params = new URLSearchParams();
  params.append('mode', 'subscription');
  params.append('line_items[0][price]', priceId);
  params.append('line_items[0][quantity]', '1');
  params.append('success_url', `${siteUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${siteUrl}/plans`);
  params.append('metadata[plan]', plan);
  // Best-effort only — neither is required to start checkout. Recorded
  // now purely so a future webhook phase has something to link a
  // completed subscription back to; nothing reads these yet.
  if (email) params.append('customer_email', email);
  if (clientReferenceId) params.append('client_reference_id', clientReferenceId);

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
