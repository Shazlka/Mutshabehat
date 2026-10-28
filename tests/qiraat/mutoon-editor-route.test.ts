import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { GET, POST, PUT } from '../../src/app/api/mushaf-1441/mutoon-editor/route'

function withoutServerKey<T>(run: () => Promise<T>): Promise<T> {
  const before = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  return run().finally(() => { if (before !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = before })
}

test('the API does not use a database client when server configuration is absent', async () => {
  await withoutServerKey(async () => {
    const response = await GET(new NextRequest('https://example.test/api/mushaf-1441/mutoon-editor?work=durrah'))
    assert.equal(response.status, 503)
  })
})

test('cross-site save is refused before reading a request body', async () => {
  const response = await POST(new NextRequest('https://example.test/api/mushaf-1441/mutoon-editor', {
    method: 'POST', headers: { origin: 'https://evil.test', 'content-type': 'application/json' }, body: '{}',
  }))
  assert.equal(response.status, 403)
})

test('a malformed batch is rejected with 400 before the database is reached', async () => {
  const before = { key: process.env.SUPABASE_SERVICE_ROLE_KEY, url: process.env.NEXT_PUBLIC_SUPABASE_URL }
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1'
  try {
    const response = await POST(new NextRequest('https://example.test/api/mushaf-1441/mutoon-editor', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ops: [{ t: 'assign_set', readingIds: ['Q99'] }], lines: {} }),
    }))
    assert.equal(response.status, 400)
  } finally {
    if (before.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = before.key
    if (before.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = before.url
  }
})

test('the old whole-document save is retired', async () => {
  assert.equal((await PUT()).status, 410)
})
