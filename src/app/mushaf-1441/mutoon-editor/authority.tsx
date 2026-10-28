import { QIRAAT_MULTI_READER_COLOR, readerColor, narratorColor } from '../../../../packages/qiraat-core/colors'
import type { ReaderId, NarratorId } from '../../../../packages/qiraat-core/types'
import { AUTHORITIES } from './data'

export function authorityColor(id: string): string {
  return id.includes('-') ? narratorColor(id as NarratorId) : readerColor(id as ReaderId)
}
export function previewColor(ids: string[]): string {
  return ids.length === 1 ? authorityColor(ids[0]) : QIRAAT_MULTI_READER_COLOR
}
export function authorityLabel(id: string): string {
  return AUTHORITIES.find(a => a.id === id)?.name ?? id
}
export function describeAuthorities(ids: string[]): string {
  return ids.map(authorityLabel).join('، ')
}

/** A reader or narrator as text plus its canonical color (the color is never the only signal). */
export function AuthorityPill({ id, size = 'md' }: { id: string; size?: 'sm' | 'md' }) {
  const color = authorityColor(id)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border bg-[var(--color-surface)] font-bold ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
      style={{ borderColor: `color-mix(in oklab, ${color} 45%, transparent)`, color: `color-mix(in oklab, ${color} 70%, black)` }}>
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {authorityLabel(id)}
    </span>
  )
}
