'use client'

export type SaveFailure = {
  id: number
  label: string
  message: string
  retry(): void
  dismiss(): void
}

type Props = {
  pending: number
  lastSavedAt: number | null
  failures: SaveFailure[]
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB', { hour12: false })
}

/**
 * Bottom strip of the review page. Saves run in the background (the row appears at once), so this
 * is where the reviewer confirms they actually reached the database: a spinner while any save is
 * in flight, the time of the last confirmed save, and any failure with a retry.
 */
export default function ReviewSaveStatusBar({ pending, lastSavedAt, failures }: Props) {
  if (pending === 0 && failures.length === 0 && lastSavedAt === null) return null

  return (
    <div
      role="status"
      aria-live="polite"
      dir="rtl"
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-bold"
    >
      {pending > 0 ? (
        <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
          <span
            aria-hidden="true"
            className="size-3 animate-spin rounded-full border-2 border-amber-600 border-t-transparent"
          />
          جارٍ الحفظ… ({pending})
        </span>
      ) : failures.length === 0 && lastSavedAt !== null ? (
        <span className="text-green-700 dark:text-green-400">
          ✓ تم الحفظ في قاعدة البيانات · {formatTime(lastSavedAt)}
        </span>
      ) : null}

      {failures.map((failure) => (
        <span key={failure.id} className="flex items-center gap-2 text-[var(--color-danger)]">
          ✕ تعذّر الحفظ ({failure.label}): {failure.message}
          <button
            type="button"
            onClick={failure.retry}
            className="rounded border border-[var(--color-danger)] px-1.5 py-px hover:bg-[var(--color-danger-bg)]"
          >
            إعادة المحاولة
          </button>
          <button
            type="button"
            onClick={failure.dismiss}
            aria-label="إخفاء"
            className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  )
}
