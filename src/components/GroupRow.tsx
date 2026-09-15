'use client'

import { useState, type KeyboardEvent } from 'react'
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
  const [flipped, setFlipped] = useState(false)
  const plainText = buildPlainText(group)
  const surahNames = Array.from(new Set((group.verses || []).map((v) => v.surah)))

  function openGroup() {
    router.push(`/groups/${group.id}`)
  }

  function onMobileKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setFlipped((value) => !value)
    }
  }

  const titleRow = (titleId: string) => (
    <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1 md:flex-nowrap md:gap-x-4 mb-3 md:mb-4">
      {group.color && (
        <span aria-hidden="true"
              className="inline-block w-2 h-2 md:w-2.5 md:h-2.5 rounded-full shrink-0 mt-1.5 transition-all duration-200 group-hover/row:scale-125"
              style={{ background: group.color }} />
      )}
      <span aria-hidden="true"
            className="text-[10px] md:text-[11px] font-mono text-[var(--color-ink-muted)] tabular-nums shrink-0 mt-0.5">
        {String(index).padStart(3, '0')}
      </span>
      <div className="ml-auto flex items-center gap-1 md:gap-2 shrink-0 order-1 md:order-none" onClick={(e) => e.stopPropagation()}>
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
      <h2 id={titleId}
          className="w-full md:w-auto md:flex-1 md:min-w-0 order-last md:order-none
                     text-[15px] md:text-[18px] font-bold text-[var(--color-ink)]
                     md:truncate leading-tight break-words md:break-normal
                     group-hover/row:text-[var(--color-primary)] transition-colors">
        {group.title}
      </h2>
    </header>
  )

  const versesList = (
    <ol className="space-y-4 md:space-y-4" aria-label="الآيات">
      {group.verses.map((v) => (
        <li key={v.id} className="md:flex md:items-start md:gap-5">
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
  )

  return (
    <article
      style={{ ['--i' as keyof React.CSSProperties]: String(index % 12) } as React.CSSProperties}
      className="group/row -mx-2 md:-mx-4 animate-fade-rise"
      aria-labelledby={`group-${group.id}-title-desktop group-${group.id}-title-mobile`}>
      <div
        onClick={openGroup}
        className="hidden md:block px-4 py-6 rounded-xl transition-all duration-200 hover:bg-[var(--color-surface)] md:hover:shadow-[0_2px_24px_-12px_oklch(0.30_0.10_265/0.20)] motion-safe:md:hover:-translate-y-0.5 will-change-transform cursor-pointer">
        {titleRow(`group-${group.id}-title-desktop`)}
        {versesList}
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={`${group.title} - ${flipped ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}`}
        onClick={() => setFlipped((value) => !value)}
        onKeyDown={onMobileKeyDown}
        className="mobile-flip-scene md:hidden px-3 py-4 rounded-xl cursor-pointer select-none">
        <div className={`mobile-flip-card${flipped ? ' is-flipped' : ''}`}>
          <div className="mobile-flip-face mobile-flip-front rounded-xl">
            {titleRow(`group-${group.id}-title-mobile`)}
            {surahNames.length > 0 && (
              <div className="mt-2 text-[12.5px] font-bold text-[var(--color-primary)] select-none flex flex-wrap items-center leading-relaxed">
                <span className="text-[10px] text-[var(--color-ink-muted)] uppercase tracking-wider ml-1.5">السور:</span>
                {surahNames.map((name, i) => (
                  <span key={name} className="flex items-center">
                    {i > 0 && <span className="mx-2 text-[var(--color-border)] select-none">·</span>}
                    <span>{name}</span>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-[var(--color-ink-muted)]">
              <span>{group.verses.length} آية</span>
              <span className="font-bold text-[var(--color-primary)]">اضغط لعرض الآيات</span>
            </div>
          </div>
          <div className="mobile-flip-face mobile-flip-back rounded-xl">
            {versesList}
            <div className="mt-5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Link
                href={`/groups/${group.id}`}
                className="flex-1 text-center rounded-md bg-[var(--color-primary)] text-[var(--color-paper)] px-3 py-2 text-[12px] font-bold tap-shrink">
                فتح المجموعة
              </Link>
              <Link
                href={`/groups/${group.id}/edit`}
                className="px-3 py-2 rounded-md border border-[var(--color-border)] text-[12px] font-bold text-[var(--color-primary)] tap-shrink">
                تعديل
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
