'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/cn'

interface Part { id?: string; type: string; text: string }
interface Verse { id?: string; surah: string; ayah: number; label: string | null; parts: Part[] }

interface Props {
  verses: Verse[]
  onApply: (verses: Verse[]) => void
  onClose: () => void
}

const TYPES: { key: string; label: string }[] = [
  { key: 'shared',   label: 'مشترك'   },
  { key: 'diff',     label: 'اختلاف'  },
  { key: 'diff2',    label: 'اختلاف ٢' },
  { key: 'diff3',    label: 'اختلاف ٣' },
  { key: 'addition', label: 'زيادة'   },
  { key: 'unique',   label: 'فريد'    },
  { key: 'normal',   label: 'عادي'    },
]

// Expand parts → words[] with per-word type assignment.
// Words are whitespace-separated, type carries from each part.
function expand(parts: Part[]): { word: string; type: string }[] {
  const out: { word: string; type: string }[] = []
  for (const p of parts || []) {
    const t = p.type || 'normal'
    for (const w of (p.text || '').split(/\s+/).filter(Boolean)) out.push({ word: w, type: t })
  }
  return out
}

// Collapse words back into parts (merge consecutive same-type)
function collapse(words: { word: string; type: string }[]): Part[] {
  const parts: Part[] = []
  for (const w of words) {
    const last = parts[parts.length - 1]
    if (last && last.type === w.type) last.text = (last.text + ' ' + w.word).trim()
    else parts.push({ type: w.type, text: w.word })
  }
  return parts
}

export default function WordLinker({ verses, onApply, onClose }: Props) {
  // Local mutable word grid: words[verseIdx][wordIdx] = { word, type }
  const initial = useMemo(() => verses.map((v) => expand(v.parts)), [verses])
  const [words, setWords] = useState(initial)
  const [activeType, setActiveType] = useState<string>('shared')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // 1-7 number keys cycle the active type
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= TYPES.length) setActiveType(TYPES[n - 1].key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function paintWord(vi: number, wi: number) {
    setWords((cur) => cur.map((row, i) =>
      i === vi ? row.map((w, j) => (j === wi ? { ...w, word: w.word, type: activeType } : w)) : row
    ))
  }

  function resetVerse(vi: number) {
    setWords((cur) => cur.map((row, i) => i === vi ? row.map((w) => ({ ...w, type: 'normal' })) : row))
  }

  function applyAll() {
    const updated: Verse[] = verses.map((v, vi) => ({ ...v, parts: collapse(words[vi]) }))
    onApply(updated)
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="wl-title"
         className="fixed inset-0 z-50 flex items-stretch justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
         onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[var(--color-paper)] rounded-none md:rounded-2xl w-full max-w-4xl max-h-[100vh] md:max-h-[92vh] overflow-auto shadow-xl animate-fade-rise">
        <header className="sticky top-0 z-10 bg-[var(--color-paper)] border-b border-[var(--color-border-soft)] px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h2 id="wl-title" className="text-[16px] font-bold text-[var(--color-ink)]">
              ربط الكلمات — تعيين الفروقات يدوياً
            </h2>
            <p className="text-[11px] text-[var(--color-ink-muted)] mt-0.5">
              اختر نوعاً ثم اضغط الكلمات لتلوينها. الأرقام ١–٧ على لوحة المفاتيح تختار النوع.
            </p>
          </div>
          <button onClick={onClose} aria-label="إغلاق"
            className="touch-target-sm rounded-md text-[var(--color-ink-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] tap-shrink transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        {/* Type selector bar */}
        <div className="sticky top-[73px] md:top-[81px] z-10 bg-[var(--color-paper)] border-b border-[var(--color-border-soft)] px-6 py-3 flex flex-wrap items-center gap-2">
          {TYPES.map((t, i) => (
            <button key={t.key} type="button"
              onClick={() => setActiveType(t.key)}
              aria-pressed={activeType === t.key}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-bold rounded-full transition-all duration-150 tap-shrink',
                activeType === t.key
                  ? 'ring-2 ring-offset-2 ring-offset-[var(--color-paper)] scale-105'
                  : 'opacity-70 hover:opacity-100'
              )}
              style={{
                background: `var(--color-${t.key}-bg, var(--color-surface))`,
                color:      `var(--color-${t.key}, var(--color-ink))`,
                boxShadow:  activeType === t.key ? `0 0 0 2px var(--color-${t.key}, var(--color-ink))` : 'none',
              }}>
              <kbd className="text-[9px] font-mono opacity-60">{i + 1}</kbd>
              {t.label}
            </button>
          ))}
        </div>

        {/* Verses with clickable words */}
        <div className="px-6 py-5 space-y-5">
          {verses.map((v, vi) => (
            <div key={vi} className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border-soft)]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-mono text-[var(--color-ink-muted)] tabular-nums">{vi + 1}.</span>
                  <span className="text-[13px] font-bold text-[var(--color-primary)]">{v.surah}</span>
                  <span className="text-[11px] font-mono text-[var(--color-ink-muted)]">آية {v.ayah}</span>
                  {v.label && <span className="text-[11px] text-[var(--color-ink-muted)]">— {v.label}</span>}
                </div>
                <button onClick={() => resetVerse(vi)} type="button"
                  className="text-[11px] text-[var(--color-ink-muted)] hover:text-[var(--color-danger)] tap-shrink transition-colors">
                  إعادة تعيين
                </button>
              </div>
              <div dir="rtl" className="font-quran text-[22px] leading-[2.5] flex flex-wrap gap-1.5">
                {words[vi]?.map((w, wi) => (
                  <button key={wi} type="button"
                    onClick={() => paintWord(vi, wi)}
                    className={`part-${w.type} rounded-md px-1.5 py-0.5 hover:scale-105 active:scale-95 transition-transform cursor-pointer`}>
                    {w.word}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <footer className="sticky bottom-0 bg-[var(--color-paper)] border-t border-[var(--color-border-soft)] px-6 py-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-[var(--color-ink-muted)]">
            <kbd className="font-mono px-1 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border-soft)]">ESC</kbd> للإلغاء
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-[13px] font-bold text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] tap-shrink transition-colors">
              إلغاء
            </button>
            <button onClick={applyAll}
              className="px-5 py-2 text-[13px] font-bold rounded-full bg-[var(--color-primary)] text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)] tap-shrink transition-colors shadow-sm">
              تطبيق التغييرات
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
