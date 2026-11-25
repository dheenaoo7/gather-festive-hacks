import { getStore } from '@/lib/db.mjs';
import { handleCallResult } from '@/lib/voice.mjs';

export const dynamic = 'force-dynamic';

async function extractSarvam(transcript) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) return null;
  const prompt = `Analyze this phone call transcript between an automated RSVP assistant and a wedding/event guest.
Extract the guest's RSVP attendance, whether they mentioned being late, and any note/message they left for the host.
Respond strictly in valid JSON format with keys: "attending" (either "yes", "no", or null), "late" (boolean true, false, or null), and "note" (string message or null).

Transcript:
${transcript}`;

  try {
    const res = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        model: 'sarvam-2b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const store = getStore();
    const result = await handleCallResult(store, body, extractSarvam);
    return Response.json({ ok: true, result });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 400 });
  }
}
