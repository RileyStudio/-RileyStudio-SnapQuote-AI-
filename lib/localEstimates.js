import { computeSubtotals } from './estimateMath';
import { demoDraftEstimate } from './mockData';

// New, multi-record store. Naming note: this file deliberately uses
// camelCase field names (createdAt, sentAt, ...) since it's a JS-only
// local storage layer, not a SQL table — contrast with the snake_case
// shapes used for Supabase rows elsewhere in the app (e.g. created_at in
// supabase/schema.sql). Both conventions are intentional for their context.
export const ESTIMATES_KEY = 'snapquote.estimates';

// Phase 2–5's single-slot draft key. Migrated into the new store once,
// the first time getAllEstimates() runs in a browser that still has it.
const LEGACY_DRAFT_KEY = 'snapquote_draft_estimate';

const VALID_STATUSES = ['draft', 'sent', 'approved'];

export function createEstimateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `est-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readRaw() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ESTIMATES_KEY);
}

function writeAll(list) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ESTIMATES_KEY, JSON.stringify(list));
}

// Runs once: if the new store has never been initialized in this browser,
// either migrate the old single draft into it or initialize it empty, so
// every later read is a simple, predictable JSON.parse.
function migrateLegacyDraftIfNeeded() {
  if (typeof window === 'undefined') return;
  if (readRaw() !== null) return; // already initialized — never re-migrate

  const legacy = window.localStorage.getItem(LEGACY_DRAFT_KEY);
  if (!legacy) {
    writeAll([]);
    return;
  }

  try {
    const draft = JSON.parse(legacy);
    const migrated = normalizeEstimate({ ...draft, id: draft.id || createEstimateId() });
    writeAll([migrated]);
  } catch (e) {
    writeAll([]);
  }
}

// Defensive normalization — every record that comes out of this module has
// the full field set with sane defaults, regardless of how partial the
// input was. Recomputes totals from lineItems + taxRate every time rather
// than trusting a possibly-stale stored value.
function normalizeEstimate(input = {}) {
  const lineItems = Array.isArray(input.lineItems) ? input.lineItems : [];
  const { laborSubtotal, materialsSubtotal } = computeSubtotals(lineItems);
  const taxRate = Number(input.totals?.taxRate ?? input.taxRate ?? 0);
  const tax = materialsSubtotal * (taxRate / 100);
  const total = laborSubtotal + materialsSubtotal + tax;

  const notes = {
    warranty: input.notes?.warranty || '',
    payment_terms: input.notes?.payment_terms || '',
    additional: input.notes?.additional || '',
  };

  const now = new Date().toISOString();

  return {
    id: input.id || createEstimateId(),
    ticket_number: input.ticket_number || `SQ-${Math.floor(1000 + Math.random() * 9000)}`,
    status: VALID_STATUSES.includes(input.status) ? input.status : 'draft',
    customer: {
      name: input.customer?.name || '',
      phone: input.customer?.phone || '',
      email: input.customer?.email || '',
      address: input.customer?.address || '',
    },
    job: {
      title: input.job?.title || '',
      description: input.job?.description || '',
      start_date: input.job?.start_date || '',
      end_date: input.job?.end_date || '',
    },
    lineItems,
    photos: Array.isArray(input.photos) ? input.photos : [],
    notes,
    // Denormalized convenience field per the storage schema — kept in sync
    // with notes.payment_terms on every save rather than hand-maintained,
    // so the two can never drift apart. See README for more on this.
    terms: notes.payment_terms || input.terms || '',
    totals: { laborSubtotal, materialsSubtotal, tax, total, taxRate },
    createdAt: input.createdAt || now,
    updatedAt: now,
    sentAt: input.sentAt ?? null,
    approvedAt: input.approvedAt ?? null,
  };
}

// Newest-updated first — the order every consumer (Dashboard, the
// redirect fallback) actually wants, so it isn't reimplemented per page.
// Note: updatedAt has millisecond resolution, so two saves within the same
// millisecond (only realistically possible from a script, not a human
// clicking through the UI) sort by array order rather than true recency —
// not worth a sequence counter for a demo-only local store.
export function getAllEstimates() {
  if (typeof window === 'undefined') return [];
  migrateLegacyDraftIfNeeded();

  try {
    const raw = window.localStorage.getItem(ESTIMATES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } catch (e) {
    return [];
  }
}

export function getEstimateById(id) {
  if (!id) return null;
  return getAllEstimates().find((e) => e.id === id) || null;
}

// Insert-or-update by id. createdAt/sentAt/approvedAt are preserved from
// the existing record unless the caller explicitly provides a different
// value — this matters because callers like the New/Edit form rebuild a
// plain estimate object from form state on every save, and that object
// has no idea what the previously-recorded sentAt/approvedAt were.
export function saveEstimate(estimate) {
  const all = getAllEstimates();
  const normalized = normalizeEstimate(estimate);
  const idx = all.findIndex((e) => e.id === normalized.id);

  if (idx >= 0) {
    const existing = all[idx];
    normalized.createdAt = estimate.createdAt ?? existing.createdAt;
    normalized.sentAt = estimate.sentAt !== undefined ? estimate.sentAt : existing.sentAt;
    normalized.approvedAt = estimate.approvedAt !== undefined ? estimate.approvedAt : existing.approvedAt;
    all[idx] = normalized;
  } else {
    all.push(normalized);
  }

  writeAll(all);
  return normalized;
}

export function updateEstimate(id, patch) {
  const existing = getEstimateById(id);
  if (!existing) return null;
  return saveEstimate({ ...existing, ...patch, id: existing.id });
}

export function deleteEstimate(id) {
  const remaining = getAllEstimates().filter((e) => e.id !== id);
  writeAll(remaining);
}

export function markEstimateSent(id) {
  return updateEstimate(id, { status: 'sent', sentAt: new Date().toISOString() });
}

export function markEstimateApproved(id) {
  return updateEstimate(id, { status: 'approved', approvedAt: new Date().toISOString() });
}

// Creates a brand-new draft record copied from an existing one. A fresh
// ticket number is always generated (simpler and less confusing than two
// different records sharing one), and "(Copy)" is appended to the job
// title when there is one — that title is what actually shows on the
// Dashboard list, so it's the most useful place to mark a duplicate as
// a duplicate.
export function duplicateEstimate(id) {
  const original = getEstimateById(id);
  if (!original) return null;

  const duplicate = {
    ...original,
    id: createEstimateId(),
    ticket_number: `SQ-${Math.floor(1000 + Math.random() * 9000)}`,
    status: 'draft',
    job: {
      ...original.job,
      title: original.job?.title ? `${original.job.title} (Copy)` : original.job?.title,
    },
    sentAt: null,
    approvedAt: null,
  };
  // Omitted (not just falsy) so normalizeEstimate stamps fresh values for
  // both, since saveEstimate's existing-record preserve logic only kicks
  // in for an id that's already in the store — irrelevant here, but
  // deleting them is the clearest way to say "this is a new record."
  delete duplicate.createdAt;
  delete duplicate.updatedAt;

  return saveEstimate(duplicate);
}

// Seeds 3 realistic records — one draft, one sent, one approved — for the
// Dashboard's "Load Demo Estimates" button. Reuses the same customer/job
// identities already established elsewhere in the app (the draft is
// lib/mockData.js's own demoDraftEstimate; the sent and approved ones
// continue the Dana Whitfield/Marcus Webb stories from demoQuote and
// demoJobs) so seeding feels like "these become real records" rather than
// introducing yet another set of sample names.
//
// Idempotent: if any local records already exist, returns them unchanged
// rather than seeding on top — the Dashboard only shows this button when
// the store is empty anyway, but this guard makes the function safe to
// call from anywhere.
export function seedDemoEstimates() {
  const existing = getAllEstimates();
  if (existing.length > 0) return existing;

  const now = Date.now();
  const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

  const draft = saveEstimate({
    id: createEstimateId(),
    ticket_number: demoDraftEstimate.ticket_number,
    status: 'draft',
    customer: demoDraftEstimate.customer,
    job: demoDraftEstimate.job,
    lineItems: demoDraftEstimate.lineItems,
    photos: demoDraftEstimate.photos,
    notes: demoDraftEstimate.notes,
    totals: { taxRate: demoDraftEstimate.taxRate },
  });

  const sent = saveEstimate({
    id: createEstimateId(),
    ticket_number: 'SQ-1042',
    status: 'sent',
    customer: {
      name: 'Dana Whitfield',
      phone: '(903) 555-0148',
      email: 'dana.w@example.com',
      address: '123 Oak Street, Mount Pleasant, TX',
    },
    job: {
      title: 'Roof Repair — Ridge & Chimney',
      description:
        'Remove and replace approximately 30 damaged shingles along the roof ridge. Inspect and reseal chimney flashing. Repair decking and shingles around the vent pipe where water damage was identified.',
      start_date: '',
      end_date: '',
    },
    lineItems: [
      { id: createEstimateId(), description: 'Architectural shingles (bundle, ~33 sq ft)', qty: 3, unit_price: 42, type: 'material' },
      { id: createEstimateId(), description: 'Flashing sealant (tube)', qty: 2, unit_price: 14, type: 'material' },
      { id: createEstimateId(), description: 'Plywood decking patch (4x4 sheet)', qty: 1, unit_price: 38, type: 'material' },
      { id: createEstimateId(), description: '2 workers', qty: 6, unit_price: 45, type: 'labor' },
    ],
    photos: [],
    notes: {
      warranty: '1-year labor warranty on all work performed.',
      payment_terms: '50% deposit to schedule the job, remaining balance due on completion.',
      additional:
        'Full roof inspection recommended within 12 months given the age of the surrounding shingles.',
    },
    totals: { taxRate: 8.25 },
    sentAt: daysAgo(1),
  });

  const approved = saveEstimate({
    id: createEstimateId(),
    ticket_number: 'SQ-1078',
    status: 'approved',
    customer: {
      name: 'Marcus Webb',
      phone: '(903) 555-0199',
      email: 'marcus.webb@example.com',
      address: '14 Pine Court, Mount Vernon, TX',
    },
    job: {
      title: 'Exterior Trim Painting',
      description:
        'Scrape, prime, and repaint all exterior wood trim, fascia, and shutters. Caulk gaps to prevent moisture intrusion before painting.',
      start_date: '',
      end_date: '',
    },
    lineItems: [
      { id: createEstimateId(), description: 'Exterior primer (gallon)', qty: 2, unit_price: 32, type: 'material' },
      { id: createEstimateId(), description: 'Exterior paint (gallon)', qty: 3, unit_price: 48, type: 'material' },
      { id: createEstimateId(), description: 'Caulk and sundries', qty: 1, unit_price: 40, type: 'material' },
      { id: createEstimateId(), description: '2 painters', qty: 10, unit_price: 42, type: 'labor' },
    ],
    photos: [],
    notes: {
      warranty: '2-year warranty against peeling and cracking.',
      payment_terms: '50% deposit to schedule the job, remaining balance due on completion.',
      additional: '',
    },
    totals: { taxRate: 8.25 },
    sentAt: daysAgo(3),
    approvedAt: daysAgo(2),
  });

  return [draft, sent, approved];
}
