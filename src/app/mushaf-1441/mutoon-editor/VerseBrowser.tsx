'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { key } from './data'
import type { WorkData } from './useMutoonStore'
import { FOCUS, Icon, INPUT, Skeleton } from './ui'

const toArabicDigits = (n: number) => n.toLocaleString('ar-EG', { useGrouping: false })

export function VerseBrowser({ data, loading, selected, onSelect, subtitle }: {
  data: WorkData | undefined
  loading: boolean
  selected: number
  onSelect: (verse: number) => void
  subtitle: string
}) {
  const [query, setQuery] = useState('')
  const [chapter, setChapter] = useState(-1)
  const activeRef = useRef<HTMLButtonElement | null>(null)

  const rows = useMemo(() => {
    if (!data) return []
    const q = key(query)
    const digits = query.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).trim()
    return data.chapters
      .filter(ch => chapter < 0 || ch.index === chapter)
      .flatMap(ch => ch.verses.map(v => ({ ...v, chapter: ch.title, chapterIndex: ch.index })))
      .filter(v => !q && !digits ? true : String(v.number) === digits || key(v.lines.join(' ')).includes(q) || key(v.chapter).includes(q))
  }, [data, query, chapter])

  // keep the open verse in view when it changes from outside the list (arrows, jump)
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest' }) }, [selected, rows.length])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-surface)]">
      <div className="space-y-2 border-b border-[var(--color-border)] p-3">
        <p className="text-[11px] leading-5 text-[var(--color-ink-soft)]">{subtitle}</p>
        <div className="relative">
          <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-muted)]" />
          <input type="search" aria-label="ابحث في الأبيات" value={query} onChange={e => setQuery(e.target.value)} placeholder="رقم البيت أو كلمة منه" className={`${INPUT} ps-9`} />
        </div>
        <select aria-label="الباب" value={chapter} onChange={e => setChapter(Number(e.target.value))} className={`${INPUT} font-bold`}>
          <option value={-1}>كل الأبواب{data ? ` (${toArabicDigits(data.chapters.length)})` : ''}</option>
          {data?.chapters.map(ch => <option key={ch.index} value={ch.index}>{ch.title} ({toArabicDigits(ch.verses.length)})</option>)}
        </select>
        <p className="text-[11px] text-[var(--color-ink-muted)]" aria-live="polite">{data ? `${toArabicDigits(rows.length)} بيتًا` : ''}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2" role="listbox" aria-label="أبيات المتن">
        {loading && !data && Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="mb-1.5 h-14" />)}
        {data && rows.length === 0 && <p className="p-4 text-center text-xs text-[var(--color-ink-soft)]">لا أبيات تطابق البحث.</p>}
        {rows.map(v => {
          const active = v.number === selected
          return (
            <button key={v.number} ref={active ? activeRef : undefined} type="button" role="option" aria-selected={active} onClick={() => onSelect(v.number)}
              className={`mb-1 flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors duration-150 [contain-intrinsic-size:auto_56px] [content-visibility:auto] ${FOCUS} ${active ? 'bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-surface-2)]'}`}>
              <span className={`mt-0.5 w-9 shrink-0 text-center text-xs font-bold tabular-nums ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink-muted)]'}`}>{toArabicDigits(v.number)}</span>
              <span className="min-w-0 flex-1">
                <span className="font-quran block truncate text-[15px] leading-7 text-[var(--color-ink)]">{v.lines[0]}</span>
                {(v.assignments > 0 || v.marks > 0) && (
                  <span className="mt-0.5 flex gap-2 text-[10px] font-bold text-[var(--color-ink-soft)]">
                    {v.assignments > 0 && <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-[var(--color-primary)]" aria-hidden="true" />{toArabicDigits(v.assignments)} تعيين</span>}
                    {v.marks > 0 && <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-[var(--color-unique)]" aria-hidden="true" />{toArabicDigits(v.marks)} رمز</span>}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
