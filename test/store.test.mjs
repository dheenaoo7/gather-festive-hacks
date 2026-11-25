import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore, eventId } from '../lib/store.mjs';

function fixture(t, filename = ':memory:') {
  const store = createStore(filename);
  t.after(() => store.close());
  return store;
}

test('changing or repeating a guest response never double-counts it', t => {
  const store = fixture(t);
  assert.deepEqual(store.view('host', eventId).totals, { yes: 0, no: 0 });
  assert.equal(store.saveRsvp('guest', eventId, 'yes'), true);
  assert.equal(store.saveRsvp('guest', eventId, 'yes'), true);
  assert.equal(store.view('guest', eventId).response, 'yes');
  assert.deepEqual(store.view('host', eventId).totals, { yes: 1, no: 0 });
  assert.equal(store.saveRsvp('guest', eventId, 'no'), true);
  assert.deepEqual(store.view('host', eventId).totals, { yes: 0, no: 1 });
});

test('only the owner and assigned vendors get aggregate RSVP counts', t => {
  const store = fixture(t);
  store.saveRsvp('guest', eventId, 'yes');
  for (const id of ['host','photographer','caterer']) {
    const view = store.view(id, eventId);
    assert.deepEqual(Object.keys(view).sort(), ['event', 'totals']);
    assert.deepEqual(view.totals, { yes: 1, no: 0 });
  }
  for (const id of ['unassigned','uninvited','unknown',undefined]) assert.equal(store.view(id, eventId), null);
  assert.deepEqual(store.eventsFor('unassigned'), []);
  assert.equal(store.view('guest', 'other-event'), null);
  assert.deepEqual(Object.keys(store.view('guest', eventId)).sort(), ['event','response']);
});

test('only invited guests can save a valid response', t => {
  const store = fixture(t);
  for (const id of ['host','caterer','uninvited','unassigned',undefined]) assert.equal(store.saveRsvp(id, eventId, 'yes'), false);
  assert.equal(store.saveRsvp('guest', eventId, 'maybe'), false);
  assert.equal(store.saveRsvp('guest', 'other-event', 'yes'), false);
  assert.equal(store.view('guest', eventId).response, null);
});

test('SQLite retains the response after reopening the database', t => {
  const dir = mkdtempSync(join(tmpdir(), 'gather-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = join(dir, 'test.sqlite');
  const first = createStore(filename);
  first.saveRsvp('guest', eventId, 'yes');
  first.close();
  const reopened = fixture(t, filename);
  assert.equal(reopened.view('guest', eventId).response, 'yes');
  assert.equal(reopened.users().length, 6, 'reopening must not re-seed');
});

test('sessions use opaque tokens and can be revoked', t => {
  const store = fixture(t);
  assert.equal(store.fromSession('host'), null);
  assert.equal(store.fromSession(undefined), null);
  const token = store.newSession('host');
  assert.equal(store.fromSession(token).id, 'host');
  assert.notEqual(store.newSession('host'), token);
  assert.equal(store.newSession('unknown'), null);
  store.endSession(token);
  assert.equal(store.fromSession(token), null);
});
