'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import ArabicDiff from './ArabicDiff'
import AutoColorPicker from './AutoColorPicker'
import WordLinker from './WordLinker'
import RichEditor from './RichEditor'
import QuranSearch from './QuranSearch'
import TagEditor from './TagEditor'
import type { AutoColoredPart } from '@/lib/diff'
import { stripTashkeel } from '@/lib/arabic'

interface Part { id?: string; type: string; text: string }
interface Verse { id?: string; surah: string; ayah: number; label: string | null; parts: Part[] }
interface Group {
  id: string; title: string; color?: string | null
  status: 'draft'|'published'|'locked'
  favorite: boolean; completed: boolean
  note?: string | null; unote?: string | null
  verses: Verse[]
}

const COLOR_SWATCHES = [
  '#55b94f', '#4b63e6', '#c9a84c', '#7c3aed', '#15803d',
  '#2563eb', '#d92323', '#0f766e', '#9a5d00', '#1A4A6E',
]

const PART_TYPES: { value: string; label: string }[] = [
  { value: 'shared',   label: 'مشترك'   },
  { value: 'diff',     label: 'اختلاف'  },
  { value: 'diff2',    label: 'اختلاف ٢' },
  { value: 'diff3',    label: 'اختلاف ٣' },
  { value: 'addition', label: 'زيادة'   },
  { value: 'unique',   label: 'فريد'    },
  { value: 'normal',   label: 'عادي'    },
]

export default function EditForm({ initialGroup }: { initialGroup: Group }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [group, setGroup] = useState<Group>(initialGroup)
  const [openVerse, setOpenVerse] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showAutoColor, setShowAutoColor] = useState(false)
  const [showWordLinker, setShowWordLinker] = useState(false)
  const [note, setNote] = useState<string>(initialGroup.note ?? '')
  const [unote, setUnote] = useState<string>(initialGroup.unote ?? '')
  const confirmDeleteBtnRef = useRef<HTMLButtonElement>(null)

  // ESC closes delete-confirmation. Cmd/Ctrl+S saves.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && confirmDelete) {
        e.preventDefault(); setConfirmDelete(false)
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault(); void handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmDelete, group, note, unote])

  // Focus confirm button when delete prompt opens
  useEffect(() => {
    if (confirmDelete) confirmDeleteBtnRef.current?.focus()
  }, [confirmDelete])

  function updateGroup<K extends keyof Group>(key: K, value: Group[K]) {
    setGroup((g) => ({ ...g, [key]: value }))
  }

  function updateVerse(vi: number, patch: Partial<Verse>) {
    setGroup((g) => ({ ...g, verses: g.verses.map((v, i) => (i === vi ? { ...v, ...patch } : v)) }))
  }

  function updatePart(vi: number, pi: number, patch: Partial<Part>) {
    setGroup((g) => ({
      ...g,
      verses: g.verses.map((v, i) =>
        i === vi ? { ...v, parts: v.parts.map((p, j) => (j === pi ? { ...p, ...patch } : p)) } : v
      ),
    }))
  }

  function addPart(vi: number) {
    setGroup((g) => ({
      ...g,
      verses: g.verses.map((v, i) =>
        i === vi ? { ...v, parts: [...v.parts, { type: 'normal', text: '' }] } : v
      ),
    }))
  }

  function removePart(vi: number, pi: number) {
    setGroup((g) => ({
      ...g,
      verses: g.verses.map((v, i) =>
        i === vi ? { ...v, parts: v.parts.filter((_, j) => j !== pi) } : v
      ),
    }))
  }

  function movePart(vi: number, pi: number, dir: -1 | 1) {
    setGroup((g) => {
      const verse = g.verses[vi]
      const newIdx = pi + dir
      if (newIdx < 0 || newIdx >= verse.parts.length) return g
      const parts = [...verse.parts]
      ;[parts[pi], parts[newIdx]] = [parts[newIdx], parts[pi]]
      return { ...g, verses: g.verses.map((v, i) => (i === vi ? { ...v, parts } : v)) }
    })
  }

  function addVerse() {
    setGroup((g) => ({
      ...g,
      verses: [...g.verses, { surah: '', ayah: 1, label: '', parts: [{ type: 'normal', text: '' }] }],
    }))
    setOpenVerse(group.verses.length)
  }

  function addVersesFromQuran(newVerses: Verse[]) {
    setGroup((g) => ({ ...g, verses: [...g.verses, ...newVerses] }))
  }

  function removeVerse(vi: number) {
    setGroup((g) => ({ ...g, verses: g.verses.filter((_, i) => i !== vi) }))
  }

  function moveVerse(vi: number, dir: -1 | 1) {
    setGroup((g) => {
      const newIdx = vi + dir
      if (newIdx < 0 || newIdx >= g.verses.length) return g
      const verses = [...g.verses]
      ;[verses[vi], verses[newIdx]] = [verses[newIdx], verses[vi]]
      return { ...g, verses }
    })
  }

  function applyAutoColor(aIdx: number, bIdx: number, partsA: AutoColoredPart[], partsB: AutoColoredPart[]) {
    setGroup((g) => ({
      ...g,
      verses: g.verses.map((v, i) => {
        if (i === aIdx) return { ...v, parts: partsA }
        if (i === bIdx) return { ...v, parts: partsB }
        return v
      }),
    }))
    setShowAutoColor(false)
  }

  function verseTextOf(idx: number): string {
    const v = group.verses[idx]
    if (!v) return ''
    return (v.parts || []).map((p) => p.text).join(' ').replace(/\s+/g, ' ').trim()
  }

  function applyWordLinkerResult(newVerses: Verse[]) {
    setGroup((g) => ({ ...g, verses: newVerses }))
    setShowWordLinker(false)
  }

  async function handleSave() {
    setSaveError(null); setSaveSuccess(false)
    startTransition(async () => {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:     group.title,
          color:     group.color,
          status:    group.status,
          favorite:  group.favorite,
          completed: group.completed,
          note,
          unote,
          verses:    group.verses,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setSaveError(j.error || 'فشل الحفظ')
        return
      }
      setSaveSuccess(true)
      // Brief moment of success feedback, then return to group detail
      setTimeout(() => { router.push(`/groups/${group.id}`); router.refresh() }, 650)
    })
  }

  async function handleDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/groups/${group.id}`, { method: 'DELETE' })
      if (!res.ok) { setSaveError('فشل الحذف'); return }
      router.push('/')
      router.refresh()
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-6 md:py-10">
      {/* Toolbar — sticky with accent presence */}
      <div className="sticky top-0 -mx-5 md:-mx-8 px-5 md:px-8 py-3 mb-8 bg-[var(--color-paper)]/95 backdrop-blur-sm border-b border-[var(--color-border)] z-10">
        <div className="flex items-center justify-between gap-4">
          <Link href={`/groups/${group.id}`}
            className="inline-flex items-center gap-1 text-[13px] font-bold text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] tap-shrink transition-colors">
            <span aria-hidden="true">←</span> العودة
          </Link>
          <div className="flex items-center gap-3" aria-live="polite">
            {saveError && (
              <span role="alert" className="text-[12px] px-2.5 py-1 rounded-md font-bold animate-fade-rise"
                    style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>
                {saveError}
              </span>
            )}
            <button onClick={handleSave} disabled={isPending || saveSuccess}
              aria-label={saveSuccess ? 'تم الحفظ' : 'حفظ التعديلات'}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2 text-[13px] font-bold rounded-full tap-shrink transition-all duration-200 shadow-sm',
                saveSuccess
                  ? 'bg-[var(--color-success)] text-[var(--color-paper)]'
                  : 'bg-[var(--color-primary)] text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60'
              )}>
              {saveSuccess ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path className="animate-check-draw" d="M20 6 9 17l-5-5" />
                  </svg>
                  تم الحفظ
                </>
              ) : isPending ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}
            </button>
          </div>
        </div>
      </div>

      {/* Title field — large, hierarchical */}
      <section className="mb-10">
        <label className="block text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-2">
          العنوان
        </label>
        <input
          value={group.title}
          onChange={(e) => updateGroup('title', stripTashkeel(e.target.value))}
          className="w-full bg-transparent text-[24px] md:text-[28px] font-bold text-[var(--color-ink)] border-b border-[var(--color-border)] pb-2 focus:border-[var(--color-primary)] focus:outline-none transition-colors" />
      </section>

      {/* Color picker */}
      <section className="mb-8">
        <label className="block text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-2">
          اللون المميّز
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {COLOR_SWATCHES.map((c) => {
            const active = group.color === c
            return (
              <button key={c} type="button" onClick={() => updateGroup('color', c)}
                aria-label={`اختر اللون ${c}`}
                aria-pressed={active}
                className="touch-target-sm rounded-full border-2 tap-shrink transition-all"
                style={{
                  background: c,
                  borderColor: active ? 'var(--color-ink)' : 'transparent',
                  transform: active ? 'scale(1.15)' : 'scale(1)',
                }} />
            )
          })}
          <span className="w-px h-7 bg-[var(--color-border)] mx-1" aria-hidden="true" />
          <label className="inline-flex items-center gap-2 text-[12px] text-[var(--color-ink-soft)] cursor-pointer">
            <input type="color" value={group.color || '#55b94f'}
              onChange={(e) => updateGroup('color', e.target.value)}
              className="w-9 h-9 rounded-md cursor-pointer border-0 p-0"
              aria-label="اختيار لون مخصّص" />
            مخصّص
          </label>
        </div>
      </section>

      {/* Status toggles */}
      <section className="mb-10 flex items-center gap-6 text-[13px]">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={group.favorite}
                 onChange={(e) => updateGroup('favorite', e.target.checked)}
                 className="w-4 h-4 accent-[var(--color-warn)]" />
          <span className="text-[var(--color-ink-soft)]">مفضّلة</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={group.completed}
                 onChange={(e) => updateGroup('completed', e.target.checked)}
                 className="w-4 h-4 accent-[var(--color-success)]" />
          <span className="text-[var(--color-ink-soft)]">مكتملة</span>
        </label>
        <select value={group.status} onChange={(e) => updateGroup('status', e.target.value as Group['status'])}
                className="text-[12px] bg-transparent text-[var(--color-ink-soft)] border-b border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)] py-0.5 pr-4">
          <option value="draft">مسودة</option>
          <option value="published">منشورة</option>
          <option value="locked">مقفلة</option>
        </select>
      </section>

      {/* Verses */}
      <section>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <h2 className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase font-bold">
            الآيات ({group.verses.length})
          </h2>
          <div className="flex items-center gap-2">
            {group.verses.length >= 2 && (
              <>
                <button onClick={() => setShowAutoColor(true)} type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-full bg-[var(--color-shared-bg)] text-[var(--color-shared)] hover:opacity-80 tap-shrink transition-opacity">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 2v6l-3 3v9a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-9l-3-3V2"/>
                  </svg>
                  تلوين تلقائي
                </button>
                <button onClick={() => setShowWordLinker(true)} type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-full bg-[var(--color-diff2-bg)] text-[var(--color-diff2)] hover:opacity-80 tap-shrink transition-opacity">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m12 19 7-7-7-7m-9 7h16"/>
                  </svg>
                  ربط الكلمات
                </button>
              </>
            )}
            <QuranSearch onAdd={addVersesFromQuran} />
            <button onClick={addVerse} type="button"
              className="px-3 py-1.5 text-[12px] font-bold rounded-full bg-[var(--color-primary)] text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)] tap-shrink transition-colors shadow-sm">
              + إضافة آية
            </button>
          </div>
        </div>

        <ol className="divide-y divide-[var(--color-border-soft)]">
          {group.verses.map((v, vi) => (
            <li key={v.id ?? vi} className="py-5">
              {/* Verse summary row — clickable to open */}
              <div className="flex items-start gap-4">
                <button onClick={() => setOpenVerse(openVerse === vi ? null : vi)}
                  className="shrink-0 text-left w-20 cursor-pointer">
                  <div className="text-[12px] font-bold text-[var(--color-primary)]">{v.surah || '—'}</div>
                  <div className="text-[11px] font-mono text-[var(--color-ink-muted)]">{v.ayah}</div>
                  {v.label && (
                    <div className="text-[10px] text-[var(--color-ink-muted)] mt-0.5 leading-tight">
                      {v.label}
                    </div>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <button onClick={() => setOpenVerse(openVerse === vi ? null : vi)}
                          className="block w-full text-right cursor-pointer">
                    <ArabicDiff parts={v.parts} size="md" />
                  </button>
                </div>
                <div className="shrink-0 flex flex-col gap-1">
                  <button onClick={() => moveVerse(vi, -1)} disabled={vi === 0}
                    className="px-2 py-0.5 text-[11px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] disabled:opacity-30">↑</button>
                  <button onClick={() => moveVerse(vi, 1)} disabled={vi === group.verses.length - 1}
                    className="px-2 py-0.5 text-[11px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] disabled:opacity-30">↓</button>
                  <button onClick={() => removeVerse(vi)}
                    className="px-2 py-0.5 text-[11px] text-[var(--color-ink-muted)] hover:text-[var(--color-danger)] transition-colors">✕</button>
                </div>
              </div>

              {/* Expanded editor */}
              {openVerse === vi && (
                <div className="mt-5 pl-24 space-y-4">
                  {/* Surah + ayah + label */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-[var(--color-ink-muted)] uppercase tracking-wider mb-1">
                        السورة
                      </label>
                      <input value={v.surah} onChange={(e) => updateVerse(vi, { surah: e.target.value })}
                        className="w-full px-3 py-1.5 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md focus:border-[var(--color-primary)] focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--color-ink-muted)] uppercase tracking-wider mb-1">
                        رقم الآية
                      </label>
                      <input type="number" min="1" value={v.ayah} onChange={(e) => updateVerse(vi, { ayah: parseInt(e.target.value, 10) || 1 })}
                        className="w-full px-3 py-1.5 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md focus:border-[var(--color-primary)] focus:outline-none tabular-nums transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--color-ink-muted)] uppercase tracking-wider mb-1">
                        ملاحظة
                      </label>
                      <input value={v.label || ''} onChange={(e) => updateVerse(vi, { label: e.target.value })}
                        className="w-full px-3 py-1.5 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md focus:border-[var(--color-primary)] focus:outline-none transition-colors" />
                    </div>
                  </div>

                  {/* Parts editor */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-[var(--color-ink-muted)] uppercase tracking-wider">
                        أجزاء النص
                      </span>
                      <button onClick={() => addPart(vi)}
                        className="text-[11px] font-bold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
                        + جزء
                      </button>
                    </div>
                    <ul className="space-y-1.5">
                      {v.parts.map((p, pi) => (
                        <li key={pi} className="flex items-stretch gap-2">
                          <select value={p.type}
                            onChange={(e) => updatePart(vi, pi, { type: e.target.value })}
                            className="w-24 px-2 text-[11px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md focus:border-[var(--color-primary)] focus:outline-none">
                            {PART_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <textarea value={p.text}
                            onChange={(e) => updatePart(vi, pi, { text: e.target.value })}
                            rows={1}
                            className="flex-1 px-3 py-1.5 text-[16px] font-quran bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md focus:border-[var(--color-primary)] focus:outline-none resize-none transition-colors"
                            dir="rtl" />
                          <div className="grid grid-cols-2 gap-0.5">
                            <button onClick={() => movePart(vi, pi, -1)} disabled={pi === 0}
                              className="px-2 text-[10px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] disabled:opacity-30">↑</button>
                            <button onClick={() => movePart(vi, pi, 1)} disabled={pi === v.parts.length - 1}
                              className="px-2 text-[10px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] disabled:opacity-30">↓</button>
                            <button onClick={() => removePart(vi, pi)}
                              className="col-span-2 px-2 text-[10px] text-[var(--color-ink-muted)] hover:text-[var(--color-danger)] transition-colors">✕</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* Tags */}
      <section className="mt-12">
        <label className="block text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-3 font-bold">
          الوسوم
        </label>
        <TagEditor groupId={group.id} />
      </section>

      {/* Notes (note + unote) — rich text */}
      <section className="mt-12 space-y-8">
        <div>
          <label className="block text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-3 font-bold">
            ملاحظة
          </label>
          <RichEditor value={note} onChange={setNote} placeholder="ملاحظة عامة تظهر أسفل المجموعة…" />
        </div>
        <div>
          <label className="block text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-3 font-bold">
            <span className="inline-block w-2.5 h-2.5 rounded-sm align-middle ml-1.5"
                  style={{ background: 'var(--color-diff2)' }} aria-hidden="true" />
            فائدة فريدة / إضافية
          </label>
          <RichEditor value={unote} onChange={setUnote} placeholder="فائدة مميّزة تُعرض بإطار بنفسجي…" />
        </div>
      </section>

      {/* Auto-color picker modal */}
      {showAutoColor && (
        <AutoColorPicker
          verses={group.verses.map((v) => ({ surah: v.surah, ayah: v.ayah, label: v.label }))}
          verseTextProvider={verseTextOf}
          onApply={applyAutoColor}
          onClose={() => setShowAutoColor(false)} />
      )}

      {/* Word linker modal */}
      {showWordLinker && (
        <WordLinker
          verses={group.verses}
          onApply={applyWordLinkerResult}
          onClose={() => setShowWordLinker(false)} />
      )}

      {/* Danger zone */}
      <section className="mt-16 pt-8 border-t border-[var(--color-border-soft)]">
        <div className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-3">
          منطقة الحذف
        </div>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="text-[13px] text-[var(--color-danger)] hover:underline underline-offset-4 tap-shrink transition-colors">
            حذف هذه المجموعة نهائياً
          </button>
        ) : (
          <div role="alertdialog" aria-labelledby="del-label"
               className="flex items-center gap-3 animate-fade-rise">
            <span id="del-label" className="text-[13px] text-[var(--color-ink-soft)]">
              تأكيد الحذف؟ <kbd className="text-[10px] font-mono text-[var(--color-ink-muted)]">ESC للإلغاء</kbd>
            </span>
            <button ref={confirmDeleteBtnRef} onClick={handleDelete} disabled={isPending}
              className={cn(
                'px-4 py-1.5 text-[12px] font-bold rounded-full tap-shrink transition-colors',
                'bg-[var(--color-danger)] text-[var(--color-paper)] hover:opacity-90 disabled:opacity-50 shadow-sm'
              )}>
              نعم، احذف
            </button>
            <button onClick={() => setConfirmDelete(false)}
              className="text-[12px] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] tap-shrink transition-colors">
              إلغاء
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
