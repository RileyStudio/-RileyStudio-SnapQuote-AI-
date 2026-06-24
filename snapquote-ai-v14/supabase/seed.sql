-- ═════════════════════════════════════════════════════════════════════════
-- SnapQuote AI — Demo seed data (Phase 10)
--
-- OPTIONAL. Run this LAST, after schema.sql, policies.sql, and storage.sql,
-- only if you want a populated demo project (e.g. for a buyer/investor
-- demo against a real Supabase backend instead of localStorage). Skip it
-- entirely for a clean production project — the app works fine with zero
-- rows in any of these tables.
--
-- Reuses the exact same customer/job/line-item data already established
-- in lib/localEstimates.js's seedDemoEstimates() (the Dashboard's
-- "Load Demo Estimates" button) and lib/mockData.js's demoDraftEstimate,
-- so the SQL-seeded demo and the localStorage-seeded demo tell the same
-- story: Lena Ortiz (HVAC, draft), Dana Whitfield (Roofing, sent), Marcus
-- Webb (Painting, approved).
--
-- Safe to re-run: every insert below is idempotent (fixed UUIDs +
-- ON CONFLICT DO NOTHING), so running this file twice does not duplicate
-- data.
-- ═════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto; -- needed for crypt()/gen_salt() below

-- ─────────────────────────────────────────────────────────
-- Demo contractor — Riley Roofing Co.
--
-- Inserting into auth.users directly is the standard (if slightly
-- advanced) way to script a demo user from pure SQL. The
-- handle_new_user() trigger from schema.sql fires on this insert and
-- creates the matching profiles/contractors/contractor_settings rows
-- automatically with placeholder defaults — the UPDATE statements right
-- after this fill in the real demo business data.
--
-- IF THIS INSERT FAILS in your project (auth.users' exact required
-- columns can vary slightly by Supabase/Postgres version): create the
-- demo user instead via Dashboard → Authentication → Users → Add User,
-- using demo@snapquoteai.app, then replace
-- '11111111-1111-1111-1111-111111111111' below with that user's real id
-- before running the rest of this file.
-- ─────────────────────────────────────────────────────────
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated',
  'authenticated',
  'demo@snapquoteai.app',
  crypt('demo-password-123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  '',
  ''
)
on conflict (id) do nothing;

-- Fill in the real demo business data over the trigger's placeholder defaults.
update contractors set
  business_name = 'Riley Roofing Co.',
  owner_name = 'Joseph Riley',
  phone = '(903) 555-0102',
  email = 'demo@snapquoteai.app',
  website = '',
  service_area = 'Mount Pleasant & Mount Vernon, TX',
  brand_color = '#FF5A1F',
  license_note = 'TX-RC-44821 · Licensed & Insured',
  footer_text = 'Thank you for trusting us with your home.'
where id = '11111111-1111-1111-1111-111111111111';

update contractor_settings set
  payment_terms = 'Remaining balance due upon completion. We accept cash, check, or card.',
  warranty_language = '1-year labor warranty on all work performed. Manufacturer warranties apply to materials where applicable.',
  deposit_requirement = '50% deposit required to schedule the job',
  expiration_days = 14
where contractor_id = '11111111-1111-1111-1111-111111111111';

-- ─────────────────────────────────────────────────────────
-- Estimate 1: DRAFT — Lena Ortiz, HVAC (AC Unit Replacement)
-- Same data as lib/mockData.js's demoDraftEstimate.
-- ─────────────────────────────────────────────────────────
insert into estimates (
  id, contractor_id, ticket_number, status,
  customer_name, customer_phone, customer_email, customer_address,
  job_title, job_description, job_start_date, job_end_date,
  tax_rate, labor_subtotal, materials_subtotal, tax, total,
  warranty_note, payment_terms, additional_notes,
  created_at
) values (
  '22222222-2222-2222-2222-222222222221',
  '11111111-1111-1111-1111-111111111111',
  'SQ-1043',
  'draft',
  'Lena Ortiz', '(903) 555-0173', 'lena.ortiz@example.com', '88 River Rd, Mount Pleasant, TX',
  'AC Unit Replacement',
  'Replace failing 13-year-old condenser unit. Recheck duct sealing in the attic and recharge refrigerant once the new unit is installed.',
  '2026-06-29', '2026-06-30',
  8.25, 520, 2327, 191.9775, 3038.9775,
  '1-year labor warranty. 10-year manufacturer parts warranty on the condenser.',
  '50% deposit to schedule the job, remaining balance due on completion.',
  'Customer requested a morning appointment due to home office hours.',
  now() - interval '5 days'
)
on conflict (id) do nothing;

insert into estimate_line_items (estimate_id, description, quantity, unit_price, item_type, sort_order) values
  ('22222222-2222-2222-2222-222222222221', '3-ton condenser unit', 1, 2150, 'material', 0),
  ('22222222-2222-2222-2222-222222222221', 'Refrigerant (R-410A, per lb)', 4, 28, 'material', 1),
  ('22222222-2222-2222-2222-222222222221', 'Duct sealing supplies', 1, 65, 'material', 2),
  ('22222222-2222-2222-2222-222222222221', 'HVAC technician', 8, 65, 'labor', 3)
on conflict do nothing;

insert into estimate_photos (estimate_id, storage_path, caption, sort_order) values
  ('22222222-2222-2222-2222-222222222221', 'estimate-photos/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222221/condenser.jpg', 'Existing condenser unit', 0),
  ('22222222-2222-2222-2222-222222222221', 'estimate-photos/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222221/duct.jpg', 'Attic duct connection', 1)
on conflict do nothing;

-- ─────────────────────────────────────────────────────────
-- Estimate 2: SENT — Dana Whitfield, Roofing (Ridge & Chimney repair)
-- ─────────────────────────────────────────────────────────
insert into estimates (
  id, contractor_id, ticket_number, status,
  customer_name, customer_phone, customer_email, customer_address,
  job_title, job_description, job_start_date, job_end_date,
  tax_rate, labor_subtotal, materials_subtotal, tax, total,
  warranty_note, payment_terms, additional_notes,
  sent_at, created_at
) values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'SQ-1042',
  'sent',
  'Dana Whitfield', '(903) 555-0148', 'dana.w@example.com', '123 Oak Street, Mount Pleasant, TX',
  'Roof Repair — Ridge & Chimney',
  'Remove and replace approximately 30 damaged shingles along the roof ridge. Inspect and reseal chimney flashing. Repair decking and shingles around the vent pipe where water damage was identified.',
  null, null,
  8.25, 270, 192, 15.84, 477.84,
  '1-year labor warranty on all work performed.',
  '50% deposit to schedule the job, remaining balance due on completion.',
  'Full roof inspection recommended within 12 months given the age of the surrounding shingles.',
  now() - interval '1 day', now() - interval '6 days'
)
on conflict (id) do nothing;

insert into estimate_line_items (estimate_id, description, quantity, unit_price, item_type, sort_order) values
  ('22222222-2222-2222-2222-222222222222', 'Architectural shingles (bundle, ~33 sq ft)', 3, 42, 'material', 0),
  ('22222222-2222-2222-2222-222222222222', 'Flashing sealant (tube)', 2, 14, 'material', 1),
  ('22222222-2222-2222-2222-222222222222', 'Plywood decking patch (4x4 sheet)', 1, 38, 'material', 2),
  ('22222222-2222-2222-2222-222222222222', '2 workers', 6, 45, 'labor', 3)
on conflict do nothing;

-- ─────────────────────────────────────────────────────────
-- Estimate 3: APPROVED — Marcus Webb, Painting (Exterior Trim Painting)
-- ─────────────────────────────────────────────────────────
insert into estimates (
  id, contractor_id, ticket_number, status,
  customer_name, customer_phone, customer_email, customer_address,
  job_title, job_description, job_start_date, job_end_date,
  tax_rate, labor_subtotal, materials_subtotal, tax, total,
  warranty_note, payment_terms, additional_notes,
  sent_at, approved_at, created_at
) values (
  '22222222-2222-2222-2222-222222222223',
  '11111111-1111-1111-1111-111111111111',
  'SQ-1078',
  'approved',
  'Marcus Webb', '(903) 555-0199', 'marcus.webb@example.com', '14 Pine Court, Mount Vernon, TX',
  'Exterior Trim Painting',
  'Scrape, prime, and repaint all exterior wood trim, fascia, and shutters. Caulk gaps to prevent moisture intrusion before painting.',
  null, null,
  8.25, 420, 248, 20.46, 688.46,
  '2-year warranty against peeling and cracking.',
  '50% deposit to schedule the job, remaining balance due on completion.',
  '',
  now() - interval '3 days', now() - interval '2 days', now() - interval '4 days'
)
on conflict (id) do nothing;

insert into estimate_line_items (estimate_id, description, quantity, unit_price, item_type, sort_order) values
  ('22222222-2222-2222-2222-222222222223', 'Exterior primer (gallon)', 2, 32, 'material', 0),
  ('22222222-2222-2222-2222-222222222223', 'Exterior paint (gallon)', 3, 48, 'material', 1),
  ('22222222-2222-2222-2222-222222222223', 'Caulk and sundries', 1, 40, 'material', 2),
  ('22222222-2222-2222-2222-222222222223', '2 painters', 10, 42, 'labor', 3)
on conflict do nothing;

-- Approval event for the approved estimate — matches its approved_at above.
insert into quote_approvals (estimate_id, approved_at)
select '22222222-2222-2222-2222-222222222223', now() - interval '2 days'
where not exists (
  select 1 from quote_approvals where estimate_id = '22222222-2222-2222-2222-222222222223'
);
