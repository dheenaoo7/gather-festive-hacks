import { getStore } from '@/lib/db.mjs';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ ok: true, users: getStore().users().length, time: new Date().toISOString() });
}
