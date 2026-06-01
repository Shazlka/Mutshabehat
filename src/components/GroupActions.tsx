'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'

interface Props {
  id: string
  favorite: boolean
  completed: boolean
  locked: boolean
  groupText: string  // plain text for clipboard
}

export default function GroupActions({ id, favorite, completed, locked, groupText }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function patch(body: Record<string, unknown>) {
    setBusy(true)
    try {
      await fetch(`/api/groups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      startTransition(() => router.refresh())
    } finally { setBusy(false) }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(groupText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // graceful fail — show no error, just no animation
    }
  }

  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {/* Favorite */}
      <button onClick={() => patch({ favorite: !favorite })} disabled={busy}
        aria-label={favorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
        aria-pressed={favorite}
        className={cn(
          'touch-target-sm rounded-md tap-shrink transition-all duration-150',
          favorite
            ? 'text-[var(--color-warn)] hover:bg-[var(--color-warn-bg)]'
            : 'text-[var(--color-ink-muted)] hover:text-[var(--color-warn)] hover:bg-[var(--color-warn-bg)]'
        )}>
        <svg width="16" height="16" viewBox="0 0 24 24"
             fill={favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </button>

      {/* Completed */}
      <button onClick={() => patch({ completed: !completed })} disabled={busy}
        aria-label={completed ? 'إلغاء الإكمال' : 'تأشير كمكتمل'}
        aria-pressed={completed}
        className={cn(
          'touch-target-sm rounded-md tap-shrink transition-all duration-150',
          completed
            ? 'text-[var(--color-success)] hover:bg-[var(--color-success-bg)]'
            : 'text-[var(--color-ink-muted)] hover:text-[var(--color-success)] hover:bg-[var(--color-success-bg)]'
        )}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      </button>

      {/* Lock */}
      <button onClick={() => patch({ status: locked ? 'draft' : 'locked' })} disabled={busy}
        aria-label={locked ? 'إلغاء القفل' : 'قفل'}
        aria-pressed={locked}
        className={cn(
          'touch-target-sm rounded-md tap-shrink transition-all duration-150',
          locked
            ? 'text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
        )}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          {locked
            ? <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            : <path d="M7 11V7a5 5 0 0 1 9.9-1"/>}
        </svg>
      </button>

      {/* Copy text */}
      <button onClick={copy}
        aria-label="نسخ النص"
        className={cn(
          'touch-target-sm rounded-md tap-shrink transition-all duration-150',
          copied
            ? 'text-[var(--color-success)] bg-[var(--color-success-bg)]'
            : 'text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]'
        )}>
        {copied ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path className="animate-check-draw" d="M20 6 9 17l-5-5"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        )}
      </button>
    </div>
  )
}
