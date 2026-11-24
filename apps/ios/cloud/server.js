import { readFile } from 'node:fs/promises';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import pg from 'pg';

const issuer = process.env.NEON_AUTH_URL?.replace(/\/$/, '');
const origin = process.env.QIRAAT_ORIGIN?.replace(/\/$/, '');
const databaseURL = process.env.DATABASE_URL;
if (![issuer, origin].every(value => value?.startsWith('https://')) || !databaseURL) {
  throw new Error('Configure the HTTPS auth URL and origin, and database connection.');
}
const pool = new pg.Pool({ connectionString: databaseURL, max: 5 });
pool.on('error', () => {});
const keys = createRemoteJWKSet(new URL(issuer + '/.well-known/jwks.json'));
const loginScript = await readFile(new URL('./dist/login.js', import.meta.url));
const maxBody = 16 * 1024 * 1024;

const commonHeaders = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'self'; connect-src 'self' " + new URL(issuer).origin +
    "; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

function response(body, status, contentType, extra = {}) {
  return new Response(body, { status, headers: { ...commonHeaders, 'Content-Type': contentType, ...extra } });
}

function json(status, body) {
  return response(JSON.stringify(body), status, 'application/json; charset=utf-8');
}

function attribute(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function login(consent) {
  const content = consent
    ? '<p>Allow Qiraat to access your account for khatma and memorization sync?</p><button value="allow">Allow</button> <button value="deny">Deny</button>'
    : '<form><label>Email <input type="email" name="email" autocomplete="email" required></label><label>Password <input type="password" name="password" required></label><button value="login">Sign in</button> <button value="signup">Create account</button></form><button id="google">Continue with Google</button>';
  return response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Qiraat Account</title>
<style>body{font:1rem system-ui;color:#182820;background:#f7faf7;margin:3rem auto;padding:0 1.25rem;max-width:24rem}label{display:block;margin-bottom:1rem}input{box-sizing:border-box;display:block;width:100%;font:inherit;padding:.6rem;margin-top:.25rem}button{font:inherit;padding:.6rem .8rem;margin:.25rem 0 1rem}button:disabled{opacity:.6}</style>
<body data-issuer="${attribute(issuer)}"><h1>Qiraat Account</h1>${content}<p role="status"></p><script src="/auth/login.js" defer></script></body></html>`, 200, 'text/html; charset=utf-8');
}

async function readJSON(request) {
  let bytes = 0;
  const chunks = [];
  if (!request.body) return null;
  for await (const chunk of request.body) {
    bytes += chunk.length;
    if (bytes > maxBody) return null;
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { return null; }
}

const tables = {
  khatma: {
    khatmas: 6, khatma_read_ayahs: 5, reading_days: 5, reading_days_legacy: 5,
    reading_activity_events: 6, reading_deletions: 6,
  },
  memorization: {
    memorization_ayahs: 14, memorization_batches: 11, memorization_events: 11,
    memorization_goals: 2, memorization_meta: 2,
  },
};

function validSnapshot(dataset, snapshot) {
  const expected = Object.entries(tables[dataset]);
  return snapshot && Object.keys(snapshot).length === expected.length && expected.every(([table, columns]) =>
    Array.isArray(snapshot[table]) && snapshot[table].every(row =>
      Array.isArray(row) && row.length === columns &&
      row.every(value => value === null || (typeof value === 'string' && !value.includes('\0')))));
}

async function progress(accountId, dataset, update, known) {
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    await connection.query('SET LOCAL ROLE qiraat_sync_runtime');
    await connection.query("SELECT set_config('qiraat.account_id', $1, true)", [accountId]);
    const params = [accountId, dataset];
    if (update) {
      const result = update.revision === 0
        ? await connection.query(`INSERT INTO qiraat_progress(account_id, dataset, revision, snapshot)
            VALUES ($1, $2, 1, $3) ON CONFLICT DO NOTHING RETURNING revision`,
          [...params, JSON.stringify(update.snapshot)])
        : await connection.query(`UPDATE qiraat_progress SET revision = revision + 1, snapshot = $3, updated_at = now()
            WHERE account_id = $1 AND dataset = $2 AND revision = $4 RETURNING revision`,
          [...params, JSON.stringify(update.snapshot), update.revision]);
      await connection.query('COMMIT');
      return result.rows[0];
    }
    const result = await connection.query(
      `SELECT revision, CASE WHEN revision <> $3 THEN snapshot END AS snapshot,
              revision = $3 AS unchanged
         FROM qiraat_progress WHERE account_id = $1 AND dataset = $2`, [...params, known]);
    await connection.query('COMMIT');
    return result.rows[0] ?? { revision: 0, snapshot: null };
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}

export default { async fetch(request) {
  try {
    const url = new URL(request.url, origin);
    if (request.method === 'GET') {
      if (url.pathname === '/auth/login.js') {
        return response(loginScript, 200, 'text/javascript; charset=utf-8');
      }
      if (url.pathname === '/auth/sign-in' || url.pathname === '/auth/consent') {
        return login(url.pathname === '/auth/consent');
      }
      if (url.pathname === '/auth/mobile-callback') {
        const callback = new URL('com.shazlka.qiraat://cloud/callback');
        for (const name of ['code', 'state', 'error']) {
          const value = url.searchParams.get(name);
          if (value) callback.searchParams.set(name, value);
        }
        const target = attribute(callback.href);
        return response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
          <meta http-equiv="refresh" content="0;url=${target}"><title>Return to Qiraat</title>
          <p><a href="${target}">Return to Qiraat</a></p></html>`, 200, 'text/html; charset=utf-8');
      }
    }
    const dataset = url.pathname.match(/^\/v1\/progress\/(khatma|memorization)$/)?.[1];
    if (!dataset && url.pathname !== '/v1/account') return json(404, {});
    let identity;
    try {
      const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
      if (!token) return json(401, {});
      const { payload } = await jwtVerify(token, keys, { issuer, audience: origin, algorithms: ['EdDSA'] });
      if (typeof payload.sub !== 'string' || !payload.sub) return json(401, {});
      identity = payload.sub;
    } catch {
      return json(401, {});
    }
    if (!dataset && request.method === 'GET') return json(200, { id: identity });
    if (dataset && request.method === 'GET') {
      const parsed = Number(url.searchParams.get('known'));
      const known = Number.isInteger(parsed) && parsed > 0 && parsed < 2147483648 ? parsed : 0;
      return json(200, await progress(identity, dataset, null, known));
    }
    if (dataset && request.method === 'PUT') {
      const update = await readJSON(request);
      if (!Number.isInteger(update?.revision) || update.revision < 0 || update.revision >= 2147483647 ||
          !validSnapshot(dataset, update.snapshot)) return json(400, {});
      const saved = await progress(identity, dataset, update);
      return json(saved ? 200 : 409, saved ?? {});
    }
    return json(405, {});
  } catch {
    return json(503, {});
  }
} };
