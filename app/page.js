import { signIn } from './actions';
import { getStore } from '@/lib/db.mjs';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }) {
  const { next = '/events' } = await searchParams;
  return (
    <>
      <div className="eyebrow">Demo sign-in</div>
      <h1>Pick a seeded account</h1>
      <p className="small">Placeholder until real sign-in. Each account sees only what its role allows.</p>
      <form action={signIn}>
        <input type="hidden" name="next" value={String(next).startsWith('/') && !String(next).startsWith('//') ? next : '/events'} />
        <ul className="plain">
          {getStore().users().map(u => (
            <li key={u.id}>
              <button name="userId" value={u.id}>{u.name}<br /><span className="small">{u.role}{u.service ? ` · ${u.service}` : ''}</span></button>
            </li>
          ))}
        </ul>
      </form>
    </>
  );
}
