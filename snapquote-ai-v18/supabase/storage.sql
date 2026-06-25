-- ═════════════════════════════════════════════════════════════════════════
-- SnapQuote AI — Storage buckets + policies (Phase 10)
--
-- Run this AFTER schema.sql and policies.sql, in the Supabase SQL Editor.
--
-- Path convention these policies assume (the upload code that doesn't
-- exist yet — see Phase 10's scope note — will need to follow this):
--   logos:            logos/{contractor_id}/{filename}
--   estimate-photos:  estimate-photos/{contractor_id}/{estimate_id}/{filename}
-- storage.foldername(name) splits the object path into an array, so
-- (storage.foldername(name))[1] is the first folder (contractor_id) and
-- [2] is the second (estimate_id).
--
-- IF BUCKET CREATION VIA SQL FAILS IN YOUR PROJECT:
-- Inserting into storage.buckets directly (below) is the standard scripted
-- approach and works on most Supabase projects, but storage internals can
-- vary slightly by project/version. If the INSERT statements below error
-- in your SQL Editor, create the two buckets manually instead — Dashboard
-- → Storage → New Bucket → name exactly "logos" / "estimate-photos",
-- both set to **private** (not public) — then re-run just the POLICY
-- statements further down in this file; those always work via SQL
-- regardless of how the buckets themselves were created.
-- ═════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- Buckets — both private. Access is controlled entirely by the
-- storage.objects policies below, not by bucket-level public/private
-- alone, since "public can read estimate photos" needs to be conditional
-- on the parent estimate's status, which a public bucket can't express.
-- ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('logos', 'logos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('estimate-photos', 'estimate-photos', false)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────
-- logos bucket policies
-- ─────────────────────────────────────────────────────────

-- Contractor: full control over files in their own folder.
create policy "logos: contractor can read own"
  on storage.objects for select
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "logos: contractor can upload own"
  on storage.objects for insert
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "logos: contractor can update own"
  on storage.objects for update
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "logos: contractor can delete own"
  on storage.objects for delete
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Public: a logo is shown on the public quote page, so anyone needs read
-- access to a logo belonging to a contractor who has at least one
-- sent/approved estimate (i.e., a live quote exists to show it on).
-- Same enumeration-style tradeoff noted in policies.sql applies here too
-- — a motivated requester could read any contractor's logo this way, not
-- just the one tied to a quote they actually hold. Logos are low-
-- sensitivity (a business's own public branding), so this is a
-- reasonable simplification, but note it for completeness.
create policy "logos: public can read for any contractor with a live quote"
  on storage.objects for select
  using (
    bucket_id = 'logos'
    and exists (
      select 1 from estimates
      where estimates.contractor_id::text = (storage.foldername(name))[1]
        and estimates.status in ('sent', 'approved')
    )
  );

-- ─────────────────────────────────────────────────────────
-- estimate-photos bucket policies
-- ─────────────────────────────────────────────────────────

-- Contractor: full control over files under their own contractor_id folder.
create policy "estimate-photos: contractor manages own"
  on storage.objects for all
  using (bucket_id = 'estimate-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'estimate-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Public: read-only, and only for photos belonging to a sent/approved
-- estimate — a draft's photos are never publicly readable. This check
-- uses the estimate_id folder segment ([2]), not just the contractor_id
-- segment, so it's scoped to the specific estimate rather than "any
-- estimate this contractor owns" — meaningfully narrower than the logos
-- policy above, since a customer's quote link should only ever expose
-- that one job's photos.
create policy "estimate-photos: public can read for sent/approved estimate"
  on storage.objects for select
  using (
    bucket_id = 'estimate-photos'
    and exists (
      select 1 from estimates
      where estimates.id::text = (storage.foldername(name))[2]
        and estimates.status in ('sent', 'approved')
    )
  );
