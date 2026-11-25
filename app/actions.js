'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getStore, currentUser } from '@/lib/db.mjs';
import { placeCall } from '@/lib/bolna.mjs';
import { flagsFor } from '@/lib/flags.mjs';

const safeNext = n => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/calendar');
const back = (e, extra = '') => { revalidatePath(`/events/${e}`); return `/events/${e}${extra}`; };
async function need() {
  const u = await currentUser();
  if (!u) redirect('/');
  return u;
}
const s = f => String(f ?? '');

export async function signIn(formData) {
  const token = getStore().newSession(s(formData.get('userId')));
  if (!token) redirect('/?error=unknown');
  (await cookies()).set('gather_session', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12 });
  redirect(safeNext(s(formData.get('next'))));
}

export async function signOut() {
  const jar = await cookies();
  getStore().endSession(jar.get('gather_session')?.value);
  jar.delete('gather_session');
  redirect('/');
}

export async function rsvp(formData) {
  const u = await need();
  const e = s(formData.get('eventId'));
  getStore().saveRsvp(u.id, e, s(formData.get('response')));
  revalidatePath(`/events/${e}`);
}

// ---- host ----
export async function setStatus(formData) {
  const u = await need(); const e = s(formData.get('eventId'));
  getStore().setStatus(u.id, e, s(formData.get('status')));
  redirect(back(e));
}
export async function setPin(e, lat, lng) {
  const u = await need();
  const ok = getStore().setVenuePin(u.id, e, Number(lat), Number(lng));
  revalidatePath(`/events/${e}`);
  return ok;
}
export async function assignDuty(formData) {
  const u = await need(); const e = s(formData.get('eventId'));
  const duty = s(formData.get('duty'));
  getStore().assignDuty(u.id, e, s(formData.get('cohostId')), duty || null);
  redirect(back(e));
}
export async function redeem(formData) {
  const u = await need(); const e = s(formData.get('eventId'));
  const r = getStore().redeemGoodies(u.id, e, s(formData.get('code')));
  redirect(back(e, `?redeem=${r.ok ? 'ok' : r.reason}#goodies`));
}
export async function callGuest(formData) {
  const u = await need(); const e = s(formData.get('eventId')); const g = s(formData.get('guestId'));
  const store = getStore();
  let msg = 'ok';
  if (store.roleAt(u.id, e)?.kind !== 'host') msg = 'not_allowed';
  else if (!(await flagsFor(u.id)).module_voice_calls) msg = 'disabled';
  else if (store.roleAt(g, e)?.kind !== 'guest') msg = 'not_invited';
  else {
    const guest = store.user(g);
    if (!guest.phone) msg = 'no_phone';
    else {
      const r = await placeCall({ phone: guest.phone, guestName: guest.name, event: store.event(e) });
      if (r.ok && r.executionId) store.recordCall(r.executionId, g, e); else msg = r.error || 'failed';
    }
  }
  redirect(back(e, `?call=${encodeURIComponent(msg)}#calls`));
}

// ---- guest ----
export async function checkIn(e, payload) {
  const u = await need();
  const r = getStore().checkIn(u.id, e, payload ?? {});
  revalidatePath(`/events/${e}`);
  return r;
}
export async function photoQueue(formData) {
  const u = await need(); const e = s(formData.get('eventId'));
  if (formData.get('leave')) getStore().leavePhotoQueue(u.id, e); else getStore().joinPhotoQueue(u.id, e);
  redirect(back(e));
}
export async function food(formData) {
  const u = await need(); const e = s(formData.get('eventId'));
  if (formData.get('out')) getStore().foodOptOut(u.id, e); else getStore().foodOptIn(u.id, e);
  redirect(back(e));
}
export async function goodies(formData) {
  const u = await need(); const e = s(formData.get('eventId'));
  getStore().submitGoodies(u.id, e, formData.getAll('activity').map(String));
  redirect(back(e, '#goodies'));
}
export async function review(formData) {
  const u = await need(); const e = s(formData.get('eventId'));
  getStore().review(u.id, e, s(formData.get('vendorId')), Number(formData.get('rating')), s(formData.get('text')));
  redirect(back(e, `?tab=after#feedback`));
}

// ---- vendors ----
export async function photoAction(formData) {
  const u = await need(); const e = s(formData.get('eventId'));
  getStore().photoAction(u.id, e, Number(formData.get('no')), s(formData.get('action')));
  redirect(back(e));
}
export async function callFood(formData) {
  const u = await need(); const e = s(formData.get('eventId'));
  getStore().callNextFood(u.id, e);
  redirect(back(e));
}
export async function saveProfile(formData) {
  const u = await need();
  getStore().saveProfile(u.id, Object.fromEntries(['bio', 'city', 'instagram', 'postUrl', 'phone', 'email'].map(k => [k, s(formData.get(k))])));
  revalidatePath(`/vendors/${u.id}`);
  redirect(`/vendors/${u.id}?saved=1`);
}
