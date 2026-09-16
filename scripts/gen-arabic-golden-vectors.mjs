/**
 * Generates golden vectors for the Swift port of src/lib/arabic.ts.
 *
 * Three implementations of Arabic normalisation must agree forever:
 *   1. TypeScript  — src/lib/arabic.ts               (web client + server)
 *   2. SQL         — normalize_arabic / rasm_skeleton (Postgres, used by FTS)
 *   3. Swift       — MutshabehatDomain.ArabicText     (iOS)
 *
 * DISCOVERY.md §4 flags the 1↔2 duplication as a divergence risk; adding a
 * third copy natively makes it worse. This script pins all three to the same
 * expected output by sampling REAL corpus text (live `parts` rows + the
 * Uthmani ayahs.json) plus hand-picked edge cases, running TS and SQL over
 * every sample, and failing loudly if they disagree.
 *
 * Output: apps/ios/MutshabehatCore/Tests/Fixtures/arabic-golden.json
 * Swift consumes it as a data-driven test. Re-run whenever arabic.ts changes.
 *
 * Usage: node --experimental-strip-types scripts/gen-arabic-golden-vectors.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const { normalizeArabic, rasmSkeleton, ayahToInt, ayahToArabic } =
  await import('../src/lib/arabic.ts')

// ── Samples ──────────────────────────────────────────────────────────────────

// Edge cases that encode the *intent* of each rule, so a Swift port that
// happens to pass on ordinary text still fails if it gets these wrong.
const EDGE_CASES = [
  '',                       // empty
  '   ',                    // whitespace only -> trim
  'ٱلرَّحۡمَٰنِ',              // alef wasla + dagger alef (the ayahs.json trap)
  'عَٰلَمِينَ',                // dagger alef standing in for a long alef
  'السماوات',               // plene spelling
  'السموات',                // defective spelling — same rasm as the line above
  'عاكفين',
  'عكفين',
  'إأآاٱ',                  // every alef form
  'ىةؤئ',                   // every folded letter
  'ـــمـــحـــمـــد',         // tatweel
  'قال',                    // must NOT collapse into قل (و/ي kept on purpose)
  'قل',
  '  الرجفة  ',             // leading/trailing space
  'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
  'abc 123',                // non-Arabic passthrough
]

// Real corpus text — the cases that actually ship.
// ayahs.json is { surahNumber: { ayahNumber: uthmaniText } }.
const ayahs = JSON.parse(fs.readFileSync('public/quran/ayahs.json', 'utf8'))
const ayahTexts = Object.values(ayahs)
  .flatMap((surah) => Object.values(surah))
  .filter((t) => typeof t === 'string' && t.length)

// Deterministic spread across the whole mushaf rather than the first N ayahs.
const pick = (arr, n) => {
  const step = Math.max(1, Math.floor(arr.length / n))
  return arr.filter((_, i) => i % step === 0).slice(0, n)
}

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter((l) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)

// Live `parts.text` — verse fragments the user has split out (shared/diff/unique),
// so it exercises real segmentation the whole-ayah corpus does not.
//
// PRIVACY: the emitted fixture is committed to a PUBLIC repo, so only sample
// columns that hold scripture. `parts.text` qualifies — it is Quran text. Never add
// `groups.title`, `groups.note` or `groups.unote`: those are the user's own
// writing and do not belong in a test fixture.
let partTexts = []
try {
  const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  const rows = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/parts?select=text&limit=1000`, { headers: h })).json()
  partTexts = pick(rows.map((r) => r.text).filter(Boolean), 150)
} catch (e) {
  console.warn('! could not reach production for `parts` samples:', e.message)
}

const samples = [...new Set([...EDGE_CASES, ...pick(ayahTexts, 250), ...partTexts])]

// ── Cross-check TS against the SQL implementation ────────────────────────────

let sqlChecked = 0
const mismatches = []
try {
  const h = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
  const rpc = async (fn, text) => {
    const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${fn}`,
      { method: 'POST', headers: h, body: JSON.stringify({ input: text }) })
    if (!r.ok) throw new Error(`${fn} -> ${r.status} ${await r.text()}`)
    return r.json()
  }
  for (const s of samples) {
    const [sqlNorm, sqlRasm] = await Promise.all([rpc('normalize_arabic', s), rpc('rasm_skeleton', s)])
    const tsNorm = normalizeArabic(s), tsRasm = rasmSkeleton(s)
    if (sqlNorm !== tsNorm) mismatches.push({ fn: 'normalize_arabic', input: s, ts: tsNorm, sql: sqlNorm })
    if (sqlRasm !== tsRasm) mismatches.push({ fn: 'rasm_skeleton', input: s, ts: tsRasm, sql: sqlRasm })
    sqlChecked++
  }
} catch (e) {
  console.warn('! SQL cross-check skipped:', e.message)
}

// ── Emit ─────────────────────────────────────────────────────────────────────

const out = {
  _generator: 'scripts/gen-arabic-golden-vectors.mjs',
  _source: 'src/lib/arabic.ts',
  _generatedAt: new Date().toISOString(),
  _note: 'Expected values come from the TypeScript implementation, which is the reference. Regenerate whenever src/lib/arabic.ts changes.',
  sqlCrossCheck: { checked: sqlChecked, mismatches: mismatches.length },
  normalizeArabic: samples.map((input) => ({ input, expected: normalizeArabic(input) })),
  rasmSkeleton: samples.map((input) => ({ input, expected: rasmSkeleton(input) })),
  ayahToInt: ['١٢٣', '٧', '42', '', 'abc', '٠'].map((input) => ({ input, expected: ayahToInt(input) })),
  ayahToArabic: [1, 7, 42, 286, 0].map((input) => ({ input, expected: ayahToArabic(input) })),
}

const dest = 'apps/ios/MutshabehatCore/Tests/Fixtures/arabic-golden.json'
fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n')

console.log(`vectors: ${samples.length} samples -> ${dest}`)
console.log(`SQL cross-check: ${sqlChecked} samples, ${mismatches.length} mismatches`)
if (mismatches.length) {
  console.error('\nTS and SQL DISAGREE — fix before porting to Swift:')
  for (const m of mismatches.slice(0, 10)) {
    console.error(`  ${m.fn}(${JSON.stringify(m.input)})\n    ts : ${JSON.stringify(m.ts)}\n    sql: ${JSON.stringify(m.sql)}`)
  }
  process.exitCode = 1
}
