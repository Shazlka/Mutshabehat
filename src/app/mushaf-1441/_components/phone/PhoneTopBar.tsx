'use client'

import type { Mushaf1441PageMetadata } from '../../../../../packages/quran-data/mushaf1441/pageMetadata'

export function PhoneTopBar(props: {
  metadata: Mushaf1441PageMetadata | null
  pageNumber: number
  qiraatEnabled: boolean
  filterName?: string
  filterColor?: string
  surahPickerOpen?: boolean
  onOpenSurahPicker: () => void
  onOpenReaderPicker: () => void
}) {
  const { metadata } = props
  const rubQuarter = metadata ? ((metadata.rubInJuz - 1) % 4) + 1 : null
  const rubDisc = rubQuarter ? ['◔', '◑', '◕', '●'][rubQuarter - 1] : '○'
  return (
    <header
      className="mushaf-reader-header hidden h-[52px] shrink-0 items-center justify-between gap-1.5 border-b-[0.5px] border-[var(--mushaf-rule-soft)] bg-[var(--mushaf-desk)] px-2.5 text-[var(--mushaf-ink)] max-md:flex md:hidden"
      aria-label="معلومات الصفحة"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <button
          type="button"
          onClick={props.onOpenSurahPicker}
          aria-haspopup="dialog"
          aria-expanded={props.surahPickerOpen}
          className="min-h-11 min-w-0 truncate rounded-lg text-start text-xs font-black text-[var(--mushaf-ink)] sm:text-sm"
        >
          {metadata?.surahNames.join(' · ') ?? 'مصحف المدينة'}
        </button>
        <span
          className="shrink-0 text-xs font-bold tabular-nums text-[var(--mushaf-brown)] sm:text-sm"
          aria-label={`صفحة ${props.pageNumber}`}
        >
          صفحة {props.pageNumber}
        </span>
      </div>
      {props.qiraatEnabled && props.filterName && props.filterColor ? (
        <button
          type="button"
          onClick={props.onOpenReaderPicker}
          aria-label={`القراءات العشر: ${props.filterName}`}
          className="min-h-11 max-w-[5.5rem] shrink-0 truncate rounded-full border px-2 py-0.5 text-[11px] font-bold text-[var(--mushaf-ink)]"
          style={{
            borderColor: props.filterColor,
            background: `color-mix(in srgb, ${props.filterColor} 18%, var(--qiraat-card-fill))`,
          }}
        >
          {props.filterName}
        </button>
      ) : null}
      <div
        className="shrink-0 text-end text-[10px] font-semibold leading-3.5 text-[var(--mushaf-brown)] sm:text-[11px] sm:leading-4"
        aria-label={`الجزء ${metadata?.juzNumber ?? '—'}، الحزب ${metadata?.hizbNumber ?? '—'}، الربع ${rubQuarter ?? '—'}`}
      >
        <span className="block">ج {metadata?.juzNumber ?? '—'}</span>
        <span className="flex items-center justify-end gap-1">
          <span aria-hidden="true" className="text-xs text-[var(--mushaf-gold)]">{rubDisc}</span>
          <span>ح {metadata?.hizbNumber ?? '—'}</span>
        </span>
      </div>
    </header>
  )
}
