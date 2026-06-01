import Link from 'next/link'
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
  const plainText = buildPlainText(group)
  return (
    <article
      style={{ ['--i' as keyof React.CSSProperties]: String(index % 12) } as React.CSSProperties}
      className="group/row -mx-4 px-4 py-6 rounded-xl animate-fade-rise transition-all duration-200 hover:bg-[var(--color-surface)] hover:shadow-[0_2px_24px_-12px_oklch(0.30_0.10_265/0.20)] motion-safe:hover:-translate-y-0.5 will-change-transform"
      aria-labelledby={`group-${group.id}-title`}>

      {/* Title row */}
      <header className="flex items-baseline justify-between gap-4 mb-4">
        <div className="flex items-baseline gap-3 min-w-0">
          {/* Per-group color dot — uses the color stored in DB */}
          {group.color && (
            <span aria-hidden="true"
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ring-2 ring-offset-2 ring-offset-transparent transition-all duration-200 group-hover/row:scale-125"
                  style={{ background: group.color, boxShadow: `0 0 0 0 ${group.color}40` }} />
          )}
          <span aria-hidden="true"
                className="text-[11px] font-mono text-[var(--color-ink-muted)] tabular-nums shrink-0 mt-0.5">
            {String(index).padStart(3, '0')}
          </span>
          <h2 id={`group-${group.id}-title`}
              className="text-[18px] font-bold text-[var(--color-ink)] truncate leading-tight">
            <Link href={`/groups/${group.id}`} className="hover:text-[var(--color-primary)] transition-colors">
              {group.title}
            </Link>
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <GroupActions
            id={group.id}
            favorite={group.favorite}
            completed={group.completed}
            locked={group.status === 'locked'}
            groupText={plainText} />
          <Link href={`/groups/${group.id}/edit`}
            aria-label={`تعديل المجموعة ${group.title}`}
            className="text-[12px] font-bold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] opacity-0 group-hover/row:opacity-100 motion-safe:translate-x-1 group-hover/row:translate-x-0 transition-all duration-200 tap-shrink">
            تعديل ←
          </Link>
        </div>
      </header>

      {/* Verses */}
      <ol className="space-y-4" aria-label="الآيات">
        {group.verses.map((v) => (
          <li key={v.id} className="flex items-start gap-5">
            <div className="shrink-0 w-24 pt-0.5">
              <div className="text-[13px] font-bold text-[var(--color-primary)] leading-tight">
                {v.surah}
              </div>
              <div className="text-[11px] text-[var(--color-ink-soft)] mt-1 font-bold">
                آية {ayahToArabic(v.ayah)}
              </div>
              {v.label && (
                <div className="text-[11px] text-[var(--color-ink-muted)] mt-1.5 leading-snug">
                  {v.label}
                </div>
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
