export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-6 md:py-10 pb-28 md:pb-10">
      {/* Desktop top-toolbar placeholder keeps layout stable */}
      <div className="hidden md:block h-10 mb-6" />

      <div className="animate-pulse">
        {/* Title row */}
        <div className="flex items-baseline gap-3 mb-3">
          <div className="w-3 h-3 rounded-full bg-[var(--color-surface)] shrink-0 mt-1" />
          <div className="h-7 rounded-lg bg-[var(--color-surface)]" style={{ width: '58%' }} />
        </div>
        {/* Badge row */}
        <div className="flex gap-2 mb-8">
          <div className="h-5 w-14 rounded-full bg-[var(--color-surface)]" />
          <div className="h-5 w-10 rounded-full bg-[var(--color-surface)]" />
        </div>
        {/* View-switcher placeholder */}
        <div className="h-9 w-52 rounded-full bg-[var(--color-surface)] mb-6" />
        {/* Verse cards */}
        {[1, 2, 3].map((_, i) => (
          <div key={i} className="py-5 border-b border-[var(--color-border-soft)]">
            <div className="flex gap-4">
              <div className="shrink-0 space-y-1.5" style={{ width: '5rem' }}>
                <div className="h-3.5 rounded bg-[var(--color-surface)]" style={{ width: '65%' }} />
                <div className="h-3 rounded bg-[var(--color-surface)]" style={{ width: '30%' }} />
              </div>
              <div className="flex-1 space-y-2.5">
                <div className="h-5 rounded bg-[var(--color-surface)] w-full" />
                <div className="h-5 rounded bg-[var(--color-surface)]" style={{ width: i === 1 ? '78%' : '90%' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
