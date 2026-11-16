'use client'

import { useState, useMemo } from 'react'
import {
  type AyahKey,
  type AyahMemorizationRecord,
  type BatchRecord,
  type ChangeEvent,
  MemorizationStatus,
  TOTAL_QURAN_AYAHS,
  MUSHAF_PAGE_COUNT,
} from '../../../packages/memorization-core/types'
import type { GoalDefinition } from '../../../packages/memorization-core/backup'
import type { MemorizationSnapshot } from '../../../packages/memorization-core/statistics'
import type { StreakSummary } from '../../../packages/memorization-core/streak'
import type { MemorizationSelection } from '../../../packages/memorization-core/selection'
import {
  getSuggestion,
  getMostOverdueSurahs,
  type Suggestion,
} from '../../../packages/memorization-core/reviewEngine'
import {
  parseSelectionTarget,
  targetToSelection,
  type SelectionTarget,
} from '../../../packages/memorization-core/selectionParser'
import {
  type BrowserQuranIndex,
  formatPercent,
  formatNumber,
  formatDecimal,
  getStatusLabel,
  getStatusShape,
} from '../../lib/memorization-view'
import { MemorizationMixBar } from './MemorizationMixBar'
import { SuggestionCard } from './SuggestionCard'
import { ProgressSection } from './ProgressSection'
import { GoalsSection } from './GoalsSection'

export interface DashboardViewProps {
  readonly snapshot: MemorizationSnapshot | null
  readonly records: Readonly<Record<string, AyahMemorizationRecord>>
  readonly batches: readonly BatchRecord[]
  readonly events: readonly ChangeEvent[]
  readonly goals: readonly GoalDefinition[]
  readonly dueAyat: readonly AyahKey[]
  readonly streak: StreakSummary
  readonly index: BrowserQuranIndex
  readonly surahNames: Readonly<Record<number, string>>
  readonly currentPosition: { readonly from: AyahKey; readonly to: AyahKey } | null
  readonly onNavigateToHistory: () => void
  readonly onOpenUpdate: (selection?: MemorizationSelection) => void
  readonly onOpenInMushaf: (page: number, ayah?: AyahKey) => void
  readonly onSaveGoal: (goal: GoalDefinition) => Promise<boolean>
  readonly onDeleteGoal: (goalId: string) => Promise<boolean>
  readonly onStartReview?: (selection: MemorizationSelection) => void
}

const STRINGS = {
  searchPlaceholder: 'ابحث: البقرة 255 · صفحة 42 · الجزء 30',
  searchAriaLabel: 'البحث عن سورة أو آية أو صفحة أو جزء',
  quranCompleted: 'تم حفظ القرآن كاملاً',
  masteredHeadline: 'الحفظ المتقن',
  learningProgress: 'تقدم الحفظ',
  canRecite: 'قادر على التلاوة',
  tileSurahs: 'السور',
  tilePages: 'الصفحات',
  tileAyat: 'الآيات',
  tilePartial: (n: number) => `جزئي: ${n}`,
  tileApprox: (n: string) => `≈ ${n}`,
  tileRecite: (n: number) => `تلاوة: ${n}`,
  currentTitle: 'الحفظ الحالي',
  currentEmpty: 'لم تحدد موضع الحفظ الحالي بعد. اختره من «تحديث الحفظ».',
  openInMushaf: 'فتح في المصحف',
  updateMemorization: 'تحديث الحفظ',
  ayatCountSuffix: 'آيات',
  statusBarAria: 'توزيع حالات الحفظ',
  reviewSectionTitle: 'يحتاج مراجعة',
  dueAyatLabel: 'آيات مستحقة للمراجعة',
  startReview: 'ابدأ المراجعة',
  activitySectionTitle: 'آخر النشاط',
  noActivity: 'لا توجد تحديثات بعد.',
  showAllActivity: 'عرض الكل',
  surahPrefix: 'سورة ',
  pagePrefix: 'صفحة ',
  juzPrefix: 'الجزء ',
  selectionPrefix: 'تحديد',
}

const ALL_STATUSES: readonly MemorizationStatus[] = [
  MemorizationStatus.mastered,
  MemorizationStatus.memorizedWithErrors,
  MemorizationStatus.needsMushaf,
  MemorizationStatus.notMemorized,
]

export function DashboardView({
  snapshot,
  records,
  batches,
  events,
  goals,
  dueAyat,
  streak,
  index,
  surahNames,
  currentPosition,
  onNavigateToHistory,
  onOpenUpdate,
  onOpenInMushaf,
  onSaveGoal,
  onDeleteGoal,
  onStartReview,
}: DashboardViewProps) {
  const [searchText, setSearchText] = useState('')

  const searchResult = useMemo<SelectionTarget | null>(() => {
    if (!searchText.trim()) return null
    return parseSelectionTarget(searchText, surahNames as Record<number, string>, index)
  }, [searchText, surahNames, index])

  const now = useMemo(() => new Date(), [])

  const suggestion = useMemo<Suggestion | null>(() => {
    return getSuggestion(records, index, now)
  }, [records, index, now])

  const overdueSurahs = useMemo(() => {
    return getMostOverdueSurahs(records, now, 3)
  }, [records, now])

  const totalAyahs = snapshot?.totalAyahs ?? TOTAL_QURAN_AYAHS
  const strictPercent = snapshot?.strictPercent ?? 0
  const learningPercent = snapshot?.learningPercent ?? 0
  const canReciteCount = snapshot?.canReciteCount ?? 0
  const canRecitePercent = totalAyahs > 0 ? (canReciteCount / totalAyahs) * 100 : 0
  const isCompleted =
    totalAyahs > 0 && (snapshot?.counts[MemorizationStatus.mastered] ?? 0) === totalAyahs

  const fractions = useMemo<Record<MemorizationStatus, number>>(() => {
    const total = Math.max(1, totalAyahs)
    return {
      [MemorizationStatus.mastered]: (snapshot?.counts[MemorizationStatus.mastered] ?? 0) / total,
      [MemorizationStatus.memorizedWithErrors]:
        (snapshot?.counts[MemorizationStatus.memorizedWithErrors] ?? 0) / total,
      [MemorizationStatus.needsMushaf]:
        (snapshot?.counts[MemorizationStatus.needsMushaf] ?? 0) / total,
      [MemorizationStatus.notMemorized]:
        (snapshot?.counts[MemorizationStatus.notMemorized] ?? 0) / total,
    }
  }, [snapshot, totalAyahs])

  const currentRangeData = useMemo(() => {
    if (!currentPosition) return null
    const keys = index.ayatBetween(currentPosition.from, currentPosition.to)
    const mastered = keys.filter(
      (k) => records[`${k.surah}:${k.ayah}`]?.status === MemorizationStatus.mastered,
    ).length

    const fromSurahName = surahNames[currentPosition.from.surah] ?? String(currentPosition.from.surah)
    const toSurahName = surahNames[currentPosition.to.surah] ?? String(currentPosition.to.surah)

    const label =
      currentPosition.from.surah === currentPosition.to.surah
        ? `${fromSurahName} ${currentPosition.from.ayah}–${currentPosition.to.ayah}`
        : `${fromSurahName} ${currentPosition.from.ayah} → ${toSurahName} ${currentPosition.to.ayah}`

    return {
      label,
      total: keys.length,
      mastered,
      firstPage: index.page(currentPosition.from) ?? 1,
    }
  }, [currentPosition, index, records, surahNames])

  const recentBatches = useMemo(() => {
    return batches.slice(0, 3)
  }, [batches])

  const handleSearchResultClick = (target: SelectionTarget) => {
    switch (target.type) {
      case 'page':
        onOpenInMushaf(target.page, undefined)
        break
      case 'ayah':
        onOpenInMushaf(index.page(target.key) ?? 1, target.key)
        break
      case 'surahDetail':
        onOpenUpdate({ type: 'surah', surah: target.surah })
        break
      case 'juz':
        onOpenUpdate({ type: 'juz', juz: target.juz })
        break
      case 'selection':
        onOpenUpdate(target.selection)
        break
    }
    setSearchText('')
  }

  const describeSearchResult = (target: SelectionTarget): string => {
    switch (target.type) {
      case 'surahDetail':
        return `${STRINGS.surahPrefix}${surahNames[target.surah] ?? target.surah}`
      case 'page':
        return `${STRINGS.pagePrefix}${target.page}`
      case 'ayah': {
        const sName = surahNames[target.key.surah] ?? String(target.key.surah)
        return `${sName} ${target.key.ayah}`
      }
      case 'juz':
        return `${STRINGS.juzPrefix}${target.juz}`
      case 'selection':
        return STRINGS.selectionPrefix
    }
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-2 pb-24 text-right" dir="rtl">
      {/* Search Field */}
      <section className="flex flex-col gap-2" aria-label="البحث">
        <div className="relative w-full">
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={STRINGS.searchPlaceholder}
            aria-label={STRINGS.searchAriaLabel}
            data-testid="memo-search"
            className="w-full rounded-xl border border-gray-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 min-h-[44px]"
          />
        </div>

        {searchResult && (
          <button
            type="button"
            onClick={() => handleSearchResultClick(searchResult)}
            data-testid="memo-search-result"
            className="flex items-center justify-between w-full rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 shadow-xs transition hover:bg-gray-50 dark:hover:bg-neutral-800 min-h-[44px]"
          >
            <span className="font-semibold text-sm text-gray-900 dark:text-neutral-100">
              {describeSearchResult(searchResult)}
            </span>
            <span className="text-xs text-gray-400 dark:text-neutral-500">←</span>
          </button>
        )}
      </section>

      {/* Strict % Headline */}
      <section
        className="flex flex-col items-center justify-center py-2 text-center"
        aria-label="نسبة الحفظ المتقن"
      >
        {isCompleted && (
          <div
            data-testid="memo-completed"
            className="mb-1 text-sm font-bold text-[var(--memo-mastered)]"
          >
            {STRINGS.quranCompleted}
          </div>
        )}

        <div className="text-xs font-medium text-gray-500 dark:text-neutral-400">
          {STRINGS.masteredHeadline}
        </div>

        <div
          data-testid="memo-strict"
          className="my-1 font-semibold text-5xl md:text-6xl tracking-tight text-[var(--memo-mastered)] font-mono"
        >
          {formatPercent(strictPercent)}
        </div>

        <div className="mt-2 flex items-center justify-center gap-8 text-center">
          <div data-testid="memo-learning" className="flex flex-col">
            <span className="font-mono text-base font-semibold text-gray-900 dark:text-neutral-100">
              {formatPercent(learningPercent)}
            </span>
            <span className="text-xs text-gray-500 dark:text-neutral-400">
              {STRINGS.learningProgress}
            </span>
          </div>

          <div data-testid="memo-recite" className="flex flex-col">
            <span className="font-mono text-base font-semibold text-gray-900 dark:text-neutral-100">
              {formatPercent(canRecitePercent)}
            </span>
            <span className="text-xs text-gray-500 dark:text-neutral-400">
              {STRINGS.canRecite}
            </span>
          </div>
        </div>
      </section>

      {/* Three Scorecard Tiles */}
      <section
        className="grid grid-cols-3 gap-2.5"
        aria-label="إحصائيات الحفظ (السور، الصفحات، الآيات)"
      >
        {/* Surahs Tile */}
        <button
          type="button"
          onClick={() => onOpenUpdate()}
          data-testid="memo-tile-surahs"
          className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-3 shadow-xs transition hover:bg-gray-50 dark:hover:bg-neutral-800 min-h-[44px]"
        >
          <span className="text-xs text-gray-500 dark:text-neutral-400">
            {STRINGS.tileSurahs}
          </span>
          <span className="mt-1 font-mono text-sm sm:text-base font-bold text-gray-900 dark:text-neutral-100">
            {snapshot ? `${snapshot.completedSurahs} / 114` : '0 / 114'}
          </span>
          <span className="mt-0.5 text-[11px] text-gray-400 dark:text-neutral-500">
            {STRINGS.tilePartial(snapshot?.partialSurahs ?? 0)}
          </span>
        </button>

        {/* Pages Tile */}
        <button
          type="button"
          onClick={() => onOpenUpdate()}
          data-testid="memo-tile-pages"
          className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-3 shadow-xs transition hover:bg-gray-50 dark:hover:bg-neutral-800 min-h-[44px]"
        >
          <span className="text-xs text-gray-500 dark:text-neutral-400">
            {STRINGS.tilePages}
          </span>
          <span className="mt-1 font-mono text-sm sm:text-base font-bold text-gray-900 dark:text-neutral-100">
            {snapshot ? `${snapshot.pagesFullyMastered} / ${MUSHAF_PAGE_COUNT}` : `0 / ${MUSHAF_PAGE_COUNT}`}
          </span>
          <span className="mt-0.5 text-[11px] text-gray-400 dark:text-neutral-500">
            {STRINGS.tileApprox(formatDecimal(snapshot?.pageEquivalentMastered ?? 0))}
          </span>
        </button>

        {/* Ayat Tile */}
        <button
          type="button"
          onClick={() => onOpenUpdate()}
          data-testid="memo-tile-ayat"
          className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-3 shadow-xs transition hover:bg-gray-50 dark:hover:bg-neutral-800 min-h-[44px]"
        >
          <span className="text-xs text-gray-500 dark:text-neutral-400">
            {STRINGS.tileAyat}
          </span>
          <span className="mt-1 font-mono text-sm sm:text-base font-bold text-gray-900 dark:text-neutral-100">
            {snapshot ? `${snapshot.counts[MemorizationStatus.mastered] ?? 0} / ${totalAyahs}` : `0 / ${totalAyahs}`}
          </span>
          <span className="mt-0.5 text-[11px] text-gray-400 dark:text-neutral-500">
            {STRINGS.tileRecite(canReciteCount)}
          </span>
        </button>
      </section>

      {/* Current Position Card */}
      <section
        data-testid="memo-current"
        className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-4 shadow-xs"
        aria-label={STRINGS.currentTitle}
      >
        <div className="text-xs font-semibold text-gray-500 dark:text-neutral-400">
          {STRINGS.currentTitle}
        </div>

        {currentRangeData ? (
          <div className="mt-2 flex flex-col gap-2.5">
            <div data-testid="memo-current-range" className="text-base font-bold text-gray-900 dark:text-neutral-100">
              {currentRangeData.label}
            </div>

            <div className="w-full bg-gray-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--memo-mastered)] rounded-full transition-all"
                style={{
                  width: `${currentRangeData.total > 0 ? (currentRangeData.mastered / currentRangeData.total) * 100 : 0}%`,
                }}
              />
            </div>

            <div className="text-xs text-gray-500 dark:text-neutral-400 font-mono">
              {`${currentRangeData.mastered} / ${currentRangeData.total} ${STRINGS.ayatCountSuffix}`}
            </div>

            <div className="mt-1 flex items-center justify-between gap-3 pt-1 border-t border-gray-100 dark:border-neutral-800/80">
              <button
                type="button"
                onClick={() => onOpenInMushaf(currentRangeData.firstPage, currentPosition?.from)}
                className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline min-h-[44px] flex items-center"
              >
                {STRINGS.openInMushaf}
              </button>

              <button
                type="button"
                onClick={() =>
                  currentPosition &&
                  onOpenUpdate({
                    type: 'span',
                    from: currentPosition.from,
                    to: currentPosition.to,
                  })
                }
                className="text-xs font-semibold text-gray-700 dark:text-neutral-300 hover:underline min-h-[44px] flex items-center"
              >
                {STRINGS.updateMemorization}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-gray-500 dark:text-neutral-400">
            {STRINGS.currentEmpty}
          </p>
        )}
      </section>

      {/* Segmented Status Distribution Bar & Rows */}
      <section
        className="flex flex-col gap-3 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-4 shadow-xs"
        aria-label="توزيع حالات الحفظ"
      >
        <div data-testid="memo-status-bar" className="w-full">
          <MemorizationMixBar fractions={fractions} height={12} className="rounded-full" />
        </div>

        <div className="flex flex-col divide-y divide-gray-100 dark:divide-neutral-800/80">
          {ALL_STATUSES.map((status) => {
            const count = snapshot?.counts[status] ?? 0
            const shape = getStatusShape(status)
            const label = getStatusLabel(status)

            return (
              <button
                key={status}
                type="button"
                onClick={() => onOpenUpdate()}
                data-testid={`memo-status-row-${status}`}
                className="flex items-center justify-between py-2.5 transition hover:bg-gray-50/50 dark:hover:bg-neutral-800/50 min-h-[44px]"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex w-6 items-center justify-center font-mono font-bold text-sm"
                    style={{
                      color:
                        status === MemorizationStatus.mastered
                          ? 'var(--memo-mastered)'
                          : status === MemorizationStatus.memorizedWithErrors
                          ? 'var(--memo-with-errors)'
                          : status === MemorizationStatus.needsMushaf
                          ? 'var(--memo-needs-mushaf)'
                          : 'var(--memo-not-memorized)',
                    }}
                  >
                    {shape}
                  </span>
                  <span className="text-sm font-medium text-gray-800 dark:text-neutral-200">
                    {label}
                  </span>
                </div>

                <span className="font-mono text-sm text-gray-500 dark:text-neutral-400">
                  {formatNumber(count)}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Daily Smart Suggestion Card */}
      {suggestion && (
        <SuggestionCard
          suggestion={suggestion}
          surahNames={surahNames}
          onOpenSurah={(surah) => onOpenUpdate({ type: 'surah', surah })}
          onStartReview={(surah) => onStartReview?.({ type: 'surah', surah })}
        />
      )}

      {/* Progress Section (Streak + Gains + Chart) */}
      <ProgressSection
        records={records}
        events={events}
        streakDays={streak.current}
        index={index}
      />

      {/* Review Due Backlog Section */}
      <section
        data-testid="memo-review"
        className="flex flex-col gap-3 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-4 shadow-xs"
        aria-label={STRINGS.reviewSectionTitle}
      >
        <div className="text-xs font-semibold text-gray-500 dark:text-neutral-400">
          {STRINGS.reviewSectionTitle}
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="text-sm font-medium text-gray-800 dark:text-neutral-200">
            {STRINGS.dueAyatLabel}
          </span>
          <span
            data-testid="memo-due-count"
            className="font-mono text-base font-bold text-gray-900 dark:text-neutral-100"
          >
            {formatNumber(dueAyat.length)}
          </span>
        </div>

        {overdueSurahs.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-gray-100 dark:border-neutral-800/80 pt-2">
            {overdueSurahs.map((row) => (
              <div
                key={row.surah}
                data-testid={`memo-due-row-${row.surah}`}
                className="flex items-center justify-between text-xs text-gray-600 dark:text-neutral-400"
              >
                <span>{surahNames[row.surah] ?? String(row.surah)}</span>
                <span className="font-mono">{formatNumber(row.dueCount)}</span>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          disabled={dueAyat.length === 0}
          onClick={() => onStartReview?.({ type: 'ayat', keys: dueAyat })}
          data-testid="memo-review-start"
          className="mt-1 flex items-center justify-center rounded-xl bg-emerald-700 dark:bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-800 disabled:opacity-40 disabled:pointer-events-none min-h-[44px]"
        >
          {STRINGS.startReview}
        </button>
      </section>

      {/* Recent Activity Section */}
      <section
        data-testid="memo-activity"
        className="flex flex-col gap-3 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-4 shadow-xs"
        aria-label={STRINGS.activitySectionTitle}
      >
        <div className="text-xs font-semibold text-gray-500 dark:text-neutral-400">
          {STRINGS.activitySectionTitle}
        </div>

        {recentBatches.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-neutral-400">
            {STRINGS.noActivity}
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-neutral-800/80">
            {recentBatches.map((batch) => (
              <div
                key={batch.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span
                  className={`truncate font-medium ${
                    batch.undoneAt
                      ? 'line-through text-gray-400 dark:text-neutral-500'
                      : 'text-gray-800 dark:text-neutral-200'
                  }`}
                >
                  {batch.label}
                  {batch.undoneAt ? ' ⟲' : ''}
                </span>
                <span className="font-mono text-xs text-gray-500 dark:text-neutral-400 mr-2 shrink-0">
                  {formatNumber(batch.ayahCount)}
                </span>
              </div>
            ))}

            <button
              type="button"
              onClick={onNavigateToHistory}
              data-testid="memo-history-link"
              className="mt-1 flex items-center text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline pt-2 min-h-[44px]"
            >
              {STRINGS.showAllActivity}
            </button>
          </div>
        )}
      </section>

      {/* Goals Section */}
      <GoalsSection
        goals={goals}
        records={records}
        events={events}
        snapshot={snapshot}
        index={index}
        surahNames={surahNames}
        onSaveGoal={onSaveGoal}
        onDeleteGoal={onDeleteGoal}
      />
    </div>
  )
}
