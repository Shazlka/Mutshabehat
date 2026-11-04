'use client'

import { useEffect, useRef, useState } from 'react'
import { isEmptyNote, noteId, NOTES_STORE, type QiraatWordNote } from '../../../../../packages/qiraat-core/features/notes'
import { Glyph } from '../host/Glyph'
import { usePersonalStore } from './usePersonalStore'

/** Favourite star and a personal note for the open Qiraat word, kept on this device. */
export function WordNotes({ surah, ayah, token }: { surah: number; ayah: number; token: number }) {
  const store = usePersonalStore()
  const id = noteId(surah, ayah, token)
  const [note, setNote] = useState<QiraatWordNote | null>(null)
  const [open, setOpen] = useState(false)
  const latest = useRef<QiraatWordNote | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const pendingText = useRef<{ id: string; text: string } | null>(null)
  const timer = useRef<number | null>(null)

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

  // A note is saved a moment after typing stops, and when the word changes or the sheet closes, not only on blur.
  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
      const pending = pendingText.current
      if (pending && store) void persist(pending.id, { text: pending.text })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, id])

  if (!store) return null

  async function persist(noteKey: string, next: Partial<Pick<QiraatWordNote, 'text' | 'favourite'>>) {
    const base: QiraatWordNote = latest.current?.id === noteKey ? latest.current : { id: noteKey, surah, ayah, token, text: '', favourite: false, updatedAt: '' }
    const updated = { ...base, ...next, updatedAt: new Date().toISOString() }
    latest.current = updated
    pendingText.current = null
    setNote(updated)
    try {
      if (isEmptyNote(updated)) await store!.delete(NOTES_STORE, noteKey)
      else await store!.put(NOTES_STORE, noteKey, updated)
      setSaveFailed(false)
    } catch {
      // Quota or blocked storage: the star already shows, so say it did not reach the device.
      setSaveFailed(true)
    }
  }
  const save = (next: Partial<Pick<QiraatWordNote, 'text' | 'favourite'>>) => persist(id, next)

  function typed(text: string) {
    pendingText.current = { id, text }
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { void persist(id, { text }) }, 600)
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
          {note?.favourite ? <><Glyph>★</Glyph> في المفضلة</> : <><Glyph>☆</Glyph> أضف إلى المفضلة</>}
        </button>
        <button
          type="button"
          data-testid="note-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="min-h-6 rounded border border-[var(--mushaf-rule)] px-2 text-[11px] font-bold [@media(pointer:coarse)]:min-h-11"
        >
          {open ? 'إخفاء الملاحظة' : note?.text.trim() ? 'ملاحظتي' : <><Glyph>+</Glyph> ملاحظة</>}
        </button>
      </div>
      {open ? (
        <textarea
          data-testid="note-text"
          aria-label="ملاحظتي على هذه الكلمة"
          defaultValue={note?.text ?? ''}
          key={id}
          onChange={(event) => typed(event.target.value)}
          onBlur={(event) => { if (event.target.value !== (latest.current?.text ?? '')) void save({ text: event.target.value }) }}
          rows={3}
          className="mt-2 w-full rounded border border-[var(--mushaf-rule)] p-2 text-xs"
        />
      ) : null}
      {saveFailed ? <p data-testid="save-failed" className="mt-1 text-[11px] font-bold text-[var(--qx-err)]">تعذّر الحفظ على هذا الجهاز.</p> : null}
      {!store.available ? <p data-testid="not-saved" className="mt-1 text-[11px] font-bold text-[var(--qx-err)]">غير محفوظ على هذا الجهاز: يبقى حتى تغلق الصفحة.</p> : null}
    </div>
  )
}
