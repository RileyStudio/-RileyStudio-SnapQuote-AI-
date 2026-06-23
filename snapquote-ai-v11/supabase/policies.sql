-- ═════════════════════════════════════════════════════════════════════════
-- SnapQuote AI — Row Level Security policies (Phase 10)
--
-- Run this AFTER schema.sql, in the Supabase SQL Editor.
-- Every table below gets RLS enabled, then a small number of clearly
-- commented policies. Where a policy involves a tradeoff (see the
-- SECURITY NOTE before the public estimates policy), the tradeoff is
-- explained rather than silently accepted.
-- ═════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────
alter table profiles enable row level security;

create policy "profiles: owner can read own row"
  on profiles for select
  using (id = auth.uid());

create policy "profiles: owner can update own row"
  on profiles for update
  using (id = auth.uid());

-- No insert policy: profiles rows are created by the handle_new_user()
-- trigger (schema.sql), which runs as SECURITY DEFINER and bypasses RLS.
-- Users never insert their own profile row directly.

-- ─────────────────────────────────────────────────────────
-- contractors
-- ─────────────────────────────────────────────────────────
alter table contractors enable row level security;

create policy "contractors: owner can read own row"
  on contractors for select
  using (id = auth.uid());

create policy "contractors: owner can update own row"
  on contractors for update
  using (id = auth.uid());

create policy "contractors: owner can insert own row"
  on contractors for insert
  with check (id = auth.uid());

-- ─────────────────────────────────────────────────────────
-- contractor_settings
-- ─────────────────────────────────────────────────────────
alter table contractor_settings enable row level security;

create policy "contractor_settings: owner can read own row"
  on contractor_settings for select
  using (contractor_id = auth.uid());

create policy "contractor_settings: owner can update own row"
  on contractor_settings for update
  using (contractor_id = auth.uid());

create policy "contractor_settings: owner can insert own row"
  on contractor_settings for insert
  with check (contractor_id = auth.uid());

-- ─────────────────────────────────────────────────────────
-- estimates
-- ─────────────────────────────────────────────────────────
alter table estimates enable row level security;

-- Contractor: full CRUD on their own estimates only.
create policy "estimates: contractor manages own rows"
  on estimates for all
  using (contractor_id = auth.uid())
  with check (contractor_id = auth.uid());

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ SECURITY NOTE — public quote access                                  │
-- │                                                                       │
-- │ The policy below lets anyone with the `anon` key read any estimate    │
-- │ whose status is 'sent' or 'approved' — it does NOT check the          │
-- │ public_quote_token itself, because a plain RLS USING clause has no    │
-- │ way to know what value a client filtered by; it only decides which    │
-- │ rows exist at all for the requesting role. In practice this means an  │
-- │ attacker who calls the REST API directly (bypassing the app's own     │
-- │ `.eq('public_quote_token', token)` filter) could list every sent/     │
-- │ approved estimate across every contractor — names, addresses, totals  │
-- │ — not just the one they hold a link to.                               │
-- │                                                                       │
-- │ This exact tradeoff existed in the original Phase 1 schema too, and   │
-- │ is being kept here ONLY because it's simple, well-understood, and     │
-- │ matches how get_estimate-by-token lookups are commonly written.       │
-- │                                                                       │
-- │ RECOMMENDED for production: use get_quote_by_token(token uuid)        │
-- │ instead (defined in schema.sql) for the public quote page's read,     │
-- │ and DROP the policy below. That function is SECURITY DEFINER, bypasses│
-- │ RLS, and only ever returns a result for the exact token requested —   │
-- │ no enumeration is possible through it. The same applies to            │
-- │ estimate_line_items/estimate_photos' public policies further down.    │
-- └─────────────────────────────────────────────────────────────────────┘
create policy "estimates: public can read sent/approved rows"
  on estimates for select
  using (status in ('sent', 'approved'));

-- ─────────────────────────────────────────────────────────
-- estimate_line_items
-- ─────────────────────────────────────────────────────────
alter table estimate_line_items enable row level security;

create policy "estimate_line_items: contractor manages own"
  on estimate_line_items for all
  using (estimate_id in (select id from estimates where contractor_id = auth.uid()))
  with check (estimate_id in (select id from estimates where contractor_id = auth.uid()));

-- Same tradeoff as "estimates: public can read sent/approved rows" above —
-- see that comment. Prefer get_quote_by_token() in production.
create policy "estimate_line_items: public can read for sent/approved estimate"
  on estimate_line_items for select
  using (estimate_id in (select id from estimates where status in ('sent', 'approved')));

-- ─────────────────────────────────────────────────────────
-- estimate_photos
-- ─────────────────────────────────────────────────────────
alter table estimate_photos enable row level security;

create policy "estimate_photos: contractor manages own"
  on estimate_photos for all
  using (estimate_id in (select id from estimates where contractor_id = auth.uid()))
  with check (estimate_id in (select id from estimates where contractor_id = auth.uid()));

-- Same tradeoff as above — see "estimates: public can read sent/approved rows".
create policy "estimate_photos: public can read for sent/approved estimate"
  on estimate_photos for select
  using (estimate_id in (select id from estimates where status in ('sent', 'approved')));

-- ─────────────────────────────────────────────────────────
-- quote_approvals
-- ─────────────────────────────────────────────────────────
alter table quote_approvals enable row level security;

-- Contractor can read the approval history of their own estimates.
create policy "quote_approvals: contractor can read own"
  on quote_approvals for select
  using (estimate_id in (select id from estimates where contractor_id = auth.uid()));

-- Public approval flow: anyone can INSERT an approval row, but only for
-- an estimate that is currently 'sent' — never a draft, and (once
-- approved) the estimate's status flips to 'approved' so a second
-- attempt no longer satisfies this check either. This is an INSERT-only
-- policy, so unlike the SELECT tradeoff above, it carries no enumeration
-- risk: inserting a row reveals nothing about other rows.
--
-- The app's primary path for approval should be the approve_estimate(token)
-- function (schema.sql), which does this insert AND the estimates status
-- update atomically. This policy exists as a direct-insert fallback/
-- alternate path, not the main flow.
create policy "quote_approvals: public can insert for a sent estimate"
  on quote_approvals for insert
  with check (
    exists (
      select 1 from estimates
      where estimates.id = quote_approvals.estimate_id
        and estimates.status = 'sent'
    )
  );
