import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStore, eventId } from '../lib/store.mjs';
import { parseUpdate, handleCallResult } from '../lib/voice.mjs';

function fixture(t) {
  const store = createStore(':memory:');
  t.after(() => store.close());
  return store;
}
const yes = async () => '{"attending":"yes","late":true,"note":"Bringing my mother"}';

test('parseUpdate keeps only known fields and tolerates text around the JSON', () => {
  assert.deepEqual(parseUpdate('Sure: {"attending":"no","late":null,"note":"","extra":1}'), { attending: 'no', late: null, note: null });
  assert.deepEqual(parseUpdate('{"attending":"maybe","late":"soon","note":42}'), { attending: null, late: null, note: null });
  assert.deepEqual(parseUpdate('no json here'), { attending: null, late: null, note: null });
});

test('a completed call we placed updates the RSVP once and records the update', async t => {
  const store = fixture(t);
  store.recordCall('exec-1', 'guest', eventId);
  const body = { id: 'exec-1', status: 'completed', transcript: 'user: haan, varuven' };
  assert.equal((await handleCallResult(store, body, yes)).applied, true);
  assert.equal((await handleCallResult(store, body, yes)).applied, false, 'a repeated webhook must not re-apply');
  assert.deepEqual(store.view('host', eventId).totals, { yes: 1, no: 0 });
  const call = store.call('exec-1');
  assert.equal(call.status, 'completed');
  assert.deepEqual(JSON.parse(call.update_json), { attending: 'yes', late: true, note: 'Bringing my mother' });
});

test('unknown executions and non-final statuses change nothing', async t => {
  const store = fixture(t);
  assert.equal((await handleCallResult(store, { id: 'forged', status: 'completed', transcript: 'x' }, yes)).applied, false);
  store.recordCall('exec-2', 'guest', eventId);
  assert.equal((await handleCallResult(store, { id: 'exec-2', status: 'call-disconnected', transcript: 'x' }, yes)).applied, false);
  assert.deepEqual(store.view('host', eventId).totals, { yes: 0, no: 0 });
  assert.equal(store.call('exec-2').status, 'call-disconnected');
});

test('an unclear answer records the call without touching the RSVP', async t => {
  const store = fixture(t);
  store.saveRsvp('guest', eventId, 'no');
  store.recordCall('exec-3', 'guest', eventId);
  await handleCallResult(store, { id: 'exec-3', status: 'completed', transcript: 'user: ...' }, async () => '{"attending":null}');
  assert.deepEqual(store.view('host', eventId).totals, { yes: 0, no: 1 });
});

test('host call list shows guest and call status, never the answer', t => {
  const store = fixture(t);
  store.recordCall('exec-4', 'guest', eventId);
  const rows = store.callsFor('host', eventId);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['guest', 'status', 'updatedAt']);
  assert.equal(store.callsFor('caterer', eventId), null);
});
