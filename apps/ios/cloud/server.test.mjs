import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEON_AUTH_URL = 'https://auth.example.test/neondb/auth';
process.env.QIRAAT_ORIGIN = 'https://sync.example.test';
process.env.DATABASE_URL = 'postgres://user:pass@127.0.0.1:5432/db';

const mod = await import('./dist/index.mjs');
const handler = mod.default;

function validKhatmaSnapshot() {
  return {
    khatmas: [['k1', '1', '2026-11-24T00:00:00Z', null, 'active', '0.0']],
    khatma_read_ayahs: [],
    reading_days: [],
    reading_days_legacy: [],
    reading_activity_events: [],
    reading_deletions: [],
  };
}

function validMemorizationSnapshot(meta = [['milestones_seen', '1']]) {
  return {
    memorization_ayahs: [],
    memorization_batches: [],
    memorization_events: [],
    memorization_goals: [],
    memorization_meta: meta,
  };
}

test('attribute escapes HTML attribute special characters for XSS safety', () => {
  assert.equal(mod.attribute(`a&b"c'd<e>f`), 'a&amp;b&quot;c&#39;d&lt;e&gt;f');
});

test('validSnapshot enforces allowlisted keys, prototype ownership, and safe strings', () => {
  assert.equal(mod.validSnapshot('khatma', validKhatmaSnapshot()), true);
  assert.equal(mod.validSnapshot('memorization', validMemorizationSnapshot()), true);
  assert.equal(mod.validSnapshot('memorization', validMemorizationSnapshot([['device_id', 'evil']])), false);
  const protoTrap = Object.create({ khatmas: [] });
  assert.equal(mod.validSnapshot('khatma', protoTrap), false);
  const nulTrap = validKhatmaSnapshot();
  nulTrap.khatmas[0][0] = 'bad\0id';
  assert.equal(mod.validSnapshot('khatma', nulTrap), false);
});

test('server rejects OPTIONS preflight and sets strict security headers without CORS wildcard', async () => {
  mod.resetRateLimits();
  const optionsRes = await handler.fetch(new Request('https://sync.example.test/v1/account', { method: 'OPTIONS' }));
  assert.equal(optionsRes.status, 405);
  assert.equal(optionsRes.headers.get('access-control-allow-origin'), null);

  const loginRes = await handler.fetch(new Request('https://sync.example.test/auth/sign-in', {
    headers: { 'cf-connecting-ip': '198.51.100.1' },
  }));
  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.headers.get('x-frame-options'), 'DENY');
  assert.equal(loginRes.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(loginRes.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.ok(loginRes.headers.get('strict-transport-security')?.includes('max-age='));
});

test('server rejects unauthenticated /v1 requests with 401 and rate-limits abusive IPs with 429', async () => {
  mod.resetRateLimits();
  const unauth = await handler.fetch(new Request('https://sync.example.test/v1/progress/khatma', {
    headers: { 'cf-connecting-ip': '198.51.100.2' },
  }));
  assert.equal(unauth.status, 401);

  const unauthPut = await handler.fetch(new Request('https://sync.example.test/v1/progress/khatma', {
    method: 'PUT',
    headers: {
      'cf-connecting-ip': '198.51.100.2',
      'content-type': 'text/plain',
    },
    body: '{}',
  }));
  assert.equal(unauthPut.status, 401);

  let limited = null;
  for (let i = 0; i < 185; i += 1) {
    const res = await handler.fetch(new Request('https://sync.example.test/auth/sign-in', {
      headers: { 'cf-connecting-ip': '198.51.100.3' },
    }));
    if (res.status === 429) {
      limited = res;
      break;
    }
  }
  assert.ok(limited);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) >= 1);
});
