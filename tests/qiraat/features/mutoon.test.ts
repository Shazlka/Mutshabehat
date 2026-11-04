import assert from 'node:assert/strict'
import test from 'node:test'
import { mutoonWorks, searchMutoon, type MutoonSnapshot } from '../../../packages/qiraat-core/features/mutoon'

const verse = (number: number, lines: string[]) => ({ number, lines, printedPage: null, pageId: null })
const snapshot: MutoonSnapshot = {
  seq: 7,
  document: {
    mutoon: {
      schemaVersion: 1,
      works: [
        { work: 'tayyibah', title: 'طيبة النشر', author: 'ابن الجزري', bookId: null, chapters: [{ title: 'باب الهمز', farsh: false, verses: [verse(2, ['ب']), verse(1, ['أ'])] }] },
        { work: 'shatibiyyah', title: 'الشاطبية', author: 'الشاطبي', bookId: 1, chapters: [
          { title: 'باب المد', farsh: false, verses: [verse(1, ['وَمَدُّ الْبَدَلِ جَاءَ', 'فِي الْقُرْآنِ'])] },
          { title: 'سورة البقرة', farsh: true, verses: [verse(2, ['ٱلصِّرَٰطَ فِي الْبَقَرَةِ'])] },
        ] },
        { work: 'durrah', title: 'الدرة', author: 'ابن الجزري', bookId: null, chapters: [] },
      ],
    },
  },
}

test('the works come in the fixed order of the three books whatever order the server sent', () => {
  assert.deepEqual(mutoonWorks(snapshot).map((w) => w.work), ['shatibiyyah', 'durrah', 'tayyibah'])
})

test('chapters keep their order and the verses of a chapter are sorted by number', () => {
  const tayyibah = mutoonWorks(snapshot).find((w) => w.work === 'tayyibah')!
  assert.deepEqual(tayyibah.chapters[0].verses.map((v) => v.number), [1, 2])
  const shatibiyyah = mutoonWorks(snapshot).find((w) => w.work === 'shatibiyyah')!
  assert.deepEqual(shatibiyyah.chapters.map((c) => [c.title, c.farsh]), [['باب المد', false], ['سورة البقرة', true]])
})

test('an empty or missing snapshot gives no works and no results', () => {
  assert.deepEqual(mutoonWorks(null), [])
  assert.deepEqual(mutoonWorks({ seq: 0, document: { mutoon: { schemaVersion: 1, works: [] } } }), [])
  assert.deepEqual(searchMutoon(null, 'المد'), [])
})

test('search ignores diacritics and alef forms and reports where each hit is', () => {
  const hits = searchMutoon(snapshot, 'الصراط')
  assert.equal(hits.length, 1)
  assert.deepEqual(
    { work: hits[0].work, workTitle: hits[0].workTitle, chapter: hits[0].chapterTitle, verse: hits[0].verse.number },
    { work: 'shatibiyyah', workTitle: 'الشاطبية', chapter: 'سورة البقرة', verse: 2 },
  )
  assert.equal(searchMutoon(snapshot, 'مد البدل').length, 1)
})

test('a blank query finds nothing, and a query that matches nothing finds nothing', () => {
  assert.deepEqual(searchMutoon(snapshot, '   '), [])
  assert.deepEqual(searchMutoon(snapshot, 'لا شيء كهذا'), [])
})

test('search results are capped at 100', () => {
  const many: MutoonSnapshot = {
    seq: 1,
    document: { mutoon: { schemaVersion: 1, works: [{ work: 'durrah', title: 'الدرة', author: 'x', bookId: null, chapters: [{ title: 'باب', farsh: false, verses: Array.from({ length: 150 }, (_, i) => verse(i + 1, ['كلمة'])) }] }] } },
  }
  const hits = searchMutoon(many, 'كلمة')
  assert.equal(hits.length, 100)
})
