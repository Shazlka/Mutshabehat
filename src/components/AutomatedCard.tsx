import Link from 'next/link'
import ArabicDiff, { type Part } from './ArabicDiff'
import { ayahToArabic } from '@/lib/arabic'

export interface AutomatedVerse {
  surah?: string; ayah?: number | string; label?: string
  parts?: { type: string; text: string }[]
}
export interface AutomatedRow {
  id: number; title: string; color: string; surahs: string[]
  payload: { note?: string; unote?: string; verses?: AutomatedVerse[] }
}

export function ayahNum(v: number | string | undefined): number {
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return 1
  const map = '٠١٢٣٤٥٦٧٨٩'
  const w = v.split('').map((c) => (map.indexOf(c) >= 0 ? String(map.indexOf(c)) : c)).join('')
  return parseInt(w, 10) || 1
}

interface Props {
  row: AutomatedRow
  preview?: number
  picked?: boolean
  onToggle?: (id: number) => void
}

// Automated candidate card: short preview in lists, opens /automated/[id] for all ayat.
export default function AutomatedCard({ row, preview = 2, picked = false, onToggle }: Props) {
  const all = row.payload?.verses ?? []
  const verses = all.slice(0, preview)
  const hidden = all.length - verses.length
  const href = `/automated/${row.id}`

  return (
    <li className="py-5 -mx-2 px-2 rounded-lg transition-colors hover:bg-[var(--color-surface)]">
      <div className="flex items-start gap-3">
        {onToggle && (
          <input type="checkbox" checked={picked} onChange={() => onToggle(row.id)}
            className="mt-1 w-4 h-4 accent-[var(--color-primary)] shrink-0"
            aria-label={`اختيار ${row.title}`} />
        )}
        <div className="flex-1 min-w-0">
          <Link href={href} className="flex items-baseline gap-2 mb-3 group">
            {row.color && (
              <span aria-hidden="true" className="inline-block w-2 h-2 rounded-full mt-1 shrink-0"
                    style={{ background: row.color }} />
            )}
            <h2 className="text-[15px] font-bold text-[var(--color-ink)] leading-snug group-hover:text-[var(--color-primary)] transition-colors">
              {row.title}
            </h2>
          </Link>
          <ol className="space-y-3">
            {verses.map((v, vi) => (
              <li key={vi} className="md:flex md:items-start md:gap-3">
                <div className="md:shrink-0 md:w-20 flex md:block items-baseline gap-2 mb-1 md:mb-0 flex-wrap">
                  <span className="text-[12px] font-bold text-[var(--color-primary)]">{v.surah ?? '—'}</span>
                  <span className="text-[11px] font-mono tabular-nums text-[var(--color-ink-muted)] font-bold leading-tight">{ayahToArabic(ayahNum(v.ayah))}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <ArabicDiff parts={(v.parts ?? []) as Part[]} size="sm" />
                </div>
              </li>
            ))}
          </ol>
          <Link href={href}
            className="inline-flex items-center gap-1.5 mt-3 md:mr-20 px-3 py-1.5 text-[12px] font-bold rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-paper)] tap-shrink transition-colors">
            {hidden > 0 ? `عرض كل الآيات (${all.length})` : 'عرض التفاصيل'}
            <span aria-hidden="true">←</span>
          </Link>
        </div>
      </div>
    </li>
  )
}
