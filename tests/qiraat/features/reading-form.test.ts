import assert from 'node:assert/strict'
import test from 'node:test'
import { displayWord, readingForm, withNaql } from '../../../packages/qiraat-core/features/readingForm'
import {
  actionAddsInformation,
  classificationSegments,
  subCategoryForDifference,
  usulSubCategory,
} from '../../../packages/qiraat-core/features/classification'
import type { QiraatRuling, QiraatVariant } from '../../../packages/qiraat-core/types'

const cps = (s: string) => Array.from(s).map((c) => c.codePointAt(0)!)

// Ported from apps/ios MushafCore QiraatReadingFormTests.swift.
test('the rounded zero no longer cuts the word', () => {
  assert.ok(!cps(displayWord('أُو۟لَـٰٓئِكَ')).includes(0x06df))
  assert.equal(displayWord('كَأَنَّهُمْ'), 'كَأَنَّهُمْ')
})

test('silat adds the small waw after the meem', () => {
  const form = readingForm({ baseText: 'كَأَنَّهُمْ', action: 'قرأ بصلة ميم الجمع وصلا.', categoryCode: 'USUL_MIM_JAM' })
  assert.ok(form)
  assert.equal(cps(form!).at(-1), 0x06e5)
  assert.ok(!cps(form!).includes(0x0652))
  assert.ok(form!.includes('مُ'))
  assert.equal(readingForm({ baseText: 'كَأَنَّهُمْ', action: 'كسر الدوري الميم وصلا', categoryCode: 'USUL_MIM_JAM' }), null)
})

test('naql drops the hamza and moves its vowel', () => {
  const base = 'وَٱلْأَرْضَ'
  const form = readingForm({ baseText: base, action: 'قرأ بالنقل مع ترك السكت.', categoryCode: 'USUL_SAKT' })
  assert.ok(form)
  assert.ok(!cps(form!).includes(0x0623))
  assert.ok(form!.includes('لَ'))
  assert.ok(Array.from(form!).length < Array.from(base).length)
  // naql only at the stop, or sakt: the written word does not change
  assert.equal(readingForm({ baseText: base, action: 'قرأ بالسكت وصلاً، ووقف بالسكت والنقل.', categoryCode: 'USUL_SAKT' }), null)
  assert.equal(readingForm({ baseText: base, action: 'قرأ بترك السكت وصلا، ووقف بالنقل والتحقيق.', categoryCode: 'USUL_SAKT' }), null)
})

test('naql never crosses a word boundary inside one word', () => {
  assert.equal(withNaql('قَدْ أَفْلَحَ'), null)
})

test('naql across two words', () => {
  const form = readingForm({
    baseText: 'مِنْ', action: 'قرأ بالنقل وصلاً ووقفا.', categoryCode: 'USUL_NAQL', previousWord: null, nextWord: 'ءَامَنَ',
  })
  assert.ok(form)
  assert.ok(form!.includes(' '))
  assert.ok(!cps(form!).includes(0x0652))
  assert.ok(!form!.includes('ء'))
  assert.notEqual(
    readingForm({ baseText: 'أَفْلَحَ', action: 'قرأ بالنقل وصلاً ووقفا.', categoryCode: 'USUL_NAQL', previousWord: 'قَدْ', nextWord: null }),
    null,
  )
  // tanween before the hamza is not rewritten
  assert.equal(
    readingForm({ baseText: 'عَذَابٌ', action: 'قرأ بالنقل وصلاً ووقفا.', categoryCode: 'USUL_SAKT', previousWord: null, nextWord: 'أَلِيمٌ' }),
    null,
  )
})

test('silat on a meem that already has a damma or no vowel', () => {
  const a = readingForm({ baseText: 'هُمُ', action: 'قرأ بصلة ميم الجمع وصلا.', categoryCode: 'USUL_MIM_JAM' })
  assert.equal(cps(a!).at(-1), 0x06e5)
  const b = readingForm({ baseText: 'قُلُوبِهِم', action: 'قرأ بصلة ميم الجمع وصلا.', categoryCode: 'USUL_MIM_JAM' })
  assert.deepEqual(cps(b!).slice(-2), [0x064f, 0x06e5])
})

// Classification (apps/ios Sources/Qiraat/QiraatClassification.swift)
function ruling(over: Partial<QiraatRuling>): QiraatRuling {
  return {
    id: 'r', pageNumber: 1, category: 'IMALAH_TAQLIL', categoryAr: 'الممال والمقلل', color: '#C026D3', wordAnchored: true,
    surah: 1, ayah: 1, startToken: 1, endToken: 1, endAyah: 1, baseText: 'x', verificationStatus: 'REVIEWED',
    attribution: [], readings: [], hasAlternate: false, createdAt: '', updatedAt: '', ...over,
  }
}

test('a farsh variant reads «فرش الحروف › sub-category» and an unclassified type reads «غير مصنَّف», never «أخرى»', () => {
  const v = { differenceType: 'HARAKAH' } as QiraatVariant
  assert.deepEqual(classificationSegments(v).map((s) => s.label), ['فرش الحروف', 'تشكيل'])
  assert.equal(subCategoryForDifference(null), 'غير مصنَّف')
  assert.equal(subCategoryForDifference(' harakah '), 'تشكيل')
  assert.equal(subCategoryForDifference('REORDER'), 'تقديم وتأخير')
  assert.ok(!subCategoryForDifference('anything-else').includes('أخرى'))
})

test('an usul ruling reads «أصول القراءات › باب» and adds the database sub-category when there is one', () => {
  assert.deepEqual(classificationSegments(ruling({})).map((s) => s.label), ['أصول القراءات', 'الممال والمقلل'])
  assert.deepEqual(
    classificationSegments(ruling({ subCategory: 'إمالة كبرى' })).map((s) => s.label),
    ['أصول القراءات', 'الممال والمقلل', 'إمالة كبرى'],
  )
})

test('with no sub-category a single short informative action stands in; a long or repeated one does not', () => {
  const att = (action: string) => ({ authorityId: 'Q06', action })
  assert.equal(usulSubCategory(ruling({ attribution: [att('إمالة')] })), 'إمالة')
  assert.equal(usulSubCategory(ruling({ attribution: [att('الممال والمقلل')] })), null)
  assert.equal(usulSubCategory(ruling({ attribution: [att('إمالة'), att('تقليل')] })), null)
  assert.equal(usulSubCategory(ruling({ attribution: [att('قرأ بالإمالة وصلا ووقفا في هذا الموضع كله')] })), null)
  assert.equal(actionAddsInformation('الْمُمَالُ والمقلل', 'الممال والمقلل'), false)
})
