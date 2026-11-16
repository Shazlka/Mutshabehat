'use client'

import { useState, useMemo } from 'react'
import type {
  BatchRecord,
  ChangeEvent,
  AyahMemorizationRecord,
} from '../../../packages/memorization-core/types'
import { MemorizationStatus } from '../../../packages/memorization-core/types'
import type { UndoBatchResult } from '../../lib/storage/memorization-db'
import {
  formatNumber,
  getStatusLabel,
} from '../../lib/memorization-view'

export interface HistoryViewProps {
  readonly batches: readonly BatchRecord[]
  readonly events: readonly ChangeEvent[]
  readonly onUndoBatch: (
    batchId: string,
    options?: { force?: boolean },
  ) => Promise<UndoBatchResult>
}

const STRINGS = {
  title: 'آخر التحديثات',
  emptyTitle: 'لا توجد تحديثات',
  emptyDescription: 'لا توجد دفعات تحديث سابقة.',
  today: 'اليوم',
  yesterday: 'أمس',
  ayatSuffix: 'آية',
  undoneBadge: 'تم التراجع',
  reviewBadge: 'مراجعة',
  undoBadge: 'تراجع',
  undoAction: 'تراجع',
  undoing: 'جارٍ التراجع...',
  conflictTitle: 'توجد تغييرات أحدث',
  conflictActionForce: 'تراجع على أي حال',
  cancel: 'إلغاء',
  errorTitle: 'خطأ',
  ok: 'حسناً',
}

interface ConflictState {
  readonly batchId: string
  readonly newer: readonly BatchRecord[]
}

interface DayGroup {
  readonly dayKey: string
  readonly dayTitle: string
  readonly batches: readonly BatchRecord[]
}

export function getDominantTransition(
  batchEvents: readonly ChangeEvent[],
): { from: MemorizationStatus; to: MemorizationStatus } | null {
  if (batchEvents.length === 0) return null

  const counts = new Map<string, { from: MemorizationStatus; to: MemorizationStatus; count: number }>()

  for (const event of batchEvents) {
    const from = event.before?.status ?? MemorizationStatus.notMemorized
    const to = event.after.status
    const key = `${from}->${to}`
    const existing = counts.get(key)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(key, { from, to, count: 1 })
    }
  }

  let best: { from: MemorizationStatus; to: MemorizationStatus; count: number } | null = null

  for (const item of counts.values()) {
    if (!best || item.count > best.count) {
      best = item
    } else if (item.count === best.count) {
      if (item.from < best.from) {
        best = item
      } else if (item.from === best.from && item.to < best.to) {
        best = item
      }
    }
  }

  return best ? { from: best.from, to: best.to } : null
}

function formatDayHeader(dateStr: string): { dayKey: string; dayTitle: string } {
  const d = new Date(dateStr)
  const now = new Date()

  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()

  const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`

  if (isToday) {
    return { dayKey, dayTitle: STRINGS.today }
  }
  if (isYesterday) {
    return { dayKey, dayTitle: STRINGS.yesterday }
  }

  const title = d.toLocaleDateString('ar-EG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return { dayKey, dayTitle: title }
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function HistoryView({
  batches,
  events,
  onUndoBatch,
}: HistoryViewProps) {
  const [conflictState, setConflictState] = useState<ConflictState | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [undoingBatchId, setUndoingBatchId] = useState<string | null>(null)

  // Map batchId -> events
  const eventsByBatch = useMemo(() => {
    const map = new Map<string, ChangeEvent[]>()
    for (const ev of events) {
      let list = map.get(ev.batchID)
      if (!list) {
        list = []
        map.set(ev.batchID, list)
      }
      list.push(ev)
    }
    return map
  }, [events])

  // Group batches by day
  const groups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, { dayTitle: string; batches: BatchRecord[] }>()

    for (const batch of batches) {
      const { dayKey, dayTitle } = formatDayHeader(batch.createdAt)
      let group = map.get(dayKey)
      if (!group) {
        group = { dayTitle, batches: [] }
        map.set(dayKey, group)
      }
      group.batches.push(batch)
    }

    return Array.from(map.entries()).map(([dayKey, g]) => ({
      dayKey,
      dayTitle: g.dayTitle,
      batches: g.batches,
    }))
  }, [batches])

  const handleUndo = async (batchId: string, force = false) => {
    setUndoingBatchId(batchId)
    setErrorMessage(null)

    try {
      const result = await onUndoBatch(batchId, { force })
      if (!result.ok) {
        if (result.reason === 'overlap' && result.conflicts && result.conflicts.length > 0) {
          setConflictState({
            batchId,
            newer: result.conflicts,
          })
        } else {
          setErrorMessage(
            result.reason === 'alreadyUndone'
              ? 'تم التراجع عن هذه الدفعة بالفعل.'
              : result.reason === 'notUndoable'
              ? 'لا يمكن التراجع عن هذه العملية.'
              : 'تعذر التراجع عن الدفعة.',
          )
        }
      } else {
        setConflictState(null)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'حدث خطأ أثناء التراجع.')
    } finally {
      setUndoingBatchId(null)
    }
  }

  if (batches.length === 0) {
    return (
      <div
        data-testid="memo-history"
        className="flex flex-col items-center justify-center p-8 text-center text-gray-500 dark:text-neutral-400 min-h-[50vh]"
        dir="rtl"
      >
        <span className="text-4xl mb-3">🕒</span>
        <h3 className="text-base font-bold text-gray-800 dark:text-neutral-200">
          {STRINGS.emptyTitle}
        </h3>
        <p className="mt-1 text-xs text-gray-400 dark:text-neutral-500">
          {STRINGS.emptyDescription}
        </p>
      </div>
    )
  }

  return (
    <div
      data-testid="memo-history"
      className="flex flex-col gap-6 px-4 pt-3 pb-24 text-right"
      dir="rtl"
    >
      {groups.map((group) => (
        <section key={group.dayKey} className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-gray-500 dark:text-neutral-400 px-1">
            {group.dayTitle}
          </h3>

          <div className="flex flex-col divide-y divide-gray-100 dark:divide-neutral-800/80 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 overflow-hidden shadow-xs">
            {group.batches.map((batch, idx) => {
              const isUndone = Boolean(batch.undoneAt)
              const isUndoable = !isUndone && (batch.kind === 'update' || batch.kind === 'review')
              const batchEvents = eventsByBatch.get(batch.id) ?? []
              const dominant = getDominantTransition(batchEvents)
              const transitionStr = dominant
                ? `${getStatusLabel(dominant.from)} ← ${getStatusLabel(dominant.to)}`
                : null

              return (
                <div
                  key={batch.id}
                  data-testid={`memo-history-row-${idx}`}
                  className="flex items-center justify-between p-3.5 transition hover:bg-gray-50/50 dark:hover:bg-neutral-800/50 min-h-[44px]"
                >
                  <div className="flex flex-col gap-1 pr-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          isUndone
                            ? 'line-through text-gray-400 dark:text-neutral-500'
                            : 'text-gray-900 dark:text-neutral-100'
                        }`}
                      >
                        {batch.label}
                      </span>

                      {isUndone && (
                        <span className="rounded-full bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-neutral-400">
                          {STRINGS.undoneBadge}
                        </span>
                      )}

                      {batch.kind === 'review' && (
                        <span className="rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-[10px] font-medium">
                          {STRINGS.reviewBadge}
                        </span>
                      )}

                      {batch.kind === 'undo' && (
                        <span className="rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-medium">
                          {STRINGS.undoBadge}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400 font-mono">
                      <span>{`${formatNumber(batch.ayahCount)} ${STRINGS.ayatSuffix}`}</span>
                      <span>·</span>
                      <span>{formatTime(batch.createdAt)}</span>
                      {transitionStr && (
                        <>
                          <span>·</span>
                          <span className="font-sans text-gray-600 dark:text-neutral-300">
                            {transitionStr}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {isUndoable && (
                    <button
                      type="button"
                      disabled={undoingBatchId === batch.id}
                      onClick={() => void handleUndo(batch.id, false)}
                      data-testid={`memo-history-undo-${idx}`}
                      className="shrink-0 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 transition hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 min-h-[44px] flex items-center justify-center mr-2"
                    >
                      {undoingBatchId === batch.id ? STRINGS.undoing : STRINGS.undoAction}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {/* Conflict Dialog */}
      {conflictState && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={STRINGS.conflictTitle}
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-2xl text-right animate-scale-in">
            <h3 className="text-base font-bold text-gray-900 dark:text-neutral-100">
              {STRINGS.conflictTitle}
            </h3>

            <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-neutral-300">
              توجد عمليات أحدث تؤثر على بعض هذه الآيات:
            </p>

            <div className="my-3 max-h-36 overflow-y-auto rounded-xl bg-gray-50 dark:bg-neutral-800/60 p-2.5 text-xs text-gray-700 dark:text-neutral-300 font-mono">
              {conflictState.newer.map((b) => (
                <div key={b.id} className="py-0.5 truncate">
                  • {b.label}
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConflictState(null)}
                className="rounded-xl border border-gray-200 dark:border-neutral-700 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-neutral-300 transition hover:bg-gray-100 dark:hover:bg-neutral-800 min-h-[44px] flex items-center"
              >
                {STRINGS.cancel}
              </button>

              <button
                type="button"
                onClick={() => void handleUndo(conflictState.batchId, true)}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700 min-h-[44px] flex items-center"
              >
                {STRINGS.conflictActionForce}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Dialog */}
      {errorMessage && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={STRINGS.errorTitle}
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-2xl text-right animate-scale-in">
            <h3 className="text-base font-bold text-red-600 dark:text-red-400">
              {STRINGS.errorTitle}
            </h3>

            <p className="mt-2 text-xs leading-relaxed text-gray-700 dark:text-neutral-300">
              {errorMessage}
            </p>

            <div className="mt-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="rounded-xl bg-gray-900 dark:bg-neutral-100 px-4 py-2 text-xs font-semibold text-white dark:text-neutral-900 min-h-[44px] flex items-center"
              >
                {STRINGS.ok}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
