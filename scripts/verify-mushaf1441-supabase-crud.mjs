import { existsSync, readFileSync } from 'node:fs'

const env = { ...process.env }
const envPath = '.env.local'

if (existsSync(envPath)) {
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const index = line.indexOf('=')
    env[line.slice(0, index)] = line.slice(index + 1).replace(/^['"]|['"]$/g, '')
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const accessToken = env.MUSHAF_1441_TEST_ACCESS_TOKEN

function fail(message) {
  console.error(`Mushaf 1441 Supabase CRUD verification failed: ${message}`)
  process.exit(1)
}

function decodeJwtPayload(token) {
  const [, payload] = token.split('.')
  if (!payload) fail('MUSHAF_1441_TEST_ACCESS_TOKEN is not a JWT')

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    fail('MUSHAF_1441_TEST_ACCESS_TOKEN payload could not be decoded')
  }
}

if (!supabaseUrl) fail('NEXT_PUBLIC_SUPABASE_URL is missing')
if (!anonKey) fail('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing')
if (!accessToken) {
  fail('MUSHAF_1441_TEST_ACCESS_TOKEN is missing. Use a signed-in preview user access token; do not use a service-role key.')
}

const tokenPayload = decodeJwtPayload(accessToken)
const userId = typeof tokenPayload.sub === 'string' ? tokenPayload.sub : null
if (!userId) fail('MUSHAF_1441_TEST_ACCESS_TOKEN does not contain a user sub claim')

const tableUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/mushaf_annotations`
const marker = `mushaf-1441-crud-${Date.now()}`
const headers = {
  apikey: anonKey,
  authorization: `Bearer ${accessToken}`,
  'content-type': 'application/json',
}

async function readJson(response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function request(path, options) {
  const response = await fetch(`${tableUrl}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers ?? {}),
    },
  })
  const body = await readJson(response)
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'message' in body
      ? body.message
      : JSON.stringify(body)
    fail(`${options.method ?? 'GET'} ${path || '/'} returned ${response.status}: ${message}`)
  }
  return body
}

async function expectRequestFailure(label, path, options, expectedText) {
  const response = await fetch(`${tableUrl}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers ?? {}),
    },
  })
  const body = await readJson(response)
  if (response.ok) {
    fail(`${label} unexpectedly succeeded`)
  }

  const message = typeof body === 'object' && body !== null && 'message' in body
    ? String(body.message)
    : JSON.stringify(body)
  if (!message.includes(expectedText)) {
    fail(`${label} did not mention ${expectedText}; received: ${message}`)
  }
}

const baseRow = {
  user_id: userId,
  ayah_key: '2:255',
  page_number: 42,
  tags: ['crud-preview'],
  metadata: { marker, source: 'mushaf-1441-preview-crud' },
}

const rows = [
  {
    ...baseRow,
    annotation_type: 'note',
    target_type: 'ayah',
    title: 'CRUD ayah note',
    body: 'Temporary ayah note created by the Mushaf 1441 preview verifier.',
  },
  {
    ...baseRow,
    annotation_type: 'note',
    target_type: 'word',
    word_id: 'p042-l08-w001',
    line_number: 8,
    word_index_in_line: 1,
    title: 'CRUD word note',
    body: 'Temporary word note created by the Mushaf 1441 preview verifier.',
  },
  {
    ...baseRow,
    annotation_type: 'highlight',
    target_type: 'ayah',
    text_color: '#8c5f0a',
    background_color: '#fff3c4',
  },
  {
    ...baseRow,
    annotation_type: 'highlight',
    target_type: 'word-range',
    word_range_start_id: 'p042-l08-w001',
    word_range_end_id: 'p042-l08-w003',
    text_color: '#214d9a',
    background_color: '#dce9ff',
  },
  {
    ...baseRow,
    annotation_type: 'bookmark',
    target_type: 'ayah',
  },
  {
    ...baseRow,
    annotation_type: 'favorite',
    target_type: 'ayah',
  },
]

const insertedIds = []

try {
  await expectRequestFailure(
    'invalid word target without word_id',
    '',
    {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({
        ...baseRow,
        annotation_type: 'note',
        target_type: 'word',
        line_number: 8,
        word_index_in_line: 1,
        title: 'Invalid word note',
        body: 'This row should be rejected by mushaf_annotations_target_shape_check.',
      }),
    },
    'mushaf_annotations_target_shape_check'
  )

  await expectRequestFailure(
    'invalid word-range target without end id',
    '',
    {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({
        ...baseRow,
        annotation_type: 'highlight',
        target_type: 'word-range',
        word_range_start_id: 'p042-l08-w001',
        text_color: '#214d9a',
        background_color: '#dce9ff',
      }),
    },
    'mushaf_annotations_target_shape_check'
  )

  for (const row of rows) {
    const result = await request('', {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify(row),
    })
    const inserted = Array.isArray(result) ? result[0] : null
    if (!inserted?.id) fail(`insert did not return an id for ${row.annotation_type}/${row.target_type}`)
    insertedIds.push(inserted.id)
  }

  const selected = await request(`?id=in.(${insertedIds.join(',')})&select=id,annotation_type,target_type,ayah_key,page_number`, {
    method: 'GET',
  })
  if (!Array.isArray(selected) || selected.length !== rows.length) {
    fail(`expected to read ${rows.length} inserted rows, read ${Array.isArray(selected) ? selected.length : 'none'}`)
  }

  const updated = await request(`?id=eq.${insertedIds[0]}`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({
      body: 'Temporary ayah note updated by the Mushaf 1441 preview verifier.',
      updated_at: new Date().toISOString(),
    }),
  })
  if (!Array.isArray(updated) || updated.length !== 1) fail('update did not return exactly one row')

  for (const id of insertedIds) {
    await request(`?id=eq.${id}`, {
      method: 'DELETE',
      headers: { prefer: 'return=minimal' },
    })
  }

  console.log(`Mushaf 1441 Supabase CRUD verification passed (${rows.length} rows inserted, read, updated, and deleted).`)
} catch (error) {
  if (insertedIds.length > 0) {
    for (const id of insertedIds) {
      await fetch(`${tableUrl}?id=eq.${id}`, {
        method: 'DELETE',
        headers,
      }).catch(() => null)
    }
  }
  throw error
}
