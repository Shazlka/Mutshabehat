'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Full-width native-app-style bottom bar for the group view page (mobile only).
// 5 equal cells: back · previous · next · delete · edit.
// Confirm-delete replaces the bar content rather than opening a modal.
export default function GroupMobileBottomBar({
  id, prevGroupId, nextGroupId,
}: {
  id: string
  prevGroupId?: string | null
  nextGroupId?: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteErr, setDeleteErr] = useState(false)
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
    setDeleteErr(false)
    startTransition(async () => {
      const res = await fetch(`/api/groups/${id}`, { method: 'DELETE' })
      if (!res.ok) { setDeleteErr(true); return }
      router.refresh()
      const after = nextGroupId ?? prevGroupId
      router.push(after ? `/groups/${after}` : '/')
    })
  }

  const cell = [
    'flex-1 flex flex-col items-center justify-center gap-1.5',
    'py-3.5 min-h-[62px] select-none',
    'transition-colors active:bg-[var(--color-surface)] tap-shrink',
  ].join(' ')

  // ── Confirm-delete mode ─────────────────────────────────────────────────────
  if (confirmDelete) {
    return (
      <nav
        role="alertdialog"
        aria-label="تأكيد حذف المجموعة"
        className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-[var(--color-paper)] border-t-2 border-[var(--color-danger)] flex items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Cancel */}
        <button
          onClick={() => setConfirmDelete(false)}
          className={`${cell} text-[var(--color-ink-soft)]`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          <span className="text-[11px] font-bold">إلغاء</span>
        </button>

        {/* Prompt */}
        <div className="flex-[2] flex flex-col items-center justify-center border-x border-[var(--color-border-soft)] px-2">
          <span className="text-[12px] font-bold text-center leading-snug"
            style={{ color: deleteErr ? 'var(--color-danger)' : 'var(--color-ink-soft)' }}>
            {deleteErr ? 'فشل الحذف، حاول مرة أخرى' : 'حذف المجموعة نهائياً؟'}
          </span>
        </div>

        {/* Confirm */}
        <button
          ref={confirmBtnRef}
          onClick={handleDelete}
          disabled={isPending}
          className={`${cell} text-[var(--color-danger)] disabled:opacity-40`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
          <span className="text-[11px] font-bold">{isPending ? '…' : 'نعم، احذف'}</span>
        </button>
      </nav>
    )
  }

  // ── Normal mode ─────────────────────────────────────────────────────────────
  return (
    <nav
      aria-label="تنقل المجموعة"
      className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-[var(--color-paper)]/95 backdrop-blur-sm border-t border-[var(--color-border)] flex items-stretch divide-x divide-[var(--color-border-soft)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Back */}
      <button
        onClick={() => router.back()}
        className={`${cell} text-[var(--color-ink-soft)]`}
        aria-label="رجوع"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m12 19-7-7 7-7" /><path d="M5 12h14" />
        </svg>
        <span className="text-[11px] font-bold">رجوع</span>
      </button>

      {/* Previous (RTL ›) */}
      {prevGroupId ? (
        <Link
          href={`/groups/${prevGroupId}`}
          aria-label="المجموعة السابقة"
          className={`${cell} text-[var(--color-ink-soft)]`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
          <span className="text-[11px] font-bold">السابقة</span>
        </Link>
      ) : (
        <div className={`${cell} opacity-20 pointer-events-none text-[var(--color-ink-muted)]`} aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
          <span className="text-[11px] font-bold">السابقة</span>
        </div>
      )}

      {/* Next (RTL ‹) */}
      {nextGroupId ? (
        <Link
          href={`/groups/${nextGroupId}`}
          aria-label="المجموعة التالية"
          className={`${cell} text-[var(--color-ink-soft)]`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span className="text-[11px] font-bold">التالية</span>
        </Link>
      ) : (
        <div className={`${cell} opacity-20 pointer-events-none text-[var(--color-ink-muted)]`} aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span className="text-[11px] font-bold">التالية</span>
        </div>
      )}

      {/* Delete */}
      <button
        onClick={() => setConfirmDelete(true)}
        aria-label="حذف المجموعة"
        className={`${cell} text-[var(--color-ink-muted)]`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        </svg>
        <span className="text-[11px] font-bold">حذف</span>
      </button>

      {/* Edit */}
      <Link
        href={`/groups/${id}/edit`}
        aria-label="تعديل المجموعة"
        className={`${cell} text-[var(--color-primary)]`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
        <span className="text-[11px] font-bold">تعديل</span>
      </Link>
    </nav>
  )
}
