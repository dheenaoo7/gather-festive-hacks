import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStore, currentUser } from '@/lib/db.mjs';
import { signOut } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Events() {
  const user = await currentUser();
  if (!user) redirect('/');
  const events = getStore().eventsFor(user.id);
  return (
    <>
      <div className="eyebrow">Signed in as {user.name}</div>
      <h1>Upcoming events</h1>
      {events.length ? (
        <ul className="plain">{events.map(e => <li key={e.id}><p><Link href={`/events/${e.id}`}>{e.title}</Link><br /><span className="small">{e.venue}</span></p></li>)}</ul>
      ) : <p>No events for this account. Vendors see events only after a host assigns them.</p>}
      <form action={signOut}><button>Switch account</button></form>
    </>
  );
}
