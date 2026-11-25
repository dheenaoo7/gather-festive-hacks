import Link from 'next/link';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import VenuePin from '@/components/VenuePin';
import { setStatus, assignDuty, redeem, callGuest, review } from '@/app/actions';
import { DUTIES } from '@/lib/store.mjs';
import { publicBaseUrl } from '@/lib/public-url.mjs';
import { fmtSec } from '@/lib/format.mjs';

const CALL_MSG = { ok: 'Calling — the guest’s answer updates the RSVP totals when the call ends.', no_phone: 'No phone number on file for that guest.', disabled: 'Voice calls are switched off in Flagsmith.', not_allowed: 'Only hosts can place calls.' };
const REDEEM_MSG = { ok: 'Pass redeemed.', already: 'That pass was already used.', unknown: 'No pass with that code.', not_allowed: 'Only the lead host or the Goodies desk can redeem.' };

export default async function HostDesk({ user, role, event, store, flags, sp }) {
  const e = event.id;
  const sum = store.hostSummary(user.id, e);
  const cohosts = store.cohosts(user.id, e);
  const calls = store.callList(user.id, e);
  const vendors = store.vendorsAt(e);
  const acts = store.activityCounts(user.id, e);
  const code = store.checkinCode(user.id, e);
  const canRedeem = store.canRedeem(user.id, e);
  const url = `${publicBaseUrl(await headers())}/events/${e}`;
  const qr = await QRCode.toString(url, { type: 'svg', margin: 1, width: 168, color: { dark: '#3b2129', light: '#ffffff' } });
  const mine = store.myReviews(user.id, e);
  const openDesks = DUTIES.filter(d => !cohosts.some(c => c.duty === d));
  return (
    <>
      {role.lead ? (
        <form action={setStatus} className="row">
          <input type="hidden" name="eventId" value={e} />
          {event.status === 'upcoming' && <button className="primary big" name="status" value="live">Start event — open check-in</button>}
          {event.status === 'live' && <button className="big" name="status" value="completed">Wrap up — move to After event</button>}
          {event.status === 'completed' && <button name="status" value="live">Reopen live desk</button>}
        </form>
      ) : <p className="small">You’re a co-host{role.duty ? ` on the ${role.duty} desk` : ''}. The lead host controls event status and duties.</p>}

      <section>
        <div className="eyebrow">Live counts · totals only</div>
        <dl className="stats">
          <div><dt>Invited</dt><dd>{sum.invited}</dd></div>
          <div><dt>Going</dt><dd data-testid="yes">{sum.rsvp.yes}</dd></div>
          <div><dt>Not going</dt><dd data-testid="no">{sum.rsvp.no}</dd></div>
          <div><dt>Arrived</dt><dd>{sum.arrived}</dd></div>
          {flags.module_photo_queue && <div><dt>Photo queue</dt><dd>{sum.photo.queued}</dd><span className="small">{sum.photo.finished}/{sum.photo.batches} batches done</span></div>}
          {flags.module_food_queue && <div><dt>Food opt-ins</dt><dd>{sum.food.optedIn}</dd><span className="small">{sum.food.called} batches called</span></div>}
          {flags.module_goodies && <div><dt>Goodies</dt><dd>{sum.goodies.redeemed}/{sum.goodies.issued}</dd><span className="small">collected / passes</span></div>}
        </dl>
        <p className="small">Arrivals are counted once and separately from RSVPs. Individual answers are never shown.</p>
      </section>

      {event.status !== 'completed' && (
        <section className="card">
          <div className="eyebrow">Arrival setup</div>
          {role.lead && <VenuePin eventId={e} hasPin={event.venueLat != null} />}
          <p style={{ marginTop: 10 }}>Venue code fallback: <b className="mono" style={{ fontSize: 22, color: 'var(--wine)' }}>{code}</b> — put it at the entrance for guests whose location fails.</p>
        </section>
      )}

      <section className="card">
        <div className="eyebrow">Co-host desks</div>
        {cohosts.length === 0 && <p>No co-hosts at this event.</p>}
        <ul className="plain">
          {cohosts.map(c => (
            <li key={c.id}>
              {role.lead ? (
                <form action={assignDuty} className="row" style={{ justifyContent: 'space-between' }}>
                  <input type="hidden" name="eventId" value={e} /><input type="hidden" name="cohostId" value={c.id} />
                  <b>{c.name}</b>
                  <span className="row"><select name="duty" defaultValue={c.duty ?? ''} aria-label={`Desk for ${c.name}`}><option value="">No desk</option>{DUTIES.map(d => <option key={d}>{d}</option>)}</select><button>Assign</button></span>
                </form>
              ) : <span><b>{c.name}</b> · {c.duty ?? 'no desk'}</span>}
            </li>
          ))}
        </ul>
        {openDesks.length > 0 && <p className="small">Open desks: {openDesks.join(', ')}. The lead host covers these. Desks don’t grant photographer or caterer controls.</p>}
      </section>

      {flags.module_goodies && canRedeem && (
        <section className="card" id="goodies">
          <div className="eyebrow">Goodies desk</div>
          <form action={redeem} className="row"><input type="hidden" name="eventId" value={e} />
            <input name="code" placeholder="Pass code" required maxLength={8} style={{ width: 140, textTransform: 'uppercase' }} /><button className="primary">Redeem</button></form>
          {sp.redeem && <p className={sp.redeem === 'ok' ? 'ok' : 'warn'}>{REDEEM_MSG[sp.redeem] ?? sp.redeem}</p>}
          {acts && <p className="small">Activities reported: {Object.entries(acts).map(([a, n]) => `${a} ${n}`).join(' · ')}</p>}
        </section>
      )}

      {flags.module_voice_calls && event.status !== 'completed' && (
        <section className="card" id="calls">
          <div className="eyebrow">RSVP follow-up calls · Sarvam voice agent</div>
          <p className="small">An AI agent calls the guest in Tamil (switches to English/Hindi), asks if they’re coming, if they’ll be late and takes a note. The answer goes straight into the totals — you see call status, not the answer.</p>
          {sp.call && <p className={sp.call === 'ok' ? 'ok' : 'warn'}>{CALL_MSG[sp.call] ?? `Call failed: ${sp.call}`}</p>}
          <ul className="plain">
            {calls.map(g => (
              <li key={g.id}>
                <form action={callGuest} className="row" style={{ justifyContent: 'space-between' }}>
                  <input type="hidden" name="eventId" value={e} /><input type="hidden" name="guestId" value={g.id} />
                  <span><b>{g.name}</b><br /><span className="small">{g.lastCall ? `Last call: ${g.lastCall.status} · ${fmtSec(g.lastCall.updatedAt)}` : g.hasPhone ? 'Not called yet' : 'No phone on file'}</span></span>
                  <button disabled={!g.hasPhone || (g.lastCall && !['completed', 'busy', 'no-answer', 'failed', 'call-disconnected', 'canceled', 'stopped', 'error'].includes(g.lastCall.status))}>📞 Call</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="eyebrow">Vendors at this event</div>
        <ul className="plain">{vendors.map(v => (
          <li key={v.id}>
            <Link href={`/vendors/${v.id}`}><b>{v.name}</b></Link> <span className="small">· {v.service}</span>
            {event.status === 'completed' && (
              <form action={review} className="row" style={{ marginTop: 6 }}>
                <input type="hidden" name="eventId" value={e} /><input type="hidden" name="vendorId" value={v.id} />
                <select name="rating" defaultValue={mine[v.id] ?? 5} aria-label="Host rating">{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</select>
                <input name="text" placeholder="Host review (optional)" style={{ flex: 1 }} /><button>{mine[v.id] ? 'Update' : 'Review'}</button>
              </form>
            )}
          </li>
        ))}</ul>
        <p className="small"><Link href="/vendors">Browse more vendors →</Link></p>
      </section>

      <section>
        <div className="eyebrow">Invitation QR</div>
        <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="small" style={{ wordBreak: 'break-all' }}>{url}</p>
      </section>
    </>
  );
}
