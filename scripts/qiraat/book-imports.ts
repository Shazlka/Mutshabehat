// Phase 4b: generate conservative book-only imports from proven Mushaf anchors. Files only.
// Usage: npx tsx scripts/qiraat/book-imports.ts <live.json> <reanchor.json> <original.csv> <outDir>

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, isAbsolute, join, resolve } from 'node:path'
import type { NquranAyahEntry } from '../../src/app/mushaf-1441/review/_lib/nquranReference'
import { findNquranDifferencesForWord, resolveDifferenceGroups } from '../../src/app/mushaf-1441/review/_lib/nquranReference'
import { sameFamily, skeleton } from './auto-review-live'
import {
  hasCompatibleWordCount,
  hasPlausibleEditDistance,
  hasRealReadingDifference,
  isCleanArabicReading,
  stripTatweel,
} from './farsh-additions'
import { usableBookExplanation } from './explanations'
import { BOOK_TYPE_TO_VARIANT_TYPE } from './subcategory'
import { loadMushafIndex, type MushafIndex, type ReanchoredBookRow, type SourceBookRecord } from './reanchor'
import type { AyahWord, BookRecord, LiveEntry } from './match-sources'

const ROOT = join(__dirname, '..', '..')
const FARSH_TYPES = new Set(['HARAKAH', 'LETTER', 'ADDITION', 'OMISSION', 'OTHER'])
const RULE_TYPES = new Set(['IMALAH', 'TAGHLIDH_LAM', 'YAAT_IDAFAH', 'YAAT_ZAWAID', 'HA_SAKT', 'HAMZ', 'IDGHAM', 'WAQF', 'ISHMAM'])
const RULE_NAMES = new Set(['اماله', 'تغليظاللام', 'ياءالاضافه', 'ياءاتالاضافه', 'ياءالزوائد', 'ياءاتالزوائد', 'هاءالسكت', 'همز', 'ادغام', 'وقف', 'اشمام'])

export interface BookEvidence {
  src: string
  row: number
  srcPage?: string | number
  original: { surah: number; ayah: number; w0: number | null; w1: number | null }
  reanchorMethod: string
  partialPhrase?: true
}

export interface ImportNarrator { id: string; action: string; wajhOrder: number; wajhNote: string | null }
export interface BookImport {
  key: string
  kind: 'farsh' | 'usul'
  page: number
  surah: number
  ayah: number
  w0: number
  w1: number
  readingText?: string
  variantType?: string
  categoryCode?: string
  rulingText?: string
  narrators: ImportNarrator[]
  evidence: BookEvidence[]
  nquranConfirms: boolean
  payload: Record<string, unknown>
}

export interface QueueItem {
  src: string
  row: number
  ref: string
  type: string
  reason: string
  detail?: string
}

const normalize = (value: string) => skeleton(value).replace(/[^\p{Letter}]/gu, '')
const letterCount = (value: string) => [...value].filter((char) => /\p{Letter}/u.test(char)).length
const cleanSpaces = (value: string) => value.replace(/ـ/g, '').replace(/\s+/g, ' ').trim()
const firstSentence = (value: string) => value.split(/(?<=[.!؟؛])\s|\r?\n/u)[0]?.trim() || value.trim()
export function actionText(value: string): string {
  const clean = cleanSpaces(value)
  return clean.length <= 200 ? clean : firstSentence(clean).slice(0, 200).trim()
}

const READER_NAMES: readonly { names: string[]; ids: string[] }[] = [
  { names: ['قالون'], ids: ['Q01-R01'] }, { names: ['ورش'], ids: ['Q01-R02'] },
  { names: ['نافع'], ids: ['Q01-R01', 'Q01-R02'] }, { names: ['قنبل'], ids: ['Q02-R02'] },
  { names: ['البزي'], ids: ['Q02-R01'] }, { names: ['ابن كثير', 'لأبي معبد'], ids: ['Q02-R01', 'Q02-R02'] },
  { names: ['السوسي'], ids: ['Q03-R02'] }, { names: ['أبو عمرو', 'ابي عمرو'], ids: ['Q03-R01', 'Q03-R02'] },
  { names: ['هشام'], ids: ['Q04-R01'] }, { names: ['ابن ذكوان'], ids: ['Q04-R02'] },
  { names: ['ابن عامر'], ids: ['Q04-R01', 'Q04-R02'] }, { names: ['شعبة'], ids: ['Q05-R01'] },
  { names: ['خلاد'], ids: ['Q06-R02'] }, { names: ['حمزة'], ids: ['Q06-R01', 'Q06-R02'] },
  { names: ['أبو الحارث', 'ابي الحارث'], ids: ['Q07-R01'] }, { names: ['الكسائي'], ids: ['Q07-R01', 'Q07-R02'] },
  { names: ['أبو جعفر', 'ابي جعفر'], ids: ['Q08-R01', 'Q08-R02'] },
  { names: ['رويس'], ids: ['Q09-R01'] }, { names: ['روح'], ids: ['Q09-R02'] }, { names: ['يعقوب'], ids: ['Q09-R01', 'Q09-R02'] },
  { names: ['إسحاق', 'اسحاق'], ids: ['Q10-R01'] }, { names: ['إدريس', 'ادريس'], ids: ['Q10-R02'] },
  { names: ['خلف العاشر'], ids: ['Q10-R01', 'Q10-R02'] },
  { names: ['الدوري'], ids: ['Q03-R01', 'Q07-R02'] }, { names: ['ضرير'], ids: ['OTHER'] },
]

export function detectsMultipleReaders(record: Pick<BookRecord, 'n' | 'explain'>): boolean {
  const explain = normalize(record.explain ?? '')
  if (!explain) return false
  const own = new Set(record.n)
  return READER_NAMES.some(({ names, ids }) => names.some((name) => explain.includes(normalize(name))) && !ids.some((id) => own.has(id)))
}

function categoryCounts(entries: readonly LiveEntry[]): Map<string, Set<string>> {
  const output = new Map<string, Set<string>>()
  for (const entry of entries) if (entry.category_code) for (const authority of entry.authorities) {
    const set = output.get(authority.id) ?? new Set<string>()
    set.add(entry.category_code)
    output.set(authority.id, set)
  }
  return output
}

const includesAll = (sets: Map<string, Set<string>>, narrators: readonly string[], code: string) =>
  narrators.length > 0 && narrators.every((id) => sets.get(id)?.has(code))

/** Deterministic Phase 4b category table. Returning null is an intentional human-queue decision. */
export function categoryForRecord(
  record: Pick<BookRecord, 'type' | 'explain' | 'n'>,
  existingByNarrator: Map<string, Set<string>>,
  allowedCodes: ReadonlySet<string>,
): string | null {
  const type = record.type.toUpperCase()
  const explain = normalize(record.explain ?? '')
  let code: string | null = ({ IMALAH: 'IMALAH_TAQLIL', TAGHLIDH_LAM: 'TAGHLIZ_LAM',
    YAAT_IDAFAH: 'YAAT_IDAFA', YAAT_ZAWAID: 'YAAT_ZAWAID' } as Record<string, string>)[type] ?? null
  if (type === 'HA_SAKT' && explain.includes(normalize('هاء السكت'))) code = 'USUL_SAKT'
  if (type === 'IDGHAM') {
    if (explain.includes(normalize('الإدغام الكبير'))) code = 'IDGHAM_KABIR'
    else if (explain.includes(normalize('الإدغام الصغير'))) code = 'IDGHAM_SAGHIR'
    else if (explain.includes(normalize('التنوين')) && explain.includes(normalize('بغير غنة'))) code = 'TARK_GHUNNA'
  }
  if (type === 'WAQF' && explain.includes(normalize('وقف')) &&
      (explain.includes(normalize('حمزة')) || explain.includes(normalize('هشام')))) code = 'WAQF_HAMZA'
  if (type === 'HAMZ') {
    if (explain.includes(normalize('وقف حمزة')) || explain.includes(normalize('وقف هشام'))) code = 'WAQF_HAMZA'
    else if (explain.includes(normalize('تسهيل'))) {
      if (includesAll(existingByNarrator, record.n, 'USUL_TASHIL')) code = 'USUL_TASHIL'
      else if (includesAll(existingByNarrator, record.n, 'TAGHYIR_HAMZ')) code = 'TAGHYIR_HAMZ'
    } else if (explain.includes(normalize('إبدال الهمزة')) && includesAll(existingByNarrator, record.n, 'TAGHYIR_HAMZ')) code = 'TAGHYIR_HAMZ'
  }
  return code && allowedCodes.has(code) ? code : null
}

export function garbageReason(record: Pick<BookRecord, 'text' | 'explain'>, farsh: boolean): string | null {
  const text = cleanSpaces(record.text ?? '')
  const explain = cleanSpaces(record.explain ?? '')
  if (letterCount(text) < 4 || letterCount(explain) < 4) return 'GARBAGE_SHORT'
  if (farsh && (!isCleanArabicReading(text) || /[A-Za-z0-9]|[^\p{Script=Arabic}\p{Mark}\p{Letter}\s]/u.test(stripTatweel(text)))) return 'GARBAGE_READING'
  if (!usableBookExplanation({ ...record } as BookRecord) || RULE_NAMES.has(normalize(explain))) return 'RULE_NAME_ONLY'
  return null
}

function overlaps(entry: LiveEntry, row: ReanchoredBookRow): boolean {
  const record = row.correctedRecord!
  return entry.surah === record.surah && entry.ayah === record.ayah && entry.word <= record.w1! && (entry.end_word ?? entry.word) >= record.w0!
}
const narratorIds = (entry: LiveEntry) => entry.authorities.map((authority) => authority.id)

function quranText(mushaf: MushafIndex, surah: number, ayah: number, w0: number, w1: number): string {
  return (mushaf.ayahWords.get(`${surah}:${ayah}`) ?? []).filter((word) => word.word >= w0 && word.word <= w1).map((word) => word.text).join(' ')
}

function provenance(record: SourceBookRecord): string {
  const page = String(record.srcPage ?? '').trim()
  const reader = record.n.map((id) => BOOK_NAMES[id] ?? id).filter((value, index, all) => all.indexOf(value) === index).join('، ')
  return `[المصدر: كتاب ${reader}${page ? ` ص${page}` : ''}]`
}

const BOOK_NAMES: Readonly<Record<string, string>> = {
  'Q01-R01': 'قالون', 'Q01-R02': 'ورش', 'Q02-R01': 'ابن كثير', 'Q02-R02': 'ابن كثير',
  'Q03-R01': 'الدوري', 'Q03-R02': 'السوسي', 'Q04-R01': 'ابن عامر', 'Q04-R02': 'ابن عامر',
  'Q05-R01': 'شعبة', 'Q06-R01': 'حمزة', 'Q06-R02': 'حمزة', 'Q07-R01': 'الكسائي', 'Q07-R02': 'الكسائي',
  'Q08-R01': 'أبو جعفر', 'Q08-R02': 'أبو جعفر', 'Q09-R01': 'يعقوب', 'Q09-R02': 'يعقوب',
  'Q10-R01': 'خلف العاشر', 'Q10-R02': 'خلف العاشر',
}

function evidence(row: ReanchoredBookRow): BookEvidence {
  const record = row.record as BookRecord & { srcPage?: string | number }
  return { src: record.src, row: record.row, ...(record.srcPage ? { srcPage: record.srcPage } : {}),
    original: { surah: record.surah, ayah: record.ayah, w0: record.w0, w1: record.w1 },
    reanchorMethod: row.reanchor.method, ...(row.reanchor.partialPhrase ? { partialPhrase: true } : {}) }
}

function atWordNquranNarrators(record: BookRecord, mushaf: MushafIndex, cache: Map<number, NquranAyahEntry[]>): Set<string> {
  let surah = cache.get(record.surah)
  if (!surah) {
    surah = JSON.parse(readFileSync(join(ROOT, 'src/app/mushaf-1441/review/_lib/reference/nquran', `surah-${String(record.surah).padStart(3, '0')}.json`), 'utf8')) as NquranAyahEntry[]
    cache.set(record.surah, surah)
  }
  const ayah = surah.find((item) => item.ayah === record.ayah)
  const words = mushaf.ayahWords.get(`${record.surah}:${record.ayah}`) ?? []
  const word = words.find((item) => item.word === record.w0)
  const ids = new Set<string>()
  if (!ayah || !word) return ids
  for (const difference of findNquranDifferencesForWord(ayah.differences, word.text, { wordIndex: word.word, ayahWords: words })) {
    for (const group of resolveDifferenceGroups(difference)) if (group.unresolvedLabels.length === 0) for (const id of group.narratorIds) ids.add(id)
  }
  return ids
}

interface Preliminary { row: ReanchoredBookRow; record: SourceBookRecord; narrators: string[]; categoryCode?: string; readingText?: string }


// ---- Orchestrator guards (added after review: books are OCR extractions) -------------------------------------
const LETTER_NAMES: Record<string, string> = {
  'الباء': 'ب', 'التاء': 'ت', 'الثاء': 'ث', 'الجيم': 'ج', 'الحاء': 'ح', 'الخاء': 'خ', 'الدال': 'د', 'الذال': 'ذ', 'الراء': 'ر',
  'الزاي': 'ز', 'السين': 'س', 'الشين': 'ش', 'الصاد': 'ص', 'الضاد': 'ض', 'الطاء': 'ط', 'الظاء': 'ظ', 'العين': 'ع', 'الغين': 'غ',
  'الفاء': 'ف', 'القاف': 'ق', 'الكاف': 'ك', 'اللام': 'ل', 'الميم': 'م', 'النون': 'ن', 'الهاء': 'ه', 'الواو': 'و', 'الياء': 'ي',
}
const lettersOnly = (value: string) => skeleton(value).replace(/[^\u0621-\u064A]/g, '')

/** A rule row (imalah, hamz, …) leaves the spelling alone, so the reader's text must be the same word as the Hafs word.
 *  A row whose text is another word (or a phrase) was attached to the wrong Hafs word by the extraction. */
export function sameWordAsHafs(text: string, hafs: string): boolean {
  const t = lettersOnly(text ?? ''), h = lettersOnly(hafs ?? '')
  if (!t || !h) return false
  return t === h || t.replace(/ا/g, '') === h.replace(/ا/g, '') || t.includes(h) || h.includes(t)
}

/** An imalah explanation that names a letter («إمالة فتحة الجيم والألف») must name a letter the word really has. */
export function imalahLetterConsistent(explain: string, hafs: string): boolean {
  const match = /فتحة\s+(\S+)\s+و/.exec(explain ?? '')
  if (!match || !(match[1] in LETTER_NAMES)) return true
  const letter = LETTER_NAMES[match[1]]
  const word = lettersOnly(hafs)
  return word.includes(letter) || (letter === 'ي' && /ى/.test(hafs))
}

/** An explanation that quotes a vocalised word («… في لبثتم، وإمالة أَزْكَى», «مع الإمالة (آتَانِ)») talks about that word:
 *  every quoted word (two or more harakat) must be the Hafs word or part of it, otherwise the row belongs to another word. */
export function explanationNamesOtherWord(explain: string, hafs: string): boolean {
  const word = lettersOnly(hafs ?? '')
  if (!word) return false
  const quoted = (explain ?? '').split(/[\s،؛:.()\[\]«»\-–—]+/).filter((token) => (token.match(/[\u064B-\u0652]/g) ?? []).length >= 2)
  return quoted.some((token) => {
    const letters = lettersOnly(token)
    return letters.length >= 3 && !(word === letters || word.includes(letters) || letters.includes(word))
  })
}

/** Hamz/tashil rules only make sense on a word that has a hamza (or a madda). */
export function wordHasHamza(hafs: string): boolean {
  return /[ءأإؤئٔآ]/.test(hafs ?? '')
}

export function buildBookImports(
  entries: readonly LiveEntry[], rows: readonly ReanchoredBookRow[], mushaf: MushafIndex,
  nquranLookup?: (record: BookRecord) => Set<string>,
  options: { allowFarsh?: boolean } = {},
): { imports: BookImport[]; queue: QueueItem[] } {
  const allowedCodes = new Set(entries.map((entry) => entry.category_code).filter((value): value is string => Boolean(value)))
  const byNarrator = categoryCounts(entries)
  const prelim: Preliminary[] = []
  const queue: QueueItem[] = []
  const reject = (row: ReanchoredBookRow, reason: string, detail?: string) => queue.push({ src: row.record.src, row: row.record.row,
    ref: `${row.record.surah}:${row.record.ayah}:${row.record.w0 ?? '?'}`, type: row.record.type, reason, ...(detail ? { detail } : {}) })

  for (const row of rows) {
    if (row.rematchClass === 'AMBIGUOUS') { reject(row, 'REANCHOR_AMBIGUOUS'); continue }
    if (row.rematchClass === 'NOT_FOUND') { reject(row, 'REANCHOR_NOT_FOUND'); continue }
    if (row.rematchClass === 'NO_HAFS') { reject(row, 'REANCHOR_NO_HAFS'); continue }
    if (!['MISSING', 'NARRATORS_MISSING'].includes(row.rematchClass) || !row.correctedRecord) continue
    const record = row.correctedRecord
    const farsh = record.kind === 'farsh' && FARSH_TYPES.has(record.type.toUpperCase())
    const rule = RULE_TYPES.has(record.type.toUpperCase())
    if (!farsh && !rule) { reject(row, 'UNSUPPORTED_TYPE'); continue }
    if (row.ambiguous && !['aligned', 'same-ayah'].includes(row.reanchor.method)) { reject(row, 'PHASE1_AMBIGUOUS'); continue }
    if (row.reanchor.partialPhrase) { reject(row, 'PARTIAL_PHRASE'); continue }
    const garbage = garbageReason(record, farsh)
    if (garbage) { reject(row, garbage); continue }
    if (detectsMultipleReaders(record)) { reject(row, 'MULTI_READER'); continue }
    const narrators = row.rematchClass === 'NARRATORS_MISSING' ? (row.rematch?.missingNarrators ?? []) : record.n
    if (narrators.length === 0) { reject(row, 'NO_NARRATORS'); continue }

    if (farsh) {
      // Book spellings are OCR output and the explanation cannot be checked against them automatically: queue for a person.
      if (!options.allowFarsh) { reject(row, 'FARSH_TEXT_UNVERIFIED'); continue }
    }
    if (farsh) {
      const readingText = cleanSpaces(record.text)
      if (!hasRealReadingDifference(readingText, record.hafs)) { reject(row, 'NO_READING_DIFFERENCE'); continue }
      if (!hasPlausibleEditDistance(readingText, record.hafs)) { reject(row, 'EDIT_DISTANCE'); continue }
      if (!hasCompatibleWordCount(readingText, record.hafs.trim().split(/\s+/).filter(Boolean))) { reject(row, 'WORD_COUNT'); continue }
      const conflict = entries.some((entry) => entry.kind === 'variant' && overlaps(entry, row) && narratorIds(entry).some((id) => narrators.includes(id)))
      if (conflict) { reject(row, 'NARRATOR_ONCE'); continue }
      prelim.push({ row, record, narrators: [...new Set(narrators)], readingText })
      continue
    }

    const categoryCode = categoryForRecord(record, byNarrator, allowedCodes)
    if (!categoryCode) { reject(row, 'NO_CATEGORY'); continue }
    if (!sameWordAsHafs(record.text, record.hafs)) { reject(row, 'WORD_UNVERIFIED'); continue }
    if (explanationNamesOtherWord(record.explain ?? '', record.hafs)) { reject(row, 'EXPLANATION_NAMES_OTHER_WORD'); continue }
    // imalah / hamz rows with no letter named in the explanation cannot be verified from the row itself: need nquran too
    const nqSet = nquranLookup?.(record) ?? new Set<string>()
    const nquranAgrees = narrators.every((id) => nqSet.has(id))
    const namesLetter = /فتحة\s+\S+\s+و/.test(record.explain ?? '')
    if (['IMALAH_TAQLIL', 'TAGHYIR_HAMZ', 'USUL_TASHIL'].includes(categoryCode) && !namesLetter && !nquranAgrees) { reject(row, 'UNVERIFIED_NO_CORROBORATION'); continue }
    if (categoryCode === 'IMALAH_TAQLIL' && !imalahLetterConsistent(record.explain ?? '', record.hafs)) { reject(row, 'LETTER_MISMATCH'); continue }
    if (['TAGHYIR_HAMZ', 'USUL_TASHIL', 'USUL_TAHQIQ', 'WAQF_HAMZA'].includes(categoryCode) && !wordHasHamza(record.hafs)) { reject(row, 'NO_HAMZA_IN_WORD'); continue }
    const contradiction = entries.some((entry) => entry.kind === 'ruling' && overlaps(entry, row) &&
      sameFamily(categoryCode, entry.category_code ?? '') && narratorIds(entry).some((id) => narrators.includes(id)))
    if (contradiction) { reject(row, 'MATCHED_CONTRADICTION'); continue }
    prelim.push({ row, record, narrators: [...new Set(narrators)], categoryCode })
  }

  const groups = new Map<string, Preliminary[]>()
  for (const item of prelim) {
    const base = `${item.record.surah}:${item.record.ayah}:${item.record.w0}:${item.record.w1}`
    const groupKey = item.readingText ? `farsh:${base}:${skeleton(item.readingText)}` : `usul:${base}:${item.categoryCode}`
    const bucket = groups.get(groupKey) ?? []; bucket.push(item); groups.set(groupKey, bucket)
  }

  // Enforce narrator-once across this generated batch as well as against live rows.
  const generatedNarratorGroups = new Map<string, Set<string>>()
  for (const [groupKey, items] of groups) {
    if (!items[0].readingText) continue
    for (const item of items) for (const narrator of item.narrators) {
      for (let word = item.record.w0!; word <= item.record.w1!; word += 1) {
        const collisionKey = `${item.record.surah}:${item.record.ayah}:${word}:${narrator}`
        const groupKeys = generatedNarratorGroups.get(collisionKey) ?? new Set<string>()
        groupKeys.add(groupKey); generatedNarratorGroups.set(collisionKey, groupKeys)
      }
    }
  }
  const conflictingGroups = new Set([...generatedNarratorGroups.values()].filter((values) => values.size > 1).flatMap((values) => [...values]))

  const imports: BookImport[] = []
  for (const [groupKey, items] of groups) {
    if (conflictingGroups.has(groupKey)) {
      for (const item of items) reject(item.row, 'GENERATED_NARRATOR_CONFLICT')
      continue
    }
    const first = items[0]
    const record = first.record
    const narrators = [...new Set(items.flatMap((item) => item.narrators))].sort().map((id) => {
      const source = items.find((item) => item.narrators.includes(id))!.record
      return { id, action: actionText(source.explain ?? ''), wajhOrder: 1, wajhNote: null }
    })
    const ev = items.map((item) => evidence(item.row))
    const page = first.row.reanchor.page ?? Number(record.page)
    const idsAtNquran = nquranLookup?.(record) ?? new Set<string>()
    const nquranConfirms = narrators.every((narrator) => idsAtNquran.has(narrator.id))
    const common = { key: groupKey, page, surah: record.surah, ayah: record.ayah, w0: record.w0!, w1: record.w1!, narrators, evidence: ev, nquranConfirms }
    const notes = `sources: ${ev.map((item) => `${item.src}:${item.row}`).join(' | ')}`
    if (first.readingText) {
      const description = `${cleanSpaces(record.explain ?? '')}\n${provenance(record)}`
      const variantType = BOOK_TYPE_TO_VARIANT_TYPE[record.type.toUpperCase()] ?? 'other'
      const payload = { surah: record.surah, ayah: record.ayah, startWord: record.w0, endAyah: record.ayah, endWord: record.w1,
        kind: 'farsh', readingText: first.readingText, hafsText: quranText(mushaf, record.surah, record.ayah, record.w0!, record.w1!),
        description, performanceNote: null, variantType, notes, deviceId: 'auto-review', narrators }
      imports.push({ ...common, kind: 'farsh', readingText: first.readingText, variantType, payload })
    } else {
      const rulingText = `${cleanSpaces(record.explain ?? '')}\n${provenance(record)}`
      const payload = { surah: record.surah, ayah: record.ayah, startWord: record.w0, endAyah: record.ayah, endWord: record.w1,
        kind: 'usul', categoryCode: first.categoryCode, rulingText, hafsText: quranText(mushaf, record.surah, record.ayah, record.w0!, record.w1!),
        notes, deviceId: 'auto-review', narrators }
      imports.push({ ...common, kind: 'usul', categoryCode: first.categoryCode, rulingText, payload })
    }
  }
  imports.sort((a, b) => a.page - b.page || a.key.localeCompare(b.key))
  queue.sort((a, b) => a.src.localeCompare(b.src) || a.row - b.row)
  return { imports, queue }
}

const sqlEscape = (value: string) => value.replace(/'/g, "''")
export function generateBlockSql(imports: readonly BookImport[], label = 'book imports'): string {
  const lines = [`-- Phase 4b ${label}. Entries are created through the editor RPC, then marked: nquran also lists the same narrators at the`,
    "-- word -> reviewed as 'auto:nquran+book'; otherwise unreviewed (waiting for a person).", 'BEGIN;',
    "SELECT set_config('app.device_id','auto-review',true);", 'CREATE TEMP TABLE _auto_new_ids(id text, approve boolean) ON COMMIT DROP;', '']
  for (const item of imports) lines.push(`INSERT INTO _auto_new_ids(id, approve) SELECT (qiraat_review_create_entry('${sqlEscape(JSON.stringify(item.payload))}'::jsonb))->>'entryId', ${item.nquranConfirms ? 'true' : 'false'};`)
  lines.push('',
    "UPDATE qiraat_entries SET review_status='unreviewed', verification_status='REVIEWED', review_source=NULL, review_note='أُضيف آليًا من كتاب القراءة — بانتظار المراجعة' WHERE id IN (SELECT id FROM _auto_new_ids WHERE NOT approve) AND created_at >= now();",
    "UPDATE qiraat_entries SET review_status='reviewed', verification_status='REVIEWED', review_source='auto:nquran+book', review_note='أُضيف آليًا: طابق كتاب القراءة وnquran.com' WHERE id IN (SELECT id FROM _auto_new_ids WHERE approve) AND created_at >= now();",
    "SELECT count(*) AS generated_entry_count FROM qiraat_entries WHERE id IN (SELECT id FROM _auto_new_ids);", 'COMMIT;', '')
  return lines.join('\n')
}

export function generateRollbackSql(imports: readonly BookImport[], label = 'book imports'): string {
  const payloads = imports.map((item) => `(${item.surah},${item.ayah},${item.w0},${item.w1},'${item.kind}','${sqlEscape(item.readingText ?? '')}','${sqlEscape(item.categoryCode ?? '')}')`).join(',\n    ')
  return [`-- Rollback Phase 4b ${label}: same-day auto-review entries only.`, 'BEGIN;', "SELECT set_config('app.device_id','auto-review',true);",
    'WITH targets(surah,ayah,w0,w1,kind,reading_text,category_code) AS (', payloads ? `  VALUES ${payloads}` : "  SELECT 0,0,0,0,'','','' WHERE false", '), ids AS (',
    '  SELECT e.id FROM targets t JOIN qiraat_loci l ON l.surah_number=t.surah AND l.start_ayah=t.ayah AND l.start_word=t.w0 AND l.end_word=t.w1',
    "  JOIN qiraat_entries e ON e.locus_id=l.id AND e.device_id='auto-review' AND e.created_at>=current_date AND e.deleted_at IS NULL",
    "  LEFT JOIN qiraat_variant_details vd ON vd.entry_id=e.id LEFT JOIN qiraat_ruling_details rd ON rd.entry_id=e.id",
    "  WHERE (t.kind='farsh' AND e.kind='variant' AND vd.reading_text=t.reading_text) OR (t.kind='usul' AND e.kind='ruling' AND rd.category_code=t.category_code)",
    ') UPDATE qiraat_entries SET deleted_at=now() WHERE id IN (SELECT id FROM ids) AND deleted_at IS NULL;', 'COMMIT;', ''].join('\n')
}

export function splitIntoPageBlocks(imports: readonly BookImport[]): Map<string, BookImport[]> {
  const blocks = new Map<string, BookImport[]>()
  for (const item of imports) {
    const start = Math.floor((item.page - 1) / 50) * 50 + 1
    const end = Math.min(start + 49, 604)
    const label = `${String(start).padStart(3, '0')}-${String(end).padStart(3, '0')}`
    const bucket = blocks.get(label) ?? []; bucket.push(item); blocks.set(label, bucket)
  }
  return blocks
}

function seededSamples<T>(values: readonly T[], count: number): T[] {
  let state = 0x6c82f4a1
  return values.map((value) => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return { value, rank: state >>> 0 } })
    .sort((a, b) => a.rank - b.rank).slice(0, count).map((item) => item.value)
}
const md = (value: unknown) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
export function renderSummary(imports: readonly BookImport[], queue: readonly QueueItem[]): string {
  const types = [...new Set(imports.map((item) => item.kind === 'farsh' ? item.variantType! : item.categoryCode!))].sort()
  const books = [...new Set(imports.flatMap((item) => item.evidence.map((e) => e.src)))].sort()
  const reasons = [...new Set(queue.map((item) => item.reason))].sort()
  return `${['# Phase 4b book imports', '', `- Accepted entries: ${imports.length}`, `- Farsh: ${imports.filter((item) => item.kind === 'farsh').length}`,
    `- Usul: ${imports.filter((item) => item.kind === 'usul').length}`, `- nquran confirms: ${imports.filter((item) => item.nquranConfirms).length}`,
    `- Queue rows: ${queue.length}`, '', '## Accepted by type/category', '', '| Type/category | Count |', '|---|---:|',
    ...types.map((type) => `| ${type} | ${imports.filter((item) => (item.variantType ?? item.categoryCode) === type).length} |`), '',
    '## Accepted evidence by book', '', '| Book | Evidence rows | Entries |', '|---|---:|---:|', ...books.map((book) => `| ${md(book)} | ${imports.flatMap((item) => item.evidence).filter((e) => e.src === book).length} | ${imports.filter((item) => item.evidence.some((e) => e.src === book)).length} |`), '',
    '## Queue reasons', '', '| Reason | Count |', '|---|---:|', ...reasons.map((reason) => `| ${reason} | ${queue.filter((item) => item.reason === reason).length} |`), '',
    '## 30 deterministic random accepted samples', '', '| Book row | Anchor | Kind | Entry | Method | nquran |', '|---|---|---|---|---|---|',
    ...seededSamples(imports, 30).map((item) => { const e = item.evidence[0]; return `| ${md(e.src)}:${e.row} | ${item.surah}:${item.ayah}:${item.w0}-${item.w1} | ${item.kind} | ${md(item.readingText ?? `${item.categoryCode}: ${item.rulingText}`)} | ${e.reanchorMethod} | ${item.nquranConfirms ? 'yes' : 'no'} |` }), ''].join('\n')}\n`
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false
  const input = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i += 1 }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = '' }
    else field += char
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row) }
  return rows
}
function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function renderUpdatedCsv(original: string, rows: readonly ReanchoredBookRow[], imports: readonly BookImport[], queue: readonly QueueItem[]): string {
  const parsed = parseCsv(original)
  const headers = parsed[0]
  const bookIndex = headers.indexOf('الكتاب'), rowIndex = headers.indexOf('سطر_الملف')
  const byKey = new Map(rows.map((row) => [`${row.record.src}\u0000${row.record.row}`, row]))
  const imported = new Set(imports.flatMap((item) => item.evidence.map((e) => `${e.src}\u0000${e.row}`)))
  const queued = new Map(queue.map((item) => [`${item.src}\u0000${item.row}`, item]))
  const additions = ['الموضع_الصحيح', 'طريقة_التثبيت', 'الحالة_الآن', 'سبب_الرفض']
  const output = [[...headers, ...additions]]
  for (const line of parsed.slice(1)) {
    const itemKey = `${line[bookIndex]}\u0000${line[rowIndex]}`
    const row = byKey.get(itemKey), q = queued.get(itemKey)
    const anchor = row?.correctedRecord ? `${row.correctedRecord.surah}:${row.correctedRecord.ayah}:${row.correctedRecord.w0}` : ''
    const method = ['not-found', 'no-hafs'].includes(row?.reanchor.method ?? '') ? 'not-found' : row?.reanchor.method ?? ''
    let status = ''
    if (imported.has(itemKey)) status = 'imported'
    else if (q) status = `queued-${q.reason}`
    else if (row?.rematchClass === 'MATCHED_AFTER_REANCHOR') status = 'matched-after-reanchor'
    else if (row?.rematchClass === 'TEXT_CONFLICT') status = 'text-conflict'
    else if (['NOT_FOUND', 'NO_HAFS'].includes(row?.rematchClass ?? '')) status = 'not-found'
    else if (row?.rematchClass) status = row.rematchClass.toLowerCase()
    output.push([...line, anchor, method, status, q ? [q.reason, q.detail].filter(Boolean).join(': ') : ''])
  }
  return `\uFEFF${output.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

const inputPath = (value: string) => isAbsolute(value) ? value : resolve(ROOT, value)
export function main(argv = process.argv.slice(2)): void {
  const [liveArg, reanchorArg, csvArg, outDirArg = 'artifacts'] = argv
  if (!liveArg || !reanchorArg || !csvArg) {
    console.error('Usage: npx tsx scripts/qiraat/book-imports.ts <live.json> <reanchor.json> <original.csv> <outDir>')
    process.exitCode = 1; return
  }
  const entries = JSON.parse(readFileSync(inputPath(liveArg), 'utf8')) as LiveEntry[]
  const rows = (JSON.parse(readFileSync(inputPath(reanchorArg), 'utf8')) as { records: ReanchoredBookRow[] }).records
  const wordsDir = join(ROOT, 'packages/quran-data/mushaf1441/fixtures/page-words')
  const mushaf = loadMushafIndex(wordsDir)
  const cache = new Map<number, NquranAyahEntry[]>()
  const result = buildBookImports(entries, rows, mushaf, (record) => atWordNquranNarrators(record, mushaf, cache))
  const outDir = inputPath(outDirArg); const blocksDir = join(outDir, 'book-imports'); mkdirSync(blocksDir, { recursive: true })
  writeFileSync(join(outDir, 'book-imports.json'), `${JSON.stringify(result.imports, null, 2)}\n`)
  writeFileSync(join(outDir, 'book-imports-queue.json'), `${JSON.stringify(result.queue, null, 2)}\n`)
  const blocks = splitIntoPageBlocks(result.imports)
  const combined: string[] = []
  for (const [label, imports] of blocks) {
    const sql = generateBlockSql(imports, `pages ${label}`); combined.push(sql)
    writeFileSync(join(blocksDir, `blk-${label}.sql`), sql)
    writeFileSync(join(blocksDir, `blk-${label}-rollback.sql`), generateRollbackSql(imports, `pages ${label}`))
  }
  writeFileSync(join(outDir, 'book-imports-v1.sql'), combined.join('\n'))
  const summary = renderSummary(result.imports, result.queue)
  writeFileSync(join(outDir, 'book-imports-summary.md'), summary)
  const originalCsv = readFileSync(inputPath(csvArg), 'utf8')
  writeFileSync(join(ROOT, 'docs/qiraat/gaps-books-not-matched-v2.csv'), renderUpdatedCsv(originalCsv, rows, result.imports, result.queue))
  process.stdout.write(`${summary.split('## 30 deterministic random accepted samples')[0]}Blocks: ${blocks.size}; CSV source: ${basename(csvArg)}\n`)
}

if (process.argv[1]?.includes('book-imports.ts')) main()
