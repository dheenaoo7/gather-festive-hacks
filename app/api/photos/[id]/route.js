import { readFile } from 'node:fs/promises';
import { getStore, currentUser } from '@/lib/db.mjs';

export const dynamic = 'force-dynamic';

// Serves a photo only to that batch's guests (after the batch finishes) or the assigned photographer.
export async function GET(_req, { params }) {
  const { id } = await params;
  const user = await currentUser();
  const p = user && getStore().photoFor(user.id, id);
  if (!p) return new Response('Not found', { status: 404 });
  const body = await readFile(`.data/photos/${p.file}`).catch(() => null);
  if (!body) return new Response('Not found', { status: 404 });
  return new Response(body, { headers: { 'Content-Type': p.mime, 'Cache-Control': 'private, max-age=3600' } });
}
