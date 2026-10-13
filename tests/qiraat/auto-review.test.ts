import assert from 'node:assert/strict'
import test from 'node:test'
import {
  farshSubCategory,
  SUB_AR,
} from '../../scripts/qiraat/auto-review-live'
import {
  escapeSqlString,
  buildReviewNote,
  getReviewSource,
  mapSubCategoryToVariantType,
  generateApplySql,
  SUB_CATEGORY_TO_VARIANT_TYPE,
  type Verdict,
} from '../../scripts/qiraat/auto-review-apply'

test('farshSubCategory: derives all 6 sub-category codes correctly', () => {
  // 1. vowel (تشكيل): same skeleton, different vowels
  const vowelRes = farshSubCategory('ٱلْيُسْرَ', 'ٱلْيُسُرَ')
  assert.equal(vowelRes, 'vowel')
  assert.equal(SUB_AR[vowelRes], 'تشكيل')

  // 2. consonant (إبدال حرف): same skeleton length, 1 consonant difference
  const consonantRes = farshSubCategory('يَعْمَلُونَ', 'تَعْمَلُونَ')
  assert.equal(consonantRes, 'consonant')
  assert.equal(SUB_AR[consonantRes], 'إبدال حرف')

  // 3. word_form (تقديم وتأخير): anagram / permuted letters of same length
  const wordFormRes = farshSubCategory('سفه', 'فهس')
  assert.equal(wordFormRes, 'word_form')
  assert.equal(SUB_AR[wordFormRes], 'تقديم وتأخير')

  // 4. addition (زيادة): variant is longer than Hafs
  const additionRes = farshSubCategory('سَارِعُوٓا۟', 'وَسَارِعُوا')
  assert.equal(additionRes, 'addition')
  assert.equal(SUB_AR[additionRes], 'زيادة')

  // 5. omission (حذف): variant is shorter than Hafs
  const omissionRes = farshSubCategory('وَسَارِعُوا', 'سَارِعُوٓا۟')
  assert.equal(omissionRes, 'omission')
  assert.equal(SUB_AR[omissionRes], 'حذف')

  // 6. other (أخرى): same length, multiple consonants differ
  const otherRes = farshSubCategory('كتب', 'نصل')
  assert.equal(otherRes, 'other')
  assert.equal(SUB_AR[otherRes], 'أخرى')
})

test('mapSubCategoryToVariantType: maps all Arabic sub-categories to variant types', () => {
  assert.equal(mapSubCategoryToVariantType('تشكيل'), 'vowel')
  assert.equal(mapSubCategoryToVariantType('إبدال حرف'), 'consonant')
  assert.equal(mapSubCategoryToVariantType('زيادة'), 'addition')
  assert.equal(mapSubCategoryToVariantType('حذف'), 'omission')
  assert.equal(mapSubCategoryToVariantType('تقديم وتأخير'), 'word_form')
  assert.equal(mapSubCategoryToVariantType('أخرى'), 'other')
  // English pass-through
  assert.equal(mapSubCategoryToVariantType('vowel'), 'vowel')
})

test('auto-review-apply: refuses B, C, skip tiers (and A-S2 unless --include-s2)', () => {
  const mockVerdicts: Verdict[] = [
    {
      id: 'ent-a1',
      kind: 'ruling',
      page: 19,
      ref: '2:124:1',
      word: 'وَإِذْ',
      tier: 'A1',
      reason: 'S1 matches',
      category: 'أصول',
      subCategory: 'IDGHAM_SAGHIR',
      subCategoryAgreesWithDb: null,
      narrators: ['Q03-R01'],
      s2Confirmed: [],
    },
    {
      id: 'ent-a2',
      kind: 'ruling',
      page: 19,
      ref: '2:123:15',
      word: 'شَفَـٰعَةٌۭ',
      tier: 'A2',
      reason: 'S1 matches; S2 confirms',
      category: 'أصول',
      subCategory: 'TARK_GHUNNA',
      subCategoryAgreesWithDb: null,
      narrators: ['Q06-R01'],
      s2Confirmed: ['Q06-R01'],
    },
    {
      id: 'ent-b',
      kind: 'ruling',
      page: 19,
      ref: '2:124:2',
      word: 'ٱبْتَلَىٰٓ',
      tier: 'B',
      reason: 'sources disagree',
      category: 'أصول',
      subCategory: 'IMALAH_TAQLIL',
      subCategoryAgreesWithDb: null,
      narrators: ['Q01-R02'],
    },
    {
      id: 'ent-c',
      kind: 'ruling',
      page: 19,
      ref: '2:124:3',
      word: 'كَلِمَـٰتٍ',
      tier: 'C',
      reason: 'no source documents this word',
      category: 'أصول',
      subCategory: 'OTHER',
      subCategoryAgreesWithDb: null,
      narrators: ['Q01-R01'],
    },
    {
      id: 'ent-skip',
      kind: 'ruling',
      page: 19,
      ref: '2:120:14',
      word: 'هُوَ',
      tier: 'skip',
      reason: 'already reviewed',
      category: 'أصول',
      subCategory: 'USUL_SAKT',
      subCategoryAgreesWithDb: null,
      narrators: ['Q09-R01'],
    },
    {
      id: 'ent-as2',
      kind: 'ruling',
      page: 19,
      ref: '2:125:5',
      word: 'مَّقَامِ',
      tier: 'A-S2',
      reason: 'S2 confirms every narrator',
      category: 'أصول',
      subCategory: 'IMALAH_TAQLIL',
      subCategoryAgreesWithDb: null,
      narrators: ['Q06-R01'],
      s2Confirmed: ['Q06-R01'],
    },
  ]

  // Default: A1 and A2 only
  const sqlDefault = generateApplySql(mockVerdicts, { includeS2: false })

  assert.ok(sqlDefault.includes('ent-a1'), 'Must approve tier A1')
  assert.ok(sqlDefault.includes('ent-a2'), 'Must approve tier A2')
  assert.ok(!sqlDefault.includes('ent-b'), 'Must refuse tier B')
  assert.ok(!sqlDefault.includes('ent-c'), 'Must refuse tier C')
  assert.ok(!sqlDefault.includes('ent-skip'), 'Must refuse tier skip')
  assert.ok(!sqlDefault.includes('ent-as2'), 'Must refuse tier A-S2 by default')

  // With --include-s2
  const sqlWithS2 = generateApplySql(mockVerdicts, { includeS2: true })
  assert.ok(sqlWithS2.includes('ent-as2'), 'Must include tier A-S2 when includeS2=true')
  assert.ok(sqlWithS2.includes("review_source = 'auto:book'"), 'A-S2 must have review_source auto:book')
  assert.ok(!sqlWithS2.includes('ent-b'), 'Must still refuse tier B')
  assert.ok(!sqlWithS2.includes('ent-c'), 'Must still refuse tier C')
  assert.ok(!sqlWithS2.includes('ent-skip'), 'Must still refuse tier skip')
})

test('auto-review-apply: quotes notes containing single quotes safely', () => {
  const rawNote = "طابق nquran.com وكتاب 'ابن كثير' المعتمد"
  const escaped = escapeSqlString(rawNote)
  assert.equal(escaped, "طابق nquran.com وكتاب ''ابن كثير'' المعتمد")

  const mockVerdicts: Verdict[] = [
    {
      id: 'ent-quote',
      kind: 'ruling',
      page: 19,
      ref: '2:124:1',
      word: 'وَإِذْ',
      tier: 'A1',
      reason: "nquran's match",
      category: 'أصول',
      subCategory: 'IDGHAM_SAGHIR',
      subCategoryAgreesWithDb: null,
      narrators: ['Q03-R01'],
    },
  ]

  const sql = generateApplySql(mockVerdicts)
  assert.ok(sql.includes("SET review_status = 'reviewed'"))
  assert.ok(sql.includes("review_note = 'طابق nquran.com'"))

  // Test custom note with single quote in SQL output
  const customNoteSql = `review_note = '${escapeSqlString("It's confirmed")}'`
  assert.equal(customNoteSql, "review_note = 'It''s confirmed'")
})

test('auto-review-apply: idempotency (only touches unreviewed rows, never overwrites non-other)', () => {
  const mockVerdicts: Verdict[] = [
    {
      id: 'ent-farsh-other',
      kind: 'variant',
      page: 19,
      ref: '2:124:18',
      word: 'عَهْدِى',
      tier: 'A1',
      reason: 'S1 matches',
      category: 'فرش',
      subCategory: 'تشكيل',
      subCategoryAgreesWithDb: false,
      storedVariantType: 'other',
      narrators: ['Q03-R01'],
    },
    {
      id: 'ent-farsh-non-other',
      kind: 'variant',
      page: 28,
      ref: '2:185:6',
      word: 'ٱلْقُرْءَانُ',
      tier: 'A2',
      reason: 'S1 matches; S2 confirms',
      category: 'فرش',
      subCategory: 'حذف',
      subCategoryAgreesWithDb: false,
      storedVariantType: 'naql',
      narrators: ['Q02-R01', 'Q02-R02'],
      s2Confirmed: ['Q02-R01', 'Q02-R02'],
    },
  ]

  const sql = generateApplySql(mockVerdicts)

  // 1. Every entry update guards review_status = 'unreviewed' AND deleted_at IS NULL
  const updateEntryLines = sql.split('\n').filter((l) => l.startsWith('UPDATE qiraat_entries'))
  assert.equal(updateEntryLines.length, 2)
  for (const line of updateEntryLines) {
    assert.ok(line.includes("review_status = 'unreviewed'"), 'Must guard review_status = unreviewed')
    assert.ok(line.includes('deleted_at IS NULL'), 'Must guard deleted_at IS NULL')
  }

  // 2. Farsh variant_type update: only for stored variant_type = 'other'
  const updateVariantLines = sql.split('\n').filter((l) => l.startsWith('UPDATE qiraat_variant_details'))
  assert.equal(updateVariantLines.length, 1, 'Only the entry with stored variant_type=other should have variant_type updated')
  assert.ok(updateVariantLines[0].includes("entry_id = 'ent-farsh-other'"))
  assert.ok(updateVariantLines[0].includes("variant_type = 'vowel'"))
  assert.ok(updateVariantLines[0].includes("variant_type = 'other'"), 'Must guard variant_type = other')

  // 3. The non-other entry must NOT be updated in qiraat_variant_details
  assert.ok(!updateVariantLines.some((l) => l.includes('ent-farsh-non-other')))

  // 4. The non-other entry must be listed in the queued for human comment block
  assert.ok(sql.includes('-- Queued for human review:'))
  assert.ok(sql.includes('ent-farsh-non-other'))
  assert.ok(sql.includes("stored='naql' != derived='omission'"))

  // 5. Review note generation for A2 includes book name
  assert.ok(sql.includes('طابق nquran.com وكتاب القراءة المعتمد (ابن كثير)'))

  // 6. Contains set_config and transaction bounds
  assert.ok(sql.includes("SELECT set_config('app.device_id', 'auto-review', true);"))
  assert.ok(sql.startsWith('-- ============================================================================'))
  assert.ok(sql.includes('BEGIN;'))
  assert.ok(sql.includes('COMMIT;'))
})
