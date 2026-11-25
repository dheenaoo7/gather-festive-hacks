'use client';
import { useState } from 'react';
import { checkIn } from '@/app/actions';

const MSG = {
  too_far: d => `You seem to be ${d} m from the venue. Move closer, or use the venue code at the entrance.`,
  no_pin: () => 'The host has not set the venue pin yet. Use the venue code at the entrance.',
  not_live: () => 'Check-in opens when the host starts the event.',
  bad_code: () => 'That venue code did not match.',
  no_location: () => 'We could not read your location. Use the venue code instead.',
};

// One-time proximity check: the browser location is compared on the server and then discarded.
export default function CheckIn({ eventId }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const done = r => { setBusy(false); if (!r.ok) setErr((MSG[r.reason] ?? (() => 'Check-in failed.'))(r.distance)); };
  const byLocation = () => {
    setErr(''); setBusy(true);
    if (!navigator.geolocation) return done({ ok: false, reason: 'no_location' });
    navigator.geolocation.getCurrentPosition(
      p => checkIn(eventId, { lat: p.coords.latitude, lng: p.coords.longitude }).then(done),
      () => done({ ok: false, reason: 'no_location' }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };
  const byCode = ev => { ev.preventDefault(); setErr(''); setBusy(true); checkIn(eventId, { code }).then(done); };
  return (
    <div>
      <button className="primary big" onClick={byLocation} disabled={busy}>{busy ? 'Checking…' : 'I’ve arrived — check me in'}</button>
      <p className="small">Uses your location once to confirm you’re at the venue. We store only that you arrived, never where you are.</p>
      <form onSubmit={byCode} className="row">
        <input aria-label="Venue code" placeholder="Venue code" value={code} onChange={e => setCode(e.target.value)} maxLength={8} style={{ width: 130, textTransform: 'uppercase' }} />
        <button disabled={busy || !code}>Use code</button>
      </form>
      {err && <p className="warn" role="alert">{err}</p>}
    </div>
  );
}
