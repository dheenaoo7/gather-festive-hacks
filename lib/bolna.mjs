import 'server-only';
// Outbound RSVP follow-up call through Bolna (agent runs Sarvam STT, LLM and TTS on our Sarvam key).
export async function placeCall({ phone, guestName, event }) {
  const key = process.env.BOLNA_API_KEY, agent = process.env.BOLNA_AGENT_ID;
  if (!key || !agent) return { ok: false, error: 'bolna_not_configured' };
  const when = new Date(event.startsAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
  const res = await fetch('https://api.bolna.ai/call', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agent, recipient_phone_number: phone, user_data: { guest_name: guestName, event_title: event.title, venue: event.venue, event_time: when } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.message || `bolna_${res.status}` };
  return { ok: true, executionId: data.execution_id || data.id };
}
