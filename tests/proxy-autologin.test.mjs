import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server.js'

import { proxy } from '../src/proxy.ts'

test('fresh GET redirects once after auto-login and forwards the session cookies', async () => {
  for (const name of [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'AUTOLOGIN_EMAIL',
    'AUTOLOGIN_PASSWORD',
  ]) {
    assert.ok(process.env[name], `${name} is required for this integration test`)
  }

  const requestUrl = 'https://mutshabehat-v2.vercel.app/'
  const response = await proxy(new NextRequest(requestUrl))

  assert.equal(response.status, 307)
  assert.equal(response.headers.get('location'), requestUrl)
  assert.match(response.headers.get('set-cookie') ?? '', /sb-[^=]+-auth-token=/)
})
