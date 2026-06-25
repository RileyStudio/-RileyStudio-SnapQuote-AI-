import { supabase } from './supabaseClient';

function sanitizeFileName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

// Path convention matches the comment at the top of supabase/storage.sql:
//   logos/{contractor_id}/{filename}
//   estimate-photos/{contractor_id}/{estimate_id}/{filename}
// Buckets are private; storage.objects RLS policies (storage.sql) gate
// read access by parsing these same path segments, so the convention here
// and the one assumed there must stay in sync.

export async function uploadLogo(contractorId, file) {
  if (!supabase || !contractorId || !file) return null;

  const path = `${contractorId}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('logos').getPublicUrl(path);
  return data?.publicUrl || null;
}

// Returns { url, path } — `path` is what gets stored in estimate_photos.storage_path;
// `url` is the displayable image URL (built the same way regardless of
// bucket public/private status — actual access is enforced by the
// storage.objects RLS policies in supabase/storage.sql, not by this call).
export async function uploadEstimatePhoto(contractorId, estimateId, file) {
  if (!supabase || !contractorId || !estimateId || !file) return null;

  const path = `${contractorId}/${estimateId}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from('estimate-photos').upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('estimate-photos').getPublicUrl(path);
  return { url: data?.publicUrl || null, path };
}

// Used to re-derive a displayable URL for a photo that's already been
// uploaded (loaded back from estimate_photos.storage_path on a later
// visit, when there's no File object anymore — just the stored path).
export function getEstimatePhotoUrl(storagePath) {
  if (!supabase || !storagePath) return null;
  const { data } = supabase.storage.from('estimate-photos').getPublicUrl(storagePath);
  return data?.publicUrl || null;
}
