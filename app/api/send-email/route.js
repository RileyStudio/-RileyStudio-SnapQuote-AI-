import { NextResponse } from 'next/server';

// Send/resend the customer quote link by email. Demo-safe by design: with
// no email provider key configured, returns a clear placeholder response
// instead of erroring — same pattern as /api/transcribe and
// /api/draft-estimate. Uses Resend (https://resend.com) as the example
// provider since its API is a single simple fetch call; swap providers by
// changing only the section inside the `if (apiKey)` block below.

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Expected a JSON request body.' }, { status: 400 });
  }

  const { to, customerName, businessName, quoteLink, type } = body || {};

  if (!to || !quoteLink) {
    return NextResponse.json(
      { error: 'Provide at least "to" (customer email) and "quoteLink".' },
      { status: 400 }
    );
  }

  const isResend = type === 'resend';
  const subject = isResend
    ? `Reminder: your estimate from ${businessName || 'your contractor'}`
    : `Your estimate from ${businessName || 'your contractor'} is ready`;

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.SEND_EMAIL_FROM || 'estimates@snapquoteai.app';

  if (!apiKey) {
    return NextResponse.json({
      sent: false,
      demo: true,
      message:
        'Demo mode: no email provider configured, so nothing was actually sent. Set RESEND_API_KEY (and optionally SEND_EMAIL_FROM) to send real emails.',
      preview: { to, subject, quoteLink },
    });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to,
        subject,
        html: buildEmailHtml({ customerName, businessName, quoteLink, isResend }),
      }),
    });

    if (!response.ok) {
      const detail = await safeText(response);
      return NextResponse.json(
        { error: `Email request failed (${response.status}): ${detail}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ sent: true, demo: false });
  } catch (e) {
    return NextResponse.json({ error: `Email request failed: ${e.message}` }, { status: 502 });
  }
}

function buildEmailHtml({ customerName, businessName, quoteLink, isResend }) {
  const greeting = customerName ? `Hi ${escapeHtml(customerName)},` : 'Hi there,';
  const intro = isResend
    ? `Just a reminder — your estimate from ${escapeHtml(businessName || 'your contractor')} is still waiting for you.`
    : `${escapeHtml(businessName || 'Your contractor')} has sent you an estimate.`;

  return `<!DOCTYPE html>
<html><body style="font-family:Arial,Helvetica,sans-serif;color:#1C1F23;padding:24px;">
  <p>${greeting}</p>
  <p>${intro}</p>
  <p><a href="${escapeHtml(quoteLink)}" style="background:#FF5A1F;color:#fff;padding:12px 20px;
    border-radius:8px;text-decoration:none;display:inline-block;">View Your Estimate</a></p>
  <p style="color:#6b6f73;font-size:13px;">${escapeHtml(quoteLink)}</p>
</body></html>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

async function safeText(response) {
  try {
    return await response.text();
  } catch (e) {
    return 'no response body';
  }
}
