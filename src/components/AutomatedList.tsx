'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ArabicDiff, { type Part } from './ArabicDiff'
import { ayahToArabic } from '@/lib/arabic'
import { cn } from '@/lib/cn'

interface PayloadVerse {
  surah?: string; ayah?: number | string; label?: string
  parts?: { type: string; text: string }[]
}
interface Row {
  id: number; title: string; color: string; surahs: string[]
  payload: { verses?: PayloadVerse[] }
}

interface Props {
  rows: Row[]
  page: number
  totalPages: number
  q: string
  surah: string
}

export default function AutomatedList({ rows, page, totalPages, q, surah }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [busy, setBusy]     = useState(false)
  const [done, setDone]     = useState<string | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [value, setValue] = useState(q)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    setValue(q)
  }, [q])

  useEffect(() => {
    fetch('/api/quran?names=1')
      .then((r) => r.json())
      .then((j) => setNames(j.surahs || {}))
      .catch(() => {})
  }, [])
  function setParam(key: string, val: string) {
    const p = new URLSearchParams(params.toString())
    if (val) p.set(key, val); else p.delete(key)
    p.delete('page')
    router.push(`/automated?${p.toString()}`)
  }

  function toggle(id: number) {
    setPicked((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  async function copySelected() {
    if (!picked.size) return
    setBusy(true); setDone(null)
    try {
      const res = await fetch('/api/automated/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automated_ids: [...picked] }),
      })
      const j = await res.json()
      if (res.ok) {
        setDone(`تم نسخ ${j.copied} مجموعة إلى قاعدتك الشخصية`)
        setPicked(new Set())
        startTransition(() => router.refresh())
      } else {
        setDone(j.error || 'حدث خطأ')
      }
    } finally { setBusy(false) }
  }

  function ayahNum(v: number | string | undefined): number {
    if (typeof v === 'number') return v
    if (typeof v !== 'string') return 1
    const map = '٠١٢٣٤٥٦٧٨٩'
    const w = v.split('').map((c) => map.indexOf(c) >= 0 ? String(map.indexOf(c)) : c).join('')
    return parseInt(w, 10) || 1
  }

  function buildHref(p: number) {
    const sp = new URLSearchParams(params.toString())
    sp.set('page', String(p))
    return `/automated?${sp.toString()}`
  }

  return (
    <>
      {/* Filters */}
      <form onSubmit={(e) => { e.preventDefault(); setParam('q', value.trim()) }}
            role="search" className="flex flex-col gap-3 mb-4">
        <div className="flex gap-3 flex-wrap md:flex-nowrap items-stretch">
          {/* Search Input Container */}
          <div className="relative flex-1 min-w-[200px]">
            <span aria-hidden="true"
                  className={cn(
                    'absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors z-10',
                    focused ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink-muted)]'
                  )}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
              </svg>
            </span>
            <input
              id="automated-search"
              name="q"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="ابحث في العناوين الآلية…"
              className={cn(
                'w-full pl-10 pr-10 py-2.5 bg-[var(--color-surface)] text-[14px] text-[var(--color-ink)]',
                'border rounded-xl placeholder:text-[var(--color-ink-muted)]',
                'transition-all duration-200 outline-none',
                focused
                  ? 'border-[var(--color-primary)] ring-4 ring-[var(--color-primary-soft)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border-soft)]'
              )}
              dir="rtl"
            />
            {value && (
              <button type="button" onClick={() => { setValue(''); setParam('q', '') }}
                aria-label="مسح البحث"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-[var(--color-ink-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] tap-shrink transition-colors z-10">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
          
          <select
            value={surah}
            onChange={(e) => setParam('surah', e.target.value)}
            className="px-4 py-2.5 bg-[var(--color-surface)] text-[14px] text-[var(--color-ink-soft)] border border-[var(--color-border)] rounded-xl focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary-soft)] transition-all min-w-[150px] font-bold"
            dir="rtl"
          >
            <option value="">كل السور</option>
            {Object.entries(names).map(([no, name]) => (
              <option key={no} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {(q || surah) && (
          <button type="button" onClick={() => { setValue(''); setParam('q', ''); setParam('surah', '') }}
            className="self-start text-[12px] text-[var(--color-ink-muted)] hover:text-[var(--color-danger)] tap-shrink transition-colors">
            مسح المرشّحات
          </button>
        )}
      </form>

      {/* Sticky action bar when items picked */}
      {picked.size > 0 && (
        <div role="status" aria-live="polite"
             className="sticky top-2 z-20 mb-4 p-3 rounded-xl bg-[var(--color-primary)] text-[var(--color-paper)] shadow-lg flex items-center justify-between gap-3 animate-fade-rise">
          <span className="text-[13px] font-bold">{picked.size} مختار</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPicked(new Set())}
              className="px-3 py-1 text-[12px] font-bold rounded-md hover:bg-white/10 tap-shrink transition-colors">
              مسح
            </button>
            <button onClick={copySelected} disabled={busy}
              className="px-4 py-1.5 text-[12px] font-bold rounded-md bg-[var(--color-paper)] text-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 tap-shrink transition-opacity">
              {busy ? 'جارٍ النسخ…' : 'نسخ إلى الشخصية'}
            </button>
          </div>
        </div>
      )}

      {done && (
        <p className="mb-4 text-[12px] px-3 py-2 rounded-md font-bold animate-fade-rise"
           style={{ color: 'var(--color-success)', background: 'var(--color-success-bg)' }}>
          {done}
        </p>
      )}

      {/* List */}
      <ol className="divide-y divide-[var(--color-border-soft)]">
        {rows.map((r) => {
          const verses = (r.payload?.verses || []).slice(0, 2)
          const isPicked = picked.has(r.id)
          return (
            <li key={r.id} className="py-5 -mx-2 px-2 rounded-lg transition-colors hover:bg-[var(--color-surface)]">
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={isPicked} onChange={() => toggle(r.id)}
                  className="mt-1 w-4 h-4 accent-[var(--color-primary)] shrink-0"
                  aria-label={`اختيار ${r.title}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-3">
                    {r.color && (
                      <span aria-hidden="true" className="inline-block w-2 h-2 rounded-full mt-1"
                            style={{ background: r.color }} />
                    )}
                    <h2 className="text-[15px] font-bold text-[var(--color-ink)] leading-snug">{r.title}</h2>
                  </div>
                  <ol className="space-y-3">
                    {verses.map((v, vi) => (
                      <li key={vi} className="md:flex md:items-start md:gap-3">
                        <div className="md:shrink-0 md:w-20 flex md:block items-baseline gap-2 mb-1 md:mb-0 flex-wrap">
                          <span className="text-[12px] font-bold text-[var(--color-primary)]">{v.surah ?? '—'}</span>
                          <span className="text-[11px] font-mono tabular-nums text-[var(--color-ink-muted)] font-bold leading-tight">{ayahToArabic(ayahNum(v.ayah))}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <ArabicDiff parts={(v.parts ?? []) as Part[]} size="sm" />
                        </div>
                      </li>
                    ))}
                    {(r.payload?.verses?.length ?? 0) > 2 && (
                      <li className="text-[11px] text-[var(--color-ink-muted)] md:mr-20">
                        + {(r.payload?.verses?.length ?? 0) - 2} آية أخرى…
                      </li>
                    )}
                  </ol>
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-1 mt-10 mb-4">
          {page > 1 && (
            <Link href={buildHref(page - 1)}
              className="px-3 py-1.5 text-[12px] text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] tap-shrink transition-colors">
              → السابقة
            </Link>
          )}
          <span className="px-3 text-[11px] font-mono tabular-nums text-[var(--color-ink-muted)]">
            صفحة <span className="text-[var(--color-ink)] font-bold">{page}</span> من {totalPages}
          </span>
          {page < totalPages && (
            <Link href={buildHref(page + 1)}
              className="px-3 py-1.5 text-[12px] text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] tap-shrink transition-colors">
              التالية ←
            </Link>
          )}
        </nav>
      )}

      {rows.length === 0 && (
        <div className="py-20 text-center bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] mt-6">
          <p className="text-[14px] text-[var(--color-ink-muted)]">
            {q || surah ? 'لا توجد نتائج للمرشّحات الحالية.' : 'القاعدة الآلية فارغة. شغّل سكربت الترحيل أولاً.'}
          </p>
        </div>
      )}
    </>
  )
}
