'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import BigButton from '@/components/BigButton';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/lib/supabaseClient';
import { demoJobs, demoContractor } from '@/lib/mockData';
import { getSettings } from '@/lib/settings';
import {
  getAllEstimates,
  deleteEstimate,
  duplicateEstimate,
  markEstimateApproved,
  seedDemoEstimates,
} from '@/lib/localEstimates';

const STATUS_FILTERS = ['all', 'draft', 'sent', 'approved'];

export default function DashboardPage() {
  const [jobs, setJobs] = useState([]);
  const [contractor, setContractor] = useState(demoContractor);
  const [loading, setLoading] = useState(true);
  const [showingStaticSamples, setShowingStaticSamples] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [isDemoSession, setIsDemoSession] = useState(false);

  useEffect(() => {
    // Dashboard has no auth/session check that blocks access at all — it
    // already falls through to local/demo data whenever there's no real
    // Supabase session, regardless of this flag. This read exists so that
    // relationship is explicit and visible in the code (and so a future
    // gate, if one is ever added, has an obvious existing flag to consult)
    // rather than just asserted in a comment with nothing to point to.
    try {
      if (typeof window !== 'undefined') {
        setIsDemoSession(window.localStorage.getItem('snapquote.demoSession') === 'true');
      }
    } catch (e) {
      // Ignore — absence of this flag never blocks anything below.
    }

    async function load() {
      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;

        if (userId) {
          const { data: contractorRow } = await supabase
            .from('contractors')
            .select('*')
            .eq('id', userId)
            .single();
          if (contractorRow) setContractor(contractorRow);

          const { data: jobRows } = await supabase
            .from('jobs')
            .select('*')
            .eq('contractor_id', userId)
            .order('created_at', { ascending: false });
          if (jobRows) {
            setJobs(jobRows.map((j) => toRow(j, false)));
            setShowingStaticSamples(false);
            setLoading(false);
            return;
          }
        }
      }

      refreshLocalData();
      setLoading(false);
    }
    load();
  }, []);

  // Re-reads from lib/localEstimates.js and decides whether to show real
  // records or the static sample fallback. Called once on initial demo-mode
  // load, and again after every row action (delete/duplicate/mark approved)
  // so the list never goes stale without a full page reload.
  function refreshLocalData() {
    const settings = getSettings();
    setContractor({ ...demoContractor, business_name: settings.businessProfile.business_name });

    const localRecords = getAllEstimates();
    if (localRecords.length > 0) {
      setJobs(localRecords.map((r) => toRow(r, true)));
      setShowingStaticSamples(false);
    } else {
      setJobs(demoJobs.map((j) => toRow(j, false)));
      setShowingStaticSamples(true);
    }
  }

  function flashMessage(text) {
    setActionMessage(text);
    setTimeout(() => setActionMessage(''), 2500);
  }

  function handleMarkApproved(id) {
    markEstimateApproved(id);
    refreshLocalData();
    flashMessage('Marked approved.');
  }

  function handleDuplicate(id) {
    const duplicate = duplicateEstimate(id);
    refreshLocalData();
    flashMessage(duplicate ? 'Estimate duplicated — find the copy in Drafts.' : 'Could not duplicate this estimate.');
  }

  function handleConfirmDelete(id) {
    deleteEstimate(id);
    setConfirmingDeleteId(null);
    refreshLocalData();
    flashMessage('Estimate deleted.');
  }

  function handleLoadDemoEstimates() {
    seedDemoEstimates();
    refreshLocalData();
    flashMessage('Loaded 3 demo estimates — try Edit, Duplicate, Mark Approved, or Delete on them.');
  }

  const metrics = useMemo(() => {
    const approvedJobs = jobs.filter((j) => j.status === 'approved');
    return {
      total: jobs.length,
      drafts: jobs.filter((j) => j.status === 'draft').length,
      sent: jobs.filter((j) => j.status === 'sent').length,
      approved: approvedJobs.length,
      approvedValue: approvedJobs.reduce((sum, j) => sum + (Number(j.total_price) || 0), 0),
    };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (statusFilter !== 'all' && job.status !== statusFilter) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.trim().toLowerCase();
      return [job.customer_name, job.job_type, job.address, job.ticket_number]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(term));
    });
  }, [jobs, searchTerm, statusFilter]);

  function resetFilters() {
    setSearchTerm('');
    setStatusFilter('all');
  }

  function actionsFor(job) {
    if (job.status === 'draft') {
      return [
        { label: 'Edit', href: `/estimates/${job.id}/edit` },
        { label: 'Review', href: `/estimates/${job.id}/review` },
        { label: 'Delete', onClick: () => setConfirmingDeleteId(job.id), danger: true },
      ];
    }
    if (job.status === 'sent') {
      return [
        { label: 'View Quote', href: `/quote/${job.id}` },
        { label: 'Mark Approved', onClick: () => handleMarkApproved(job.id) },
        { label: 'Duplicate', onClick: () => handleDuplicate(job.id) },
        { label: 'Delete', onClick: () => setConfirmingDeleteId(job.id), danger: true },
      ];
    }
    // approved
    return [
      { label: 'View Quote', href: `/quote/${job.id}` },
      { label: 'Duplicate', onClick: () => handleDuplicate(job.id) },
      { label: 'Delete', onClick: () => setConfirmingDeleteId(job.id), danger: true },
    ];
  }

  return (
    <main className="max-w-2xl mx-auto px-5 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <Logo size="sm" />
          <p className="text-sm text-ink/60 mt-1 flex items-center gap-2">
            {contractor.business_name}
            {isDemoSession && (
              <span className="font-display font-semibold text-[10px] uppercase tracking-wide
                bg-site/10 text-site rounded-full px-2 py-0.5">
                Demo Mode
              </span>
            )}
          </p>
        </div>
        <Link href="/settings" className="font-display font-semibold text-sm text-ink/70">
          Settings
        </Link>
      </header>

      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
          <MetricCard label="Total" value={metrics.total} />
          <MetricCard label="Drafts" value={metrics.drafts} />
          <MetricCard label="Sent" value={metrics.sent} />
          <MetricCard label="Approved" value={metrics.approved} />
          <MetricCard label="Approved Value" value={`$${metrics.approvedValue.toFixed(0)}`} />
        </div>
      )}

      <Link href="/estimates/new">
        <BigButton variant="primary" className="mb-2">
          {showingStaticSamples ? '+ Create Your First Estimate' : '+ New Estimate'}
        </BigButton>
      </Link>
      {showingStaticSamples && !loading && (
        <>
          <BigButton variant="secondary" className="mb-2" onClick={handleLoadDemoEstimates}>
            Load Demo Estimates
          </BigButton>
          <p className="text-xs text-ink/50 mb-4">
            The rows below are sample estimates. Create your first real one above, or tap
            &quot;Load Demo Estimates&quot; to seed 3 realistic records (one draft, one sent,
            one approved) you can edit, duplicate, mark approved, or delete.
          </p>
        </>
      )}

      {!loading && jobs.length > 0 && (
        <div className="mb-4 space-y-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by customer, job, address, or ticket number"
            className="tap-target w-full rounded-card border border-line bg-white px-3 text-sm
              focus-visible:outline focus-visible:outline-3 focus-visible:outline-site"
          />
          <div className="flex gap-2 flex-wrap">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-full text-xs font-display font-semibold uppercase tracking-wide ${
                  statusFilter === status
                    ? 'bg-ink text-paper'
                    : 'bg-white border border-line text-ink/60'
                }`}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {actionMessage && (
        <p className="mb-4 text-sm font-display font-semibold text-approved">{actionMessage}</p>
      )}

      {loading ? (
        <p className="text-ink/50">Loading jobs…</p>
      ) : jobs.length === 0 ? (
        <EmptyState />
      ) : filteredJobs.length === 0 ? (
        <NoFilterMatches onReset={resetFilters} />
      ) : (
        <ul className="space-y-3">
          {filteredJobs.map((job) => (
            <li key={job.id} className="bg-white rounded-card shadow-card px-4 py-4">
              <Link href={primaryLinkFor(job)} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-semibold truncate">{job.address}</p>
                  <p className="text-sm text-ink/60 truncate">
                    {job.customer_name} · {job.job_type}
                  </p>
                  {job.updatedAt && (
                    <p className="text-xs text-ink/40 mt-0.5">Updated {formatDate(job.updatedAt)}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={job.status} />
                  {job.total_price != null && (
                    <p className="text-sm font-semibold mt-1">${Number(job.total_price).toFixed(0)}</p>
                  )}
                </div>
              </Link>

              {job.isLocal && (
                <div className="mt-3 pt-3 border-t border-line">
                  {confirmingDeleteId === job.id ? (
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span className="text-ink/60">Delete this estimate?</span>
                      <button
                        type="button"
                        onClick={() => handleConfirmDelete(job.id)}
                        className="font-display font-semibold text-orange-dark"
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        className="font-display font-semibold text-ink/50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      {actionsFor(job).map((action) =>
                        action.href ? (
                          <Link
                            key={action.label}
                            href={action.href}
                            className="font-display font-semibold text-site"
                          >
                            {action.label}
                          </Link>
                        ) : (
                          <button
                            key={action.label}
                            type="button"
                            onClick={action.onClick}
                            className={`font-display font-semibold ${
                              action.danger ? 'text-orange-dark' : 'text-site'
                            }`}
                          >
                            {action.label}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="bg-white rounded-card shadow-card px-3 py-3 text-center">
      <p className="font-display font-extrabold text-xl">{value}</p>
      <p className="text-xs text-ink/50 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 text-ink/60">
      <p className="font-display text-xl mb-1">No estimates yet.</p>
      <p className="text-sm">Tap &quot;New Estimate&quot; to quote your first job.</p>
    </div>
  );
}

function NoFilterMatches({ onReset }) {
  return (
    <div className="text-center py-16 text-ink/60">
      <p className="font-display text-xl mb-3">No estimates match this filter.</p>
      <BigButton variant="ghost" fullWidth={false} className="px-6" onClick={onReset}>
        Reset Filters
      </BigButton>
    </div>
  );
}

// Normalizes a row into the one shape the list renders, regardless of
// whether it came from Supabase, a real local estimate record, or a
// static demo sample — and tags whether it's a real local record, since
// only real records get the Phase 7 action bar (Edit/Review/Delete, etc.)
// and search-by-ticket-number support.
function toRow(source, isLocal) {
  if (isLocal && source.customer) {
    return {
      id: source.id,
      isLocal: true,
      address: source.customer?.address || '—',
      customer_name: source.customer?.name || 'Unnamed customer',
      job_type: source.job?.title || 'Untitled job',
      status: source.status,
      total_price: source.totals?.total ?? null,
      updatedAt: source.updatedAt,
      ticket_number: source.ticket_number || '',
    };
  }

  return {
    id: source.id,
    isLocal: false,
    address: source.address,
    customer_name: source.customer_name,
    job_type: source.job_type,
    status: source.status,
    total_price: source.total_price,
    updatedAt: source.updated_at || source.created_at || null,
    ticket_number: source.ticket_number || '',
  };
}

// Where tapping the row body itself (not an action button) goes. Real
// local drafts go to Edit; everything else goes to its customer-facing
// quote (static sample rows fall back to the one static demo quote, same
// as Phase 6).
function primaryLinkFor(job) {
  if (job.isLocal) {
    return job.status === 'draft' ? `/estimates/${job.id}/edit` : `/quote/${job.id}`;
  }
  return job.status === 'draft' ? '/estimates/new' : `/quote/${job.id}`;
}

function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
