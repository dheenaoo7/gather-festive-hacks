'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getStore, currentUser } from '@/lib/db.mjs';

export async function signIn(formData) {
  const token = getStore().newSession(String(formData.get('userId')));
  if (!token) redirect('/?error=unknown');
  (await cookies()).set('gather_session', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12 });
  redirect(String(formData.get('next') || '/events'));
}

export async function signOut() {
  const jar = await cookies();
  getStore().endSession(jar.get('gather_session')?.value);
  jar.delete('gather_session');
  redirect('/');
}

export async function rsvp(formData) {
  const user = await currentUser();
  const eventId = String(formData.get('eventId'));
  getStore().saveRsvp(user?.id, eventId, String(formData.get('response')));
  revalidatePath(`/events/${eventId}`);
}
