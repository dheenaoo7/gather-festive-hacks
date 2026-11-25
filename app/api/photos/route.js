import { writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { getStore, currentUser } from '@/lib/db.mjs';

export const dynamic = 'force-dynamic';
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };

// Photographer uploads photos into a started/finished batch (multipart form: eventId, no, photos[]).
export async function POST(req) {
  const user = await currentUser();
  const form = await req.formData();
  const e = String(form.get('eventId') ?? ''), no = Number(form.get('no'));
  const store = getStore();
  let added = 0;
  if (user) {
    for (const f of form.getAll('photos')) {
      if (typeof f === 'string' || !TYPES[f.type] || f.size > 15 * 1024 * 1024) continue;
      const file = `${randomBytes(12).toString('hex')}.${TYPES[f.type]}`;
      // Check permission before writing the file.
      if (!store.photoBatches(user.id, e)) break;
      await writeFile(`.data/photos/${file}`, Buffer.from(await f.arrayBuffer()));
      if (store.addPhoto(user.id, e, no, file, f.type)) added++;
    }
  }
  // Relative Location so it works behind the tunnel (origin Host is 127.0.0.1).
  return new Response(null, { status: 303, headers: { Location: `/events/${encodeURIComponent(e)}?uploaded=${added}` } });
}
