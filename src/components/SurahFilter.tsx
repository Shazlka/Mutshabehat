'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/cn'
import { useSurahNames } from '@/lib/surah-names'

interface Props {
  surahCounts: Record<string, number>
}

export default function SurahFilter({ surahCounts }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const active = params.get('surah') ?? ''
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const names = useSurahNames()

  function pick(name: string) {
    const p = new URLSearchParams(params.toString())
    if (name) p.set('surah', name); else p.delete('surah')
    p.delete('page')
    router.push(`/?${p.toString()}`)
    setOpen(false)
  }

  // Build sorted list — surahs with groups first, by count desc
  const allSurahs = Object.entries(names).map(([no, name]) => ({
    no: parseInt(no, 10),
    name,
    count: surahCounts[name] || 0,
  }))
  const withGroups = allSurahs.filter((s) => s.count > 0).sort((a, b) => b.count - a.count)
  const filtered = filter.trim()
    ? allSurahs.filter((s) => s.name.includes(filter.trim()) || String(s.no).includes(filter.trim()))
    : allSurahs

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} type="button"
        className={cn(
          'inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-bold rounded-full tap-shrink transition-colors',
          active
            ? 'bg-[var(--color-primary)] text-[var(--color-paper)] shadow-sm shadow-[var(--color-primary)]/20'
            : 'text-[var(--color-ink-soft)] bg-[var(--color-surface)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]'
        )}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18M7 12h10M11 18h2"/>
        </svg>
        {active || 'كل السور'}
        {active && (
          <span onClick={(e) => { e.stopPropagation(); pick('') }}
                className="cursor-pointer hover:opacity-70" aria-label="مسح"
                role="button" tabIndex={0}>
            ×
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-label="اختر سورة"
               className="absolute top-full mt-2 right-0 z-40 w-80 max-h-[60vh] overflow-y-auto bg-[var(--color-paper)] border border-[var(--color-border)] rounded-xl shadow-xl animate-fade-rise">
            <div className="sticky top-0 bg-[var(--color-paper)] px-3 pt-3 pb-2 border-b border-[var(--color-border-soft)]">
              <input value={filter} onChange={(e) => setFilter(e.target.value)}
                placeholder="ابحث عن سورة…"
                className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md focus:border-[var(--color-primary)] focus:outline-none"
                dir="rtl" />
            </div>

            {!filter.trim() && withGroups.length > 0 && (
              <>
                <div className="px-3 pt-3 pb-1 text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase font-bold">
                  الأكثر استخداماً
                </div>
                <ul className="px-2 pb-2">
                  {withGroups.slice(0, 12).map((s) => (
                    <li key={s.no}>
                      <button onClick={() => pick(s.name)}
                        className={cn(
                          'w-full text-right flex items-center justify-between px-2 py-1.5 rounded-md text-[13px] tap-shrink transition-colors',
                          active === s.name
                            ? 'bg-[var(--color-primary)] text-[var(--color-paper)] font-bold'
                            : 'hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]'
                        )}>
                        <span>{s.name}</span>
                        <span className="text-[11px] font-mono tabular-nums opacity-60">{s.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="px-3 pt-2 pb-1 text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase font-bold border-t border-[var(--color-border-soft)]">
              كل السور
            </div>
            <ul className="px-2 pb-3">
              {filtered.map((s) => (
                <li key={s.no}>
                  <button onClick={() => pick(s.name)}
                    className={cn(
                      'w-full text-right flex items-center justify-between px-2 py-1.5 rounded-md text-[13px] tap-shrink transition-colors',
                      active === s.name
                        ? 'bg-[var(--color-primary)] text-[var(--color-paper)] font-bold'
                        : s.count === 0
                          ? 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)]'
                          : 'hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]'
                    )}>
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] font-mono tabular-nums opacity-50">{s.no}.</span>
                      {s.name}
                    </span>
                    {s.count > 0 && (
                      <span className="text-[11px] font-mono tabular-nums opacity-60">{s.count}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
