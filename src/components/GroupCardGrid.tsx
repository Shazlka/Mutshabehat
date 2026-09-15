'use client'

// Wide-screen card views for the personal groups list (desktop / iPad landscape):
//  - collapsed: equal cards showing only the title and surahs; click to expand the ayat in place
//  - magazine:  an editorial mosaic of unequal cards that packs densely to fill the page width

import { useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ArabicDiff from './ArabicDiff'
import GroupActions from './GroupActions'
import type { GroupRowData } from './GroupRow'
import { ayahToArabic } from '@/lib/arabic'
import { cn } from '@/lib/cn'

type Props = { mode: 'collapsed' | 'magazine'; groups: GroupRowData[]; startIndex: number }

type Size = 'hero' | 'tall' | 'wide' | 'regular' | 'short'

const SIZE_CLASS: Record<Size, string> = {
  hero: 'col-span-2 row-span-5',
  tall: 'col-span-1 row-span-4',
  wide: 'col-span-2 row-span-3',
  regular: 'col-span-1 row-span-3',
  short: 'col-span-1 row-span-2',
}

const TITLE_CLASS: Record<Size, string> = {
  hero: 'text-[26px] leading-[1.25]',
  tall: 'text-[18px] leading-snug',
  wide: 'text-[20px] leading-snug',
  regular: 'text-[16px] leading-snug',
  short: 'text-[16px] leading-snug',
}

function plainText(group: GroupRowData) {
  return [group.title, '', ...group.verses.flatMap((v) => [
    `${v.surah} — آية ${v.ayah}${v.label ? ` (${v.label})` : ''}`,
    v.parts.map((p) => p.text).join(' ').replace(/\s+/g, ' ').trim(),
    '',
  ])].join('\n').trim()
}

function surahNames(group: GroupRowData) {
  return [...new Set(group.verses.map((v) => v.surah))]
}

// Stable pseudo-random number per group so the mosaic doesn't reshuffle on every render.
function hashId(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return (h >>> 0) % 100
}

// Longer groups lean toward bigger tiles, but the hash keeps the mix varied: few heroes,
// a spread of tall / wide / regular, and short tiles for brief groups.
function magazineSize(group: GroupRowData, position: number): Size {
  const chars = group.verses.reduce((sum, v) => sum + v.parts.reduce((s, p) => s + p.text.length, 0), 0)
  const h = hashId(group.id)
  if (position % 12 === 0 || (chars > 900 && h < 10)) return 'hero'
  if (chars > 400) return h < 40 ? 'tall' : h < 65 ? 'wide' : 'regular'
  if (chars < 160) return h < 60 ? 'short' : 'regular'
  return h < 20 ? 'wide' : h < 45 ? 'tall' : h < 70 ? 'regular' : 'short'
}

function stop(event: MouseEvent) {
  event.stopPropagation()
}

function Actions({ group }: { group: GroupRowData }) {
  return (
    <div className="flex items-center gap-1 shrink-0" onClick={stop}>
      <GroupActions
        id={group.id}
        favorite={group.favorite}
        completed={group.completed}
        locked={group.status === 'locked'}
        groupText={plainText(group)} />
    </div>
  )
}

function Verses({ group }: { group: GroupRowData }) {
  return (
    <ol className="space-y-3" aria-label="الآيات">
      {group.verses.map((v) => (
        <li key={v.id}>
          <p className="text-[11px] font-bold text-[var(--color-primary)]">
            {v.surah} <span className="font-mono tabular-nums text-[var(--color-ink-muted)]">{ayahToArabic(v.ayah)}</span>
            {v.label ? <span className="font-normal text-[var(--color-ink-muted)]"> · {v.label}</span> : null}
          </p>
          <ArabicDiff parts={v.parts} size="sm" />
        </li>
      ))}
    </ol>
  )
}

function CollapsedCard({ group, index }: { group: GroupRowData; index: number }) {
  const [open, setOpen] = useState(false)
  const surahs = surahNames(group)
  const toggle = () => setOpen((value) => !value)
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle()
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={toggle}
      onKeyDown={onKeyDown}
      style={{ '--i': String(index % 12) } as CSSProperties}
      className={cn(
        'group/card flex flex-col min-h-[150px] p-4 rounded-2xl border bg-[var(--color-surface)] cursor-pointer text-right animate-fade-rise transition-[border-color,box-shadow] duration-200',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-primary-soft)]',
        open
          ? 'col-span-full border-[var(--color-primary)] shadow-[0_12px_40px_-24px_oklch(0.30_0.10_265/0.45)]'
          : 'border-[var(--color-border-soft)] hover:border-[var(--color-primary-tint)] hover:shadow-[0_8px_30px_-20px_oklch(0.30_0.10_265/0.35)]',
      )}>
      <header className="flex items-center gap-2">
        {group.color ? <span aria-hidden="true" className="size-2.5 rounded-full shrink-0" style={{ background: group.color }} /> : null}
        <span className="text-[11px] font-mono tabular-nums text-[var(--color-ink-muted)]">{String(index).padStart(3, '0')}</span>
        <span className="mr-auto" />
        <Actions group={group} />
      </header>
      <h2 className={cn('mt-2 text-[16px] font-bold leading-snug text-[var(--color-ink)] group-hover/card:text-[var(--color-primary)] transition-colors', !open && 'line-clamp-2')}>
        {group.title}
      </h2>
      <p className="mt-2 text-[12px] font-bold text-[var(--color-primary)] line-clamp-1">{surahs.join(' · ')}</p>

      {open ? (
        <div className="mt-4 pt-4 border-t border-[var(--color-border-soft)] animate-fade-rise">
          <Verses group={group} />
          <div className="mt-4 flex items-center gap-2" onClick={stop}>
            <Link href={`/groups/${group.id}`}
              className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-[var(--color-paper)] text-[12px] font-bold hover:bg-[var(--color-primary-hover)] tap-shrink transition-colors">
              فتح المجموعة
            </Link>
            <Link href={`/groups/${group.id}/edit`}
              className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[12px] font-bold text-[var(--color-primary)] hover:border-[var(--color-primary)] tap-shrink transition-colors">
              تعديل
            </Link>
          </div>
        </div>
      ) : null}

      <footer className="mt-auto pt-3 flex items-center justify-between text-[11px] text-[var(--color-ink-muted)]">
        <span className="tabular-nums">{ayahToArabic(group.verses.length)} آية</span>
        <span aria-hidden="true" className={cn('text-[13px] transition-transform duration-200', open && 'rotate-180')}>⌄</span>
      </footer>
    </article>
  )
}

function MagazineCard({ group, index, size }: { group: GroupRowData; index: number; size: Size }) {
  const router = useRouter()
  const surahs = surahNames(group)
  const big = size === 'hero' || size === 'wide'

  return (
    <article
      onClick={() => router.push(`/groups/${group.id}`)}
      style={{ '--i': String(index % 12) } as CSSProperties}
      className={cn(
        SIZE_CLASS[size],
        'group/card relative flex flex-col min-h-0 overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] cursor-pointer animate-fade-rise',
        'transition-[border-color,box-shadow,translate] duration-200 hover:border-[var(--color-primary-tint)] hover:shadow-[0_14px_40px_-26px_oklch(0.30_0.10_265/0.5)] motion-safe:hover:-translate-y-0.5',
        size === 'hero' ? 'p-6' : 'p-4',
      )}>
      <header className="flex items-start gap-3">
        <span className={cn('font-mono tabular-nums leading-none text-[var(--color-ink-muted)]', size === 'hero' ? 'text-[34px]' : 'text-[20px]')}>
          {String(index).padStart(2, '0')}
        </span>
        {group.color ? <span aria-hidden="true" className="mt-1.5 size-2.5 rounded-full shrink-0" style={{ background: group.color }} /> : null}
        <span className="mr-auto" />
        <div className="opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 transition-opacity">
          <Actions group={group} />
        </div>
      </header>

      <h2 className={cn('mt-3 font-bold text-[var(--color-ink)] group-hover/card:text-[var(--color-primary)] transition-colors', TITLE_CLASS[size], size === 'short' ? 'line-clamp-2' : 'line-clamp-3')}>
        <Link href={`/groups/${group.id}`} onClick={stop} className="focus-visible:outline-none focus-visible:underline">
          {group.title}
        </Link>
      </h2>

      {size !== 'short' ? (
        <div className={cn('mt-3 min-h-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_bottom,black_72%,transparent)]', big && 'mt-4')}>
          <Verses group={group} />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <footer className="pt-3 flex items-center justify-between gap-3 text-[11px]">
        <span className="font-bold text-[var(--color-primary)] truncate">{surahs.join(' · ')}</span>
        <span className="shrink-0 tabular-nums text-[var(--color-ink-muted)]">{ayahToArabic(group.verses.length)} آية</span>
      </footer>
    </article>
  )
}

export default function GroupCardGrid({ mode, groups, startIndex }: Props) {
  if (mode === 'collapsed') {
    return (
      <div className="mt-4 grid grid-flow-dense items-start gap-3 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
        {groups.map((group, i) => (
          <CollapsedCard key={group.id} group={group} index={startIndex + i} />
        ))}
      </div>
    )
  }

  return (
    <div className="mt-4 grid grid-flow-dense grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 auto-rows-[92px] gap-3">
      {groups.map((group, i) => (
        <MagazineCard key={group.id} group={group} index={startIndex + i} size={magazineSize(group, startIndex + i - 1)} />
      ))}
    </div>
  )
}
