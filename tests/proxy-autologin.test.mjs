import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server.js'

import { proxy } from '../src/proxy.ts'

test('fresh GET redirects once after auto-login and forwards the session cookies', async (t) => {
  const missing = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'AUTOLOGIN_EMAIL',
    'AUTOLOGIN_PASSWORD',
  ].filter((name) => !process.env[name])

  if (missing.length > 0) {
    t.skip(`Skipping integration test: missing ${missing.join(', ')}`)
    return
  }

  const requestUrl = 'https://mutshabehat-v2.vercel.app/'
  const response = await proxy(new NextRequest(requestUrl))

  assert.equal(response.status, 307)
  assert.equal(response.headers.get('location'), requestUrl)
  assert.match(response.headers.get('set-cookie') ?? '', /sb-[^=]+-auth-token=/)
})

test('proxy immediately bypasses /api/public/* with no auth check and no cookies set', async () => {
  const publicUrls = [
    'https://mutshabehat-v2.vercel.app/api/public/v1/qiraat?page=1',
    'https://mutshabehat-v2.vercel.app/api/public/v1/qiraat/versions',
    'https://mutshabehat-v2.vercel.app/api/public/v1/mutoon',
    'https://mutshabehat-v2.vercel.app/api/public/v1/mutoon?since=0',
    'https://mutshabehat-v2.vercel.app/api/public/v1/any-future-endpoint',
  ]

  for (const url of publicUrls) {
    const response = await proxy(new NextRequest(url))
    assert.equal(response.status, 200, `Expected 200 Next response for ${url}`)
    assert.equal(response.headers.get('location'), null, `Expected no redirect for ${url}`)
    assert.equal(response.headers.get('set-cookie'), null, `Expected no set-cookie for ${url}`)
  }
})
