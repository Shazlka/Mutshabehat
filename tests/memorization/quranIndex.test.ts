import assert from 'node:assert/strict'
import test, { describe, it } from 'node:test'
import {
  makeAyahKey,
  ayahKeyString,
  type AyahKey,
} from '../../packages/memorization-core/types'
import {
  QuranIndex,
  type AyahLayoutRow,
} from '../../packages/memorization-core/quranIndex'
import { loadDefaultQuranIndex } from '../../packages/memorization-core/quranIndexNode'

describe('QuranIndexTests', () => {
  const index = loadDefaultQuranIndex()

  it('totalIs6236', () => {
    assert.equal(index.totalAyahs, 6236)
  })

  it('fatihaHasSevenAyatOnPageOne', () => {
    assert.equal(index.ayahCount(1), 7)
    assert.deepEqual(index.pagesOfSurah(1), { start: 1, end: 1 })
  })

  it('ayatKursiIsOnPage42', () => {
    assert.equal(index.page(makeAyahKey(2, 255)), 42)
  })

  it('pageWeightsSumTo604', () => {
    const totalWeight = index.ayahKeys.reduce((sum, key) => sum + index.weight(key), 0)
    assert.ok(Math.abs(totalWeight - 604) < 1e-6)

    const page50Weight = index.ayat(50).reduce((sum, key) => sum + index.weight(key), 0)
    assert.ok(Math.abs(page50Weight - 1.0) < 1e-9)
  })

  it('everyAyahHasExactlyOnePage', () => {
    const keys: AyahKey[] = []
    for (let p = 1; p <= 604; p += 1) {
      keys.push(...index.ayat(p))
    }
    assert.deepEqual(keys, index.ayahKeys)
    const set = new Set(keys.map(k => ayahKeyString(k)))
    assert.equal(set.size, index.totalAyahs)
  })

  it('juzCoverAllPagesWithoutOverlap', () => {
    let previousEnd = 0
    for (let juz = 1; juz <= 30; juz += 1) {
      const pages = index.pagesOfJuz(juz)
      assert.ok(pages !== undefined)
      assert.equal(pages.start, previousEnd + 1)
      for (let p = pages.start; p <= pages.end; p += 1) {
        assert.equal(index.juzOfPage(p), juz)
      }
      previousEnd = pages.end
    }
    assert.equal(previousEnd, 604)
  })

  it('lastJuzStartsAtNabaa', () => {
    const juz30 = index.ayatOfJuz(30)
    assert.deepEqual(juz30[0], makeAyahKey(78, 1))
  })

  it('spanCrossesSurahsInMushafOrder', () => {
    const span = index.ayatBetween(makeAyahKey(2, 285), makeAyahKey(3, 2))
    assert.deepEqual(span, [
      makeAyahKey(2, 285),
      makeAyahKey(2, 286),
      makeAyahKey(3, 1),
      makeAyahKey(3, 2),
    ])
  })

  it('spanIsOrderInsensitive', () => {
    const first = makeAyahKey(2, 285)
    const last = makeAyahKey(3, 2)
    assert.deepEqual(index.ayatBetween(first, last), index.ayatBetween(last, first))
  })

  it('unknownKeyHasNoOrdinal', () => {
    assert.equal(index.ordinal(makeAyahKey(1, 8)), undefined)
  })

  it('syntheticIndexWorks', () => {
    const a = makeAyahKey(1, 1)
    const b = makeAyahKey(1, 2)
    const c = makeAyahKey(2, 1)
    const unknown = makeAyahKey(1, 8)
    const rows: AyahLayoutRow[] = [
      { key: a, page: 1, wordCount: 3 },
      { key: b, page: 1, wordCount: 1 },
      { key: c, page: 604, wordCount: 0 },
    ]
    const synthIndex = new QuranIndex(rows, { 1: 1, 604: 30 })

    assert.deepEqual(synthIndex.ayahKeys, [a, b, c])
    assert.equal(synthIndex.totalAyahs, 3)
    assert.equal(synthIndex.ordinal(a), 0)
    assert.equal(synthIndex.ordinal(b), 1)
    assert.equal(synthIndex.ordinal(c), 2)
    assert.equal(synthIndex.page(c), 604)
    assert.equal(synthIndex.weight(a), 0.75)
    assert.equal(synthIndex.weight(b), 0.25)
    assert.equal(synthIndex.weight(c), 0)
    assert.equal(synthIndex.weight(unknown), 0)
    assert.deepEqual(synthIndex.ayatInPages(-10, 1), [a, b])
    assert.deepEqual(synthIndex.ayatInPages(604, 700), [c])
    assert.deepEqual(synthIndex.ayatInPages(-10, 700), [a, b, c])
    assert.deepEqual(synthIndex.ayatInPages(605, 700), [])
    assert.deepEqual(synthIndex.ayatInPages(-10, 0), [])
    assert.deepEqual(synthIndex.ayatOfSurah(1), [a, b])
    assert.deepEqual(synthIndex.pagesOfSurah(2), { start: 604, end: 604 })
    assert.deepEqual(synthIndex.ayatOfJuz(30), [c])
    assert.deepEqual(synthIndex.pagesOfJuz(30), { start: 604, end: 604 })
    assert.equal(synthIndex.juzOfPage(604), 30)
    assert.equal(synthIndex.ayahCount(0), 0)
    assert.deepEqual(synthIndex.ayatOfSurah(0), [])
    assert.equal(synthIndex.pagesOfSurah(0), undefined)
    assert.deepEqual(synthIndex.ayat(0), [])
    assert.equal(synthIndex.page(unknown), undefined)
    assert.equal(synthIndex.juzOfPage(0), undefined)
    assert.equal(synthIndex.pagesOfJuz(0), undefined)
    assert.deepEqual(synthIndex.ayatOfJuz(0), [])
    assert.deepEqual(synthIndex.ayatBetween(a, a), [a])
    assert.deepEqual(synthIndex.ayatBetween(a, unknown), [])
    assert.deepEqual(synthIndex.ayatBetween(unknown, a), [])
  })
})

test('the browser layout file builds the same index as the Node loader', async () => {
  const { readFileSync } = await import('node:fs')
  const layout = JSON.parse(readFileSync('public/quran/ayah-layout.json', 'utf8'))
  const fromFile = QuranIndex.fromLayout(layout)
  const fromFixtures = loadDefaultQuranIndex()
  assert.equal(fromFile.totalAyahs, 6236)
  assert.equal(fromFile.totalAyahs, fromFixtures.totalAyahs)
  let sum = 0
  for (const key of fromFixtures.ayahKeys) {
    assert.equal(fromFile.page(key), fromFixtures.page(key))
    assert.equal(fromFile.weight(key), fromFixtures.weight(key))
    sum += fromFile.weight(key)
  }
  assert.ok(Math.abs(sum - 604) < 1e-6, `page-equivalents sum to ${sum}`)
  for (const juz of fromFixtures.juzNumbers) {
    assert.deepEqual(fromFile.pagesOfJuz(juz), fromFixtures.pagesOfJuz(juz))
  }
})
