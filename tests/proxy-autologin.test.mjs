import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server.js'

import { proxy } from '../src/proxy.ts'

const hasAuthEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'AUTOLOGIN_EMAIL',
  'AUTOLOGIN_PASSWORD',
].every((name) => Boolean(process.env[name]))

test(
  'fresh GET redirects once after auto-login and forwards the session cookies',
  { skip: !hasAuthEnv ? 'Supabase auth env vars not set (integration test)' : false },
  async () => {
    const requestUrl = 'https://mutshabehat-v2.vercel.app/'
    const response = await proxy(new NextRequest(requestUrl))

    assert.equal(response.status, 307)
    assert.equal(response.headers.get('location'), requestUrl)
    assert.match(response.headers.get('set-cookie') ?? '', /sb-[^=]+-auth-token=/)
  }
)

const PUBLIC_LEGAL_PATHS = [
  '/privacy',
  '/privacy/en',
  '/support',
  '/support/en',
  '/privacy/',
  '/support/',
]

for (const path of PUBLIC_LEGAL_PATHS) {
  test(`${path} bypasses auto-login without redirect, cookie or Supabase client`, async () => {
    const requestUrl = `https://mutshabehat-v2.vercel.app${path}`
    const response = await proxy(new NextRequest(requestUrl))

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('location'), null)
    assert.equal(response.headers.get('set-cookie'), null)
  })
}

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
