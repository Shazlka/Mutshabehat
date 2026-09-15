'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Browsing-mode (view page) navigation strip — placed at the bottom of the group
// card. Three equal sections: السابقة | حذف | التالية.
// Confirm-delete replaces the strip inline with a danger-bordered state.
export default function GroupBrowseNav({
  prevGroupId, nextGroupId, id,
}: { prevGroupId?: string | null; nextGroupId?: string | null; id: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [err, setErr] = useState(false)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirmDelete) confirmBtnRef.current?.focus()
  }, [confirmDelete])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && confirmDelete) { e.preventDefault(); setConfirmDelete(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmDelete])

  function handleDelete() {
    setErr(false)
    startTransition(async () => {
      const res = await fetch(`/api/groups/${id}`, { method: 'DELETE' })
      if (!res.ok) { setErr(true); return }
      router.refresh()
      const after = nextGroupId ?? prevGroupId
      router.push(after ? `/groups/${after}` : '/')
    })
  }

  const sectionBase =
    'flex items-center justify-center gap-2 px-5 py-3 text-[13px] font-bold transition-colors select-none'
  const navActive =
    `${sectionBase} text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]`
  const navOff =
    `${sectionBase} text-[var(--color-ink-muted)] opacity-30 pointer-events-none`

  // ── Confirm-delete mode ─────────────────────────────────────────────────────
  if (confirmDelete) {
    return (
      <div
        role="alertdialog"
        aria-label="تأكيد حذف المجموعة"
        className="flex items-stretch rounded-xl border-2 border-[var(--color-danger)] overflow-hidden divide-x divide-[var(--color-danger)]/20"
      >
        {/* Cancel */}
        <button
          onClick={() => setConfirmDelete(false)}
          className={`flex-1 ${sectionBase} text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)]`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          إلغاء
        </button>

        {/* Prompt */}
        <div className={`flex-[2] ${sectionBase} text-[var(--color-danger)] cursor-default`}>
          {err ? 'فشل الحذف، حاول مرة أخرى' : 'حذف المجموعة نهائياً؟'}
        </div>

        {/* Confirm */}
        <button
          ref={confirmBtnRef}
          onClick={handleDelete}
          disabled={isPending}
          className={`flex-1 ${sectionBase} text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] disabled:opacity-40`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
          {isPending ? '…' : 'نعم، احذف'}
        </button>
      </div>
    )
  }

  // ── Normal mode ─────────────────────────────────────────────────────────────
  return (
    <nav
      aria-label="التنقل بين المجموعات"
      className="flex items-stretch rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden divide-x divide-[var(--color-border-soft)]"
    >
      {/* السابقة (RTL: chevron points right → previous) */}
      {prevGroupId ? (
        <Link
          href={`/groups/${prevGroupId}`}
          aria-label="المجموعة السابقة"
          className={`flex-1 ${navActive}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
          السابقة
        </Link>
      ) : (
        <span aria-hidden="true" className={`flex-1 ${navOff}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
          السابقة
        </span>
      )}

      {/* حذف — center, slightly narrower */}
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        aria-label="حذف المجموعة"
        className={`${sectionBase} text-[var(--color-ink-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] px-6`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        </svg>
        حذف
      </button>

      {/* التالية (RTL: chevron points left → next) */}
      {nextGroupId ? (
        <Link
          href={`/groups/${nextGroupId}`}
          aria-label="المجموعة التالية"
          className={`flex-1 ${navActive}`}
        >
          التالية
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
      ) : (
        <span aria-hidden="true" className={`flex-1 ${navOff}`}>
          التالية
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </span>
      )}
    </nav>
  )
}
