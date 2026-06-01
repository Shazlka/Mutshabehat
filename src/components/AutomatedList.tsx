'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ArabicDiff, { type Part } from './ArabicDiff'
import { ayahToArabic } from '@/lib/arabic'

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
      <form onSubmit={(e) => { e.preventDefault(); const v = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value.trim(); setParam('q', v) }}
            role="search" className="flex flex-col gap-3 mb-4">
        <input name="q" defaultValue={q}
          placeholder="ابحث في العناوين…"
          className="w-full px-4 py-2.5 bg-[var(--color-surface)] text-[14px] border border-[var(--color-border)] rounded-xl focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary-soft)] transition-all"
          dir="rtl" />
        {(q || surah) && (
          <button type="button" onClick={() => { setParam('q', ''); setParam('surah', '') }}
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
                  <ol className="space-y-2.5">
                    {verses.map((v, vi) => (
                      <li key={vi} className="flex items-start gap-3">
                        <div className="shrink-0 w-20">
                          <div className="text-[12px] font-bold text-[var(--color-primary)]">{v.surah ?? '—'}</div>
                          <div className="text-[10px] font-mono text-[var(--color-ink-muted)]">آية {ayahToArabic(ayahNum(v.ayah))}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <ArabicDiff parts={(v.parts ?? []) as Part[]} size="sm" />
                        </div>
                      </li>
                    ))}
                    {(r.payload?.verses?.length ?? 0) > 2 && (
                      <li className="text-[11px] text-[var(--color-ink-muted)] mr-20">
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
