'use client';
import { useEffect, useState } from 'react';
import flagsmith from '@flagsmith/flagsmith';
import { rsvp } from '@/app/actions';

const COPY = {
  control: { title: 'Can you make it?', sub: 'Let the host know.' },
  warm: { title: 'We’d love to have you — will you join us?', sub: 'Your answer helps the host plan food and photos.' },
};

// Flagsmith experiment: rsvp_invite_copy (control | warm). getExperimentFlag records the exposure where the copy is shown;
// tapping "I'm going" tracks the rsvp_yes conversion for the same Gather user identity.
export default function RsvpInvite({ userId, eventId, response }) {
  const [variant, setVariant] = useState(null);
  useEffect(() => {
    const environmentID = process.env.NEXT_PUBLIC_FLAGSMITH_ENV_KEY;
    if (!environmentID) { setVariant('control'); return; }
    flagsmith.init({ environmentID, identity: userId, enableEvents: true })
      .then(() => {
        const f = flagsmith.getExperimentFlag?.('rsvp_invite_copy') ?? null;
        setVariant(String(f?.value ?? flagsmith.getValue('rsvp_invite_copy') ?? 'control'));
      })
      .catch(() => setVariant('control'));
  }, [userId]);
  const copy = COPY[variant] ?? COPY.control;
  return (
    <section className="status" aria-label="RSVP">
      <div className="eyebrow">Invitation{variant ? <span className="flag" title="Flagsmith experiment variant"> · {variant}</span> : null}</div>
      <h2>{response ? (response === 'yes' ? 'You’re going 🎉' : 'You can’t make it') : copy.title}</h2>
      {!response && <p>{copy.sub}</p>}
      <form action={rsvp} className="row">
        <input type="hidden" name="eventId" value={eventId} />
        <button name="response" value="yes" className={response === 'yes' ? 'primary' : ''}
          onClick={() => { try { flagsmith.trackEvent?.('rsvp_yes'); } catch {} }}>I’m going</button>
        <button name="response" value="no" className={response === 'no' ? 'primary' : ''}>Can’t make it</button>
      </form>
      <p className="small">Only you see your answer. Hosts see totals.</p>
    </section>
  );
}
