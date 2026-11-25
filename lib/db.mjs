import 'server-only';
import { mkdirSync } from 'node:fs';
import { cookies } from 'next/headers';
import { createStore } from './store.mjs';

// Open lazily on first request, not at import, so `next build` workers never touch the database.
export function getStore() {
  if (!globalThis.__gatherStore) {
    mkdirSync('.data', { recursive: true });
    globalThis.__gatherStore = createStore(process.env.GATHER_DB ?? '.data/gather.sqlite');
  }
  return globalThis.__gatherStore;
}

export async function currentUser() {
  return getStore().fromSession((await cookies()).get('gather_session')?.value);
}
