import { getStore, currentUser } from '@/lib/db.mjs';
import { eventId } from '@/lib/store.mjs';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const user = await currentUser();
  if (!user || user.role !== 'host') {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const guestId = body.guestId || 'guest';
  const phone = body.phone || process.env.DEMO_GUEST_PHONE;

  if (!phone) {
    return Response.json({ error: 'missing_phone_number' }, { status: 400 });
  }

  const bolnaApiKey = process.env.BOLNA_API_KEY;
  const agentId = process.env.BOLNA_AGENT_ID;

  if (!bolnaApiKey || !agentId) {
    return Response.json({ error: 'bolna_not_configured' }, { status: 500 });
  }

  try {
    const res = await fetch('https://api.bolna.ai/call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bolnaApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: agentId,
        recipient_phone_number: phone,
        user_data: {
          guest_name: 'Asha',
          event_title: 'Marigold Evening',
          venue: 'The Courtyard, Bengaluru',
          event_time: 'Nov 28 at 6 PM'
        }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: 'bolna_call_failed', details: data }, { status: res.status });
    }

    const executionId = data.execution_id || data.id;
    if (executionId) {
      const store = getStore();
      store.recordCall(executionId, guestId, eventId);
    }

    return Response.json({ ok: true, data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
