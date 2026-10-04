import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { FALLBACK_USUL_CATEGORIES } from '../../src/app/mushaf-1441/review/_components/UsulRuleGrid'
import {
  SHAMIL_NARRATOR_TO_ID,
  findShamilEntriesForWord,
  hasShamilReferenceForSurah,
  matchKey,
  shamilGroupsForEntry,
  shamilPerformanceText,
  suggestShamilCategory,
  type ShamilEntry,
  type ShamilWajh,
} from '../../src/app/mushaf-1441/review/_lib/shamilReference'

const SHAMIL_DIR = new URL('../../src/app/mushaf-1441/review/_lib/reference/shamil/', import.meta.url)
const entries: ShamilEntry[] = JSON.parse(readFileSync(new URL('./_helpers/shamil-legacy.json', import.meta.url), 'utf8'))
const byId = (id: string): ShamilEntry => entries.find((e) => e.entryId === id)!

// Real Mushaf words of surah 2, by ayah (textUthmani), from the bundled page-word fixtures.
const WORDS_DIR = new URL('../../packages/quran-data/mushaf1441/fixtures/page-words/', import.meta.url)
const mushafWords = new Map<number, string[]>()
for (const file of readdirSync(WORDS_DIR)) {
  const page = JSON.parse(readFileSync(new URL(file, WORDS_DIR), 'utf8'))
  for (const line of page.lines) {
    for (const w of line.words) {
      if (w.charTypeName === 'word' && w.surahNumber === 2) {
        const list = mushafWords.get(w.ayahNumber) ?? []
        list.push(w.textUthmani)
        mushafWords.set(w.ayahNumber, list)
      }
    }
  }
}
function mushafWord(ayah: number, key: string): string {
  const found = (mushafWords.get(ayah) ?? []).find((t) => matchKey(t) === key)
  assert.ok(found, `no Mushaf word with key ${key} in 2:${ayah}`)
  return found
}

// Full-ayah context the editor passes for a clicked word (1-based word numbers, like the review page).
function ayahContext(ayah: number, key: string) {
  const texts = mushafWords.get(ayah) ?? []
  const index = texts.findIndex((t) => matchKey(t) === key)
  assert.ok(index >= 0, `no word ${key} in 2:${ayah}`)
  return { wordText: texts[index], context: { wordIndex: index + 1, ayahWords: texts.map((text, i) => ({ word: i + 1, text })) } }
}

function hits(ayah: number, key: string): ShamilEntry[] {
  const { wordText, context } = ayahContext(ayah, key)
  return findShamilEntriesForWord(entries, ayah, wordText, context)
}

const hasPhrase = (list: ShamilEntry[], phrase: string) => list.some((e) => e.words.some((w) => matchKey(w) === matchKey(phrase)))

function wajh(category: string, description: string, type: 'usul' | 'farsh' = 'usul'): Pick<ShamilWajh, 'type' | 'category' | 'description'> {
  return { type, category, description }
}

test('narrator table is exactly the 20 known ids and covers every id used in the data', () => {
  assert.deepEqual(SHAMIL_NARRATOR_TO_ID, {
    qalun: 'Q01-R01', warsh: 'Q01-R02', bazzi: 'Q02-R01', qunbul: 'Q02-R02', duri_abuamr: 'Q03-R01', susi: 'Q03-R02',
    hisham: 'Q04-R01', ibn_dhakwan: 'Q04-R02', shubah: 'Q05-R01', hafs: 'Q05-R02', khalaf_hamzah: 'Q06-R01',
    khallad: 'Q06-R02', abulharith: 'Q07-R01', duri_kisai: 'Q07-R02', ibn_wardan: 'Q08-R01', ibn_jammaz: 'Q08-R02',
    ruways: 'Q09-R01', rawh: 'Q09-R02', ishaq: 'Q10-R01', idris: 'Q10-R02',
  })
  for (const e of entries) for (const w of e.wajhs) for (const n of w.narrators) assert.ok(n in SHAMIL_NARRATOR_TO_ID, n)
})

test('hasShamilReferenceForSurah follows the generated index, not 1..114', () => {
  assert.equal(hasShamilReferenceForSurah(2), true)
  for (const s of [0, 1, 3, 115, 2.5]) assert.equal(hasShamilReferenceForSurah(s), false, String(s))
})

test('every entry matches at least one real Mushaf word in at least one of its ayahs, with full-ayah context', () => {
  const unmatched = entries.filter(
    (e) =>
      !e.ayahs.some((ayah) => {
        const texts = mushafWords.get(ayah) ?? []
        const ayahWords = texts.map((text, i) => ({ word: i + 1, text }))
        return texts.some((t, i) => findShamilEntriesForWord([e], ayah, t, { wordIndex: i + 1, ayahWords }).length > 0)
      }),
  )
  assert.deepEqual(unmatched.map((e) => e.entryId), [])
})

test('a phrase entry is offered only where the whole phrase occurs around the clicked word', () => {
  // The phrase belongs to another ayah of a multi-ayah entry, or the clicked word is a different word
  // that merely normalises to the same letters (إنّ/أن, مَن/مِن).
  assert.equal(hasPhrase(hits(62, 'ان'), 'أَنْ أَكُونَ'), false, '2:62 إِنَّ via «أَنْ أَكُونَ» (2:67)')
  assert.equal(hasPhrase(hits(49, 'من'), 'مِّنۢ بَعْدِ'), false, '2:49 مِّنْ via «مِّنۢ بَعْدِ» (2:52)')
  assert.equal(hasPhrase(hits(30, 'من'), 'ءَادَمُ مِن'), false, '2:30 مَن via «ءَادَمُ مِن» (2:37)')
  assert.equal(hasPhrase(hits(25, 'ان'), 'أَن يَضْرِبَ'), false, '2:25 أَنَّ via «أَن يَضْرِبَ» (2:26)')
})

test('a phrase that straddles two listed ayahs is offered at the end of the first and the start of the second', () => {
  // «عظيم وإذ» = last word of 2:49 + first word of 2:50
  assert.ok(hits(49, 'عظيم').some((e) => e.entryId === 'p008_e14'))
  assert.ok(hits(50, 'واذ').some((e) => e.entryId === 'p008_e14'))
  assert.ok(!hits(49, 'واذ').some((e) => e.entryId === 'p008_e14'), '2:49 starts with «وإذ» but the phrase needs «عظيم» before it')
})

test('with context, a word inside the entry phrase still finds the entry; a partial context falls back to token matching', () => {
  assert.ok(hits(9, 'يخدعون').some((e) => e.entryId === 'p003_e08'))
  assert.ok(hits(9, 'وما').some((e) => e.entryId === 'p003_e08'), 'the phrase «وما يخدعون» includes the word «وما»')
  const { wordText, context } = ayahContext(9, 'يخدعون')
  const partial = { wordIndex: context.wordIndex, ayahWords: context.ayahWords.filter((w) => w.word >= 5) }
  assert.ok(findShamilEntriesForWord(entries, 9, wordText, partial).some((e) => e.entryId === 'p003_e08'))
})

test('2:9 «يَخْدَعُونَ» finds p003_e08 whose two groups cover 6 and 14 narrators', () => {
  const found = findShamilEntriesForWord(entries, 9, mushafWord(9, 'يخدعون'))
  const entry = found.find((e) => e.entryId === 'p003_e08')
  assert.ok(entry)
  assert.deepEqual(shamilGroupsForEntry(entry).map((g) => g.narratorIds.length), [6, 14])
})

test('2:4 «وَبِٱلْـَٔاخِرَةِ» finds p002_e07 with Kisai\'s two narrators, waqf, and an Imalah suggestion', () => {
  const found = findShamilEntriesForWord(entries, 4, mushafWord(4, 'وبالاخره'))
  const entry = found.find((e) => e.entryId === 'p002_e07')
  assert.ok(entry)
  const [first] = shamilGroupsForEntry(entry)
  assert.deepEqual(first.narratorIds, ['Q07-R01', 'Q07-R02'])
  assert.equal(first.condition, 'waqf')
  assert.equal(first.performanceText, 'إمالة هاء التأنيث وقفًا')
  assert.deepEqual(first.suggestion, { kind: 'usul', categoryCode: 'IMALAH_TAQLIL' })
})

test('shamilGroupsForEntry: one group per wajh with unique keys, reader-collapsed label, reading text and basis', () => {
  const groups = shamilGroupsForEntry(byId('p003_e08'))
  assert.equal(groups.length, 2)
  assert.equal(new Set(groups.map((g) => g.key)).size, 2)
  assert.equal(groups[0].readersLabel, 'نافع المدني، ابن كثير المكي، أبو عمرو البصري')
  assert.equal(groups[0].readingText, 'يُخَادِعُونَ')
  assert.equal(groups[0].conditionBasis, 'default')
})

test('a bare short word «مَا» does not pull an entry whose tokens are «وما» / «يخدعون»', () => {
  const found = findShamilEntriesForWord(entries, 9, 'مَا')
  assert.ok(!found.some((e) => e.entryId === 'p003_e08'))
})

test('an entry is never returned for an ayah it does not list', () => {
  for (const e of entries) {
    const otherAyah = Math.max(...e.ayahs) + 1
    for (const word of e.words) assert.deepEqual(findShamilEntriesForWord([e], otherAyah, word), [], e.entryId)
  }
})

test('shamilPerformanceText appends the condition only when the description is silent about it', () => {
  assert.equal(shamilPerformanceText('الفتح', 'both'), 'الفتح')
  assert.equal(shamilPerformanceText('الفتح', 'waqf'), 'الفتح وقفًا')
  assert.equal(shamilPerformanceText('الفتح', 'wasl'), 'الفتح وصلاً')
  assert.equal(shamilPerformanceText('وقفًا: النقل', 'waqf'), 'وقفًا: النقل')
  assert.equal(shamilPerformanceText('صلة الميم وصلاً', 'wasl'), 'صلة الميم وصلاً')
})

test('suggestShamilCategory: named categories map directly, farsh gets no category', () => {
  const direct: [string, string][] = [
    ['التقليل والإمالة', 'IMALAH_TAQLIL'], ['الإبدال', 'USUL_IBDAL'], ['إدغام بلا غنة', 'TARK_GHUNNA'],
    ['صلة الهاء', 'SILAT_HA'], ['الترقيق', 'TARQIQ_RA'], ['التغليظ', 'TAGHLIZ_LAM'],
  ]
  for (const [category, code] of direct) {
    assert.deepEqual(suggestShamilCategory(wajh(category, 'أي وصف')), { kind: 'usul', categoryCode: code }, category)
  }
  assert.deepEqual(suggestShamilCategory(wajh('الأصول/فرش', 'ضم الياء وفتح الخاء', 'farsh')), { kind: 'farsh', categoryCode: null })
})

test('suggestShamilCategory: «النقل والسكت» and the idgham category go by description', () => {
  const code = (category: string, description: string) => suggestShamilCategory(wajh(category, description)).categoryCode
  assert.equal(code('النقل والسكت', 'عدم السكت'), 'USUL_SAKT')
  assert.equal(code('النقل والسكت', 'السكت على (أل)'), 'USUL_SAKT')
  assert.equal(code('النقل والسكت', 'النقل'), 'USUL_NAQL')
  assert.equal(code('النقل والسكت', 'التحقيق'), 'USUL_TAHQIQ')
  assert.equal(code('النقل والسكت', 'شيء آخر'), null)
  assert.equal(code('إدغام صغير/كبير', 'الإدغام الكبير'), 'IDGHAM_KABIR')
  assert.equal(code('إدغام صغير/كبير', 'إدغام الذال في التاء'), 'IDGHAM_SAGHIR')
  assert.equal(code('إدغام صغير/كبير', 'إظهار الذال عند التاء'), 'IDGHAM_SAGHIR')
  assert.equal(code('إدغام صغير/كبير', 'إدغام الهاء في الهاء'), null)
  assert.equal(code('إدغام صغير/كبير', 'الإظهار'), null)
})

test('suggestShamilCategory: the mixed «الأصول/فرش» usul bucket is keyword-mapped, unmatched stays null', () => {
  const code = (description: string) => suggestShamilCategory(wajh('الأصول/فرش', description)).categoryCode
  assert.equal(code('صلة ميم الجمع بواو'), 'USUL_MIM_JAM')
  assert.equal(code('إسكان الميم من غير صلة'), 'USUL_MIM_JAM')
  assert.equal(code('البدل: القصر'), 'MADD_BADAL')
  assert.equal(code('ترقيق الراء مع البدل: المد'), 'TARQIQ_RA')
  assert.equal(code('المد المتصل ست حركات'), 'USUL_MADD')
  assert.equal(code('توسط المد المنفصل أربع حركات'), 'USUL_MADD')
  assert.equal(code('التوسط في الياء بين الشين والهمزة'), 'USUL_MADD')
  assert.equal(code('السكت على الياء'), 'USUL_SAKT')
  assert.equal(code('عدم السكت'), 'USUL_SAKT')
  assert.equal(code('وقفًا: النقل مع الروم'), 'WAQF_HAMZA')
  assert.equal(code('وقفًا: إبدال الهمزة ألفًا مع القصر'), 'WAQF_HAMZA')
  assert.equal(code('إخفاء التنوين عند الغين'), 'IKHFA')
  assert.equal(code('تسهيل الهمزة مع المد'), 'TAGHYIR_HAMZ')
  assert.equal(code('حذف الهمزة وضم الباء'), 'TAGHYIR_HAMZ')
  assert.equal(code('تحقيق الهمزة'), 'TAGHYIR_HAMZ')
  assert.equal(code('تحقيق الأولى وتسهيل الثانية بين بين'), null)
  assert.equal(code('تحقيق الهمزتين مع الإدخال'), null)
  assert.equal(code('ضم الهاء'), null)
})

test('suggestShamilCategory over all 738 real wajhs only returns known codes; reports the mapped share', () => {
  const known = new Set(FALLBACK_USUL_CATEGORIES.map((c) => c.code))
  let usul = 0
  let mapped = 0
  for (const e of entries) {
    for (const w of e.wajhs) {
      const s = suggestShamilCategory(w)
      assert.equal(s.kind, w.type)
      if (s.categoryCode !== null) assert.ok(known.has(s.categoryCode), s.categoryCode)
      if (w.type === 'usul') {
        usul += 1
        if (s.categoryCode !== null) mapped += 1
      }
    }
  }
  console.log(`category suggestions: ${mapped}/${usul} usul wajhs mapped, ${usul - mapped} left unsuggested`)
  assert.ok(mapped / usul >= 0.8, `only ${mapped}/${usul} mapped`)
})


test('replacement Baqarah data preserves prose groups without inventing structured rulings', () => {
  const replacement: ShamilEntry[] = JSON.parse(readFileSync(new URL('surah-002.json', SHAMIL_DIR), 'utf8'))
  assert.equal(replacement.length, 1026)
  assert.equal(replacement.reduce((n, e) => n + shamilGroupsForEntry(e).length, 0), 1701)
  assert.ok(replacement.every((e) => !e.entryId.startsWith('p') && e.sourceDifference && e.wajhs.length === 0))
  const entry = replacement.find((e) => e.ayahs[0] === 2 && e.words[0] === 'فيه هدى')!
  const groups = shamilGroupsForEntry(entry)
  assert.deepEqual(groups.map((g) => g.readersLabel), ['ابن كثير', 'السوسي عن أبي عمرو', 'باقي الرواة'])
  assert.deepEqual(groups.map((g) => g.narratorIds.length), [2, 1, 17])
  assert.deepEqual(groups.map((g) => g.performanceText), entry.sourceDifference!.groups.map((g) => g.reading))
  assert.ok(groups.every((g) => g.suggestion === undefined && g.condition === undefined))
  assert.ok(replacement.some((e) => e.ayahs[0] === 286 && e.page === 49))
})
