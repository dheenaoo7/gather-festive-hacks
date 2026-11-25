import Link from 'next/link';
import RsvpInvite from '@/components/RsvpInvite';
import CheckIn from '@/components/CheckIn';
import Timeline from './Timeline';
import { photoQueue, food, goodies, review } from '@/app/actions';
import { ACTIVITIES } from '@/lib/store.mjs';
import { fmtSec } from '@/lib/format.mjs';

const STATUS = { open: 'Waiting', shooting: 'Shooting now', paused: 'Paused', finished: 'Done' };

export default function GuestView({ user, event, store, flags, sp }) {
  const e = event.id;
  const tab = sp.tab === 'after' || (event.status === 'completed' && sp.tab !== 'live') ? 'after' : 'live';
  const response = store.view(user.id, e).response;
  const arrived = store.checkedIn(user.id, e);
  const photo = store.guestPhoto(user.id, e);
  const meal = store.guestFood(user.id, e);
  const pass = store.guestGoodies(user.id, e);
  return (
    <>
      <nav className="tabs">
        <Link href={`/events/${e}?tab=live`} aria-current={tab === 'live' ? 'page' : undefined}>Event</Link>
        <Link href={`/events/${e}?tab=after`} aria-current={tab === 'after' ? 'page' : undefined}>After event</Link>
      </nav>
      {tab === 'live' ? (
        <>
          {meal?.calledAt && <div className="alert" role="status"><div className="eyebrow">Food · batch {meal.no}</div><h2>Your food batch is called</h2><p>Head to the dining area now. Called at {fmtSec(meal.calledAt)}.</p></div>}
          {event.status !== 'completed' && <RsvpInvite userId={user.id} eventId={e} response={response} />}
          {event.status === 'upcoming' && <p className="small">Check-in, photo and food queues open when the host starts the event.</p>}
          {event.status === 'live' && !arrived && (
            <section className="card"><div className="eyebrow">Arrival</div><h2>Check in</h2><CheckIn eventId={e} /></section>
          )}
          {event.status === 'live' && arrived && (
            <>
              <p className="ok">✓ You’re checked in.</p>
              {flags.module_photo_queue && (
                <section className="card">
                  <div className="eyebrow">Photo booth</div>
                  {photo ? (
                    <>
                      <h2>Batch {photo.no} · {STATUS[photo.status]}</h2>
                      <p>{photo.status === 'open' ? (photo.ahead ? `${photo.ahead} batch${photo.ahead > 1 ? 'es' : ''} ahead of you.` : 'You’re next.') : photo.status === 'finished' ? 'Your photos will appear in After event.' : 'Your batch is with the photographer.'}</p>
                      <Timeline log={photo.log} />
                      {photo.status === 'open' && <form action={photoQueue}><input type="hidden" name="eventId" value={e} /><button name="leave" value="1">Leave queue</button></form>}
                    </>
                  ) : (
                    <><h2>Join the photo queue</h2><p>You’ll get a batch number; we’ll show when your batch is shooting.</p>
                      <form action={photoQueue}><input type="hidden" name="eventId" value={e} /><button className="primary">Join photo queue</button></form></>
                  )}
                </section>
              )}
              {flags.module_food_queue && (
                <section className="card">
                  <div className="eyebrow">Food</div>
                  {meal ? (
                    <>
                      <h2>Food batch {meal.no}</h2>
                      <p>{meal.calledAt ? 'Called — head to dining.' : meal.nowServing ? `Now serving batch ${meal.nowServing}. We’ll alert you here.` : 'We’ll alert you here when your batch is called.'}</p>
                      {!meal.calledAt && <form action={food}><input type="hidden" name="eventId" value={e} /><button name="out" value="1">Opt out</button></form>}
                    </>
                  ) : (
                    <><h2>Want to eat in a batch?</h2><p>Opt in and we’ll call your batch so nobody crowds the counter.</p>
                      <form action={food}><input type="hidden" name="eventId" value={e} /><button className="primary">Opt in for food</button></form></>
                  )}
                </section>
              )}
              {flags.module_goodies && (
                <section className="card" id="goodies">
                  <div className="eyebrow">Goodies</div>
                  {pass ? (
                    <><h2>Your pickup pass</h2><p className="mono" style={{ fontSize: 32, color: 'var(--wine)' }}>{pass.code}</p>
                      <p>{pass.redeemedAt ? `Collected at ${fmtSec(pass.redeemedAt)}.` : 'Show this code at the goodies desk. It works once.'}</p></>
                  ) : (
                    <form action={goodies}>
                      <input type="hidden" name="eventId" value={e} />
                      <h2>Which activities did you join?</h2>
                      <p className="small">Any answer — even none — unlocks your goodies pass.</p>
                      {ACTIVITIES.map(a => <label key={a} style={{ fontWeight: 400 }}><input type="checkbox" name="activity" value={a} style={{ minHeight: 0, marginRight: 8 }} />{a}</label>)}
                      <button className="primary" style={{ marginTop: 10 }}>Get my goodies pass</button>
                    </form>
                  )}
                </section>
              )}
            </>
          )}
        </>
      ) : (
        <AfterEvent user={user} event={event} store={store} arrived={arrived} />
      )}
    </>
  );
}

function AfterEvent({ user, event, store, arrived }) {
  const e = event.id;
  const gallery = store.galleryFor(user.id, e);
  const photo = store.guestPhoto(user.id, e);
  const mine = store.myReviews(user.id, e);
  const vendors = store.vendorsAt(e);
  return (
    <>
      <section>
        <div className="eyebrow">Your photos</div>
        {gallery ? (
          gallery.photos.length ? (
            <><h2>Batch {gallery.no}</h2><div className="grid-photos">{gallery.photos.map(p => <a key={p.id} href={`/api/photos/${p.id}`} target="_blank"><img src={`/api/photos/${p.id}`} alt={`Batch ${gallery.no} photo`} loading="lazy" /></a>)}</div>
              <p className="small">Only guests in batch {gallery.no} can see these.</p></>
          ) : <p>Batch {gallery.no} is done; the photographer hasn’t uploaded yet. Check back soon.</p>
        ) : <p>{photo ? `Batch ${photo.no} hasn’t finished shooting yet.` : 'You weren’t in a photo batch at this event.'}</p>}
      </section>
      <section id="feedback">
        <div className="eyebrow">Optional feedback</div>
        {arrived ? vendors.map(v => (
          <form key={v.id} action={review} className="card">
            <input type="hidden" name="eventId" value={e} /><input type="hidden" name="vendorId" value={v.id} />
            <h3>{v.name} <span className="small">· {v.service}</span></h3>
            {mine[v.id] && <p className="ok small">You rated {mine[v.id]}★ — you can update it.</p>}
            <div className="row"><select name="rating" defaultValue={mine[v.id] ?? 5} aria-label="Rating">{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</select>
              <input name="text" placeholder="A line for future hosts (optional)" style={{ flex: 1 }} /><button>Save</button></div>
          </form>
        )) : <p className="small">Feedback opens for guests who checked in.</p>}
        <p className="small">Feedback is optional and never affects your photo access.</p>
      </section>
    </>
  );
}
