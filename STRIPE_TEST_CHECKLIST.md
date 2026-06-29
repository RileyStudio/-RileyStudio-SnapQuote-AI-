# SnapQuote AI — Stripe & Validation Test Checklist

Work through this after deploying. It maps 1:1 to the validation list in the original
spec, plus the new Admin and security checks from this pass.

---

## A. Stripe setup (test mode first)

1. In the **Stripe Dashboard** (test mode), confirm the four Prices exist and match the
   env vars:
   - `STRIPE_PRICE_FOUNDER` → $10/mo recurring
   - `STRIPE_PRICE_SOLO` → $29/mo recurring
   - `STRIPE_PRICE_PRO` → $59/mo recurring
   - `STRIPE_PRICE_TEAMS` → $99/mo recurring
2. Create a **webhook endpoint** pointing at
   `https://snapquote-ai.com/api/stripe-webhook` and subscribe it to these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
3. Copy that endpoint's **signing secret** into `STRIPE_WEBHOOK_SECRET` in Netlify and
   redeploy. (The webhook rejects every event whose signature it can't verify, so a wrong
   or missing secret means nothing activates.)
4. Test card for all checkouts: `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.

---

## B. Billing flow tests

| # | Test | Expected result |
|---|------|-----------------|
| 1 | Build passes | `next build` completes; all routes compile |
| 2 | Login works | Email/password (or magic link) signs in; lands on dashboard |
| 3 | Demo works | "Try Limited Demo" sets the demo session; demo banner/watermarks appear |
| 4 | Real account has **no** demo badges | After real login, no "Demo / Example / Limited" labels anywhere |
| 5 | Estimate save works | Create → save persists to Supabase |
| 6 | Review estimate works | Review page renders saved estimate |
| 7 | Public quote link works | `/quote/<token>` loads for a sent/approved estimate, no demo banner |
| 8 | PDF export works | PDF downloads; no EXAMPLE/VOID watermark for a real estimate |
| 9 | **Founder** checkout works | `/plans` → Founder → Stripe checkout → success page |
| 10 | **Solo** checkout works | Same flow with Solo price |
| 11 | Webhook updates Supabase | After checkout, the contractor row shows `plan`, `subscription_status: active`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`, `billing_email` |
| 12 | Billing portal opens | `/billing` → Manage Billing → Stripe portal loads |
| 13 | Founder remaining count updates | `/plans` shows "X of 10 Founder seats remaining"; decrements after a Founder activates |
| 14 | Founder blocks after 10 active | With 10 active Founders, Founder button shows "Sold out" **and** a direct POST to `/api/create-checkout-session` returns "Founder seats are sold out." |
| 15 | **Admin** unlocks everything without Stripe | After `update contractors set plan='admin'`, that user sees branding + team sections unlocked, no checkout required |
| 16 | Existing routes still work | Dashboard, settings, estimate edit/review, quote pages all load |

---

## C. Security tests (the important new ones)

| # | Test | How | Expected |
|---|------|-----|----------|
| S1 | User can't self-upgrade | As a logged-in non-paid user, run in the browser console: `await supabase.from('contractors').update({ plan:'pro', subscription_status:'active' }).eq('id', '<their-id>')` | **Error** — "Billing columns are managed by Stripe and cannot be changed directly." Plan stays unchanged. |
| S2 | User can't self-grant admin | Same as S1 but with `plan:'admin'` | **Error**, same message. |
| S3 | User can still edit profile | `await supabase.from('contractors').update({ business_name:'New Name' }).eq('id', '<their-id>')` | **Succeeds.** Profile editing is unaffected. |
| S4 | Webhook can still write | Complete a real test checkout | Succeeds — service-role webhook bypasses the guard and updates billing columns. |
| S5 | Webhook rejects forged events | POST a fake `checkout.session.completed` to `/api/stripe-webhook` with no/invalid signature | **400 "Invalid signature."** No DB change. |
| S6 | Secret key never reaches client | View page source / network tab on `/plans` and `/billing` | `STRIPE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` never appear |

---

## D. Cancellation / lifecycle tests

| # | Test | Expected |
|---|------|----------|
| L1 | Cancel at period end | In the Stripe portal, cancel; webhook sets `cancel_at_period_end: true`; `/billing` shows "Your subscription is set to cancel…" and "Access ends <date>" |
| L2 | Subscription deleted | When the period actually ends, `customer.subscription.deleted` sets `subscription_status: canceled` |
| L3 | Payment failed | Use a failing test card on a renewal; `invoice.payment_failed` sets `subscription_status: past_due` |

---

## E. Going live (after test mode passes)

1. Swap all `pk_test_` / `sk_test_` keys and the webhook secret for **live-mode** values in
   Netlify.
2. Recreate the four Prices in live mode and update the `STRIPE_PRICE_*` env vars to the
   live Price IDs.
3. Re-point (or create) the live webhook endpoint and update `STRIPE_WEBHOOK_SECRET`.
4. Redeploy and repeat tests 9–14 with a real card (then refund yourself).
