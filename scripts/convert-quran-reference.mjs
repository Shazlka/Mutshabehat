#!/usr/bin/env node
/**
 * Convert quran-reference.js (window globals) → static JSON in /public.
 * Run once. The /api/quran route reads the JSON directly.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = '/Users/amrelshazly/Library/Mobile Documents/com~apple~CloudDocs/Mutshabehat_Mini/quran-reference.js'
const PUBLIC_DIR = resolve(__dirname, '..', 'public', 'quran')

mkdirSync(PUBLIC_DIR, { recursive: true })

// Run the file in a sandbox with a window shim
const code = readFileSync(SRC, 'utf-8')
const ctx = { window: {}, console }
vm.createContext(ctx)
vm.runInContext(code, ctx, { filename: 'quran-reference.js' })

const SURAH_NAMES = ctx.window.SURAH_NAMES || ctx.SURAH_NAMES
const QURAN_AYAHS = ctx.window.QURAN_AYAHS || ctx.QURAN_AYAHS

if (!SURAH_NAMES || !QURAN_AYAHS) {
  console.error('❌ Could not extract SURAH_NAMES / QURAN_AYAHS')
  process.exit(1)
}

writeFileSync(
  resolve(PUBLIC_DIR, 'surah-names.json'),
  JSON.stringify(SURAH_NAMES, null, 0)
)
writeFileSync(
  resolve(PUBLIC_DIR, 'ayahs.json'),
  JSON.stringify(QURAN_AYAHS, null, 0)
)

const ayahCount = Object.values(QURAN_AYAHS).flatMap(Object.values).length
console.log(`✅ Exported ${Object.keys(SURAH_NAMES).length} surahs, ${ayahCount} ayahs`)
console.log(`   → ${PUBLIC_DIR}`)
