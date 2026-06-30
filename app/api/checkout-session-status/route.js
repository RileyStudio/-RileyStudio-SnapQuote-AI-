import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { normalizePlan } from '@/lib/plans';

// Retrieves a Stripe Checkout Session and, when the logged-in user matches
// that session, performs a safe self-sync of the contractor's billing row.
// The webhook remains the primary production path, but this fallback keeps
// the UI honest immediately after checkout even if Stripe is still retrying
// a webhook or SUPABASE_SERVICE_ROLE_KEY was not present at deploy time.
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

    let subscription = null;
    if (session.subscription) {
      const subResponse = await fetch(
        `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(session.subscription)}`,
        { headers: { Authorization: `Bearer ${secretKey}` } }
      );
      const subData = await subResponse.json();
      if (subResponse.ok) subscription = subData;
    }

    const plan = normalizePlan(session.metadata?.plan || subscription?.metadata?.plan || null);
    const email = session.customer_details?.email || session.customer_email || session.metadata?.email || null;

    // Optional authenticated self-sync. It never trusts frontend plan input;
    // it writes only values just read back from Stripe by session_id, and only
    // when the Supabase auth user matches the Stripe session metadata.
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    let synced = false;

    if (supabase && accessToken) {
      const { data: userData } = await supabase.auth.getUser(accessToken);
      const userId = userData?.user?.id;
      const sessionUserId = session.client_reference_id || session.metadata?.user_id || subscription?.metadata?.user_id;

      if (userId && sessionUserId && userId === sessionUserId) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const payload = {
          id: userId,
          email: userData.user.email || email,
          plan,
          subscription_status: subscription?.status || 'active',
          stripe_customer_id: session.customer || subscription?.customer || null,
          stripe_subscription_id: session.subscription || subscription?.id || null,
          current_period_end: typeof subscription?.current_period_end === 'number'
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
          billing_email: email,
          founder_overflow: false,
        };

        const syncResponse = await fetch(`${supabaseUrl}/rest/v1/contractors?on_conflict=id`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify(payload),
        });
        synced = syncResponse.ok;
      }
    }

    return NextResponse.json({
      paymentStatus: session.payment_status,
      subscriptionStatus: subscription?.status || null,
      plan,
      email,
      synced,
    });
  } catch (e) {
    return NextResponse.json({ error: `Stripe request failed: ${e.message}` }, { status: 502 });
  }
}
