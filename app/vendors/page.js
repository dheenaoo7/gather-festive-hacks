import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStore, currentUser } from '@/lib/db.mjs';
import { SERVICES } from '@/lib/store.mjs';

export const dynamic = 'force-dynamic';

export default async function Vendors({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect('/?next=/vendors');
  const { s } = await searchParams;
  const service = SERVICES.includes(s) ? s : null;
  const list = getStore().vendors(service);
  return (
    <>
      <div className="eyebrow">Discover</div>
      <h1>Vendors</h1>
      <p>Browse work and contact vendors directly. Gather doesn’t take bookings or payments.</p>
      <nav className="filters">
        <Link href="/vendors" aria-current={!service ? 'page' : undefined}>All</Link>
        {SERVICES.map(x => <Link key={x} href={`/vendors?s=${x}`} aria-current={service === x ? 'page' : undefined}>{x}</Link>)}
      </nav>
      <ul className="plain">{list.map(v => (
        <li key={v.id}><Link href={`/vendors/${v.id}`}><b>{v.name}</b></Link><br /><span className="small">{v.service}{v.city ? ` · ${v.city}` : ''}</span></li>
      ))}</ul>
    </>
  );
}
