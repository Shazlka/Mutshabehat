const ITEMS = [
  { key: 'shared',   label: 'مشترك'    },
  { key: 'diff',     label: 'اختلاف'   },
  { key: 'diff2',    label: 'اختلاف ٢' },
  { key: 'diff3',    label: 'اختلاف ٣' },
  { key: 'addition', label: 'زيادة'    },
  { key: 'unique',   label: 'فريد'     },
]

export default function ColorLegend() {
  return (
    <aside aria-label="دليل ألوان أنواع النصوص"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 mb-6 bg-[var(--color-surface)] border border-[var(--color-border-soft)] rounded-xl animate-fade-rise">
      <span className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase shrink-0 font-bold">
        الألوان
      </span>
      <span className="hidden sm:block w-px h-3 bg-[var(--color-border)]" aria-hidden="true" />
      {ITEMS.map((it) => (
        <span key={it.key}
              className="inline-flex items-center text-[12px] font-bold text-[var(--color-ink-soft)]">
          <span className={`legend-dot legend-dot-${it.key}`} aria-hidden="true" />
          {it.label}
        </span>
      ))}
    </aside>
  )
}
