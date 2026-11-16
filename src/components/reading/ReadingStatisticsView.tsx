'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import {
  MUSHAF_TOTAL_AYAHS,
  MUSHAF_TOTAL_PAGES,
  calculateChartPoints,
  calculateChartSummary,
  classifyDailyHeatLevel,
  classifyReadingProgressTier,
  formatChartMetricNumber,
  getChartMetricUnit,
  type DailyReadingChartPoint,
  type ReadingChartMetric,
  type ReadingChartRange,
  type ReadingChartSummary,
  type ReadingDayRecord,
} from '../../../packages/reading-core'
import { getMushaf1441PageMetadata } from '../../../packages/quran-data/mushaf1441/pageMetadata'
import { useReadingStore } from '../../lib/hooks/useReadingStore'
import {
  buildReadingStatsOverview,
  calculateKhatmaDaysElapsed,
  computeWeeklyDays,
  formatArabicDate,
  formatReadingDuration,
  toArabicDigits,
} from '../../lib/reading-view'

const STRINGS = {
  khatmaCurrent: 'الختمة الحالية',
  fromQuran: 'من القرآن',
  khatmaPagesInfo: 'من ٦٠٤ صفحة، بقي',
  khatmaAyahsInfo: 'من ٦٢٣٦ آية',
  durationElapsed: 'المدة:',
  daysUnit: 'يوماً',
  lifetimeTime: 'وقت التلاوة الكلي',
  readingDays: 'أيام التلاوة',
  daysWord: 'يوم',
  ayahsReadLifetime: 'الآيات المقروءة',
  ayahsWord: 'آية',
  completedKhatmas: 'الختمات المكتملة',
  continueReading: 'تابع القراءة',
  surahWord: 'سورة',
  ayahWord: 'آية',
  pageShort: 'ص',
  streakActive: 'يوم مداومة',
  streakLongest: 'أطول مدة مداومة:',
  addSessionButton: 'جلسة',
  chartTitle: 'معدل القراءة اليومي',
  chartSubtitle: 'ما قرأته كل يوم بالآيات أو الصفحات أو الأجزاء',
  chartMetricAyahs: 'الآيات',
  chartMetricPages: 'الصفحات',
  chartMetricJuz: 'الأجزاء',
  chartRange7: '٧ أيام',
  chartRange30: '٣٠ يومًا',
  chartAvg: 'المعدل اليومي',
  chartTotal: 'الإجمالي',
  chartPeak: 'أعلى يوم',
  historyTitle: 'سجل القراءة اليومي',
  historyEmpty: 'لا يوجد سجل قراءة مسجل بعد',
} as const

const MUSHAF_1441_LAST_PAGE_KEY = 'mushaf1441:last-page:v1'

function subscribeStorage(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function getLastPageSnapshot(): number {
  if (typeof window === 'undefined') return 1
  try {
    const raw = window.localStorage.getItem(MUSHAF_1441_LAST_PAGE_KEY)
    const num = Number(raw)
    if (Number.isFinite(num) && num >= 1 && num <= 604) return num
  } catch {
    // fallback
  }
  return 1
}

function getLastPageServerSnapshot(): number {
  return 1
}

export interface ReadingStatisticsViewProps {
  readonly onOpenAddSession?: () => void
}

export function ReadingStatisticsView({ onOpenAddSession }: ReadingStatisticsViewProps) {
  const store = useReadingStore()
  const lastPage = useSyncExternalStore(subscribeStorage, getLastPageSnapshot, getLastPageServerSnapshot)

  const overview = useMemo(() => {
    return buildReadingStatsOverview({
      activeKhatma: store.activeKhatma,
      khatmas: store.khatmas,
      readingDays: store.readingDays,
      streaks: store.streaks,
    })
  }, [store.activeKhatma, store.khatmas, store.readingDays, store.streaks])

  const weeklyDays = useMemo(() => {
    return computeWeeklyDays(store.readingDays)
  }, [store.readingDays])

  return (
    <div className="flex w-full flex-col space-y-4 p-4 sm:p-6" dir="rtl">
      {/* 1. Khatma Summary Card */}
      <KhatmaSummaryCard overview={overview} />

      {/* 2. Continue Reading Banner */}
      <ContinueReadingBanner lastPage={lastPage} />

      {/* 3. Weekly Streak Tracker Card */}
      <WeeklyStreakTrackerCard
        currentStreak={overview.currentStreak}
        longestStreak={overview.longestStreak}
        days={weeklyDays}
        onAddSession={onOpenAddSession}
      />

      {/* 4. Daily Reading Progress Chart Card */}
      <DailyReadingProgressChartCard readingDays={store.readingDays} />

      {/* 5. Daily Reading History Card */}
      <DailyReadingHistoryCard readingDays={store.readingDays} />
    </div>
  )
}

// ============================================================
// 1. Khatma Summary Card
// ============================================================

interface KhatmaSummaryCardProps {
  readonly overview: ReturnType<typeof buildReadingStatsOverview>
}

export function KhatmaSummaryCard({ overview }: KhatmaSummaryCardProps) {
  const fraction = Math.max(0, Math.min(1, overview.progressPercentage / 100))
  const percentText = `${Math.round(overview.progressPercentage)}%`
  const tierInfo = classifyReadingProgressTier(overview.progressPercentage)

  const daysElapsed = calculateKhatmaDaysElapsed(
    overview.currentKhatma.startedAt,
    overview.currentKhatma.completedAt,
  )

  // Progress ring dimensions (viewBox 0 0 100 100)
  const radius = 38
  const strokeWidth = 8
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - fraction * circumference

  const tierStrokeColor =
    tierInfo.tier === 'high'
      ? 'var(--app-progress, #1A7340)'
      : tierInfo.tier === 'medium'
        ? 'var(--app-caution, #A14D07)'
        : 'var(--app-danger, #B4232A)'

  return (
    <section
      aria-label={STRINGS.khatmaCurrent}
      className="rounded-2xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--qiraat-card-fill,#ffffff)] p-4 shadow-xs sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left Side: Stats Text */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--mushaf-brown,#665b48)]">
              {STRINGS.khatmaCurrent} ({toArabicDigits(overview.currentKhatma.khatmaNumber)})
            </span>
            <span className="text-xs text-[var(--mushaf-brown,#665b48)]">•</span>
            <span className="text-xs font-semibold text-[var(--mushaf-brown,#665b48)] opacity-80">
              {STRINGS.durationElapsed} {toArabicDigits(daysElapsed)} {STRINGS.daysUnit}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-bold tabular-nums text-[var(--mushaf-ink,#171717)] sm:text-4xl">
              {toArabicDigits(percentText)}
            </span>
            <span className="text-sm font-semibold text-[var(--mushaf-brown,#665b48)]">
              {STRINGS.fromQuran}
            </span>
          </div>

          {/* Progress Bar (Phone) */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${fraction * 100}%`,
                backgroundColor: tierStrokeColor,
              }}
            />
          </div>

          <p className="text-xs font-medium text-[var(--mushaf-brown,#665b48)]">
            {toArabicDigits(overview.totalPagesReadInCurrentKhatma)} {STRINGS.khatmaPagesInfo}{' '}
            {toArabicDigits(overview.remainingPages)} • {toArabicDigits(overview.totalAyahsReadInCurrentKhatma)}{' '}
            {STRINGS.khatmaAyahsInfo}
          </p>
        </div>

        {/* Right Side: Circular Progress Ring */}
        <div className="flex shrink-0 items-center justify-center">
          <svg className="size-24 -rotate-90 transform" viewBox="0 0 100 100" aria-hidden="true">
            {/* Background Track */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-black/10"
              fill="transparent"
            />
            {/* Progress Stroke */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke={tierStrokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-500 ease-out"
            />
          </svg>
        </div>
      </div>

      <hr className="my-4 border-[var(--qiraat-card-stroke,#d7c7a7)] opacity-50" />

      {/* Lifetime Stats Figures */}
      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 sm:gap-4 sm:text-sm">
        <div>
          <p className="text-[11px] font-medium text-[var(--mushaf-brown,#665b48)]">
            {STRINGS.lifetimeTime}
          </p>
          <p className="mt-0.5 font-bold text-[var(--mushaf-ink,#171717)]">
            {overview.formattedLifetimeDuration}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-[var(--mushaf-brown,#665b48)]">
            {STRINGS.readingDays}
          </p>
          <p className="mt-0.5 font-bold text-[var(--mushaf-ink,#171717)]">
            {toArabicDigits(overview.totalReadingDays)} {STRINGS.daysWord}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-[var(--mushaf-brown,#665b48)]">
            {STRINGS.ayahsReadLifetime}
          </p>
          <p className="mt-0.5 font-bold text-[var(--mushaf-ink,#171717)]">
            {toArabicDigits(overview.lifetimeAyahsRead)} {STRINGS.ayahsWord}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-[var(--mushaf-brown,#665b48)]">
            {STRINGS.completedKhatmas}
          </p>
          <p className="mt-0.5 font-bold text-[var(--mushaf-ink,#171717)]">
            {toArabicDigits(overview.completedKhatmasCount)}
          </p>
        </div>
      </div>
    </section>
  )
}

// ============================================================
// 2. Continue Reading Banner
// ============================================================

interface ContinueReadingBannerProps {
  readonly lastPage: number
}

export function ContinueReadingBanner({ lastPage }: ContinueReadingBannerProps) {
  const meta = getMushaf1441PageMetadata(lastPage)
  const surahName = meta?.surahNames[0] ?? ''
  const ayahNum = meta?.firstAyahKey ? meta.firstAyahKey.split(':')[1] : '1'

  return (
    <Link
      href={`/mushaf-1441?page=${lastPage}`}
      className="flex min-h-[56px] items-center justify-between rounded-2xl border border-[var(--app-progress,#1A7340)]/30 bg-[var(--qiraat-card-fill,#ffffff)] p-3.5 shadow-xs transition-colors hover:border-[var(--app-progress,#1A7340)] active:scale-[0.99] sm:p-4"
    >
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--app-progress,#1A7340)]/15 text-lg text-[var(--app-progress,#1A7340)]"
        >
          📖
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--mushaf-ink,#171717)] sm:text-base">
            {STRINGS.continueReading}
          </p>
          <p className="text-xs text-[var(--mushaf-brown,#665b48)]">
            {STRINGS.surahWord} {surahName}، {STRINGS.ayahWord} {ayahNum} • {STRINGS.pageShort} {lastPage}
          </p>
        </div>
      </div>

      <span
        aria-hidden="true"
        className="text-lg font-bold text-[var(--mushaf-brown,#665b48)]"
      >
        ‹
      </span>
    </Link>
  )
}

// ============================================================
// 3. Weekly Streak Tracker Card
// ============================================================

interface WeeklyStreakTrackerCardProps {
  readonly currentStreak: number
  readonly longestStreak: number
  readonly days: ReturnType<typeof computeWeeklyDays>
  readonly onAddSession?: () => void
}

export function WeeklyStreakTrackerCard({
  currentStreak,
  longestStreak,
  days,
  onAddSession,
}: WeeklyStreakTrackerCardProps) {
  return (
    <section
      aria-label={STRINGS.streakActive}
      className="rounded-2xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--qiraat-card-fill,#ffffff)] p-4 shadow-xs sm:p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-full bg-[var(--app-caution,#A14D07)]/15 text-lg text-[var(--app-caution,#A14D07)]"
          >
            🔥
          </span>
          <div>
            <h3 className="text-sm font-bold text-[var(--mushaf-ink,#171717)] sm:text-base">
              {currentStreak} {STRINGS.streakActive}
            </h3>
            <p className="text-xs text-[var(--mushaf-brown,#665b48)]">
              {STRINGS.streakLongest} {longestStreak} {STRINGS.daysWord}
            </p>
          </div>
        </div>

        {onAddSession ? (
          <button
            type="button"
            onClick={onAddSession}
            className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-[var(--app-progress,#1A7340)]/15 px-3 text-xs font-bold text-[var(--app-progress,#1A7340)] transition-colors hover:bg-[var(--app-progress,#1A7340)]/25 active:scale-95"
          >
            <span>+</span>
            <span>{STRINGS.addSessionButton}</span>
          </button>
        ) : null}
      </div>

      {/* 7 Days Heat Map Row */}
      <div className="mt-4 grid grid-cols-7 gap-1 pt-1 text-center">
        {days.map((day) => {
          const heat = classifyDailyHeatLevel(day.readingSeconds, day.isRead)
          const heatFill =
            heat.level === 'deep'
              ? 'var(--app-progress-fill, #1A7340)'
              : heat.level === 'high'
                ? 'var(--app-progress, #1A7340)'
                : heat.level === 'medium'
                  ? 'rgba(26, 115, 64, 0.65)'
                  : heat.level === 'light'
                    ? 'rgba(26, 115, 64, 0.35)'
                    : 'transparent'

          return (
            <div key={day.dateString} className="flex flex-col items-center gap-1.5">
              <span
                className={`text-[11px] font-medium ${
                  day.isToday
                    ? 'font-bold text-[var(--app-progress,#1A7340)]'
                    : 'text-[var(--mushaf-brown,#665b48)]'
                }`}
              >
                {day.dayNameAr.slice(0, 3)}
              </span>

              <div
                className={`flex size-8 items-center justify-center rounded-full text-xs font-bold transition-transform ${
                  day.isRead
                    ? 'text-white shadow-xs'
                    : day.isToday
                      ? 'border-2 border-[var(--app-progress,#1A7340)] text-[var(--app-progress,#1A7340)]'
                      : 'border border-[var(--qiraat-card-stroke,#d7c7a7)] text-[var(--mushaf-brown,#665b48)]'
                }`}
                style={day.isRead ? { backgroundColor: heatFill } : undefined}
              >
                {day.dayNumber}
              </div>

              {/* Today Indicator Dot */}
              <div
                className={`size-1 rounded-full ${
                  day.isToday ? 'bg-[var(--app-progress,#1A7340)]' : 'bg-transparent'
                }`}
              />

              <span className="text-[10px] font-semibold text-[var(--mushaf-brown,#665b48)] tabular-nums">
                {day.formattedDuration}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ============================================================
// 4. Daily Reading Progress Chart Card
// ============================================================

interface DailyReadingProgressChartCardProps {
  readonly readingDays: readonly ReadingDayRecord[]
}

export function DailyReadingProgressChartCard({
  readingDays,
}: DailyReadingProgressChartCardProps) {
  const [metric, setMetric] = useState<ReadingChartMetric>('pages')
  const [range, setRange] = useState<ReadingChartRange>(7)
  const [selectedDayString, setSelectedDayString] = useState<string | null>(null)

  const points: DailyReadingChartPoint[] = useMemo(() => {
    return calculateChartPoints(readingDays, range)
  }, [readingDays, range])

  const summary: ReadingChartSummary = useMemo(() => {
    return calculateChartSummary(points, metric)
  }, [points, metric])

  const selectedPoint = points.find((p) => p.dateString === selectedDayString)

  const metricColor =
    metric === 'ayahs'
      ? 'var(--app-progress, #1A7340)'
      : metric === 'pages'
        ? 'var(--app-info, #1B5FC1)'
        : 'var(--app-insight, #6A3DB0)'

  return (
    <section
      aria-label={STRINGS.chartTitle}
      className="space-y-4 rounded-2xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--qiraat-card-fill,#ffffff)] p-4 shadow-xs sm:p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="text-base"
            style={{ color: metricColor }}
          >
            📊
          </span>
          <div>
            <h3 className="text-sm font-bold text-[var(--mushaf-ink,#171717)] sm:text-base">
              {STRINGS.chartTitle}
            </h3>
            <p className="text-xs text-[var(--mushaf-brown,#665b48)]">
              {STRINGS.chartSubtitle}
            </p>
          </div>
        </div>

        {/* Range Selector */}
        <div
          role="radiogroup"
          aria-label={STRINGS.chartTitle}
          className="flex rounded-full border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-black/5 p-0.5 text-xs font-bold"
        >
          {([7, 30] as const).map((r) => {
            const active = range === r
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setRange(r)
                  setSelectedDayString(null)
                }}
                className={`flex min-h-[44px] items-center justify-center rounded-full px-3 transition-colors ${
                  active
                    ? 'bg-[var(--qiraat-card-fill,#ffffff)] text-[var(--mushaf-ink,#171717)] shadow-xs'
                    : 'text-[var(--mushaf-brown,#665b48)]'
                }`}
              >
                {r === 7 ? STRINGS.chartRange7 : STRINGS.chartRange30}
              </button>
            )
          })}
        </div>
      </div>

      {/* Metric Segmented Control */}
      <div
        role="tablist"
        className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-black/5 p-1 text-center"
      >
        {(['ayahs', 'pages', 'juz'] as const).map((m) => {
          const active = metric === m
          const label =
            m === 'ayahs'
              ? STRINGS.chartMetricAyahs
              : m === 'pages'
                ? STRINGS.chartMetricPages
                : STRINGS.chartMetricJuz
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setMetric(m)
                setSelectedDayString(null)
              }}
              className={`min-h-[44px] rounded-lg text-xs font-bold transition-all sm:text-sm ${
                active
                  ? 'bg-[var(--qiraat-card-fill,#ffffff)] text-[var(--mushaf-ink,#171717)] shadow-xs'
                  : 'text-[var(--mushaf-brown,#665b48)]'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Summary Row or Day Callout */}
      {selectedPoint ? (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-black/5 p-3"
        >
          <div>
            <p className="text-xs font-semibold text-[var(--mushaf-brown,#665b48)]">
              {formatArabicDate(selectedPoint.dateString, { includeWeekday: true })}
            </p>
            <p className="text-base font-bold" style={{ color: metricColor }}>
              {formatChartMetricNumber(
                metric === 'ayahs'
                  ? selectedPoint.ayahs
                  : metric === 'pages'
                    ? selectedPoint.pages
                    : selectedPoint.juz,
                true,
              )}{' '}
              {getChartMetricUnit(metric, true)}
            </p>
          </div>
          {selectedPoint.seconds > 0 ? (
            <span className="rounded-lg bg-[var(--app-info,#1B5FC1)]/15 px-2.5 py-1 text-xs font-bold text-[var(--app-info,#1B5FC1)]">
              ⏱ {formatReadingDuration(selectedPoint.seconds)}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-black/5 p-2.5 text-center text-xs">
          <div>
            <p className="text-[11px] text-[var(--mushaf-brown,#665b48)]">{STRINGS.chartAvg}</p>
            <p className="mt-0.5 font-bold" style={{ color: metricColor }}>
              {formatChartMetricNumber(summary.average, true)} {getChartMetricUnit(metric, true)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--mushaf-brown,#665b48)]">{STRINGS.chartTotal}</p>
            <p className="mt-0.5 font-bold text-[var(--mushaf-ink,#171717)]">
              {formatChartMetricNumber(summary.total, true)} {getChartMetricUnit(metric, true)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--mushaf-brown,#665b48)]">{STRINGS.chartPeak}</p>
            <p className="mt-0.5 font-bold text-[var(--mushaf-brown,#665b48)]">
              {formatChartMetricNumber(summary.peak, true)} {getChartMetricUnit(metric, true)}
            </p>
          </div>
        </div>
      )}

      {/* SVG Bar Chart (No Chart Library) */}
      <div className="relative h-48 w-full select-none pt-2">
        <SvgBarChart
          points={points}
          metric={metric}
          summary={summary}
          selectedDayString={selectedDayString}
          onSelectDay={(dayStr) => {
            setSelectedDayString((cur) => (cur === dayStr ? null : dayStr))
          }}
          barColor={metricColor}
        />
      </div>
    </section>
  )
}

interface SvgBarChartProps {
  readonly points: readonly DailyReadingChartPoint[]
  readonly metric: ReadingChartMetric
  readonly summary: ReadingChartSummary
  readonly selectedDayString: string | null
  readonly onSelectDay: (dayString: string) => void
  readonly barColor: string
}

function SvgBarChart({
  points,
  metric,
  summary,
  selectedDayString,
  onSelectDay,
  barColor,
}: SvgBarChartProps) {
  const chartHeight = 160
  const chartWidth = 320
  const paddingLeft = 32
  const paddingRight = 10
  const paddingTop = 12
  const paddingBottom = 22

  const plotWidth = chartWidth - paddingLeft - paddingRight
  const plotHeight = chartHeight - paddingTop - paddingBottom

  const maxVal = Math.max(1, summary.axisMaximum)
  const barCount = points.length
  const slotWidth = plotWidth / barCount
  const barWidth = Math.max(3, Math.min(slotWidth * 0.7, 18))

  // 3 grid lines (0, 50%, 100%)
  const yTicks = [
    { value: maxVal, y: paddingTop },
    { value: Math.round(maxVal / 2), y: paddingTop + plotHeight / 2 },
    { value: 0, y: paddingTop + plotHeight },
  ]

  return (
    <svg
      className="size-full overflow-visible"
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Dashed Grid Lines & Left Y-Axis Labels */}
      {yTicks.map((tick) => (
        <g key={tick.y}>
          <line
            x1={paddingLeft}
            x2={chartWidth - paddingRight}
            y1={tick.y}
            y2={tick.y}
            stroke="currentColor"
            strokeDasharray="2,3"
            strokeWidth="0.75"
            className="text-black/15"
          />
          <text
            x={paddingLeft - 4}
            y={tick.y + 3}
            textAnchor="end"
            fontSize="8"
            fill="currentColor"
            className="text-[var(--mushaf-brown,#665b48)]"
          >
            {toArabicDigits(tick.value)}
          </text>
        </g>
      ))}

      {/* Bars */}
      {points.map((pt, i) => {
        const val =
          metric === 'ayahs' ? pt.ayahs : metric === 'pages' ? pt.pages : pt.juz
        const barHeight = Math.max(0, (val / maxVal) * plotHeight)
        const x = paddingLeft + i * slotWidth + (slotWidth - barWidth) / 2
        const y = paddingTop + plotHeight - barHeight
        const isSelected = selectedDayString === pt.dateString
        const hasSelection = selectedDayString !== null
        const opacity = !hasSelection || isSelected ? 1 : 0.35

        const dateParts = pt.dateString.split('-')
        const dayOfMonth = dateParts[2] ?? ''

        // Show X-axis label only for stride
        const stride = barCount === 30 ? 5 : 1
        const showLabel = i % stride === 0 || i === barCount - 1

        return (
          <g
            key={pt.dateString}
            onClick={() => onSelectDay(pt.dateString)}
            className="cursor-pointer"
          >
            {/* Clickable Target Box */}
            <rect
              x={paddingLeft + i * slotWidth}
              y={paddingTop}
              width={slotWidth}
              height={plotHeight}
              fill="transparent"
            />

            {/* Bar */}
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={barCount === 30 ? 1.5 : 3}
              ry={barCount === 30 ? 1.5 : 3}
              fill={barColor}
              opacity={opacity}
              className="transition-all duration-200"
            />

            {/* X-axis Day Number */}
            {showLabel ? (
              <text
                x={x + barWidth / 2}
                y={chartHeight - 4}
                textAnchor="middle"
                fontSize="8"
                fill="currentColor"
                className="text-[var(--mushaf-brown,#665b48)]"
              >
                {toArabicDigits(dayOfMonth)}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

// ============================================================
// 5. Daily Reading History Card
// ============================================================

interface DailyReadingHistoryCardProps {
  readonly readingDays: readonly ReadingDayRecord[]
}

export function DailyReadingHistoryCard({
  readingDays,
}: DailyReadingHistoryCardProps) {
  const recentDays = readingDays.slice(0, 7)

  return (
    <section
      aria-label={STRINGS.historyTitle}
      className="space-y-3 rounded-2xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--qiraat-card-fill,#ffffff)] p-4 shadow-xs sm:p-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="text-base text-[var(--app-info,#1B5FC1)]"
          >
            🗓
          </span>
          <h3 className="text-sm font-bold text-[var(--mushaf-ink,#171717)] sm:text-base">
            {STRINGS.historyTitle}
          </h3>
        </div>
        <span className="text-xs font-semibold text-[var(--mushaf-brown,#665b48)]">
          {toArabicDigits(readingDays.length)} {STRINGS.daysWord}
        </span>
      </div>

      {recentDays.length === 0 ? (
        <p className="py-4 text-center text-xs text-[var(--mushaf-brown,#665b48)]">
          {STRINGS.historyEmpty}
        </p>
      ) : (
        <ul className="space-y-2" role="list">
          {recentDays.map((day) => (
            <li
              key={day.dateString}
              className="flex items-center justify-between rounded-xl bg-black/5 px-3 py-2 text-xs"
            >
              <span className="font-semibold text-[var(--mushaf-ink,#171717)]">
                {formatArabicDate(day.dateString, { includeWeekday: true })}
              </span>

              <div className="flex items-center gap-2">
                <span className="font-bold text-[var(--app-info,#1B5FC1)]">
                  ⏱ {formatReadingDuration(day.secondsRead)}
                </span>
                <span className="text-[var(--mushaf-brown,#665b48)]">
                  • {toArabicDigits(day.pagesRead)} {STRINGS.pageShort} •{' '}
                  {toArabicDigits(day.ayahsRead)} {STRINGS.ayahsWord}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
