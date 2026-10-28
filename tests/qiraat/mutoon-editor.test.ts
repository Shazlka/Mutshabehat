import { test } from 'node:test'
import assert from 'node:assert/strict'
import { definitionFor, findWord, validateMark, type Mark, type Verse } from '../../src/app/mushaf-1441/mutoon-editor/data'

const verse: Verse = { number: 108, lines: ['رَاوِيهِ رَاوِيهِ', 'صُحْبَةٌ حَقٌّ'], printedPage: '9', pageId: 15 }
const mark: Mark = { work: 'shatibiyyah', verse: 108, line: 0, word: 'رَاوِيهِ', occurrence: 2, mode: 'letter', symbol: 'ر', kind: 'reader', readingIds: ['Q07'], note: 'وجه القراءة', source: 'الوافي ص ٥٠', status: 'verified', method: 'hand' }

test('repeated word selects the requested occurrence', () => {
  assert.equal(findWord(verse.lines[0], 'رَاوِيهِ', 2), 'رَاوِيهِ')
  assert.equal(findWord(verse.lines[0], 'رَاوِيهِ', 3), null)
  assert.equal(validateMark(mark, verse), null)
})

test('changing text invalidates a mark until it is moved or removed', () => {
  assert.equal(validateMark(mark, { ...verse, lines: ['رَاوِيهِ وَقَالَ', verse.lines[1]] }), 'الكلمة غير موجودة في الشطر')
})

test('the same letter resolves differently by poem', () => {
  assert.deepEqual(definitionFor('shatibiyyah', 'أ')?.readingIds, ['Q01'])
  assert.deepEqual(definitionFor('durrah', 'أ')?.readingIds, ['Q08'])
  assert.equal(validateMark({ ...mark, work: 'durrah', symbol: 'أ', readingIds: ['Q01'] }, verse), 'القراء أو الرواة لا يوافقون تعريف الرمز')
})

test('a verified mark requires a cited source and the right word mode', () => {
  assert.equal(validateMark({ ...mark, source: '' }, verse), 'أضف مصدر التحقق قبل اعتماد الرمز')
  assert.equal(validateMark({ ...mark, mode: 'word' }, verse), 'الحرف لا يبدأ الكلمة المحددة')
  assert.equal(validateMark({ ...mark, status: 'extracted', source: '' }, verse), null)
})
