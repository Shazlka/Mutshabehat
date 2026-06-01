'use client'

import { useEffect, useState } from 'react'
import { autoColorPair, type AutoColoredPart } from '@/lib/diff'

interface VerseRef { surah: string; ayah: number; label: string | null }

interface Props {
  verses: VerseRef[]
  /**
   * verseTextProvider(index) returns the joined text of the verse at that index.
   * Used when the user has already started editing parts.
   */
  verseTextProvider: (verseIndex: number) => string
  onApply: (a: number, b: number, partsA: AutoColoredPart[], partsB: AutoColoredPart[]) => void
  onClose: () => void
}

export default function AutoColorPicker({ verses, verseTextProvider, onApply, onClose }: Props) {
  const [a, setA] = useState(0)
  const [b, setB] = useState(verses.length > 1 ? 1 : 0)
  const [preview, setPreview] = useState<{ partsA: AutoColoredPart[]; partsB: AutoColoredPart[] } | null>(null)

  useEffect(() => {
    if (a === b || verses.length < 2) { setPreview(null); return }
    const textA = verseTextProvider(a)
    const textB = verseTextProvider(b)
    if (!textA.trim() || !textB.trim()) { setPreview(null); return }
    setPreview(autoColorPair(textA, textB))
  }, [a, b, verses, verseTextProvider])

  // ESC closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="auto-color-title"
         className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
         onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[var(--color-paper)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto shadow-xl animate-scale-pop">
        <header className="sticky top-0 bg-[var(--color-paper)] border-b border-[var(--color-border-soft)] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 id="auto-color-title" className="text-[16px] font-bold text-[var(--color-ink)]">
              التلوين التلقائي للفروقات
            </h2>
            <p className="text-[11px] text-[var(--color-ink-muted)] mt-0.5">
              يقارن آيتين كلمةً كلمة ويعيّن الأنواع تلقائياً
            </p>
          </div>
          <button onClick={onClose} aria-label="إغلاق"
            className="touch-target-sm rounded-md text-[var(--color-ink-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] tap-shrink transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <div className="p-6 space-y-5">
          {/* Verse pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-[var(--color-ink-muted)] uppercase tracking-wider mb-1 font-bold">
                الآية الأولى (المرجع)
              </label>
              <select value={a} onChange={(e) => setA(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md focus:border-[var(--color-primary)] focus:outline-none transition-colors">
                {verses.map((v, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {v.surah} — آية {v.ayah}{v.label ? ` (${v.label})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[var(--color-ink-muted)] uppercase tracking-wider mb-1 font-bold">
                الآية الثانية (المقارنة)
              </label>
              <select value={b} onChange={(e) => setB(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md focus:border-[var(--color-primary)] focus:outline-none transition-colors">
                {verses.map((v, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {v.surah} — آية {v.ayah}{v.label ? ` (${v.label})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {a === b && (
            <p className="text-[12px] px-3 py-2 rounded-md font-bold"
               style={{ color: 'var(--color-warn)', background: 'var(--color-warn-bg)' }}>
              اختر آيتين مختلفتين للمقارنة
            </p>
          )}

          {/* Preview */}
          {preview && (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] text-[var(--color-ink-muted)] uppercase tracking-wider mb-2 font-bold">
                  معاينة الآية {a + 1}
                </div>
                <p className="font-quran text-[20px] leading-[2.3] p-3 bg-[var(--color-surface)] rounded-lg" dir="rtl">
                  {preview.partsA.map((p, i) => (
                    <span key={i} className={`part-${p.type}`}>{p.text} </span>
                  ))}
                </p>
              </div>
              <div>
                <div className="text-[10px] text-[var(--color-ink-muted)] uppercase tracking-wider mb-2 font-bold">
                  معاينة الآية {b + 1}
                </div>
                <p className="font-quran text-[20px] leading-[2.3] p-3 bg-[var(--color-surface)] rounded-lg" dir="rtl">
                  {preview.partsB.map((p, i) => (
                    <span key={i} className={`part-${p.type}`}>{p.text} </span>
                  ))}
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 bg-[var(--color-paper)] border-t border-[var(--color-border-soft)] px-6 py-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-[var(--color-ink-muted)] flex-1">
            سيتم استبدال الأجزاء الحالية للآيتين بنتيجة المقارنة
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onClose}
              className="px-4 py-2 text-[13px] font-bold text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] tap-shrink transition-colors">
              إلغاء
            </button>
            <button onClick={() => preview && a !== b && onApply(a, b, preview.partsA, preview.partsB)}
              disabled={!preview || a === b}
              className="px-5 py-2 text-[13px] font-bold rounded-full bg-[var(--color-primary)] text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 tap-shrink transition-colors shadow-sm">
              تطبيق التلوين
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
