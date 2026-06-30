# SnapQuote AI — Validation Checklist (v31)

Test card: 4242 4242 4242 4242, any future expiry/CVC/ZIP. Webhook endpoint:
`https://snapquote-ai.com/api/stripe-webhook` subscribed to checkout.session.completed,
customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed.

## Core: current plan display (the reported bug)

| # | Test | Expected |
|---|------|----------|
| 1 | Subscribe to Solo | After webhook: Billing shows **Current plan: Solo**; Settings marks Solo current; Plans marks Solo card "Current plan" |
| 2 | Subscribe to Pro | **Current plan: Pro** everywhere; Pro features unlock |
| 3 | Subscribe to Teams | **Current plan: Teams** everywhere (NOT Solo/$29); Team section unlocks; Supabase row shows `plan='teams'`, `subscription_status='active'` |
| 4 | Supabase value | After Teams checkout, `select plan,subscription_status from contractors where id='<uid>'` → `teams, active` |
| 5 | Features match plan | Solo: limited history; Pro: branding+history+sharing; Teams: + multiUser/team section |

## Billing page states (never defaults to Solo)

| # | Test | Expected |
|---|------|----------|
| 6 | Just paid, webhook lagging | "Plan activation is processing. Refresh in a moment." (not "$29") |
| 7 | Active subscriber | "Current plan: <Tier>" + status + renewal date |
| 8 | Canceled (still has Stripe customer) | "No active plan" (NOT stuck on "processing") |
| 9 | Never subscribed | "No active plan" / Choose a Plan |

## Plans page card labels

| # | Current plan | Card | Expected button |
|---|-----|------|---------|
| 10 | Solo | Solo | "Current plan" (disabled) |
| 11 | Solo | Pro / Teams | "Upgrade" |
| 12 | Teams | Teams | "Current plan" |
| 13 | Teams | Solo / Pro | "Change plan" → /billing |
| 14 | (none) | any | "Subscribe to X" (logged in) / "Log in to subscribe" |

## Founder

| # | Test | Expected |
|---|------|----------|
| 15 | No active founders | "10 of 10 Founder seats remaining" (never "—") |
| 16 | Count null/error | Still "10 of 10" (display fails open) |
| 17 | 1 active founder | "9 of 10" |
| 18 | 10 active founders | Founder card hidden (or "Sold out" if you are founder); button disabled |
| 19 | Founder user | Founder card shows "Current plan"; Settings shows Founding Contractor banner |
| 20 | Non-founder Teams user | NO Founder banner anywhere; no "Founder" shown as current |
| 21 | Overflow (11th pays in race) | Webhook sets `plan='solo'`, `founder_overflow=true`; Billing shows a friendly "seats were taken" note; appears in overflow SQL query |

## No mixed copy (requirement 7)

| # | Test | Expected |
|---|------|----------|
| 22 | Teams account | Never shows "You are on Solo" alongside Teams; no Founder-as-current |
| 23 | Authenticated user | No demo/test language on Settings plan area (Stripe copy only) |

## Regression (must still pass)

Login, demo mode (demo badges only in demo), estimate save/review, public quote link,
PDF export, admin unlocks everything without Stripe, landing page + pricing table render.
