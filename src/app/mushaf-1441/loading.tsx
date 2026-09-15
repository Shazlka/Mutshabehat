// Route-level skeleton: same frame as the reader so the page doesn't jump when it loads.
export default function Mushaf1441Loading() {
  return (
    <div dir="rtl" className="flex h-[100dvh] flex-col overflow-hidden bg-[#efe7d6]" aria-busy="true" aria-label="جارٍ تحميل المصحف">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#d7c7a7] bg-[#f7f0e0] px-3">
        <div className="space-y-1.5">
          <div className="h-3.5 w-24 animate-pulse rounded bg-[#e6d8b6]" />
          <div className="h-2.5 w-16 animate-pulse rounded bg-[#eee3c8]" />
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="size-10 animate-pulse rounded-md bg-[#e6d8b6]" />
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center sm:p-3">
        <div
          className="grid h-full w-full max-w-[34rem] bg-[#fffdf6] sm:rounded-[10px] sm:border sm:border-[#e2d4b3]"
          style={{ gridTemplateRows: 'repeat(15, minmax(0, 1fr))', padding: '5.8% 7.2%' }}
        >
          {Array.from({ length: 15 }, (_, i) => (
            <div key={i} className="flex items-center">
              <div
                className="h-[38%] animate-pulse rounded-full bg-[#efe4c9]"
                style={{ width: i === 14 ? '60%' : '100%', marginInline: 'auto', animationDelay: `${i * 60}ms` }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="h-12 shrink-0 border-t border-[#d7c7a7] bg-[#f7f0e0]" />
    </div>
  )
}
