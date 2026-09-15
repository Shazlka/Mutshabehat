import { existsSync, readFileSync } from 'node:fs'
import { lookup } from 'node:dns/promises'

const envPath = '.env.local'
const env = { ...process.env }

if (existsSync(envPath)) {
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const index = line.indexOf('=')
    env[line.slice(0, index)] = line.slice(index + 1)
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const apiKey = anonKey || serviceRoleKey
const expectedProjectRef = env.MUSHAF_1441_EXPECTED_SUPABASE_REF

const issues = []
const warnings = []

function issue(message) {
  issues.push(message)
}

function warning(message) {
  warnings.push(message)
}

if (!supabaseUrl) issue('NEXT_PUBLIC_SUPABASE_URL is missing')
if (!anonKey) issue('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing')
if (!apiKey) issue('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing')

let parsedUrl = null
if (supabaseUrl) {
  try {
    parsedUrl = new URL(supabaseUrl)
  } catch {
    issue('NEXT_PUBLIC_SUPABASE_URL is not a valid URL')
  }
}

function summarizeKey(name, value) {
  if (!value) return
  console.log(`${name}: set (${value.length} chars)`)
  if (value.length < 80 && !value.startsWith('sb_publishable_') && !value.startsWith('sb_secret_')) {
    warning(`${name} is unusually short for a Supabase API key; verify it is not a placeholder or old invalid key`)
  }
}

summarizeKey('NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey)
summarizeKey('SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey)

let hostResolves = false
if (parsedUrl) {
  const projectRef = parsedUrl.hostname.split('.')[0]
  console.log(`Supabase URL host: ${parsedUrl.hostname}`)
  console.log(`Supabase URL project ref: ${projectRef}`)

  if (expectedProjectRef && projectRef !== expectedProjectRef) {
    issue(`NEXT_PUBLIC_SUPABASE_URL points to ${projectRef}, expected ${expectedProjectRef}`)
  }

  try {
    await lookup(parsedUrl.hostname)
    hostResolves = true
    console.log(`Supabase host resolves: ${parsedUrl.hostname}`)
  } catch {
    issue(`Supabase host does not resolve: ${parsedUrl.hostname}`)
  }
}

async function checkTable(tableName) {
  if (!parsedUrl || !apiKey || !hostResolves) {
    console.log(`${tableName}: skipped because Supabase URL/key/DNS is not valid`)
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const headers = {
      apikey: apiKey,
    }
    if (!apiKey.startsWith('sb_publishable_')) {
      headers.authorization = `Bearer ${apiKey}`
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?select=id&limit=1`, {
      headers,
      signal: controller.signal,
    })
    const body = await response.text()
    let parsedBody = null
    try {
      parsedBody = JSON.parse(body)
    } catch {
      parsedBody = null
    }

    if (response.ok) {
      console.log(`${tableName}: reachable`)
      return
    }

    const message = parsedBody?.message ?? body.slice(0, 180)
    const tableHint = tableName === 'mushaf_annotations' && response.status === 404
      ? ' Apply supabase/migrations/20260628000000_mushaf_annotations_preview.sql to a non-production preview branch/project.'
      : ''
    const hint = parsedBody?.hint ? ` Hint: ${parsedBody.hint}` : tableHint
    issue(`${tableName} is not reachable over Supabase REST (${response.status}). ${message}${hint}`)
  } finally {
    clearTimeout(timeout)
  }
}

await checkTable('groups')
await checkTable('mushaf_annotations')

for (const message of warnings) {
  console.warn(`Mushaf 1441 Supabase env warning: ${message}`)
}

if (issues.length > 0) {
  for (const message of issues) {
    console.error(`Mushaf 1441 Supabase env issue: ${message}`)
  }
  console.error(`Mushaf 1441 Supabase env check failed with ${issues.length} issue(s).`)
  process.exit(1)
}

console.log('Mushaf 1441 Supabase env check passed.')
