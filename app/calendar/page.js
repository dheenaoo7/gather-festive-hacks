import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStore, currentUser } from '@/lib/db.mjs';
import { fmtTime, roleLabel } from '@/lib/format.mjs';

export const dynamic = 'force-dynamic';
const TZ = 'Asia/Kolkata';
const ymd = d => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD in IST
const bucket = r => (r.kind === 'guest' ? 'attending' : r.kind === 'vendor' ? 'vending' : r.lead ? 'hosting' : 'cohosting');
const FILTERS = [['all', 'All'], ['attending', 'Attending'], ['hosting', 'Hosting'], ['cohosting', 'Co-hosting'], ['vending', 'Vending']];

export default async function Calendar({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect('/?next=/calendar');
  const sp = await searchParams;
  const filter = FILTERS.some(([k]) => k === sp.f) ? sp.f : 'all';
  const today = ymd(Date.now());
  const [y, m] = (/^\d{4}-\d{2}$/.test(sp.m ?? '') ? sp.m : today.slice(0, 7)).split('-').map(Number);
  const items = getStore().calendarFor(user.id).map(x => ({ ...x, b: bucket(x.role), day: ymd(x.event.startsAt) }))
    .filter(x => filter === 'all' || x.b === filter);

  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const cells = Array.from({ length: 42 }, (_, i) => new Date(Date.UTC(y, m - 1, 1 - lead + i)));
  const trimmed = cells.slice(0, cells[35].getUTCMonth() === m - 1 ? 42 : 35);
  const shift = k => { const d = new Date(Date.UTC(y, m - 1 + k, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
  const q = (mm, f) => `/calendar?m=${mm}${f !== 'all' ? `&f=${f}` : ''}`;
  const upcoming = items.filter(x => x.event.status !== 'completed');
  const past = items.filter(x => x.event.status === 'completed');
  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, 0]));
  for (const x of getStore().calendarFor(user.id)) { counts.all++; counts[bucket(x.role)]++; }

  const Entry = ({ x }) => (
    <Link className="entry" href={`/events/${x.event.id}`}>
      <div className="d"><span className="small">{new Date(x.event.startsAt).toLocaleDateString('en-IN', { month: 'short', timeZone: TZ })}</span><b>{Number(x.day.slice(8))}</b></div>
      <div>
        <div className="row" style={{ gap: 6 }}><span className={`pill ${x.b}`}>{roleLabel(x.role)}</span>{x.event.status === 'live' && <span className="pill live">Live</span>}{x.event.status === 'completed' && <span className="pill completed">After event</span>}</div>
        <h3>{x.event.title}</h3>
        <p className="small" style={{ margin: 0 }}>{fmtTime(x.event.startsAt)} · {x.event.venue}</p>
      </div>
    </Link>
  );

  return (
    <>
      <div className="eyebrow">Hi {user.name}</div>
      <h1>Your calendar</h1>
      <nav className="filters" aria-label="Filter by role">
        {FILTERS.filter(([k]) => k === 'all' || counts[k]).map(([k, label]) => <Link key={k} href={q(`${y}-${String(m).padStart(2, '0')}`, k)} aria-current={filter === k ? 'page' : undefined}>{label} · {counts[k]}</Link>)}
      </nav>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Link href={q(shift(-1), filter)} aria-label="Previous month">‹ Prev</Link>
        <h2 style={{ margin: 0 }}>{first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
        <Link href={q(shift(1), filter)} aria-label="Next month">Next ›</Link>
      </div>
      <div className="cal" role="grid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="dow">{d}</div>)}
        {trimmed.map(d => {
          const key = d.toISOString().slice(0, 10);
          const evs = items.filter(x => x.day === key);
          return (
            <div key={key} className={`day${d.getUTCMonth() !== m - 1 ? ' out' : ''}${key === today ? ' today' : ''}`}>
              <span>{d.getUTCDate()}</span>
              {evs.map(x => <Link key={x.event.id} href={`/events/${x.event.id}`} className={`dot-${x.b}`} title={`${x.event.title} — ${roleLabel(x.role)}`}>{x.event.title}</Link>)}
            </div>
          );
        })}
      </div>
      <div className="row small"><span className="pill attending">Attending</span><span className="pill hosting">Hosting</span><span className="pill cohosting">Co-hosting</span><span className="pill vending">Vending</span></div>
      <section>
        <h2>Coming up</h2>
        {upcoming.length ? upcoming.map(x => <Entry key={x.event.id} x={x} />) : <p>No upcoming events{filter !== 'all' ? ' for this filter' : ''}.</p>}
      </section>
      {past.length > 0 && <section><h2>After event</h2>{past.map(x => <Entry key={x.event.id} x={x} />)}</section>}
    </>
  );
}
