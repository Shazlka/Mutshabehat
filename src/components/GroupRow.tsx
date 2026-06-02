'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ArabicDiff, { type Part } from './ArabicDiff'
import { ayahToArabic } from '@/lib/arabic'
import GroupActions from './GroupActions'

export interface GroupRowData {
  id: string
  title: string
  color?: string | null
  status: 'draft' | 'published' | 'locked'
  favorite: boolean
  completed: boolean
  verses: Array<{
    id: string
    surah: string
    ayah: number
    label: string | null
    parts: Part[]
  }>
}

interface Props { group: GroupRowData; index: number }

function buildPlainText(g: GroupRowData): string {
  const lines: string[] = [g.title, '']
  for (const v of g.verses) {
    const surahLine = `${v.surah} — آية ${v.ayah}${v.label ? ` (${v.label})` : ''}`
    const verseText = v.parts.map((p) => p.text).join(' ').replace(/\s+/g, ' ').trim()
    lines.push(surahLine, verseText, '')
  }
  return lines.join('\n').trim()
}

export default function GroupRow({ group, index }: Props) {
  const router = useRouter()
  const plainText = buildPlainText(group)
  return (
    <article
      style={{ ['--i' as keyof React.CSSProperties]: String(index % 12) } as React.CSSProperties}
      onClick={() => router.push(`/groups/${group.id}`)}
      className="group/row -mx-2 md:-mx-4 px-3 md:px-4 py-4 md:py-6 rounded-xl animate-fade-rise transition-all duration-200 hover:bg-[var(--color-surface)] md:hover:shadow-[0_2px_24px_-12px_oklch(0.30_0.10_265/0.20)] motion-safe:md:hover:-translate-y-0.5 will-change-transform cursor-pointer"
      aria-labelledby={`group-${group.id}-title`}>

      {/* Title row */}
      <header className="flex items-baseline justify-between gap-3 md:gap-4 mb-3 md:mb-4">
        <div className="flex items-baseline gap-2 md:gap-3 min-w-0">
          {group.color && (
            <span aria-hidden="true"
                  className="inline-block w-2 h-2 md:w-2.5 md:h-2.5 rounded-full shrink-0 mt-1.5 transition-all duration-200 group-hover/row:scale-125"
                  style={{ background: group.color }} />
          )}
          <span aria-hidden="true"
                className="text-[10px] md:text-[11px] font-mono text-[var(--color-ink-muted)] tabular-nums shrink-0 mt-0.5">
            {String(index).padStart(3, '0')}
          </span>
          <h2 id={`group-${group.id}-title`}
              className="text-[15px] md:text-[18px] font-bold text-[var(--color-ink)] truncate leading-tight group-hover/row:text-[var(--color-primary)] transition-colors">
            {group.title}
          </h2>
        </div>
        <div className="flex items-center gap-1 md:gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <GroupActions
            id={group.id}
            favorite={group.favorite}
            completed={group.completed}
            locked={group.status === 'locked'}
            groupText={plainText} />
          <Link href={`/groups/${group.id}/edit`}
            aria-label={`تعديل المجموعة ${group.title}`}
            className="hidden md:inline text-[12px] font-bold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] opacity-0 group-hover/row:opacity-100 motion-safe:translate-x-1 group-hover/row:translate-x-0 transition-all duration-200 tap-shrink">
            تعديل ←
          </Link>
        </div>
      </header>

      {/* Verses */}
      <ol className="space-y-4 md:space-y-4" aria-label="الآيات">
        {group.verses.map((v) => (
          <li key={v.id} className="md:flex md:items-start md:gap-5">
            {/* Mobile: meta on top as inline strip. Desktop: meta in left column. */}
            <div className="md:shrink-0 md:w-24 md:pt-0.5
                            flex md:block items-baseline gap-2 mb-1.5 md:mb-0 flex-wrap">
              <span className="text-[12px] md:text-[13px] font-bold text-[var(--color-primary)] leading-tight">
                {v.surah}
              </span>
              <span className="text-[11px] md:text-[12px] font-mono tabular-nums text-[var(--color-ink-muted)] leading-tight font-bold md:mt-1">
                {ayahToArabic(v.ayah)}
              </span>
              {v.label && (
                <span className="text-[10px] md:text-[11px] text-[var(--color-ink-muted)] md:mt-1.5 leading-snug md:block">
                  {v.label}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <ArabicDiff parts={v.parts} size="md" />
            </div>
          </li>
        ))}
      </ol>
    </article>
  )
}
