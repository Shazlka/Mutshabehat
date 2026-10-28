import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  definitionFor,
  findWord,
  validateAssignment,
  validateMark,
  wordLetters,
  replaceWordInLine,
  insertWordInLine,
  compileAnnotations,
  type Mark,
  type Verse,
  type WordAssignment,
  type EditorData,
} from '../../src/app/mushaf-1441/mutoon-editor/data'

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

test('a word can name any reader or narrator independently of poem symbols', () => {
  const assignment: WordAssignment = { work: 'shatibiyyah', verse: 108, line: 0, word: 'رَاوِيهِ', occurrence: 2, readingIds: ['Q01', 'Q10-R02'], note: '', source: '' }
  assert.equal(validateAssignment(assignment, verse), null)
  assert.equal(validateAssignment({ ...assignment, readingIds: ['Q99'] }, verse), 'اختر قارئًا أو راويًا معروفًا دون تكرار')
  assert.equal(validateAssignment({ ...assignment, readingIds: ['Q01','Q01'] }, verse), 'اختر قارئًا أو راويًا معروفًا دون تكرار')
  assert.equal(validateAssignment({ ...assignment, occurrence: 3 }, verse), 'الكلمة غير موجودة في الشطر')
  assert.equal(validateAssignment(assignment, { ...verse, lines: ['تَغَيَّرَ النَّصُّ', verse.lines[1]] }), 'الكلمة غير موجودة في الشطر')
})

test('letter signs follow Arabic grapheme clusters and reject an out-of-range letter', () => {
  assert.deepEqual(wordLetters('رَاوِيهِ'), ['رَ','ا','وِ','ي','هِ'])
  const assignment: WordAssignment = { work: 'shatibiyyah', verse: 108, line: 0, word: 'رَاوِيهِ', occurrence: 2, mode: 'letter', letterIndex: 4, readingIds: ['Q03-R01'], note: '', source: '' }
  assert.equal(validateAssignment(assignment, verse), null)
  assert.equal(validateAssignment({ ...assignment, letterIndex: 5 }, verse), 'الحرف المحدد غير موجود في الكلمة')
  assert.equal(validateAssignment({ ...assignment, letterIndex: -1 }, verse), 'الحرف المحدد غير موجود في الكلمة')
  assert.equal(validateAssignment({ ...assignment, mode: 'word' }, verse), null)
})

test('word editing and insertion helpers update line text cleanly', () => {
  const line = 'رَاوِيهِ نَاصِرٌ حَلَا'
  const updated = replaceWordInLine(line, 'نَاصِرٌ', 1, 'غَيْثٌ')
  assert.equal(updated, 'رَاوِيهِ غَيْثٌ حَلَا')

  const inserted = insertWordInLine(line, 0, 'وَقَالَ', 'before')
  assert.equal(inserted, 'وَقَالَ رَاوِيهِ نَاصِرٌ حَلَا')
})

test('compileAnnotations builds proper MatnSymbolAnnotation array for iOS', () => {
  const doc: EditorData = {
    mutoon: {
      schemaVersion: 1,
      works: [
        {
          work: 'shatibiyyah',
          title: 'الشاطبية',
          author: 'الشاطبي',
          bookId: 1,
          chapters: [{ title: 'الفاتحة', farsh: true, verses: [verse] }],
        },
        {
          work: 'durrah',
          title: 'الدرة',
          author: 'ابن الجزري',
          bookId: 2,
          chapters: [],
        },
        {
          work: 'tayyibah',
          title: 'طيبة النشر',
          author: 'ابن الجزري',
          bookId: 3,
          chapters: [],
        },
      ],
    },
    marks: { marks: [mark] },
    assignments: {
      schemaVersion: 1,
      assignments: [
        {
          work: 'shatibiyyah',
          verse: 108,
          line: 1,
          word: 'صُحْبَةٌ',
          occurrence: 1,
          mode: 'word',
          readingIds: ['Q06', 'Q07'],
          note: 'حمزة والكسائي',
          source: 'الوافي',
        },
      ],
    },
  }

  const annotations = compileAnnotations(doc)
  assert.equal(annotations.length, 2)
  const markAnnotation = annotations.find(a => a.line === 0)
  assert.ok(markAnnotation)
  assert.equal(markAnnotation?.work, 'shatibiyyah')
  assert.equal(markAnnotation?.verse, 108)
  assert.equal(markAnnotation?.status, 'verified')

  const assignmentAnnotation = annotations.find(a => a.line === 1)
  assert.ok(assignmentAnnotation)
  assert.equal(assignmentAnnotation?.word, undefined) // standard annotation fields
  assert.deepEqual(assignmentAnnotation?.readingIds, ['Q06', 'Q07'])
})
