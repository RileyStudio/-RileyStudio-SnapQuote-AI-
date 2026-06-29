-- ═════════════════════════════════════════════════════════════════════════
-- SnapQuote AI — Billing hardening + Admin role migration
--
-- Run this in the Supabase SQL Editor AFTER your existing schema.sql,
-- policies.sql, and storage.sql have already been applied to the project.
-- It is safe to run on a project that already has live contractor/estimate
-- data: it only ADDS columns, ADDS a CHECK value, ADDS a guard trigger, and
-- REPLACES one function. It never drops a table, never deletes a row, and
-- never clears any existing column.
--
-- What this migration does, and WHY each piece is here:
--   1. Allows 'admin' as a valid contractors.plan value (database-only role).
--   2. Adds the billing columns the Stripe webhook can now record
--      (current_period_end, cancel_at_period_end, billing_email) — additive,
--      all nullable, every existing row simply gets them as NULL.
--   3. Closes a privilege-escalation hole: before this migration, the
--      "contractors: owner can update own row" RLS policy let a logged-in
--      user write ANY column on their own row, including plan and
--      subscription_status — i.e. grant themselves a paid (or admin) plan
--      for free from the browser. This adds a trigger that blocks a normal
--      authenticated/anon session from changing the billing-controlled
--      columns, while still letting them edit their business profile. The
--      service-role webhook client bypasses the trigger (that's the whole
--      point) and remains the only writer of those columns.
--   4. Reloads the PostgREST schema cache so the new columns are visible to
--      the API immediately.
-- ═════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- 1. Allow 'admin' as a plan value.
--    The original CHECK constraint only permitted solo/founder/pro/team.
--    We drop it by its conventional name and recreate it including 'admin'.
--    Using a DO block so this is safe whether or not the constraint exists
--    under the expected name on your project.
-- ─────────────────────────────────────────────────────────
do $$
begin
  -- Postgres auto-names a column CHECK like this "contractors_plan_check".
  if exists (
    select 1 from pg_constraint where conname = 'contractors_plan_check'
  ) then
    alter table contractors drop constraint contractors_plan_check;
  end if;
end $$;

alter table contractors
  add constraint contractors_plan_check
  check (plan in ('solo', 'founder', 'pro', 'team', 'admin'));

-- ─────────────────────────────────────────────────────────
-- 2. Additive billing columns. All nullable; existing rows get NULL.
--    - current_period_end: when the current paid period ends / renews.
--      (The app surfaces this as the renewal date; we store one canonical
--      timestamptz column rather than a separate renewal_date duplicate.)
--    - cancel_at_period_end: true when the subscriber has cancelled but
--      retains access until current_period_end.
--    - billing_email: the email Stripe has on file for billing, which may
--      differ from the login email on profiles/contractors.
-- ─────────────────────────────────────────────────────────
alter table contractors add column if not exists current_period_end timestamptz;
alter table contractors add column if not exists cancel_at_period_end boolean not null default false;
alter table contractors add column if not exists billing_email text;

-- ─────────────────────────────────────────────────────────
-- 3. Privilege-escalation guard.
--
--    RLS policies in Postgres gate WHICH ROWS a session may update, but not
--    cleanly WHICH COLUMNS within an allowed row. The existing
--    "owner can update own row" policy is still correct and stays — a
--    contractor SHOULD be able to edit their own business name, logo, brand
--    color, etc. What they must NOT be able to do is set their own
--    plan/subscription_status/stripe_* columns. This trigger enforces that.
--
--    auth.role() returns 'service_role' for the webhook's service-role
--    client (app/api/stripe-webhook/route.js) and 'authenticated' (or
--    'anon') for a normal browser session. We only block the latter, and
--    only when one of the protected columns is actually being changed — a
--    normal profile-only update is unaffected and incurs no error.
--
--    NOTE: this is defense regardless of the API path used. Even a crafted
--    direct PostgREST UPDATE from a logged-in user hits this trigger.
-- ─────────────────────────────────────────────────────────
create or replace function guard_contractor_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_privileged boolean;
begin
  -- Identify a privileged (non-end-user) connection. The Stripe webhook
  -- uses the service-role key, which connects as the Postgres
  -- `service_role` and bypasses RLS — but RLS bypass does NOT bypass
  -- triggers, so we must recognize it here ourselves. We accept three
  -- signals, any of which means "this is allowed to write billing columns":
  --   * current_user / session_user is a known privileged role
  --     (service_role, postgres, supabase_admin) — covers the webhook and
  --     anything run from the SQL editor.
  --   * auth.role() reports 'service_role' — covers the PostgREST path
  --     where the connection "changes into" service_role via the JWT.
  -- A normal logged-in browser session is 'authenticated' (or 'anon') on
  -- all of these, so it is correctly NOT privileged.
  v_privileged :=
    current_user in ('service_role', 'postgres', 'supabase_admin')
    or session_user in ('service_role', 'postgres', 'supabase_admin')
    or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role';

  -- auth.role() may not exist on every project; guard the call so the
  -- trigger never errors if it's absent.
  begin
    if not v_privileged and auth.role() = 'service_role' then
      v_privileged := true;
    end if;
  exception when undefined_function then
    null; -- auth.role() not available; rely on the role checks above
  end;

  if v_privileged then
    return new;
  end if;

  -- For a normal end-user session, the billing-controlled columns must
  -- not change. "is distinct from" handles NULLs correctly.
  if (new.plan is distinct from old.plan)
     or (new.subscription_status is distinct from old.subscription_status)
     or (new.stripe_customer_id is distinct from old.stripe_customer_id)
     or (new.stripe_subscription_id is distinct from old.stripe_subscription_id)
     or (new.current_period_end is distinct from old.current_period_end)
     or (new.cancel_at_period_end is distinct from old.cancel_at_period_end)
     or (new.billing_email is distinct from old.billing_email)
  then
    raise exception 'Billing columns are managed by Stripe and cannot be changed directly.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_contractor_billing on contractors;
create trigger trg_guard_contractor_billing
  before update on contractors
  for each row execute function guard_contractor_billing_columns();

-- ─────────────────────────────────────────────────────────
-- 4. Founder active-count function — unchanged in behavior, re-stated here
--    so this migration is self-contained. Counts contractors on the founder
--    plan with an active subscription. 'admin' is intentionally NOT counted
--    as a founder (different plan value), so granting someone admin never
--    consumes a Founder seat.
-- ─────────────────────────────────────────────────────────
create or replace function count_active_founder_subscribers()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from contractors
  where plan = 'founder' and subscription_status = 'active';
$$;

grant execute on function count_active_founder_subscribers() to anon, authenticated;

-- ─────────────────────────────────────────────────────────
-- 5. Make the new columns visible to the PostgREST API right away.
-- ─────────────────────────────────────────────────────────
notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────
-- HOW TO GRANT ADMIN (run manually, only by someone with SQL access):
--
--   update contractors set plan = 'admin' where id = '<the-user-uuid>';
--
-- There is deliberately no UI, no Stripe price, and no self-serve path for
-- this. The guard trigger above will let this UPDATE through ONLY when run
-- from the SQL Editor / a service-role connection — a logged-in user cannot
-- run it against their own row from the browser.
-- ─────────────────────────────────────────────────────────
