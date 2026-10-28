import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { GET, PUT } from '../../src/app/api/mushaf-1441/mutoon-editor/route'

test('the API does not use a database client when server configuration is absent', async () => {
  const before = process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const response = await GET()
    assert.equal(response.status, 503)
  } finally {
    if (before === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = before
  }
})

test('cross-site save is refused before reading a request body', async () => {
  const response = await PUT(new NextRequest('https://example.test/api/mushaf-1441/mutoon-editor', {
    method: 'PUT', headers: { origin: 'https://evil.test', 'content-type': 'application/json' }, body: '{}',
  }))
  assert.equal(response.status, 403)
})
