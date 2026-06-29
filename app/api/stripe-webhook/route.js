import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Node's crypto module (createHmac, timingSafeEqual) isn't available in
// the Edge runtime — this route needs the Node runtime explicitly.
export const runtime = 'nodejs';

// Same default tolerance Stripe's own SDK uses for replay protection:
// reject an otherwise-valid signature if its timestamp is too old.
const TOLERANCE_SECONDS = 300;

// Plan-key consistency: app/api/create-checkout-session/route.js already
// translates Stripe-facing plan keys (founder/solo/pro/teams — note
// "teams" is plural there) to this app's internal key (lib/plans.js —
// founder/solo/pro/team, singular) BEFORE writing metadata.plan onto the
// Checkout Session and Subscription. Every handler below trusts
// metadata.plan as-is rather than re-translating it, so Stripe metadata
// and the Supabase contractors.plan column always end up holding the
// exact same value — there's no path where one says "teams" and the
// other says "team."

// ─────────────────────────────────────────────────────────
// Signature verification — Stripe's documented algorithm, implemented by
// hand instead of via the `stripe` npm package's stripe.webhooks.constructEvent.
// This is the one place in this app that absolutely cannot get this
// wrong: an unverified "webhook" would let anyone POST a fake
// checkout.session.completed and grant themselves a paid plan for free.
// ─────────────────────────────────────────────────────────
function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;

  const parts = {};
  signatureHeader.split(',').forEach((part) => {
    const [key, value] = part.split('=');
    if (key && value) parts[key] = value;
  });

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  let expectedBuffer;
  let actualBuffer;
  try {
    expectedBuffer = Buffer.from(expectedSignature, 'hex');
    actualBuffer = Buffer.from(signature, 'hex');
  } catch (e) {
    return false;
  }
  if (expectedBuffer.length !== actualBuffer.length) return false;

  const signaturesMatch = crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  if (!signaturesMatch) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > TOLERANCE_SECONDS) return false;

  return true;
}

// ─────────────────────────────────────────────────────────
// Admin client — service-role key, server-only, never exported or
// importable from anywhere client code could reach. This is deliberately
// a different client than lib/supabaseClient.js's anon-key export: the
// writes below (arbitrary contractor's plan/subscription_status) must
// never be reachable through any RLS-governed or anon-callable path. See
// the long comment above count_active_founder_subscribers() in
// supabase/schema.sql for the full reasoning.
// ─────────────────────────────────────────────────────────
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Resolves which contractor a Stripe object belongs to. metadata.user_id
// (set explicitly in app/api/create-checkout-session/route.js, on both
// the Checkout Session and the resulting Subscription) is the reliable,
// preferred path. The stripe_customer_id/stripe_subscription_id lookups
// are a fallback for events that don't carry that metadata directly
// (invoices) or for a subscription Stripe's dashboard created by hand.
async function resolveContractorId(admin, { metadataUserId, stripeCustomerId, stripeSubscriptionId }) {
  if (metadataUserId) return metadataUserId;

  if (stripeSubscriptionId) {
    const { data } = await admin
      .from('contractors')
      .select('id')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .maybeSingle();
    if (data) return data.id;
  }

  if (stripeCustomerId) {
    const { data } = await admin
      .from('contractors')
      .select('id')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();
    if (data) return data.id;
  }

  return null;
}

async function handleCheckoutCompleted(admin, session) {
  const contractorId = await resolveContractorId(admin, {
    metadataUserId: session.client_reference_id || session.metadata?.user_id,
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
  });
  if (!contractorId) return;

  const updates = {
    stripe_customer_id: session.customer || null,
    stripe_subscription_id: session.subscription || null,
    subscription_status: 'active',
  };
  if (session.metadata?.plan) updates.plan = session.metadata.plan;
  // customer_details.email is what Stripe collected at checkout; fall back
  // to the metadata email we set when creating the session.
  const billingEmail = session.customer_details?.email || session.metadata?.email;
  if (billingEmail) updates.billing_email = billingEmail;

  await admin.from('contractors').update(updates).eq('id', contractorId);
}

async function handleSubscriptionUpdated(admin, subscription) {
  const contractorId = await resolveContractorId(admin, {
    metadataUserId: subscription.metadata?.user_id,
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
  });
  if (!contractorId) return;

  const updates = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer,
    // Stripe's own status strings map directly: active, trialing,
    // past_due, canceled, unpaid (plus a couple this app doesn't
    // specifically branch on, like incomplete/incomplete_expired/paused
    // — still stored as-is rather than dropped).
    subscription_status: subscription.status,
    // current_period_end arrives as Unix seconds; store as an ISO
    // timestamp so the column is a real timestamptz. cancel_at_period_end
    // tells the UI whether an active sub is set to lapse at period end.
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
  };
  if (typeof subscription.current_period_end === 'number') {
    updates.current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
  }
  if (subscription.metadata?.plan) updates.plan = subscription.metadata.plan;

  await admin.from('contractors').update(updates).eq('id', contractorId);
}

async function handleSubscriptionDeleted(admin, subscription) {
  const contractorId = await resolveContractorId(admin, {
    metadataUserId: subscription.metadata?.user_id,
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
  });
  if (!contractorId) return;

  // Deliberately does NOT downgrade `plan` back to solo automatically —
  // whether cancellation means "lose access immediately" or "stay active
  // until the paid period ends" is a product decision this pass doesn't
  // make. subscription_status: 'canceled' is recorded either way, ready
  // for a future pass to react to however that gets decided.
  await admin.from('contractors').update({ subscription_status: 'canceled' }).eq('id', contractorId);
}

async function handlePaymentFailed(admin, invoice) {
  const contractorId = await resolveContractorId(admin, {
    metadataUserId: null, // invoices don't carry this app's metadata directly
    stripeCustomerId: invoice.customer,
    stripeSubscriptionId: invoice.subscription,
  });
  if (!contractorId) return;

  await admin.from('contractors').update({ subscription_status: 'past_due' }).eq('id', contractorId);
}

export async function POST(request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    // Fail closed: never process an event this route can't verify.
    return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 500 });
  }

  if (!verifyStripeSignature(rawBody, signatureHeader, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) {
    // Signature is valid but there's nowhere to write the result —
    // tell Stripe to retry later rather than silently dropping the event.
    return NextResponse.json(
      { error: 'Supabase admin client not configured (missing SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 500 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(admin, event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(admin, event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(admin, event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(admin, event.data.object);
        break;
      default:
        // Stripe sends many more event types than this app cares about —
        // anything unhandled is intentionally ignored, not an error.
        break;
    }
  } catch (e) {
    // 500 tells Stripe to retry the webhook later, which is the right
    // behavior for a real processing failure (vs. swallowing it silently).
    return NextResponse.json({ error: e.message || 'Webhook handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
