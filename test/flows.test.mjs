import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStore, eventId as E, batchDurations } from '../lib/store.mjs';

function live(t) {
  const s = createStore(':memory:');
  t.after(() => s.close());
  s.setStatus('host', E, 'live');
  return s;
}
const here = { lat: 12.9716, lng: 77.5946 };

test('per-event roles drive the calendar', t => {
  const s = live(t);
  const kinds = id => Object.fromEntries(s.calendarFor(id).map(x => [x.event.id, x.role.kind + (x.role.lead === false ? ':co' : '')]));
  assert.deepEqual(kinds('host'), { 'harvest-lunch': 'host', [E]: 'host', 'diya-lane-potluck': 'host:co', 'deepam-night': 'guest' });
  assert.deepEqual(kinds('guest'), { 'harvest-lunch': 'guest', [E]: 'guest', 'diya-lane-potluck': 'host', 'deepam-night': 'guest' });
  assert.equal(kinds('photographer')[E], 'vendor');
  assert.deepEqual(kinds('unassigned'), {});
});

test('check-in needs the event live and a nearby location or the venue code; coordinates are not stored', t => {
  const s = createStore(':memory:'); t.after(() => s.close());
  assert.equal(s.checkIn('guest', E, here).reason, 'not_live');
  s.setStatus('host', E, 'live');
  assert.equal(s.checkIn('guest', E, { lat: 13.1, lng: 77.6 }).reason, 'too_far');
  assert.equal(s.checkIn('guest', E, here).ok, true);
  assert.equal(s.checkIn('guest', E, here).already, true, 'second check-in is a no-op');
  assert.equal(s.checkIn('kabir', E, { code: 'nope' }).reason, 'bad_code');
  assert.equal(s.checkIn('kabir', E, { code: s.checkinCode('host', E) }).ok, true);
  assert.equal(s.checkIn('uninvited', E, here).ok, false);
  assert.equal(s.hostSummary('host', E).arrived, 2);
  assert.equal(s.checkinCode('guest', E), null);
});

test('photo batches lock at start, resume the same batch, and keep photos private to that batch after it finishes', t => {
  const s = live(t);
  for (const g of ['guest', 'kabir']) s.checkIn(g, E, here);
  assert.equal(s.joinPhotoQueue('nila', E), null, 'must check in first');
  assert.equal(s.joinPhotoQueue('guest', E), 1);
  assert.equal(s.photoAction('photographer', E, 1, 'start'), true);
  assert.equal(s.leavePhotoQueue('guest', E), false, 'roster locked');
  assert.equal(s.joinPhotoQueue('kabir', E), 2, 'locked batch takes no new guests');
  assert.equal(s.photoAction('photographer', E, 2, 'start'), false, 'one active batch at a time');
  assert.equal(s.photoAction('caterer', E, 1, 'pause'), false);
  assert.equal(s.photoAction('photographer', E, 1, 'pause'), true);
  assert.equal(s.photoAction('photographer', E, 1, 'resume'), true);
  assert.equal(s.guestPhoto('guest', E).status, 'shooting');
  const pid = s.addPhoto('photographer', E, 1, 'x.jpg', 'image/jpeg');
  assert.ok(pid);
  assert.equal(s.galleryFor('guest', E), null, 'gallery waits for the batch to finish');
  assert.equal(s.photoAction('photographer', E, 1, 'finish'), true);
  assert.deepEqual(s.guestPhoto('guest', E).log.map(l => l.kind), ['started', 'paused', 'resumed', 'finished']);
  assert.equal(s.galleryFor('guest', E).photos.length, 1);
  assert.ok(s.photoFor('guest', pid));
  assert.equal(s.photoFor('kabir', pid), null, 'batch 2 never sees batch 1');
  assert.equal(s.photoFor('host', pid), null);
});

test('batch durations split shooting and paused time', () => {
  const log = [{ kind: 'started', at: '2026-01-01T00:00:00Z' }, { kind: 'paused', at: '2026-01-01T00:01:00Z' },
    { kind: 'resumed', at: '2026-01-01T00:01:30Z' }, { kind: 'finished', at: '2026-01-01T00:02:00Z' }];
  assert.deepEqual(batchDurations(log), { shooting: 90, paused: 30 });
});

test('food: opt-in batches, caterer calls the next batch, only aggregates are shown', t => {
  const s = live(t);
  for (const g of ['guest', 'kabir']) s.checkIn(g, E, here);
  assert.equal(s.foodOptIn('guest', E), 1);
  assert.equal(s.foodOptIn('kabir', E), 1);
  assert.deepEqual(s.foodBatches('caterer', E).map(b => [b.no, b.optedIn, !!b.calledAt]), [[1, 2, false]]);
  assert.equal(s.foodBatches('photographer', E), null);
  assert.equal(s.callNextFood('caterer', E), 1);
  assert.ok(s.guestFood('guest', E).calledAt);
  assert.equal(s.foodOptOut('guest', E), false, 'cannot opt out after the batch is called');
  assert.equal(s.callNextFood('caterer', E), null, 'no empty batch calls');
});

test('goodies pass unlocks on any answer and redeems once by an allowed host', t => {
  const s = live(t);
  s.checkIn('guest', E, here);
  const c = s.submitGoodies('guest', E, []);
  assert.match(c, /^[A-Z0-9]{6}$/);
  assert.equal(s.redeemGoodies('kiran', E, c).ok, false, 'Welcome co-host cannot redeem');
  s.assignDuty('host', E, 'kiran', 'Goodies');
  assert.equal(s.redeemGoodies('kiran', E, c.toLowerCase()).ok, true);
  assert.equal(s.redeemGoodies('host', E, c).reason, 'already');
  assert.ok(s.guestGoodies('guest', E).redeemedAt);
});

test('duties are assigned only by the lead host; each desk has one owner', t => {
  const s = live(t);
  assert.equal(s.assignDuty('kiran', E, 'kiran', 'Photo'), false);
  assert.equal(s.assignDuty('host', E, 'kiran', 'Photo'), true);
  assert.deepEqual(s.cohosts('host', E).map(r => ({ ...r })), [{ id: 'kiran', name: 'Kiran', duty: 'Photo' }]);
  assert.equal(s.cohosts('guest', E), null);
});

test('vendor profile stats and separate guest/host reviews', t => {
  const s = live(t);
  const p = s.vendorProfile('photographer');
  assert.equal(p.completedEvents, 1);
  assert.equal(p.guestCheckins, 3);
  assert.equal(p.guestReviews.length, 1);
  assert.equal(p.hostReviews.length, 1);
  assert.equal('phone' in s.vendorProfile('unassigned') && s.vendorProfile('unassigned').phone, '+91 98450 00005');
  assert.equal(s.review('guest', E, 'photographer', 5, 'x'), false, 'guest must have checked in');
  s.checkIn('guest', E, here);
  assert.equal(s.review('guest', E, 'photographer', 4, 'nice'), true);
  assert.equal(s.review('host', E, 'photographer', 5, 'great'), true);
  assert.equal(s.review('host', E, 'unassigned', 5, 'x'), false);
  const q = s.vendorProfile('photographer');
  assert.equal(q.guestReviews.length, 2);
  assert.equal(q.hostReviews.length, 2);
});

test('host call list has names and call status but no RSVP answers', t => {
  const s = live(t);
  s.saveRsvp('guest', E, 'yes');
  const list = s.callList('host', E);
  assert.deepEqual(list.map(g => g.name), ['Asha', 'Kabir', 'Nila']);
  assert.ok(list.every(g => !('response' in g)));
  assert.equal(s.callList('photographer', E), null);
});
