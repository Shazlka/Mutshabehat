'use client'

// History panel — recent transactions for the current page, with an Undo button each.

import { useEffect, useState } from 'react'
import type { HistoryTransaction } from '../_lib/types'
import { cn } from '@/lib/cn'
import SaveIndicator, { type SaveState } from './SaveIndicator'
import { formatDateTime } from './statusMeta'
import * as reviewApi from '../_lib/api'

type Props = {
  page: number
  deviceId: string
  onClose(): void
  onUndone(): Promise<void>
}

const OP_LABEL_AR: Record<string, string> = { INSERT: 'إضافة', UPDATE: 'تعديل', DELETE: 'حذف' }

export default function HistoryPanel({ page, deviceId, onClose, onUndone }: Props) {
  const [entries, setEntries] = useState<HistoryTransaction[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [undoState, setUndoState] = useState<Record<number, SaveState>>({})

  async function load() {
    setLoadError(null)
    const result = await reviewApi.getReviewHistory(page)
    if (!result.ok) {
      setLoadError(result.error.messageAr ?? result.error.message)
      return
    }
    setEntries(result.data)
  }

  useEffect(() => {
    setEntries(null)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  async function undo(txid: number) {
    setUndoState((current) => ({ ...current, [txid]: { phase: 'saving' } }))
    const result = await reviewApi.undoTransaction(txid, deviceId)
    if (!result.ok) {
      setUndoState((current) => ({
        ...current,
        [txid]: { phase: 'error', message: result.error.messageAr ?? result.error.message },
      }))
      return
    }
    setUndoState((current) => ({ ...current, [txid]: { phase: 'saved' } }))
    await load()
    await onUndone()
  }

  return (
    <aside
      dir="rtl"
      aria-label="سجل التعديلات"
      className="flex h-full w-full max-w-sm shrink-0 flex-col overflow-hidden border-s border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border-soft)] px-3 py-2">
        <h2 className="text-sm font-bold text-[var(--color-ink)]">سجل التعديلات — صفحة {page}</h2>
        <button
          type="button"
          aria-label="إغلاق السجل"
          className="min-h-8 min-w-8 rounded border border-[var(--color-border)] text-sm"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loadError ? (
          <p className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] p-2 text-xs text-[var(--color-danger)]">
            {loadError}
          </p>
        ) : null}
        {entries === null && !loadError ? (
          <p className="text-xs text-[var(--color-ink-muted)]">جارٍ التحميل…</p>
        ) : null}
        {entries && entries.length === 0 ? (
          <p className="text-xs text-[var(--color-ink-muted)]">لا توجد تعديلات مسجلة على هذه الصفحة بعد.</p>
        ) : null}

        <ul className="space-y-2">
          {(entries ?? []).map((transaction) => (
            <li
              key={transaction.txid}
              className={cn(
                'rounded-md border p-2 text-xs',
                transaction.undone ? 'border-[var(--color-border-soft)] opacity-60' : 'border-[var(--color-border)]'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[var(--color-ink)]">{formatDateTime(transaction.at)}</span>
                <span className="text-[10px] text-[var(--color-ink-muted)]">#{transaction.txid}</span>
              </div>
              <p className="mt-0.5 text-[10px] text-[var(--color-ink-muted)]">
                جهاز {transaction.deviceId ?? '—'}
                {transaction.entryId ? ` · سطر ${transaction.entryId}` : ''}
              </p>
              <ul className="mt-1 space-y-0.5">
                {transaction.changes.map((change, index) => (
                  <li key={index} className="text-[11px] text-[var(--color-ink-soft)]">
                    {OP_LABEL_AR[change.op] ?? change.op} · {change.table}
                    {change.field ? ` · ${change.field}` : ''}
                  </li>
                ))}
              </ul>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                {transaction.undone ? (
                  <span className="text-[11px] font-bold text-[var(--color-ink-muted)]">تم التراجع</span>
                ) : (
                  <button
                    type="button"
                    className="min-h-8 rounded-md border border-[var(--color-border)] px-2 text-[11px] font-bold text-[var(--color-primary)] hover:border-[var(--color-primary)]"
                    onClick={() => void undo(transaction.txid)}
                  >
                    تراجع
                  </button>
                )}
                <SaveIndicator state={undoState[transaction.txid] ?? { phase: 'idle' }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
