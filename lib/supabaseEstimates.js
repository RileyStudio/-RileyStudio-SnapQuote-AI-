import { supabase } from './supabaseClient';
import { computeSubtotals } from './estimateMath';
import { getEstimatePhotoUrl } from './supabaseStorage';

// Maps the app's estimate shape (lib/localEstimates.js's record shape) to
// the flat `estimates` row shape in supabase/schema.sql.
function toRow(estimate, contractorId, customerId) {
  const taxRate = estimate.totals?.taxRate ?? 0;
  const { laborSubtotal, materialsSubtotal } = computeSubtotals(estimate.lineItems || []);
  const tax = materialsSubtotal * (taxRate / 100);
  const total = laborSubtotal + materialsSubtotal + tax;

  return {
    id: estimate.id,
    contractor_id: contractorId,
    customer_id: customerId || null,
    ticket_number: estimate.ticket_number,
    status: estimate.status || 'draft',
    customer_name: estimate.customer?.name || null,
    customer_phone: estimate.customer?.phone || null,
    customer_email: estimate.customer?.email || null,
    customer_address: estimate.customer?.address || null,
    job_title: estimate.job?.title || null,
    job_description: estimate.job?.description || null,
    job_start_date: estimate.job?.start_date || null,
    job_end_date: estimate.job?.end_date || null,
    tax_rate: taxRate,
    labor_subtotal: laborSubtotal,
    materials_subtotal: materialsSubtotal,
    tax,
    total,
    warranty_note: estimate.notes?.warranty || null,
    payment_terms: estimate.notes?.payment_terms || null,
    additional_notes: estimate.notes?.additional || null,
    sent_at: estimate.sentAt || null,
    approved_at: estimate.approvedAt || null,
  };
}

// Maps a Supabase row (+ its joined line items/photos) back to the app's
// estimate shape — the same shape lib/localEstimates.js produces, so
// components don't need to know which backend a record came from.
function fromRow(row, lineItems = [], photos = []) {
  return {
    id: row.id,
    ticket_number: row.ticket_number,
    status: row.status,
    customer: {
      name: row.customer_name || '',
      phone: row.customer_phone || '',
      email: row.customer_email || '',
      address: row.customer_address || '',
    },
    job: {
      title: row.job_title || '',
      description: row.job_description || '',
      start_date: row.job_start_date || '',
      end_date: row.job_end_date || '',
    },
    lineItems: (lineItems || [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((li) => ({
        id: li.id,
        description: li.description,
        qty: Number(li.quantity),
        unit_price: Number(li.unit_price),
        type: li.item_type,
      })),
    photos: (photos || [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((p) => ({
        id: p.id,
        caption: p.caption,
        storage_path: p.storage_path,
        // PhotoStrip.jsx already renders photo.previewUrl when present —
        // computing it here means that component needed zero changes to
        // display real Supabase-backed photos.
        previewUrl: getEstimatePhotoUrl(p.storage_path),
      })),
    notes: {
      warranty: row.warranty_note || '',
      payment_terms: row.payment_terms || '',
      additional: row.additional_notes || '',
    },
    totals: {
      taxRate: Number(row.tax_rate) || 0,
      laborSubtotal: Number(row.labor_subtotal) || 0,
      materialsSubtotal: Number(row.materials_subtotal) || 0,
      tax: Number(row.tax) || 0,
      total: Number(row.total) || 0,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at,
    approvedAt: row.approved_at,
  };
}

export async function getAllEstimatesRemote(contractorId) {
  const { data, error } = await supabase
    .from('estimates')
    .select('*, estimate_line_items(*), estimate_photos(*)')
    .eq('contractor_id', contractorId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) return [];
  return data.map((row) => fromRow(row, row.estimate_line_items, row.estimate_photos));
}

export async function getEstimateByIdRemote(id) {
  const { data, error } = await supabase
    .from('estimates')
    .select('*, estimate_line_items(*), estimate_photos(*)')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return fromRow(data, data.estimate_line_items, data.estimate_photos);
}

// Finds an existing customer by email for this contractor, or creates one.
// A lightweight "save customers" behavior (Phase 8) — not a full directory
// UI, just enough that repeat customers accumulate real rows instead of
// being re-typed-and-discarded on every estimate.
async function upsertCustomer(contractorId, customer) {
  if (!customer?.name && !customer?.email) return null;

  let existingId = null;
  if (customer.email) {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .eq('contractor_id', contractorId)
      .eq('email', customer.email)
      .maybeSingle();
    existingId = data?.id || null;
  }

  const payload = {
    contractor_id: contractorId,
    name: customer.name || null,
    phone: customer.phone || null,
    email: customer.email || null,
    address: customer.address || null,
  };

  if (existingId) {
    await supabase.from('customers').update(payload).eq('id', existingId);
    return existingId;
  }

  const { data: created, error } = await supabase
    .from('customers')
    .insert(payload)
    .select('id')
    .single();

  if (error) return null; // customer save is best-effort; never block saving the estimate itself
  return created?.id || null;
}

// Provisions a contractors row for an authenticated user who doesn't
// have one yet. Normally schema.sql's handle_new_user() trigger creates
// this automatically on signup — this exists purely as a safety net for
// accounts that predate that trigger, or where it didn't fire for any
// other reason, so a real logged-in user is never permanently blocked
// from saving an estimate just because their contractor row is missing.
// Returns true if a contractors row exists (already did, or was just
// created); false if it's missing AND couldn't be created.
async function ensureContractorRow(contractorId, email) {
  const { data: existing, error: checkError } = await supabase
    .from('contractors')
    .select('id')
    .eq('id', contractorId)
    .maybeSingle();

  if (existing) return true;
  if (checkError) return false; // couldn't even check — don't claim success

  const { error: insertError } = await supabase
    .from('contractors')
    .insert({ id: contractorId, business_name: 'Your Business', email: email || null });

  if (insertError) return false;

  // Best-effort companions — there's no foreign key from estimates to
  // either of these, so a failure here doesn't block saving an estimate;
  // it just means Settings might need its own one-time fix-up later.
  await supabase.from('profiles').upsert({ id: contractorId, email: email || null });
  await supabase.from('contractor_settings').upsert({ contractor_id: contractorId });

  return true;
}

export async function saveEstimateRemote(estimate, contractorId, contractorEmail) {
  const provisioned = await ensureContractorRow(contractorId, contractorEmail);
  if (!provisioned) {
    const err = new Error(
      'Your account setup is incomplete (no contractor profile found), and one could not be created automatically.'
    );
    err.code = 'CONTRACTOR_MISSING';
    throw err;
  }

  const customerId = await upsertCustomer(contractorId, estimate.customer);
  const row = toRow(estimate, contractorId, customerId);

  const { data: saved, error } = await supabase
    .from('estimates')
    .upsert(row)
    .select()
    .single();

  if (error || !saved) {
    throw new Error(error?.message || 'Could not save estimate to Supabase.');
  }

  // Simplest correct approach for this scope: replace all line items on
  // every save rather than diffing — an estimate has at most a handful of
  // rows, so this is cheap and can never drift out of sync.
  await supabase.from('estimate_line_items').delete().eq('estimate_id', saved.id);
  const lineItemRows = (estimate.lineItems || []).map((item, index) => ({
    estimate_id: saved.id,
    description: item.description,
    quantity: item.qty,
    unit_price: item.unit_price,
    item_type: item.type === 'labor' ? 'labor' : 'material',
    sort_order: index,
  }));
  if (lineItemRows.length > 0) {
    const { error: lineItemError } = await supabase.from('estimate_line_items').insert(lineItemRows);
    if (lineItemError) throw new Error(lineItemError.message);
  }

  // Same replace pattern for photos. Expects each photo to already have a
  // storage_path — uploading the actual file is the caller's job (see
  // lib/supabaseStorage.js's uploadEstimatePhoto, called from
  // components/EstimateForm.jsx before this function runs). Photos with
  // no storage_path yet (e.g. a stray local-preview-only entry) are
  // skipped rather than inserted as broken rows.
  await supabase.from('estimate_photos').delete().eq('estimate_id', saved.id);
  const photoRows = (estimate.photos || [])
    .filter((p) => p.storage_path)
    .map((p, index) => ({
      estimate_id: saved.id,
      storage_path: p.storage_path,
      caption: p.caption || null,
      sort_order: index,
    }));
  if (photoRows.length > 0) {
    const { error: photoError } = await supabase.from('estimate_photos').insert(photoRows);
    if (photoError) throw new Error(photoError.message);
  }

  // Read back the full record (with its line items/photos joined) for
  // the caller — but don't let a failure here, after a genuinely
  // successful write, crash the caller or look like the save itself
  // failed. Fall back to constructing the same shape from data already
  // in hand (the row we just upserted, plus the line items/photos we
  // just wrote) rather than returning null.
  const reloaded = await getEstimateByIdRemote(saved.id);
  if (reloaded) return reloaded;

  return fromRow(saved, lineItemRows, photoRows);
}

export async function markEstimateSentRemote(id) {
  const { error } = await supabase
    .from('estimates')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  return getEstimateByIdRemote(id);
}

export async function markEstimateApprovedRemote(id) {
  const { error } = await supabase
    .from('estimates')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  return getEstimateByIdRemote(id);
}

export async function deleteEstimateRemote(id) {
  await supabase.from('estimates').delete().eq('id', id);
}

export async function duplicateEstimateRemote(id, contractorId) {
  const original = await getEstimateByIdRemote(id);
  if (!original) return null;

  const newId =
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;

  const duplicate = {
    ...original,
    id: newId,
    ticket_number: `SQ-${Math.floor(1000 + Math.random() * 9000)}`,
    status: 'draft',
    job: {
      ...original.job,
      title: original.job?.title ? `${original.job.title} (Copy)` : original.job?.title,
    },
    sentAt: null,
    approvedAt: null,
  };

  return saveEstimateRemote(duplicate, contractorId);
}
