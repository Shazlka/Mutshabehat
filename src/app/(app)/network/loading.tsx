export default function NetworkLoading() {
  return (
    <div className="max-w-6xl mx-auto px-3 md:px-6 py-6 md:py-10 animate-fade-in" aria-busy="true" aria-label="جارٍ تحميل الشبكة">
      <div className="mb-8 px-2">
        <div className="h-3 w-16 bg-[var(--color-surface-2)] rounded mb-2 animate-pulse" />
        <div className="h-8 w-40 bg-[var(--color-surface)] rounded-md mb-3 animate-pulse" />
        <div className="h-3 w-56 bg-[var(--color-surface-2)] rounded animate-pulse" />
      </div>

      {/* Graph canvas placeholder */}
      <div className="w-full h-[600px] bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border-soft)] animate-pulse
                      flex items-center justify-center">
        <div className="text-[var(--color-ink-muted)] text-[13px] font-bold">جارٍ بناء الشبكة…</div>
      </div>

      <span className="sr-only">جارٍ تحميل شبكة السور…</span>
    </div>
  )
}
