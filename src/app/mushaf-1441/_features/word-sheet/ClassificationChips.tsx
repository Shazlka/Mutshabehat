import type { ClassificationSegment } from '../../../../../packages/qiraat-core/features/classification'

/** «فرش الحروف › تشكيل» / «أصول القراءات › الممال والمقلل › إمالة» as RTL chips; the باب keeps its family colour. */
export function ClassificationChips({ segments }: { segments: ClassificationSegment[] }) {
  return (
    <p data-testid="classification" className="mb-1.5 flex flex-wrap items-center gap-1 text-[11px] font-bold text-[var(--mushaf-muted)]">
      {segments.map((segment, index) => (
        <span key={`${segment.kind}-${segment.label}`} className="flex items-center gap-1">
          {index > 0 ? <span aria-hidden="true">›</span> : null}
          <span style={segment.color ? { color: segment.color } : undefined}>{segment.label}</span>
        </span>
      ))}
    </p>
  )
}
