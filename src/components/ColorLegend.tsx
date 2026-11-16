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
      className="flex items-center gap-x-3 sm:gap-x-5 gap-y-2 px-3 sm:px-4 py-2.5 sm:py-3 mb-4 sm:mb-6 bg-[var(--color-surface)] border border-[var(--color-border-soft)] rounded-xl animate-fade-rise overflow-x-auto whitespace-nowrap">
      <span className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase shrink-0 font-bold">
        الألوان
      </span>
      <span className="w-px h-3 bg-[var(--color-border)] shrink-0" aria-hidden="true" />
      {ITEMS.map((it) => (
        <span key={it.key} className={`part-${it.key} text-[12px] font-bold px-2 py-0.5 rounded shrink-0`}>
          {it.label}
        </span>
      ))}
    </aside>
  )
}
