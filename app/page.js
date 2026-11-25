import { redirect } from 'next/navigation';
import { signIn } from './actions';
import { getStore, currentUser } from '@/lib/db.mjs';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }) {
  const { next = '/calendar' } = await searchParams;
  const user = await currentUser();
  if (user) redirect(String(next).startsWith('/') && !String(next).startsWith('//') ? next : '/calendar');
  const users = getStore().users();
  const group = (title, list) => (
    <section>
      <div className="eyebrow">{title}</div>
      <ul className="plain">{list.map(u => (
        <li key={u.id}><button name="userId" value={u.id} className="link" style={{ fontSize: 17, minHeight: 40 }}>{u.name}</button>
          <span className="small"> {u.service ?? ''}</span></li>
      ))}</ul>
    </section>
  );
  return (
    <>
      <div className="cover">
        <div className="eyebrow">Festive Hacks · demo</div>
        <h1>Every role at the party, one calm app.</h1>
        <p>Guests RSVP, check in and join photo and food queues. Hosts see totals and run desks. Vendors run their batches.</p>
      </div>
      <p className="small">Demo sign-in: pick a seeded account. Roles are per event — Meera hosts one party and is a guest at another.</p>
      <form action={signIn}>
        <input type="hidden" name="next" value={String(next)} />
        {group('People (guests & hosts)', users.filter(u => u.role !== 'vendor'))}
        {group('Vendors', users.filter(u => u.role === 'vendor'))}
      </form>
    </>
  );
}
