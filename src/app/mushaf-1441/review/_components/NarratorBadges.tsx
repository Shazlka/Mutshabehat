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
          className="inline-flex items-center rounded px-1 py-[1px] text-[11px] font-bold leading-tight text-white shadow-xs"
          style={{ background: item.color }}
        >
          {item.label}
        </span>
      ))}
    </span>
  )
}
