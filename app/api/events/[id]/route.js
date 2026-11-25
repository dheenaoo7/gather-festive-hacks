import { getStore, currentUser } from '@/lib/db.mjs';

export const dynamic = 'force-dynamic';

// Same role filter as the page: the API never returns individual responses to hosts or vendors.
export async function GET(_req, { params }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return Response.json({ error: 'sign in' }, { status: 401 });
  const view = getStore().view(user.id, id);
  return view ? Response.json(view) : Response.json({ error: 'not found' }, { status: 404 });
}
