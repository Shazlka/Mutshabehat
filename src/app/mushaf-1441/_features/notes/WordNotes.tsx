'use client'

import { useEffect, useRef, useState } from 'react'
import { isEmptyNote, noteId, NOTES_STORE, type QiraatWordNote } from '../../../../../packages/qiraat-core/features/notes'
import { usePersonalStore } from './usePersonalStore'

/** Favourite star and a personal note for the open Qiraat word, kept on this device. */
export function WordNotes({ surah, ayah, token }: { surah: number; ayah: number; token: number }) {
  const store = usePersonalStore()
  const id = noteId(surah, ayah, token)
  const [note, setNote] = useState<QiraatWordNote | null>(null)
  const [open, setOpen] = useState(false)
  const latest = useRef<QiraatWordNote | null>(null)

  useEffect(() => {
    let alive = true
    // Reset for the newly opened word before its saved note arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNote(null)
    setOpen(false)
    if (!store) return
    void store.get<QiraatWordNote>(NOTES_STORE, id).then((found) => {
      if (!alive) return
      setNote(found ?? null)
      latest.current = found ?? null
      if (found && found.text.trim()) setOpen(true)
    })
    return () => { alive = false }
  }, [store, id])

  if (!store) return null

  async function save(next: Partial<Pick<QiraatWordNote, 'text' | 'favourite'>>) {
    const base: QiraatWordNote = latest.current ?? { id, surah, ayah, token, text: '', favourite: false, updatedAt: '' }
    const updated = { ...base, ...next, updatedAt: new Date().toISOString() }
    latest.current = updated
    setNote(updated)
    if (isEmptyNote(updated)) await store!.delete(NOTES_STORE, id)
    else await store!.put(NOTES_STORE, id, updated)
  }

  return (
    <div data-testid="word-notes" className="rounded-lg border border-[var(--mushaf-rule-soft)] bg-white p-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          data-testid="favourite-toggle"
          aria-pressed={note?.favourite === true}
          onClick={() => void save({ favourite: !(note?.favourite ?? false) })}
          className="min-h-6 rounded border border-[var(--mushaf-rule)] px-2 text-[11px] font-bold [@media(pointer:coarse)]:min-h-11"
        >
          {note?.favourite ? '★ في المفضلة' : '☆ أضف إلى المفضلة'}
        </button>
        <button
          type="button"
          data-testid="note-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="min-h-6 rounded border border-[var(--mushaf-rule)] px-2 text-[11px] font-bold [@media(pointer:coarse)]:min-h-11"
        >
          {open ? 'إخفاء الملاحظة' : note?.text.trim() ? 'ملاحظتي' : '+ ملاحظة'}
        </button>
      </div>
      {open ? (
        <textarea
          data-testid="note-text"
          aria-label="ملاحظتي على هذه الكلمة"
          defaultValue={note?.text ?? ''}
          key={id}
          onBlur={(event) => { if (event.target.value !== (note?.text ?? '')) void save({ text: event.target.value }) }}
          rows={3}
          className="mt-2 w-full rounded border border-[var(--mushaf-rule)] p-2 text-xs"
        />
      ) : null}
      {!store.available ? <p data-testid="not-saved" className="mt-1 text-[11px] font-bold text-[#8a2f10]">غير محفوظ على هذا الجهاز: يبقى حتى تغلق الصفحة.</p> : null}
    </div>
  )
}
