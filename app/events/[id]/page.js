import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getStore, currentUser } from '@/lib/db.mjs';
import { flagsFor } from '@/lib/flags.mjs';
import { fmtWhen, roleLabel } from '@/lib/format.mjs';
import AutoRefresh from '@/components/AutoRefresh';
import GuestView from './GuestView';
import HostDesk from './HostDesk';
import PhotoDesk from './PhotoDesk';
import FoodDesk from './FoodDesk';
import BriefDesk from './BriefDesk';

export const dynamic = 'force-dynamic';

// One URL per event; the screen depends on the hat this user wears at this event.
export default async function EventPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/?next=/events/${encodeURIComponent(id)}`);
  const store = getStore();
  const role = store.roleAt(user.id, id);
  if (!role) notFound();
  const event = store.event(id);
  const flags = await flagsFor(user.id);
  const props = { user, role, event, store, flags, sp };
  return (
    <>
      <AutoRefresh ms={4000} />
      <p className="small"><Link href="/calendar">← Calendar</Link></p>
      <div className="row" style={{ gap: 6 }}>
        <span className="eyebrow">{roleLabel(role)}</span>
        {event.status === 'live' && <span className="pill live">Live now</span>}
        {event.status === 'completed' && <span className="pill completed">After event</span>}
      </div>
      <h1>{event.title}</h1>
      <p>{fmtWhen(event.startsAt)} · {event.venue}</p>
      {role.kind === 'guest' && <GuestView {...props} />}
      {role.kind === 'host' && <HostDesk {...props} />}
      {role.kind === 'vendor' && role.service === 'Photography' && <PhotoDesk {...props} />}
      {role.kind === 'vendor' && role.service === 'Catering' && <FoodDesk {...props} />}
      {role.kind === 'vendor' && !['Photography', 'Catering'].includes(role.service) && <BriefDesk {...props} />}
    </>
  );
}
