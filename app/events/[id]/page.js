import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { getStore, currentUser } from '@/lib/db.mjs';
import { rsvp } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EventPage({ params }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/?next=/events/${encodeURIComponent(id)}`);
  const view = getStore().view(user.id, id);
  if (!view) notFound();
  const { event } = view;
  const when = new Date(event.startsAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

  let qr = null;
  if (user.role === 'host') {
    const h = await headers();
    const url = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}/events/${event.id}`;
    qr = { url, svg: await QRCode.toString(url, { type: 'svg', margin: 1, width: 180 }) };
  }

  return (
    <>
      <div className="eyebrow">{when}</div>
      <h1>{event.title}</h1>
      <p>{event.venue}</p>

      {'response' in view ? (
        <section className="status" aria-label="RSVP">
          <div className="eyebrow">Invitation</div>
          <h2>{view.response ? `You said ${view.response === 'yes' ? 'you’re going' : 'you can’t make it'}` : 'Can you make it?'}</h2>
          <p className="small">Your response is shown only in the totals.</p>
          <form action={rsvp} className="row">
            <input type="hidden" name="eventId" value={event.id} />
            <button name="response" value="yes" className={view.response === 'yes' ? 'primary' : ''}>I’m going</button>
            <button name="response" value="no" className={view.response === 'no' ? 'primary' : ''}>Can’t make it</button>
          </form>
        </section>
      ) : (
        <section className="status" aria-label="RSVP totals">
          <div className="eyebrow">RSVP totals · {user.role === 'host' ? 'Host' : user.service}</div>
          <dl><div><dt>Going</dt><dd data-testid="yes">{view.totals.yes}</dd></div><div><dt>Not going</dt><dd data-testid="no">{view.totals.no}</dd></div></dl>
        </section>
      )}

      {qr && (
        <section>
          <div className="eyebrow">Invitation QR</div>
          <div className="qr" dangerouslySetInnerHTML={{ __html: qr.svg }} />
          <p className="small">{qr.url}</p>
        </section>
      )}
      <p><Link href="/events">← All events</Link></p>
    </>
  );
}
