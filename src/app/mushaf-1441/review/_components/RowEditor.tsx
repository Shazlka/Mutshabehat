'use client'

// Row editor — drawer/inline panel on the LEFT (D9), for the row selected in the table or page.
//
// D7 — instant save: every meaningful change calls the API immediately (selects/buttons on
// change, free-text fields on blur so a request isn't fired per keystroke) and shows a visible
// saved/error state. On 409 VERSION_CONFLICT the row is reloaded and the user is told; on 422
// RULE_* the messageAr is shown inline and the user's input is kept (field state only resets when
// a different row is selected, never from a save response).

import { useEffect, useState } from 'react'
import type { EntryFields, ReviewPage, ReviewResult, ReviewRow, ReviewStatus } from '../_lib/types'
import { cn } from '@/lib/cn'
import NarratorEditor from './NarratorEditor'
import SaveIndicator, { type SaveState } from './SaveIndicator'
import { formatPosition, STATUS_LABEL_AR, statusBadgeStyle } from './statusMeta'
import * as reviewApi from '../_lib/api'

type Props = {
  row: ReviewRow
  page: ReviewPage
  deviceId: string
  onRowUpdated(row: ReviewRow): void
  onReloadPage(): Promise<void>
  onClose(): void
}

type FieldState = {
  notes: string
  readingText: string
  uthmaniText: string
  description: string
  performanceNote: string
  variantType: string
  categoryCode: string
  rulingText: string
}

function fieldsFromRow(row: ReviewRow): FieldState {
  return {
    notes: row.notes ?? '',
    readingText: row.readingText ?? '',
    uthmaniText: row.uthmaniText ?? '',
    description: row.description ?? '',
    performanceNote: row.performanceNote ?? '',
    variantType: row.variantType ?? '',
    categoryCode: row.categoryCode ?? '',
    rulingText: row.rulingText ?? '',
  }
}

const inputClass =
  'mt-1 min-h-9 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]'
const labelClass = 'block text-xs font-bold text-[var(--color-ink-soft)]'

export default function RowEditor({ row, page, deviceId, onRowUpdated, onReloadPage, onClose }: Props) {
  const [fields, setFields] = useState<FieldState>(() => fieldsFromRow(row))
  const [statusNote, setStatusNote] = useState('')
  const [deleteNote, setDeleteNote] = useState('')
  const [saveState, setSaveState] = useState<SaveState>({ phase: 'idle' })

  useEffect(() => {
    setFields(fieldsFromRow(row))
    setStatusNote('')
    setDeleteNote('')
    setSaveState({ phase: 'idle' })
  }, [row.entryId])

  function showSaved() {
    setSaveState({ phase: 'saved' })
    setTimeout(() => setSaveState((current) => (current.phase === 'saved' ? { phase: 'idle' } : current)), 2000)
  }

  async function afterResult(result: ReviewResult<ReviewRow>) {
    if (result.ok) {
      onRowUpdated(result.data)
      showSaved()
      return
    }
    if (result.error.code === 'VERSION_CONFLICT') {
      setSaveState({ phase: 'error', message: 'تم تعديل هذا العنصر في مكان آخر. يُعاد تحميله الآن.' })
      await onReloadPage()
      return
    }
    setSaveState({ phase: 'error', message: result.error.messageAr ?? result.error.message })
  }

  async function saveStatus(status: ReviewStatus) {
    setSaveState({ phase: 'saving' })
    const result = await reviewApi.setStatus(row, status, statusNote.trim() || null, deviceId)
    await afterResult(result)
    if (result.ok) setStatusNote('')
  }

  async function saveFields(patch: EntryFields) {
    setSaveState({ phase: 'saving' })
    const result = await reviewApi.updateEntry(row, patch, deviceId)
    await afterResult(result)
  }

  async function saveDelete() {
    setSaveState({ phase: 'saving' })
    const result = await reviewApi.deleteEntry(row, deleteNote.trim() || null, deviceId)
    await afterResult(result)
    if (result.ok) setDeleteNote('')
  }

  async function saveRestore() {
    setSaveState({ phase: 'saving' })
    const result = await reviewApi.restoreEntry(row, deviceId)
    await afterResult(result)
  }

  const openFlags = row.flags.filter((flag) => flag.status === 'open')
  const resolvedFlags = row.flags.filter((flag) => flag.status !== 'open')

  return (
    <section
      dir="rtl"
      aria-label="محرر السطر"
      className="flex max-h-[58%] min-h-0 flex-col overflow-hidden border-t border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-[var(--color-border-soft)] px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[var(--color-ink-muted)]">
            {formatPosition(row.surah, row.ayah, row.startWord)} · صفحة {row.page}
          </p>
          <p className="font-quran truncate text-lg text-[var(--color-ink)]">{row.hafsText}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SaveIndicator state={saveState} />
          <button
            type="button"
            aria-label="إغلاق المحرر"
            className="min-h-8 min-w-8 rounded border border-[var(--color-border)] text-sm"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {/* Status buttons + note */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="حالة المراجعة">
            {(['reviewed', 'flagged', 'unreviewed'] as ReviewStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => void saveStatus(status)}
                aria-pressed={row.reviewStatus === status}
                className={cn(
                  'min-h-9 rounded-full border px-3 text-xs font-bold transition-colors',
                  row.reviewStatus === status ? 'border-transparent' : 'border-[var(--color-border)]'
                )}
                style={row.reviewStatus === status ? statusBadgeStyle(status) : undefined}
              >
                {STATUS_LABEL_AR[status]}
              </button>
            ))}
          </div>
          <input
            className={inputClass}
            placeholder="ملاحظة اختيارية عند تغيير الحالة (تُغلق البلاغات المفتوحة عند التحويل إلى «مُراجَع»)"
            value={statusNote}
            onChange={(event) => setStatusNote(event.target.value)}
          />
        </div>

        {/* Flags — open first */}
        {row.flags.length ? (
          <div className="space-y-1">
            <p className={labelClass}>البلاغات</p>
            <ul className="space-y-1">
              {[...openFlags, ...resolvedFlags].map((flag) => (
                <li
                  key={flag.id}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs',
                    flag.status === 'open'
                      ? 'border-[var(--color-danger)]/40 bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
                      : 'border-[var(--color-border-soft)] text-[var(--color-ink-muted)]'
                  )}
                >
                  <span className="font-bold">{flag.issueAr}</span>
                  <span className="mx-1">·</span>
                  <span>{flag.status === 'open' ? 'مفتوح' : flag.status}</span>
                  {flag.resolvedNote ? <span className="mx-1">· {flag.resolvedNote}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Kind-specific fields */}
        {row.kind === 'farsh' ? (
          <div className="space-y-2">
            <label className={labelClass}>
              نص القراءة
              <textarea
                dir="rtl"
                className={cn(inputClass, 'font-quran min-h-16')}
                value={fields.readingText}
                onChange={(event) => setFields({ ...fields, readingText: event.target.value })}
                onBlur={() => fields.readingText !== (row.readingText ?? '') && void saveFields({ readingText: fields.readingText })}
              />
            </label>
            <label className={labelClass}>
              الرسم العثماني
              <textarea
                dir="rtl"
                className={cn(inputClass, 'font-quran min-h-16')}
                value={fields.uthmaniText}
                onChange={(event) => setFields({ ...fields, uthmaniText: event.target.value })}
                onBlur={() =>
                  fields.uthmaniText !== (row.uthmaniText ?? '') && void saveFields({ uthmaniText: fields.uthmaniText || null })
                }
              />
            </label>
            <label className={labelClass}>
              الوصف
              <textarea
                className={cn(inputClass, 'min-h-14')}
                value={fields.description}
                onChange={(event) => setFields({ ...fields, description: event.target.value })}
                onBlur={() =>
                  fields.description !== (row.description ?? '') && void saveFields({ description: fields.description || null })
                }
              />
            </label>
            <label className={labelClass}>
              ملاحظة الأداء
              <input
                className={inputClass}
                value={fields.performanceNote}
                onChange={(event) => setFields({ ...fields, performanceNote: event.target.value })}
                onBlur={() =>
                  fields.performanceNote !== (row.performanceNote ?? '') &&
                  void saveFields({ performanceNote: fields.performanceNote || null })
                }
              />
            </label>
            <label className={labelClass}>
              نوع الاختلاف
              <select
                className={inputClass}
                value={fields.variantType}
                onChange={(event) => {
                  setFields({ ...fields, variantType: event.target.value })
                  void saveFields({ variantType: event.target.value })
                }}
              >
                <option value="">—</option>
                {page.variantTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="space-y-2">
            <label className={labelClass}>
              الفئة
              <select
                className={inputClass}
                value={fields.categoryCode}
                onChange={(event) => {
                  setFields({ ...fields, categoryCode: event.target.value })
                  void saveFields({ categoryCode: event.target.value })
                }}
              >
                <option value="">—</option>
                {page.categories.map((category) => (
                  <option key={category.code} value={category.code}>
                    {category.nameAr}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              نص الحكم
              <textarea
                className={cn(inputClass, 'min-h-16')}
                value={fields.rulingText}
                onChange={(event) => setFields({ ...fields, rulingText: event.target.value })}
                onBlur={() =>
                  fields.rulingText !== (row.rulingText ?? '') && void saveFields({ rulingText: fields.rulingText || null })
                }
              />
            </label>
          </div>
        )}

        {/* Notes */}
        <label className={labelClass}>
          ملاحظات
          <textarea
            className={cn(inputClass, 'min-h-14')}
            value={fields.notes}
            onChange={(event) => setFields({ ...fields, notes: event.target.value })}
            onBlur={() => fields.notes !== (row.notes ?? '') && void saveFields({ notes: fields.notes || null })}
          />
        </label>

        {/* Narrators */}
        <NarratorEditor
          row={row}
          catalog={page.narrators}
          onSave={(narrators) => reviewApi.setNarrators(row, narrators, deviceId)}
          onSaved={onRowUpdated}
        />

        {/* Delete / restore */}
        <div className="space-y-1.5 border-t border-[var(--color-border-soft)] pt-2">
          {row.deleted ? (
            <button
              type="button"
              className="min-h-9 rounded-md border border-[var(--color-success)] px-3 text-xs font-bold text-[var(--color-success)] hover:bg-[var(--color-success-bg)]"
              onClick={() => void saveRestore()}
            >
              استعادة السطر
            </button>
          ) : (
            <>
              <input
                className={inputClass}
                placeholder="سبب الحذف (اختياري)"
                value={deleteNote}
                onChange={(event) => setDeleteNote(event.target.value)}
              />
              <button
                type="button"
                className="min-h-9 rounded-md border border-[var(--color-danger)] px-3 text-xs font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                onClick={() => void saveDelete()}
              >
                حذف السطر
              </button>
            </>
          )}
        </div>

        <p className="text-[10px] text-[var(--color-ink-muted)]">
          سجل الإصدار: {row.version} · آخر رقم معاملة يظهر في لوحة السجل.
        </p>
      </div>
    </section>
  )
}
