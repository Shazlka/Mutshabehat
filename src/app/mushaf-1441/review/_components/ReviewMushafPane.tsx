'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ReviewPage, ReviewRow } from '../_lib/types'
import {
  STATUS_BG_VAR,
  STATUS_COLOR_VAR,
  worstStatus,
  type StatusFilter,
  type KindFilter,
  filterReviewRows,
} from './statusMeta'
import {
  getMushaf1441PageMetadata,
  getMushaf1441SurahOption,
  type Mushaf1441PageMetadata,
} from '../../../../../packages/quran-data/mushaf1441/pageMetadata'
import type {
  MushafLine,
  MushafLineDecoration,
  MushafPage,
  MushafWord,
} from '../../../../../packages/quran-data/mushaf1441/types'
import { cn } from '@/lib/cn'

export type WordMeta = {
  surah: number
  ayah: number
  word: number
  text: string
  page: number
}

type Props = {
  page: ReviewPage
  selectedWordKey: string | null
  selectedRow: ReviewRow | null
  hoveredRowId: string | null
  onSelectWord(key: string, wordMeta: WordMeta): void
  onHoverWord(rowIds: string[] | null): void
  isMobile?: boolean
  zoom?: number
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void
}

const BASMALA_TEXT = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'
const MUSHAF_PAGE_PRINT_PADDING_X = '7.2%'
const MUSHAF_PAGE_PRINT_PADDING_Y = '5.8%'
const MUSHAF_QCF_FONT_SIZE = '4.35cqw'
const MUSHAF_QCF_LINE_HEIGHT = 1.04

function getQcfV2FontFamily(pageNumber: number) {
  return `QCFV2-P${pageNumber}`
}

function getQcfV2FontUrl(pageNumber: number) {
  return `https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${pageNumber}.woff2`
}

export function canonicalKeyForWord(word: MushafWord): string {
  return `${String(word.surahNumber).padStart(3, '0')}:${String(word.ayahNumber).padStart(3, '0')}:${String(word.wordIndexInAyah).padStart(3, '0')}`
}

// In-memory cache for page words so page turns are instantaneous
const pageWordsCache = new Map<number, { pageData: MushafPage; metadata: Mushaf1441PageMetadata | null }>()

export default function ReviewMushafPane({
  page,
  selectedWordKey,
  selectedRow,
  hoveredRowId,
  onSelectWord,
  onHoverWord,
  isMobile = false,
  zoom = 1,
  scrollContainerRef,
  onScroll,
}: Props) {
  const pageNo = page.page
  const [mushafPage, setMushafPage] = useState<MushafPage | null>(() => pageWordsCache.get(pageNo)?.pageData ?? null)
  const [metadata, setMetadata] = useState<Mushaf1441PageMetadata | null>(() => pageWordsCache.get(pageNo)?.metadata ?? getMushaf1441PageMetadata(pageNo))
  const [fontLoaded, setFontLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(!mushafPage)

  // Load QCF Font
  useEffect(() => {
    let cancelled = false
    const fontFamily = getQcfV2FontFamily(pageNo)
    const fontUrl = getQcfV2FontUrl(pageNo)

    if (typeof document !== 'undefined' && typeof FontFace !== 'undefined') {
      const alreadyLoaded = [...document.fonts].some(
        (face) => face.family.replace(/"/g, '') === fontFamily && face.status === 'loaded'
      )
      if (alreadyLoaded) {
        setFontLoaded(true)
      } else {
        const fontFace = new FontFace(fontFamily, `url("${fontUrl}") format("woff2")`, { display: 'swap' })
        fontFace
          .load()
          .then(() => {
            if (!cancelled) {
              document.fonts.add(fontFace)
              setFontLoaded(true)
            }
          })
          .catch(() => {
            if (!cancelled) setFontLoaded(false)
          })
      }
    }

    return () => {
      cancelled = true
    }
  }, [pageNo])

  // Fetch full mushaf line tokens and decorations if not in cache
  useEffect(() => {
    let cancelled = false
    const cached = pageWordsCache.get(pageNo)
    if (cached) {
      setMushafPage(cached.pageData)
      setMetadata(cached.metadata)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    fetch(`/api/mushaf-1441/page-words?page=${pageNo}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load page words')
        return res.json()
      })
      .then((data: MushafPage & { metadata?: Mushaf1441PageMetadata }) => {
        if (!cancelled) {
          const meta = data.metadata ?? getMushaf1441PageMetadata(pageNo)
          pageWordsCache.set(pageNo, { pageData: data, metadata: meta })
          setMushafPage(data)
          setMetadata(meta)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to load page-words for review', err)
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [pageNo])

  // Build covering rows map for fast word lookup: key -> ReviewRow[]
  const wordRowsMap = useMemo(() => {
    const map = new Map<string, ReviewRow[]>()
    const rows = page.rows.filter((row) => !row.deleted)
    // Check all words present in page
    for (const word of page.words) {
      const covering = rows.filter((row) => row.startKey <= word.key && word.key <= row.endKey)
      if (covering.length) map.set(word.key, covering)
    }
    return map
  }, [page.rows, page.words])

  // Fallback lines from page.words if mushafPage not yet loaded
  const fallbackLines = useMemo(() => {
    const byLine = new Map<number, typeof page.words>()
    for (const word of page.words) {
      const list = byLine.get(word.line)
      if (list) list.push(word)
      else byLine.set(word.line, [word])
    }
    for (const list of byLine.values()) {
      list.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    }
    return [...byLine.entries()].sort((a, b) => a[0] - b[0])
  }, [page.words])

  const decorationsMap = useMemo(() => {
    const map = new Map<number, MushafLineDecoration>()
    if (mushafPage?.lineDecorations) {
      for (const [line, deco] of Object.entries(mushafPage.lineDecorations)) {
        map.set(Number(line), deco)
      }
    }
    return map
  }, [mushafPage])

  function renderSurahBanner(surahNumber: number) {
    const surahOpt = getMushaf1441SurahOption(surahNumber)
    const name = surahOpt?.name ?? `سورة ${surahNumber}`
    const ayahCount = surahOpt?.ayahCount ?? 0
    const gradientId = `surah-gold-${surahNumber}`
    const panelId = `surah-panel-${surahNumber}`
    const latticeId = `surah-lattice-${surahNumber}`

    const medallion = (cx: number, label: string) => (
      <g>
        <circle cx={cx} cy={50} r={33} fill="#fffdfa" stroke={`url(#${gradientId})`} strokeWidth={3} />
        <rect x={cx - 19} y={31} width={38} height={38} rx={3} fill="none" stroke="#a87d2b" strokeOpacity={0.55} strokeWidth={1.4} />
        <rect x={cx - 19} y={31} width={38} height={38} rx={3} fill="none" stroke="#a87d2b" strokeOpacity={0.55} strokeWidth={1.4} transform={`rotate(45 ${cx} 50)`} />
        <text
          x={cx}
          y={50}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#402d08"
          style={{ fontFamily: 'var(--font-cairo), system-ui, sans-serif', fontSize: 21, fontWeight: 800 }}
        >
          {label}
        </text>
      </g>
    )

    return (
      <div className="flex h-full w-full items-center justify-center select-none" role="heading" aria-level={2} aria-label={`سورة ${name}`}>
        <svg viewBox="0 0 1000 100" preserveAspectRatio="xMidYMid meet" className="block h-[94%] w-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c49a45" />
              <stop offset="1" stopColor="#805b1b" />
            </linearGradient>
            <linearGradient id={panelId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fffbf0" />
              <stop offset="1" stopColor="#f4ecd8" />
            </linearGradient>
            <pattern id={latticeId} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 8H16M8 0V16" stroke="#a87d2b" strokeOpacity={0.16} strokeWidth="1.3" />
            </pattern>
          </defs>

          <rect x="2" y="3" width="996" height="94" rx="12" fill={`url(#${panelId})`} stroke={`url(#${gradientId})`} strokeWidth="3.5" />
          <rect x="2" y="3" width="996" height="94" rx="12" fill={`url(#${latticeId})`} />
          <rect x="11" y="11" width="978" height="78" rx="7" fill="none" stroke="#996e22" strokeOpacity={0.35} strokeWidth={1.3} />

          <path d="M262 15H738Q782 15 806 50Q782 85 738 85H262Q218 85 194 50Q218 15 262 15Z" fill="#fbf6e8" stroke={`url(#${gradientId})`} strokeWidth="3" />
          <path d="M266 22H734Q771 22 791 50Q771 78 734 78H266Q229 78 209 50Q229 22 266 22Z" fill="none" stroke="#996e22" strokeOpacity={0.45} strokeWidth="1.2" />

          {medallion(90, `${surahNumber}`)}
          {medallion(910, `${ayahCount}`)}

          <text
            x="500"
            y="52"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#402d08"
            style={{ fontFamily: 'var(--font-cairo), system-ui, sans-serif', fontSize: 34, fontWeight: 900, letterSpacing: '0.04em' }}
          >
            سورة {name}
          </text>
        </svg>
      </div>
    )
  }

  function renderBasmala() {
    return (
      <div
        className="flex h-full items-center justify-center text-[#402d08] select-none"
        style={{ fontSize: MUSHAF_QCF_FONT_SIZE, lineHeight: MUSHAF_QCF_LINE_HEIGHT }}
      >
        <span style={{ fontFamily: 'var(--font-amiri-quran), "Times New Roman", serif', fontSize: '0.9em' }}>
          {BASMALA_TEXT}
        </span>
      </div>
    )
  }

  const fontFamily = fontLoaded ? `${getQcfV2FontFamily(pageNo)}, var(--font-amiri-quran), serif` : 'var(--font-amiri-quran), serif'

  return (
    <section
      ref={scrollContainerRef}
      onScroll={onScroll}
      dir="rtl"
      aria-label="مصحف المدينة — لوحة المراجعة"
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center justify-start overflow-y-auto bg-[var(--color-paper)]',
        isMobile ? 'p-1 sm:p-2 pb-20' : 'p-3 sm:p-6'
      )}
    >
      {/* Top page info strip on desktop */}
      {!isMobile ? (
        <div className="mb-3 flex w-full max-w-[720px] items-center justify-between px-2 text-xs font-bold text-[var(--color-ink-muted)]">
          <div className="flex items-center gap-2">
            <span>الجزء {metadata?.juzNumber ?? '—'}</span>
            <span>·</span>
            <span>الحزب {metadata?.hizbNumber ?? '—'}</span>
            {metadata?.surahNames && metadata.surahNames.length > 0 ? (
              <>
                <span>·</span>
                <span className="text-[var(--color-ink)]">سورة {metadata.surahNames.join('، ')}</span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[11px] text-[#92400e]">
              غير مراجَع: {page.stats.unreviewed}
            </span>
            <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[11px] text-[#166534]">
              مُراجَع: {page.stats.reviewed}
            </span>
            {page.stats.flagged > 0 ? (
              <span className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-[11px] text-[#991b1b]">
                معلَّم: {page.stats.flagged}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* The Mushaf Sheet */}
      <div
        className="relative select-none overflow-hidden rounded-[10px] border border-[#d8c9a3] bg-[#fbf7ee] shadow-lg transition-all"
        style={{
          width: zoom && zoom > 1 ? `${zoom * 100}%` : 'min(100%, 720px)',
          maxWidth: zoom && zoom > 1 ? `${Math.round(zoom * 720)}px` : '720px',
          aspectRatio: '1994 / 2850',
          containerType: 'inline-size',
        }}
      >
        {/* Top margin header */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between pt-[1.8%] px-[7.2%] text-[11px] font-bold text-[#80662c]"
          style={{ fontSize: 'clamp(9px, 2cqw, 13px)' }}
        >
          <span>{metadata?.surahNames?.[0] ? `سورة ${metadata.surahNames[0]}` : ''}</span>
          <span>{metadata?.juzNumber ? `الجزء ${metadata.juzNumber}` : ''}</span>
        </div>

        {/* 15 lines grid */}
        <div
          className="absolute inset-0 grid"
          style={{
            gridTemplateRows: 'repeat(15, minmax(0, 1fr))',
            paddingBlock: MUSHAF_PAGE_PRINT_PADDING_Y,
            paddingInline: MUSHAF_PAGE_PRINT_PADDING_X,
          }}
        >
          {mushafPage && mushafPage.lines && mushafPage.lines.length > 0 ? (
            mushafPage.lines.map((line) => {
              const decoration = decorationsMap.get(line.lineNumber)
              if (decoration?.surahHeader) {
                return (
                  <div key={line.lineNumber} className="flex items-center justify-center overflow-visible">
                    {renderSurahBanner(decoration.surahHeader)}
                  </div>
                )
              }
              if (decoration?.basmala) {
                return (
                  <div key={line.lineNumber} className="flex items-center justify-center overflow-visible">
                    {renderBasmala()}
                  </div>
                )
              }

              return (
                <div
                  key={line.lineNumber}
                  className="flex items-center justify-between overflow-visible [word-spacing:0]"
                  style={{ fontSize: MUSHAF_QCF_FONT_SIZE, lineHeight: MUSHAF_QCF_LINE_HEIGHT }}
                >
                  <div className="flex w-full items-center justify-between whitespace-nowrap">
                    {line.words.map((word) => {
                      const key = canonicalKeyForWord(word)
                      const isEndGlyph = word.charTypeName === 'end'
                      const covering = wordRowsMap.get(key)
                      const status = covering ? worstStatus(covering.map((r) => r.reviewStatus)) : null
                      const isSelected = selectedWordKey === key
                      const isHovered = covering?.some((r) => r.entryId === hoveredRowId) ?? false

                      const wordMeta: WordMeta = {
                        surah: word.surahNumber,
                        ayah: word.ayahNumber,
                        word: word.wordIndexInAyah,
                        text: word.textUthmani,
                        page: word.pageNumber,
                      }

                      // Outline & background styling
                      let bgStyle: string | undefined = undefined
                      let textStyle: string | undefined = undefined
                      let ringStyle: string | undefined = undefined

                      if (status === 'reviewed') {
                        bgStyle = 'rgba(34, 197, 94, 0.16)'
                        textStyle = '#15803d'
                      } else if (status === 'flagged') {
                        bgStyle = 'rgba(239, 68, 68, 0.18)'
                        textStyle = '#b91c1c'
                      } else if (status === 'unreviewed') {
                        bgStyle = 'rgba(245, 158, 11, 0.18)'
                        textStyle = '#92400e'
                      }

                      if (isSelected) {
                        ringStyle = '2px solid #b99b51'
                      } else if (isHovered) {
                        ringStyle = '1.5px dashed #b99b51'
                      }

                      return (
                        <button
                          key={word.id}
                          type="button"
                          onClick={() => onSelectWord(key, wordMeta)}
                          onMouseEnter={() => covering && onHoverWord(covering.map((r) => r.entryId))}
                          onMouseLeave={() => onHoverWord(null)}
                          data-word-key={key}
                          aria-label={`${word.textUthmani} — ${word.surahNumber}:${word.ayahNumber}:${word.wordIndexInAyah}`}
                          className={cn(
                            'relative inline-flex items-center justify-center rounded-[3px] px-0.5 py-0 select-none transition-all cursor-pointer focus:outline-none',
                            isMobile && 'before:absolute before:-inset-y-1.5 before:-inset-x-1 before:content-[""] active:scale-95 active:bg-[#d8c9a3]/70',
                            isSelected && 'outline outline-2 outline-offset-1 outline-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/40 shadow-sm font-bold',
                            !isSelected && 'hover:bg-[#eadfc9]/60 hover:outline hover:outline-1 hover:outline-[#b99b51]/40'
                          )}
                          style={{
                            fontFamily,
                            fontSize: fontLoaded && word.glyph ? '1em' : '0.86em',
                            color: textStyle ?? '#171717',
                            backgroundColor: bgStyle,
                            outline: ringStyle,
                          }}
                        >
                          <span>{fontLoaded && word.glyph ? word.glyph : word.textUthmani}</span>
                          {covering && covering.length > 1 ? (
                            <span
                              className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--color-primary)] text-[8px] font-bold text-white shadow-xs"
                              title={`${covering.length} قراءات مسجلة`}
                            >
                              {covering.length}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })
          ) : (
            // Fallback line rendering while mushafPage is loading
            fallbackLines.map(([lineNum, words]) => (
              <div
                key={lineNum}
                className="flex items-center justify-between overflow-visible [word-spacing:0]"
                style={{ fontSize: MUSHAF_QCF_FONT_SIZE, lineHeight: MUSHAF_QCF_LINE_HEIGHT }}
              >
                <div className="flex w-full items-center justify-between whitespace-nowrap">
                  {words.map((word) => {
                    const covering = wordRowsMap.get(word.key)
                    const status = covering ? worstStatus(covering.map((r) => r.reviewStatus)) : null
                    const isSelected = selectedWordKey === word.key

                    const wordMeta: WordMeta = {
                      surah: word.surah,
                      ayah: word.ayah,
                      word: word.word,
                      text: word.text,
                      page: pageNo,
                    }

                    return (
                      <button
                        key={word.key}
                        type="button"
                        onClick={() => onSelectWord(word.key, wordMeta)}
                        className={cn(
                          'relative inline-flex items-center justify-center rounded-[3px] px-0.5 py-0 select-none transition-all cursor-pointer',
                          isMobile && 'before:absolute before:-inset-y-1.5 before:-inset-x-1 before:content-[""] active:scale-95 active:bg-[#d8c9a3]/70',
                          isSelected && 'outline outline-2 outline-offset-1 outline-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/40',
                          status === 'reviewed' && 'bg-green-100/60 text-green-900',
                          status === 'unreviewed' && 'bg-amber-100/70 text-amber-900',
                          status === 'flagged' && 'bg-red-100/70 text-red-900',
                          !status && 'hover:bg-[#eadfc9]/50'
                        )}
                        style={{ fontFamily: 'var(--font-amiri-quran), serif' }}
                      >
                        {word.text}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom margin footer with page number */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center pb-[1.4%] font-black text-[#80662c]"
          style={{ fontSize: 'clamp(9px, 2cqw, 13px)' }}
        >
          <span className="tabular-nums">{pageNo}</span>
        </div>
      </div>

      {!isMobile ? (
        <p className="mt-4 max-w-[720px] text-center text-xs text-[var(--color-ink-muted)]">
          اضغط على أي كلمة في الصفحة — الملوّنة لعرض واعتماد قراءاتها، والعادية لإضافة قراءة أو أصل جديد مباشرة.
        </p>
      ) : null}
    </section>
  )
}
