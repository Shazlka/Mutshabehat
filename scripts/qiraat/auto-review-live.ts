// DRY-RUN of the automatic Qiraat review on LIVE rows (exported from a restored database dump).
// Writes nothing. Usage:
//   npx tsx scripts/qiraat/auto-review-live.ts artifacts/live-p19-28.json artifacts/qiraat-auto-review-live-p19-28
//
// Sources: S1 = nquran.com reference files; S2 = per-reader book extractions (artifacts/s2-index.json,
// built from Hamza/qaloon/ebn_katheer/warsh CSVs). See docs/qiraat/AUTO_REVIEW_PLAN.md §3 for the table.
// Entries already approved (status reviewed) are never judged: they are listed as "skipped".

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
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
const SUB_AR: Record<string, string> = { vowel: 'تشكيل', consonant: 'إبدال حرف', addition: 'زيادة', omission: 'حذف', word_form: 'تقديم وتأخير', other: 'أخرى' }

interface Row {
  id: string; kind: 'variant' | 'ruling'; status: string; device_id: string | null; page: number
  surah: number; ayah: number; word: number; end_word: number | null; base_text: string
  reading_text: string | null; variant_type: string | null; category_code: string | null; narrators: string[]
}
interface S2 { byPosition: Record<string, string[]>; byWord: Record<string, string[]>; covers: string[] }
interface WordsPage { lines: { words: { surahNumber: number; ayahNumber: number; wordIndexInAyah: number; textUthmani: string; charTypeName: string }[] }[] }

const s2 = readJson<S2>(join(ROOT, 'artifacts/s2-index.json'))
const s2Covers = new Set(s2.covers.filter((n) => n !== 'Q01-R02')) // warsh.csv is partial: can confirm, silence proves nothing
const s2CanConfirm = (n: string) => s2.covers.includes(n)
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

type Tier = 'A2' | 'A1' | 'A-S2' | 'B' | 'C' | 'skip'
interface Verdict { id: string; kind: string; page: number; ref: string; word: string; tier: Tier; reason: string; category: string; subCategory: string; subCategoryAgreesWithDb: boolean | null; narrators: string[]; s1Groups: string[]; s2Confirmed: string[]; s2Missing: string[] }

function s2Confirms(row: Row, narrator: string): boolean {
  const end = row.end_word ?? row.word
  for (let w = row.word; w <= end; w += 1) if (s2.byPosition[`${row.surah}:${row.ayah}:${w}`]?.includes(narrator)) return true
  return row.base_text.split(/\s+/).some((t) => s2.byWord[`${row.surah}:${row.ayah}:${skeleton(t)}`]?.includes(narrator))
}

function judge(row: Row, pages: number[]): Verdict {
  const isVariant = row.kind === 'variant'
  const sub = isVariant ? farshSubCategory(row.base_text, row.reading_text ?? row.base_text) : row.category_code ?? ''
  const v: Verdict = {
    id: row.id, kind: row.kind, page: row.page, ref: `${row.surah}:${row.ayah}:${row.word}`, word: row.base_text, tier: 'C', reason: '',
    category: isVariant ? 'فرش' : 'أصول', subCategory: isVariant ? SUB_AR[sub] : sub,
    subCategoryAgreesWithDb: isVariant ? (row.variant_type ? row.variant_type === sub : null) : null,
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
  v.s2Missing = covered.filter((n) => !s2Confirms(row, n))

  if ((s1 === 'exact' || s1 === 'inside') && v.s2Confirmed.length > 0 && v.s2Missing.length === 0) return { ...v, tier: 'A2', reason: `S1 matches; S2 confirms ${covered.length} narrator(s)` }
  if ((s1 === 'exact' || s1 === 'inside') && v.s2Confirmed.length === 0 && covered.length === 0) return { ...v, tier: 'A1', reason: 'S1 matches; no second source covers these readers yet' }
  if (s1 !== 'exact' && s1 !== 'inside' && v.s2Confirmed.length === row.narrators.length && v.s2Missing.length === 0) return { ...v, tier: 'A-S2', reason: s1 === 'none' ? 'S1 silent; S2 confirms every narrator' : 'S1 differs; S2 confirms every narrator' }
  if (s1 !== 'none' || v.s2Confirmed.length > 0) return { ...v, tier: 'B', reason: `sources disagree (S1 ${s1}; S2 missing: ${v.s2Missing.join(',') || 'none'})` }
  return { ...v, reason: s1 === 'none' ? 'no source documents this word' : 'unclear' }
}

function main() {
  const [input, outPrefix] = [process.argv[2], process.argv[3]]
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
}
main()
