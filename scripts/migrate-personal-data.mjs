#!/usr/bin/env node
/**
 * One-time migration: personal-data.js → Supabase Postgres
 *
 * Usage:
 *   node scripts/migrate-personal-data.mjs <USER_ID>
 *
 * Get your USER_ID from: Supabase Dashboard → Authentication → Users → click your row
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (the "secret" key from API Keys page).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ws from 'ws'

// Node 20 polyfill for global WebSocket (required by @supabase/realtime-js)
if (!globalThis.WebSocket) globalThis.WebSocket = ws

// Load env vars from .env.local
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
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  console.error('   Get the secret key from: Supabase → Settings → API Keys → Secret keys')
  process.exit(1)
}

const USER_ID = process.argv[2]
if (!USER_ID || !/^[0-9a-f-]{36}$/i.test(USER_ID)) {
  console.error('❌ Pass your USER_ID as the first arg.')
  console.error('   Example: node scripts/migrate-personal-data.mjs 12345678-1234-1234-1234-123456789abc')
  console.error('   Find it at: Supabase Dashboard → Authentication → Users → your row')
  process.exit(1)
}

const PERSONAL_DATA_PATH = '/Users/amrelshazly/Library/Mobile Documents/com~apple~CloudDocs/Mutshabehat_Mini/personal-data.js'

// ── Arabic-Indic to Western numerals ────────────────────────────────────────
const ARABIC_DIGITS = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' }
function ayahToInt(v) {
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return 1
  const western = v.split('').map((ch) => ARABIC_DIGITS[ch] ?? ch).join('')
  const n = parseInt(western, 10)
  return Number.isFinite(n) ? n : 1
}

// ── Load personal-data.js ───────────────────────────────────────────────────
const fileText = readFileSync(PERSONAL_DATA_PATH, 'utf-8')
const jsonText = fileText.replace(/^window\.PERSONAL_DATA\s*=\s*/, '').replace(/;\s*$/, '').trim()
const groups = JSON.parse(jsonText)
console.log(`📖 Loaded ${groups.length} groups from personal-data.js`)

// ── Supabase admin client (bypasses RLS) ────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

// ── Migrate ─────────────────────────────────────────────────────────────────
let ok = 0, failed = 0
for (const g of groups) {
  try {
    // Insert group
    const { data: groupRow, error: gErr } = await supabase
      .from('groups')
      .insert({
        user_id:   USER_ID,
        title:     g.title || 'بدون عنوان',
        color:     g.color || '#55b94f',
        note:      typeof g.note  === 'string' ? g.note  : null,
        unote:     typeof g.unote === 'string' ? g.unote : null,
        favorite:  !!g.favorite,
        completed: !!g.completed,
        status:    g.locked ? 'locked' : (g.completed ? 'published' : 'draft'),
      })
      .select('id').single()
    if (gErr) throw gErr

    // Insert verses (and parts inside each)
    for (let vi = 0; vi < (g.verses || []).length; vi++) {
      const v = g.verses[vi]
      const { data: verseRow, error: vErr } = await supabase
        .from('verses')
        .insert({
          group_id:   groupRow.id,
          surah:      v.surah || '',
          ayah:       ayahToInt(v.ayah),
          label:      typeof v.label === 'string' ? v.label : null,
          sort_order: vi,
        })
        .select('id').single()
      if (vErr) throw vErr

      // Parts
      const parts = (v.parts || []).map((p, pi) => ({
        verse_id:   verseRow.id,
        type:       ['shared','diff','diff2','diff3','addition','unique','normal'].includes(p.type) ? p.type : 'normal',
        text:       p.text || '',
        sort_order: pi,
      }))
      if (parts.length) {
        const { error: pErr } = await supabase.from('parts').insert(parts)
        if (pErr) throw pErr
      }
    }
    ok++
    process.stdout.write(`\r  ✅ Migrated ${ok}/${groups.length}`)
  } catch (e) {
    failed++
    console.error(`\n  ❌ Group "${g.title}" — ${e.message}`)
  }
}

console.log(`\n\n🎉 Done. ${ok} succeeded, ${failed} failed.`)
