'use client'

import { MemorizationStatus } from '../../../packages/memorization-core/types'

export interface MemorizationMixBarProps {
  fractions: Readonly<Record<MemorizationStatus, number>>
  height?: number
  className?: string
  accessibilityLabel?: string
}

const STATUS_ORDER: readonly MemorizationStatus[] = [
  MemorizationStatus.mastered,
  MemorizationStatus.memorizedWithErrors,
  MemorizationStatus.needsMushaf,
  MemorizationStatus.notMemorized,
]

const STATUS_COLOR_VAR: Readonly<Record<MemorizationStatus, string>> = {
  [MemorizationStatus.mastered]: 'var(--memo-mastered)',
  [MemorizationStatus.memorizedWithErrors]: 'var(--memo-with-errors)',
  [MemorizationStatus.needsMushaf]: 'var(--memo-needs-mushaf)',
  [MemorizationStatus.notMemorized]: 'var(--memo-not-memorized)',
}

/**
 * A segmented bar showing how ayat split across the four statuses
 * ordered from mastered to not memorized (mirrors iOS MemorizationMixBar.swift).
 */
export function MemorizationMixBar({
  fractions,
  height = 4,
  className = '',
  accessibilityLabel,
}: MemorizationMixBarProps) {
  return (
    <div
      role="progressbar"
      aria-label={accessibilityLabel ?? 'توزيع حالات الحفظ'}
      aria-hidden={!accessibilityLabel}
      className={`flex w-full overflow-hidden rounded-full ${className}`}
      style={{ height }}
    >
      {STATUS_ORDER.map((status) => {
        const share = Math.max(0, fractions[status] ?? 0)
        if (share <= 0) return null
        return (
          <div
            key={status}
            style={{
              width: `${(share * 100).toFixed(2)}%`,
              backgroundColor: STATUS_COLOR_VAR[status],
              opacity: status === MemorizationStatus.notMemorized ? 0.35 : 0.9,
            }}
            className="h-full transition-all duration-300"
          />
        )
      })}
    </div>
  )
}
