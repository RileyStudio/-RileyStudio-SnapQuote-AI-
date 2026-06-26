import { NextResponse } from 'next/server';
import { computeSubtotals, toLineItemsTableFormat } from '@/lib/estimateMath';

// Real PDF rendering via pdf-lib, with the original HTML document (Phase 4)
// kept as a guaranteed-safe fallback. pdf-lib is loaded lazily inside
// buildQuotePdf() rather than imported at the top of this file — on
// purpose: a dynamic import failure (package not installed, platform
// issue, anything) is catchable from inside the request handler, whereas
// a failed top-level import would crash this entire route module,
// including the HTML-only fallback path. That tradeoff is deliberate:
// this route should never be the reason a contractor can't get *some*
// usable document.
//
// Accepts either shape already used elsewhere in the app — see
// lib/mockData.js's demoDraftEstimate (contractor-side, has `lineItems`)
// and demoQuote (customer-facing, has separate `materials`/`labor`).

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Expected a JSON request body.' }, { status: 400 });
  }

  const { quote } = body || {};
  if (!quote || typeof quote !== 'object') {
    return NextResponse.json({ error: 'Missing "quote" object in request body.' }, { status: 400 });
  }

  let data;
  try {
    data = normalizeQuoteForPdf(quote);
  } catch (e) {
    return NextResponse.json(
      { error: `Could not read the quote data: ${e.message}` },
      { status: 400 }
    );
  }

  let html;
  try {
    html = buildQuoteHtml(data);
  } catch (e) {
    return NextResponse.json(
      { error: `Could not generate the quote document: ${e.message}` },
      { status: 500 }
    );
  }

  try {
    const pdfBytes = await buildQuotePdf(data);
    const filename = `quote-${sanitizeFilename(data.ticketNumber || 'estimate')}.pdf`;
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    // Real PDF rendering failed for any reason (dependency unavailable,
    // an embedding error, anything else) — the HTML document built above
    // is the documented, guaranteed fallback rather than a hard failure.
    return NextResponse.json({ html, demo: true, fallback: true, error: e.message });
  }
}

function sanitizeFilename(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '') || 'estimate';
}

// Normalizes either app shape into one canonical render shape, now always
// including the labor/materials/tax breakdown (not just the total) since
// the PDF body lists them separately per the design spec.
function normalizeQuoteForPdf(quote) {
  const isDraftShape = Array.isArray(quote.lineItems);

  if (isDraftShape) {
    const { laborSubtotal, materialsSubtotal } = computeSubtotals(quote.lineItems);
    const taxRate = Number(quote.taxRate) || 0;
    const tax = materialsSubtotal * (taxRate / 100);
    const total = laborSubtotal + materialsSubtotal + tax;
    const { materials, labor } = toLineItemsTableFormat(quote.lineItems);

    return {
      businessName: quote.contractor?.business_name || 'Your Business',
      logoUrl: quote.contractor?.logo_url || '',
      licenseNote: quote.contractor?.license_note || '',
      footerText: quote.contractor?.footer_text || quote.footer_text || '',
      customerName: quote.customer?.name || '',
      address: quote.customer?.address || '',
      jobType: quote.job?.title || '',
      ticketNumber: quote.ticket_number || '',
      quoteDate: quote.created_at || '',
      description: quote.job?.description || '',
      materials,
      labor,
      laborSubtotal,
      materialsSubtotal,
      tax,
      total,
      warranty: quote.notes?.warranty || '',
      paymentTerms: quote.notes?.payment_terms || '',
      additionalNotes: quote.notes?.additional || '',
      approvedAt: quote.approved_at || null,
      // Set explicitly by the caller (Review/Quote pages already know
      // whether this record is Supabase-backed or local/demo) — this
      // route never guesses at it. Drives the EXAMPLE/VOID watermark
      // below; never true for an authenticated Supabase-backed estimate.
      isDemo: Boolean(quote.isDemo),
    };
  }

  // Customer-facing shape (the object app/quote/[id] renders from). It has
  // no taxRate of its own, so tax is always 0 here and total_price (if
  // present) is trusted over the subtotal sum.
  const materials = quote.materials || [];
  const labor = quote.labor || [];
  const materialsSubtotal = materials.reduce(
    (sum, m) => sum + (Number(m.qty) || 0) * (Number(m.unit_cost) || 0),
    0
  );
  const laborSubtotal = labor.reduce(
    (sum, l) => sum + (Number(l.hours) || 0) * (Number(l.rate) || 0),
    0
  );
  const total =
    typeof quote.total_price === 'number' ? quote.total_price : laborSubtotal + materialsSubtotal;

  return {
    businessName: quote.contractor?.business_name || 'Your Business',
    logoUrl: quote.contractor?.logo_url || '',
    licenseNote: quote.contractor?.license_note || '',
    footerText: quote.footer_text || '',
    customerName: quote.customer_name || '',
    address: quote.address || '',
    jobType: quote.job_type || '',
    ticketNumber: quote.ticket_number || '',
    quoteDate: quote.quote_date || '',
    description: quote.scope_of_work || '',
    materials,
    labor,
    laborSubtotal,
    materialsSubtotal,
    tax: 0,
    total,
    warranty: '',
    paymentTerms: '',
    additionalNotes: quote.recommendations || '',
    approvedAt: quote.approved_at || null,
    isDemo: Boolean(quote.isDemo),
  };
}

// ─────────────────────────────────────────────────────────
// Real PDF (pdf-lib) — clean, black-and-white, print-friendly
// ─────────────────────────────────────────────────────────

async function buildQuotePdf(data) {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612; // US Letter, points (8.5in × 72)
  const pageHeight = 792; // 11in × 72
  const margin = 54; // 0.75in
  const contentWidth = pageWidth - margin * 2;

  const black = rgb(0.07, 0.07, 0.07);
  const gray = rgb(0.42, 0.42, 0.42);
  const lineGray = rgb(0.8, 0.8, 0.8);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function ensureSpace(needed) {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function drawText(text, { x = margin, size = 11, bold = false, color = black } = {}) {
    ensureSpace(size + 6);
    page.drawText(text, { x, y, size, font: bold ? boldFont : font, color });
    y -= size + 6;
  }

  function drawWrapped(text, { size = 10, color = black, bold = false } = {}) {
    const useFont = bold ? boldFont : font;
    const words = String(text || '').split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      drawText('—', { size, color });
      return;
    }
    let line = '';
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (useFont.widthOfTextAtSize(candidate, size) > contentWidth && line) {
        drawText(line, { size, color, bold });
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) drawText(line, { size, color, bold });
  }

  function drawRow(left, right, { size = 11, bold = false } = {}) {
    ensureSpace(size + 6);
    const useFont = bold ? boldFont : font;
    page.drawText(left, { x: margin, y, size, font: useFont, color: black });
    const rightWidth = useFont.widthOfTextAtSize(right, size);
    page.drawText(right, { x: pageWidth - margin - rightWidth, y, size, font: useFont, color: black });
    y -= size + 6;
  }

  function drawDivider() {
    ensureSpace(12);
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.75,
      color: lineGray,
    });
    y -= 14;
  }

  // Header — logo (if embeddable) + business name + license note
  let logoImage = null;
  let logoDims = null;
  if (data.logoUrl && /^data:image\/(png|jpe?g);base64,/i.test(data.logoUrl)) {
    try {
      const match = data.logoUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
      const [, ext, base64Data] = match;
      const bytes = Buffer.from(base64Data, 'base64');
      logoImage = /png/i.test(ext) ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      const maxSize = 44;
      const scale = Math.min(maxSize / logoImage.width, maxSize / logoImage.height, 1);
      logoDims = { width: logoImage.width * scale, height: logoImage.height * scale };
    } catch (e) {
      // An unembeddable logo (corrupt data, unsupported format) should
      // never block the rest of the PDF — just render without it.
      logoImage = null;
    }
  }

  if (logoImage && logoDims) {
    page.drawImage(logoImage, {
      x: margin,
      y: y - logoDims.height,
      width: logoDims.width,
      height: logoDims.height,
    });
    page.drawText(data.businessName || 'Your Business', {
      x: margin + logoDims.width + 12,
      y: y - logoDims.height / 2 - 6,
      size: 16,
      font: boldFont,
      color: black,
    });
    y -= logoDims.height + 10;
  } else {
    drawText(data.businessName || 'Your Business', { size: 16, bold: true });
  }
  if (data.licenseNote) drawText(data.licenseNote, { size: 9, color: gray });
  drawText('ESTIMATE', { size: 9, bold: true, color: gray });
  drawDivider();

  // Ticket info
  drawRow('Customer', data.customerName || '—');
  drawRow('Address', data.address || '—');
  drawRow('Job', data.jobType || '—');
  drawRow('Ticket No.', data.ticketNumber || '—');
  drawRow('Quote Date', formatDate(data.quoteDate));
  drawDivider();

  // Scope of work
  drawText('Scope of Work', { size: 12, bold: true });
  drawWrapped(data.description, { size: 10 });
  y -= 6;

  // Materials
  drawText('Materials', { size: 12, bold: true });
  if (data.materials.length === 0) {
    drawText('No materials listed.', { size: 10, color: gray });
  } else {
    data.materials.forEach((m) => {
      drawRow(
        `${m.description} × ${m.qty}`,
        formatMoney((Number(m.qty) || 0) * (Number(m.unit_cost) || 0)),
        { size: 10 }
      );
    });
  }
  y -= 4;

  // Labor
  drawText('Labor', { size: 12, bold: true });
  if (data.labor.length === 0) {
    drawText('No labor listed.', { size: 10, color: gray });
  } else {
    data.labor.forEach((l) => {
      drawRow(
        `${l.description} × ${l.hours} hrs @ ${formatMoney(l.rate)}/hr`,
        formatMoney((Number(l.hours) || 0) * (Number(l.rate) || 0)),
        { size: 10 }
      );
    });
  }
  y -= 4;
  drawDivider();

  drawRow('Labor Subtotal', formatMoney(data.laborSubtotal), { size: 11 });
  drawRow('Materials Subtotal', formatMoney(data.materialsSubtotal), { size: 11 });
  drawRow('Tax', formatMoney(data.tax), { size: 11 });
  y -= 4;
  drawRow('TOTAL', formatMoney(data.total), { size: 14, bold: true });
  drawDivider();

  // Notes and Terms
  drawText('Notes', { size: 12, bold: true });
  drawWrapped(data.warranty || data.additionalNotes, { size: 10 });
  y -= 6;

  drawText('Terms', { size: 12, bold: true });
  drawWrapped(data.paymentTerms, { size: 10 });
  y -= 6;

  // Approval status — the PDF's one allowance for emphasis beyond plain
  // black text, since this is the single fact a customer or contractor is
  // most likely to scan the document for.
  drawText('Approval Status', { size: 12, bold: true });
  if (data.approvedAt) {
    drawText(`APPROVED — ${formatDate(data.approvedAt)}`, { size: 11, bold: true });
  } else {
    drawText('NOT YET APPROVED', { size: 11, color: gray });
  }

  if (data.footerText) {
    y -= 8;
    drawWrapped(data.footerText, { size: 9, color: gray });
  }

  // EXAMPLE/VOID watermark — demo/local estimates only, never for an
  // authenticated Supabase-backed one (data.isDemo is set explicitly by
  // the caller in normalizeQuoteForPdf, not guessed at here). Stamped
  // across every page (not just the first), in case content overflowed.
  if (data.isDemo) {
    const watermarkColor = rgb(0.78, 0.18, 0.12);
    pdfDoc.getPages().forEach((p) => {
      const { width, height } = p.getSize();
      p.drawText('EXAMPLE / VOID', {
        x: width / 2 - 230,
        y: height / 2,
        size: 46,
        font: boldFont,
        color: watermarkColor,
        opacity: 0.28,
        rotate: degrees(-30),
      });
    });
  }

  return pdfDoc.save();
}

// ─────────────────────────────────────────────────────────
// HTML fallback (Phase 4) — unchanged in spirit, now includes the same
// labor/materials/tax breakdown the PDF shows.
// ─────────────────────────────────────────────────────────

function buildQuoteHtml(data) {
  const materialRows = data.materials.length
    ? data.materials
        .map(
          (m) => `
        <tr>
          <td>${escapeHtml(m.description)} &times; ${escapeHtml(m.qty)}</td>
          <td style="text-align:right">${formatMoney((Number(m.qty) || 0) * (Number(m.unit_cost) || 0))}</td>
        </tr>`
        )
        .join('')
    : `<tr><td colspan="2" style="color:#8B8F94;">No materials listed.</td></tr>`;

  const laborRows = data.labor.length
    ? data.labor
        .map(
          (l) => `
        <tr>
          <td>${escapeHtml(l.description)} &times; ${escapeHtml(l.hours)} hrs @ ${formatMoney(l.rate)}/hr</td>
          <td style="text-align:right">${formatMoney((Number(l.hours) || 0) * (Number(l.rate) || 0))}</td>
        </tr>`
        )
        .join('')
    : `<tr><td colspan="2" style="color:#8B8F94;">No labor listed.</td></tr>`;

  const approvalHtml = data.approvedAt
    ? `<p style="color:#1F8A4C;font-weight:700;margin:0;">APPROVED — ${formatDate(data.approvedAt)}</p>`
    : `<p style="color:#8B8F94;font-weight:700;margin:0;">NOT YET APPROVED</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Estimate — ${escapeHtml(data.businessName)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1C1F23; background: #F7F7F5; margin: 0; padding: 32px; }
  .sheet { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #6b6f73; font-size: 13px; margin: 0; }
  .section { margin-top: 24px; }
  .section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b6f73; margin: 0 0 8px; }
  .section p { margin: 0; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 6px 0; border-bottom: 1px solid #e6e4df; }
  .totals-table td { border-bottom: none; padding: 3px 0; }
  .total-row { display: flex; justify-content: space-between; align-items: center; background: #1C1F23; color: #fff; padding: 14px 18px; border-radius: 10px; margin-top: 10px; font-weight: 700; font-size: 18px; }
  .ticket { border: 1px dashed #D8D6D0; border-radius: 10px; padding: 16px; margin-top: 16px; font-size: 14px; }
  .ticket p { margin: 4px 0; }
</style>
</head>
<body>
  ${
    data.isDemo
      ? `<div style="position:fixed;top:42%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);
          font-size:64px;font-weight:800;color:rgba(199,46,31,0.28);font-family:Arial,Helvetica,sans-serif;
          white-space:nowrap;z-index:999;pointer-events:none;">EXAMPLE / VOID</div>`
      : ''
  }
  <div class="sheet">
    <h1>${escapeHtml(data.businessName)}</h1>
    <p class="muted">${escapeHtml(data.licenseNote)}</p>

    <div class="ticket">
      <p><strong>Customer:</strong> ${escapeHtml(data.customerName) || '—'}</p>
      <p><strong>Address:</strong> ${escapeHtml(data.address) || '—'}</p>
      <p><strong>Job:</strong> ${escapeHtml(data.jobType) || '—'}</p>
      <p><strong>Ticket No:</strong> ${escapeHtml(data.ticketNumber) || '—'}</p>
      <p><strong>Quote Date:</strong> ${formatDate(data.quoteDate)}</p>
    </div>

    <div class="section">
      <h2>Scope of Work</h2>
      <p>${escapeHtml(data.description) || '—'}</p>
    </div>

    <div class="section">
      <h2>Materials</h2>
      <table><tbody>${materialRows}</tbody></table>
    </div>

    <div class="section">
      <h2>Labor</h2>
      <table><tbody>${laborRows}</tbody></table>
    </div>

    <div class="section">
      <table class="totals-table"><tbody>
        <tr><td>Labor Subtotal</td><td style="text-align:right">${formatMoney(data.laborSubtotal)}</td></tr>
        <tr><td>Materials Subtotal</td><td style="text-align:right">${formatMoney(data.materialsSubtotal)}</td></tr>
        <tr><td>Tax</td><td style="text-align:right">${formatMoney(data.tax)}</td></tr>
      </tbody></table>
      <div class="total-row">
        <span>Total</span>
        <span>${formatMoney(data.total)}</span>
      </div>
    </div>

    <div class="section">
      <h2>Notes</h2>
      <p>${escapeHtml(data.warranty) || escapeHtml(data.additionalNotes) || '—'}</p>
    </div>

    <div class="section">
      <h2>Terms</h2>
      <p>${escapeHtml(data.paymentTerms) || '—'}</p>
    </div>

    <div class="section">
      <h2>Approval Status</h2>
      ${approvalHtml}
    </div>

    ${
      data.footerText
        ? `<p class="muted" style="margin-top:24px;text-align:center;font-style:italic;">${escapeHtml(
            data.footerText
          )}</p>`
        : ''
    }
  </div>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function formatMoney(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
