# SnapQuote AI — Deployment Guide (v31: plan normalization + sync fixes)

This pass fixes the "UI still says $29/Solo after subscribing to Teams" bug and the
mixed Founder/Teams messaging. The root cause was a plan-key split: the app keyed Teams
as singular `team` internally while Stripe used plural `teams`, so a stored `teams`
missed the `team` lookup and silently fell back to Solo. **Everything is now normalized
to one canonical key set: `admin | founder | solo | pro | teams`.**

## What changed

| File | Change |
|------|--------|
| `lib/plans.js` | `team`→`teams`; added `normalizePlan()`, `KNOWN_PLANS`; `hasFeature`/`planLabel` normalize input. Single source of truth for plan keys. |
| `lib/routeAccess.js` | Uses `teams`; normalizes input. |
| `lib/founderSeats.js` | Added `getFounderSeatDisplay()` (fails open → never shows "—"). |
| `lib/supabaseSettings.js` | Normalizes plan on read. |
| `app/api/create-checkout-session/route.js` | Writes canonical keys (removed `team` translation). |
| `app/api/stripe-webhook/route.js` | Normalizes plan; stores `teams` for Teams checkouts; added Founder-overflow guard. |
| `app/billing/page.jsx` | Never defaults to Solo. Shows active plan, "processing", or "no plan". |
| `app/billing/success/page.jsx` | Canonical keys. |
| `app/plans/page.jsx` | Reads current plan; per-card Current/Upgrade/Change labels; Founder visibility rules. |
| `app/settings/page.jsx` | Normalizes plan; `requiredPlan="teams"`; no Founder banner for non-founders. |
| `app/dashboard/page.jsx` | Normalizes plan on read. |
| `components/PricingTable.jsx` | Display order uses `teams` (would have crashed otherwise). |
| `supabase/schema.sql` | Fresh installs: `teams` in CHECK, `founder_overflow` column. |
| `supabase/migration_teams_founder_overflow.sql` | **NEW.** Run on existing DBs. |

## Database migration (run in order, in Supabase SQL Editor)

This pass assumes the earlier billing/admin migration (`migration_billing_admin.sql`)
has already been applied. Then run the new one:

1. `supabase/migration_teams_founder_overflow.sql` — widens the plan CHECK to allow
   `teams`, rewrites any legacy `team` rows to `teams`, adds the `founder_overflow`
   column, and extends the billing-guard trigger to protect it. Additive and
   non-destructive (no dropped tables, no deleted rows).
2. Verify:
   ```sql
   select plan, count(*) from contractors group by plan;   -- no 'team' should remain
   select column_name from information_schema.columns
     where table_name='contractors' and column_name='founder_overflow';
   ```

Fresh project (no data yet): run `schema.sql` → `policies.sql` → `storage.sql` →
`migration_billing_admin.sql` → `migration_teams_founder_overflow.sql`.

## Founder overflow (your accepted practical model)

- **Before checkout:** the checkout route counts active founders and blocks if ≥ 10
  (fails closed).
- **At activation (webhook):** re-counts. If this payment would exceed 10, it does NOT
  grant Founder — it sets `plan='solo'` and `founder_overflow=true` for manual review,
  rather than blocking the (already-completed) payment.
- **Find overflow accounts to resolve:**
  ```sql
  select id, billing_email, stripe_subscription_id from contractors where founder_overflow;
  ```
  Resolve by refunding in Stripe, moving them to a paid tier, or honoring Founder if a
  seat freed up (set `plan='founder'`, `founder_overflow=false` from the SQL editor).

## Environment variables (unchanged names — do not rename)

```
NEXT_PUBLIC_SITE_URL  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY  STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_FOUNDER  STRIPE_PRICE_SOLO  STRIPE_PRICE_PRO  STRIPE_PRICE_TEAMS
NEXT_PUBLIC_SUPABASE_URL  NEXT_PUBLIC_SUPABASE_ANON_KEY  SUPABASE_SERVICE_ROLE_KEY
```

Confirm `STRIPE_PRICE_TEAMS` points at the $99 Teams price. The webhook stores whatever
plan the checkout wrote into metadata; with the canonical keys, a Teams checkout now
stores exactly `plan='teams'`, `subscription_status='active'`.
