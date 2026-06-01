'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'

interface Group { id: string; title: string }
interface Tag   { id: string; name: string; color: string | null }
interface Props { groups: Group[]; tags: Tag[] }

export default function BulkTagger({ groups, tags }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [groupQuery, setGroupQuery] = useState('')
  const [pickedGroups, setPickedGroups] = useState<Set<string>>(new Set())
  const [pickedTags, setPickedTags] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<'add' | 'replace' | 'remove'>('add')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const filtered = groupQuery.trim()
    ? groups.filter((g) => g.title.includes(groupQuery.trim()))
    : groups

  function toggleGroup(id: string) {
    setPickedGroups((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  function toggleTag(id: string) {
    setPickedTags((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  function selectAll() { setPickedGroups(new Set(filtered.map((g) => g.id))) }
  function clearAll()  { setPickedGroups(new Set()) }

  async function apply() {
    if (pickedGroups.size === 0 || (mode !== 'replace' && pickedTags.size === 0)) return
    setBusy(true); setDone(null)
    try {
      const res = await fetch('/api/tags/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_ids: [...pickedGroups],
          tag_ids:   [...pickedTags],
          mode,
        }),
      })
      if (res.ok) {
        setDone(`تم تطبيق "${mode === 'add' ? 'إضافة' : mode === 'replace' ? 'استبدال' : 'إزالة'}" على ${pickedGroups.size} مجموعة`)
        setPickedGroups(new Set()); setPickedTags(new Set())
        startTransition(() => router.refresh())
      } else {
        setDone('حدث خطأ')
      }
    } finally { setBusy(false) }
  }

  return (
    <section>
      <h2 className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-4 font-bold">
        وسم جماعي
      </h2>

      {/* Mode */}
      <div className="flex items-center gap-1.5 mb-5 p-1 bg-[var(--color-surface)] border border-[var(--color-border-soft)] rounded-full w-fit">
        {[
          { key: 'add',     label: 'إضافة'    },
          { key: 'replace', label: 'استبدال'  },
          { key: 'remove',  label: 'إزالة'    },
        ].map((m) => (
          <button key={m.key} type="button" onClick={() => setMode(m.key as 'add'|'replace'|'remove')}
            className={cn(
              'px-4 py-1.5 text-[12px] font-bold rounded-full tap-shrink transition-colors',
              mode === m.key
                ? 'bg-[var(--color-primary)] text-[var(--color-paper)] shadow-sm'
                : 'text-[var(--color-ink-soft)] hover:text-[var(--color-primary)]'
            )}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Tag picker */}
      <div className="mb-6">
        <div className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-2 font-bold">
          الوسوم ({pickedTags.size} مختار)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tags.length === 0 && (
            <p className="text-[12px] text-[var(--color-ink-muted)]">
              لا توجد وسوم. أنشئ وسوماً من تعديل أي مجموعة.
            </p>
          )}
          {tags.map((t) => {
            const picked = pickedTags.has(t.id)
            return (
              <button key={t.id} type="button" onClick={() => toggleTag(t.id)}
                className={cn(
                  'inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold border-2 tap-shrink transition-all',
                  picked && 'ring-2 ring-offset-1 ring-[var(--color-primary)]'
                )}
                style={{
                  borderColor: t.color ?? 'var(--color-border)',
                  background:  picked ? (t.color ?? 'var(--color-primary)') : 'transparent',
                  color:       picked ? '#fff' : (t.color ?? 'var(--color-ink-soft)'),
                }}>
                {t.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Group picker */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
          <span className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase font-bold">
            المجموعات ({pickedGroups.size} مختار من {filtered.length})
          </span>
          <div className="flex items-center gap-2 text-[11px]">
            <button onClick={selectAll} type="button"
              className="text-[var(--color-primary)] hover:underline font-bold">تحديد الكل</button>
            <button onClick={clearAll} type="button"
              className="text-[var(--color-ink-soft)] hover:text-[var(--color-danger)] font-bold">مسح</button>
          </div>
        </div>
        <input value={groupQuery} onChange={(e) => setGroupQuery(e.target.value)}
          placeholder="ابحث في العناوين…"
          className="w-full px-3 py-2 mb-2 text-[13px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md focus:border-[var(--color-primary)] focus:outline-none transition-colors" />
        <ul className="max-h-[300px] overflow-y-auto border border-[var(--color-border-soft)] rounded-lg divide-y divide-[var(--color-border-soft)]">
          {filtered.map((g) => {
            const picked = pickedGroups.has(g.id)
            return (
              <li key={g.id}>
                <label className={cn(
                  'flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer transition-colors',
                  picked ? 'bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-surface)]'
                )}>
                  <input type="checkbox" checked={picked} onChange={() => toggleGroup(g.id)}
                    className="w-4 h-4 accent-[var(--color-primary)]" />
                  <span className="truncate flex-1">{g.title}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Apply */}
      <div className="flex items-center gap-3 sticky bottom-0 bg-[var(--color-paper)] pt-4 border-t border-[var(--color-border-soft)]">
        <button onClick={apply}
          disabled={busy || pickedGroups.size === 0 || (mode !== 'replace' && pickedTags.size === 0)}
          className="px-5 py-2 text-[13px] font-bold rounded-full bg-[var(--color-primary)] text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 tap-shrink transition-colors shadow-sm">
          {busy ? 'جارٍ التطبيق…' : 'تطبيق'}
        </button>
        {done && (
          <span role="status" aria-live="polite" className="text-[12px] px-3 py-1.5 rounded-md font-bold animate-fade-rise"
            style={{ color: 'var(--color-success)', background: 'var(--color-success-bg)' }}>
            {done}
          </span>
        )}
      </div>
    </section>
  )
}
