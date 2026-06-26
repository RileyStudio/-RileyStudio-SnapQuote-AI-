'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from './Logo';
import BigButton from './BigButton';
import SectionLabel from './SectionLabel';
import TextField from './TextField';
import TextAreaField from './TextAreaField';
import LineItemEditor from './LineItemEditor';
import PhotoUploader from './PhotoUploader';
import { computeSubtotals } from '@/lib/estimateMath';
import { getSettings, defaultEstimateNotes } from '@/lib/settings';
import { transcribeAudio, draftEstimateFromNotes } from '@/lib/apiClient';
import { getEstimateById, saveEstimate, createEstimateId } from '@/lib/localEstimates';
import { supabase } from '@/lib/supabaseClient';
import { getEstimateByIdRemote, saveEstimateRemote } from '@/lib/supabaseEstimates';
import { getSettingsRemote } from '@/lib/supabaseSettings';
import { uploadEstimatePhoto } from '@/lib/supabaseStorage';
import { tryConsumeDemoLimit } from '@/lib/demoLimits';
import DemoLimitNotice from '@/components/DemoLimitNotice';

function newLineItemId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function blankLineItem() {
  return { id: newLineItemId(), description: '', qty: 1, unit_price: 0, type: 'material' };
}

/**
 * estimateId: when provided, loads and edits that persistent record
 * (app/estimates/[id]/edit). When omitted, this is a brand-new estimate
 * (app/estimates/new) — nothing is persisted until the first Save Draft
 * or Review Estimate, at which point the page URL is updated in place to
 * the new record's edit URL so a reload never creates a duplicate.
 */
export default function EstimateForm({ estimateId }) {
  const router = useRouter();
  const isEditing = Boolean(estimateId);

  const [loadingRecord, setLoadingRecord] = useState(isEditing);
  const [notFound, setNotFound] = useState(false);
  const [recordId, setRecordId] = useState(estimateId || null);
  const [recordStatus, setRecordStatus] = useState('draft');
  const [ticketNumber, setTicketNumber] = useState(
    () => `SQ-${Math.floor(1000 + Math.random() * 9000)}`
  );

  // 'local' = demo mode (lib/localEstimates.js / localStorage).
  // 'remote' = a real Supabase session exists (lib/supabaseEstimates.js).
  const [dataSource, setDataSource] = useState('local');
  const [contractorId, setContractorId] = useState(null);

  const [customer, setCustomer] = useState({ name: '', phone: '', email: '', address: '' });
  const [job, setJob] = useState({ title: '', description: '', start_date: '', end_date: '' });
  const [lineItems, setLineItems] = useState([blankLineItem()]);
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState({ warranty: '', payment_terms: '', additional: '' });
  const [taxRate, setTaxRate] = useState(8.25);
  const [savedMessage, setSavedMessage] = useState('');

  // AI Job Notes — rough notes/transcript staging area, separate from the
  // structured job.description field until "Generate Draft Estimate" is run.
  const [aiNotes, setAiNotes] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const [transcribing, setTranscribing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [aiStatus, setAiStatus] = useState(null); // { type: 'error' | 'success', message }
  const [limitNotice, setLimitNotice] = useState(null); // { label, max } | null — demo limits only

  // Load an existing record when editing, or prefill Notes/Terms defaults
  // for a brand-new one. Checks for a real Supabase session first (Phase
  // 8); falls back to the existing local-storage logic when none exists.
  // Client-only and runs once per estimateId, so it never causes a
  // server/client hydration mismatch.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    async function load() {
      let activeContractorId = null;
      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        activeContractorId = sessionData?.session?.user?.id || null;
      }

      if (activeContractorId) {
        setDataSource('remote');
        setContractorId(activeContractorId);

        if (isEditing) {
          const existing = await getEstimateByIdRemote(estimateId);
          if (!existing) {
            setNotFound(true);
            setLoadingRecord(false);
            return;
          }
          applyExistingRecord(existing);
          setLoadingRecord(false);
          return;
        }

        const settings = await getSettingsRemote(activeContractorId);
        const defaults = defaultEstimateNotes(settings.estimateTerms);
        setNotes((prev) => ({ ...prev, warranty: defaults.warranty, payment_terms: defaults.payment_terms }));
        setLoadingRecord(false);
        return;
      }

      setDataSource('local');

      if (isEditing) {
        const existing = getEstimateById(estimateId);
        if (!existing) {
          setNotFound(true);
          setLoadingRecord(false);
          return;
        }
        applyExistingRecord(existing);
        setLoadingRecord(false);
        return;
      }

      // Brand-new estimate — start Notes and Terms from the contractor's
      // saved defaults (Settings → Default Estimate Terms), or the built-in
      // demo defaults if nothing's been saved yet.
      const settings = getSettings();
      const defaults = defaultEstimateNotes(settings.estimateTerms);
      setNotes((prev) => ({ ...prev, warranty: defaults.warranty, payment_terms: defaults.payment_terms }));
      setLoadingRecord(false);
    }

    function applyExistingRecord(existing) {
      setRecordId(existing.id);
      setRecordStatus(existing.status);
      setTicketNumber(existing.ticket_number);
      setCustomer(existing.customer);
      setJob(existing.job);
      setLineItems(existing.lineItems?.length ? existing.lineItems : [blankLineItem()]);
      setPhotos(existing.photos || []);
      setNotes(existing.notes || { warranty: '', payment_terms: '', additional: '' });
      setTaxRate(existing.totals?.taxRate ?? 8.25);
    }

    load();
  }, [estimateId, isEditing]);

  const { laborSubtotal, materialsSubtotal } = useMemo(
    () => computeSubtotals(lineItems),
    [lineItems]
  );
  const tax = useMemo(() => materialsSubtotal * (taxRate / 100), [materialsSubtotal, taxRate]);
  const total = laborSubtotal + materialsSubtotal + tax;

  function buildEstimate(resolvedId, photosToUse) {
    return {
      id: resolvedId,
      ticket_number: ticketNumber,
      status: recordStatus,
      customer,
      job,
      lineItems,
      // Drop the raw File object — only the blob preview URL, caption, and
      // (once uploaded) storage_path persist. See PhotoUploader.jsx for
      // the local-mode preview-URL tradeoff.
      photos: photosToUse.map(({ id, caption, previewUrl, storage_path }) => ({
        id,
        caption,
        previewUrl,
        storage_path,
      })),
      notes,
      totals: { taxRate },
    };
  }

  async function persist() {
    // Counts a new demo estimate only on its FIRST save (recordId not yet
    // set) — re-saving/editing an estimate that already exists doesn't
    // cost another slot. Never applies when dataSource is 'remote': a
    // real Supabase session is never limited by this module.
    if (dataSource === 'local' && !recordId) {
      const result = tryConsumeDemoLimit('estimate');
      if (!result.allowed) {
        setLimitNotice({ label: result.label, max: result.max });
        return null;
      }
    }
    setLimitNotice(null);

    const resolvedId = recordId || createEstimateId();
    let photosToUse = photos;

    if (dataSource === 'remote') {
      // Upload any newly-added photos (still carrying a raw File) to
      // Storage before saving — already-uploaded ones (loaded back from
      // an existing record, which never have a File) pass through as-is.
      // An individual upload failure never blocks the rest of the save;
      // that photo just falls back to its local-only preview for now.
      photosToUse = await Promise.all(
        photos.map(async (photo) => {
          if (!photo.file) return photo;
          try {
            const result = await uploadEstimatePhoto(contractorId, resolvedId, photo.file);
            if (!result) return photo;
            return { id: photo.id, caption: photo.caption, storage_path: result.path, previewUrl: result.url };
          } catch (e) {
            return photo;
          }
        })
      );
      setPhotos(photosToUse);
    }

    const built = buildEstimate(resolvedId, photosToUse);
    const saved =
      dataSource === 'remote' ? await saveEstimateRemote(built, contractorId) : saveEstimate(built);

    if (!recordId) {
      setRecordId(saved.id);
      // Update the URL in place (no new history entry) so a reload of
      // this page targets the real record instead of starting another
      // brand-new one.
      router.replace(`/estimates/${saved.id}/edit`);
    }
    return saved;
  }

  async function saveDraft() {
    const saved = await persist();
    if (!saved) return; // blocked by a demo limit — the notice is already showing
    setSavedMessage('Draft saved.');
    setTimeout(() => setSavedMessage(''), 2500);
  }

  async function reviewEstimate() {
    const saved = await persist();
    if (!saved) return;
    router.push(`/estimates/${saved.id}/review`);
  }

  async function handleTranscribe() {
    if (!audioFile) {
      setAiStatus({ type: 'error', message: 'Choose an audio file first.' });
      return;
    }
    setTranscribing(true);
    setAiStatus(null);
    try {
      const { transcript, demo } = await transcribeAudio(audioFile);
      // Append rather than clobber — protects anything the contractor
      // already typed into Rough Job Notes before uploading audio.
      setAiNotes((prev) => (prev.trim() ? `${prev.trim()}\n\n${transcript}` : transcript));
      setAiStatus({
        type: 'success',
        message: demo ? 'Transcribed (demo response).' : 'Transcribed.',
      });
    } catch (e) {
      setAiStatus({ type: 'error', message: e.message });
    } finally {
      setTranscribing(false);
    }
  }

  async function handleGenerateDraft() {
    if (!aiNotes.trim()) {
      setAiStatus({ type: 'error', message: 'Add some job notes or transcribe a voice note first.' });
      return;
    }

    if (dataSource === 'local') {
      const result = tryConsumeDemoLimit('aiDraft');
      if (!result.allowed) {
        setLimitNotice({ label: result.label, max: result.max });
        return;
      }
      setLimitNotice(null);
    }

    setDrafting(true);
    setAiStatus(null);
    try {
      const { estimate: draft, demo } = await draftEstimateFromNotes({
        notes: aiNotes,
        customer,
        job,
      });
      applyDraftEstimate(draft);
      setAiStatus({
        type: 'success',
        message: demo
          ? 'Draft applied to the form below (demo response).'
          : 'Draft applied to the form below.',
      });
    } catch (e) {
      setAiStatus({ type: 'error', message: e.message });
    } finally {
      setDrafting(false);
    }
  }

  function applyDraftEstimate(draft) {
    if (draft.job_title) setJob((prev) => ({ ...prev, title: draft.job_title }));
    if (draft.description) setJob((prev) => ({ ...prev, description: draft.description }));

    if (Array.isArray(draft.line_items) && draft.line_items.length > 0) {
      setLineItems(
        draft.line_items.map((item) => ({
          id: item.id || newLineItemId(),
          description: item.description,
          qty: item.quantity,
          unit_price: item.unit_price,
          type: item.type === 'labor' ? 'labor' : 'material',
        }))
      );
    }

    // The current /api/draft-estimate response is { notes, terms } — flat
    // strings, not our app's { warranty, payment_terms, additional } shape.
    // "terms" usually bundles deposit/payment/warranty language together
    // (see the demo response), so it maps to payment_terms; "notes" maps to
    // additional. Existing warranty text is left alone rather than guessed at.
    setNotes((prev) => ({
      ...prev,
      additional: draft.notes || prev.additional,
      payment_terms: draft.terms || prev.payment_terms,
    }));

    // The response never currently includes customer fields, so this is a
    // no-op today — but if a future model version starts inferring
    // customer details from the transcript, this guard ensures it only
    // fills fields that are still empty and never overwrites one the
    // contractor already typed.
    if (draft.customer) {
      setCustomer((prev) => {
        const merged = { ...prev };
        Object.keys(draft.customer).forEach((key) => {
          if (!prev[key] && draft.customer[key]) merged[key] = draft.customer[key];
        });
        return merged;
      });
    }
  }

  if (loadingRecord) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-ink/50">Loading estimate…</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5 text-center">
        <p className="font-display font-bold text-xl mb-2">Estimate not found</p>
        <p className="text-sm text-ink/60 mb-6 max-w-sm">
          This estimate may have been deleted, or the link is incorrect.
        </p>
        <Link href="/dashboard">
          <BigButton variant="primary" fullWidth={false} className="px-8">
            Back to Dashboard
          </BigButton>
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-5 py-6 pb-32 lg:pb-10">
      <header className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard" className="text-sm text-ink/50 font-display font-semibold">
            ← Dashboard
          </Link>
          <h1 className="font-display font-bold text-2xl mt-1">
            {isEditing ? 'Edit Estimate' : 'New Estimate'}
          </h1>
        </div>
        <Logo size="sm" />
      </header>

      {limitNotice && (
        <div className="mb-6">
          <DemoLimitNotice label={limitNotice.label} max={limitNotice.max} />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer + Job Information, styled as one estimate ticket */}
          <div className="bg-white rounded-card shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <span className="font-display font-semibold text-xs uppercase tracking-widest text-ink/50">
                Estimate Ticket
              </span>
              <span className="font-display text-xs text-ink/40">
                {recordStatus === 'draft' ? 'Draft' : recordStatus === 'sent' ? 'Sent' : 'Approved'} No.{' '}
                {ticketNumber}
              </span>
            </div>

            <div className="border-t border-dashed border-line mx-5" />

            <div className="px-5 py-4">
              <SectionLabel>Customer Information</SectionLabel>
              <div className="grid sm:grid-cols-2 gap-3">
                <TextField
                  label="Name"
                  value={customer.name}
                  onChange={(v) => setCustomer({ ...customer, name: v })}
                />
                <TextField
                  label="Phone"
                  type="tel"
                  value={customer.phone}
                  onChange={(v) => setCustomer({ ...customer, phone: v })}
                />
                <TextField
                  label="Email"
                  type="email"
                  value={customer.email}
                  onChange={(v) => setCustomer({ ...customer, email: v })}
                />
                <TextField
                  label="Address"
                  value={customer.address}
                  onChange={(v) => setCustomer({ ...customer, address: v })}
                  full
                />
              </div>
            </div>

            <div className="border-t border-dashed border-line mx-5" />

            <div className="px-5 py-4">
              <SectionLabel>Job Information</SectionLabel>
              <div className="grid sm:grid-cols-2 gap-3">
                <TextField
                  label="Job Title"
                  value={job.title}
                  onChange={(v) => setJob({ ...job, title: v })}
                  full
                />
                <TextAreaField
                  label="Description"
                  value={job.description}
                  onChange={(v) => setJob({ ...job, description: v })}
                  full
                />
                <TextField
                  label="Estimated Start"
                  type="date"
                  value={job.start_date}
                  onChange={(v) => setJob({ ...job, start_date: v })}
                />
                <TextField
                  label="Estimated Completion"
                  type="date"
                  value={job.end_date}
                  onChange={(v) => setJob({ ...job, end_date: v })}
                />
              </div>
            </div>
          </div>

          {/* AI Job Notes — feeds /api/transcribe and /api/draft-estimate */}
          <div className="bg-white rounded-card shadow-card p-5">
            <SectionLabel>AI Job Notes</SectionLabel>
            <p className="text-xs text-ink/45 mb-3">
              Works without an OpenAI key — these buttons use built-in demo responses
              until <code className="text-ink/60">OPENAI_API_KEY</code> is configured.
            </p>

            <label className="block mb-3">
              <span className="font-display text-xs uppercase tracking-wide text-ink/50 font-semibold">
                Rough Job Notes
              </span>
              <textarea
                value={aiNotes}
                onChange={(e) => setAiNotes(e.target.value)}
                rows={4}
                placeholder="Talk through the job like you would to a foreman — what needs fixing, materials, how long it'll take..."
                className="mt-1 w-full rounded-card border border-line bg-white px-3 py-2 text-sm
                  focus-visible:outline focus-visible:outline-3 focus-visible:outline-site"
              />
            </label>

            <label className="block mb-3">
              <span className="font-display text-xs uppercase tracking-wide text-ink/50 font-semibold">
                Or Upload a Voice Note (optional)
              </span>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                className="mt-1 block w-full text-sm text-ink/70"
              />
            </label>

            <div className="flex flex-col sm:flex-row gap-2">
              <BigButton
                variant="ghost"
                fullWidth={false}
                className="px-4"
                onClick={handleTranscribe}
                disabled={transcribing}
              >
                {transcribing ? 'Transcribing…' : 'Transcribe Audio'}
              </BigButton>
              <BigButton
                variant="secondary"
                fullWidth={false}
                className="px-4"
                onClick={handleGenerateDraft}
                disabled={drafting}
              >
                {drafting ? 'Generating…' : 'Generate Draft Estimate'}
              </BigButton>
            </div>

            {aiStatus && (
              <p
                className={`mt-3 text-sm ${
                  aiStatus.type === 'error' ? 'text-orange-dark' : 'text-approved'
                }`}
              >
                {aiStatus.message}
              </p>
            )}
          </div>

          <div className="bg-white rounded-card shadow-card p-5">
            <LineItemEditor items={lineItems} onItemsChange={setLineItems} />
          </div>

          <div className="bg-white rounded-card shadow-card p-5">
            <SectionLabel>Photos</SectionLabel>
            <PhotoUploader photos={photos} onPhotosChange={setPhotos} />
          </div>

          <div className="bg-white rounded-card shadow-card p-5 space-y-4">
            <SectionLabel>Notes and Terms</SectionLabel>
            <TextAreaField
              label="Warranty Notes"
              value={notes.warranty}
              onChange={(v) => setNotes({ ...notes, warranty: v })}
              full
            />
            <TextAreaField
              label="Payment Terms"
              value={notes.payment_terms}
              onChange={(v) => setNotes({ ...notes, payment_terms: v })}
              full
            />
            <TextAreaField
              label="Additional Notes"
              value={notes.additional}
              onChange={(v) => setNotes({ ...notes, additional: v })}
              full
            />
          </div>
        </div>

        {/* Estimate Summary sidebar — sticky on desktop, replaced by a
            fixed bottom bar on mobile (below) */}
        <aside className="lg:col-span-1">
          <div className="bg-ink text-paper rounded-card shadow-card p-5 lg:sticky lg:top-6 space-y-3">
            <p className="font-display font-semibold text-xs uppercase tracking-widest text-paper/60">
              Estimate Summary
            </p>
            <SummaryRow label="Labor subtotal" value={laborSubtotal} />
            <SummaryRow label="Materials subtotal" value={materialsSubtotal} />
            <label className="flex items-center justify-between text-sm text-paper/80">
              <span>Tax rate (materials only)</span>
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-16 bg-surface text-paper rounded px-2 py-1 text-right"
                />
                %
              </span>
            </label>
            <SummaryRow label="Tax" value={tax} />
            <div className="border-t border-paper/20 pt-3 flex items-center justify-between">
              <span className="font-display font-semibold uppercase tracking-wide text-sm">Total</span>
              <span className="font-display font-extrabold text-2xl">${total.toFixed(2)}</span>
            </div>

            <div className="hidden lg:block pt-2 space-y-2">
              <BigButton variant="ghost" className="!text-paper !border-paper/30" onClick={saveDraft}>
                Save Draft
              </BigButton>
              <BigButton variant="primary" onClick={reviewEstimate}>
                Review Estimate →
              </BigButton>
              {savedMessage && <p className="text-center text-xs text-paper/70">{savedMessage}</p>}
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile sticky action bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-line px-5 py-3 flex gap-3 items-center z-40">
        <div className="flex-1">
          <p className="text-xs text-ink/50">Total</p>
          <p className="font-display font-bold text-lg">${total.toFixed(2)}</p>
        </div>
        <BigButton variant="ghost" fullWidth={false} className="px-4" onClick={saveDraft}>
          Save
        </BigButton>
        <BigButton variant="primary" fullWidth={false} className="px-4" onClick={reviewEstimate}>
          Review →
        </BigButton>
      </div>
      {savedMessage && (
        <p className="lg:hidden fixed bottom-20 left-0 right-0 text-center text-xs text-approved">
          {savedMessage}
        </p>
      )}
    </main>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm text-paper/80">
      <span>{label}</span>
      <span className="font-semibold text-paper">${value.toFixed(2)}</span>
    </div>
  );
}
