import { NextResponse } from 'next/server';

// Same scenario used by app/api/draft-estimate's demo response, so a
// contractor clicking through both demo endpoints in sequence sees one
// coherent job rather than two unrelated samples.
const DEMO_TRANSCRIPT =
  'Customer needs a bathroom floor repair near the sink and hallway. Existing OSB is soft from a previous leak. Contractor should remove damaged flooring, inspect for moisture, replace subfloor, and reinstall finish flooring.';

export async function POST(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return NextResponse.json(
      { error: 'Expected multipart/form-data with an "audio" field.' },
      { status: 400 }
    );
  }

  const audio = formData.get('audio');
  if (!audio || typeof audio === 'string') {
    return NextResponse.json({ error: 'Missing "audio" file in form data.' }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ transcript: DEMO_TRANSCRIPT, demo: true });
  }

  try {
    // NOTE: verify "whisper-1" is still the right model name in OpenAI's
    // current docs before relying on this in production — model names
    // and endpoints do change over time.
    const upstreamForm = new FormData();
    upstreamForm.append('file', audio, audio.name || 'recording.webm');
    upstreamForm.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
    });

    if (!response.ok) {
      const detail = await safeText(response);
      return NextResponse.json(
        { error: `Transcription request failed (${response.status}): ${detail}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json({ transcript: data.text || '', demo: false });
  } catch (e) {
    // A real-key failure (bad key, quota, network) is reported as an error
    // rather than silently falling back to the demo transcript — masking
    // it would hide a real configuration problem from the contractor.
    return NextResponse.json(
      { error: `Transcription request failed: ${e.message}` },
      { status: 502 }
    );
  }
}

async function safeText(response) {
  try {
    return await response.text();
  } catch (e) {
    return 'no response body';
  }
}
