import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMushaf1441Page } from '../../../packages/quran-data/mushaf1441/pageLoader'
import { defaultQiraatRepository } from '../../../packages/qiraat-core/repository'
import { variantsForToken } from '../../../packages/qiraat-core/engine'
import {
  isQiraatMarkedWord,
  matchesFilter,
  rulingMarkerForWord,
} from '../../../src/app/mushaf-1441/_components/qiraat/qiraatWordMarker'
import { toOrderable } from '../../../packages/qiraat-core/features/wordOrder'
import type { QiraatComparisonFilter } from '../../../src/app/mushaf-1441/_components/qiraat/types'

// The viewer's inline logic before the extraction (qiraatSelectionForWord), copied verbatim.
function oldPredicate(word: any, variants: any[], rulings: any[], filter: QiraatComparisonFilter): boolean {
  const r = rulingMarkerForWord(rulings, word.surahNumber, word.ayahNumber, word.wordIndexInAyah, filter)?.rulings ?? []
  const all = variantsForToken(variants, word.surahNumber, word.ayahNumber, word.wordIndexInAyah, { includeUnpublished: true })
  const v = filter.kind === 'all' ? all : all.filter((x) => matchesFilter(x, filter))
  return r.length > 0 || v.length > 0
}

const FILTERS: QiraatComparisonFilter[] = [
  { kind: 'all' },
  { kind: 'reader', readerId: 'Q01' },
  { kind: 'reading', readingId: 'Q01-R02' },
]

test('isQiraatMarkedWord equals the viewer predicate on every word of page 17', async () => {
  const page = await loadMushaf1441Page(17)
  assert.ok(page, 'page 17 loads')
  const words = page.lines.flatMap((l) => l.words)
  const variants = await defaultQiraatRepository.getVariantsForPage(17, { includeUnpublished: true })
  const rulings = await defaultQiraatRepository.getRulingsForPage(17, { includeUnpublished: true })
  assert.ok(variants.length + rulings.length > 0, 'page 17 has Qiraat data')
  let marked = 0
  for (const filter of FILTERS) {
    for (const word of words) {
      const expected = oldPredicate(word, variants, rulings, filter)
      const got = isQiraatMarkedWord(word, { variants, rulings, filter, includeUnpublished: true })
      assert.equal(got, expected, `word ${word.id} filter ${filter.kind}`)
      if (expected) marked += 1
    }
  }
  assert.ok(marked > 0, 'at least one word is marked')
})

test('toOrderable maps the viewer word fields', () => {
  const o = toOrderable({
    id: 'w', pageNumber: 17, lineNumber: 3, wordIndexInLine: 4, surahNumber: 2, ayahNumber: 9, wordIndexInAyah: 5,
    ayahKey: '2:9', textUthmani: 'x',
  })
  assert.deepEqual(o, { id: 'w', surah: 2, ayah: 9, tokenInAyah: 5, page: 17, line: 3, indexInLine: 4 })
})
