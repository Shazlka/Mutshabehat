// DRY-RUN of the automatic Qiraat review on LIVE rows (exported from a restored database dump).
// Writes nothing. Usage:
//   npx tsx scripts/qiraat/auto-review-live.ts artifacts/live-p19-28.json artifacts/qiraat-auto-review-live-p19-28 [--s2 <path>]
//
// Sources: S1 = nquran.com reference files; S2 = per-reader book extractions (artifacts/s2-index.json,
// built from Hamza/qaloon/ebn_katheer/warsh CSVs). See docs/qiraat/AUTO_REVIEW_PLAN.md §3 for the table.
// Entries already approved (status reviewed) are never judged: they are listed as "skipped".

import { readFileSync, writeFileSync } from 'node:fs'
import { join, isAbsolute } from 'node:path'
import { findNquranDifferencesForWord, resolveDifferenceGroups, type NquranAyahEntry } from '../../src/app/mushaf-1441/review/_lib/nquranReference'

const ROOT = join(__dirname, '..', '..')
const pad = (n: number, w = 3) => String(n).padStart(w, '0')
const readJson = <T,>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T

const MARKS = /[ً-ٰٟۖ-ۭـ]/g
const skeleton = (s: string) => s.replace(MARKS, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, '')

export function farshSubCategory(hafs: string, variant: string): string {
  const a = skeleton(hafs), b = skeleton(variant)
  if (a === b) return 'vowel'
  if (a.length === b.length) {
    if ([...a].filter((c, i) => c !== b[i]).length === 1) return 'consonant'
    if ([...a].sort().join('') === [...b].sort().join('')) return 'word_form'
    return 'other'
  }
  if (b.length > a.length) return b.includes(a) ? 'addition' : 'addition'
  return a.includes(b) ? 'omission' : 'omission'
}
export const SUB_AR: Record<string, string> = { vowel: 'تشكيل', consonant: 'إبدال حرف', addition: 'زيادة', omission: 'حذف', word_form: 'تقديم وتأخير', other: 'أخرى' }

export interface Row {
  id: string; kind: 'variant' | 'ruling'; status: string; device_id: string | null; page: number
  surah: number; ayah: number; word: number; end_word: number | null; base_text: string
  reading_text: string | null; variant_type: string | null; category_code: string | null; narrators: string[]
}
export interface S2Record { n: string[]; kind: 'farsh' | 'usul'; type: string; text: string; explain: string; note: string; wajh: string; src: string }
export interface S2 { byPosition: Record<string, S2Record[]>; byWord: Record<string, S2Record[]>; covers: string[] }
interface WordsPage { lines: { words: { surahNumber: number; ayahNumber: number; wordIndexInAyah: number; textUthmani: string; charTypeName: string }[] }[] }

let s2: S2
let s2Covers: Set<string>
let s2CanConfirm: (n: string) => boolean

export function loadS2(customPath?: string) {
  const p = customPath
    ? (isAbsolute(customPath) ? customPath : join(ROOT, customPath))
    : join(ROOT, 'artifacts/s2-index-v2.json')
  s2 = readJson<S2>(p)
  s2Covers = new Set(s2.covers) // every non-Hafs narrator has a full book extraction (build-s2-index.py)
  s2CanConfirm = (n: string) => s2.covers.includes(n)
}

try {
  loadS2()
} catch {
  s2 = { byPosition: {}, byWord: {}, covers: [] }
  s2Covers = new Set()
  s2CanConfirm = () => false
}

const nq = new Map<number, NquranAyahEntry[]>()
const nquranFor = (s: number) => {
  let v = nq.get(s)
  if (!v) { v = readJson<NquranAyahEntry[]>(join(ROOT, 'src/app/mushaf-1441/review/_lib/reference/nquran', `surah-${pad(s)}.json`)); nq.set(s, v) }
  return v
}
const wordsCache = new Map<string, { word: number; text: string }[]>()
function ayahWords(surah: number, ayah: number, pages: number[]) {
  const key = `${surah}:${ayah}`
  const hit = wordsCache.get(key)
  if (hit) return hit
  const out: { word: number; text: string }[] = []
  for (const p of pages) {
    const d = readJson<WordsPage>(join(ROOT, 'packages/quran-data/mushaf1441/fixtures/page-words', `page-${pad(p)}.json`))
    for (const l of d.lines) for (const w of l.words) if (w.surahNumber === surah && w.ayahNumber === ayah && w.charTypeName === 'word') out.push({ word: w.wordIndexInAyah, text: w.textUthmani })
  }
  out.sort((x, y) => x.word - y.word)
  wordsCache.set(key, out)
  return out
}
const setEq = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x))

export type Tier = 'A2' | 'A1' | 'A-S2' | 'B' | 'C' | 'skip'
export interface Verdict {
  id: string; kind: string; page: number; ref: string; word: string; tier: Tier;
  reason: string; category: string; subCategory: string;
  subCategoryAgreesWithDb: boolean | null;
  storedVariantType?: string | null;
  narrators: string[]; s1Groups: string[]; s2Confirmed: string[]; s2Missing: string[]; s2Explain?: string
}

/** S2 records that speak about this entry's word for this narrator (by word position, then by the Hafs word). */
function s2Records(row: Row, narrator: string): S2Record[] {
  const end = row.end_word ?? row.word
  const out: S2Record[] = []
  for (let w = row.word; w <= end; w += 1) for (const r of s2.byPosition[`${row.surah}:${row.ayah}:${w}`] ?? []) if (r.n.includes(narrator)) out.push(r)
  if (out.length === 0) for (const t of row.base_text.split(/\s+/)) for (const r of s2.byWord[`${row.surah}:${row.ayah}:${skeleton(t)}`] ?? []) if (r.n.includes(narrator)) out.push(r)
  return out
}

/** A narrator is confirmed when a book record about the word agrees with the entry itself:
 *  farsh = the same reading spelling, usul = the same باب. A record that speaks about the word but says
 *  something else is not a confirmation (it is reported as a conflict by the caller). */
// The books and the database name the same rule differently (a book's «IMALAH» row is the database's
// IMALAH_TAQLIL ruling). Two names agree when they belong to the same family.
const FAMILIES: string[][] = [
  ['IMALAH', 'IMALAH_TAQLIL', 'USUL_IMALAH', 'TAQLIL'],
  ['MIM_JAM', 'USUL_MIM_JAM'],
  ['SILAT_HA', 'HA_KINAYAH', 'SILAH'],
  ['NAQL', 'USUL_NAQL', 'USUL_SAKT', 'TARK_SAKT', 'SAKT'],
  ['HAMZ', 'HAMZA', 'HAMZ_MUFRAD', 'TAGHYIR_HAMZ', 'USUL_TAHQIQ', 'WAQF_HAMZA', 'HAMZATAN_KALIMA', 'HAMZATAN_KALIMAH', 'HAMZATAN_KALIMATAYN', 'MADD_BADAL', 'NAQL'],
  ['IDGHAM', 'IDGHAM_SAGHIR', 'IDGHAM_KABIR', 'IKHFA', 'TARK_GHUNNA'],
  ['MADD', 'USUL_MADD', 'MADD_BADAL', 'MADD_LIN'],
  ['YAAT_IDAFA', 'YAAT_ZAWAID'],
  ['WAQF_RASM', 'WAQF_MARSOOM', 'WAQF_HAMZA'],
  ['TARQIQ_RA', 'TAGHLIZ_LAM'],
]
function sameFamily(a: string, b: string): boolean {
  const x = a.toUpperCase(), y = b.toUpperCase()
  return x === y || FAMILIES.some((f) => f.includes(x) && f.includes(y))
}

/** A narrator is confirmed when a book record about the word agrees with the entry itself:
 *  farsh = the same reading spelling (or a performance-only entry), usul = a rule of the same family.
 *  A record that speaks about the word but says something else is not a confirmation. */
function s2Confirms(row: Row, narrator: string): boolean {
  const recs = s2Records(row, narrator)
  if (row.kind === 'variant') {
    const mine = skeleton(row.reading_text ?? '')
    const hafs = skeleton(row.base_text)
    return recs.some((r) => {
      if (r.kind !== 'farsh') return false
      const theirs = skeleton(r.text ?? '')
      return !mine || !theirs || theirs === mine || mine === hafs || theirs === hafs
    })
  }
  return recs.some((r) => sameFamily(r.type, row.category_code ?? ''))
}

export function judge(row: Row, pages: number[]): Verdict {
  const isVariant = row.kind === 'variant'
  const sub = isVariant ? farshSubCategory(row.base_text, row.reading_text ?? row.base_text) : row.category_code ?? ''
  const v: Verdict = {
    id: row.id, kind: row.kind, page: row.page, ref: `${row.surah}:${row.ayah}:${row.word}`, word: row.base_text, tier: 'C', reason: '',
    category: isVariant ? 'فرش' : 'أصول', subCategory: isVariant ? SUB_AR[sub] : sub,
    subCategoryAgreesWithDb: isVariant ? (row.variant_type ? row.variant_type === sub : null) : null,
    storedVariantType: isVariant ? row.variant_type : null,
    narrators: row.narrators, s1Groups: [], s2Confirmed: [], s2Missing: [],
  }
  if (row.status === 'reviewed') return { ...v, tier: 'skip', reason: `already reviewed (${row.device_id ?? 'manual'})` }
  if (!v.subCategory) return { ...v, reason: 'no category / sub-category' }
  if (row.narrators.length === 0) return { ...v, reason: 'entry has no narrators' }

  const entry = nquranFor(row.surah).find((e) => e.ayah === row.ayah)
  const diffs = entry ? findNquranDifferencesForWord(entry.differences, row.base_text, { wordIndex: row.word, ayahWords: ayahWords(row.surah, row.ayah, pages) }) : []
  const groups = diffs.flatMap((d) => resolveDifferenceGroups(d)).filter((g) => g.unresolvedLabels.length === 0 && g.narratorIds.length > 0)
  let s1: 'exact' | 'inside' | 'partial' | 'none' = 'none'
  if (groups.length > 0) {
    const pool = groups.slice(0, 10)
    let overlap = false
    for (let mask = 1; mask < 1 << pool.length; mask += 1) {
      const ids = new Set<string>()
      pool.forEach((g, i) => { if (mask & (1 << i)) g.narratorIds.forEach((id) => ids.add(id)) })
      if (setEq([...ids], row.narrators)) { s1 = 'exact'; v.s1Groups = [...ids]; break }
      if ([...ids].some((id) => row.narrators.includes(id))) overlap = true
    }
    if (s1 !== 'exact') {
      const inside = pool.find((g) => row.narrators.every((n) => g.narratorIds.includes(n)))
      if (inside) { s1 = 'inside'; v.s1Groups = inside.narratorIds }
      else if (overlap) s1 = 'partial'
    }
  }
  const covered = row.narrators.filter((n) => s2Covers.has(n))
  v.s2Confirmed = row.narrators.filter((n) => s2CanConfirm(n) && s2Confirms(row, n))
  // Farsh: the books list every difference of a reader, so silence is a conflict. Usul: the books state rules only
  // at some words (Hamza's book has 327 ترك الغنة rows, the database 1,119), so silence proves nothing; only a record
  // about the word that names a different rule counts as a conflict.
  v.s2Missing = covered.filter((n) => !s2Confirms(row, n) && (row.kind === 'variant' || s2Records(row, n).length > 0))
  // explanation text the book gives for this entry (first confirming record), kept for the details section
  const firstConfirm = row.narrators.flatMap((n) => s2Records(row, n)).find((r) => r.explain)
  if (firstConfirm) v.s2Explain = firstConfirm.explain

  if ((s1 === 'exact' || s1 === 'inside') && v.s2Confirmed.length > 0 && v.s2Missing.length === 0) return { ...v, tier: 'A2', reason: `S1 matches; S2 books confirm ${v.s2Confirmed.length} narrator(s)` }
  if ((s1 === 'exact' || s1 === 'inside') && v.s2Missing.length === 0) return { ...v, tier: 'A1', reason: 'S1 matches; the books are silent on these readers at this word (usul rules are not listed word by word)' }
  if (s1 !== 'exact' && s1 !== 'inside' && v.s2Confirmed.length === row.narrators.length && v.s2Missing.length === 0) return { ...v, tier: 'A-S2', reason: s1 === 'none' ? 'S1 silent; S2 confirms every narrator' : 'S1 differs; S2 confirms every narrator' }
  if (s1 !== 'none' || v.s2Confirmed.length > 0) return { ...v, tier: 'B', reason: `sources disagree (S1 ${s1}; S2 missing: ${v.s2Missing.join(',') || 'none'})` }
  return { ...v, reason: s1 === 'none' ? 'no source documents this word' : 'unclear' }
}

export function parseArgs(argv = process.argv.slice(2)) {
  let s2Path = 'artifacts/s2-index-v2.json'
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--s2') {
      if (argv[i + 1]) {
        s2Path = argv[i + 1]
        i++
      }
    } else {
      positional.push(argv[i])
    }
  }
  if (positional[2] && s2Path === 'artifacts/s2-index-v2.json') {
    s2Path = positional[2]
  }
  return { input: positional[0], outPrefix: positional[1], s2Path }
}

export function main() {
  const { input, outPrefix, s2Path } = parseArgs()
  if (!input || !outPrefix) {
    console.error('Usage: npx tsx scripts/qiraat/auto-review-live.ts <input.json> <outPrefix> [--s2 <path>]')
    process.exit(1)
  }
  if (s2Path) {
    loadS2(s2Path)
  }
  const rows = readJson<Row[]>(join(ROOT, input))
  const ps = rows.map((r) => r.page)
  const pages = [...new Set([Math.min(...ps) - 1, ...ps, Math.max(...ps) + 1])].filter((p) => p >= 1 && p <= 604)
  const verdicts = rows.map((r) => judge(r, pages))
  const count = (f: (v: Verdict) => boolean) => verdicts.filter(f).length
  const tiers: Tier[] = ['A2', 'A-S2', 'A1', 'B', 'C', 'skip']
  const summary = {
    rows: rows.length, tiers: Object.fromEntries(tiers.map((t) => [t, count((v) => v.tier === t)])),
    farshSubCategories: Object.fromEntries([...new Set(verdicts.filter((v) => v.kind === 'variant').map((v) => v.subCategory))].map((s) => [s, count((v) => v.kind === 'variant' && v.subCategory === s)])),
    farshSubCategoryDisagreesWithDb: count((v) => v.subCategoryAgreesWithDb === false),
    reasonsC: Object.fromEntries([...new Set(verdicts.filter((v) => v.tier === 'C').map((v) => v.reason))].map((r) => [r, count((v) => v.tier === 'C' && v.reason === r)])),
  }
  writeFileSync(join(ROOT, `${outPrefix}.json`), JSON.stringify({ summary, verdicts }, null, 2))
  console.log(JSON.stringify(summary, null, 2))

  console.log('\nPer-page tier counts:')
  const sortedPages = [...new Set(verdicts.map((v) => v.page))].sort((a, b) => a - b)
  for (const p of sortedPages) {
    const pageVs = verdicts.filter((v) => v.page === p)
    const breakdown = tiers
      .map((t) => `${t}: ${pageVs.filter((v) => v.tier === t).length}`)
      .join(', ')
    console.log(`Page ${p}: ${breakdown}`)
  }
}

if (process.argv[1] && process.argv[1].includes('auto-review-live')) {
  main()
}
