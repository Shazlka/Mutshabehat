export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-6 md:py-10 pb-28 md:pb-10">
      {/* Desktop toolbar */}
      <div className="hidden md:flex items-center justify-between py-3 mb-8 border-b border-[var(--color-border)]">
        <div className="h-5 w-12 rounded bg-[var(--color-surface)]" />
        <div className="h-8 w-32 rounded-full bg-[var(--color-surface)]" />
      </div>

      <div className="animate-pulse">
        {/* Title */}
        <div className="mb-10">
          <div className="h-2 w-10 rounded bg-[var(--color-surface)] mb-2" />
          <div className="h-9 rounded bg-[var(--color-surface)]" style={{ width: '72%' }} />
        </div>
        {/* Color swatches */}
        <div className="mb-8">
          <div className="h-2 w-16 rounded bg-[var(--color-surface)] mb-2" />
          <div className="flex gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="w-9 h-9 rounded-full bg-[var(--color-surface)]" />
            ))}
          </div>
        </div>
        {/* Status row */}
        <div className="flex gap-6 mb-10">
          <div className="h-5 w-16 rounded bg-[var(--color-surface)]" />
          <div className="h-5 w-20 rounded bg-[var(--color-surface)]" />
          <div className="h-5 w-24 rounded bg-[var(--color-surface)]" />
        </div>
        {/* Verse cards */}
        {[0, 1].map((_, i) => (
          <div key={i} className="py-5 border-b border-[var(--color-border-soft)]">
            <div className="flex gap-4">
              <div className="shrink-0 space-y-1.5" style={{ width: '5rem' }}>
                <div className="h-3.5 rounded bg-[var(--color-surface)]" style={{ width: '65%' }} />
                <div className="h-3 rounded bg-[var(--color-surface)]" style={{ width: '30%' }} />
              </div>
              <div className="flex-1 space-y-2.5">
                <div className="h-5 rounded bg-[var(--color-surface)] w-full" />
                <div className="h-5 rounded bg-[var(--color-surface)]" style={{ width: i === 0 ? '88%' : '76%' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
