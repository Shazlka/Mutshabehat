interface Props {
  juzCounts: number[]   // index 0..29 → group count for juz 1..30
}

const LEVELS = [
  'var(--color-surface-2)',
  'oklch(0.92 0.060 265)',
  'oklch(0.78 0.110 265)',
  'oklch(0.55 0.140 265)',
  'oklch(0.36 0.140 265)',
]

function levelOf(count: number, max: number): number {
  if (count === 0) return 0
  const r = count / max
  if (r > 0.75) return 4
  if (r > 0.50) return 3
  if (r > 0.25) return 2
  return 1
}

export default function JuzHeatmap({ juzCounts }: Props) {
  const max = Math.max(1, ...juzCounts)
  return (
    <div>
      <div className="grid grid-cols-6 md:grid-cols-10 gap-1.5 mb-3" role="img" aria-label="كثافة المتشابهات لكل جزء">
        {juzCounts.map((count, i) => {
          const lvl = levelOf(count, max)
          return (
            <div key={i}
              className="aspect-square rounded-md flex flex-col items-center justify-center text-center transition-transform hover:scale-110 cursor-default"
              style={{ background: LEVELS[lvl] }}
              title={`الجزء ${i + 1} — ${count} مجموعة`}>
              <span className={`text-[10px] font-bold tabular-nums ${lvl >= 3 ? 'text-white' : 'text-[var(--color-ink-soft)]'}`}>
                {i + 1}
              </span>
              <span className={`text-[9px] font-mono tabular-nums opacity-80 ${lvl >= 3 ? 'text-white' : 'text-[var(--color-ink-muted)]'}`}>
                {count}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-[var(--color-ink-muted)] justify-end">
        <span>أقل</span>
        {LEVELS.map((c, i) => (
          <span key={i} className="w-3 h-3 rounded-sm" style={{ background: c }} aria-hidden="true" />
        ))}
        <span>أكثر</span>
      </div>
    </div>
  )
}
