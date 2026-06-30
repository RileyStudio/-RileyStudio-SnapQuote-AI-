import { NextResponse } from 'next/server';

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `li-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Continues the same bathroom-floor-repair scenario as the demo transcript
// in app/api/transcribe, so the two demo endpoints read as one coherent job.
const DEMO_ESTIMATE = {
  job_title: 'Bathroom Floor Repair',
  description:
    'Remove damaged flooring near the sink and hallway, inspect the subfloor for moisture, replace the affected OSB subfloor, and reinstall finish flooring to match the existing bathroom.',
  line_items: [
    { type: 'material', description: 'OSB subfloor sheet (4x8, 3/4")', quantity: 2, unit_price: 48 },
    { type: 'material', description: 'Vinyl plank flooring (per sq ft)', quantity: 40, unit_price: 4.5 },
    { type: 'material', description: 'Moisture barrier and adhesive', quantity: 1, unit_price: 35 },
    { type: 'labor', description: 'Flooring technician', quantity: 6, unit_price: 55 },
  ],
  notes:
    'Moisture readings should be taken before closing up the subfloor to confirm the leak source has been fully resolved.',
  terms: '50% deposit required to schedule. Remaining balance due on completion. 1-year labor warranty.',
};

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Expected a JSON request body.' }, { status: 400 });
  }

  const { transcript, notes, customer, job } = body || {};

  if (!transcript && !notes) {
    return NextResponse.json(
      { error: 'Provide at least a "transcript" or "notes" field to draft an estimate from.' },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ estimate: withIds(DEMO_ESTIMATE), demo: true });
  }

  try {
    // Override via OPENAI_DRAFT_MODEL if your account uses a different
    // current model name — left configurable rather than hardcoded so
    // this doesn't go stale as model availability changes.
    const model = process.env.OPENAI_DRAFT_MODEL || 'gpt-4o-mini';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt({ transcript, notes, customer, job }) },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await safeText(response);
      return NextResponse.json(
        { error: `Estimate drafting request failed (${response.status}): ${detail}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      return NextResponse.json(
        { error: 'The model did not return valid JSON for the estimate draft.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ estimate: withIds(normalizeEstimate(parsed)), demo: false });
  } catch (e) {
    return NextResponse.json(
      { error: `Estimate drafting request failed: ${e.message}` },
      { status: 502 }
    );
  }
}

const SYSTEM_PROMPT = `You convert a contractor's job notes into a structured estimate draft. Return strict JSON only — no markdown formatting, no commentary — with exactly these keys:
{
  "job_title": string,
  "description": string,
  "line_items": [{ "type": "labor" | "material", "description": string, "quantity": number, "unit_price": number }],
  "notes": string,
  "terms": string
}
Use the job type and description to inform typical material names and reasonable market rates for that trade. Round prices to whole or half dollars — avoid false precision.`;

function buildUserPrompt({ transcript, notes, customer, job }) {
  const parts = [];
  if (job?.title) parts.push(`Job title: ${job.title}`);
  if (job?.description) parts.push(`Job description: ${job.description}`);
  if (customer?.address) parts.push(`Job address: ${customer.address}`);
  if (transcript) parts.push(`Voice note transcript: ${transcript}`);
  if (notes) parts.push(`Additional notes: ${notes}`);
  return parts.join('\n') || 'No additional context provided.';
}

// Defends against a model returning slightly-off field names or types —
// coerces to the exact shape the app expects rather than trusting it blindly.
function normalizeEstimate(raw) {
  return {
    job_title: typeof raw?.job_title === 'string' ? raw.job_title : '',
    description: typeof raw?.description === 'string' ? raw.description : '',
    line_items: Array.isArray(raw?.line_items)
      ? raw.line_items.map((item) => ({
          type: item?.type === 'labor' ? 'labor' : 'material',
          description: String(item?.description || ''),
          quantity: Number(item?.quantity) || 0,
          unit_price: Number(item?.unit_price) || 0,
        }))
      : [],
    notes: typeof raw?.notes === 'string' ? raw.notes : '',
    terms: typeof raw?.terms === 'string' ? raw.terms : '',
  };
}

function withIds(estimate) {
  return {
    ...estimate,
    line_items: estimate.line_items.map((item) => ({ id: newId(), ...item })),
  };
}

async function safeText(response) {
  try {
    return await response.text();
  } catch (e) {
    return 'no response body';
  }
}
