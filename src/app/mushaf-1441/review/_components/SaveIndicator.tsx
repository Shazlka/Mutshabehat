'use client'

// D7 — instant save, visible saved/error state. One small indicator reused by every editor
// surface (row fields, status buttons, narrator editor).

export type SaveState =
  | { phase: 'idle' }
  | { phase: 'saving' }
  | { phase: 'saved' }
  | { phase: 'error'; message: string }

export default function SaveIndicator({ state }: { state: SaveState }) {
  if (state.phase === 'idle') return null

  if (state.phase === 'saving') {
    return (
      <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-ink-muted)]" role="status">
        <span
          aria-hidden="true"
          className="inline-block size-2 animate-pulse-dot rounded-full bg-[var(--color-ink-muted)]"
        />
        جارٍ الحفظ…
      </p>
    )
  }

  if (state.phase === 'saved') {
    return (
      <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-success)]" role="status">
        <span aria-hidden="true">✓</span> تم الحفظ
      </p>
    )
  }

  return (
    <p
      className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-2 py-1 text-xs font-bold text-[var(--color-danger)]"
      role="alert"
    >
      {state.message}
    </p>
  )
}
