// Small reader-colored name chips for a `describeNarratorGroup(...)` result — a compact,
// always-visible replacement for a hover-only `title` tooltip. Reused by ReviewEditorPane.tsx and
// MobileReviewEditorView.tsx wherever recorded/matched narrator names are shown.

import type { NarratorDisplayItem } from './narratorDisplay'

export function NarratorBadges({ items, className }: { items: NarratorDisplayItem[]; className?: string }) {
  if (items.length === 0) return null
  return (
    <span className={`inline-flex flex-wrap items-center gap-0.5 ${className ?? ''}`}>
      {items.map((item) => (
        <span
          key={item.key}
          className="inline-flex items-center rounded px-1 py-[1px] text-[9px] font-bold leading-tight"
          style={{
            color: item.color,
            borderColor: `${item.color}55`,
            background: `color-mix(in srgb, ${item.color} 18%, transparent)`,
            border: '1px solid',
          }}
        >
          {item.label}
        </span>
      ))}
    </span>
  )
}
