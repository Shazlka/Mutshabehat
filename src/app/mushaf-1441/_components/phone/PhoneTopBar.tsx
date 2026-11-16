'use client'

import type { Mushaf1441PageMetadata } from '../../../../../packages/quran-data/mushaf1441/pageMetadata'

export function PhoneTopBar(props: {
  metadata: Mushaf1441PageMetadata | null
  pageNumber: number
  qiraatEnabled: boolean
  filterName?: string
  filterColor?: string
  surahPickerOpen: boolean
  onOpenSurahPicker: () => void
  onOpenReaderPicker: () => void
}) {
  const { metadata } = props
  const rubQuarter = metadata ? ((metadata.rubInJuz - 1) % 4) + 1 : null
  const rubDisc = rubQuarter ? ['◔', '◑', '◕', '●'][rubQuarter - 1] : '○'
  return (
    <header className="mushaf-reader-header hidden h-[52px] shrink-0 items-center gap-2 border-b px-3 text-[var(--mushaf-ink)] max-md:flex md:hidden" aria-label="معلومات الصفحة">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-base font-black tabular-nums" aria-label={`صفحة ${props.pageNumber}`}>صفحة {props.pageNumber}</span>
        <button
          type="button"
          onClick={props.onOpenSurahPicker}
          aria-haspopup="dialog"
          aria-expanded={props.surahPickerOpen}
          className="min-h-11 min-w-0 truncate rounded-lg px-1 text-sm font-black text-[var(--mushaf-ink)]"
        >
          {metadata?.surahNames.join(' · ') ?? 'مصحف المدينة'}
        </button>
      </div>
      {props.qiraatEnabled && props.filterName && props.filterColor ? (
        <button
          type="button"
          onClick={props.onOpenReaderPicker}
          aria-label={`القراءات العشر: ${props.filterName}`}
          className="min-h-11 max-w-[7.5rem] shrink-0 truncate rounded-full border px-2.5 text-xs font-bold text-[var(--mushaf-ink)]"
          style={{ borderColor: props.filterColor, background: `color-mix(in srgb, ${props.filterColor} 18%, var(--qiraat-card-fill))` }}
        >
          {props.filterName}
        </button>
      ) : null}
      <div className="shrink-0 text-[11px] font-semibold leading-4 text-[var(--mushaf-brown)]" aria-label={`الجزء ${metadata?.juzNumber ?? '—'}، الحزب ${metadata?.hizbNumber ?? '—'}، الربع ${rubQuarter ?? '—'}`}>
        <span className="block">ج {metadata?.juzNumber ?? '—'}</span>
        <span className="flex items-center gap-1"><span aria-hidden="true" className="text-sm text-[var(--mushaf-gold)]">{rubDisc}</span> ح {metadata?.hizbNumber ?? '—'}</span>
      </div>
    </header>
  )
}
