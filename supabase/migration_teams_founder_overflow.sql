-- ═════════════════════════════════════════════════════════════════════════
-- SnapQuote AI — Plan-key normalization + Founder overflow migration
--
-- Run this in the Supabase SQL Editor AFTER migration_billing_admin.sql.
-- Safe on a project with live data: it only widens a CHECK constraint,
-- rewrites legacy 'team' plan values to 'teams', adds one nullable column,
-- and re-creates the billing-guard trigger to also protect that column.
-- It never drops a table or deletes a row.
--
-- WHY:
--   The app used to key the Teams tier as singular 'team' internally while
--   Stripe used plural 'teams'. That split caused a Teams subscriber's UI
--   to silently read as "Solo" (a stored 'teams' value missed the 'team'
--   lookup and fell back to Solo). The app now uses 'teams' everywhere.
--   This migration brings the database in line:
--     1. Allow 'teams' in the plan CHECK constraint.
--     2. Convert any existing 'team' rows to 'teams'.
--     3. Add founder_overflow (set by the webhook when an 11th Founder
--        payment lands during a race; flags the account for manual review).
--     4. Extend the billing-guard trigger to protect founder_overflow too.
-- ═════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- 1. Widen the plan CHECK to allow 'teams' (keep 'team' temporarily so the
--    constraint doesn't reject existing rows BEFORE we rewrite them in
--    step 2; step 3 then tightens it to drop 'team').
-- ─────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'contractors_plan_check') then
    alter table contractors drop constraint contractors_plan_check;
  end if;
end $$;

alter table contractors
  add constraint contractors_plan_check
  check (plan in ('solo', 'founder', 'pro', 'team', 'teams', 'admin'));

-- ─────────────────────────────────────────────────────────
-- 2. Rewrite legacy 'team' rows to 'teams'. The billing-guard trigger
--    blocks plan changes from non-privileged sessions, but this runs in
--    the SQL editor (a privileged connection), so it passes.
-- ─────────────────────────────────────────────────────────
update contractors set plan = 'teams' where plan = 'team';

-- ─────────────────────────────────────────────────────────
-- 3. Tighten the CHECK to the final canonical set (no more 'team').
-- ─────────────────────────────────────────────────────────
alter table contractors drop constraint contractors_plan_check;
alter table contractors
  add constraint contractors_plan_check
  check (plan in ('solo', 'founder', 'pro', 'teams', 'admin'));

-- ─────────────────────────────────────────────────────────
-- 4. founder_overflow flag. NULL/false for everyone normally; the webhook
--    sets it true when a Founder payment activates that would push the
--    active Founder count past the cap, so an admin can resolve it
--    (refund, move to a paid tier, or honor as Founder if a seat opened).
-- ─────────────────────────────────────────────────────────
alter table contractors add column if not exists founder_overflow boolean not null default false;

-- ─────────────────────────────────────────────────────────
-- 5. Re-create the billing-guard trigger function to ALSO protect
--    founder_overflow from end-user edits. (Same logic as
--    migration_billing_admin.sql, with one extra guarded column.) A normal
--    logged-in session still can't change any billing-controlled column;
--    only the service-role webhook / SQL editor can.
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
  v_privileged :=
    current_user in ('service_role', 'postgres', 'supabase_admin')
    or session_user in ('service_role', 'postgres', 'supabase_admin')
    or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role';

  begin
    if not v_privileged and auth.role() = 'service_role' then
      v_privileged := true;
    end if;
  exception when undefined_function then
    null;
  end;

  if v_privileged then
    return new;
  end if;

  if (new.plan is distinct from old.plan)
     or (new.subscription_status is distinct from old.subscription_status)
     or (new.stripe_customer_id is distinct from old.stripe_customer_id)
     or (new.stripe_subscription_id is distinct from old.stripe_subscription_id)
     or (new.current_period_end is distinct from old.current_period_end)
     or (new.cancel_at_period_end is distinct from old.cancel_at_period_end)
     or (new.billing_email is distinct from old.billing_email)
     or (new.founder_overflow is distinct from old.founder_overflow)
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
-- 6. Refresh the PostgREST schema cache.
-- ─────────────────────────────────────────────────────────
notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────
-- Finding overflow accounts to resolve manually:
--   select id, billing_email, subscription_status, stripe_subscription_id
--   from contractors where founder_overflow = true;
-- ─────────────────────────────────────────────────────────
