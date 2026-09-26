import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CANONICAL_READERS,
} from '../../src/app/mushaf-1441/review/_components/ReaderNarratorSelector'
import {
  FALLBACK_USUL_CATEGORIES,
} from '../../src/app/mushaf-1441/review/_components/UsulRuleGrid'
import {
  CANONICAL_VARIANT_TYPES,
} from '../../src/app/mushaf-1441/review/_components/FarshFields'
import {
  canonicalKeyForWord,
} from '../../src/app/mushaf-1441/review/_components/ReviewMushafPane'
import {
  worstStatus,
  filterReviewRows,
} from '../../src/app/mushaf-1441/review/_components/statusMeta'
import {
  isImalahCategory,
  detectImalahType,
  buildFaceActionText,
  nextWajhOrder,
  buildImalahRulingText,
  IMALAH_NARRATOR_IDS,
  TAQLIL_NARRATOR_IDS,
  WARSH_NARRATOR_ID,
} from '../../src/app/mushaf-1441/review/_components/ImalahDetailFields'
import {
  validateEntryDraft,
  serializeDraftSnapshot,
} from '../../src/app/mushaf-1441/review/_components/useReviewEditorDraft'
import {
  isHamzahCategory,
  buildHamzahFaceActionText,
  KALIMA_TASHIL_IDKHAL_IDS,
  KALIMA_TASHIL_NO_IDKHAL_IDS,
  KALIMA_TAHQIQ_IDS,
  KALIMATAYN_ISQAT_FIRST_IDS,
  KALIMATAYN_TASHIL_SECOND_IDS,
} from '../../src/app/mushaf-1441/review/_components/HamzahDetailFields'
import type { ReviewRow } from '../../src/app/mushaf-1441/review/_lib/types'

test('CANONICAL_READERS defines exactly 10 readers and 20 distinct narrators', () => {
  assert.equal(CANONICAL_READERS.length, 10, 'Must have exactly 10 readers')
  const allNarratorIds = CANONICAL_READERS.flatMap((r) => r.narrators.map((n) => n.id))
  assert.equal(allNarratorIds.length, 20, 'Must have exactly 20 narrators')
  assert.equal(new Set(allNarratorIds).size, 20, 'All 20 narrators must have unique IDs')

  // Check Nafi narrators
  assert.equal(CANONICAL_READERS[0].id, 'Q01')
  assert.equal(CANONICAL_READERS[0].narrators[0].id, 'Q01-R01')
  assert.equal(CANONICAL_READERS[0].narrators[0].nameShort, 'قالون')
  assert.equal(CANONICAL_READERS[0].narrators[1].id, 'Q01-R02')
  assert.equal(CANONICAL_READERS[0].narrators[1].nameShort, 'ورش')

  // Check Asim narrators (including Hafs Q05-R02)
  const asim = CANONICAL_READERS.find((r) => r.id === 'Q05')
  assert.ok(asim, 'Asim Q05 must exist')
  assert.equal(asim.narrators[0].id, 'Q05-R01')
  assert.equal(asim.narrators[0].nameShort, 'شعبة')
  assert.equal(asim.narrators[1].id, 'Q05-R02')
  assert.equal(asim.narrators[1].nameShort, 'حفص')

  // Check Khalaf al-Ashir (Q10)
  assert.equal(CANONICAL_READERS[9].id, 'Q10')
  assert.equal(CANONICAL_READERS[9].narrators[0].id, 'Q10-R01')
  assert.equal(CANONICAL_READERS[9].narrators[0].nameShort, 'إسحاق')
  assert.equal(CANONICAL_READERS[9].narrators[1].id, 'Q10-R02')
  assert.equal(CANONICAL_READERS[9].narrators[1].nameShort, 'إدريس')
})

test('FALLBACK_USUL_CATEGORIES contains canonical categories without AYAH_COUNT', () => {
  assert.ok(FALLBACK_USUL_CATEGORIES.length >= 20, 'Must have at least 20 categories')
  assert.ok(!FALLBACK_USUL_CATEGORIES.some((c) => c.code === 'AYAH_COUNT'), 'AYAH_COUNT must be excluded')
  assert.ok(FALLBACK_USUL_CATEGORIES.some((c) => c.code === 'IMALAH_TAQLIL'))
  assert.ok(FALLBACK_USUL_CATEGORIES.some((c) => c.code === 'IDGHAM_KABIR'))
  assert.ok(FALLBACK_USUL_CATEGORIES.some((c) => c.code === 'USUL_MADD'))
})

test('CANONICAL_VARIANT_TYPES covers standard Farsh changes', () => {
  assert.ok(CANONICAL_VARIANT_TYPES.some((t) => t.code === 'تشكيل'))
  assert.ok(CANONICAL_VARIANT_TYPES.some((t) => t.code === 'حرف'))
  assert.ok(CANONICAL_VARIANT_TYPES.some((t) => t.code === 'زيادة'))
  assert.ok(CANONICAL_VARIANT_TYPES.some((t) => t.code === 'حذف'))
})

test('canonicalKeyForWord formats zero-padded SSS:AAA:WWW key', () => {
  const dummyWord = {
    id: 'w1',
    pageNumber: 3,
    lineNumber: 2,
    wordIndexInLine: 1,
    surahNumber: 2,
    ayahNumber: 6,
    wordIndexInAyah: 1,
    ayahKey: '2:6',
    textUthmani: 'إِنَّ',
  }
  assert.equal(canonicalKeyForWord(dummyWord), '002:006:001')
})

test('worstStatus returns worst-first precedence', () => {
  assert.equal(worstStatus(['reviewed', 'reviewed']), 'reviewed')
  assert.equal(worstStatus(['reviewed', 'unreviewed']), 'unreviewed')
  assert.equal(worstStatus(['reviewed', 'flagged']), 'flagged')
  assert.equal(worstStatus(['unreviewed', 'flagged']), 'flagged')
  assert.equal(worstStatus([]), null)
})

test('filterReviewRows handles kind and status filtering correctly', () => {
  const dummyRows: ReviewRow[] = [
    {
      entryId: 'e1',
      locationId: 'loc1',
      version: 'v1',
      kind: 'farsh',
      categoryCode: null,
      categoryNameAr: null,
      surah: 2,
      ayah: 6,
      startWord: 1,
      endAyah: 2,
      endWord: 1,
      startKey: '002:006:001',
      endKey: '002:006:001',
      page: 3,
      hafsText: 'إِنَّ',
      readingText: 'أَنَّ',
      uthmaniText: 'إِنَّ',
      description: null,
      performanceNote: null,
      variantType: 'تشكيل',
      rulingText: null,
      options: null,
      notes: null,
      reviewStatus: 'unreviewed',
      locationReviewStatus: 'unreviewed',
      verificationStatus: 'verified',
      legacyRef: null,
      entryOrder: 1,
      deleted: false,
      appliesWasl: true,
      appliesWaqf: true,
      hamzahDetail: null,
      narrators: [],
      flags: [],
    },
    {
      entryId: 'e2',
      locationId: 'loc2',
      version: 'v1',
      kind: 'usul',
      categoryCode: 'IMALAH_TAQLIL',
      categoryNameAr: 'الممال والمقلل',
      surah: 2,
      ayah: 6,
      startWord: 2,
      endAyah: 2,
      endWord: 2,
      startKey: '002:006:002',
      endKey: '002:006:002',
      page: 3,
      hafsText: 'ٱلَّذِينَ',
      readingText: null,
      uthmaniText: null,
      description: null,
      performanceNote: null,
      variantType: null,
      rulingText: 'تقليل',
      options: null,
      notes: null,
      reviewStatus: 'reviewed',
      locationReviewStatus: 'reviewed',
      verificationStatus: 'verified',
      legacyRef: null,
      entryOrder: 2,
      deleted: false,
      appliesWasl: true,
      appliesWaqf: true,
      hamzahDetail: null,
      narrators: [],
      flags: [],
    },
  ]

  assert.equal(filterReviewRows(dummyRows, 'all', 'all').length, 2)
  assert.equal(filterReviewRows(dummyRows, 'unreviewed', 'all').length, 1)
  assert.equal(filterReviewRows(dummyRows, 'reviewed', 'all').length, 1)
  assert.equal(filterReviewRows(dummyRows, 'all', 'farsh').length, 1)
  assert.equal(filterReviewRows(dummyRows, 'all', 'usul').length, 1)
})

test('isImalahCategory recognizes IMALAH_TAQLIL correctly', () => {
  assert.equal(isImalahCategory('IMALAH_TAQLIL'), true)
  assert.equal(isImalahCategory('TARQIQ_RA'), false)
  assert.equal(isImalahCategory('TAGHYIR_HAMZ'), false)
  assert.equal(isImalahCategory(null), false)
})

test('detectImalahType parses Arabic ruling descriptions correctly', () => {
  assert.equal(detectImalahType('إمالة الألف وصلاً ووقفاً'), 'إمالة')
  assert.equal(detectImalahType('إمالة كبرى'), 'إمالة')
  assert.equal(detectImalahType('تقليل الألف عند الوقف'), 'تقليل')
  assert.equal(detectImalahType('بين بين (تقليل)'), 'تقليل')
  assert.equal(detectImalahType('إمالة وتقليل الألف وصلاً ووقفاً'), 'إمالة وتقليل')
  assert.equal(detectImalahType('نقل حركة الهمزة'), null)
  assert.equal(detectImalahType(null), null)
  assert.equal(detectImalahType(''), null)
})

test('buildImalahRulingText constructs accurate rulings for all wasl/waqf combinations', () => {
  // Wasl & Waqf (both true)
  assert.equal(buildImalahRulingText('إمالة', true, true), 'إمالة الألف وصلاً ووقفاً')
  assert.equal(buildImalahRulingText('تقليل', true, true), 'تقليل الألف وصلاً ووقفاً')
  assert.equal(buildImalahRulingText('إمالة وتقليل', true, true), 'إمالة وتقليل الألف وصلاً ووقفاً')

  // Waqf only (wasl = false, waqf = true)
  assert.equal(buildImalahRulingText('إمالة', false, true), 'إمالة الألف عند الوقف')
  assert.equal(buildImalahRulingText('تقليل', false, true), 'تقليل الألف عند الوقف')

  // Wasl only (wasl = true, waqf = false)
  assert.equal(buildImalahRulingText('إمالة', true, false), 'إمالة الألف عند الوصل')
  assert.equal(buildImalahRulingText('تقليل', true, false), 'تقليل الألف عند الوصل')
})

test('Imalah and Taqlil narrator presets map to canonical authorities and actions', () => {
  // Imalah narrators: Hamzah (2), Kisai (2), Khalaf al-Ashir (2) = 6
  assert.equal(IMALAH_NARRATOR_IDS.length, 6)
  assert.ok(IMALAH_NARRATOR_IDS.includes('Q06-R01')) // خلف عن حمزة
  assert.ok(IMALAH_NARRATOR_IDS.includes('Q06-R02')) // خلاد عن حمزة
  assert.ok(IMALAH_NARRATOR_IDS.includes('Q07-R01')) // أبو الحارث عن الكسائي
  assert.ok(IMALAH_NARRATOR_IDS.includes('Q07-R02')) // الدوري عن الكسائي
  assert.ok(IMALAH_NARRATOR_IDS.includes('Q10-R01')) // إسحاق
  assert.ok(IMALAH_NARRATOR_IDS.includes('Q10-R02')) // إدريس

  // Taqlil narrators: Warsh (1), Abu Amr (2) = 3
  assert.equal(TAQLIL_NARRATOR_IDS.length, 3)
  assert.ok(TAQLIL_NARRATOR_IDS.includes('Q01-R02')) // ورش عن نافع
  assert.ok(TAQLIL_NARRATOR_IDS.includes('Q03-R01')) // الدوري عن أبي عمرو
  assert.ok(TAQLIL_NARRATOR_IDS.includes('Q03-R02')) // السوسي عن أبي عمرو

  assert.equal(WARSH_NARRATOR_ID, 'Q01-R02')
})


test('imalah face builder: action text covers every type/performance/khulf combination', () => {
  assert.equal(buildFaceActionText('تقليل', 'waqf_only', 'bikhulf'), 'تقليل وقفاً (بخلف عنه)')
  assert.equal(buildFaceActionText('إمالة', 'wasl_only', 'qawlan_wahidan'), 'إمالة وصلاً')
  assert.equal(buildFaceActionText('فتح', 'wasl_waqf', 'qawlan_wahidan'), 'فتح وصلاً ووقفاً')
})

test('imalah face builder: extra faces for the same narrator get the next wajh number', () => {
  const faces = [
    { id: 'Q01-R02', action: 'تقليل وقفاً (بخلف عنه)', wajhOrder: 1, wajhNote: 'بخلف عنه' },
    { id: 'Q01-R02', action: 'فتح وقفاً (بخلف عنه)', wajhOrder: 3, wajhNote: 'بخلف عنه' },
  ]
  assert.equal(nextWajhOrder(faces, 'Q01-R02'), 4)
  assert.equal(nextWajhOrder(faces, 'Q03-R01'), 1)
  // D8: Hafs never takes wajh 1
  assert.equal(nextWajhOrder([], 'Q05-R02'), 2)
})

test('isHamzahCategory recognizes Hamzah chapters correctly', () => {
  assert.equal(isHamzahCategory('HAMZATAN_KALIMA'), true)
  assert.equal(isHamzahCategory('HAMZATAN_KALIMATAYN'), true)
  assert.equal(isHamzahCategory('TAGHYIR_HAMZ'), true)
  assert.equal(isHamzahCategory('IMALAH_TAQLIL'), false)
  assert.equal(isHamzahCategory('TARQIQ_RA'), false)
  assert.equal(isHamzahCategory(null), false)
})

test('buildHamzahFaceActionText generates standard scholarly action text', () => {
  // HAMZATAN_KALIMA
  assert.equal(
    buildHamzahFaceActionText('HAMZATAN_KALIMA', {
      kalimaFirst: 'تحقيق',
      kalimaSecond: 'تسهيل',
      kalimaIdkhal: true,
      performance: 'wasl_waqf',
      khulf: 'qawlan_wahidan',
    }),
    'تسهيل الثانية مع الإدخال وصلاً ووقفاً'
  )
  assert.equal(
    buildHamzahFaceActionText('HAMZATAN_KALIMA', {
      kalimaFirst: 'تحقيق',
      kalimaSecond: 'إبدال',
      kalimaIdkhal: false,
      performance: 'wasl_waqf',
      khulf: 'bikhulf',
    }),
    'إبدال الثانية حرف مد بدون إدخال وصلاً ووقفاً (بخلف عنه)'
  )
  assert.equal(
    buildHamzahFaceActionText('HAMZATAN_KALIMA', {
      kalimaFirst: 'تحقيق',
      kalimaSecond: 'تحقيق',
      kalimaIdkhal: false,
      performance: 'wasl_waqf',
      khulf: 'qawlan_wahidan',
    }),
    'تحقيق الهمزتين بدون إدخال وصلاً ووقفاً'
  )

  // HAMZATAN_KALIMATAYN
  assert.equal(
    buildHamzahFaceActionText('HAMZATAN_KALIMATAYN', {
      kalimataynFirst: 'إسقاط',
      kalimataynSecond: 'تحقيق',
      performance: 'wasl_only',
      khulf: 'qawlan_wahidan',
    }),
    'إسقاط الأولى وصلاً'
  )
  assert.equal(
    buildHamzahFaceActionText('HAMZATAN_KALIMATAYN', {
      kalimataynFirst: 'تحقيق',
      kalimataynSecond: 'تسهيل',
      performance: 'wasl_only',
      khulf: 'bikhulf',
    }),
    'تسهيل الثانية بين بين وصلاً (بخلف عنه)'
  )

  // TAGHYIR_HAMZ
  assert.equal(
    buildHamzahFaceActionText('TAGHYIR_HAMZ', {
      singleTreatment: 'إبدال',
      performance: 'wasl_waqf',
      khulf: 'qawlan_wahidan',
    }),
    'إبدال الهمزة وصلاً ووقفاً'
  )
  assert.equal(
    buildHamzahFaceActionText('TAGHYIR_HAMZ', {
      singleTreatment: 'تسهيل',
      performance: 'waqf_only',
      khulf: 'bikhulf',
    }),
    'تسهيل الهمزة وقفاً (بخلف عنه)'
  )
})

test('Hamzah presets map accurately to canonical authorities', () => {
  assert.ok(KALIMA_TASHIL_IDKHAL_IDS.includes('Q01-R01')) // قالون
  assert.ok(KALIMA_TASHIL_IDKHAL_IDS.includes('Q03-R01')) // الدوري عن أبي عمرو
  assert.ok(KALIMA_TASHIL_NO_IDKHAL_IDS.includes('Q01-R02')) // ورش
  assert.ok(KALIMA_TASHIL_NO_IDKHAL_IDS.includes('Q02-R01')) // البزي
  assert.ok(KALIMA_TAHQIQ_IDS.includes('Q05-R02')) // حفص
  assert.ok(KALIMA_TAHQIQ_IDS.includes('Q06-R01')) // خلف عن حمزة

  assert.ok(KALIMATAYN_ISQAT_FIRST_IDS.includes('Q03-R01')) // الدوري عن أبي عمرو
  assert.ok(KALIMATAYN_ISQAT_FIRST_IDS.includes('Q03-R02')) // السوسي عن أبي عمرو
  assert.ok(KALIMATAYN_TASHIL_SECOND_IDS.includes('Q01-R02')) // ورش
  assert.ok(KALIMATAYN_TASHIL_SECOND_IDS.includes('Q02-R02')) // قنبل
})

test('validateEntryDraft enforces Farsh, Usul, and narrator constraints', () => {
  // Farsh requires non-empty reading text
  assert.deepEqual(validateEntryDraft('farsh', '', null, 1), {
    valid: false,
    error: 'نص القراءة مطلوب لفرش الحروف',
  })
  assert.deepEqual(validateEntryDraft('farsh', '   ', null, 1), {
    valid: false,
    error: 'نص القراءة مطلوب لفرش الحروف',
  })

  // Farsh requires at least one narrator
  assert.deepEqual(validateEntryDraft('farsh', 'مَلِكِ', null, 0), {
    valid: false,
    error: 'يجب اختيار راوٍ واحد على الأقل',
  })

  // Valid Farsh
  assert.deepEqual(validateEntryDraft('farsh', 'مَلِكِ', null, 2), {
    valid: true,
  })

  // Usul requires non-empty categoryCode
  assert.deepEqual(validateEntryDraft('usul', '', null, 1), {
    valid: false,
    error: 'الباب / القاعدة مطلوبة لأصول القراءات',
  })

  // Usul requires at least one narrator
  assert.deepEqual(validateEntryDraft('usul', '', 'TAGHYIR_HAMZ', 0), {
    valid: false,
    error: 'يجب اختيار راوٍ واحد على الأقل',
  })

  // Valid Usul
  assert.deepEqual(validateEntryDraft('usul', '', 'TAGHYIR_HAMZ', 1), {
    valid: true,
  })
})

test('serializeDraftSnapshot accurately identifies dirty changes', () => {
  const base = {
    kind: 'farsh' as const,
    categoryCode: null,
    readingText: 'مَلِكِ',
    variantType: 'تشكيل',
    rulingText: null,
    description: 'قراءة عاصم والكسائي',
    performanceNote: null,
    appliesWasl: true,
    appliesWaqf: true,
    hamzahDetail: null,
    narrators: [{ id: 'Q05-R02', action: 'قراءة', wajhOrder: 1, wajhNote: null }],
  }

  const snap1 = serializeDraftSnapshot(base)
  const snap2 = serializeDraftSnapshot({ ...base })
  assert.equal(snap1, snap2, 'Identical objects should produce identical snapshots (not dirty)')

  // Modifying text
  const dirtyText = serializeDraftSnapshot({ ...base, readingText: 'مَالِكِ' })
  assert.notEqual(snap1, dirtyText, 'Different readingText must produce dirty snapshot')

  // Modifying appliesWasl
  const dirtyWasl = serializeDraftSnapshot({ ...base, appliesWasl: false })
  assert.notEqual(snap1, dirtyWasl, 'Toggling appliesWasl must produce dirty snapshot')

  // Modifying kind
  const dirtyKind = serializeDraftSnapshot({ ...base, kind: 'usul', categoryCode: 'USUL_MADD' })
  assert.notEqual(snap1, dirtyKind, 'Changing kind must produce dirty snapshot')

  // Adding narrator
  const dirtyNarrators = serializeDraftSnapshot({
    ...base,
    narrators: [...base.narrators, { id: 'Q07-R01', action: 'قراءة', wajhOrder: 1, wajhNote: null }],
  })
  assert.notEqual(snap1, dirtyNarrators, 'Changing narrators must produce dirty snapshot')
})

