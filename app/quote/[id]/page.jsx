'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BigButton from '@/components/BigButton';
import ApprovalStamp from '@/components/ApprovalStamp';
import DemoBanner from '@/components/DemoBanner';
import PhotoStrip from '@/components/PhotoStrip';
import JobTicketCard from '@/components/JobTicketCard';
import LineItemsTable from '@/components/LineItemsTable';
import SectionLabel from '@/components/SectionLabel';
import { supabase } from '@/lib/supabaseClient';
import { demoQuote } from '@/lib/mockData';
import { computeSubtotals, toLineItemsTableFormat } from '@/lib/estimateMath';
import { getSettings, contractorFromSettings, initialsOf } from '@/lib/settings';
import { generateQuotePdf, downloadBlobFile, downloadHtmlFile } from '@/lib/apiClient';
import { getEstimateById, markEstimateApproved } from '@/lib/localEstimates';
import { getEstimatePhotoUrl } from '@/lib/supabaseStorage';
import { tryConsumeDemoLimit } from '@/lib/demoLimits';
import DemoLimitNotice from '@/components/DemoLimitNotice';

// Standard UUID v4-ish format check — good enough to distinguish "this is
// clearly meant to be a real estimate reference" from the small set of
// human-readable demo aliases below, without needing to know anything
// about Postgres's exact uuid validation rules.
function isLikelyUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
}

// The only values that are ever allowed to fall back to the static demo
// quote when nothing real matches. 'demo-quote-001' is what the landing
// page's "See Sample Quote" actually links to; 'demo'/'sample' are
// recognized aliases for the same thing.
const DEMO_ALIASES = new Set(['demo', 'sample', 'demo-quote-001']);

export default function CustomerQuotePage({ params }) {
  const { id } = params;

  const [quote, setQuote] = useState(null);
  const [isDemo, setIsDemo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [approvedAt, setApprovedAt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [downloadNotice, setDownloadNotice] = useState('');
  const [limitNotice, setLimitNotice] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // Load the quote: try Supabase first — get_quote_by_token() now matches
  // EITHER the estimate's id or its public_quote_token in one query (see
  // supabase/schema.sql; this requires re-running that function in the
  // Supabase SQL Editor, it's not something redeploying the app alone
  // fixes). A local-storage record by that exact id is next (demo/local
  // mode). Only a small, explicit set of demo aliases falls back to the
  // static sample quote — anything else, including a real-looking UUID
  // that simply didn't match anything, shows "Quote not found" instead of
  // silently substituting demo content.
  useEffect(() => {
    let isMounted = true;

    async function load() {
      const looksLikeUuid = isLikelyUuid(id);

      if (supabase) {
        const { data, error } = await supabase.rpc('get_quote_by_token', { p_token: id });

        if (!error && data && isMounted) {
          setQuote(mapRpcQuote(data));
          setIsDemo(false);
          setApproved(Boolean(data.estimate?.approved_at));
          setApprovedAt(data.estimate?.approved_at || null);
          setLoading(false);
          return;
        }
      }

      if (isMounted) {
        const settings = getSettings();
        const localRecord = getEstimateById(id);

        if (localRecord) {
          setQuote(mapLocalEstimate(localRecord, settings));
          setIsDemo(true);
          setApproved(localRecord.status === 'approved');
          setApprovedAt(localRecord.approvedAt || null);
          setLoading(false);
          return;
        }

        // A UUID-looking id is unambiguously meant to be a real estimate
        // reference, even though both lookups above missed — it must
        // never silently show someone else's demo content just because
        // the row doesn't exist (deleted, wrong project, etc.).
        if (!looksLikeUuid && DEMO_ALIASES.has(id)) {
          setQuote(applySettingsToDemoQuote(demoQuote, settings));
          setIsDemo(true);
          setLoading(false);
          return;
        }

        setNotFound(true);
        setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [id]);

  async function handleApprove() {
    if (isDemo) {
      const result = tryConsumeDemoLimit('approval');
      if (!result.allowed) {
        setLimitNotice({ label: result.label, max: result.max });
        return;
      }
      setLimitNotice(null);
    }

    setSubmitting(true);

    let finalApprovedAt = new Date().toISOString();

    if (!isDemo && supabase) {
      await supabase.rpc('approve_estimate', { token: id });
    } else {
      await new Promise((resolve) => setTimeout(resolve, 600)); // brief, deliberate pause so the action feels acknowledged
      // Persists onto the matching local record if one exists. If this
      // page is showing the static demoQuote fallback (no real record for
      // this id), there's nothing to persist approval onto — approving it
      // is a one-time preview that won't survive a refresh, which is the
      // expected/documented behavior for that sample-only case.
      const updated = markEstimateApproved(id);
      if (updated?.approvedAt) finalApprovedAt = updated.approvedAt;
    }

    setApprovedAt(finalApprovedAt);
    setApproved(true);
    setSubmitting(false);
  }

  async function handleDownload() {
    if (isDemo) {
      const result = tryConsumeDemoLimit('pdf');
      if (!result.allowed) {
        setLimitNotice({ label: result.label, max: result.max });
        return;
      }
      setLimitNotice(null);
    }

    setDownloading(true);
    setDownloadError('');
    setDownloadNotice('');
    try {
      // approved/approvedAt are separate component state, not part of the
      // `quote` object itself, so the current approval status is merged
      // in here — otherwise a freshly-approved quote would export as if
      // it were still pending.
      const payload = { ...quote, approved_at: approved ? approvedAt : null, isDemo };
      const result = await generateQuotePdf(payload);

      if (result.type === 'pdf') {
        downloadBlobFile(result.blob, result.filename);
      } else {
        downloadHtmlFile(result.html, result.filename);
        setDownloadNotice('PDF generation was unavailable, so an HTML quote was downloaded instead.');
      }
    } catch (e) {
      setDownloadError(e.message);
    } finally {
      setDownloading(false);
    }
  }

  if (notFound) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5 text-center">
        <p className="font-display font-bold text-xl mb-2">Quote not found or no longer available.</p>
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

  if (loading || !quote) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-ink/50">Loading estimate…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-16">
      {isDemo && <DemoBanner />}

      <div className="max-w-lg mx-auto px-5 pt-6">
        {limitNotice && (
          <div className="mb-6">
            <DemoLimitNotice label={limitNotice.label} max={limitNotice.max} />
          </div>
        )}

        {/* Contractor branding */}
        <header className="flex items-center gap-3 mb-6">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-white text-lg shrink-0 overflow-hidden"
            style={{ backgroundColor: quote.contractor.brand_color }}
          >
            {quote.contractor.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- contractor-provided logo (data URL or remote URL)
              <img
                src={quote.contractor.logo_url}
                alt={quote.contractor.business_name}
                className="w-full h-full object-cover"
              />
            ) : (
              quote.contractor.initials
            )}
          </div>
          <div>
            <p className="font-display font-bold text-lg leading-tight">
              {quote.contractor.business_name}
            </p>
            <p className="text-xs text-ink/50">
              {quote.contractor.phone}
              {quote.contractor.license_note && ` · ${quote.contractor.license_note}`}
            </p>
          </div>
        </header>

        <p className="font-display text-xs uppercase tracking-widest text-orange-dark font-semibold mb-2">
          Estimate
        </p>

        <JobTicketCard
          customerName={quote.customer_name}
          address={quote.address}
          jobType={quote.job_type}
          quoteDate={formatDate(quote.quote_date)}
          expirationDate={formatDate(quote.expiration_date)}
          ticketNumber={quote.ticket_number}
        />

        {quote.photos?.length > 0 && (
          <section className="mt-6">
            <SectionLabel>Job Site Photos</SectionLabel>
            <PhotoStrip photos={quote.photos} />
          </section>
        )}

        <section className="mt-6 bg-white rounded-card shadow-card p-5">
          <SectionLabel>Scope of Work</SectionLabel>
          <p className="text-sm leading-relaxed text-ink/85">{quote.scope_of_work}</p>
        </section>

        <section className="mt-6 bg-white rounded-card shadow-card p-5">
          <SectionLabel>Estimate Detail</SectionLabel>
          <LineItemsTable materials={quote.materials} labor={quote.labor} />
        </section>

        {quote.recommendations && (
          <section className="mt-6 bg-white rounded-card shadow-card p-5">
            <SectionLabel>Notes</SectionLabel>
            <p className="text-sm leading-relaxed text-ink/75">{quote.recommendations}</p>
          </section>
        )}

        <section className="mt-6 bg-ink text-paper rounded-card p-5 flex items-center justify-between">
          <span className="font-display uppercase tracking-wide text-sm text-paper/70">Total</span>
          <span className="font-display font-extrabold text-3xl">
            ${Number(quote.total_price).toLocaleString()}
          </span>
        </section>

        <div className="mt-4 text-center">
          <BigButton variant="ghost" fullWidth={false} className="px-6" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Generating PDF…' : 'Download PDF'}
          </BigButton>
          {downloadNotice && <p className="mt-2 text-sm text-ink/60">{downloadNotice}</p>}
          {downloadError && <p className="mt-2 text-sm text-orange-dark">{downloadError}</p>}
        </div>

        <section className="mt-8 text-center">
          {approved ? (
            <div>
              <ApprovalStamp approved dateLabel={formatDate(approvedAt)} />
              <p className="mt-4 font-display font-semibold text-approved text-lg">
                Estimate approved
              </p>
              <p className="text-sm text-ink/60 mt-1 max-w-xs mx-auto">
                {quote.contractor.business_name} has been notified and will be in touch to
                schedule the work.
              </p>
            </div>
          ) : (
            <BigButton variant="approve" onClick={handleApprove} disabled={submitting}>
              {submitting ? 'Approving…' : 'Approve Estimate'}
            </BigButton>
          )}
        </section>

        {quote.footer_text && (
          <p className="mt-8 text-center text-sm text-ink/70 italic">{quote.footer_text}</p>
        )}

        <p className="mt-4 text-center text-xs text-ink/45 leading-relaxed px-2">
          This estimate is based on contractor-provided photos, notes, and pricing rules.
          Final work begins only after customer approval.
        </p>
      </div>
    </main>
  );
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Maps get_quote_by_token()'s JSONB result ({ estimate, contractor,
// line_items, photos }) into the same shape demoQuote uses, so the JSX
// above never needs to know which source it's rendering. This replaces
// the old jobs/job_photos-join query from the original schema — that
// table no longer exists.
function mapRpcQuote(result) {
  const e = result.estimate || {};
  const c = result.contractor || {};

  const lineItems = (result.line_items || []).map((li) => ({
    description: li.description,
    qty: Number(li.quantity),
    unit_price: Number(li.unit_price),
    type: li.item_type,
  }));
  const { materials, labor } = toLineItemsTableFormat(lineItems);

  return {
    customer_name: e.customer_name,
    address: e.customer_address,
    job_type: e.job_title,
    quote_date: e.created_at,
    expiration_date: addDays(e.created_at, c.expiration_days ?? 14),
    ticket_number: e.ticket_number,
    photos: (result.photos || []).map((p) => ({
      id: p.id,
      caption: p.caption,
      storage_path: p.storage_path,
      previewUrl: getEstimatePhotoUrl(p.storage_path),
    })),
    scope_of_work: e.job_description,
    materials,
    labor,
    recommendations: e.additional_notes,
    total_price: Number(e.total) || 0,
    footer_text: c.footer_text,
    contractor: {
      business_name: c.business_name,
      initials: initialsOf(c.business_name),
      brand_color: c.brand_color || '#FF5A1F',
      phone: c.phone,
      logo_url: c.logo_url || undefined,
      license_note: c.license_note,
    },
  };
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// Applies saved Settings (or, absent any, the demo defaults that
// getSettings() already returns) on top of the static demo quote — this is
// the "fall back to demoQuote branding if no saved settings exist"
// requirement, satisfied structurally rather than as a special case.
function applySettingsToDemoQuote(base, settings) {
  return {
    ...base,
    expiration_date: addDays(base.quote_date, settings.estimateTerms.expiration_days),
    footer_text: settings.branding.footer_text,
    contractor: contractorFromSettings(settings),
  };
}

// Maps a persistent local estimate record (lib/localEstimates.js) into the
// same shape demoQuote and mapSupabaseEstimate produce. This is what lets
// a real estimate built in app/estimates/new actually show its own data at
// its own /quote/[id] link, instead of always falling back to the one
// static sample quote.
function mapLocalEstimate(estimate, settings) {
  const taxRate = estimate.totals?.taxRate ?? 0;
  const { laborSubtotal, materialsSubtotal } = computeSubtotals(estimate.lineItems || []);
  const tax = materialsSubtotal * (taxRate / 100);
  const total = laborSubtotal + materialsSubtotal + tax;
  const { materials, labor } = toLineItemsTableFormat(estimate.lineItems || []);

  return {
    customer_name: estimate.customer?.name,
    address: estimate.customer?.address,
    job_type: estimate.job?.title,
    quote_date: estimate.createdAt,
    expiration_date: addDays(estimate.createdAt, settings.estimateTerms.expiration_days),
    ticket_number: estimate.ticket_number,
    photos: (estimate.photos || []).map((p) => ({
      id: p.id,
      caption: p.caption,
      previewUrl: p.previewUrl,
    })),
    scope_of_work: estimate.job?.description,
    materials,
    labor,
    recommendations: estimate.notes?.additional,
    total_price: total,
    footer_text: settings.branding.footer_text,
    contractor: contractorFromSettings(settings),
  };
}
