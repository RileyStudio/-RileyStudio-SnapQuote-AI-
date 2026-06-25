// Thin fetch wrappers around the three API routes. Each throws a helpful
// Error (using the route's own { error } message when present) rather than
// returning a half-parsed response, so callers can just try/catch and show
// e.message directly in the UI.

async function parseJsonResponse(response) {
  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error(`Unexpected response from the server (status ${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}.`);
  }

  return data;
}

// → { sent: boolean, demo: boolean, message?: string }
export async function sendEstimateEmail({ to, customerName, businessName, quoteLink, type }) {
  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, customerName, businessName, quoteLink, type }),
  });
  return parseJsonResponse(response);
}

// → { transcript: string, demo: boolean }
export async function transcribeAudio(file) {
  if (!file) {
    throw new Error('No audio file provided.');
  }

  const formData = new FormData();
  formData.append('audio', file);

  const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
  return parseJsonResponse(response);
}

// payload: { transcript?, notes?, customer?, job? }
// → { estimate: { job_title, description, line_items, notes, terms }, demo: boolean }
export async function draftEstimateFromNotes(payload) {
  const response = await fetch('/api/draft-estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(response);
}

// → { url: string | null, html: string, demo: boolean }
// NOTE: /api/generate-pdf now succeeds with a real PDF binary response
// (see generateQuotePdf below) and only returns JSON when PDF rendering
// failed. This function still assumes an always-JSON response — calling
// response.json() on a successful PDF response would fail to parse and
// throw — so it's kept only for any caller that explicitly wants the old
// always-HTML behavior. The UI's Download PDF buttons use
// generateQuotePdf, which already handles both outcomes correctly.
export async function generateQuoteHtml(quote) {
  const response = await fetch('/api/generate-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quote }),
  });
  return parseJsonResponse(response);
}

// → { type: 'pdf', blob: Blob, filename: string }
//   | { type: 'html', html: string, filename: string }
// Branches on the response's Content-Type rather than assuming either
// outcome, since /api/generate-pdf returns a real `application/pdf` binary
// on success and falls back to the documented JSON shape
// ({ html, demo, fallback, error }) only when real PDF rendering failed.
// Throws (via parseJsonResponse) using the route's own error message for
// any genuine request failure (missing/malformed quote).
export async function generateQuotePdf(quote) {
  const response = await fetch('/api/generate-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quote }),
  });

  if (!response.ok) {
    return parseJsonResponse(response);
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/pdf')) {
    const blob = await response.blob();
    // Trust the server's own Content-Disposition filename (it applies the
    // same sanitization the route used) rather than reconstructing one.
    const filename =
      filenameFromContentDisposition(response.headers.get('content-disposition')) ||
      `quote-${sanitizeFilenameBase(quote?.ticket_number || quote?.id)}.pdf`;
    return { type: 'pdf', blob, filename };
  }

  // The documented fallback shape: { html, demo, fallback, error }. No
  // Content-Disposition header here (it's a JSON response), so the
  // filename is derived client-side using the same sanitization rule.
  const data = await response.json();
  const filename = `quote-${sanitizeFilenameBase(quote?.ticket_number || quote?.id)}.html`;
  return { type: 'html', html: data.html, filename };
}

function filenameFromContentDisposition(headerValue) {
  if (!headerValue) return null;
  const match = headerValue.match(/filename="([^"]+)"/);
  return match ? match[1] : null;
}

function sanitizeFilenameBase(value) {
  return String(value || 'estimate').replace(/[^a-zA-Z0-9_-]/g, '') || 'estimate';
}

// Browser-only — the one piece of DOM-touching logic in this file, kept
// isolated from the fetch helpers above so they stay safely callable from
// anywhere (even, in principle, server code) without a window reference.
export function downloadBlobFile(blob, filename) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function downloadHtmlFile(html, filename = 'quote.html') {
  downloadBlobFile(new Blob([html], { type: 'text/html' }), filename);
}
