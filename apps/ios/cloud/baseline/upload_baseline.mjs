#!/usr/bin/env node
// Upload khatma.json and memorization.json (from export_snapshots.py) to your Qiraat cloud account as its baseline.
//
//   node upload_baseline.mjs SNAPSHOT_DIR [--create] [--replace]
//
// It asks for your email and password here in the terminal (the password is not echoed and is never written to
// disk), signs in the same way the apps do, and uploads each dataset. It refuses to overwrite a dataset that already
// has data in the cloud unless you pass --replace. --create registers the account first.
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import readline from 'node:readline';

const origin = process.env.QIRAAT_CLOUD_ORIGIN ?? 'https://br-still-sunset-bgeylsq4-qiraatsync.compute.c-9.eu-central-1.aws.neon.tech';
const issuer = process.env.QIRAAT_CLOUD_ISSUER ?? 'https://ep-silent-frost-bglqosbx.neonauth.c-9.eu-central-1.aws.neon.tech/neondb/auth';
const clientId = process.env.QIRAAT_CLOUD_CLIENT_ID ?? 'MrnWcXbCmpeSORVQYKQMXIolZygFSpNc';
const redirect = origin + '/auth/mobile-callback';
const b64 = value => value.toString('base64url');

const [directory, ...flags] = process.argv.slice(2);
if (!directory) { console.error('usage: node upload_baseline.mjs SNAPSHOT_DIR [--create] [--replace]'); process.exit(2); }
const create = flags.includes('--create');
const replace = flags.includes('--replace');

function ask(question, secret = false) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (secret) {
      rl._writeToOutput = text => { if (text.includes(question)) process.stdout.write(text); };
    }
    rl.question(question, answer => { rl.close(); if (secret) process.stdout.write('\n'); resolve(answer.trim()); });
  });
}

function signedQuery(location) {
  const params = new URL(location, origin).searchParams;
  const names = new Set(params.getAll('ba_param'));
  const out = new URLSearchParams();
  for (const [key, value] of params) if (key === 'sig' || key === 'ba_param' || names.has(key)) out.append(key, value);
  return out.toString();
}

async function signIn(email, password) {
  const jar = new Map();
  const absorb = response => {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';'); const at = pair.indexOf('=');
      jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
  };
  const verifier = b64(randomBytes(32));
  const state = b64(randomBytes(32));
  const challenge = b64(createHash('sha256').update(verifier).digest());
  const query = new URLSearchParams({
    client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: 'openid profile email offline_access',
    resource: origin, code_challenge: challenge, code_challenge_method: 'S256', state,
  });
  const start = await fetch(`${issuer}/oauth2/authorize?${query}`, { redirect: 'manual' });
  const location = start.headers.get('location') ?? (await start.json()).url;
  const oauthQuery = signedQuery(location);
  const post = async (path, body) => {
    const response = await fetch(`${issuer}/${path}`, {
      method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/json', Origin: origin, ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}) },
      body: JSON.stringify(body),
    });
    absorb(response);
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.message ?? json.error_description ?? `HTTP ${response.status}`);
    return json;
  };
  const auth = await post(create ? 'sign-up/email' : 'sign-in/email', create ? { email, password, name: email.split('@')[0] } : { email, password });
  if (create && !auth.token) throw new Error('Check your email to verify the account, then run again without --create.');
  let next = await post('oauth2/continue', { selected: true, oauth_query: oauthQuery });
  for (let attempt = 0; attempt < 4; attempt++) {
    const url = new URL(next.url, origin);
    if (url.href.startsWith(redirect)) {
      if (url.searchParams.get('state') !== state) throw new Error('state mismatch');
      const token = await fetch(`${issuer}/oauth2/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code'), code_verifier: verifier, redirect_uri: redirect, client_id: clientId, resource: origin }),
      });
      if (!token.ok) throw new Error(`token HTTP ${token.status}`);
      return (await token.json()).access_token;
    }
    next = await post('oauth2/consent', { accept: true, oauth_query: signedQuery(url.href) });
  }
  throw new Error('sign-in did not finish');
}

const api = async (token, path, method = 'GET', body) => {
  const response = await fetch(origin + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body });
  return [response.status, await response.json().catch(() => ({}))];
};

// QIRAAT_EMAIL and QIRAAT_PASSWORD skip the prompts (for scripted runs); otherwise you are asked.
const email = process.env.QIRAAT_EMAIL ?? await ask('Email: ');
const password = process.env.QIRAAT_PASSWORD ?? await ask('Password: ', true);
let token;
try { token = await signIn(email, password); } catch (error) { console.error('Sign-in failed:', error.message); process.exit(1); }
console.log('Signed in.');

for (const dataset of ['khatma', 'memorization']) {
  const snapshot = JSON.parse(await readFile(`${directory}/${dataset}.json`, 'utf8'));
  const rows = Object.values(snapshot).reduce((total, list) => total + list.length, 0);
  const [, current] = await api(token, `/v1/progress/${dataset}?known=0`);
  if (current.revision > 0 && !replace) {
    console.log(`${dataset}: the cloud already has data (revision ${current.revision}); skipped. Use --replace to overwrite it.`);
    continue;
  }
  const [status, result] = await api(token, `/v1/progress/${dataset}`, 'PUT', JSON.stringify({ revision: current.revision, snapshot }));
  console.log(status === 200 ? `${dataset}: uploaded ${rows} rows, cloud revision ${result.revision}` : `${dataset}: failed (HTTP ${status})`);
  if (status !== 200) process.exitCode = 1;
}
