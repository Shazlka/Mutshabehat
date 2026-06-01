#!/usr/bin/env node
/**
 * Migrate the Mini's automated-data (114 surah-NNN.js files) into Supabase.
 * Uses the secret key — bypasses RLS.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ws from 'ws'

if (!globalThis.WebSocket) globalThis.WebSocket = ws

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')
const envText = readFileSync(envPath, 'utf-8')
envText.split('\n').forEach((line) => {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
})

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SECRET_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SECRET_KEY) {
  console.error('❌ Missing env vars'); process.exit(1)
}

const MINI_DIR = '/Users/amrelshazly/Library/Mobile Documents/com~apple~CloudDocs/Mutshabehat_Mini/automated-surahs'

const supabase = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

// Helper: run a single surah-NNN.js file in a sandbox and extract its groups.
// Format: window.AUTOMATED_SURAH_DATA_BY_NO[<surahNo>] = [{ ... groups }]
function loadSurahFile(filePath) {
  const code = readFileSync(filePath, 'utf-8')
  const ctx = { window: {}, console }
  vm.createContext(ctx)
  try {
    vm.runInContext(code, ctx, { filename: filePath })
  } catch (e) {
    console.error(`  ❌ Error loading ${filePath}: ${e.message}`)
    return []
  }
  const w = ctx.window || {}
  const groups = []
  // Walk all known container shapes
  for (const containerName of ['AUTOMATED_SURAH_DATA_BY_NO', 'AUTOMATED_SURAH_DATA', 'AUTOMATED_DATA']) {
    const c = w[containerName]
    if (!c) continue
    if (Array.isArray(c)) {
      groups.push(...c)
    } else if (typeof c === 'object') {
      for (const v of Object.values(c)) if (Array.isArray(v)) groups.push(...v)
    }
  }
  // De-dup by id (a group may appear under multiple surahs in BY_NO)
  const seen = new Set()
  const unique = []
  for (const g of groups) {
    const key = g.id != null ? String(g.id) : JSON.stringify([g.title, g.surahs])
    if (seen.has(key)) continue
    seen.add(key); unique.push(g)
  }
  return unique
}

// ── Migrate ─────────────────────────────────────────────────────────────────
const files = readdirSync(MINI_DIR).filter((f) => f.startsWith('surah-') && f.endsWith('.js')).sort()
console.log(`📚 Found ${files.length} surah files`)

// Wipe existing automated rows first (idempotent)
const { error: delErr } = await supabase.from('automated_groups').delete().not('id', 'is', null)
if (delErr) console.warn(`Warning clearing table: ${delErr.message}`)

// Phase 1 — collect ALL groups across all files, de-duped by global id.
const allMap = new Map()
for (const file of files) {
  const groups = loadSurahFile(resolve(MINI_DIR, file))
  for (const g of groups) {
    const key = g.id != null ? String(g.id) : `${g.title}|${(g.surahs || []).join(',')}`
    if (!allMap.has(key)) allMap.set(key, g)
  }
  process.stdout.write(`\r  • Scanning ${file} (collected ${allMap.size})         `)
}
console.log(`\n📦 Total unique groups to insert: ${allMap.size}`)

// Phase 2 — batch insert
const allGroups = [...allMap.values()]
let total = 0, failed = 0
const BATCH = 100

for (let i = 0; i < allGroups.length; i += BATCH) {
  const slice = allGroups.slice(i, i + BATCH).map((g) => ({
    legacy_id: g.id != null ? String(g.id) : null,
    title:     g.title || 'بدون عنوان',
    color:     g.color || '#888',
    surahs:    Array.isArray(g.surahs) ? g.surahs.filter(Boolean) : [],
    payload:   g,
  }))
  const { error } = await supabase.from('automated_groups').insert(slice)
  if (error) {
    failed += slice.length
    console.error(`\n  ❌ Batch error: ${error.message}`)
  } else {
    total += slice.length
  }
  process.stdout.write(`\r  ✅ Inserted ${total} / ${allGroups.length}         `)
}

console.log(`\n\n🎉 Migrated ${total} automated groups, ${failed} failed.`)
