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
