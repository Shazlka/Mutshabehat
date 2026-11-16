'use client'

import { useState, useOptimistic, useTransition, type KeyboardEvent, type MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ArabicDiff from './ArabicDiff'
import type { GroupRowData } from './GroupRow'
import type { GroupWithVerses } from '@/types'
import { ayahToArabic } from '@/lib/arabic'
import { cn } from '@/lib/cn'
import {
  buildMagazineBlocks,
  getMagazineColor,
  type MagazineBlock,
  type MagazineCardSize,
} from '@/lib/magazine-layout'

export type MagazineGroup = GroupRowData | GroupWithVerses

/**
 * All user-visible strings localized in Arabic for Mutshabehat Magazine feed.
 * Strictly centralized per parity constraints.
 */
const STRINGS = {
  magazineBadge: 'عرض مجلّاتي',
  magazineCount: (count: number) => `${count} مجموعة في عرض المجلة`,
  locations: (count: number) => `${ayahToArabic(count)} مواضع`,
  otherLocations: (count: number) => `+ ${ayahToArabic(count)} مواضع أخرى`,
  edit: 'تعديل',
  editGroupAria: (title: string) => `تعديل المجموعة ${title}`,
  openGroup: 'فتح المجموعة',
  viewFullDetails: 'عرض كامل التفاصيل',
  addToFavorites: 'إضافة إلى المفضلة',
  removeFromFavorites: 'إزالة من المفضلة',
  showVerses: 'اضغط لعرض الآيات',
  hideVerses: 'إخفاء الآيات',
  flipHint: 'اضغط للقلب والمعاينة',
  flipBack: 'رجوع للبطاقة',
  emptyTitle: 'لا توجد مجموعات تطابق البحث',
  emptySubtitle: 'جرّب تغيير المرشّحات أو البحث.',
} as const

interface FeedProps {
  groups: MagazineGroup[]
  startIndex: number
}

interface CardProps {
  group: MagazineGroup
  size: MagazineCardSize
  index: number
}

function MobileMagazineCard({ group, size, index }: CardProps) {
  const router = useRouter()
  const [flipped, setFlipped] = useState(false)
  const [optimisticFav, setOptimisticFav] = useOptimistic(group.favorite, (_current: boolean, update: boolean) => update)
  const [isPending, startTransition] = useTransition()

  const groupColor = getMagazineColor(group.id, group.color)
  const surahs = Array.from(new Set((group.verses || []).map((v) => v.surah)))
  const firstVerse = group.verses?.[0]
  const firstVerseParts = firstVerse?.parts ?? []
  const hasDiffData = firstVerseParts.length > 0
  const isHero = size === 'hero'

  function onToggleFavorite(e: MouseEvent) {
    e.stopPropagation()
    startTransition(async () => {
      setOptimisticFav(!optimisticFav)
      await fetch(`/api/groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: !optimisticFav }),
      })
      router.refresh()
    })
  }

  function onFlip(e: MouseEvent | KeyboardEvent) {
    if (!hasDiffData) return
    e.stopPropagation()
    setFlipped((f) => !f)
  }

  function onKeyDownFlip(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onFlip(e)
    }
  }

  function onCardClick() {
    router.push(`/groups/${group.id}`)
  }

  const surfaceBg = `color-mix(in srgb, ${groupColor} 8%, var(--color-surface, #ffffff))`
  const surfaceBorder = `color-mix(in srgb, ${groupColor} 30%, var(--color-border-soft, #e2e8f0))`
  const tagBg = `color-mix(in srgb, ${groupColor} 12%, transparent)`
  const tagBorder = `color-mix(in srgb, ${groupColor} 26%, transparent)`

  return (
    <article
      dir="rtl"
      className="mobile-flip-scene w-full"
      style={{ '--i': String(index % 12) } as React.CSSProperties}
    >
      <div className={cn('mobile-flip-card', flipped && 'is-flipped')}>
        {/* FRONT FACE */}
        <div
          onClick={onCardClick}
          style={{ backgroundColor: surfaceBg, borderColor: surfaceBorder }}
          className={cn(
            'mobile-flip-face mobile-flip-front flex flex-col justify-between rounded-[14px] border cursor-pointer select-none text-right transition-shadow duration-200',
            'hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.15)]',
            isHero ? 'p-3.5 min-h-[170px]' : 'p-3 min-h-[160px]'
          )}
        >
          {/* Header Row: Surahs + Count + Star */}
          <header className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {surahs.length > 0 && (
                <span
                  style={{ color: groupColor }}
                  className={cn(
                    'font-bold truncate',
                    isHero ? 'text-[13px]' : 'text-[11px]'
                  )}
                >
                  {surahs.join(' • ')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-[var(--color-ink-muted)] bg-[var(--color-surface-2)] tabular-nums">
                {STRINGS.locations(group.verses.length)}
              </span>

              <button
                type="button"
                onClick={onToggleFavorite}
                disabled={isPending}
                aria-label={optimisticFav ? STRINGS.removeFromFavorites : STRINGS.addToFavorites}
                aria-pressed={optimisticFav}
                className="min-w-[44px] min-h-[44px] -my-2.5 -ml-2 inline-flex items-center justify-center rounded-lg tap-shrink transition-colors"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill={optimisticFav ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    color: optimisticFav ? 'var(--app-favorite, #8F6A00)' : 'var(--color-ink-muted)',
                  }}
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            </div>
          </header>

          {/* Title */}
          <Link
            href={`/groups/${group.id}`}
            onClick={(e) => e.stopPropagation()}
            className="block mt-2 focus-visible:outline-none focus-visible:underline"
          >
            <h2
              className={cn(
                'font-bold text-[var(--color-ink)] leading-snug break-words',
                isHero ? 'text-[17px] line-clamp-3' : 'text-[14px] line-clamp-2'
              )}
            >
              {group.title}
            </h2>
          </Link>

          {/* Color-coded Verse Tag Chips */}
          {group.verses.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {group.verses.slice(0, isHero ? 3 : 2).map((v) => (
                <span
                  key={v.id}
                  style={{
                    backgroundColor: tagBg,
                    borderColor: tagBorder,
                    color: groupColor,
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border"
                >
                  <span>{v.surah}</span>
                  <span className="font-mono tabular-nums opacity-85">{ayahToArabic(v.ayah)}</span>
                </span>
              ))}
              {group.verses.length > (isHero ? 3 : 2) && (
                <span className="text-[10px] font-semibold text-[var(--color-ink-muted)]">
                  {STRINGS.otherLocations(group.verses.length - (isHero ? 3 : 2))}
                </span>
              )}
            </div>
          )}

          {/* Verse Preview Area / Flip Trigger */}
          {hasDiffData && (
            <div
              role="button"
              tabIndex={0}
              aria-label={flipped ? STRINGS.hideVerses : STRINGS.showVerses}
              onClick={onFlip}
              onKeyDown={onKeyDownFlip}
              className={cn(
                'cursor-pointer select-none mt-2 p-2 rounded-lg border border-transparent transition-colors',
                'hover:bg-black/5 dark:hover:bg-white/5 focus-visible:border-[var(--color-primary)]'
              )}
            >
              <div
                className={cn(
                  'overflow-hidden [mask-image:linear-gradient(to_bottom,black_65%,transparent)]',
                  isHero ? 'max-h-[64px]' : 'max-h-[44px]'
                )}
              >
                <ArabicDiff parts={firstVerseParts} size="sm" />
              </div>
              <div
                className="flex items-center justify-between mt-1 text-[10px] font-bold"
                style={{ color: groupColor }}
              >
                <span>{STRINGS.flipHint}</span>
                <span aria-hidden="true">↺</span>
              </div>
            </div>
          )}

          {/* Footer: Edit Shortcut + Forward Chevron */}
          <footer className="mt-3 pt-2.5 flex items-center justify-between border-t border-black/5 dark:border-white/5">
            <Link
              href={`/groups/${group.id}/edit`}
              onClick={(e) => e.stopPropagation()}
              aria-label={STRINGS.editGroupAria(group.title)}
              className="inline-flex items-center min-h-[44px] -my-2 px-1 text-[12px] font-bold text-[var(--color-primary)] hover:underline tap-shrink"
            >
              {STRINGS.edit} ←
            </Link>

            <Link
              href={`/groups/${group.id}`}
              onClick={(e) => e.stopPropagation()}
              aria-label={STRINGS.viewFullDetails}
              className="inline-flex items-center gap-1 min-h-[44px] -my-2 px-1 text-[11px] font-semibold text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ color: groupColor }}
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
          </footer>
        </div>

        {/* BACK FACE (Flipped to show first verse text / diff preview) */}
        <div
          style={{ backgroundColor: surfaceBg, borderColor: surfaceBorder }}
          className={cn(
            'mobile-flip-face mobile-flip-back flex flex-col justify-between rounded-[14px] border p-3.5 text-right'
          )}
        >
          {/* Back Header */}
          <header className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: groupColor }}>
              <span>{firstVerse?.surah}</span>
              {firstVerse && (
                <span className="font-mono tabular-nums opacity-85">
                  ({ayahToArabic(firstVerse.ayah)})
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onFlip}
              aria-label={STRINGS.flipBack}
              className="min-w-[44px] min-h-[44px] -my-2 -ml-2 inline-flex items-center justify-center rounded-lg text-[12px] font-bold text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] tap-shrink"
            >
              <span>{STRINGS.flipBack}</span>
              <span className="mr-1 text-[14px]" aria-hidden="true">↺</span>
            </button>
          </header>

          {/* Back Content: Diff */}
          <div className="my-3 overflow-y-auto max-h-[160px] text-right">
            <ArabicDiff parts={firstVerseParts} size={isHero ? 'md' : 'sm'} />
            {firstVerse?.label && (
              <p className="mt-2 text-[11px] font-medium text-[var(--color-ink-muted)]">
                {firstVerse.label}
              </p>
            )}
          </div>

          {/* Back Actions */}
          <footer className="pt-2 flex items-center gap-2 border-t border-black/5 dark:border-white/5">
            <Link
              href={`/groups/${group.id}`}
              className="flex-1 min-h-[44px] px-3 py-2 flex items-center justify-center text-center rounded-lg bg-[var(--color-primary)] text-[var(--color-paper)] text-[12px] font-bold tap-shrink transition-colors"
            >
              {STRINGS.openGroup}
            </Link>
            <Link
              href={`/groups/${group.id}/edit`}
              className="min-h-[44px] px-3 py-2 inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[12px] font-bold text-[var(--color-primary)] tap-shrink transition-colors"
            >
              {STRINGS.edit}
            </Link>
          </footer>
        </div>
      </div>
    </article>
  )
}

export default function MobileMagazineFeed({ groups, startIndex }: FeedProps) {
  if (groups.length === 0) {
    return (
      <div className="py-20 text-center bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)] px-4">
        <div className="w-12 h-12 rounded-full bg-[var(--color-primary-soft)] mx-auto mb-3 flex items-center justify-center text-[var(--color-primary)] text-xl font-bold">
          ∅
        </div>
        <p className="text-[15px] font-bold text-[var(--color-ink)]">{STRINGS.emptyTitle}</p>
        <p className="text-[12px] text-[var(--color-ink-muted)] mt-1.5">{STRINGS.emptySubtitle}</p>
      </div>
    )
  }

  const blocks: MagazineBlock<MagazineGroup>[] = buildMagazineBlocks(groups)

  return (
    <div className="space-y-3 pb-8" dir="rtl">
      {/* Editorial Feed Sub-Header matching iOS MutshabehatView */}
      <div className="flex items-center justify-between px-1 pt-1 pb-1">
        <span className="text-[12px] font-bold text-[var(--color-ink-muted)]">
          {STRINGS.magazineCount(groups.length)}
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-[var(--color-primary)] bg-[var(--color-primary-soft)]">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="9" />
            <rect x="14" y="3" width="7" height="5" />
            <rect x="14" y="12" width="7" height="9" />
            <rect x="3" y="16" width="7" height="5" />
          </svg>
          {STRINGS.magazineBadge}
        </span>
      </div>

      {/* Feed Blocks */}
      {blocks.map((block, blockIndex) => {
        if (block.type === 'hero' || block.type === 'single') {
          return (
            <div key={`block-${block.item.id}-${blockIndex}`} className="w-full">
              <MobileMagazineCard
                group={block.item}
                size="hero"
                index={startIndex + blockIndex}
              />
            </div>
          )
        }

        return (
          <div
            key={`pair-${block.first.id}-${block.second.id}-${blockIndex}`}
            className="grid grid-cols-2 gap-3 items-start"
          >
            <MobileMagazineCard
              group={block.first}
              size={block.firstSize}
              index={startIndex + blockIndex * 2}
            />
            <MobileMagazineCard
              group={block.second}
              size={block.secondSize}
              index={startIndex + blockIndex * 2 + 1}
            />
          </div>
        )
      })}
    </div>
  )
}
