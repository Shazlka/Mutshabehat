'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// A small palette of suggested colors — picks one randomly on mount so each
// new group gets a different default. Users can still pick any color.
const SUGGESTIONS = [
  '#55b94f', '#4b63e6', '#c9a84c', '#7c3aed', '#15803d',
  '#2563eb', '#d92323', '#0f766e', '#9a5d00', '#1A4A6E',
]

export default function NewGroupForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [color, setColor] = useState(SUGGESTIONS[0])
  const [error, setError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  // Randomize default color on mount + autofocus the title
  useEffect(() => {
    setColor(SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)])
    titleRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('العنوان مطلوب'); return }
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), color }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'فشل إنشاء المجموعة')
        return
      }
      const { group } = await res.json()
      // Drop the user straight into the full editor to add verses.
      router.push(`/groups/${group.id}/edit`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Title */}
      <div>
        <label htmlFor="new-title"
          className="block text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-2 font-bold">
          عنوان المتشابه
        </label>
        <input ref={titleRef} id="new-title" value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثال: الرجفة / الصيحة"
          className="w-full px-4 py-3 text-[18px] font-bold bg-[var(--color-surface)]
                     border-2 border-[var(--color-border)] rounded-xl
                     focus:border-[var(--color-primary)] focus:outline-none
                     focus:ring-4 focus:ring-[var(--color-primary-soft)]
                     placeholder:font-normal placeholder:text-[var(--color-ink-muted)]
                     transition-all duration-200" />
      </div>

      {/* Color picker */}
      <div>
        <label className="block text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-2 font-bold">
          اللون المميّز
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {SUGGESTIONS.map((c) => {
            const active = color === c
            return (
              <button key={c} type="button" onClick={() => setColor(c)}
                aria-label={`اختر اللون ${c}`}
                aria-pressed={active}
                className="touch-target-sm rounded-full border-2 tap-shrink transition-transform"
                style={{
                  background: c,
                  borderColor: active ? 'var(--color-ink)' : 'transparent',
                  transform: active ? 'scale(1.15)' : 'scale(1)',
                }} />
            )
          })}
          <span className="w-px h-7 bg-[var(--color-border)] mx-1" aria-hidden="true" />
          <label className="inline-flex items-center gap-2 text-[12px] text-[var(--color-ink-soft)] cursor-pointer">
            <input type="color" value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-9 h-9 rounded-md cursor-pointer border-0 p-0"
              aria-label="اختيار لون مخصّص" />
            مخصّص
          </label>
        </div>
      </div>

      {/* Preview */}
      <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-soft)]">
        <p className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-3 font-bold">
          معاينة
        </p>
        <div className="flex items-baseline gap-3">
          <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                style={{ background: color }} />
          <span className="text-[18px] font-bold text-[var(--color-ink)] leading-tight">
            {title.trim() || <span className="text-[var(--color-ink-muted)] font-normal">عنوان المجموعة سيظهر هنا…</span>}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="text-[12px] px-3 py-2 rounded-md font-bold animate-fade-rise"
             style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={isPending || !title.trim()}
          className="px-6 py-2.5 text-[14px] font-bold rounded-full bg-[var(--color-primary)] text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 tap-shrink transition-colors shadow-sm">
          {isPending ? 'جارٍ الإنشاء…' : 'إنشاء والانتقال للتحرير'}
        </button>
        <Link href="/"
          className="text-[13px] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] tap-shrink transition-colors">
          إلغاء
        </Link>
      </div>
    </form>
  )
}
