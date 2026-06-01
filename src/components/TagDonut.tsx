interface Slice { id: string; name: string; color: string | null; count: number }

interface Props { slices: Slice[]; total: number }

// Simple SVG donut — no library. Strokes a circle with dasharray segments.
export default function TagDonut({ slices, total }: Props) {
  if (!total) {
    return (
      <div className="text-[12px] text-[var(--color-ink-muted)] py-8 text-center">
        لا توجد وسوم بعد.
      </div>
    )
  }
  const R = 56
  const C = 2 * Math.PI * R
  let cursor = 0

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="توزيع الوسوم">
        <circle cx="70" cy="70" r={R} fill="none"
                stroke="var(--color-surface-2)" strokeWidth="16" />
        {slices.map((s) => {
          const len = (s.count / total) * C
          const seg = (
            <circle key={s.id}
              cx="70" cy="70" r={R} fill="none"
              stroke={s.color ?? 'var(--color-primary)'}
              strokeWidth="16"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-cursor}
              transform="rotate(-90 70 70)" />
          )
          cursor += len
          return seg
        })}
        <text x="70" y="68" textAnchor="middle"
              className="fill-[var(--color-ink)] font-bold tabular-nums" fontSize="22">
          {total}
        </text>
        <text x="70" y="86" textAnchor="middle"
              className="fill-[var(--color-ink-muted)]" fontSize="9">
          USES
        </text>
      </svg>
      <ul className="space-y-1.5 flex-1 min-w-[160px]">
        {slices.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-[12px]">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: s.color ?? 'var(--color-primary)' }} aria-hidden="true" />
            <span className="flex-1 text-[var(--color-ink-soft)] truncate">{s.name}</span>
            <span className="text-[var(--color-ink-muted)] font-mono tabular-nums">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
