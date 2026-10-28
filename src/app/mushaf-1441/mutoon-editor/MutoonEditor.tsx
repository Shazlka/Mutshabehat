'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { candidates, WORK_IDS, type WorkId } from './data'
import type { Intent } from './ops'
import { useMutoonStore } from './useMutoonStore'
import { VerseBrowser } from './VerseBrowser'
import { VerseStage } from './VerseStage'
import { Inspector } from './Inspector'
import { Btn, FOCUS, Icon, IconBtn, Segmented, Skeleton } from './ui'

const LABELS: Record<WorkId, string> = { shatibiyyah: 'الشاطبية', durrah: 'الدرة', tayyibah: 'الطيبة' }
const SUBTITLES: Record<WorkId, string> = {
  shatibiyyah: 'حرز الأماني للإمام الشاطبي، في القراءات السبع.',
  durrah: 'الدرة المضية للإمام ابن الجزري، في القراءات الثلاث المتممة للعشر.',
  tayyibah: 'طيبة النشر للإمام ابن الجزري، في القراءات العشر.',
}
const POSITION_KEY = 'mutoon-editor:position:v2'

function loadPosition(): { work: WorkId; verse: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null')
    if (raw && WORK_IDS.includes(raw.work) && Number.isInteger(raw.verse) && raw.verse > 0) return raw
  } catch { /* private mode */ }
  return { work: 'shatibiyyah', verse: 1 }
}

export default function MutoonEditor() {
  const store = useMutoonStore()
  const { works, loading, loadError, status, notices, online, loadWork, loadVerse, dispatch, undo, redo, retry, canUndo, canRedo, notify, dismissNotice } = store

  const [work, setWork] = useState<WorkId>('shatibiyyah')
  const [verseNo, setVerseNo] = useState(1)
  const [ready, setReady] = useState(false)
  const [selected, setSelected] = useState<{ line: number; index: number } | null>(null)
  const [tab, setTab] = useState<'verses' | 'editor'>('verses')
  const inspectorRef = useRef<HTMLElement | null>(null)

  // Restore the per-device position once, after hydration (localStorage does not exist on the server).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const p = loadPosition(); setWork(p.work); setVerseNo(p.verse); setReady(true) }, [])
  useEffect(() => { if (ready) void loadWork(work) }, [ready, work, loadWork])
  useEffect(() => { if (ready) void loadVerse(work, verseNo) }, [ready, work, verseNo, loadVerse])
  useEffect(() => { if (ready) try { localStorage.setItem(POSITION_KEY, JSON.stringify({ work, verse: verseNo })) } catch { /* ignore */ } }, [ready, work, verseNo])

  const data = works[work]
  const flat = useMemo(() => data?.chapters.flatMap(c => c.verses.map(v => ({ number: v.number, chapter: c.title }))) ?? [], [data])
  const position = flat.findIndex(v => v.number === verseNo) + 1
  const state = store.verse(work, verseNo)

  // warm the neighbours so stepping through verses is instant
  useEffect(() => {
    if (position < 1) return
    for (const n of [flat[position]?.number, flat[position - 2]?.number]) if (n) void loadVerse(work, n)
  }, [position, flat, work, loadVerse])

  const goTo = useCallback((n: number) => {
    if (!flat.some(v => v.number === n)) { notify(`لا بيت برقم ${n} في هذا المتن`, 'warn'); return }
    setVerseNo(n); setSelected(null); setTab('editor')
  }, [flat, notify])
  const step = useCallback((delta: number) => {
    const next = flat[position - 1 + delta]
    if (next) { setVerseNo(next.number); setSelected(null) }
  }, [flat, position])

  // the selected word, resolved against the verse as it is displayed now
  const word = useMemo(() => {
    if (!state || !selected) return null
    const w = candidates(state.verse.lines[selected.line] ?? '')[selected.index]
    return w ? { line: selected.line, word: w.text, occurrence: w.occurrence, index: selected.index, text: w.text } : null
  }, [state, selected])

  const moveWord = useCallback((delta: number) => {
    if (!state) return
    const all = state.verse.lines.flatMap((l, line) => candidates(l).map((_, index) => ({ line, index })))
    const at = selected ? all.findIndex(w => w.line === selected.line && w.index === selected.index) : -1
    const next = all[Math.min(all.length - 1, Math.max(0, at + delta))]
    if (next) setSelected(next)
  }, [state, selected])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if (e.altKey || e.metaKey || e.ctrlKey) return
      if (e.key === 'PageDown') { e.preventDefault(); step(1) }
      else if (e.key === 'PageUp') { e.preventDefault(); step(-1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); moveWord(1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); moveWord(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, moveWord, undo, redo])

  const onIntent = useCallback((intent: Intent) => dispatch(work, verseNo, intent), [dispatch, work, verseNo])
  const chapter = flat[position - 1]?.chapter ?? ''

  const savedAt = status.lastSavedAt ? new Date(status.lastSavedAt).toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-[var(--color-paper)] text-[var(--color-ink)]" dir="rtl">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 md:px-4">
        <Link href="/mushaf-1441/review" className={`inline-flex items-center gap-1 rounded-lg px-2 text-xs font-bold text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] ${FOCUS} min-h-9`}>
          <Icon name="right" size={14} />مراجعة القراءات
        </Link>
        <h1 className="text-sm font-bold">محرر المتون</h1>
        <Segmented label="المتن" value={work} onChange={w => { setWork(w); setSelected(null); const p = loadPosition(); setVerseNo(p.work === w ? p.verse : 1) }}
          options={WORK_IDS.map(w => ({ value: w, label: LABELS[w] }))} />

        <div className="ms-auto flex items-center gap-1.5">
          <SaveBadge phase={status.phase} pending={status.pending} message={status.message} savedAt={savedAt} online={online} onRetry={retry} />
          <IconBtn icon="undo" label="تراجع (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
          <IconBtn icon="redo" label="إعادة (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo} />
          <a href="/api/mushaf-1441/mutoon" target="_blank" rel="noreferrer" title="النسخة التي يقرؤها التطبيق" className={`hidden min-h-9 items-center gap-1 rounded-lg border border-[var(--color-border)] px-2.5 text-xs font-bold text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)] md:inline-flex ${FOCUS}`}>
            <Icon name="download" size={14} />ما يراه التطبيق
          </a>
        </div>
      </header>

      {loadError && !data && (
        <div className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-danger-bg)] p-4 text-sm" role="alert">
          <span className="flex items-center gap-2"><Icon name="alert" className="text-[var(--color-danger)]" />{loadError}</span>
          <Btn icon="refresh" onClick={() => void loadWork(work, true)}>إعادة المحاولة</Btn>
        </div>
      )}

      {/* desktop: three columns. phone: the verse list, or the editor (verse + panel stacked). */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_400px]">
        <aside className={`min-h-0 border-e border-[var(--color-border)] ${tab === 'verses' ? 'block' : 'hidden'} lg:block`}>
          <VerseBrowser data={data} loading={!!loading[work]} selected={verseNo} subtitle={SUBTITLES[work]} onSelect={goTo} />
        </aside>

        <div className={`min-h-0 overflow-y-auto lg:contents ${tab === 'editor' ? 'block' : 'hidden'} lg:!contents`}>
          <main className="min-h-0 p-3 pb-24 md:p-6 lg:overflow-y-auto lg:pb-6">
            {state && position > 0
              ? <VerseStage key={`${work}:${verseNo}`} state={state} chapter={chapter} position={position} total={flat.length} selected={selected}
                  onSelect={(line, index) => {
                    setSelected({ line, index })
                    // On a phone the panel sits below the verse: bring it up so a tap leads straight to assigning.
                    if (window.matchMedia('(max-width: 1023px)').matches) {
                      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
                      requestAnimationFrame(() => inspectorRef.current?.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' }))
                    }
                  }} onPrev={() => step(-1)} onNext={() => step(1)} onJump={goTo}
                  onEditLines={(lines, dropOrphans) => { const r = onIntent({ k: 'lines', lines, dropOrphans }); if (r.ok) setSelected(null); return r }}
                  onUnassign={ref => onIntent({ k: 'unassign', ref })} onUnmark={ref => onIntent({ k: 'unmark', ref })}
                  onCopied={() => notify('نُسخ نص البيت')}
                  onSaveSharh={(text, title, author) => onIntent({ k: 'sharh', text, title, author })} onRemoveSharh={() => onIntent({ k: 'sharh', text: '' })} />
              : <div className="mx-auto max-w-4xl space-y-4" aria-busy="true"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64" /><Skeleton className="h-24" /></div>}
          </main>
          <aside ref={inspectorRef} aria-label="تعيين القراء والرواة" className="min-h-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-20 lg:overflow-y-auto lg:border-s lg:border-t-0 lg:pb-0">
            {state
              ? <Inspector state={state} work={work} word={word} onIntent={onIntent} onError={m => notify(m, 'warn')} />
              : <div className="space-y-3 p-4"><Skeleton className="h-14" /><Skeleton className="h-40" /></div>}
          </aside>
        </div>
      </div>

      {/* phone tabs */}
      <nav aria-label="الأقسام" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)] lg:hidden">
        {([['verses', 'الأبيات', 'list'], ['editor', 'المحرر', 'edit']] as const).map(([id, label, icon]) => (
          <button key={id} type="button" aria-current={tab === id} onClick={() => setTab(id)}
            className={`flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${FOCUS} ${tab === id ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink-soft)]'}`}>
            <Icon name={icon} size={20} />{label}
          </button>
        ))}
      </nav>

      <div className="pointer-events-none fixed inset-x-0 top-14 z-30 flex flex-col items-center gap-2 px-3" role="status" aria-live="polite">
        {notices.map(n => (
          <div key={n.id} className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border px-4 py-2.5 text-xs font-bold shadow-[0_6px_24px_oklch(0.3_0.02_60/0.14)] ${n.tone === 'warn' ? 'border-[var(--color-warn)] bg-[var(--color-warn-bg)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
            {n.text}
            <button type="button" aria-label="إغلاق" className={`cursor-pointer rounded ${FOCUS}`} onClick={() => dismissNotice(n.id)}><Icon name="x" size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function SaveBadge({ phase, pending, message, savedAt, online, onRetry }: { phase: 'idle' | 'saving' | 'error'; pending: number; message: string; savedAt: string | null; online: boolean; onRetry: () => void }) {
  if (phase === 'error' || !online) {
    return (
      <span className="flex items-center gap-2 text-xs font-bold text-[var(--color-danger)]" role="alert">
        <span className="size-2 rounded-full bg-[var(--color-danger)]" aria-hidden="true" />
        {phase === 'error' ? `لم يُحفظ${pending ? ` (${pending})` : ''}: ${message}` : 'غير متصل'}
        {phase === 'error' && <Btn compact tone="danger" icon="refresh" onClick={onRetry}>أعد المحاولة</Btn>}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-ink-soft)]" aria-live="polite">
      <span className={`size-2 rounded-full ${phase === 'saving' ? 'animate-pulse bg-[var(--color-warn)]' : 'bg-[var(--color-success)]'}`} aria-hidden="true" />
      {phase === 'saving' ? 'جارٍ الحفظ…' : savedAt ? `محفوظ ${savedAt}` : 'متصل مباشرة'}
    </span>
  )
}
