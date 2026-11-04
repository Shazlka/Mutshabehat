import assert from 'node:assert/strict'
import test from 'node:test'
import { legendRows } from '../../../packages/qiraat-core/features/legend'
import { READER_COLOR } from '../../../packages/qiraat-core/colors'
import type { QiraatRuling, QiraatVariant } from '../../../packages/qiraat-core/types'

function variant(id: string, readingIds: string[], text = 'كلمة'): QiraatVariant {
  return {
    id, surah: 1, ayah: 1, startToken: 1, endToken: 1, operation: 'REPLACE', hafsText: 'x', variantText: text,
    differenceType: 'HARAKAH', verificationStatus: 'REVIEWED', createdAt: '', updatedAt: '', readingIds: readingIds as never,
  }
}
function ruling(category: string, categoryAr: string, color: string, baseText = 'حكم'): QiraatRuling {
  return {
    id: `r-${category}`, pageNumber: 1, category, categoryAr, color, wordAnchored: true, surah: 1, ayah: 1, startToken: 1,
    endToken: 1, endAyah: 1, baseText, verificationStatus: 'REVIEWED', attribution: [], readings: [], hasAlternate: false,
    createdAt: '', updatedAt: '',
  }
}

test('every reader colour appears exactly once, with no duplicate keys', () => {
  const rows = legendRows({}, {})
  assert.equal(rows.readers.length, Object.keys(READER_COLOR).length)
  assert.deepEqual(rows.readers.map((r) => r.color).sort(), Object.values(READER_COLOR).sort())
  const all = [...rows.readers, ...rows.narrators, ...rows.abwab, ...rows.marks].map((r) => r.key)
  assert.equal(new Set(all).size, all.length)
  assert.equal(rows.narrators.length, 20)
})

test('with no data no row has a sample word, and the rows are still listed', () => {
  const rows = legendRows({}, {})
  assert.ok([...rows.readers, ...rows.narrators].every((r) => r.sampleWord === undefined))
  assert.equal(rows.abwab.length, 0)
})

test('a reader gets a sample word that only its own narrators read, with its page', () => {
  const rows = legendRows(
    { 7: [variant('a', ['Q01-R01', 'Q05-R02'], 'مشترك'), variant('b', ['Q01-R01', 'Q01-R02'], 'نافع وحده')] },
    {},
  )
  assert.deepEqual(rows.readers.find((r) => r.key === 'Q01')?.sampleWord, { text: 'نافع وحده', page: 7 })
  assert.equal(rows.readers.find((r) => r.key === 'Q05')?.sampleWord, undefined)
})

test('a narrator gets a sample word only that narrator reads', () => {
  const rows = legendRows({ 3: [variant('a', ['Q01-R01', 'Q01-R02']), variant('b', ['Q01-R02'], 'ورش وحده')] }, {})
  assert.deepEqual(rows.narrators.find((r) => r.key === 'Q01-R02')?.sampleWord, { text: 'ورش وحده', page: 3 })
  assert.equal(rows.narrators.find((r) => r.key === 'Q01-R01')?.sampleWord, undefined)
})

test('the أبواب come from the rulings, one row per category in registry order, with a real word', () => {
  const rows = legendRows({}, {
    2: [ruling('SAKT', 'السكت', '#7C3AED', 'عِوَجَا'), ruling('IKHFA', 'الإخفاء', '#0891B2')],
    9: [ruling('SAKT', 'السكت', '#7C3AED', 'ثانية')],
  })
  assert.deepEqual(rows.abwab.map((r) => r.key), ['IKHFA', 'SAKT'])
  assert.deepEqual(rows.abwab.find((r) => r.key === 'SAKT')?.sampleWord, { text: 'عِوَجَا', page: 2 })
  assert.equal(rows.abwab.find((r) => r.key === 'SAKT')?.color, '#7C3AED')
})

test('the marks cover the dotted ذو وجهين line and the إمالة / تقليل dots, each with a text explanation', () => {
  const marks = legendRows({}, {}).marks
  const titles = marks.map((m) => m.label)
  assert.ok(titles.includes('خط منقّط تحت الكلمة'))
  assert.ok(titles.includes('نقطة مملوءة أسفل يسار الكلمة'))
  assert.ok(titles.includes('حلقة أسفل يسار الكلمة'))
  assert.ok(marks.every((m) => (m.explanation ?? '').length > 0))
})
