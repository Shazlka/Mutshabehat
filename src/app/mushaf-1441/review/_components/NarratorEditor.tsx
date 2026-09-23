'use client'

// Narrator editor — the 20 narrators (reader/narrator, sometimes a route beneath a narrator)
// grouped by reader; pick main or further wajh (wajhOrder), an action text, and a wajh note
// required and enforced in the UI when Hafs (Q05-R02) is chosen, and only allowed as wajh >= 2.
//
// D7 — every change (select/number) saves immediately; free-text fields (action, wajh note) save
// on blur so the request isn't fired per keystroke, matching the rest of the row editor.

import { useEffect, useState } from 'react'
import type { CatalogNarrator, NarratorInput, ReviewNarrator, ReviewResult, ReviewRow } from '../_lib/types'
import { cn } from '@/lib/cn'
import SaveIndicator, { type SaveState } from './SaveIndicator'

const HAFS_NARRATOR_ID = 'Q05-R02'
const D8_MESSAGE = 'حفص هو الأصل: لا يُذكر إلا وجهًا ثانيًا مع ملاحظة'
const NARRATOR_TWICE_MESSAGE = 'راوٍ مكرر في هذا الموضع دون وجه مستقل'

type LocalNarrator = { id: string; action: string; wajhOrder: number; wajhNote: string }

type Props = {
  row: ReviewRow
  catalog: CatalogNarrator[]
  onSave(narrators: NarratorInput[]): Promise<ReviewResult<ReviewRow>>
  onSaved(row: ReviewRow): void
}

function toLocal(narrators: ReviewNarrator[]): LocalNarrator[] {
  return narrators.map((n) => ({
    id: n.id,
    action: n.action ?? '',
    wajhOrder: n.wajhOrder || 1,
    wajhNote: n.wajhNote ?? '',
  }))
}

function toPayload(rows: LocalNarrator[]): NarratorInput[] {
  return rows
    .filter((row) => row.id)
    .map((row) => ({
      id: row.id,
      action: row.action.trim() ? row.action.trim() : null,
      wajhOrder: row.wajhOrder,
      wajhNote: row.wajhNote.trim() ? row.wajhNote.trim() : null,
    }))
}

function validate(rows: LocalNarrator[]): string | null {
  const withId = rows.filter((row) => row.id)
  for (const row of withId) {
    if (row.id === HAFS_NARRATOR_ID && (row.wajhOrder < 2 || !row.wajhNote.trim())) {
      return D8_MESSAGE
    }
  }
  const seen = new Set<string>()
  for (const row of withId) {
    const key = `${row.id}::${row.wajhOrder}`
    if (seen.has(key)) return NARRATOR_TWICE_MESSAGE
    seen.add(key)
  }
  return null
}

function narratorLabel(catalog: CatalogNarrator | undefined, id: string) {
  return catalog?.nameAr ?? id
}

export default function NarratorEditor({ row, catalog, onSave, onSaved }: Props) {
  const [rows, setRows] = useState<LocalNarrator[]>(() => toLocal(row.narrators))
  const [saveState, setSaveState] = useState<SaveState>({ phase: 'idle' })
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    setRows(toLocal(row.narrators))
    setSaveState({ phase: 'idle' })
    setValidationError(null)
  }, [row.entryId])

  const readers = catalog.filter((entity) => entity.type === 'reader')
  const narratorsByReader = new Map<string, CatalogNarrator[]>()
  for (const entity of catalog) {
    if (entity.type !== 'narrator') continue
    const list = narratorsByReader.get(entity.parentId ?? '')
    if (list) list.push(entity)
    else narratorsByReader.set(entity.parentId ?? '', [entity])
  }
  const byId = new Map(catalog.map((entity) => [entity.id, entity]))

  async function commit(next: LocalNarrator[]) {
    setRows(next)
    const problem = validate(next)
    setValidationError(problem)
    if (problem) return
    setSaveState({ phase: 'saving' })
    const result = await onSave(toPayload(next))
    if (result.ok) {
      onSaved(result.data)
      setSaveState({ phase: 'saved' })
      setTimeout(() => setSaveState((current) => (current.phase === 'saved' ? { phase: 'idle' } : current)), 2000)
      return
    }
    if (result.error.code === 'VERSION_CONFLICT') {
      setSaveState({ phase: 'error', message: 'تم تعديل هذا العنصر في مكان آخر. أُعيد تحميله.' })
      return
    }
    setSaveState({ phase: 'error', message: result.error.messageAr ?? result.error.message })
  }

  function updateRow(index: number, patch: Partial<LocalNarrator>) {
    const next = rows.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    setRows(next)
  }

  return (
    <fieldset className="space-y-2 rounded-lg border border-[var(--color-border)] p-3">
      <legend className="px-1 text-xs font-bold text-[var(--color-ink)]">الرواة</legend>

      {rows.map((entry, index) => {
        const catalogEntry = byId.get(entry.id)
        const isHafs = entry.id === HAFS_NARRATOR_ID
        return (
          <div
            key={index}
            className="grid grid-cols-1 gap-1.5 rounded-md border border-[var(--color-border-soft)] p-2 sm:grid-cols-[1fr_auto]"
          >
            <div className="grid grid-cols-2 gap-1.5">
              <label className="col-span-2 text-[10px] font-bold text-[var(--color-ink-muted)]">
                الراوي
                <select
                  className="mt-0.5 min-h-9 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs"
                  value={entry.id}
                  onChange={(event) => commit(rows.map((entry, i) => (i === index ? { ...entry, id: event.target.value } : entry)))}
                >
                  <option value="">— اختر راويًا —</option>
                  {readers.map((reader) => (
                    <optgroup key={reader.id} label={reader.nameAr}>
                      {(narratorsByReader.get(reader.id) ?? []).map((narrator) => (
                        <option key={narrator.id} value={narrator.id}>
                          {narrator.nameAr}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <label className="text-[10px] font-bold text-[var(--color-ink-muted)]">
                الوجه
                <select
                  className="mt-0.5 min-h-9 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs"
                  value={entry.wajhOrder}
                  onChange={(event) =>
                    commit(rows.map((entry, i) => (i === index ? { ...entry, wajhOrder: Number(event.target.value) } : entry)))
                  }
                >
                  <option value={1}>الأصلي (١)</option>
                  <option value={2}>ثانٍ (٢)</option>
                  <option value={3}>ثالث (٣)</option>
                </select>
              </label>

              <label className="text-[10px] font-bold text-[var(--color-ink-muted)]">
                نص الأداء
                <input
                  className="mt-0.5 min-h-9 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs"
                  value={entry.action}
                  onChange={(event) => updateRow(index, { action: event.target.value })}
                  onBlur={() => commit(rows)}
                />
              </label>

              <label
                className={cn(
                  'col-span-2 text-[10px] font-bold',
                  isHafs && entry.wajhOrder >= 2 ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink-muted)]'
                )}
              >
                ملاحظة الوجه {isHafs ? '(مطلوبة لحفص)' : '(اختيارية)'}
                <textarea
                  className="mt-0.5 min-h-9 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs"
                  value={entry.wajhNote}
                  onChange={(event) => updateRow(index, { wajhNote: event.target.value })}
                  onBlur={() => commit(rows)}
                />
              </label>
            </div>

            <button
              type="button"
              aria-label={`إزالة ${narratorLabel(catalogEntry, entry.id)}`}
              className="min-h-9 self-start rounded border border-[var(--color-border)] px-2 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
              onClick={() => commit(rows.filter((_, i) => i !== index))}
            >
              إزالة
            </button>
          </div>
        )
      })}

      <button
        type="button"
        className="min-h-9 rounded-md border border-dashed border-[var(--color-border)] px-3 text-xs font-bold text-[var(--color-primary)] hover:border-[var(--color-primary)]"
        onClick={() => setRows([...rows, { id: '', action: '', wajhOrder: 1, wajhNote: '' }])}
      >
        + إضافة راوٍ
      </button>

      {validationError ? (
        <p className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-2 py-1 text-xs font-bold text-[var(--color-danger)]" role="alert">
          {validationError}
        </p>
      ) : (
        <SaveIndicator state={saveState} />
      )}
    </fieldset>
  )
}
