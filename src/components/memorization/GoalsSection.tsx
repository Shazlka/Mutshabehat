'use client'

import { useState } from 'react'
import type { GoalDefinition, GoalKind } from '../../../packages/memorization-core/backup'
import type { AyahMemorizationRecord, ChangeEvent } from '../../../packages/memorization-core/types'
import type { MemorizationSnapshot, GoalProgress } from '../../../packages/memorization-core/statistics'
import { computeGoalProgress } from '../../../packages/memorization-core/statistics'
import {
  type BrowserQuranIndex,
  formatPercent,
  formatNumber,
  formatDecimal,
} from '../../lib/memorization-view'

export interface GoalsSectionProps {
  goals: readonly GoalDefinition[]
  records: Readonly<Record<string, AyahMemorizationRecord>>
  events: readonly ChangeEvent[]
  snapshot: MemorizationSnapshot | null
  index: BrowserQuranIndex
  surahNames: Readonly<Record<number, string>>
  onSaveGoal: (goal: GoalDefinition) => Promise<boolean>
  onDeleteGoal: (goalId: string) => Promise<boolean>
}

const STRINGS = {
  sectionTitle: 'الأهداف',
  empty: 'لا توجد أهداف مسجلة بعد. الأهداف اختيارية لتنظيم جدولك.',
  addGoal: 'إضافة هدف',
  deleteGoal: 'حذف',
  deleteConfirm: 'هل أنت متأكد من حذف هذا الهدف؟',
  newGoalTitle: 'هدف جديد',
  goalType: 'نوع الهدف',
  ayatPerDay: 'آيات يومياً',
  pagesPerWeek: 'صفحات أسبوعياً',
  completeSurah: 'إتمام سورة',
  completeJuz: 'إتمام جزء',
  completeQuranBy: 'إتمام القرآن بتاريخ',
  amountLabel: 'المقدار',
  surahLabel: 'السورة',
  juzLabel: 'الجزء',
  dateLabel: 'التاريخ المستهدف',
  save: 'حفظ الهدف',
  cancel: 'إلغاء',
  remaining: 'المتبقي: ',
  goalReached: 'تم تحقيق الهدف ✓',
  days: (n: number) => `${n} يوم`,
  ayat: (n: number) => `${n} آية`,
  pages: (n: string) => `${n} صفحة`,
  goalTitleAyatDay: (n: number) => `${n} آية يومياً`,
  goalTitlePagesWeek: (n: string) => `${n} صفحة أسبوعياً`,
  goalTitleSurah: (name: string) => `إتمام سورة ${name}`,
  goalTitleJuz: (juz: number) => `إتمام الجزء ${juz}`,
  goalTitleQuranDate: (date: string) => `إتمام القرآن بحلول ${date}`,
}

export function GoalsSection({
  goals,
  records,
  events,
  snapshot,
  index,
  surahNames,
  onSaveGoal,
  onDeleteGoal,
}: GoalsSectionProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [goalKindType, setGoalKindType] = useState<GoalKind['type']>('ayatPerDay')
  const [amount, setAmount] = useState<number>(10)
  const [selectedSurah, setSelectedSurah] = useState<number>(78)
  const [selectedJuz, setSelectedJuz] = useState<number>(30)
  const [targetDate, setTargetDate] = useState<string>(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const describeGoalTitle = (goal: GoalDefinition): string => {
    switch (goal.kind.type) {
      case 'ayatPerDay':
        return STRINGS.goalTitleAyatDay(goal.kind.count)
      case 'pageEquivalentsPerWeek':
        return STRINGS.goalTitlePagesWeek(formatDecimal(goal.kind.target))
      case 'completeSurah':
        return STRINGS.goalTitleSurah(surahNames[goal.kind.surah] ?? String(goal.kind.surah))
      case 'completeJuz':
        return STRINGS.goalTitleJuz(goal.kind.juz)
      case 'completeQuranBy':
        return STRINGS.goalTitleQuranDate(goal.kind.date.slice(0, 10))
    }
  }

  const describeGoalRemaining = (progress: GoalProgress): string => {
    if (progress.isReached) return STRINGS.goalReached
    const parts: string[] = []
    if (progress.remainingDays !== null && progress.remainingDays !== undefined) {
      parts.push(STRINGS.days(progress.remainingDays))
    }
    if (progress.remainingAyat > 0) {
      parts.push(STRINGS.ayat(progress.remainingAyat))
    }
    if (progress.remainingPageEquivalents > 0.05) {
      parts.push(STRINGS.pages(formatDecimal(progress.remainingPageEquivalents)))
    }
    return parts.length > 0 ? STRINGS.remaining + parts.join(' · ') : STRINGS.goalReached
  }

  const handleSave = async () => {
    let kind: GoalKind
    switch (goalKindType) {
      case 'ayatPerDay':
        kind = { type: 'ayatPerDay', count: Math.max(1, amount) }
        break
      case 'pageEquivalentsPerWeek':
        kind = { type: 'pageEquivalentsPerWeek', target: Math.max(0.5, amount) }
        break
      case 'completeSurah':
        kind = { type: 'completeSurah', surah: selectedSurah }
        break
      case 'completeJuz':
        kind = { type: 'completeJuz', juz: selectedJuz }
        break
      case 'completeQuranBy':
        kind = { type: 'completeQuranBy', date: new Date(targetDate).toISOString() }
        break
    }

    const newGoal: GoalDefinition = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `goal-${Date.now()}`,
      kind,
      createdAt: new Date().toISOString(),
    }

    setIsSubmitting(true)
    try {
      await onSaveGoal(newGoal)
      setIsAdding(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm(STRINGS.deleteConfirm)) {
      await onDeleteGoal(id)
    }
  }

  return (
    <div
      data-testid="memo-goals"
      className="flex flex-col gap-3 rounded-xl border border-[var(--qiraat-card-stroke)] bg-[var(--qiraat-card-fill)] p-3.5 shadow-xs"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--qx-muted)]">
          {STRINGS.sectionTitle}
        </span>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex min-h-[44px] items-center text-xs font-bold text-[var(--memo-mastered)] hover:underline focus-visible:outline-2"
          >
            + {STRINGS.addGoal}
          </button>
        )}
      </div>

      {goals.length === 0 && !isAdding && (
        <p className="text-xs text-[var(--qx-muted)]">
          {STRINGS.empty}
        </p>
      )}

      {goals.map((goal) => {
        const dummySnapshot: MemorizationSnapshot = snapshot ?? {
          totalAyahs: 6236,
          counts: { 1: 0, 2: 0, 3: 0, 4: 6236 },
          strictPercent: 0,
          learningPercent: 0,
          canReciteCount: 0,
          surahs: [],
          juz: [],
          completedSurahs: 0,
          partialSurahs: 0,
          completeIncludingErrorsSurahs: 0,
          completedJuz: 0,
          pages: [],
          pagesFullyMastered: 0,
          pageEquivalentMastered: 0,
        }
        const progress = computeGoalProgress(
          goal,
          dummySnapshot,
          records,
          events,
          index,
          new Date(),
        )

        return (
          <div
            key={goal.id}
            className="flex flex-col gap-1.5 rounded-lg border border-[var(--qiraat-card-stroke)]/70 bg-[var(--mushaf-paper-tinted)]/40 p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-[var(--mushaf-ink)]">
                {describeGoalTitle(goal)}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[var(--memo-mastered)]">
                  {formatPercent(progress.fraction * 100)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(goal.id)}
                  aria-label={STRINGS.deleteGoal}
                  className="inline-flex size-7 min-h-[44px] min-w-[44px] items-center justify-center rounded text-xs text-[var(--app-danger)] hover:bg-[var(--app-danger)]/10"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--mushaf-rule-soft)]">
              <div
                className="h-full rounded-full bg-[var(--memo-mastered)] transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progress.fraction * 100))}%` }}
              />
            </div>

            <span className="text-[11px] text-[var(--qx-muted)]">
              {describeGoalRemaining(progress)}
            </span>
          </div>
        )
      })}

      {/* Add Goal Sub-form */}
      {isAdding && (
        <div className="flex flex-col gap-3 rounded-lg border border-[var(--memo-mastered)]/40 bg-[var(--mushaf-paper-tinted)] p-3">
          <span className="text-xs font-bold text-[var(--mushaf-ink)]">
            {STRINGS.newGoalTitle}
          </span>

          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--qx-muted)]">
            {STRINGS.goalType}
            <select
              value={goalKindType}
              onChange={(e) => setGoalKindType(e.target.value as GoalKind['type'])}
              className="min-h-[44px] rounded-lg border border-[var(--qiraat-card-stroke)] bg-[var(--qiraat-card-fill)] px-2.5 py-1.5 text-xs font-medium text-[var(--mushaf-ink)]"
            >
              <option value="ayatPerDay">{STRINGS.ayatPerDay}</option>
              <option value="pageEquivalentsPerWeek">{STRINGS.pagesPerWeek}</option>
              <option value="completeSurah">{STRINGS.completeSurah}</option>
              <option value="completeJuz">{STRINGS.completeJuz}</option>
              <option value="completeQuranBy">{STRINGS.completeQuranBy}</option>
            </select>
          </label>

          {(goalKindType === 'ayatPerDay' || goalKindType === 'pageEquivalentsPerWeek') && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--qx-muted)]">
              {STRINGS.amountLabel}
              <input
                type="number"
                min="1"
                max="600"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="min-h-[44px] rounded-lg border border-[var(--qiraat-card-stroke)] bg-[var(--qiraat-card-fill)] px-2.5 py-1.5 text-xs font-medium text-[var(--mushaf-ink)]"
              />
            </label>
          )}

          {goalKindType === 'completeSurah' && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--qx-muted)]">
              {STRINGS.surahLabel}
              <select
                value={selectedSurah}
                onChange={(e) => setSelectedSurah(Number(e.target.value))}
                className="min-h-[44px] rounded-lg border border-[var(--qiraat-card-stroke)] bg-[var(--qiraat-card-fill)] px-2.5 py-1.5 text-xs font-medium text-[var(--mushaf-ink)]"
              >
                {Array.from({ length: 114 }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={s}>
                    {s}. {surahNames[s] ?? s}
                  </option>
                ))}
              </select>
            </label>
          )}

          {goalKindType === 'completeJuz' && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--qx-muted)]">
              {STRINGS.juzLabel}
              <select
                value={selectedJuz}
                onChange={(e) => setSelectedJuz(Number(e.target.value))}
                className="min-h-[44px] rounded-lg border border-[var(--qiraat-card-stroke)] bg-[var(--qiraat-card-fill)] px-2.5 py-1.5 text-xs font-medium text-[var(--mushaf-ink)]"
              >
                {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                  <option key={j} value={j}>
                    الجزء {j}
                  </option>
                ))}
              </select>
            </label>
          )}

          {goalKindType === 'completeQuranBy' && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--qx-muted)]">
              {STRINGS.dateLabel}
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="min-h-[44px] rounded-lg border border-[var(--qiraat-card-stroke)] bg-[var(--qiraat-card-fill)] px-2.5 py-1.5 text-xs font-medium text-[var(--mushaf-ink)]"
              />
            </label>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSave}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-[var(--memo-mastered)] px-4 py-2 text-xs font-bold text-white shadow-xs transition-opacity hover:opacity-90 active:opacity-80"
            >
              {STRINGS.save}
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[var(--qiraat-card-stroke)] px-4 py-2 text-xs font-bold text-[var(--qx-muted)] hover:bg-[var(--mushaf-rule-soft)]"
            >
              {STRINGS.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
