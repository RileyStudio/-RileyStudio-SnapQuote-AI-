# SnapQuote AI — Deployment & Verification Guide

This covers the changes made in this pass: the **Admin role**, the **billing-column
privilege-escalation fix**, the **new billing fields** (renewal date / cancel-at-period-end /
billing email), and how to deploy and test all of it. Everything else in the app
(auth, estimates, quote links, PDF export, demo mode, the image landing page) was left
unchanged.

---

## 1. What changed in this pass

| File | Change |
|------|--------|
| `supabase/migration_billing_admin.sql` | **NEW.** Adds `admin` as a valid plan, adds `current_period_end` / `cancel_at_period_end` / `billing_email` columns, and adds a trigger that stops a logged-in user from editing their own billing columns. Run this once. |
| `supabase/schema.sql` | Fresh-install parity: same `admin` CHECK value, same three new columns, same idempotent `ALTER`s. (Existing projects don't re-run this — they run the migration above.) |
| `lib/plans.js` | Added the `admin` plan (unlocks everything). `hasFeature('admin', …)` is always true. `admin` is intentionally **not** in `PLAN_ORDER` and **not** shown in any pricing UI. |
| `lib/routeAccess.js` | `canAccessRoute('admin', …)` returns true for every route, including Teams-only sections. |
| `app/api/stripe-webhook/route.js` | Now also records `billing_email`, `current_period_end`, and `cancel_at_period_end` from Stripe events. |
| `app/billing/page.jsx` | Shows renewal/end date and a cancellation notice when present. |
| `app/settings/page.jsx` | Shows an "Admin account" note for admin users (cosmetic only). |

---

## 2. The security fix (read this)

Before this pass, the `contractors` RLS update policy let a logged-in user write **any**
column on their own row — including `plan` and `subscription_status`. That meant a user
could grant themselves a paid (or admin) plan for free, straight from the browser, with a
one-line Supabase call. The webhook design was correct, but RLS left a side door open.

The migration closes it with a `BEFORE UPDATE` trigger on `contractors`. A normal logged-in
session can still edit its business profile (name, logo, brand color, etc.), but **cannot**
change `plan`, `subscription_status`, `stripe_customer_id`, `stripe_subscription_id`,
`current_period_end`, `cancel_at_period_end`, or `billing_email`. Only the service-role
webhook (and anything run from the SQL editor) can. **Applying the migration is what
activates this protection — until you run it, the hole is still open.**

---

## 3. Database migration (run once, in order)

1. Open **Supabase → SQL Editor**.
2. If this is an **existing** project that already has data: paste and run
   `supabase/migration_billing_admin.sql`. It is additive and non-destructive — it adds
   columns, adds one CHECK value, adds one trigger, replaces one function, and reloads the
   schema cache. It never drops a table or deletes a row.
3. If this is a **brand-new** project: run `schema.sql`, then `policies.sql`, then
   `storage.sql` (then optionally `seed.sql`) as before — they now already include the
   `admin` value and the new columns. Then still run `migration_billing_admin.sql` once to
   install the guard trigger (the trigger lives only in the migration file).
4. Confirm success: the editor should report success with no errors, and
   `select column_name from information_schema.columns where table_name = 'contractors';`
   should now list `current_period_end`, `cancel_at_period_end`, and `billing_email`.

### Granting Admin to a user

There is no UI and no Stripe price for admin — by design. Grant it manually:

```sql
update contractors set plan = 'admin' where id = '<the-user-uuid>';
```

Run this **from the SQL editor** (a privileged connection). The guard trigger will reject
the same statement if it somehow came from a logged-in browser session.

---

## 4. Netlify deployment

1. Push the updated code (or drag-deploy the zip's contents).
2. Confirm the environment variables in **Site settings → Environment variables** (see the
   env list at the bottom of this file). **Do not rename them.**
3. Trigger a deploy. The build runs `next build`; it completed cleanly in development with
   all 22 routes compiling.
4. After deploy, set the Stripe webhook endpoint URL to
   `https://snapquote-ai.com/api/stripe-webhook` (see the Stripe checklist below).

---

## 5. Environment variables (must exist in Netlify — names unchanged)

Required for billing and the app to function:

```
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_FOUNDER
STRIPE_PRICE_SOLO
STRIPE_PRICE_PRO
STRIPE_PRICE_TEAMS
```

Also required (already used by the app — confirm they're set):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      ← server-only; the webhook needs this to write billing data
```

Notes:
- `NEXT_PUBLIC_*` values are exposed to the browser by design — only the publishable Stripe
  key and Supabase anon key belong there. The publishable key is safe to expose.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` are
  **server-only**. They are read via `process.env` in API routes and never sent to the
  client. Never put them in a `NEXT_PUBLIC_*` variable.
- If `SUPABASE_SERVICE_ROLE_KEY` is missing, the webhook returns a 500 and Stripe will
  retry — plans won't activate until it's set.

> **Rotate any secret that has been shared in plain text** (chat, email, screenshots),
> including test-mode keys, then update the value in Netlify. Test keys can't move real
> money, but rotating is the right habit and costs nothing.
