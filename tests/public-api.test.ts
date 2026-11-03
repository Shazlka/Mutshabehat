import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { proxy } from '../src/proxy'
import {
  GET as getQiraat,
  HEAD as headQiraat,
  POST as postQiraat,
  PUT as putQiraat,
  DELETE as deleteQiraat,
  PATCH as patchQiraat,
  OPTIONS as optionsQiraat,
} from '../src/app/api/public/v1/qiraat/route'
import {
  GET as getVersions,
  HEAD as headVersions,
  POST as postVersions,
  PUT as putVersions,
  DELETE as deleteVersions,
  PATCH as patchVersions,
  OPTIONS as optionsVersions,
} from '../src/app/api/public/v1/qiraat/versions/route'
import {
  GET as getMutoon,
  HEAD as headMutoon,
  POST as postMutoon,
  PUT as putMutoon,
  DELETE as deleteMutoon,
  PATCH as patchMutoon,
  OPTIONS as optionsMutoon,
} from '../src/app/api/public/v1/mutoon/route'

test('qiraat endpoint strictly validates page parameter (integer 1..604)', async () => {
  const invalidPages = [
    '',
    '0',
    '605',
    '-1',
    '1.5',
    'abc',
    'NaN',
    '01',
    '1a',
    ' 1 ',
    '604.1',
  ]

  for (const page of invalidPages) {
    const url = `https://example.test/api/public/v1/qiraat?page=${encodeURIComponent(page)}`
    const res = await getQiraat(new NextRequest(url))
    assert.equal(res.status, 400, `Expected 400 for page='${page}'`)
    const data = await res.json()
    assert.match(data.error, /Invalid Mushaf 1441 page/i)
    assert.equal(res.headers.get('set-cookie'), null)
  }

  // Missing page query param entirely
  const resMissing = await getQiraat(new NextRequest('https://example.test/api/public/v1/qiraat'))
  assert.equal(resMissing.status, 400)
  const missingData = await resMissing.json()
  assert.match(missingData.error, /Invalid Mushaf 1441 page/i)
})

test('qiraat endpoint succeeds on valid boundaries (page 1 and 604) and returns expected JSON shape with strong ETag', async () => {
  for (const validPage of [1, 604]) {
    const res = await getQiraat(
      new NextRequest(`https://example.test/api/public/v1/qiraat?page=${validPage}`)
    )
    assert.equal(res.status, 200, `Expected 200 for page ${validPage}`)
    assert.equal(
      res.headers.get('cache-control'),
      'public, s-maxage=300, stale-while-revalidate=86400'
    )
    assert.equal(res.headers.get('set-cookie'), null)

    const etag = res.headers.get('etag')
    assert.ok(etag, 'ETag header must be present')
    assert.match(etag, /^"[a-f0-9]+"$/, 'ETag must be a strong quoted hex digest')

    const data = await res.json()
    assert.equal(data.pageNumber, validPage)
    assert.ok(Array.isArray(data.variants), 'variants must be an array')
    assert.ok(Array.isArray(data.rules), 'rules must be an array')
    assert.ok(Array.isArray(data.rulings), 'rulings must be an array')
  }
})

test('qiraat endpoint ignores debug parameter and callers cannot control visibility flags', async () => {
  const [resNormal, resDebug0, resDebug1] = await Promise.all([
    getQiraat(new NextRequest('https://example.test/api/public/v1/qiraat?page=1')),
    getQiraat(new NextRequest('https://example.test/api/public/v1/qiraat?page=1&debug=0')),
    getQiraat(new NextRequest('https://example.test/api/public/v1/qiraat?page=1&debug=1')),
  ])

  const etagNormal = resNormal.headers.get('etag')
  const etagDebug0 = resDebug0.headers.get('etag')
  const etagDebug1 = resDebug1.headers.get('etag')

  assert.equal(etagNormal, etagDebug0, 'debug=0 must not alter the response')
  assert.equal(etagNormal, etagDebug1, 'debug=1 must not alter the response')
})

test('qiraat endpoint answers If-None-Match with 304 and empty body', async () => {
  const initial = await getQiraat(new NextRequest('https://example.test/api/public/v1/qiraat?page=1'))
  const etag = initial.headers.get('etag')
  assert.ok(etag)

  // Matching ETag returns 304
  const reqMatch = new NextRequest('https://example.test/api/public/v1/qiraat?page=1', {
    headers: { 'If-None-Match': etag },
  })
  const res304 = await getQiraat(reqMatch)
  assert.equal(res304.status, 304)
  assert.equal(res304.headers.get('etag'), etag)
  assert.equal(res304.headers.get('cache-control'), 'public, s-maxage=300, stale-while-revalidate=86400')
  assert.equal(res304.headers.get('set-cookie'), null)
  const body304 = await res304.text()
  assert.equal(body304, '', '304 must return empty body')

  // Non-matching ETag returns 200
  const reqMismatch = new NextRequest('https://example.test/api/public/v1/qiraat?page=1', {
    headers: { 'If-None-Match': '"stale-etag-value"' },
  })
  const res200 = await getQiraat(reqMismatch)
  assert.equal(res200.status, 200)

  // HEAD with matching ETag returns 304
  const headMatch = await headQiraat(
    new NextRequest('https://example.test/api/public/v1/qiraat?page=1', {
      headers: { 'If-None-Match': etag },
    })
  )
  assert.equal(headMatch.status, 304)
  assert.equal(await headMatch.text(), '')
})

test('qiraat versions route returns 604-page manifest with strong ETag and handles 304', async () => {
  const res = await getVersions(new NextRequest('https://example.test/api/public/v1/qiraat/versions'))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('cache-control'), 'public, s-maxage=300, stale-while-revalidate=86400')
  assert.equal(res.headers.get('set-cookie'), null)

  const etag = res.headers.get('etag')
  assert.ok(etag, 'Versions route must return ETag')
  assert.match(etag, /^"[a-f0-9]+"$/)

  const data = await res.json()
  assert.ok(data && Array.isArray(data.pages), 'Manifest must contain a pages array')
  assert.equal(data.pages.length, 604, 'Manifest must have exactly 604 pages')

  // Check boundary elements and structure
  assert.equal(data.pages[0].page, 1)
  assert.ok(typeof data.pages[0].version === 'string' && data.pages[0].version.length > 0)
  assert.equal(data.pages[603].page, 604)
  assert.ok(typeof data.pages[603].version === 'string' && data.pages[603].version.length > 0)

  for (let i = 0; i < 604; i++) {
    assert.equal(data.pages[i].page, i + 1)
    assert.equal(typeof data.pages[i].version, 'string')
  }

  // Matching If-None-Match returns 304
  const req304 = new NextRequest('https://example.test/api/public/v1/qiraat/versions', {
    headers: { 'If-None-Match': etag },
  })
  const res304 = await getVersions(req304)
  assert.equal(res304.status, 304)
  assert.equal(await res304.text(), '')

  // HEAD on versions route
  const headRes = await headVersions(new NextRequest('https://example.test/api/public/v1/qiraat/versions'))
  assert.equal(headRes.status, 200)
  assert.equal(headRes.headers.get('etag'), etag)
  assert.equal(await headRes.text(), '')
})

test('public endpoints accept GET and HEAD and reject other methods with 405', async () => {
  // Qiraat page 405s
  for (const methodHandler of [postQiraat, putQiraat, deleteQiraat, patchQiraat]) {
    const res = await methodHandler()
    assert.equal(res.status, 405)
    assert.equal(res.headers.get('allow'), 'GET, HEAD, OPTIONS')
    assert.equal(res.headers.get('set-cookie'), null)
  }
  const optQ = await optionsQiraat()
  assert.equal(optQ.status, 204)
  assert.equal(optQ.headers.get('allow'), 'GET, HEAD, OPTIONS')

  // Qiraat versions 405s
  for (const methodHandler of [postVersions, putVersions, deleteVersions, patchVersions]) {
    const res = await methodHandler()
    assert.equal(res.status, 405)
    assert.equal(res.headers.get('allow'), 'GET, HEAD, OPTIONS')
    assert.equal(res.headers.get('set-cookie'), null)
  }
  const optV = await optionsVersions()
  assert.equal(optV.status, 204)
  assert.equal(optV.headers.get('allow'), 'GET, HEAD, OPTIONS')

  // Mutoon HEAD & 405s
  const headM = await headMutoon(new NextRequest('https://example.test/api/public/v1/mutoon'))
  assert.equal(headM.status, 503)
  assert.equal(await headM.text(), '')

  for (const methodHandler of [postMutoon, putMutoon, deleteMutoon, patchMutoon]) {
    const res = await methodHandler()
    assert.equal(res.status, 405)
    assert.equal(res.headers.get('allow'), 'GET, HEAD, OPTIONS')
    assert.equal(res.headers.get('set-cookie'), null)
  }
  const optM = await optionsMutoon()
  assert.equal(optM.status, 204)
  assert.equal(optM.headers.get('allow'), 'GET, HEAD, OPTIONS')
})

test('mutoon endpoint rejects invalid since parameter and handles unconfigured database', async () => {
  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const savedAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const resUnconf = await getMutoon(new NextRequest('https://example.test/api/public/v1/mutoon'))
    assert.equal(resUnconf.status, 503)
    const unconfData = await resUnconf.json()
    assert.equal(unconfData.error, 'unconfigured')

    // Set dummy env so we test 'since' validation
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.invalid'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon'

    for (const badSince of ['-1', 'abc', '1.5', 'NaN', '']) {
      const res = await getMutoon(
        new NextRequest(`https://example.test/api/public/v1/mutoon?since=${encodeURIComponent(badSince)}`)
      )
      assert.equal(res.status, 400, `Expected 400 for bad since='${badSince}'`)
      const data = await res.json()
      assert.equal(data.error, 'bad-since')
    }
  } finally {
    if (savedUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl
    else delete process.env.NEXT_PUBLIC_SUPABASE_URL
    if (savedAnon !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedAnon
    else delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  }
})

test('proxy bypass guarantees no cookies and no auto-login for all /api/public/ routes', async () => {
  const paths = [
    'https://example.test/api/public/v1/qiraat?page=1',
    'https://example.test/api/public/v1/qiraat/versions',
    'https://example.test/api/public/v1/mutoon',
    'https://example.test/api/public/v1/mutoon?since=50',
    'https://example.test/api/public/any-subpath',
  ]

  for (const url of paths) {
    const res = await proxy(new NextRequest(url))
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('location'), null, 'Must not redirect')
    assert.equal(res.headers.get('set-cookie'), null, 'Must not set cookies')
  }
})
