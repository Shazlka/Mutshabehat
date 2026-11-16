import assert from 'node:assert/strict'
import test, { describe, it } from 'node:test'
import {
  getStatusLabel,
  getStatusShape,
  formatPercent,
  formatNumber,
  formatDecimal,
  getSurahName,
  getAllSurahNames,
  getAllSurahMetas,
  getBrowserQuranIndex,
  formValuesToSelection,
  selectionToFormValues,
  getSelectionLabel,
  summarizePlanPreview,
  describeMilestone,
  describePeriodGains,
  MEMORIZATION_STATUS_LABELS,
  MEMORIZATION_STATUS_SHORT_LABELS,
  MEMORIZATION_STATUS_SHAPES,
} from '../../src/lib/memorization-view'
import {
  MemorizationStatus,
  makeAyahKey,
  type BatchPlan,
} from '../../packages/memorization-core/types'
import {
  makeSurahSelection,
  makeAyahRangeSelection,
  makePageRangeSelection,
  makeJuzSelection,
  makeSpanSelection,
  makeAyatSelection,
} from '../../packages/memorization-core/selection'

describe('MemorizationViewModelTests', () => {
  it('statusLabelsAndShapesMatchIOS', () => {
    assert.equal(getStatusLabel(MemorizationStatus.mastered), 'متقن')
    assert.equal(getStatusLabel(MemorizationStatus.memorizedWithErrors), 'محفوظ مع أخطاء')
    assert.equal(getStatusLabel(MemorizationStatus.needsMushaf), 'يحتاج المصحف')
    assert.equal(getStatusLabel(MemorizationStatus.notMemorized), 'غير محفوظ')

    assert.equal(getStatusLabel(MemorizationStatus.mastered, true), 'متقن')
    assert.equal(getStatusLabel(MemorizationStatus.memorizedWithErrors, true), 'مع أخطاء')
    assert.equal(getStatusLabel(MemorizationStatus.needsMushaf, true), 'يحتاج المصحف')
    assert.equal(getStatusLabel(MemorizationStatus.notMemorized, true), 'غير محفوظ')

    assert.equal(getStatusShape(MemorizationStatus.mastered), '✓✓')
    assert.equal(getStatusShape(MemorizationStatus.memorizedWithErrors), '!')
    assert.equal(getStatusShape(MemorizationStatus.needsMushaf), '◐')
    assert.equal(getStatusShape(MemorizationStatus.notMemorized), '○')

    assert.equal(MEMORIZATION_STATUS_SHAPES[MemorizationStatus.mastered], '✓✓')
    assert.equal(MEMORIZATION_STATUS_LABELS[MemorizationStatus.mastered], 'متقن')
    assert.equal(MEMORIZATION_STATUS_SHORT_LABELS[MemorizationStatus.memorizedWithErrors], 'مع أخطاء')
  })

  it('formattingHelpers', () => {
    assert.equal(formatPercent(38.74), '38.7%')
    assert.equal(formatPercent(100), '100.0%')
    assert.equal(formatPercent(0), '0.0%')
    assert.equal(formatPercent(-5), '0.0%')
    assert.equal(formatPercent(120), '100.0%')

    assert.equal(formatNumber(6236), '6,236')
    assert.equal(formatNumber(114), '114')
    assert.equal(formatDecimal(245.33), '245.3')
  })

  it('surahMetadataLookup', () => {
    assert.equal(getSurahName(1), 'الفاتحة')
    assert.equal(getSurahName(2), 'البقرة')
    assert.equal(getSurahName(36), 'يس')
    assert.equal(getSurahName(114), 'الناس')
    assert.equal(getSurahName(999), '999')

    const allNames = getAllSurahNames()
    assert.equal(Object.keys(allNames).length, 114)
    assert.equal(allNames[1], 'الفاتحة')

    const metas = getAllSurahMetas()
    assert.equal(metas.length, 114)
    assert.equal(metas[0].surahNumber, 1)
    assert.equal(metas[0].ayahCount, 7)
    assert.equal(metas[1].ayahCount, 286)
  })

  it('browserQuranIndexParity', () => {
    const index = getBrowserQuranIndex()
    assert.equal(index.totalAyahs, 6236)
    assert.equal(index.ayahKeys.length, 6236)
    assert.equal(index.surahNumbers.length, 114)
    assert.equal(index.pageNumbers.length, 604)
    assert.equal(index.juzNumbers.length, 30)

    // Key lookups
    const fatiha1 = makeAyahKey(1, 1)
    const baqarah255 = makeAyahKey(2, 255)
    const nas6 = makeAyahKey(114, 6)

    assert.equal(index.page(fatiha1), 1)
    assert.equal(index.page(baqarah255), 42)
    assert.equal(index.page(nas6), 604)

    assert.equal(index.ordinal(fatiha1), 0)
    assert.equal(index.ordinal(nas6), 6235)

    assert.equal(index.ayahCount(1), 7)
    assert.equal(index.ayahCount(2), 286)
    assert.equal(index.ayahCount(114), 6)

    // Ayat on page
    const p1Ayat = index.ayat(1)
    assert.equal(p1Ayat.length, 7)
    assert.deepEqual(p1Ayat[0], fatiha1)

    // Range operations
    const s1Ayat = index.ayatOfSurah(1)
    assert.equal(s1Ayat.length, 7)

    const j30Ayat = index.ayatOfJuz(30)
    assert.ok(j30Ayat.length > 500)

    const spanAyat = index.ayatBetween(makeAyahKey(1, 1), makeAyahKey(1, 3))
    assert.equal(spanAyat.length, 3)

    const pageAyat = index.ayatInPages(1, 2)
    assert.equal(pageAyat.length, 7 + 5) // Fatiha (7) + Baqarah 1-5 (5)

    // Weights sum to 604.0
    let totalWeight = 0
    for (const key of index.ayahKeys) {
      totalWeight += index.weight(key)
    }
    assert.ok(Math.abs(totalWeight - 604) < 1e-6)
  })

  it('formValuesToSelectionMapping', () => {
    // Surah
    const selSurah = formValuesToSelection({
      mode: 'surah',
      surah: 36,
      fromAyah: 1,
      toAyah: 83,
      fromPage: 1,
      toPage: 1,
      juz: 1,
    })
    assert.deepEqual(selSurah, makeSurahSelection(36))

    // Ayat
    const selAyat = formValuesToSelection({
      mode: 'ayat',
      surah: 2,
      fromAyah: 255,
      toAyah: 257,
      fromPage: 1,
      toPage: 1,
      juz: 1,
    })
    assert.deepEqual(selAyat, makeAyahRangeSelection(2, 255, 257))

    // Pages
    const selPages = formValuesToSelection({
      mode: 'pages',
      surah: 1,
      fromAyah: 1,
      toAyah: 7,
      fromPage: 42,
      toPage: 45,
      juz: 1,
    })
    assert.deepEqual(selPages, makePageRangeSelection(42, 45))

    // Juz
    const selJuz = formValuesToSelection({
      mode: 'juz',
      surah: 1,
      fromAyah: 1,
      toAyah: 7,
      fromPage: 1,
      toPage: 1,
      juz: 30,
    })
    assert.deepEqual(selJuz, makeJuzSelection(30))

    // Custom
    const custom = makeAyatSelection([makeAyahKey(1, 1), makeAyahKey(2, 1)])
    const selCustom = formValuesToSelection({
      mode: 'custom',
      surah: 1,
      fromAyah: 1,
      toAyah: 7,
      fromPage: 1,
      toPage: 1,
      juz: 1,
      customSelection: custom,
    })
    assert.deepEqual(selCustom, custom)
  })

  it('selectionToFormValuesMapping', () => {
    const index = getBrowserQuranIndex()

    const fromSurah = selectionToFormValues(makeSurahSelection(18), index)
    assert.equal(fromSurah.mode, 'surah')
    assert.equal(fromSurah.surah, 18)
    assert.equal(fromSurah.fromAyah, 1)
    assert.equal(fromSurah.toAyah, 110)

    const fromAyat = selectionToFormValues(makeAyahRangeSelection(2, 10, 20), index)
    assert.equal(fromAyat.mode, 'ayat')
    assert.equal(fromAyat.surah, 2)
    assert.equal(fromAyat.fromAyah, 10)
    assert.equal(fromAyat.toAyah, 20)

    const fromPages = selectionToFormValues(makePageRangeSelection(10, 15), index)
    assert.equal(fromPages.mode, 'pages')
    assert.equal(fromPages.fromPage, 10)
    assert.equal(fromPages.toPage, 15)

    const fromJuz = selectionToFormValues(makeJuzSelection(29), index)
    assert.equal(fromJuz.mode, 'juz')
    assert.equal(fromJuz.juz, 29)

    const fromSpanSameSurah = selectionToFormValues(
      makeSpanSelection(makeAyahKey(2, 5), makeAyahKey(2, 15)),
      index,
    )
    assert.equal(fromSpanSameSurah.mode, 'ayat')
    assert.equal(fromSpanSameSurah.surah, 2)
    assert.equal(fromSpanSameSurah.fromAyah, 5)
    assert.equal(fromSpanSameSurah.toAyah, 15)

    const fromSpanDifferentSurah = selectionToFormValues(
      makeSpanSelection(makeAyahKey(1, 1), makeAyahKey(2, 5)),
      index,
    )
    assert.equal(fromSpanDifferentSurah.mode, 'custom')
  })

  it('selectionLabels', () => {
    assert.equal(getSelectionLabel(makeSurahSelection(1)), 'سورة الفاتحة')
    assert.equal(getSelectionLabel(makeAyahRangeSelection(2, 255, 257)), 'البقرة 255–257')
    assert.equal(getSelectionLabel(makePageRangeSelection(42, 42)), 'صفحة 42')
    assert.equal(getSelectionLabel(makePageRangeSelection(42, 45)), 'صفحات 42–45')
    assert.equal(getSelectionLabel(makeJuzSelection(30)), 'الجزء 30')
    assert.equal(
      getSelectionLabel(makeSpanSelection(makeAyahKey(1, 1), makeAyahKey(2, 5))),
      'الفاتحة 1 → البقرة 5',
    )
    assert.equal(
      getSelectionLabel(makeAyatSelection([makeAyahKey(1, 1), makeAyahKey(1, 2)])),
      'آيات محددة (2)',
    )
  })

  it('summarizePlanPreview', () => {
    const dummyPlan: BatchPlan = {
      kind: 'update',
      label: 'سورة الفاتحة',
      scopeJSON: '{}',
      selectionCount: 7,
      changes: [
        {
          key: makeAyahKey(1, 1),
          before: null,
          after: {
            surah: 1,
            ayah: 1,
            status: MemorizationStatus.mastered,
            reviewStrength: 5,
            isCurrentlyLearning: false,
            firstMemorizedAt: null,
            lastStatusChangedAt: null,
            lastReviewedAt: null,
            nextReviewAt: null,
            reviewCount: 0,
            successfulReviewCount: 0,
            consecutiveSuccessfulReviews: 0,
            errorCount: 0,
            updatedAt: '2026-11-16T00:00:00.000Z',
          },
        },
      ],
      countsForStreak: true,
      gainAyahs: 1,
      unchangedCount: 6,
    }

    const summary = summarizePlanPreview(dummyPlan, MemorizationStatus.mastered, 'سورة الفاتحة')
    assert.equal(summary.title, 'تأكيد التحديث')
    assert.equal(summary.changedCount, 1)
    assert.equal(summary.unchangedCount, 6)
    assert.equal(summary.gainAyahs, 1)
    assert.equal(summary.statusLabel, 'متقن')
    assert.ok(summary.message.includes('سيتم تحديث 1 آية من سورة الفاتحة إلى «متقن».'))
    assert.ok(summary.message.includes('(6 منها بهذه الحالة بالفعل)'))
  })

  it('milestonesAndGainsDescriptions', () => {
    assert.equal(
      describeMilestone({ type: 'surahCompleted', surah: 1 }),
      'أتممت حفظ سورة الفاتحة',
    )
    assert.equal(
      describeMilestone({ type: 'surahCompleted', surah: 1 }, 'english'),
      'You completed surah الفاتحة',
    )
    assert.equal(
      describeMilestone({ type: 'juzCompleted', juz: 30 }),
      'أتممت حفظ الجزء 30',
    )
    assert.equal(
      describeMilestone({ type: 'percent', percent: 50 }),
      'أتممت 50٪ من القرآن',
    )
    assert.equal(
      describeMilestone({ type: 'quranCompleted' }),
      'أتممت حفظ القرآن الكريم',
    )

    const gains = { newAyat: 12, pageEquivalents: 1.4, surahsCompleted: 1 }
    assert.equal(describePeriodGains(gains), '+12 آية · 1.4 صفحة تقريباً · 1 سورة مكتملة')
  })

  it('dominantTransitionCalculation', async () => {
    const { getDominantTransition } = await import('../../src/components/memorization/HistoryView')
    assert.equal(getDominantTransition([]), null)

    const events = [
      {
        batchID: 'b1',
        surah: 1,
        ayah: 1,
        at: '2026-11-16T00:00:00.000Z',
        before: null,
        after: {
          surah: 1,
          ayah: 1,
          status: MemorizationStatus.mastered,
          reviewStrength: 5,
          isCurrentlyLearning: false,
          firstMemorizedAt: null,
          lastStatusChangedAt: null,
          lastReviewedAt: null,
          nextReviewAt: null,
          reviewCount: 0,
          successfulReviewCount: 0,
          consecutiveSuccessfulReviews: 0,
          errorCount: 0,
          updatedAt: '2026-11-16T00:00:00.000Z',
        },
      },
      {
        batchID: 'b1',
        surah: 1,
        ayah: 2,
        at: '2026-11-16T00:00:00.000Z',
        before: null,
        after: {
          surah: 1,
          ayah: 2,
          status: MemorizationStatus.mastered,
          reviewStrength: 5,
          isCurrentlyLearning: false,
          firstMemorizedAt: null,
          lastStatusChangedAt: null,
          lastReviewedAt: null,
          nextReviewAt: null,
          reviewCount: 0,
          successfulReviewCount: 0,
          consecutiveSuccessfulReviews: 0,
          errorCount: 0,
          updatedAt: '2026-11-16T00:00:00.000Z',
        },
      },
    ]

    const dominant = getDominantTransition(events)
    assert.ok(dominant)
    assert.equal(dominant?.from, MemorizationStatus.notMemorized)
    assert.equal(dominant?.to, MemorizationStatus.mastered)
  })
})
