-- ═════════════════════════════════════════════════════════════════════════
-- SnapQuote AI — Supabase schema (Phase 10)
--
-- Supersedes the original Phase 1 schema (separate jobs / job_photos /
-- voice_notes / estimates tables). The app's data model evolved through
-- Phases 2–9 into one unified "estimate" entity (see lib/localEstimates.js)
-- holding customer info, job info, line items, photos, and notes together
-- — this schema mirrors that, not the original job-centric plan.
--
-- Run this file first, in the Supabase SQL Editor, on a fresh project.
-- Then run policies.sql, then storage.sql, then (optionally) seed.sql.
-- See README.md → "Supabase Setup via SQL Editor" for the full walkthrough.
--
-- This file does NOT wire the Next.js app to Supabase — see Phase 10's
-- scope note. It only creates the backend foundation to wire up later.
-- ═════════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────
-- 1. profiles — one row per auth.users row (id = auth.users.id).
--    Kept separate from `contractors` so app-specific business fields
--    don't live directly on the identity table, and so a future user
--    role beyond "contractor" wouldn't require reshaping this table.
-- ─────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────
-- 2. contractors — one row per business (id = profiles.id = auth.users.id).
--    Mirrors lib/settings.js's businessProfile + branding objects.
-- ─────────────────────────────────────────────────────────
create table if not exists contractors (
  id uuid primary key references profiles(id) on delete cascade,
  business_name text not null default 'Your Business',
  owner_name text,
  phone text,
  email text,
  website text,
  service_area text,
  logo_url text,
  brand_color text not null default '#FF5A1F',
  license_note text,
  footer_text text,
  -- Phase 11 — feature gating only, no billing wired up. See
  -- lib/plans.js for what each tier unlocks in the app.
  plan text not null default 'solo' check (plan in ('solo', 'founder', 'pro', 'team')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────
-- 3. contractor_settings — one row per contractor (1:1).
--    Mirrors lib/settings.js's estimateTerms object — the contractor's
--    default Payment Terms / Warranty / Deposit / Expiration, prefilled
--    onto every brand-new estimate by components/EstimateForm.jsx.
-- ─────────────────────────────────────────────────────────
create table if not exists contractor_settings (
  contractor_id uuid primary key references contractors(id) on delete cascade,
  payment_terms text not null default 'Remaining balance due upon completion. We accept cash, check, or card.',
  warranty_language text not null default '1-year labor warranty on all work performed. Manufacturer warranties apply to materials where applicable.',
  deposit_requirement text not null default '50% deposit required to schedule the job',
  expiration_days integer not null default 14,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────
-- 3b. customers — a repeat-customer directory (Phase 8). Additive: the
--    estimates table below keeps its own flattened customer_name/phone/
--    email/address columns as the source of truth for what an estimate
--    actually displays (so existing functions/queries don't need to
--    change), and gets an optional customer_id pointing here so the same
--    person can be recognized/reused across multiple estimates.
-- ─────────────────────────────────────────────────────────
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  contractor_id uuid not null references contractors(id) on delete cascade,
  name text,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customers_contractor_id on customers(contractor_id);

drop trigger if exists trg_customers_updated_at on customers;
create trigger trg_customers_updated_at
  before update on customers
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────
-- 4. estimates — the core entity. One row per estimate, matching
--    lib/localEstimates.js's record shape: customer + job info live
--    directly on the row (flattened, like the app's own JS objects),
--    rather than split across separate customer/job tables.
--
--    NOTE on `terms`: lib/localEstimates.js denormalizes a `terms` field
--    as a JS-side copy of notes.payment_terms. That's a local-storage
--    convenience (kept in sync by JS on every save); this SQL schema
--    deliberately does NOT duplicate it as its own column — payment_terms
--    below is the single source of truth in the database.
-- ─────────────────────────────────────────────────────────
create table if not exists estimates (
  id uuid primary key default uuid_generate_v4(),
  contractor_id uuid not null references contractors(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  ticket_number text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved')),

  -- Customer info (flattened — see note above)
  customer_name text,
  customer_phone text,
  customer_email text,
  customer_address text,

  -- Job info
  job_title text,
  job_description text,
  job_start_date date,
  job_end_date date,

  -- Totals — labor_subtotal/materials_subtotal/tax/total are computed
  -- from estimate_line_items by the application (see
  -- lib/estimateMath.js's computeSubtotals), same as the local-storage
  -- version; tax_rate is the one piece of input data totals are derived
  -- from, so it's stored too even though not explicitly listed.
  tax_rate numeric not null default 0,
  labor_subtotal numeric not null default 0,
  materials_subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,

  -- Notes and Terms (mirrors lib/localEstimates.js's notes.* fields)
  warranty_note text,
  payment_terms text,
  additional_notes text,

  -- Secure public access — see policies.sql and the get_quote_by_token()
  -- / approve_estimate() functions below for how this is actually used.
  public_quote_token uuid not null default uuid_generate_v4(),

  sent_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────
-- 5. estimate_line_items — one row per line item, replacing the old
--    schema's materials/labor jsonb blobs with real, queryable rows.
--    Mirrors lib/localEstimates.js's lineItems array
--    ({ description, qty, unit_price, type }).
-- ─────────────────────────────────────────────────────────
create table if not exists estimate_line_items (
  id uuid primary key default uuid_generate_v4(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  item_type text not null default 'material' check (item_type in ('material', 'labor')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────
-- 6. estimate_photos — one row per job-site photo. `storage_path` points
--    into the `estimate-photos` Storage bucket (see storage.sql) —
--    contrast with the demo app's PhotoUploader.jsx, which only has a
--    transient browser blob URL (previewUrl) since there's no real
--    upload destination yet in local-storage mode.
-- ─────────────────────────────────────────────────────────
create table if not exists estimate_photos (
  id uuid primary key default uuid_generate_v4(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  storage_path text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────
-- 7. quote_approvals — an approval EVENT log, separate from just an
--    approved_at column on estimates. Gives a real audit trail (and room
--    to later record an approver name/IP/note) rather than a single
--    overwritable timestamp. estimates.status/approved_at stay as fast,
--    simple read-path fields, kept in sync by approve_estimate() below.
-- ─────────────────────────────────────────────────────────
create table if not exists quote_approvals (
  id uuid primary key default uuid_generate_v4(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  approved_at timestamptz not null default now(),
  approver_name text,
  approver_note text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────
create index if not exists idx_estimates_contractor_id on estimates(contractor_id);
create index if not exists idx_estimates_status on estimates(status);
create unique index if not exists idx_estimates_public_quote_token on estimates(public_quote_token);
create index if not exists idx_estimates_created_at on estimates(created_at desc);

create index if not exists idx_estimate_line_items_estimate_id on estimate_line_items(estimate_id);
create index if not exists idx_estimate_photos_estimate_id on estimate_photos(estimate_id);
create index if not exists idx_quote_approvals_estimate_id on quote_approvals(estimate_id);

-- ─────────────────────────────────────────────────────────
-- updated_at triggers — so the column actually updates on every UPDATE,
-- not just exists. Shared trigger function, attached per table.
-- ─────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists trg_contractors_updated_at on contractors;
create trigger trg_contractors_updated_at
  before update on contractors
  for each row execute function set_updated_at();

drop trigger if exists trg_contractor_settings_updated_at on contractor_settings;
create trigger trg_contractor_settings_updated_at
  before update on contractor_settings
  for each row execute function set_updated_at();

drop trigger if exists trg_estimates_updated_at on estimates;
create trigger trg_estimates_updated_at
  before update on estimates
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────
-- New-user provisioning — every user in this app is a contractor, so a
-- fresh signup immediately gets a profile + a contractor row (with
-- placeholder defaults) + a contractor_settings row, ready to edit via
-- the Settings page. seed.sql relies on this trigger too: inserting the
-- demo auth.users row is what creates its profiles/contractors/
-- contractor_settings rows, which seed.sql then fills in with real data.
-- ─────────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.contractors (id, business_name, email)
  values (new.id, 'Your Business', new.email)
  on conflict (id) do nothing;

  insert into public.contractor_settings (contractor_id)
  values (new.id)
  on conflict (contractor_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────────────────────
-- Public quote functions — SECURITY DEFINER, narrow, and the
-- RECOMMENDED way to expose public read/write access (see the security
-- note in policies.sql for why these are safer than a blanket public
-- SELECT policy on `estimates`).
-- ─────────────────────────────────────────────────────────

-- Bundles everything app/quote/[id]/page.jsx needs — the estimate, its
-- contractor's branding AND default settings (expiration_days), line
-- items, and photos — into one call. Accepts EITHER the estimate's
-- public_quote_token OR its raw id: a customer-facing link should always
-- use the token, but matching the id too means a caller that passes the
-- wrong one (now, or in some future code path) still finds the real
-- estimate instead of silently falling through to demo content. Returns
-- null if neither matches a sent/approved estimate (never reveals
-- whether a value is "almost right" or simply wrong).
create or replace function get_quote_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'estimate', to_jsonb(e) - 'contractor_id',
    -- Branding columns (business_name, logo_url, brand_color, license_note,
    -- footer_text, etc.) come straight off contractors; expiration_days
    -- lives on the separate contractor_settings row, merged in here so the
    -- caller gets one flat contractor-ish object instead of two.
    'contractor', (to_jsonb(c) - 'id') || jsonb_build_object('expiration_days', coalesce(cs.expiration_days, 14)),
    'line_items', coalesce(
      (select jsonb_agg(to_jsonb(li) order by li.sort_order)
       from estimate_line_items li where li.estimate_id = e.id),
      '[]'::jsonb
    ),
    'photos', coalesce(
      (select jsonb_agg(to_jsonb(p) order by p.sort_order)
       from estimate_photos p where p.estimate_id = e.id),
      '[]'::jsonb
    )
  )
  into v_result
  from estimates e
  join contractors c on c.id = e.contractor_id
  left join contractor_settings cs on cs.contractor_id = c.id
  where (e.public_quote_token = p_token or e.id = p_token)
    and e.status in ('sent', 'approved');

  return v_result;
end;
$$;

-- Approves a sent estimate by its public token: logs a quote_approvals
-- row, then flips the parent estimate's status/approved_at. Same name and
-- single `token` parameter the app already calls today
-- (`supabase.rpc('approve_estimate', { token: id })` in
-- app/quote/[id]/page.jsx) so wiring it up later is a drop-in.
-- Silently no-ops if the token doesn't match a currently-sent estimate
-- (already approved, still a draft, or simply wrong) rather than erroring.
create or replace function approve_estimate(token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estimate_id uuid;
begin
  select id into v_estimate_id
  from estimates
  where public_quote_token = token
    and status = 'sent';

  if v_estimate_id is null then
    return;
  end if;

  insert into quote_approvals (estimate_id) values (v_estimate_id);

  update estimates
  set status = 'approved',
      approved_at = now()
  where id = v_estimate_id;
end;
$$;

grant execute on function get_quote_by_token(uuid) to anon, authenticated;
grant execute on function approve_estimate(uuid) to anon, authenticated;
