import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request) {
  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!supabase || !accessToken) {
    return NextResponse.json({ error: 'You must be logged in to manage billing.' }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'You must be logged in to manage billing.' }, { status: 401 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!secretKey || !siteUrl) {
    return NextResponse.json({ error: 'Stripe billing portal is not configured.' }, { status: 503 });
  }

  // Reads the contractor's own row AS THEM — a fresh client carrying
  // their verified access token, not the admin/service-role client the
  // webhook uses. RLS's existing "owner can read own row" policy already
  // permits exactly this, so no elevated access is needed here at all.
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );

  const { data: contractor, error: contractorError } = await userClient
    .from('contractors')
    .select('stripe_customer_id')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (contractorError || !contractor?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'No billing account found yet. Subscribe to a plan first.' },
      { status: 404 }
    );
  }

  const params = new URLSearchParams();
  params.append('customer', contractor.stripe_customer_id);
  params.append('return_url', `${siteUrl}/billing`);

  try {
    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
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
        { error: session?.error?.message || 'Could not open billing portal.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: `Stripe request failed: ${e.message}` }, { status: 502 });
  }
}
