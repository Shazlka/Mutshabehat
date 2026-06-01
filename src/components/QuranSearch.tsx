'use client'

import { useEffect, useRef, useState } from 'react'

interface Hit { surah: number; ayah: number; text: string }
interface SurahNames { [n: string]: string }

interface Props {
  onAdd: (verses: { surah: string; ayah: number; label: string | null; parts: { type: string; text: string }[] }[]) => void
}

export default function QuranSearch({ onAdd }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Hit[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set()) // key = "surah:ayah"
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [surahs, setSurahs] = useState<SurahNames>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<number | null>(null)

  // Load surah names once
  useEffect(() => {
    fetch('/api/quran?names=1')
      .then((r) => r.json())
      .then((j) => setSurahs(j.surahs || {}))
      .catch(() => {})
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); return }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/quran?search=${encodeURIComponent(query.trim())}`)
        const j = await res.json()
        setResults(j.results || [])
      } finally { setLoading(false) }
    }, 250)
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current) }
  }, [query])

  function toggle(key: string) {
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  function addSelected() {
    const verses = results
      .filter((r) => picked.has(`${r.surah}:${r.ayah}`))
      .map((r) => ({
        surah: surahs[String(r.surah)] || String(r.surah),
        ayah:  r.ayah,
        label: null,
        parts: [{ type: 'normal', text: r.text }],
      }))
    if (verses.length) onAdd(verses)
    setPicked(new Set())
    setOpen(false)
    setQuery('')
    setResults([])
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-full bg-[var(--color-addition-bg)] text-[var(--color-addition)] hover:opacity-80 tap-shrink transition-opacity">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
        </svg>
        إضافة من القرآن
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="qsearch-title"
             className="fixed inset-0 z-50 flex items-start justify-center p-0 md:p-4 md:pt-16 bg-black/40 backdrop-blur-sm animate-fade-in"
             onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="bg-[var(--color-paper)] rounded-none md:rounded-2xl w-full max-w-2xl max-h-[100vh] md:max-h-[85vh] overflow-hidden shadow-xl animate-fade-rise flex flex-col">
            <header className="px-5 py-4 border-b border-[var(--color-border-soft)]">
              <div className="flex items-center justify-between mb-3">
                <h3 id="qsearch-title" className="text-[15px] font-bold text-[var(--color-ink)]">
                  إضافة آيات من القرآن
                </h3>
                <button onClick={() => setOpen(false)} aria-label="إغلاق"
                  className="touch-target-sm rounded-md text-[var(--color-ink-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] tap-shrink transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث في القرآن بدون تشكيل…"
                className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary-soft)] transition-all"
                dir="rtl" />
              {loading && <p className="text-[11px] text-[var(--color-ink-muted)] mt-2">جارٍ البحث…</p>}
              {!loading && query.trim() && results.length === 0 && (
                <p className="text-[11px] text-[var(--color-ink-muted)] mt-2">لا توجد نتائج</p>
              )}
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {results.map((r) => {
                const key = `${r.surah}:${r.ayah}`
                const isPicked = picked.has(key)
                return (
                  <button key={key} type="button" onClick={() => toggle(key)}
                    className={`w-full text-right p-3 rounded-lg border-2 transition-all duration-150 ${
                      isPicked
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                        : 'border-[var(--color-border-soft)] bg-[var(--color-surface)] hover:border-[var(--color-border)]'
                    }`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-[12px] font-bold text-[var(--color-primary)]">
                        {surahs[String(r.surah)] || `سورة ${r.surah}`}
                      </span>
                      <span className="text-[11px] font-mono text-[var(--color-ink-muted)]">آية {r.ayah}</span>
                      {isPicked && (
                        <span className="ml-auto text-[var(--color-primary)]" aria-label="مختار">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        </span>
                      )}
                    </div>
                    <p className="font-quran text-[18px] leading-[2.1] text-[var(--color-ink)]" dir="rtl">
                      {r.text}
                    </p>
                  </button>
                )
              })}
            </div>

            <footer className="px-5 py-3 border-t border-[var(--color-border-soft)] flex items-center justify-between">
              <span className="text-[12px] text-[var(--color-ink-muted)]">
                {picked.size > 0 ? `${picked.size} آية مختارة` : 'اضغط لاختيار آية'}
              </span>
              <button onClick={addSelected} disabled={picked.size === 0}
                className="px-4 py-2 text-[12px] font-bold rounded-full bg-[var(--color-primary)] text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 tap-shrink transition-colors shadow-sm">
                إضافة المختار
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
