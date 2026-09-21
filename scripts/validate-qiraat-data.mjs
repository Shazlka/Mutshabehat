// Dataset linter for the imported Qiraat pages. Pure node, no build step, no dev deps —
// it reads the generated fixtures and the real Mushaf-1441 word fixtures and checks that the
// two actually agree. Run: node scripts/validate-qiraat-data.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))

const READINGS = []
for (let r = 1; r <= 10; r++) for (const n of ['R01', 'R02']) READINGS.push(`Q${String(r).padStart(2, '0')}-${n}`)

let failures = 0
const fail = (msg) => { failures++; console.error('  FAIL', msg) }

let variants = 0, rulings = 0, flagged = 0
// Every page the repository actually loads, read from the loader table itself.
const REPO = readFileSync(join(ROOT, 'packages/qiraat-core/repository.ts'), 'utf8')
const PAGES = [...new Set([...REPO.matchAll(/fixtures\/pages\/page-(\d{3})\.json/g)]
  .map((m) => Number(m[1])))].sort((a, b) => a - b)
if (!PAGES.length) { console.error('FAIL: no Qiraat pages wired into the repository'); process.exit(1) }
const wordsOf = (page) => {
  const d = read(`packages/quran-data/mushaf1441/fixtures/page-words/page-${String(page).padStart(3, '0')}.json`)
  return d.lines.flatMap((l) => l.words).filter((w) => !w.charTypeName || w.charTypeName === 'word')
}

for (const page of PAGES) {
  const pad = String(page).padStart(3, '0')
  const words = wordsOf(page)
  const byPos = new Map(words.map((w) => [`${w.surahNumber}:${w.ayahNumber}:${w.wordIndexInAyah}`, w]))

  // ---- variants ----
  const vs = read(`packages/qiraat-core/fixtures/pages/page-${pad}.json`)
  variants += vs.length
  const byLocus = new Map()
  for (const v of vs) {
    const anchor = byPos.get(`${v.surah}:${v.ayah}:${v.startToken}`)
    if (!anchor) { fail(`p${page} ${v.id}: startToken ${v.surah}:${v.ayah}:${v.startToken} is not a real word on this page`) ; continue }
    if (v.readingIds.length === 0) fail(`p${page} ${v.id}: empty readingIds`)
    for (const r of v.readingIds) if (!READINGS.includes(r)) fail(`p${page} ${v.id}: bogus reading id ${r}`)
    if (!v.sources?.length) fail(`p${page} ${v.id}: no source`)
    if (v.verificationStatus === 'NEEDS_MANUAL_REVIEW') flagged++
    // Key on the TOKEN, not the locus: a grouped locus (2:37 آدم + كلمات, 2:97/98 جبريل) spans
    // several different words, and one reader legitimately differs at each of them. The real
    // invariant is that no reading is claimed twice at the SAME token.
    const key = `${v.surah}:${v.ayah}:${v.startToken}`
    if (!byLocus.has(key)) byLocus.set(key, [])
    byLocus.get(key).push(v)
  }
  // A reading cannot be assigned to two lexical alternatives. Explicitly sourced, named
  // performance variants are the exception: a riwaya can have more than one approved way
  // (e.g. إسكان/اختلاس or two waqf options) at the same token. Keep this exception narrow so
  // a same-reader split never silently becomes a conflicting word form.
  for (const [locus, group] of byLocus) {
    const seen = new Map()
    for (const v of group) for (const r of v.readingIds) seen.set(r, (seen.get(r) ?? 0) + 1)
    const dup = [...seen].filter(([, c]) => c > 1).map(([r]) => r)
    const unsupported = dup.filter((readingId) => {
      const faces = group.filter((v) => v.readingIds.includes(readingId))
      const notes = faces.map((v) => v.performanceNote?.trim() ?? '')
      const allHaveIndependentEvidence = faces.every((v) => (
        Array.isArray(v.sources) && v.sources.some((s) => (
          /^https?:\/\/(?:www\.)?(?:quranpedia\.net\/qiraat\/|nquran\.com\/)/i.test(s.sourceReference ?? '')
        ))
      ))
      return faces.length < 2
        || faces.some((v) => v.locusType !== 'performance_variant')
        || notes.some((note) => !note)
        || new Set(notes).size !== notes.length
        || !allHaveIndependentEvidence
    })
    if (unsupported.length) fail(`p${page} token ${locus}: reading(s) ${unsupported.join(',')} overlap without distinct, source-verified performance notes`)
  }

  // ---- rulings ----
  const rs = read(`packages/qiraat-core/fixtures/rulings/page-${pad}.json`)
  rulings += rs.length
  for (const r of rs) {
    if (r.pageNumber !== page) fail(`p${page} ${r.id}: pageNumber mismatch`)
    const anchor = byPos.get(`${r.surah}:${r.ayah}:${r.startToken}`)
    if (!anchor) { fail(`p${page} ${r.id}: startToken is not a real word on this page`); continue }
    // baseText must be VERBATIM from the mushaf fixture — never hand-typed.
    const expected = []
    for (let t = r.startToken; t <= r.endToken; t++) {
      const w = byPos.get(`${r.surah}:${r.ayah}:${t}`)
      if (w) expected.push(w.textUthmani)
    }
    if (r.endAyah === r.ayah && expected.join(' ') !== r.baseText) {
      fail(`p${page} ${r.id}: baseText is not verbatim from the mushaf fixture`)
    }
    if (!r.color?.match(/^#[0-9A-F]{6}$/i)) fail(`p${page} ${r.id}: bad colour ${r.color}`)
    for (const a of r.attribution) {
      if (!/^Q(0[1-9]|10)(-R0[12])?$/.test(a.authorityId)) fail(`p${page} ${r.id}: bogus authority ${a.authorityId}`)
      if (!a.action) fail(`p${page} ${r.id}: attribution without an action`)
    }
    for (const rd of r.readings) if (!READINGS.includes(rd.readingId)) fail(`p${page} ${r.id}: bogus reading ${rd.readingId}`)
    if (r.readings.length === 0 && !r.countSchools) fail(`p${page} ${r.id}: no readings and no counting schools`)
    // hasAlternate must agree with the readings it describes.
    const anyAlt = r.readings.some((rd) => !rd.isDefault)
    if (anyAlt !== Boolean(r.hasAlternate)) fail(`p${page} ${r.id}: hasAlternate disagrees with readings`)
  }
}

// One usul FAMILY must have exactly one colour across the whole dataset.
const colourOf = new Map()
for (const page of PAGES) {
  for (const r of read(`packages/qiraat-core/fixtures/rulings/page-${String(page).padStart(3, '0')}.json`)) {
    const prev = colourOf.get(r.category)
    if (prev && prev !== r.color) fail(`category ${r.category} has two colours: ${prev} and ${r.color}`)
    colourOf.set(r.category, r.color)
  }
}

console.log(`Qiraat data: ${variants} variants, ${rulings} rulings across ${PAGES.length} pages (${PAGES[0]}-${PAGES[PAGES.length - 1]}), ${flagged} flagged NEEDS_MANUAL_REVIEW`)
console.log(`${colourOf.size} usul categories, each with one colour`)
if (failures) { console.error(`\n${failures} failures`); process.exit(1) }
console.log('all checks passed')
