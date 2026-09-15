'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const SORTS = [
  { key: 'created',     label: 'الأحدث إضافةً' },
  { key: 'updated',     label: 'الأحدث تعديلاً' },
  { key: 'mushaf',      label: 'ترتيب المصحف' },
  { key: 'most-verses', label: 'الأكثر آيات' },
  { key: 'title',       label: 'الترتيب الأبجدي' },
]

const VIEWS = [
  { key: 'flat',         label: 'قائمة' },
  { key: 'group-surah',  label: 'مجموع حسب السورة' },
  { key: 'titles-only',  label: 'العناوين فقط' },
]

export default function SortBar() {
  const router = useRouter()
  const params = useSearchParams()
  const sort = params.get('sort') ?? 'created'
  const view = params.get('view') ?? 'flat'

  function setParam(key: string, value: string, defaultValue: string) {
    const p = new URLSearchParams(params.toString())
    if (value === defaultValue) p.delete(key); else p.set(key, value)
    p.delete('page')
    router.push(`/?${p.toString()}`)
  }

  return (
    <div className="flex items-center gap-3 flex-wrap text-[11px] mb-4">
      <label className="inline-flex items-center gap-1.5">
        <span className="text-[var(--color-ink-muted)] tracking-wider uppercase font-bold">الترتيب:</span>
        <select value={sort} onChange={(e) => setParam('sort', e.target.value, 'created')}
          className="px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border-soft)] rounded-md text-[12px] font-bold focus:border-[var(--color-primary)] focus:outline-none transition-colors">
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </label>
      <label className="inline-flex items-center gap-1.5">
        <span className="text-[var(--color-ink-muted)] tracking-wider uppercase font-bold">العرض:</span>
        <select value={view} onChange={(e) => setParam('view', e.target.value, 'flat')}
          className="px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border-soft)] rounded-md text-[12px] font-bold focus:border-[var(--color-primary)] focus:outline-none transition-colors">
          {VIEWS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
        </select>
      </label>
    </div>
  )
}
