'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import BigButton from '@/components/BigButton';
import SectionLabel from '@/components/SectionLabel';
import JobTicketCard from '@/components/JobTicketCard';
import PhotoStrip from '@/components/PhotoStrip';
import LineItemsTable from '@/components/LineItemsTable';
import { computeSubtotals, toLineItemsTableFormat } from '@/lib/estimateMath';
import { getSettings, contractorFromSettings } from '@/lib/settings';
import { getEstimateById, markEstimateSent } from '@/lib/localEstimates';
import { generateQuotePdf, downloadBlobFile, downloadHtmlFile } from '@/lib/apiClient';
import ShareEstimateModal from '@/components/ShareEstimateModal';
import { supabase } from '@/lib/supabaseClient';
import { getEstimateByIdRemote, markEstimateSentRemote } from '@/lib/supabaseEstimates';
import { getSettingsRemote } from '@/lib/supabaseSettings';
import { hasFeature, planLabel } from '@/lib/plans';
import { tryConsumeDemoLimit } from '@/lib/demoLimits';
import DemoLimitNotice from '@/components/DemoLimitNotice';

export default function EstimateReviewPage({ params }) {
  const { id } = params;

  const [estimate, setEstimate] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentLink, setSentLink] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [downloadNotice, setDownloadNotice] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [limitNotice, setLimitNotice] = useState(null);
  const [sendError, setSendError] = useState('');

  // 'local' = demo mode. 'remote' = a real Supabase session exists.
  const [dataSource, setDataSource] = useState('local');
  const [previewContractor, setPreviewContractor] = useState(null);
  const [expirationDays, setExpirationDays] = useState(14);
  const [plan, setPlan] = useState('solo');

  useEffect(() => {
    async function load() {
      let activeContractorId = null;
      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        activeContractorId = sessionData?.session?.user?.id || null;
      }

      if (activeContractorId) {
        setDataSource('remote');
        const record = await getEstimateByIdRemote(id);
        if (!record) {
          setNotFound(true);
          return;
        }
        setEstimate(record);
        if (record.status === 'sent' || record.status === 'approved') {
          setSentLink(`/quote/${record.publicQuoteToken || record.id}`);
        }
        const settings = await getSettingsRemote(activeContractorId);
        setPreviewContractor(contractorFromSettings(settings));
        setExpirationDays(settings.estimateTerms.expiration_days);
        setPlan(settings.plan || 'solo');
        return;
      }

      setDataSource('local');
      const record = getEstimateById(id);
      if (!record) {
        setNotFound(true);
        return;
      }
      setEstimate(record);
      if (record.status === 'sent' || record.status === 'approved') {
        setSentLink(`/quote/${record.id}`);
      }
      const settings = getSettings();
      setPreviewContractor(contractorFromSettings(settings));
      setExpirationDays(settings.estimateTerms.expiration_days);
      setPlan(settings.plan || 'solo');
    }
    load();
  }, [id]);

  if (notFound) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5 text-center">
        <p className="font-display font-bold text-xl mb-2">Estimate not found.</p>
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

  if (!estimate || !previewContractor) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-ink/50">Loading estimate…</p>
      </main>
    );
  }

  // Always recompute from the line items + tax rate rather than trusting
  // stored totals, so the numbers shown can never drift from the data.
  const taxRate = estimate.totals?.taxRate ?? 0;
  const { laborSubtotal, materialsSubtotal } = computeSubtotals(estimate.lineItems || []);
  const tax = materialsSubtotal * (taxRate / 100);
  const total = laborSubtotal + materialsSubtotal + tax;
  const { materials, labor } = toLineItemsTableFormat(estimate.lineItems || []);

  async function sendToCustomer() {
    setSending(true);
    setSendError('');
    try {
      const updated =
        dataSource === 'remote'
          ? await markEstimateSentRemote(estimate.id)
          : markEstimateSent(estimate.id);
      if (updated) setEstimate(updated);
      setSentLink(`/quote/${updated?.publicQuoteToken || updated?.id || estimate.id}`);
    } catch (e) {
      setSendError(`Could not send estimate. ${e.message || 'Unknown error.'}`);
    } finally {
      setSending(false);
    }
  }

  async function handleDownload() {
    if (dataSource === 'local') {
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
      // The estimate record doesn't carry contractor branding itself —
      // that lives in Settings — and the generate-pdf route still expects
      // a flat taxRate, not the nested totals.taxRate this record stores.
      const payload = { ...estimate, contractor: previewContractor, taxRate, isDemo: dataSource !== 'remote' };
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

  return (
    <main className="max-w-2xl mx-auto px-5 py-6 pb-10">
      <header className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard" className="text-sm text-ink/50 font-display font-semibold">
            ← Dashboard
          </Link>
          <h1 className="font-display font-bold text-2xl mt-1">Estimate Review</h1>
        </div>
        <Logo size="sm" />
      </header>

      {limitNotice && (
        <div className="mb-4">
          <DemoLimitNotice label={limitNotice.label} max={limitNotice.max} />
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 bg-white rounded-card shadow-card px-4 py-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-white text-sm shrink-0 overflow-hidden"
          style={{ backgroundColor: previewContractor.brand_color }}
        >
          {previewContractor.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- contractor-provided logo (data URL)
            <img
              src={previewContractor.logo_url}
              alt={previewContractor.business_name}
              className="w-full h-full object-cover"
            />
          ) : (
            previewContractor.initials
          )}
        </div>
        <div>
          <p className="font-display font-semibold text-sm">{previewContractor.business_name}</p>
          <p className="text-xs text-ink/50">This is how your branding will appear to the customer</p>
        </div>
        <Link href="/settings" className="ml-auto text-xs font-display font-semibold text-site shrink-0">
          Edit →
        </Link>
      </div>

      <JobTicketCard
        customerName={estimate.customer?.name}
        address={estimate.customer?.address}
        jobType={estimate.job?.title}
        quoteDate={formatDate(estimate.createdAt)}
        expirationDate={formatDate(addDays(estimate.createdAt, expirationDays))}
        ticketNumber={estimate.ticket_number}
        startDate={formatDate(estimate.job?.start_date)}
        completionDate={formatDate(estimate.job?.end_date)}
      />

      <section className="mt-4 bg-white rounded-card shadow-card p-5">
        <SectionLabel>Customer Contact</SectionLabel>
        <p className="text-sm">{estimate.customer?.phone || '—'}</p>
        <p className="text-sm text-ink/70">{estimate.customer?.email || '—'}</p>
      </section>

      {estimate.photos?.length > 0 && (
        <section className="mt-6">
          <SectionLabel>Job Photos</SectionLabel>
          <PhotoStrip photos={estimate.photos} />
        </section>
      )}

      <section className="mt-6 bg-white rounded-card shadow-card p-5">
        <SectionLabel>Job Description</SectionLabel>
        <p className="text-sm leading-relaxed text-ink/85">
          {estimate.job?.description || 'No description provided.'}
        </p>
      </section>

      <section className="mt-6 bg-white rounded-card shadow-card p-5">
        <SectionLabel>Estimate Detail</SectionLabel>
        <LineItemsTable materials={materials} labor={labor} />
      </section>

      <section className="mt-6 bg-white rounded-card shadow-card p-5 space-y-2 text-sm">
        <SummaryLine label="Labor subtotal" value={laborSubtotal} />
        <SummaryLine label="Materials subtotal" value={materialsSubtotal} />
        <SummaryLine label={`Tax (${taxRate}% on materials)`} value={tax} />
      </section>

      <section className="mt-4 bg-ink text-paper rounded-card p-5 flex items-center justify-between">
        <span className="font-display uppercase tracking-wide text-sm text-paper/70">Total</span>
        <span className="font-display font-extrabold text-3xl">${total.toFixed(2)}</span>
      </section>

      {(estimate.notes?.warranty || estimate.notes?.payment_terms || estimate.notes?.additional) && (
        <section className="mt-6 bg-white rounded-card shadow-card p-5 space-y-3">
          <SectionLabel>Notes and Terms</SectionLabel>
          {estimate.notes?.warranty && <NoteBlock label="Warranty" text={estimate.notes.warranty} />}
          {estimate.notes?.payment_terms && (
            <NoteBlock label="Payment Terms" text={estimate.notes.payment_terms} />
          )}
          {estimate.notes?.additional && (
            <NoteBlock label="Additional Notes" text={estimate.notes.additional} />
          )}
        </section>
      )}

      <section className="mt-8 space-y-3">
        {sentLink ? (
          <div className="text-center bg-approved/10 rounded-card p-5">
            <p className="font-display font-semibold text-approved">
              {estimate.status === 'approved' ? 'Estimate approved' : 'Estimate sent'}
            </p>
            <p className="text-sm text-ink/70 mt-1">Your customer link:</p>
            <Link href={sentLink} className="text-sm font-semibold text-site underline break-all">
              {sentLink}
            </Link>
            <div className="mt-4 space-y-2">
              <Link href={sentLink}>
                <BigButton variant="secondary">View as Customer →</BigButton>
              </Link>
              <BigButton variant="ghost" onClick={handleDownload} disabled={downloading}>
                {downloading ? 'Generating PDF…' : 'Download PDF'}
              </BigButton>
              {hasFeature(plan, 'sharing') ? (
                <BigButton variant="ghost" onClick={() => setShareModalOpen(true)}>
                  Share Estimate
                </BigButton>
              ) : (
                <p className="text-xs text-ink/45">
                  Sharing is available on the {planLabel('founder')} or {planLabel('pro')} plan.
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <Link href={`/estimates/${estimate.id}/edit`}>
              <BigButton variant="ghost">Edit Estimate</BigButton>
            </Link>
            <BigButton variant="ghost" onClick={handleDownload} disabled={downloading}>
              {downloading ? 'Generating PDF…' : 'Download PDF'}
            </BigButton>
            <BigButton variant="primary" onClick={sendToCustomer} disabled={sending}>
              {sending ? 'Sending…' : 'Send to Customer'}
            </BigButton>
          </>
        )}
        {downloadNotice && <p className="text-center text-sm text-ink/60">{downloadNotice}</p>}
        {downloadError && <p className="text-center text-sm text-orange-dark">{downloadError}</p>}
        {sendError && <p className="text-center text-sm font-semibold text-orange-dark">{sendError}</p>}
      </section>

      <ShareEstimateModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        quoteUrl={sentLink ? `${typeof window !== 'undefined' ? window.location.origin : ''}${sentLink}` : ''}
        customerName={estimate.customer?.name}
        customerEmail={estimate.customer?.email}
        customerPhone={estimate.customer?.phone}
        businessName={previewContractor.business_name}
      />
    </main>
  );
}

function SummaryLine({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink/60">{label}</span>
      <span className="font-semibold">${value.toFixed(2)}</span>
    </div>
  );
}

function NoteBlock({ label, text }) {
  return (
    <div>
      <p className="font-display text-xs uppercase tracking-wide text-ink/45 font-semibold mb-1">
        {label}
      </p>
      <p className="text-sm text-ink/80 leading-relaxed">{text}</p>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function addDays(dateStr, days) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
