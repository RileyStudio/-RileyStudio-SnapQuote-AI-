'use client';

import { useState } from 'react';

// Pure client-side sharing: mailto:/sms: links and the clipboard API.
// Deliberately does not call /api/send-email — that route still exists
// and works if RESEND_API_KEY is configured, but nothing in the UI
// presents itself as "sending an email" anymore. These three actions just
// hand off to the contractor's own email/messaging apps, or copy a link —
// all immediately verifiable, nothing to falsely claim succeeded.
export default function ShareEstimateModal({
  open,
  onClose,
  quoteUrl,
  customerName,
  customerEmail,
  customerPhone,
  businessName,
}) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const greeting = customerName ? `Hi ${customerName},` : 'Hi there,';
  const fromWhom = businessName || 'your contractor';

  const mailtoHref = `mailto:${customerEmail || ''}?subject=${encodeURIComponent(
    `Your estimate from ${fromWhom}`
  )}&body=${encodeURIComponent(`${greeting}\n\n${fromWhom} sent you an estimate. View and approve it here:\n${quoteUrl}\n`)}`;

  const smsHref = `sms:${customerPhone || ''}?body=${encodeURIComponent(
    `${greeting} Here's your estimate from ${fromWhom}: ${quoteUrl}`
  )}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(quoteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // Clipboard API unavailable or blocked — the link is still right
      // there in the modal to select and copy manually.
    }
  }

  return (
    <div
      className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 px-5"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-card shadow-soft p-5 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display font-bold text-lg">Share Estimate</p>
        <p className="text-sm text-ink/60 mt-1 mb-4 break-all">{quoteUrl}</p>

        <div className="space-y-2">
          <a
            href={mailtoHref}
            className="tap-target w-full flex items-center justify-center rounded-card bg-orange
              text-white font-display font-semibold text-base px-6 hover:bg-orange-dark transition-colors"
          >
            Email Link
          </a>
          <a
            href={smsHref}
            className="tap-target w-full flex items-center justify-center rounded-card bg-site
              text-white font-display font-semibold text-base px-6 hover:bg-site-dark transition-colors"
          >
            Text Link
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="tap-target w-full rounded-card border border-line font-display font-semibold
              text-base px-6 hover:bg-line/20 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>

        {!customerEmail && (
          <p className="text-xs text-ink/40 mt-3">No customer email on file — Email Link opens blank.</p>
        )}
        {!customerPhone && (
          <p className="text-xs text-ink/40 mt-1">No customer phone on file — Text Link opens blank.</p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-xs text-ink/50 underline w-full text-center"
        >
          Close
        </button>
      </div>
    </div>
  );
}
