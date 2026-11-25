export function parseUpdate(text) {
  if (!text || typeof text !== 'string') return { attending: null, late: null, note: null };
  const match = text.match(/\{[^]*\}/);
  if (!match) return { attending: null, late: null, note: null };
  try {
    const parsed = JSON.parse(match[0]);
    const attending = ['yes', 'no'].includes(parsed.attending) ? parsed.attending : null;
    const late = typeof parsed.late === 'boolean' ? parsed.late : null;
    const note = typeof parsed.note === 'string' && parsed.note.trim() ? parsed.note.trim() : null;
    return { attending, late, note };
  } catch {
    return { attending: null, late: null, note: null };
  }
}

export async function handleCallResult(store, body, extractor = null) {
  const id = body?.id || body?.execution_id;
  const status = body?.status;
  if (!id || !status) return { applied: false, error: 'missing_id_or_status' };

  const existing = store.call(id);
  if (!existing) return { applied: false, error: 'unknown_call' };
  if (existing.status === 'completed') return { applied: false, reason: 'already_completed' };

  if (status !== 'completed') {
    store.updateCall(id, status);
    return { applied: false, status };
  }

  let update = { attending: null, late: null, note: null };
  if (extractor && body.transcript) {
    try {
      const raw = await extractor(body.transcript);
      update = parseUpdate(raw);
    } catch (err) {
      // extraction failure shouldn't crash call update
    }
  }

  store.updateCall(id, 'completed', update);
  if (update.attending) {
    store.saveRsvp(existing.guest_id, existing.event_id, update.attending);
    return { applied: true, update };
  }

  return { applied: false, update };
}
