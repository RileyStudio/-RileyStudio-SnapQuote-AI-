import { NextResponse } from 'next/server';

// Cosmetic only — lets app/billing/success/page.jsx show "Plan: Founder"
// instead of just a generic message. The webhook
// (app/api/stripe-webhook/route.js) remains the actual source of truth
// for activation; nothing here writes to Supabase or activates anything.
export async function GET(request) {
  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id.' }, { status: 400 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
  }

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    const session = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: session?.error?.message || 'Could not retrieve checkout session.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      paymentStatus: session.payment_status,
      plan: session.metadata?.plan || null,
      email: session.customer_email || session.metadata?.email || null,
    });
  } catch (e) {
    return NextResponse.json({ error: `Stripe request failed: ${e.message}` }, { status: 502 });
  }
}
