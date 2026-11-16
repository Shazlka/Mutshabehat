import assert from 'node:assert/strict'
import test, { describe, it } from 'node:test'
import {
  makeAyahKey,
  type AyahKey,
} from '../../packages/memorization-core/types'
import { QuranIndex } from '../../packages/memorization-core/quranIndex'
import {
  resolveSelection,
  isWholeSurahSelection,
  makeSurahSelection,
  makeAyahRangeSelection,
  makePageRangeSelection,
  makeJuzSelection,
  makeAyatSelection,
  makeSpanSelection,
  type MemorizationSelection,
} from '../../packages/memorization-core/selection'
import {
  parseSelectionTarget,
  targetToSelection,
  type SelectionTarget,
} from '../../packages/memorization-core/selectionParser'
import { loadDefaultQuranIndex, loadSurahNames } from '../../packages/memorization-core/quranIndexNode'

describe('MemorizationSelectionTests', () => {
  const index = loadDefaultQuranIndex()
  const names = loadSurahNames()

  const key = (surah: number, ayah: number): AyahKey => makeAyahKey(surah, ayah)

  // MARK: - Resolving

  it('surahResolvesAllAyat', () => {
    assert.equal(resolveSelection(makeSurahSelection(36), index).length, 83)
    assert.deepEqual(resolveSelection(makeSurahSelection(1), index)[0], key(1, 1))
  })

  it('ayahRangeIsInclusive', () => {
    const keys = resolveSelection(makeAyahRangeSelection(2, 1, 20), index)
    assert.equal(keys.length, 20)
    assert.deepEqual(keys[0], key(2, 1))
    assert.deepEqual(keys[keys.length - 1], key(2, 20))
  })

  it('reversedRangeIsOrderInsensitive', () => {
    const forward = resolveSelection(makeAyahRangeSelection(2, 1, 20), index)
    const reversed = resolveSelection(makeAyahRangeSelection(2, 20, 1), index)
    assert.deepEqual(forward, reversed)
  })

  it('rangeBeyondSurahIsClamped', () => {
    assert.equal(
      resolveSelection(makeAyahRangeSelection(1, 1, 99), index).length,
      7,
    )
    assert.equal(
      resolveSelection(makeAyahRangeSelection(1, 0, 3), index).length,
      3,
    )
    assert.equal(
      resolveSelection(makeAyahRangeSelection(1, 50, 60), index).length,
      0,
    )
  })

  it('pageRangeResolvesAyatOnThosePages', () => {
    const keys = resolveSelection(makePageRangeSelection(582, 589), index)
    assert.deepEqual(keys, index.ayatInPages(582, 589))
    assert.ok(keys.length > 0)
    assert.ok(
      keys.every((k) => {
        const p = index.page(k)
        return p !== undefined && p >= 582 && p <= 589
      }),
    )
  })

  it('juzThirtyResolvesItsAyat', () => {
    const keys = resolveSelection(makeJuzSelection(30), index)
    assert.deepEqual(keys, index.ayatOfJuz(30))
    assert.deepEqual(keys[0], key(78, 1))
  })

  it('explicitAyatAreSortedDeduplicatedAndFiltered', () => {
    const rawKeys: AyahKey[] = [
      key(2, 5),
      key(1, 3),
      key(1, 1),
      key(1, 99),
      key(200, 1),
    ]
    assert.deepEqual(
      resolveSelection(makeAyatSelection(rawKeys), index),
      [key(1, 1), key(1, 3), key(2, 5)],
    )
  })

  it('spanAcrossSurahsAndReversed', () => {
    const forward = resolveSelection(
      makeSpanSelection(key(2, 285), key(3, 2)),
      index,
    )
    assert.deepEqual(forward, [key(2, 285), key(2, 286), key(3, 1), key(3, 2)])
    assert.deepEqual(
      resolveSelection(makeSpanSelection(key(3, 2), key(2, 285)), index),
      forward,
    )
  })

  it('invalidSurahResolvesEmpty', () => {
    assert.deepEqual(resolveSelection(makeSurahSelection(0), index), [])
    assert.deepEqual(resolveSelection(makeSurahSelection(115), index), [])
    assert.deepEqual(resolveSelection(makeJuzSelection(31), index), [])
  })

  it('wholeSurahDetection', () => {
    assert.equal(isWholeSurahSelection(makeSurahSelection(1), index), true)
    assert.equal(
      isWholeSurahSelection(makeAyahRangeSelection(1, 1, 7), index),
      true,
    )
    assert.equal(
      isWholeSurahSelection(makeAyahRangeSelection(1, 1, 6), index),
      false,
    )
    assert.equal(
      isWholeSurahSelection(makeSpanSelection(key(1, 1), key(2, 1)), index),
      false,
    )
    assert.equal(isWholeSurahSelection(makeSurahSelection(0), index), false)
  })

  // MARK: - Parser

  const parse = (text: string): SelectionTarget | null =>
    parseSelectionTarget(text, names, index)

  it('parsesNameAndAyah', () => {
    assert.deepEqual(parse('البقرة 255'), {
      type: 'ayah',
      key: key(2, 255),
    })
  })

  it('parsesArabicIndicDigits', () => {
    assert.deepEqual(parse('البقرة ٢٥٥'), {
      type: 'ayah',
      key: key(2, 255),
    })
    assert.deepEqual(parse('صفحة ٤٢'), {
      type: 'page',
      page: 42,
    })
    assert.deepEqual(parse('الجزء ۳۰'), {
      type: 'juz',
      juz: 30,
    })
  })

  it('parsesBareSurahName', () => {
    assert.deepEqual(parse('يس'), {
      type: 'surahDetail',
      surah: 36,
    })
    assert.deepEqual(parse('سورة يس'), {
      type: 'surahDetail',
      surah: 36,
    })
    assert.deepEqual(parse('آل عمران'), {
      type: 'surahDetail',
      surah: 3,
    })
    assert.deepEqual(parse('آل عمران 10'), {
      type: 'ayah',
      key: key(3, 10),
    })
  })

  it('parsesPageAndJuz', () => {
    assert.deepEqual(parse('صفحة 42'), {
      type: 'page',
      page: 42,
    })
    assert.deepEqual(parse('ص 42'), {
      type: 'page',
      page: 42,
    })
    assert.deepEqual(parse('الجزء 30'), {
      type: 'juz',
      juz: 30,
    })
    assert.deepEqual(parse('جزء 1'), {
      type: 'juz',
      juz: 1,
    })
  })

  it('ignoresDiacriticsAlefVariantsAndTaMarbuta', () => {
    assert.deepEqual(parse('ٱلبَقَرَة 255'), {
      type: 'ayah',
      key: key(2, 255),
    })
    assert.deepEqual(parse('البقره 255'), {
      type: 'ayah',
      key: key(2, 255),
    })
    assert.deepEqual(parse('الاخلاص'), {
      type: 'surahDetail',
      surah: 112,
    })
    assert.deepEqual(parse('  البقرة   255  '), {
      type: 'ayah',
      key: key(2, 255),
    })
  })

  it('rejectsNonsense', () => {
    assert.equal(parse('xyz'), null)
    assert.equal(parse(''), null)
    assert.equal(parse('صفحة 700'), null)
    assert.equal(parse('صفحة 0'), null)
    assert.equal(parse('الجزء 31'), null)
    assert.equal(parse('البقرة 300'), null)
    assert.equal(parse('البقرة 0'), null)
  })

  it('targetConvertsToASelection', () => {
    assert.deepEqual(
      targetToSelection({ type: 'surahDetail', surah: 36 }),
      { type: 'surah', surah: 36 },
    )
    assert.deepEqual(
      targetToSelection({ type: 'page', page: 42 }),
      { type: 'pageRange', startPage: 42, endPage: 42 },
    )
    assert.deepEqual(
      targetToSelection({ type: 'ayah', key: key(2, 255) }),
      { type: 'ayahRange', surah: 2, from: 255, to: 255 },
    )
    assert.deepEqual(
      targetToSelection({ type: 'juz', juz: 30 }),
      { type: 'juz', juz: 30 },
    )
    const surahSel: MemorizationSelection = { type: 'surah', surah: 1 }
    assert.deepEqual(
      targetToSelection({ type: 'selection', selection: surahSel }),
      surahSel,
    )
  })
})
