// Pilot DRY-RUN of the automatic Qiraat review (nquran.com reference vs. the recorded entries).
// Writes NOTHING to any database: it only reads the fixture snapshot and the nquran reference files
// and prints a per-entry verdict (tier A / B / C) and a derived category + sub-category.
//
//   npx tsx scripts/qiraat/auto-review-pilot.ts 1 10        # pages 1..10
//
// Tiers (see docs/qiraat/AUTO_REVIEW_PLAN.md):
//   A  every narrator set the source documents at this word equals the entry's narrator set, and the
//      entry has a category + sub-category           -> would be approved as «معتمد آليًا»
//   B  the source documents the word but the narrator sets differ (extra / missing narrators)
//                                                    -> would be corrected, then approved
//   C  the source does not document this word (or a reader label is unresolved) -> left for a human

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  findNquranDifferencesForWord,
  resolveDifferenceGroups,
  type NquranAyahEntry,
} from '../../src/app/mushaf-1441/review/_lib/nquranReference'

type Tier = 'A' | 'B' | 'C'
const ROOT = join(__dirname, '..', '..')

const pad = (n: number, w = 3) => String(n).padStart(w, '0')
const readJson = <T,>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T

// ---------- sub-category for a farsh variant, derived from the two spellings only -------------
const MARKS = /[ً-ٰٟۖ-ۭـ]/g
const skeleton = (s: string) =>
  s.replace(MARKS, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, '')

export function farshSubCategory(hafs: string, variant: string): { code: string; basis: string } {
  const a = skeleton(hafs)
  const b = skeleton(variant)
  if (a === b) return { code: 'تشكيل', basis: 'same letters, different vowels' }
  if (a.length === b.length) {
    const diff = [...a].filter((c, i) => c !== b[i]).length
    if (diff === 1) return { code: 'حرف', basis: 'one letter replaced' }
    const sortedA = [...a].sort().join('')
    const sortedB = [...b].sort().join('')
    if (sortedA === sortedB) return { code: 'تقديم وتأخير', basis: 'same letters, different order' }
    return { code: 'أخرى', basis: `${diff} letters differ` }
  }
  if (b.length > a.length && b.includes(a)) return { code: 'زيادة', basis: 'variant contains the Hafs letters plus more' }
  if (a.length > b.length && a.includes(b)) return { code: 'حذف', basis: 'variant lacks some Hafs letters' }
  if (b.length > a.length) return { code: 'زيادة', basis: 'longer, not a clean superset' }
  return { code: 'حذف', basis: 'shorter, not a clean subset' }
}

interface Variant {
  id: string; surah: number; ayah: number; startToken: number; endToken: number
  hafsText: string; variantText: string; differenceType: string | null
  readingIds: string[]; verificationStatus: string
}
interface Ruling {
  id: string; category: string; categoryAr: string; surah: number; ayah: number
  startToken: number; endToken: number; baseText: string; verificationStatus: string
  readings: { readingId: string }[]
}
interface WordsPage { lines: { words: { surahNumber: number; ayahNumber: number; wordIndexInAyah: number; textUthmani: string; charTypeName: string }[] }[] }

const nquranCache = new Map<number, NquranAyahEntry[]>()
const nquranFor = (surah: number): NquranAyahEntry[] => {
  let v = nquranCache.get(surah)
  if (!v) {
    v = readJson<NquranAyahEntry[]>(join(ROOT, 'src/app/mushaf-1441/review/_lib/reference/nquran', `surah-${pad(surah)}.json`))
    nquranCache.set(surah, v)
  }
  return v
}

// A whole ayah's words (the nquran matcher needs them to find the right occurrence).
const ayahWordsCache = new Map<string, { word: number; text: string }[]>()
function ayahWords(surah: number, ayah: number, pages: number[]): { word: number; text: string }[] {
  const key = `${surah}:${ayah}`
  const hit = ayahWordsCache.get(key)
  if (hit) return hit
  const words: { word: number; text: string }[] = []
  for (const p of pages) {
    const d = readJson<WordsPage>(join(ROOT, 'packages/quran-data/mushaf1441/fixtures/page-words', `page-${pad(p)}.json`))
    for (const line of d.lines) for (const w of line.words) {
      if (w.surahNumber === surah && w.ayahNumber === ayah && w.charTypeName === 'word') words.push({ word: w.wordIndexInAyah, text: w.textUthmani })
    }
  }
  words.sort((x, y) => x.word - y.word)
  ayahWordsCache.set(key, words)
  return words
}

const setEq = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x))

interface Verdict {
  id: string; kind: 'farsh' | 'usul'; page: number; ref: string; word: string
  tier: Tier; reason: string
  category: string; subCategory: string
  entryNarrators: string[]; sourceGroupNarrators: string[]
  humanApproved: boolean
}

function judge(args: {
  id: string; kind: 'farsh' | 'usul'; page: number; surah: number; ayah: number; token: number; word: string
  narrators: string[]; category: string; subCategory: string; status: string; pages: number[]
}): Verdict {
  const { surah, ayah, token, word, narrators } = args
  const base: Verdict = {
    id: args.id, kind: args.kind, page: args.page, ref: `${surah}:${ayah}:${token}`, word,
    tier: 'C', reason: '', category: args.category, subCategory: args.subCategory,
    entryNarrators: narrators, sourceGroupNarrators: [], humanApproved: args.status === 'VERIFIED' || args.status === 'PUBLISHED',
  }
  if (!args.category || !args.subCategory) return { ...base, reason: 'missing category or sub-category' }

  const entry = nquranFor(surah).find((e) => e.ayah === ayah)
  if (!entry || entry.differences.length === 0) return { ...base, reason: 'source documents no difference in this ayah' }
  const words = ayahWords(surah, ayah, args.pages)
  const diffs = findNquranDifferencesForWord(entry.differences, word, { wordIndex: token, ayahWords: words })
  if (diffs.length === 0) return { ...base, reason: 'source does not document this word' }

  const groups = diffs.flatMap((d) => resolveDifferenceGroups(d)).filter((g) => g.unresolvedLabels.length === 0 && g.narratorIds.length > 0)
  if (groups.length === 0) return { ...base, reason: 'source reader labels unresolved' }
  // An entry's narrators can be one source group or the union of several (e.g. wasl + waqf groups).
  // Subsets of up to 10 groups are tried; the entry is compared as a set, order does not matter.
  const pool = groups.slice(0, 10)
  let best: { ids: string[]; jaccard: number; exact: boolean } | null = null
  for (let mask = 1; mask < 1 << pool.length; mask += 1) {
    const ids = new Set<string>()
    pool.forEach((g, i) => { if (mask & (1 << i)) g.narratorIds.forEach((id) => ids.add(id)) })
    const union = [...ids]
    const inter = union.filter((id) => narrators.includes(id)).length
    const jaccard = inter / (union.length + narrators.length - inter)
    const exact = setEq(union, narrators)
    if (!best || (exact && !best.exact) || (exact === best.exact && jaccard > best.jaccard)) best = { ids: union, jaccard, exact }
  }
  if (best?.exact) return { ...base, tier: 'A', reason: 'narrator set equals a source group (or a union of groups)', sourceGroupNarrators: best.ids }
  if (best && best.jaccard > 0) return { ...base, tier: 'B', reason: 'narrators differ from the closest source groups', sourceGroupNarrators: best.ids }
  return { ...base, reason: 'source groups share no narrator with this entry' }
}

function main() {
  const from = Number(process.argv[2] ?? 1)
  const to = Number(process.argv[3] ?? 10)
  const verdicts: Verdict[] = []
  const pageRange = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  // an ayah can spill onto the next/previous page: look at one page either side for its words
  const wordPages = [Math.max(1, from - 1), ...pageRange, Math.min(604, to + 1)]

  for (const p of pageRange) {
    const variants = readJson<Variant[]>(join(ROOT, 'packages/qiraat-core/fixtures/pages', `page-${pad(p)}.json`))
    const rulings = readJson<Ruling[]>(join(ROOT, 'packages/qiraat-core/fixtures/rulings', `page-${pad(p)}.json`))
    for (const v of variants) {
      const sub = farshSubCategory(v.hafsText, v.variantText)
      verdicts.push(judge({
        id: v.id, kind: 'farsh', page: p, surah: v.surah, ayah: v.ayah, token: v.startToken, word: v.hafsText,
        narrators: v.readingIds, category: 'فرش', subCategory: sub.code, status: v.verificationStatus, pages: wordPages,
      }))
    }
    for (const r of rulings) {
      verdicts.push(judge({
        id: r.id, kind: 'usul', page: p, surah: r.surah, ayah: r.ayah, token: r.startToken, word: r.baseText,
        narrators: r.readings.map((x) => x.readingId), category: 'أصول', subCategory: r.category, status: r.verificationStatus, pages: wordPages,
      }))
    }
  }

  const count = (f: (v: Verdict) => boolean) => verdicts.filter(f).length
  const summary = {
    pages: `${from}-${to}`, total: verdicts.length,
    farsh: count((v) => v.kind === 'farsh'), usul: count((v) => v.kind === 'usul'),
    tierA: count((v) => v.tier === 'A'), tierB: count((v) => v.tier === 'B'), tierC: count((v) => v.tier === 'C'),
    humanApprovedInFixtures: count((v) => v.humanApproved),
    byReasonC: Object.fromEntries(
      [...new Set(verdicts.filter((v) => v.tier === 'C').map((v) => v.reason))].map((r) => [r, count((v) => v.tier === 'C' && v.reason === r)]),
    ),
    farshSubCategories: Object.fromEntries(
      [...new Set(verdicts.filter((v) => v.kind === 'farsh').map((v) => v.subCategory))].map((s) => [s, count((v) => v.kind === 'farsh' && v.subCategory === s)]),
    ),
  }
  mkdirSync(join(ROOT, 'artifacts'), { recursive: true })
  const out = join(ROOT, 'artifacts', `qiraat-auto-review-pilot-p${from}-${to}.json`)
  writeFileSync(out, JSON.stringify({ summary, verdicts }, null, 2))
  console.log(JSON.stringify(summary, null, 2))
  console.log('wrote', out)
}

main()
