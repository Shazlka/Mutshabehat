interface Day { date: string; count: number }

interface Props { days: Day[] }

// 30-day activity line + bar chart. Pure SVG.
export default function ActivityChart({ days }: Props) {
  if (!days.length) return null
  const max = Math.max(1, ...days.map((d) => d.count))
  const W = 600
  const H = 90
  const PAD = 8
  const innerW = W - PAD * 2
  const innerH = H - PAD * 2
  const stepX = innerW / Math.max(1, days.length - 1)

  const points = days.map((d, i) => {
    const x = PAD + i * stepX
    const y = PAD + innerH - (d.count / max) * innerH
    return [x, y, d] as const
  })

  // Path for line
  const path = points.map(([x, y], i) => (i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`)).join(' ')

  // Area path
  const area = `${path} L${(PAD + (days.length - 1) * stepX).toFixed(1)},${PAD + innerH} L${PAD},${PAD + innerH} Z`

  const total = days.reduce((s, d) => s + d.count, 0)

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[12px] text-[var(--color-ink-muted)]">آخر ٣٠ يوماً</span>
        <span className="text-[12px] font-mono tabular-nums text-[var(--color-ink)] font-bold">
          {total} تعديلاً
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" aria-label="نشاط آخر ٣٠ يوماً">
        <defs>
          <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--color-primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#actGrad)" />
        <path d={path} fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map(([x, y, d]) => d.count > 0 && (
          <g key={d.date}>
            <circle cx={x} cy={y} r="2.5" fill="var(--color-primary)" />
            <title>{d.date} — {d.count} تعديلاً</title>
          </g>
        ))}
      </svg>
    </div>
  )
}
