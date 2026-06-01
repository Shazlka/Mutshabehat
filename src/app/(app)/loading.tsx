export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-14 animate-fade-in" aria-busy="true" aria-label="جارٍ التحميل">
      {/* Skeleton header */}
      <div className="mb-10">
        <div className="h-8 w-40 bg-[var(--color-surface)] rounded-md mb-3 animate-pulse" />
        <div className="h-3 w-24 bg-[var(--color-surface-2)] rounded-md animate-pulse" />
      </div>

      {/* Skeleton filter bar */}
      <div className="mb-6 h-12 bg-[var(--color-surface)] rounded-xl animate-pulse" />
      <div className="mb-8 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-16 bg-[var(--color-surface)] rounded-full animate-pulse" />
        ))}
      </div>

      {/* Skeleton groups */}
      <div className="space-y-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="py-6 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="h-5 w-2/3 bg-[var(--color-surface)] rounded-md mb-4" />
            <div className="space-y-3">
              <div className="flex gap-5">
                <div className="w-24 space-y-1.5">
                  <div className="h-3.5 w-16 bg-[var(--color-surface)] rounded" />
                  <div className="h-3 w-10 bg-[var(--color-surface-2)] rounded" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full bg-[var(--color-surface)] rounded" />
                  <div className="h-4 w-5/6 bg-[var(--color-surface-2)] rounded" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">جارٍ تحميل المحتوى…</span>
    </div>
  )
}
