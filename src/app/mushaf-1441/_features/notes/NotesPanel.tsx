'use client'

import { useEffect, useRef, useState } from 'react'
import { exportPersonalData, importPersonalData } from '../../../../lib/personal-store'
import { NOTES_STORE, type QiraatWordNote } from '../../../../../packages/qiraat-core/features/notes'
import { FeatureSheet } from '../host/FeatureSheet'
import { usePersonalStore } from './usePersonalStore'

/** «مفضلتي وملاحظاتي»: every favourite and note on this device, with export and import of a JSON backup. */
export function NotesPanel(props: { surahName: (surah: number) => string; onGoToWord: (surah: number, ayah: number, token: number) => void; onClose: () => void }) {
  const store = usePersonalStore()
  const [notes, setNotes] = useState<QiraatWordNote[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const reload = () => { if (store) void store.all<QiraatWordNote>(NOTES_STORE).then((all) => setNotes(all.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah || a.token - b.token))) }
  useEffect(reload, [store]) // eslint-disable-line react-hooks/exhaustive-deps

  async function doExport() {
    if (!store) return
    const blob = new Blob([await exportPersonalData(store)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'qiraat-personal.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }
  async function doImport(file: File) {
    if (!store) return
    try {
      const { imported } = await importPersonalData(store, await file.text())
      setMessage(`تم استيراد ${imported} عنصرًا.`)
      reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذّر الاستيراد.')
    }
  }

  return (
    <FeatureSheet title="مفضلتي وملاحظاتي" onClose={props.onClose} testId="notes-panel">
      {store && !store.available ? <p className="mb-2 text-[11px] font-bold text-[#8a2f10]">التخزين على هذا الجهاز غير متاح: ما تضيفه يبقى حتى تغلق الصفحة.</p> : null}
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" data-testid="notes-export" onClick={() => void doExport()} className="min-h-6 rounded border border-[var(--mushaf-rule)] px-3 text-xs font-bold [@media(pointer:coarse)]:min-h-11">تصدير نسخة احتياطية</button>
        <button type="button" onClick={() => fileInput.current?.click()} className="min-h-6 rounded border border-[var(--mushaf-rule)] px-3 text-xs font-bold [@media(pointer:coarse)]:min-h-11">استيراد نسخة</button>
        <input ref={fileInput} type="file" accept="application/json" hidden data-testid="notes-import" onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = '' }} />
      </div>
      {message ? <p data-testid="notes-message" className="mb-2 text-xs font-bold">{message}</p> : null}
      {notes && notes.length === 0 ? <p className="text-sm text-[var(--mushaf-muted)]">لا مفضلة ولا ملاحظات بعد. افتح كلمة ملوَّنة واضغط ☆ أو أضف ملاحظة.</p> : null}
      <ul className="space-y-2">
        {(notes ?? []).map((n) => (
          <li key={n.id}>
            <button
              type="button"
              data-testid="note-item"
              onClick={() => { props.onGoToWord(n.surah, n.ayah, n.token); props.onClose() }}
              className="w-full rounded-lg border border-[var(--mushaf-rule-soft)] bg-white p-2 text-start text-xs"
            >
              <span className="flex items-center justify-between gap-2 font-black">
                <span>{n.favourite ? '★ ' : ''}{props.surahName(n.surah)} {n.ayah}:{n.token}</span>
              </span>
              {n.text.trim() ? <span className="mt-0.5 block whitespace-pre-wrap text-[var(--mushaf-muted)]">{n.text}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </FeatureSheet>
  )
}
