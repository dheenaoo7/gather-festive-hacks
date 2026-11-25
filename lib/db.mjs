import 'server-only';
import { mkdirSync } from 'node:fs';
import { cookies } from 'next/headers';
import { createStore } from './store.mjs';

// Open lazily on first request, not at import, so `next build` workers never touch the database.
export function getStore() {
  if (!globalThis.__gatherStore) {
    mkdirSync('.data/photos', { recursive: true });
    const store = createStore(process.env.GATHER_DB ?? '.data/gather-v2.sqlite');
    // Demo guest Asha's phone comes from the environment so it is never committed.
    if (process.env.DEMO_GUEST_PHONE) store.setPhone('guest', process.env.DEMO_GUEST_PHONE);
    globalThis.__gatherStore = store;
  }
  return globalThis.__gatherStore;
}

export async function currentUser() {
  return getStore().fromSession((await cookies()).get('gather_session')?.value);
}
