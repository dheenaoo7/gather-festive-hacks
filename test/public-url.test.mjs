import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicBaseUrl } from '../lib/public-url.mjs';

const h = o => new Map(Object.entries(o));

test('PUBLIC_URL wins so the invitation QR points at the tunnel or deploy, not the origin', () => {
  assert.equal(publicBaseUrl(h({ host: '127.0.0.1:3100' }), 'https://abc.trycloudflare.com/'), 'https://abc.trycloudflare.com');
});

test('falls back to forwarded host and proto, then the plain host header', () => {
  assert.equal(publicBaseUrl(h({ host: '127.0.0.1:3100', 'x-forwarded-host': 'gather.example', 'x-forwarded-proto': 'https' })), 'https://gather.example');
  assert.equal(publicBaseUrl(h({ host: '10.0.0.5:3100' })), 'http://10.0.0.5:3100');
});

test('ignores a PUBLIC_URL that is not http(s)', () => {
  assert.equal(publicBaseUrl(h({ host: 'localhost:3100' }), 'javascript:alert(1)'), 'http://localhost:3100');
});
