import { getStore, currentUser } from '@/lib/db.mjs';
import { placeCall } from '@/lib/bolna.mjs';
import { flagsFor } from '@/lib/flags.mjs';

export const dynamic = 'force-dynamic';

// Host-only: place a follow-up call to one invited guest. Body: { eventId, guestId }.
export async function POST(req) {
  const user = await currentUser();
  const body = await req.json().catch(() => ({}));
  const store = getStore();
  const eventId = String(body.eventId || 'marigold-evening');
  const guestId = String(body.guestId || 'guest');
  if (!user || store.roleAt(user.id, eventId)?.kind !== 'host') return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await flagsFor(user.id)).module_voice_calls) return Response.json({ error: 'voice_calls_disabled' }, { status: 403 });
  if (store.roleAt(guestId, eventId)?.kind !== 'guest') return Response.json({ error: 'not_invited' }, { status: 400 });
  const guest = store.user(guestId);
  if (!guest.phone) return Response.json({ error: 'no_phone_on_file' }, { status: 400 });
  const r = await placeCall({ phone: guest.phone, guestName: guest.name, event: store.event(eventId) });
  if (!r.ok) return Response.json({ error: r.error }, { status: 502 });
  if (r.executionId) store.recordCall(r.executionId, guestId, eventId);
  return Response.json({ ok: true, executionId: r.executionId });
}
