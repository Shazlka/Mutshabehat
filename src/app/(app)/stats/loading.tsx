export default function StatsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-14 animate-fade-in" aria-busy="true" aria-label="جارٍ تحميل الإحصائيات">
      <div className="mb-10">
        <div className="h-8 w-32 bg-[var(--color-surface)] rounded-md mb-3 animate-pulse" />
        <div className="h-3 w-20 bg-[var(--color-surface-2)] rounded-md animate-pulse" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] animate-pulse"
               style={{ animationDelay: `${i * 60}ms` }}>
            <div className="h-6 w-16 bg-[var(--color-surface-2)] rounded mb-2" />
            <div className="h-3 w-20 bg-[var(--color-surface-2)] rounded" />
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="h-48 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] animate-pulse mb-6" />
      <div className="h-48 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] animate-pulse" />

      <span className="sr-only">جارٍ تحميل الإحصائيات…</span>
    </div>
  )
}
