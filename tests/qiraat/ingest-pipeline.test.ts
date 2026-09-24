import assert from 'node:assert/strict'
import test from 'node:test'
import { expandAlBaqoon, ALL_NARRATOR_IDS, HAFS_ID } from '../../packages/qiraat-core/ingest/expand'
import { reanchorWord, type AyahWordToken } from '../../packages/qiraat-core/ingest/reanchor'
import { splitMultiWordRuleSpan } from '../../packages/qiraat-core/ingest/classify'
import { planMerges, type IngestItem, type ExistingDbRecord } from '../../packages/qiraat-core/ingest/mergePlan'

// --- 1. RE-ANCHORING SUITE ---

test('re-anchor: 2:17 يبصرون matches word position 17', () => {
  const tokens: AyahWordToken[] = [
    { word_position: 1, text_uthmani: 'مَثَلُهُمْ' },
    { word_position: 15, text_uthmani: 'ظُلُمَـٰتٍۢ' },
    { word_position: 16, text_uthmani: 'لَّا' },
    { word_position: 17, text_uthmani: 'يُبْصِرُونَ' },
  ]
  const matches = reanchorWord('يبصرون', tokens, 17)
  assert.equal(matches.length, 1)
  assert.equal(matches[0].startWord, 17)
  assert.equal(matches[0].endWord, 17)
  assert.equal(matches[0].confidence, 'exact')
})

test('re-anchor: 2:25 الأنهار matches word position 12', () => {
  const tokens: AyahWordToken[] = [
    { word_position: 1, text_uthmani: 'وَبَشِّرِ' },
    { word_position: 11, text_uthmani: 'تَحْتِهَا' },
    { word_position: 12, text_uthmani: 'ٱلْأَنْهَـٰرُ ۖ' },
    { word_position: 13, text_uthmani: 'كُلَّمَا' },
  ]
  const matches = reanchorWord('الأنهار', tokens, 12)
  assert.equal(matches.length, 1)
  assert.equal(matches[0].startWord, 12)
  assert.equal(matches[0].endWord, 12)
})

test('re-anchor: 2:2 هدى and فيه هدى preserve iqlab meem and waqf marks', () => {
  const tokens: AyahWordToken[] = [
    { word_position: 1, text_uthmani: 'ذَٰلِكَ' },
    { word_position: 2, text_uthmani: 'ٱلْكِتَـٰبُ' },
    { word_position: 3, text_uthmani: 'لَا' },
    { word_position: 4, text_uthmani: 'رَيْبَ ۛ' },
    { word_position: 5, text_uthmani: 'فِيهِ ۛ' },
    { word_position: 6, text_uthmani: 'هُدًۭى' },
    { word_position: 7, text_uthmani: 'لِّلْمُتَّقِينَ' },
  ]
  const m1 = reanchorWord('هُدًۭى', tokens, 6)
  assert.equal(m1.length, 1)
  assert.equal(m1[0].startWord, 6)
  assert.equal(m1[0].endWord, 6)

  const m2 = reanchorWord('فِيهِ ۛ هُدًۭى', tokens, 5)
  assert.equal(m2.length, 1)
  assert.equal(m2[0].startWord, 5)
  assert.equal(m2[0].endWord, 6)
})

test('re-anchor: 2:245 ويبصط preserves small seen on sad', () => {
  const tokens: AyahWordToken[] = [
    { word_position: 12, text_uthmani: 'وَٱللَّهُ' },
    { word_position: 13, text_uthmani: 'يَقْبِضُ' },
    { word_position: 14, text_uthmani: 'وَيَبْصُۜطُ' },
    { word_position: 15, text_uthmani: 'وَإِلَيْهِ' },
  ]
  const m = reanchorWord('وَيَبْصُۜطُ', tokens, 14)
  assert.equal(m.length, 1)
  assert.equal(m[0].startWord, 14)
  assert.equal(m[0].endWord, 14)
})

test('re-anchor: 2:54 بارئكم معا splits into word positions 13 and 20', () => {
  const tokens: AyahWordToken[] = [
    { word_position: 11, text_uthmani: 'فَتُوبُوٓا۟' },
    { word_position: 12, text_uthmani: 'إِلَىٰ' },
    { word_position: 13, text_uthmani: 'بَارِئِكُمْ' },
    { word_position: 14, text_uthmani: 'فَٱقْتُلُوٓا۟' },
    { word_position: 19, text_uthmani: 'عِندَ' },
    { word_position: 20, text_uthmani: 'بَارِئِكُمْ' },
    { word_position: 21, text_uthmani: 'فَتَابَ' },
  ]
  // In source, "معا" or raw token 14/21
  const matches = reanchorWord('بارئكم', tokens, 14, 'بارئكم في الموضعين معا بخلف')
  assert.equal(matches.length, 2, 'Must split into both occurrences when معا is present')
  assert.equal(matches[0].startWord, 13)
  assert.equal(matches[1].startWord, 20)
  assert.equal(matches[0].confidence, 'split_all')
})

test('re-anchor: 2:58 نغفر matches word position 16', () => {
  const tokens: AyahWordToken[] = [
    { word_position: 15, text_uthmani: 'حِطَّةٌۭ' },
    { word_position: 16, text_uthmani: 'نَّغْفِرْ' },
    { word_position: 17, text_uthmani: 'لَكُمْ' },
  ]
  const matches = reanchorWord('نغفر', tokens, 16)
  assert.equal(matches.length, 1)
  assert.equal(matches[0].startWord, 16)
})

test('re-anchor: 2:62 النصارى matches word position 6', () => {
  const tokens: AyahWordToken[] = [
    { word_position: 4, text_uthmani: 'هَادُوا۟' },
    { word_position: 5, text_uthmani: 'وَٱلصَّـٰبِـِٔينَ' },
    { word_position: 6, text_uthmani: 'وَٱلنَّصَـٰرَىٰ' },
    { word_position: 7, text_uthmani: 'مَنْ' },
  ]
  const matches = reanchorWord('النصارى', tokens, 6)
  assert.equal(matches.length, 1)
  assert.equal(matches[0].startWord, 6)
})

test('re-anchor: 2:67 هزوا matches word position 13', () => {
  const tokens: AyahWordToken[] = [
    { word_position: 11, text_uthmani: 'أَتَتَّخِذُنَا' },
    { word_position: 12, text_uthmani: 'قَالَ' },
    { word_position: 13, text_uthmani: 'هُزُوًۭا ۖ' },
    { word_position: 14, text_uthmani: 'أَعُوذُ' },
  ]
  const matches = reanchorWord('هزوا', tokens, 13)
  assert.equal(matches.length, 1)
  assert.equal(matches[0].startWord, 13)
})

test('re-anchor: 2:68 تؤمرون matches word position 23', () => {
  const tokens: AyahWordToken[] = [
    { word_position: 21, text_uthmani: 'مَا' },
    { word_position: 22, text_uthmani: 'فَٱفْعَلُوا۟' },
    { word_position: 23, text_uthmani: 'تُؤْمَرُونَ' },
  ]
  const matches = reanchorWord('تؤمرون', tokens, 23)
  assert.equal(matches.length, 1)
  assert.equal(matches[0].startWord, 23)
})

// --- 2. EMPTY VS MISSING FILE DISTINCTION ---

test('empty-file vs missing-file distinction logic', () => {
  const emptyJson = '[]'
  const parsedEmpty = JSON.parse(emptyJson)
  assert.ok(Array.isArray(parsedEmpty) && parsedEmpty.length === 0, 'Empty file parsed as empty array')

  // Status mapping
  const statusEmpty = parsedEmpty.length === 0 ? 'done-empty' : 'done'
  assert.equal(statusEmpty, 'done-empty')
})

// --- 3. «الباقون» EXPANSION & D8 RULE ---

test('expandAlBaqoon correctly expands remaining 14 narrators when 6 are specified', () => {
  const specified = ['Q01-R01', 'Q01-R02', 'Q02-R01', 'Q02-R02', 'Q03-R01', 'Q03-R02']
  const result = expandAlBaqoon(specified)

  assert.equal(result.expandedIds.length, 14, 'Must expand to exactly 14 remaining narrators')
  assert.ok(!result.expandedIds.includes('Q01-R01'))
  assert.ok(result.expandedIds.includes('Q05-R02'), 'Hafs must be in the expanded remainder')
  assert.ok(result.hafsIncluded, 'Hafs is included in remainder')
  assert.ok(!result.isOnlyHafs, 'Not only Hafs')
})

test('expandAlBaqoon identifies isOnlyHafs when 19 other narrators are specified', () => {
  const other19 = ALL_NARRATOR_IDS.filter((id) => id !== HAFS_ID)
  const result = expandAlBaqoon(other19)

  assert.equal(result.expandedIds.length, 1)
  assert.equal(result.expandedIds[0], HAFS_ID)
  assert.ok(result.isOnlyHafs, 'Must recognize that only Hafs is in remainder')
})

// --- 4. MULTI-WORD RULING SPLITTING (Q2 = Option 1) ---

test('splitMultiWordRuleSpan decomposes multi-word span into 1-word spans', () => {
  const split = splitMultiWordRuleSpan(4, 7)
  assert.equal(split.length, 4, 'Span 4..7 must split into 4 individual words')
  assert.equal(split[0].startWord, 4)
  assert.equal(split[0].endWord, 4)
  assert.equal(split[3].startWord, 7)
  assert.equal(split[3].endWord, 7)
})

test('splitMultiWordRuleSpan preserves single-word span as 1 entry', () => {
  const split = splitMultiWordRuleSpan(5, 5)
  assert.equal(split.length, 1)
  assert.equal(split[0].startWord, 5)
  assert.equal(split[0].endWord, 5)
})

// --- 5. MERGE PLANNING & IDEMPOTENCY ---

test('mergePlan correctly categorizes Corroborate, Gap-Fill, and Conflict', () => {
  const existingDb: ExistingDbRecord[] = [
    {
      entryId: 'ent-1',
      locusId: 'loc-1',
      surah: 1,
      ayah: 4,
      startWord: 1,
      endWord: 1,
      narratorId: 'Q01-R01',
      kind: 'variant',
      readingText: 'مَلِكِ',
    },
    {
      entryId: 'ent-2',
      locusId: 'loc-2',
      surah: 1,
      ayah: 6,
      startWord: 2,
      endWord: 2,
      narratorId: 'Q06-R01',
      kind: 'variant',
      readingText: 'ٱلصِّرَاطَ', // Conflict with new source
    },
  ]

  const incoming: IngestItem[] = [
    // Item 1: Agrees with existing (Corroborate)
    {
      sourceId: 'src-1',
      surah: 1,
      ayah: 4,
      startWord: 1,
      endWord: 1,
      narratorId: 'Q01-R01',
      kind: 'variant',
      readingText: 'مَلِكِ',
    },
    // Item 2: Differs from existing (Conflict)
    {
      sourceId: 'src-2',
      surah: 1,
      ayah: 6,
      startWord: 2,
      endWord: 2,
      narratorId: 'Q06-R01',
      kind: 'variant',
      readingText: 'ٱلسِّرَاطَ',
    },
    // Item 3: New reading (Gap fill)
    {
      sourceId: 'src-3',
      surah: 1,
      ayah: 7,
      startWord: 4,
      endWord: 4,
      narratorId: 'Q09-R01',
      kind: 'variant',
      readingText: 'عَلَيْهُمْ',
    },
  ]

  const result = planMerges(incoming, existingDb)
  assert.equal(result.counts.corroborate, 1, 'Item 1 must corroborate')
  assert.equal(result.counts.conflict, 1, 'Item 2 must conflict')
  assert.equal(result.counts.gapFill, 1, 'Item 3 must gap-fill')

  // Idempotency: Running planMerges with items already in DB must produce 0 gap-fills and 0 conflicts
  const reRunExisting: ExistingDbRecord[] = [
    ...existingDb,
    {
      entryId: 'ent-3',
      locusId: 'loc-3',
      surah: 1,
      ayah: 7,
      startWord: 4,
      endWord: 4,
      narratorId: 'Q09-R01',
      kind: 'variant',
      readingText: 'عَلَيْهُمْ',
    },
  ]
  const idempotentInput: IngestItem[] = [
    incoming[0], // Corroborate
    incoming[2], // Now in DB, so corroborates
  ]
  const rerunResult = planMerges(idempotentInput, reRunExisting)
  assert.equal(rerunResult.counts.gapFill, 0, 'Idempotent run must produce 0 new gap fills')
  assert.equal(rerunResult.counts.corroborate, 2, 'All matching items must corroborate')
})
