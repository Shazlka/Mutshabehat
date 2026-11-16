'use client'

import { useState, useMemo } from 'react'
import type { AyahMemorizationRecord, ChangeEvent } from '../../../packages/memorization-core/types'
import {
  computePeriodGains,
  computeProgressSeries,
  type ProgressRange,
  type ProgressPoint,
} from '../../../packages/memorization-core/statistics'
import {
  type BrowserQuranIndex,
  describePeriodGains,
  formatPercent,
} from '../../lib/memorization-view'

export interface ProgressSectionProps {
  records: Readonly<Record<string, AyahMemorizationRecord>>
  events: readonly ChangeEvent[]
  streakDays: number
  index: BrowserQuranIndex
}

const STRINGS = {
  sectionTitle: 'التقدم',
  thisWeek: 'هذا الأسبوع',
  thisMonth: 'هذا الشهر',
  streakTitle: 'سلسلة الحفظ',
  streakDays: (n: number) => `${n} يوم`,
  rangeLabel: 'المدة',
  range7Days: '7 أيام',
  range30Days: '30 يوم',
  range3Months: '3 أشهر',
  range6Months: '6 أشهر',
  rangeYear: 'سنة',
  rangeAll: 'الكل',
  showLearning: 'إظهار تقدم الحفظ (التعلم)',
  noData: 'لا توجد بيانات كافية',
  chartSummary: (first: number, last: number) =>
    `الحفظ المتقن من ${formatPercent(first)} إلى ${formatPercent(last)}`,
  strictLegend: 'متقن',
  learningLegend: 'قيد الحفظ',
}

export function ProgressSection({
  records,
  events,
  streakDays,
  index,
}: ProgressSectionProps) {
  const [range, setRange] = useState<ProgressRange>('days30')
  const [showsLearning, setShowsLearning] = useState(false)

  const now = useMemo(() => new Date(), [])

  // Calculate weekStart (start of current week, Sunday)
  const weekStart = useMemo(() => {
    const d = new Date(now)
    const day = d.getDay() // 0 = Sun
    d.setDate(d.getDate() - day)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [now])

  // Calculate monthStart (first of current month)
  const monthStart = useMemo(() => {
    const d = new Date(now)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [now])

  const weekGains = useMemo(
    () => computePeriodGains(weekStart, now, records, events, index),
    [weekStart, now, records, events, index],
  )

  const monthGains = useMemo(
    () => computePeriodGains(monthStart, now, records, events, index),
    [monthStart, now, records, events, index],
  )

  const points: ProgressPoint[] = useMemo(
    () => computeProgressSeries(range, now, records, events, index),
    [range, now, records, events, index],
  )

  // Chart coordinate calculations
  const chartHeight = 120
  const chartWidth = 320
  const paddingX = 24
  const paddingY = 16

  const maxY = useMemo(() => {
    if (points.length === 0) return 10
    const vals = points.map((p) => (showsLearning ? Math.max(p.strictPercent, p.learningPercent) : p.strictPercent))
    const highest = Math.max(...vals, 1)
    return Math.min(100, Math.ceil(highest * 1.15))
  }, [points, showsLearning])

  const getCoordinates = (point: ProgressPoint, idx: number, type: 'strict' | 'learning') => {
    const total = points.length
    const x = total <= 1 ? chartWidth / 2 : paddingX + (idx / (total - 1)) * (chartWidth - 2 * paddingX)
    const val = type === 'strict' ? point.strictPercent : point.learningPercent
    const y = chartHeight - paddingY - (val / maxY) * (chartHeight - 2 * paddingY)
    return { x, y }
  }

  const strictPathData = useMemo(() => {
    if (points.length === 0) return ''
    return points
      .map((p, i) => {
        const { x, y } = getCoordinates(p, i, 'strict')
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }, [points, maxY])

  const learningPathData = useMemo(() => {
    if (!showsLearning || points.length === 0) return ''
    return points
      .map((p, i) => {
        const { x, y } = getCoordinates(p, i, 'learning')
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }, [points, showsLearning, maxY])

  const chartSummaryText = useMemo(() => {
    if (points.length === 0) return STRINGS.noData
    const first = points[0].strictPercent
    const last = points[points.length - 1].strictPercent
    return STRINGS.chartSummary(first, last)
  }, [points])

  return (
    <div
      data-testid="memo-progress"
      className="flex flex-col gap-3 rounded-xl border border-[var(--qiraat-card-stroke)] bg-[var(--qiraat-card-fill)] p-3.5 shadow-xs"
    >
      <span className="text-xs font-semibold text-[var(--qx-muted)]">
        {STRINGS.sectionTitle}
      </span>

      {/* Gains rows */}
      <div className="flex flex-col gap-1.5 border-b border-[var(--qiraat-card-stroke)]/70 pb-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[var(--mushaf-ink)]">{STRINGS.thisWeek}</span>
          <span className="font-medium text-[var(--qx-muted)]">
            {describePeriodGains(weekGains)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[var(--mushaf-ink)]">{STRINGS.thisMonth}</span>
          <span className="font-medium text-[var(--qx-muted)]">
            {describePeriodGains(monthGains)}
          </span>
        </div>
      </div>

      {/* Streak row */}
      <div className="flex items-center justify-between text-xs border-b border-[var(--qiraat-card-stroke)]/70 pb-2.5">
        <span className="font-bold text-[var(--mushaf-ink)]">{STRINGS.streakTitle}</span>
        <span className="font-bold text-[var(--app-caution)]">
          {STRINGS.streakDays(streakDays)}
        </span>
      </div>

      {/* Chart range selector */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[var(--qx-muted)]">{STRINGS.rangeLabel}</span>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ['days7', STRINGS.range7Days],
              ['days30', STRINGS.range30Days],
              ['months3', STRINGS.range3Months],
              ['months6', STRINGS.range6Months],
              ['year', STRINGS.rangeYear],
              ['all', STRINGS.rangeAll],
            ] as const
          ).map(([rKey, rLabel]) => (
            <button
              key={rKey}
              type="button"
              onClick={() => setRange(rKey)}
              className={`min-h-[32px] rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                range === rKey
                  ? 'bg-[var(--memo-mastered)] text-white'
                  : 'bg-[var(--mushaf-rule-soft)]/60 text-[var(--mushaf-ink)] hover:bg-[var(--mushaf-rule-soft)]'
              }`}
            >
              {rLabel}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Line Chart */}
      <div
        role="img"
        aria-label={chartSummaryText}
        className="relative flex w-full flex-col items-center justify-center overflow-hidden rounded-lg bg-[var(--mushaf-paper-tinted)]/40 p-2"
      >
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-32 w-full touch-none select-none overflow-visible"
        >
          {/* Subtle horizontal grid lines */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={chartWidth - paddingX}
            y2={paddingY}
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeDasharray="3 3"
          />
          <line
            x1={paddingX}
            y1={chartHeight / 2}
            x2={chartWidth - paddingX}
            y2={chartHeight / 2}
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeDasharray="3 3"
          />
          <line
            x1={paddingX}
            y1={chartHeight - paddingY}
            x2={chartWidth - paddingX}
            y2={chartHeight - paddingY}
            stroke="currentColor"
            strokeOpacity="0.15"
          />

          {/* Learning line */}
          {showsLearning && learningPathData && (
            <path
              d={learningPathData}
              fill="none"
              stroke="var(--memo-with-errors)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          )}

          {/* Strict mastered line */}
          {strictPathData && (
            <path
              d={strictPathData}
              fill="none"
              stroke="var(--memo-mastered)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          )}

          {/* Current end dot */}
          {points.length > 0 && (
            <>
              <circle
                cx={getCoordinates(points[points.length - 1], points.length - 1, 'strict').x}
                cy={getCoordinates(points[points.length - 1], points.length - 1, 'strict').y}
                r="4"
                fill="var(--memo-mastered)"
              />
              {showsLearning && (
                <circle
                  cx={getCoordinates(points[points.length - 1], points.length - 1, 'learning').x}
                  cy={getCoordinates(points[points.length - 1], points.length - 1, 'learning').y}
                  r="4"
                  fill="var(--memo-with-errors)"
                />
              )}
            </>
          )}
        </svg>

        {/* Legend */}
        <div className="flex items-center gap-4 pt-1 text-[11px] text-[var(--qx-muted)]">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[var(--memo-mastered)]" />
            <span>{STRINGS.strictLegend}</span>
          </div>
          {showsLearning && (
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[var(--memo-with-errors)]" />
              <span>{STRINGS.learningLegend}</span>
            </div>
          )}
        </div>
      </div>

      {/* Show learning toggle */}
      <label className="flex min-h-[44px] cursor-pointer items-center justify-between text-xs font-semibold text-[var(--mushaf-ink)]">
        <span>{STRINGS.showLearning}</span>
        <input
          type="checkbox"
          checked={showsLearning}
          onChange={(e) => setShowsLearning(e.target.checked)}
          className="size-5 rounded border-[var(--qiraat-card-stroke)] text-[var(--memo-mastered)] focus:ring-2 focus:ring-[var(--memo-mastered)]"
        />
      </label>
    </div>
  )
}
