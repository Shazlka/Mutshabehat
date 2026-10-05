// Golden data for the Swift ports of the web review editor's reference logic. It runs the web's own
// TypeScript (through tsx) over the real Mushaf words and reference data and writes what it returned to
// Generated/Review/golden/*.json; the Swift tests assert the ports give the same answers.
//
// Usage (from the repo root, with node_modules available):
//   npx tsx apps/ios/scripts/review_golden.mjs . apps/ios/Generated/Review/golden [section ...]

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [repoArg, outArg, ...only] = process.argv.slice(2)
if (!repoArg || !outArg) {
  console.error('usage: review_golden.mjs REPO OUT_DIR [section ...]')
  process.exit(1)
}
const repo = path.resolve(repoArg)
const out = path.resolve(outArg)
fs.mkdirSync(out, { recursive: true })

const webImport = (rel) => import(pathToFileURL(path.join(repo, rel)).href)
const reviewLib = 'src/app/mushaf-1441/review/_lib/'
const reviewUi = 'src/app/mushaf-1441/review/_components/'
const referenceDir = path.join(repo, reviewLib, 'reference')
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const wants = (name) => only.length === 0 || only.includes(name)

/** Real Mushaf words per page (type "word" only), exactly as the review page lists them. */
function loadPages() {
  const dir = path.join(repo, 'packages/quran-data/mushaf1441/fixtures/page-words')
  const pages = []
  for (let page = 1; page <= 604; page += 1) {
    const file = path.join(dir, `page-${String(page).padStart(3, '0')}.json`)
    const words = []
    for (const line of readJson(file).lines) {
      for (const w of line.words) {
        if (w.charTypeName !== 'word') continue
        words.push({ surah: w.surahNumber, ayah: w.ayahNumber, word: w.wordIndexInAyah, text: w.textUthmani })
      }
    }
    pages.push({ page, words })
  }
  return pages
}

/** Deterministic sample: every word of a few surahs, every 7th word elsewhere. */
function sampleWords(pages) {
  const dense = new Set([1, 2, 36, 112, 113, 114])
  const samples = []
  let counter = 0
  for (const { page, words } of pages) {
    for (const w of words) {
      counter += 1
      if (dense.has(w.surah) || counter % 7 === 0) samples.push({ page, ...w })
    }
  }
  return samples
}

function ayahContext(pageWords, surah, ayah, word) {
  const ayahWords = pageWords
    .filter((w) => w.surah === surah && w.ayah === ayah)
    .map((w) => ({ word: w.word, text: w.text }))
    .sort((a, b) => a.word - b.word)
  return { wordIndex: word, ayahWords }
}

async function nquran(pages) {
  const m = await webImport(`${reviewLib}nquranReference.ts`)
  const readers = await webImport(`${reviewUi}ReaderNarratorSelector.tsx`)
  const byPage = new Map(pages.map((p) => [p.page, p.words]))
  const entryCache = new Map()
  const entriesFor = (surah) => {
    if (!entryCache.has(surah)) {
      entryCache.set(surah, readJson(path.join(referenceDir, 'nquran', `surah-${String(surah).padStart(3, '0')}.json`)))
    }
    return entryCache.get(surah)
  }

  const samples = []
  for (const s of sampleWords(pages)) {
    const entry = m.findNquranEntryForAyah(entriesFor(s.surah), s.ayah)
    if (!entry) { samples.push([s.page, s.surah, s.ayah, s.word, []]); continue }
    const found = m.findNquranDifferencesForWord(entry.differences, s.text, ayahContext(byPage.get(s.page), s.surah, s.ayah, s.word))
    samples.push([s.page, s.surah, s.ayah, s.word, found.map((d) => entry.differences.indexOf(d))])
  }

  const labels = {}
  const groups = {}
  for (let surah = 1; surah <= 114; surah += 1) {
    for (const entry of entriesFor(surah)) {
      entry.differences.forEach((difference, index) => {
        for (const group of difference.groups) for (const label of group.readers) {
          if (!(label in labels)) labels[label] = m.resolveNquranReaderLabel(label)
        }
        groups[`${surah}:${entry.ayah}:${index}`] = m.resolveDifferenceGroups(difference)
          .map((r) => `${r.narratorIds.join(',')}~${r.unresolvedLabels.join(',')}`).join('|')
      })
    }
  }
  fs.writeFileSync(path.join(out, 'nquran.json'), JSON.stringify({
    samples, labels, groups,
    canonical: readers.CANONICAL_READERS, hafsId: readers.HAFS_ID,
    allNarratorIds: m.ALL_NARRATOR_IDS,
  }))
  console.log(`nquran: ${samples.length} samples, ${Object.keys(labels).length} labels, ${Object.keys(groups).length} differences`)
}


// ── seeded randomness so the generated cases are the same on every run ──
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)]
const subset = (rand, list, p) => list.filter(() => rand() < p)
const shuffle = (rand, list) => {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
const ALL_IDS = []
for (let r = 1; r <= 10; r += 1) for (const n of [1, 2]) ALL_IDS.push(`Q${String(r).padStart(2, '0')}-R0${n}`)

async function shamil(pages) {
  const m = await webImport(`${reviewLib}shamilReference.ts`)
  const entries = readJson(path.join(referenceDir, 'shamil', 'surah-002.json'))
  const byPage = new Map(pages.map((p) => [p.page, p.words]))
  const samples = []
  for (const { page, words } of pages) {
    for (const w of words) {
      if (w.surah !== 2) continue
      const ctx = ayahContext(byPage.get(page), w.surah, w.ayah, w.word)
      const found = m.findShamilEntriesForWord(entries, w.ayah, w.text, ctx)
      const withoutCtx = m.findShamilEntriesForWord(entries, w.ayah, w.text)
      samples.push([page, w.surah, w.ayah, w.word, found.map((e) => entries.indexOf(e)), withoutCtx.map((e) => entries.indexOf(e))])
    }
  }
  const groups = entries.map((entry) => m.shamilGroupsForEntry(entry))
  const performance = []
  for (const entry of entries) for (const w of entry.wajhs) {
    performance.push([m.shamilPerformanceText(w.description, w.condition), m.suggestShamilCategory(w)])
  }
  const matchKeys = ['ءَاخِرَة', 'ٱلْـَٔاخِرَةِ', 'مَن', 'مِن', 'إِنَّ', 'أَن', 'وَإِذْ'].map((t) => [t, m.matchKey(t)])
  fs.writeFileSync(path.join(out, 'shamil.json'), JSON.stringify({ samples, groups, performance, matchKeys }))
  console.log(`shamil: ${samples.length} samples, ${entries.length} entries`)
}

async function narrators() {
  const m = await webImport(`${reviewUi}narratorDisplay.ts`)
  const w = await webImport(`${reviewUi}ImalahDetailFields.tsx`)
  const rand = mulberry32(7)
  const names = (id) => (rand() < 0.1 ? '' : `اسم-${id}`)
  const cases = []
  for (let i = 0; i < 1500; i += 1) {
    const ids = shuffle(rand, subset(rand, rand() < 0.1 ? [...ALL_IDS, 'Q99-R01'] : ALL_IDS, 0.3 + rand() * 0.6))
    const list = ids.map((id) => ({ id, nameAr: names(id) }))
    cases.push({ narrators: list, items: m.describeNarratorGroup(list), text: m.describeNarratorGroupText(list) })
  }
  const wajh = []
  for (let i = 0; i < 1500; i += 1) {
    const list = Array.from({ length: Math.floor(rand() * 6) }, () => ({
      id: pick(rand, ALL_IDS), wajhOrder: rand() < 0.15 ? null : 1 + Math.floor(rand() * 4),
    })).map((n) => (n.wajhOrder === null ? { id: n.id } : n))
    const id = pick(rand, ALL_IDS)
    wajh.push({ narrators: list, id, next: w.nextWajhOrder(list, id) })
  }
  fs.writeFileSync(path.join(out, 'narrators.json'), JSON.stringify({ display: cases, wajh }))
  console.log(`narrators: ${cases.length} display cases, ${wajh.length} wajh cases`)
}

async function decisions() {
  const g = await webImport(`${reviewLib}referenceGroup.ts`)
  const rand = mulberry32(11)
  const cases = []
  for (let i = 0; i < 4000; i += 1) {
    const rows = Array.from({ length: Math.floor(rand() * 4) }, () => ({
      narrators: subset(rand, ALL_IDS, 0.1 + rand() * 0.5).map((id) => ({ id })),
      reviewStatus: pick(rand, ['reviewed', 'unreviewed', 'flagged']),
      deleted: rand() < 0.15,
    }))
    const group = { narratorIds: rand() < 0.08 ? [] : subset(rand, ALL_IDS, 0.05 + rand() * 0.5) }
    const draftIds = subset(rand, ALL_IDS, rand() * 0.6)
    const decision = g.proposeReferenceDecision(group, rows)
    const inDraft = g.isGroupInDraft(group, draftIds)
    const nullDecision = rand() < 0.1
    cases.push({
      rows, group, draftIds,
      status: decision.status, matched: decision.matchedRow ? rows.indexOf(decision.matchedRow) : -1,
      inDraft,
      nullDecision,
      badge: g.referenceBadgeVisibility(nullDecision ? null : decision, inDraft),
    })
  }
  fs.writeFileSync(path.join(out, 'decision.json'), JSON.stringify(cases))
  console.log(`decision: ${cases.length} cases`)
}

async function apply() {
  const a = await webImport(`${reviewLib}referenceApply.ts`)
  const sh = await webImport(`${reviewLib}shamilReference.ts`)
  const nq = await webImport(`${reviewLib}nquranReference.ts`)
  const shamilEntries = readJson(path.join(referenceDir, 'shamil', 'surah-002.json'))
  const nquranEntries = readJson(path.join(referenceDir, 'nquran', 'surah-002.json'))
  const groups = []
  for (const e of shamilEntries) groups.push(...sh.shamilGroupsForEntry(e))
  for (const e of nquranEntries) for (const d of e.differences) groups.push(...nq.nquranGroupsForDifference(d))
  const rand = mulberry32(23)
  // Real groups never carry a reading text, so add synthetic ones to exercise every branch of the plan.
  for (let i = 0; i < 600; i += 1) {
    groups.push({
      key: `synthetic-${i}`,
      readersLabel: 'x',
      narratorIds: subset(rand, ALL_IDS, 0.08 + rand() * 0.3),
      performanceText: pick(rand, ['', 'أداء', 'تقليل وقفًا', 'نص-1']),
      ...(rand() < 0.6 ? { readingText: pick(rand, ['نَقْل', 'وَإِذْ', null]) } : {}),
      ...(rand() < 0.5 ? { condition: pick(rand, ['both', 'wasl', 'waqf']), conditionBasis: 'x' } : {}),
      ...(rand() < 0.6 ? { suggestion: { kind: pick(rand, ['farsh', 'usul']), categoryCode: rand() < 0.3 ? null : pick(rand, ['USUL_NAQL', 'USUL_SAKT']) } } : {}),
      ...(rand() < 0.3 ? { unresolvedLabels: [] } : {}),
    })
  }
  const withReading = groups.filter((g) => g.readingText)
  const withSuggestion = groups.filter((g) => g.suggestion)
  const cases = []
  for (let i = 0; i < 6000; i += 1) {
    const pool = rand() < 0.4 ? withReading : rand() < 0.5 ? withSuggestion : groups
    const group = pick(rand, pool.length ? pool : groups)
    const narr = () => ({
      id: pick(rand, ALL_IDS),
      action: rand() < 0.3 ? null : (rand() < 0.5 ? group.performanceText : `نص-${Math.floor(rand() * 3)}`),
      wajhOrder: 1 + Math.floor(rand() * 3),
      wajhNote: rand() < 0.7 ? null : 'ملاحظة',
    })
    const ctx = {
      narrators: Array.from({ length: Math.floor(rand() * 4) }, narr),
      readingText: pick(rand, ['', '  ', 'وَإِذْ', 'نص مكتوب']),
      defaultReadingText: pick(rand, ['', 'وَإِذْ']),
      kind: pick(rand, ['farsh', 'usul']),
      categoryCode: rand() < 0.6 ? null : 'USUL_NAQL',
      isFreshDraft: rand() < 0.5,
      otherFarshNarrators: Array.from({ length: Math.floor(rand() * 3) }, () => ({ id: pick(rand, ALL_IDS), wajhOrder: 1 + Math.floor(rand() * 3) })),
    }
    const source = pick(rand, ['nquran', 'shamil'])
    cases.push({ source, group, ctx, plan: a.planApplyReferenceGroup(source, group, JSON.parse(JSON.stringify(ctx))) })
  }
  fs.writeFileSync(path.join(out, 'apply.json'), JSON.stringify(cases))
  console.log(`apply: ${cases.length} cases from ${groups.length} real groups`)
}

async function draft() {
  const farsh = await webImport(`${reviewUi}FarshFields.tsx`)
  const faces = await webImport(`${reviewUi}facesSummary.ts`)
  const rand = mulberry32(31)
  const raws = [
    null, undefined, '', ' Vowel ', 'vowel', 'harakah', 'تشكيل', 'تشكيل / حركة', 'حركة', 'consonant', 'letter', 'حرف',
    'إبدال حرف', 'إبدال', 'addition', 'زيادة', 'زيادة حرف/كلمة', 'زيادة حرف', 'omission', 'حذف', 'حذف حرف/كلمة',
    'حذف حرف', 'word_form', 'تقديم وتأخير', 'تقديم وتأخير / بنية الكلمة', 'بنية الكلمة', 'orthography', 'رسم', 'hamza',
    'hamz', 'همز', 'همزة', 'madd', 'مد', 'idgham', 'إدغام', 'ishmam', 'إشمام', 'imalah', 'إمالة', 'taqlil', 'تقليل',
    'sakt', 'سكت', 'naql', 'نقل', 'ikhfa', 'إخفاء', 'ghunnah', 'غنة', 'pronoun', 'ضمير', 'grammar', 'إعراب', 'other',
    'أخرى', 'SOMETHING', ' Unknown Thing ',
  ]
  const variantTypes = raws.map((raw) => [raw ?? null, farsh.normalizeVariantType(raw)])
  const rowCases = []
  for (let i = 0; i < 600; i += 1) {
    const rows = Array.from({ length: Math.floor(rand() * 5) }, (_, n) => {
      const startKey = `002:001:00${1 + Math.floor(rand() * 3)}`
      return {
        entryId: `r${n}`, kind: pick(rand, ['farsh', 'usul']), deleted: rand() < 0.2,
        categoryNameAr: pick(rand, [null, '', '  ', 'تحقيق', 'الممال والمقلل']),
        readingText: pick(rand, [null, '', ' ', 'وَإِذْ', ' نص ']),
        hafsText: pick(rand, ['', ' ', 'كلمة', null]),
        startKey, endKey: rand() < 0.3 ? '002:001:009' : startKey,
        narrators: shuffle(rand, subset(rand, ALL_IDS, 0.15)).map((id) => ({ id, nameAr: `اسم-${id}` })),
      }
    })
    rowCases.push({ rows, summary: faces.summarizeActiveRows(rows) })
  }
  fs.writeFileSync(path.join(out, 'draft.json'), JSON.stringify({ variantTypes, rowCases }))
  console.log(`draft: ${variantTypes.length} variant types, ${rowCases.length} face summaries`)
}

const pages = loadPages()
if (wants('nquran')) await nquran(pages)
if (wants('shamil')) await shamil(pages)
if (wants('narrators')) await narrators()
if (wants('decision')) await decisions()
if (wants('apply')) await apply()
if (wants('draft')) await draft()
