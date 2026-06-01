'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

const FILTERS = [
  { key: '',          label: 'الكل' },
  { key: 'favorite',  label: 'مفضّلة' },
  { key: 'completed', label: 'مكتملة' },
  { key: 'draft',     label: 'مسودات' },
  { key: 'locked',    label: 'مقفلة' },
]

export default function FilterBar() {
  const router = useRouter()
  const params = useSearchParams()
  const active = params.get('filter') ?? ''
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(params.get('q') ?? '')
  const [focused, setFocused] = useState(false)

  // ⌘K / Ctrl+K to focus search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function update(key: string) {
    const p = new URLSearchParams(params.toString())
    if (key) p.set('filter', key); else p.delete('filter')
    p.delete('page')
    router.push(`/?${p.toString()}`)
  }

  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const p = new URLSearchParams(params.toString())
    if (value.trim()) p.set('q', value.trim()); else p.delete('q')
    p.delete('page')
    router.push(`/?${p.toString()}`)
  }

  function clearSearch() {
    setValue('')
    const p = new URLSearchParams(params.toString())
    p.delete('q')
    router.push(`/?${p.toString()}`)
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-4 mb-2">
      {/* Search */}
      <form onSubmit={onSearch} role="search" className="relative">
        <label htmlFor="search-input" className="sr-only">البحث في المتشابهات</label>
        <span aria-hidden="true"
              className={cn(
                'absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors',
                focused ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink-muted)]'
              )}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
          </svg>
        </span>
        <input ref={inputRef} id="search-input" name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="ابحث في المتشابهات…"
          className={cn(
            'w-full pl-12 pr-10 py-3 bg-[var(--color-surface)] text-[15px] text-[var(--color-ink)]',
            'border-2 rounded-xl placeholder:text-[var(--color-ink-muted)]',
            'transition-all duration-200 outline-none',
            focused
              ? 'border-[var(--color-primary)] shadow-[0_0_0_4px_var(--color-primary-soft)]'
              : 'border-[var(--color-border)] hover:border-[var(--color-border-soft)]'
          )} />
        {value && (
          <button type="button" onClick={clearSearch}
            aria-label="مسح البحث"
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-[var(--color-ink-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] tap-shrink transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
        <kbd aria-hidden="true"
             className={cn(
               'hidden md:inline-flex absolute left-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-mono pointer-events-none transition-opacity',
               value || focused
                 ? 'opacity-0'
                 : 'opacity-100 text-[var(--color-ink-muted)] bg-[var(--color-surface-2)] border border-[var(--color-border-soft)]'
             )}>⌘ K</kbd>
      </form>

      {/* Filter pills */}
      <div role="group" aria-label="تصفية المجموعات" className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map((f) => {
          const isActive = active === f.key
          return (
            <button key={f.key || 'all'} type="button"
              aria-pressed={isActive}
              onClick={() => update(f.key)}
              className={cn(
                'px-4 py-1.5 text-[12px] rounded-full font-bold tap-shrink transition-all duration-150',
                isActive
                  ? 'bg-[var(--color-primary)] text-[var(--color-paper)] shadow-sm shadow-[var(--color-primary)]/20'
                  : 'text-[var(--color-ink-soft)] bg-[var(--color-surface)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]'
              )}>
              {f.label}
            </button>
          )
        })}
        <span className="flex-1" />
        <Link href="/groups/new"
          className="inline-flex items-center gap-1 px-4 py-1.5 text-[12px] font-bold rounded-full bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-primary)] tap-shrink transition-colors shadow-sm">
          <span aria-hidden="true">+</span> مجموعة جديدة
        </Link>
      </div>
    </div>
  )
}
