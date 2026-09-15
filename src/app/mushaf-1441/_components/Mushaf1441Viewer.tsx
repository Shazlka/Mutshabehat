'use client'

import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent, type WheelEvent as ReactWheelEvent } from 'react'
import Link from 'next/link'
import ArabicDiff, { type Part } from '@/components/ArabicDiff'
import type {
  AyahNote,
  MushafAnnotation,
  MushafPage,
  MushafWord,
} from '../../../../packages/quran-data/mushaf1441/types'
import { MUSHAF_1441_PAGE_COUNT } from '../../../../packages/quran-data/mushaf1441/constants'
import type {
  Mushaf1441PageMetadata,
  Mushaf1441SurahOption,
} from '../../../../packages/quran-data/mushaf1441/pageMetadata'
import {
  getHighlightsForPage,
  getMutshabehatByAyahKey,
  isMushafMutshabehatLinkEnabled,
  navigateToAyah,
  type MutshabehatAyahLink,
} from '../../../../packages/mutshabehat-core/mushafLinkAdapter'
import { SAMPLE_MUTSHABEHAT_LINK_SOURCE } from '../../../../packages/mutshabehat-core/sampleMushafLinks'
import { getQiraatVariantsByAyahKey } from '../../../../packages/qiraat-core/qiraatAdapter'
import { SAMPLE_QIRAAT_SOURCE } from '../../../../packages/qiraat-core/sampleQiraatSource'

type Mushaf1441ViewerProps = {
  initialPage: MushafPage
  initialPageMetadata: Mushaf1441PageMetadata
  surahOptions: Mushaf1441SurahOption[]
  /** Every ayah → personal group link, loaded on the server; null = not available (client fetches). */
  initialMutshabehatHighlights?: MutshabehatAyahLink[] | null
}

const MIN_PAGE = 1
const MAX_PAGE = MUSHAF_1441_PAGE_COUNT
const MUSHAF_1441_NOTES_STORAGE_KEY = 'mushaf1441:ayah-notes:v1'
// Last page the reader was on, so leaving the mushaf (another tab, a group) and coming
// back resumes there instead of page 1. An explicit ?page= in the URL always wins.
const MUSHAF_1441_LAST_PAGE_KEY = 'mushaf1441:last-page:v1'

type DetailPanelTab = 'notes' | 'mutshabehat' | 'qiraat'
type AnnotationEditorMode = 'note' | 'highlight' | 'bookmark' | 'favorite'

type AnnotationTarget =
  | { targetType: 'ayah'; ayahKey: string; pageNumber: number }
  | { targetType: 'word'; ayahKey: string; pageNumber: number; word: MushafWord }
  | { targetType: 'word-range'; ayahKey: string; pageNumber: number; startWord: MushafWord; endWord: MushafWord }

type ContextMenuState = {
  x: number
  y: number
  target: AnnotationTarget
}

type AnnotationDraft = {
  title: string
  body: string
  tags: string
  textColor: string
  backgroundColor: string
}

const EMPTY_ANNOTATION_DRAFT: AnnotationDraft = {
  title: '',
  body: '',
  tags: '',
  textColor: '#5b4a26',
  backgroundColor: '#ece2c8',
}

// Subtle selection tint: the page colour one step darker (not a different colour).
const SELECTION_BG = '#ece2c8'
const SELECTION_BORDER = '#d8c9a3'

// Ayat that belong to one of your personal mutashabihat groups: one consistent teal,
// distinct from the gold UI chrome and from every annotation highlight preset.
const PERSONAL_AYAH_HIGHLIGHT = { text: '#0b6b66', underline: '#5fa89e', tint: '#e3f1ee' }

// Highlighter tints for ayat in your mutashabihat groups. Each group gets its own colour,
// picked deterministically from its id, so the same group has the same colour on every page
// and neighbouring groups are easy to tell apart. Soft enough to keep the black text readable.
const MUTSHABEHAT_TINTS = [
  { bg: '#fcd9de', edge: '#e0909c' }, // rose
  { bg: '#fde3bd', edge: '#dca457' }, // apricot
  { bg: '#f4eca6', edge: '#c4b23d' }, // lemon
  { bg: '#d5efc8', edge: '#7dbb63' }, // leaf
  { bg: '#c7ebe1', edge: '#55ad98' }, // mint
  { bg: '#cde7f6', edge: '#5aa6cc' }, // sky
  { bg: '#d9dffb', edge: '#7f8fdc' }, // periwinkle
  { bg: '#e7d8fa', edge: '#a283dc' }, // lavender
  { bg: '#f8d5ee', edge: '#d585bf' }, // orchid
  { bg: '#e6dcc9', edge: '#ad966c' }, // sand
] as const

function tintForGroup(key: string | undefined) {
  if (!key) return MUTSHABEHAT_TINTS[0]
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return MUTSHABEHAT_TINTS[Math.abs(hash) % MUTSHABEHAT_TINTS.length]
}
const WHEEL_TURN_THRESHOLD = 60

type PopupGroup = {
  id: string
  title: string
  verses: Array<{ surah: string; ayah: number; parts: Array<{ type: string; text: string }> }>
}

const HIGHLIGHT_COLOR_PRESETS = [
  { label: 'ورقي', textColor: '#5b4a26', backgroundColor: '#ece2c8' },
  { label: 'ذهبي', textColor: '#7a5a12', backgroundColor: '#fbe6b8' },
  { label: 'أصفر', textColor: '#6b6b1f', backgroundColor: '#f3f4cf' },
  { label: 'برتقالي', textColor: '#8a4a1f', backgroundColor: '#fce3cf' },
  { label: 'خوخي', textColor: '#8a5230', backgroundColor: '#fce6d9' },
  { label: 'أحمر', textColor: '#8e2f2f', backgroundColor: '#fbd9d6' },
  { label: 'وردي', textColor: '#8a2f4e', backgroundColor: '#fbe0e6' },
  { label: 'بنفسجي', textColor: '#5a3a8a', backgroundColor: '#ece0fb' },
  { label: 'أزرق', textColor: '#234e8a', backgroundColor: '#d8e8fb' },
  { label: 'سماوي', textColor: '#1f6b73', backgroundColor: '#d6f0f3' },
  { label: 'تركواز', textColor: '#1f6b62', backgroundColor: '#d2f0ea' },
  { label: 'نعناعي', textColor: '#1f6b4f', backgroundColor: '#d4f3e6' },
  { label: 'أخضر', textColor: '#2f6b34', backgroundColor: '#dff0d8' },
  { label: 'رمادي', textColor: '#444444', backgroundColor: '#e6e6e6' },
] as const

type IconProps = { className?: string }
const ICON_BASE = {
  viewBox: '0 0 24 24',
  width: 18,
  height: 18,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}
function IconNote({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M14 4v5h5" />
      <path d="M8 13h7M8 16.5h5" />
    </svg>
  )
}
function IconHighlight({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="m9.5 14.5-4 4 .8 1.7H4l-1 1" />
      <path d="M13 4.8 19.2 11l-7 7-6.2-6.2 7-7Z" />
      <path d="m12.5 5.3 6.2 6.2" />
    </svg>
  )
}
function IconBookmark({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1Z" />
    </svg>
  )
}
function IconStar({ className, filled }: IconProps & { filled?: boolean }) {
  return (
    <svg {...ICON_BASE} fill={filled ? 'currentColor' : 'none'} className={className}>
      <path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.9 6.7 19.5l1.2-6L3.4 9.3l6-.7L12 3Z" />
    </svg>
  )
}
function IconCopy({ className }: IconProps) {
  return (
    <svg {...ICON_BASE} className={className}>
      <rect x="9" y="9" width="11" height="11" rx="1.5" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  )
}

// Printed page is 1994 x 2850. Width follows the print ratio; on phones (taller than a
// printed page) the height may grow up to 18% so the page fills the screen instead of
// leaving empty bands. Font size is tied to page width (cqw) so every line always fits.
const MUSHAF_PAGE_WIDTH = 'min(100cqw, calc(100cqh * 1994 / 2850))'
const MUSHAF_PAGE_HEIGHT = 'min(100cqh, calc(min(100cqw, 100cqh * 1994 / 2850) * 2850 / 1994 * 1.18))'
const MUSHAF_PAGE_PRINT_PADDING_X = '7.2%'
const MUSHAF_PAGE_PRINT_PADDING_Y = '5.8%'
const MUSHAF_QCF_FONT_SIZE = '4.35cqw'
const MUSHAF_QCF_LINE_HEIGHT = 1.04
// Word box = line height + vertical padding; gaps use the same height so highlight bands are flush.
const MUSHAF_WORD_BAND_PADDING = '0.08em'
const MUSHAF_WORD_BAND_HEIGHT = `calc(${MUSHAF_QCF_LINE_HEIGHT}em + 0.16em)`
const SWIPE_THRESHOLD_PX = 55
const LONG_PRESS_MS = 480
const SIGN_IN_HREF = '/login?next=/mushaf-1441'
const BASMALA_TEXT = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'

type LineDecoration = { surahHeader?: number; basmala?: boolean }
type QcfFontStatus = 'loading' | 'loaded' | 'error'

// The fixture reserves empty lines as placeholders for a surah's ornamental
// header band and its basmala. Map each such empty line to what it represents
// by looking at the surah that starts just below it (ayah 1, word 1).
function computeLineDecorations(page: MushafPage): Map<number, LineDecoration> {
  const deco = new Map<number, LineDecoration>()
  const isEmptyLine = (lineNo: number) =>
    page.lines.some((line) => line.lineNumber === lineNo && line.words.length === 0)

  for (const line of page.lines) {
    const first = line.words[0]
    if (!first) continue
    if (first.ayahNumber !== 1 || first.wordIndexInAyah !== 1) continue

    const surahNumber = first.surahNumber
    const startLine = line.lineNumber
    // Al-Fatiha (1) and At-Tawbah (9) have no basmala line.
    const hasBasmala = surahNumber !== 1 && surahNumber !== 9
    const headerLine = hasBasmala ? startLine - 2 : startLine - 1
    const basmalaLine = hasBasmala ? startLine - 1 : null

    if (headerLine >= 1 && isEmptyLine(headerLine)) {
      deco.set(headerLine, { ...(deco.get(headerLine) ?? {}), surahHeader: surahNumber })
    }
    if (basmalaLine && isEmptyLine(basmalaLine)) {
      deco.set(basmalaLine, { ...(deco.get(basmalaLine) ?? {}), basmala: true })
    }
  }
  return deco
}

function getQcfV2FontFamily(pageNumber: number) {
  return `QCFV2-P${pageNumber}`
}

function getQcfV2FontUrl(pageNumber: number) {
  return `https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${pageNumber}.woff2`
}

function clampPage(value: number) {
  if (!Number.isFinite(value)) return MIN_PAGE
  return Math.min(MAX_PAGE, Math.max(MIN_PAGE, Math.trunc(value)))
}

function formatWordPosition(word: MushafWord) {
  return `صفحة ${word.pageNumber} · سطر ${word.lineNumber} · كلمة ${word.wordIndexInLine}`
}

function splitTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

async function readPreviewApiError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as {
    error?: unknown
    detail?: unknown
    migration?: unknown
  } | null

  const parts = [
    typeof payload?.error === 'string' ? payload.error : fallback,
    typeof payload?.detail === 'string' ? payload.detail : null,
    typeof payload?.migration === 'string' ? `Migration: ${payload.migration}` : null,
  ].filter(Boolean)

  return parts.join(' - ')
}

export default function Mushaf1441Viewer({
  initialPage,
  initialPageMetadata,
  surahOptions,
  initialMutshabehatHighlights = null,
}: Mushaf1441ViewerProps) {
  const [pageNumber, setPageNumber] = useState(initialPage.pageNumber)
  const [pageInput, setPageInput] = useState(String(initialPage.pageNumber))
  const [currentPage, setCurrentPage] = useState<MushafPage | null>(initialPage)
  const [pageCache, setPageCache] = useState<Record<number, MushafPage>>({
    [initialPage.pageNumber]: initialPage,
  })
  const [currentPageMetadata, setCurrentPageMetadata] = useState<Mushaf1441PageMetadata>(initialPageMetadata)
  const [pageMetadataCache, setPageMetadataCache] = useState<Record<number, Mushaf1441PageMetadata>>({
    [initialPageMetadata.pageNumber]: initialPageMetadata,
  })
  const [isPageLoading, setIsPageLoading] = useState(false)
  // Per-page QCF V2 font state. Glyph codes are page-specific private-use characters, so a
  // page's words must never render before THAT page's font is loaded (they would show as
  // wrong letters or boxes), and one page's font failure must not affect other pages.
  const [qcfFontStatus, setQcfFontStatus] = useState<Record<number, QcfFontStatus>>({})
  const qcfFontStatusRef = useRef<Record<number, QcfFontStatus>>({})
  const [selectedSurahNumber, setSelectedSurahNumber] = useState(initialPageMetadata.surahNumbers[0] ?? 1)
  const [selectedAyahNumber, setSelectedAyahNumber] = useState(
    Number(initialPageMetadata.firstAyahKey.split(':')[1] ?? 1)
  )
  const [selectedWord, setSelectedWord] = useState<MushafWord | null>(null)
  const [selectedWordRange, setSelectedWordRange] = useState<{ startWord: MushafWord; endWord: MushafWord } | null>(null)
  const [selectedAyahKey, setSelectedAyahKey] = useState<string | null>(null)
  const [annotations, setAnnotations] = useState<MushafAnnotation[]>([])
  const [annotationDraft, setAnnotationDraft] = useState<AnnotationDraft>(EMPTY_ANNOTATION_DRAFT)
  const [annotationMode, setAnnotationMode] = useState<AnnotationEditorMode>('note')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [isMobileNotesOpen, setIsMobileNotesOpen] = useState(false)
  const [mutshabehatPanelAyahKey, setMutshabehatPanelAyahKey] = useState<string | null>(null)
  const [activeDetailTab, setActiveDetailTab] = useState<DetailPanelTab>('notes')
  const [annotationStatus, setAnnotationStatus] = useState<string | null>(null)
  const [annotationError, setAnnotationError] = useState<string | null>(null)
  const [isAnnotationSaving, setIsAnnotationSaving] = useState(false)
  const [annotationSyncAvailable, setAnnotationSyncAvailable] = useState(true)
  const [allMutshabehatHighlights, setAllMutshabehatHighlights] = useState<MutshabehatAyahLink[] | null>(initialMutshabehatHighlights)
  const [mutshabehatLoadError, setMutshabehatLoadError] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [needsSignIn, setNeedsSignIn] = useState(false)
  const [hoveredAyahKey, setHoveredAyahKey] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [surahSliderPreview, setSurahSliderPreview] = useState<number | null>(null)
  const [mutshabehatPopupAyahKey, setMutshabehatPopupAyahKey] = useState<string | null>(null)
  const [groupDetails, setGroupDetails] = useState<Record<string, PopupGroup | 'loading' | 'error'>>({})
  // Groups in the ayah card start collapsed (title only); tapping a title expands its details.
  const [expandedPopupGroups, setExpandedPopupGroups] = useState<Record<string, boolean>>({})
  const wheelStateRef = useRef({ accumulated: 0, lastTurn: 0, lastEvent: 0 })
  const lastTapRef = useRef(0)

  const swipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)
  // Timestamp of the last touch end, used to suppress tap-to-select on touch
  // devices (mobile opens details via long-press only, not a tap).
  const recentTouchRef = useRef(0)

  const surahNameByNumber = useMemo(() => {
    const map = new Map<number, string>()
    for (const surah of surahOptions) map.set(surah.surahNumber, surah.name)
    return map
  }, [surahOptions])
  const surahAyahCountByNumber = useMemo(() => {
    const map = new Map<number, number>()
    for (const surah of surahOptions) map.set(surah.surahNumber, surah.ayahCount)
    return map
  }, [surahOptions])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(MUSHAF_1441_NOTES_STORAGE_KEY)
    if (!saved) return

    try {
      const parsed = JSON.parse(saved) as Partial<{
        annotationDraft: AnnotationDraft
        annotationMode: AnnotationEditorMode
      }>
      if (parsed.annotationDraft) {
        setAnnotationDraft((current) => ({
          ...current,
          ...parsed.annotationDraft,
        }))
      }
      if (parsed.annotationMode && ['note', 'highlight', 'bookmark', 'favorite'].includes(parsed.annotationMode)) {
        setAnnotationMode(parsed.annotationMode)
      }
    } catch {
      // Ignore invalid cached draft state.
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      MUSHAF_1441_NOTES_STORAGE_KEY,
      JSON.stringify({
        annotationDraft,
        annotationMode,
      })
    )
  }, [annotationDraft, annotationMode])

  // Resume the last page when the reader is opened without an explicit ?page=.
  useEffect(() => {
    let savedPage: number | null = null
    try {
      savedPage = Number(window.localStorage.getItem(MUSHAF_1441_LAST_PAGE_KEY))
    } catch {
      savedPage = null
    }
    const hasExplicitPage = new URL(window.location.href).searchParams.has('page')
    if (hasExplicitPage || !savedPage || savedPage === initialPage.pageNumber || clampPage(savedPage) !== savedPage) {
      try {
        window.localStorage.setItem(MUSHAF_1441_LAST_PAGE_KEY, String(initialPage.pageNumber))
      } catch {
        // ignore
      }
      return
    }
    const timer = setTimeout(() => { void goToPage(savedPage as number) }, 0)
    return () => clearTimeout(timer)
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadQcfFontForPage(pageNumber)
  }, [pageNumber])

  useEffect(() => {
    void loadAnnotationsForPage(pageNumber)
  }, [pageNumber])

  useEffect(() => {
    // Prefetch neighbours so flipping to the next/previous page is instant.
    void prefetchPage(pageNumber + 1)
    void prefetchPage(pageNumber - 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber])

  useEffect(() => {
    if (!mutshabehatPopupAyahKey) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMutshabehatPopupAyahKey(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mutshabehatPopupAyahKey])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!contextMenu) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setContextMenu(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [contextMenu])

  const visiblePage = currentPage?.pageNumber === pageNumber ? currentPage : null
  const visiblePageMetadata = currentPageMetadata.pageNumber === pageNumber ? currentPageMetadata : null
  const qcfFontFamily = getQcfV2FontFamily(pageNumber)
  const isQcfFontLoaded = qcfFontStatus[pageNumber] === 'loaded'
  const isQcfFontFailed = qcfFontStatus[pageNumber] === 'error'
  const selectedSurah = surahOptions.find((surah) => surah.surahNumber === selectedSurahNumber) ?? surahOptions[0]
  const selectedSurahAyahCount = selectedSurah?.ayahCount ?? 1
  const ayahKeys = useMemo(() => {
    if (!visiblePage) return []
    const keys = new Set<string>()
    for (const line of visiblePage.lines) {
      for (const word of line.words) keys.add(word.ayahKey)
    }
    return [...keys]
  }, [visiblePage])
  const lastWordIdByAyah = useMemo(() => {
    const lastWords = new Map<string, string>()
    if (!visiblePage) return lastWords

    for (const line of visiblePage.lines) {
      for (const word of line.words) {
        lastWords.set(word.ayahKey, word.id)
      }
    }

    return lastWords
  }, [visiblePage])
  const pageWordOrder = useMemo(() => {
    const order = new Map<string, number>()
    if (!visiblePage) return order

    let index = 0
    for (const line of visiblePage.lines) {
      for (const word of line.words) {
        order.set(word.id, index)
        index += 1
      }
    }

    return order
  }, [visiblePage])
  const pageAnnotations = useMemo(
    () => annotations.filter((annotation) => annotation.pageNumber === pageNumber),
    [annotations, pageNumber]
  )
  const annotationsForSelectedTarget = useMemo(() => {
    if (!selectedAyahKey) return []
    if (selectedWordRange) {
      return pageAnnotations.filter((annotation) => (
        annotation.ayahKey === selectedAyahKey
        && (
          annotation.targetType === 'ayah'
          || (
            annotation.targetType === 'word-range'
            && annotation.wordRangeStartId === selectedWordRange.startWord.id
            && annotation.wordRangeEndId === selectedWordRange.endWord.id
          )
        )
      ))
    }
    return pageAnnotations.filter((annotation) => (
      annotation.ayahKey === selectedAyahKey
      && (
        !selectedWord
        || annotation.targetType === 'ayah'
        || annotation.wordId === selectedWord.id
      )
    ))
  }, [pageAnnotations, selectedAyahKey, selectedWord, selectedWordRange])
  const notesForSelectedAyah = useMemo(
    () => annotationsForSelectedTarget.filter((annotation) => annotation.annotationType === 'note'),
    [annotationsForSelectedTarget]
  )
  const bookmarksForSelectedAyah = useMemo(
    () => annotationsForSelectedTarget.filter((annotation) => annotation.annotationType === 'bookmark'),
    [annotationsForSelectedTarget]
  )
  const favoritesForSelectedAyah = useMemo(
    () => annotationsForSelectedTarget.filter((annotation) => annotation.annotationType === 'favorite'),
    [annotationsForSelectedTarget]
  )
  const annotationsByWordId = useMemo(() => {
    const map = new Map<string, MushafAnnotation[]>()
    for (const annotation of pageAnnotations) {
      if (annotation.wordId) {
        const existing = map.get(annotation.wordId) ?? []
        existing.push(annotation)
        map.set(annotation.wordId, existing)
      }
    }
    return map
  }, [pageAnnotations])
  const annotationsByAyahKey = useMemo(() => {
    const map = new Map<string, MushafAnnotation[]>()
    for (const annotation of pageAnnotations) {
      const existing = map.get(annotation.ayahKey) ?? []
      existing.push(annotation)
      map.set(annotation.ayahKey, existing)
    }
    return map
  }, [pageAnnotations])
  const mutshabehatLinkEnabled = isMushafMutshabehatLinkEnabled()
  // Filter the user's full link list to this page locally — instant on every page turn.
  const pageHighlights = useMemo<MutshabehatAyahLink[]>(() => {
    if (!visiblePage) return []
    if (!mutshabehatLinkEnabled) {
      return getHighlightsForPage(pageNumber, visiblePage, SAMPLE_MUTSHABEHAT_LINK_SOURCE) as MutshabehatAyahLink[]
    }
    if (!allMutshabehatHighlights) return []
    const keys = new Set(ayahKeys)
    return allMutshabehatHighlights.filter((highlight) => keys.has(highlight.ayahKey))
  }, [allMutshabehatHighlights, ayahKeys, mutshabehatLinkEnabled, pageNumber, visiblePage])
  const highlightedMutshabehatAyahKeys = useMemo(
    () => new Set(pageHighlights.map((highlight) => highlight.ayahKey)),
    [pageHighlights]
  )
  const mutshabehatHighlightByAyahKey = useMemo(() => {
    const map = new Map<string, MutshabehatAyahLink>()
    for (const highlight of pageHighlights) {
      if (!map.has(highlight.ayahKey)) map.set(highlight.ayahKey, highlight)
    }
    return map
  }, [pageHighlights])
  const mutshabehatPanelLinks = useMemo(() => (
    mutshabehatPanelAyahKey
      ? pageHighlights.filter((highlight) => highlight.ayahKey === mutshabehatPanelAyahKey).length > 0
        ? pageHighlights.filter((highlight) => highlight.ayahKey === mutshabehatPanelAyahKey)
        : getMutshabehatByAyahKey(mutshabehatPanelAyahKey, SAMPLE_MUTSHABEHAT_LINK_SOURCE)
      : []
  ), [mutshabehatPanelAyahKey, pageHighlights])
  const qiraatVariantsForSelectedAyah = useMemo(() => (
    selectedAyahKey
      ? getQiraatVariantsByAyahKey(selectedAyahKey, SAMPLE_QIRAAT_SOURCE)
      : []
  ), [selectedAyahKey])

  // Fallback only: if the server could not include the links, fetch the full list once.
  useEffect(() => {
    if (!mutshabehatLinkEnabled || allMutshabehatHighlights) return
    let cancelled = false

    async function loadAllMutshabehatHighlights() {
      try {
        const response = await fetch(`/api/mushaf-1441/mutshabehat`)
        if (!response.ok) {
          throw new Error(await readPreviewApiError(response, 'تعذر تحميل متشابهات Supabase لهذه الصفحة.'))
        }
        const payload = await response.json() as { highlights?: MutshabehatAyahLink[] }
        if (cancelled) return
        setMutshabehatLoadError(null)
        setAllMutshabehatHighlights(Array.isArray(payload.highlights) ? payload.highlights : [])
      } catch (error) {
        if (cancelled) return
        setMutshabehatLoadError(error instanceof Error ? error.message : 'تعذر تحميل متشابهات Supabase لهذه الصفحة.')
      }
    }

    void loadAllMutshabehatHighlights()
    return () => {
      cancelled = true
    }
  }, [allMutshabehatHighlights, mutshabehatLinkEnabled])

  async function goToPage(nextPage: number, targetAyahKey?: string) {
    const clamped = clampPage(nextPage)
    setPageNumber(clamped)
    setPageInput(String(clamped))
    if (typeof window !== 'undefined') {
      // Keep ?page= in the URL so reloads and shared links open the same page.
      const url = new URL(window.location.href)
      url.searchParams.set('page', String(clamped))
      window.history.replaceState(window.history.state, '', url)
      try {
        window.localStorage.setItem(MUSHAF_1441_LAST_PAGE_KEY, String(clamped))
      } catch {
        // Storage unavailable (private mode) — resuming is best-effort.
      }
    }
    setSelectedWord(null)
    setSelectedWordRange(null)
    setSelectedAyahKey(targetAyahKey ?? null)
    setIsMobileNotesOpen(false)
    setMutshabehatPanelAyahKey(null)
    setMutshabehatPopupAyahKey(null)
    setActiveDetailTab('notes')
    setContextMenu(null)
    setEditingNoteId(null)
    setAnnotationDraft(EMPTY_ANNOTATION_DRAFT)
    setAnnotationMode('note')

    if (pageCache[clamped]) {
      setCurrentPage(pageCache[clamped])
      const metadata = await loadPageMetadata(clamped)
      if (!targetAyahKey) syncJumpControlsToMetadata(metadata)
      return
    }

    setIsPageLoading(true)
    try {
      const [loadedPage, metadata] = await Promise.all([
        loadPageWords(clamped),
        loadPageMetadata(clamped),
      ])
      setCurrentPage(loadedPage)
      if (loadedPage) {
        setPageCache((current) => ({ ...current, [loadedPage.pageNumber]: loadedPage }))
      }
      if (!targetAyahKey) syncJumpControlsToMetadata(metadata)
    } finally {
      setIsPageLoading(false)
    }
  }

  function syncJumpControlsToMetadata(metadata: Mushaf1441PageMetadata) {
    setSelectedSurahNumber(metadata.surahNumbers[0] ?? 1)
    setSelectedAyahNumber(Number(metadata.firstAyahKey.split(':')[1] ?? 1))
  }

  async function goToAyah(surahNumber: number, ayahNumber: number) {
    const ayahKey = `${surahNumber}:${ayahNumber}`
    const response = await fetch(`/api/mushaf-1441/page-metadata?ayahKey=${encodeURIComponent(ayahKey)}`)
    if (!response.ok) return
    const data = await response.json() as { pageNumber: number }
    setSelectedSurahNumber(surahNumber)
    setSelectedAyahNumber(ayahNumber)
    await goToPage(data.pageNumber, ayahKey)
  }

  async function jumpToSelectedAyah() {
    const ayahNumber = Math.min(selectedSurahAyahCount, Math.max(1, Math.trunc(Number(selectedAyahNumber))))
    await goToAyah(selectedSurahNumber, ayahNumber)
  }

  async function submitAyahJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await jumpToSelectedAyah()
  }

  async function loadQcfFontForPage(nextPage: number) {
    if (typeof document === 'undefined' || typeof FontFace === 'undefined') return
    const current = qcfFontStatusRef.current[nextPage]
    if (current === 'loaded' || current === 'loading') return

    const setStatus = (status: QcfFontStatus) => {
      qcfFontStatusRef.current = { ...qcfFontStatusRef.current, [nextPage]: status }
      setQcfFontStatus(qcfFontStatusRef.current)
    }

    const fontFamily = getQcfV2FontFamily(nextPage)
    const fontUrl = getQcfV2FontUrl(nextPage)

    // Note: document.fonts.check() returns true when NO face with that family is registered,
    // so it cannot tell whether the page font is really loaded. Look for a loaded face instead.
    const alreadyLoaded = [...document.fonts].some((face) => face.family.replace(/"/g, '') === fontFamily && face.status === 'loaded')
    if (alreadyLoaded) {
      setStatus('loaded')
      return
    }

    setStatus('loading')
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const fontFace = new FontFace(fontFamily, `url("${fontUrl}") format("woff2")`, { display: 'block' })
        await fontFace.load()
        document.fonts.add(fontFace)
        setStatus('loaded')
        return
      } catch {
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 600))
      }
    }
    setStatus('error')
  }

  async function loadPageWords(nextPage: number) {
    // loadMushaf1441Page legacy compatibility only.
    const response = await fetch(`/api/mushaf-1441/page-words?page=${nextPage}`)
    if (!response.ok) throw new Error(`Failed to load word lines for page ${nextPage}`)
    return await response.json() as MushafPage
  }

  async function loadPageMetadata(nextPage: number) {
    if (pageMetadataCache[nextPage]) {
      setCurrentPageMetadata(pageMetadataCache[nextPage])
      return pageMetadataCache[nextPage]
    }

    const response = await fetch(`/api/mushaf-1441/page-metadata?page=${nextPage}`)
    if (!response.ok) throw new Error(`Failed to load metadata for page ${nextPage}`)
    const metadata = await response.json() as Mushaf1441PageMetadata
    setCurrentPageMetadata(metadata)
    setPageMetadataCache((current) => ({ ...current, [metadata.pageNumber]: metadata }))
    return metadata
  }

  function isWordTarget(target: AnnotationTarget): target is Extract<AnnotationTarget, { targetType: 'word' }> {
    return target.targetType === 'word'
  }

  function isWordRangeTarget(target: AnnotationTarget): target is Extract<AnnotationTarget, { targetType: 'word-range' }> {
    return target.targetType === 'word-range'
  }

  function isAyahTarget(target: AnnotationTarget): target is Extract<AnnotationTarget, { targetType: 'ayah' }> {
    return target.targetType === 'ayah'
  }

  function closeContextMenu() {
    setContextMenu(null)
  }

  // Swipe left → next page, swipe right → previous page (RTL page turning).
  function handlePageTouchStart(event: ReactTouchEvent) {
    const touch = event.touches[0]
    if (!touch) return
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  function handlePageTouchEnd(event: ReactTouchEvent) {
    const start = swipeStartRef.current
    swipeStartRef.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    if (!touch) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy) * 1.3) return
    // Arabic RTL: swipe left → previous page, swipe right → next page.
    if (dx < 0) void goToPage(pageNumber - 1)
    else void goToPage(pageNumber + 1)
  }

  async function copyAyahText(ayahKey: string) {
    if (!visiblePage) return
    const words = visiblePage.lines
      .flatMap((line) => line.words)
      .filter((word) => word.ayahKey === ayahKey && word.charTypeName !== 'end')
    const text = words.map((word) => word.textUthmani).join(' ').replace(/\s+/g, ' ').trim()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setToast('تم نسخ الآية إلى الحافظة')
    } catch {
      setToast('تعذّر نسخ الآية')
    }
  }

  // Tap the left half of the page → next page; right half → previous page
  // (Arabic RTL page turning). Ignores taps on words / ayah markers / buttons.
  function handlePageClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false
      return
    }
    const target = event.target as HTMLElement
    if (target.closest('button') || target.closest('a')) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    if (x < rect.width / 2) void goToPage(pageNumber + 1)
    else void goToPage(pageNumber - 1)
  }

  // Warm the cache (words + metadata + font) for adjacent pages so turning is instant.
  async function prefetchPage(target: number) {
    const clamped = clampPage(target)
    if (clamped < MIN_PAGE || clamped > MAX_PAGE) return
    void loadQcfFontForPage(clamped)
    if (!pageCache[clamped]) {
      try {
        const loaded = await loadPageWords(clamped)
        setPageCache((current) => (current[clamped] ? current : { ...current, [clamped]: loaded }))
      } catch {
        // Ignore prefetch failures; the page will load on demand.
      }
    }
    if (!pageMetadataCache[clamped]) {
      try {
        const response = await fetch(`/api/mushaf-1441/page-metadata?page=${clamped}`)
        if (response.ok) {
          const metadata = await response.json() as Mushaf1441PageMetadata
          setPageMetadataCache((current) => (current[clamped] ? current : { ...current, [clamped]: metadata }))
        }
      } catch {
        // Ignore prefetch failures.
      }
    }
  }

  // Long-press (touch) on a word / ayah opens the highlight + notes menu.
  function startLongPress(target: AnnotationTarget, event: ReactTouchEvent) {
    const touch = event.touches[0]
    if (!touch) return
    const x = touch.clientX
    const y = touch.clientY
    cancelLongPress()
    longPressFiredRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      openContextMenu(target, x, y)
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(12)
      }
    }, LONG_PRESS_MS)
  }

  function cancelLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  async function loadAnnotationsForPage(nextPage: number) {
    setAnnotationError(null)
    setAnnotationStatus(null)

    try {
      const response = await fetch(`/api/mushaf-1441/annotations?pageNumber=${nextPage}`)
      if (response.status === 401) {
        setAnnotationSyncAvailable(false)
        setNeedsSignIn(true)
        setAnnotationStatus('سجّل الدخول لحفظ التمييز والملاحظات والإشارات والمفضلة.')
        setAnnotations([])
        return
      }
      if (response.status === 501) {
        setAnnotationSyncAvailable(false)
        setAnnotationStatus('جدول Supabase الخاص بالمصحف غير مفعل بعد.')
        setAnnotationError(await readPreviewApiError(response, 'جدول Supabase الخاص بالمصحف غير مفعل بعد.'))
        setAnnotations([])
        return
      }
      if (response.status === 503) {
        setAnnotationSyncAvailable(false)
        setAnnotationStatus('تعذر الاتصال بإعدادات Supabase للمصحف.')
        setAnnotationError(await readPreviewApiError(response, 'تعذر تحميل الملاحظات من Supabase.'))
        setAnnotations([])
        return
      }
      if (!response.ok) {
        setAnnotationError(await readPreviewApiError(response, 'تعذر تحميل الملاحظات من Supabase.'))
        return
      }

      const payload = await response.json() as { annotations?: MushafAnnotation[] }
      setAnnotations(Array.isArray(payload.annotations) ? payload.annotations : [])
      setAnnotationSyncAvailable(true)
      setNeedsSignIn(false)
    } catch {
      setAnnotationError('تعذر تحميل الملاحظات من Supabase.')
    }
  }

  async function persistAnnotation(
    payload: Record<string, unknown>,
    options?: { mode?: 'create' | 'update'; id?: string }
  ) {
    setIsAnnotationSaving(true)
    setAnnotationError(null)
    try {
      const response = await fetch(
        options?.mode === 'update' && options.id
          ? `/api/mushaf-1441/annotations?id=${encodeURIComponent(options.id)}`
          : '/api/mushaf-1441/annotations',
        {
          method: options?.mode === 'update' ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      if (response.status === 401) {
        setAnnotationSyncAvailable(false)
        setNeedsSignIn(true)
        setAnnotationStatus('سجّل الدخول لحفظ التمييز والملاحظات.')
        return null
      }

      if (response.status === 501) {
        setAnnotationSyncAvailable(false)
        setAnnotationStatus('لم يتم تثبيت جدول Supabase بعد.')
        setAnnotationError(await readPreviewApiError(response, 'لم يتم تثبيت جدول Supabase بعد.'))
        return null
      }

      if (response.status === 503) {
        setAnnotationSyncAvailable(false)
        setAnnotationStatus('تعذر الاتصال بإعدادات Supabase للمصحف.')
        setAnnotationError(await readPreviewApiError(response, 'تعذر حفظ التعديل.'))
        return null
      }

      if (!response.ok) {
        setAnnotationError(await readPreviewApiError(response, 'تعذر حفظ التعديل.'))
        return null
      }

      await loadAnnotationsForPage(pageNumber)
      return await response.json()
    } catch {
      setAnnotationError('تعذر الاتصال بـ Supabase.')
      return null
    } finally {
      setIsAnnotationSaving(false)
    }
  }

  async function deleteAnnotation(annotationId: string) {
    setAnnotationError(null)
    const response = await fetch(`/api/mushaf-1441/annotations?id=${encodeURIComponent(annotationId)}`, {
      method: 'DELETE',
    })

    if (response.status === 401) {
      setAnnotationSyncAvailable(false)
      setAnnotationStatus('تحتاج إلى تسجيل الدخول لحذف التعديلات من Supabase.')
      return false
    }

    if (response.status === 501) {
      setAnnotationSyncAvailable(false)
      setAnnotationStatus('لم يتم تثبيت جدول Supabase بعد.')
      setAnnotationError(await readPreviewApiError(response, 'لم يتم تثبيت جدول Supabase بعد.'))
      return false
    }

    if (response.status === 503) {
      setAnnotationSyncAvailable(false)
      setAnnotationStatus('تعذر الاتصال بإعدادات Supabase للمصحف.')
      setAnnotationError(await readPreviewApiError(response, 'تعذر حذف التعديل.'))
      return false
    }

    if (!response.ok) {
      setAnnotationError(await readPreviewApiError(response, 'تعذر حذف التعديل من Supabase.'))
      return false
    }

    setAnnotationSyncAvailable(true)
    return true
  }

  function setSelectedTarget(target: AnnotationTarget, mode: AnnotationEditorMode = 'note') {
    const hasMutshabehatHighlight = highlightedMutshabehatAyahKeys.has(target.ayahKey)
    setSelectedAyahKey(target.ayahKey)
    setSelectedWord(isWordTarget(target) ? target.word : isWordRangeTarget(target) ? target.endWord : null)
    setSelectedWordRange(isWordRangeTarget(target) ? { startWord: target.startWord, endWord: target.endWord } : null)
    setIsMobileNotesOpen(true)
    setMutshabehatPanelAyahKey(hasMutshabehatHighlight ? target.ayahKey : null)
    setActiveDetailTab(hasMutshabehatHighlight ? 'mutshabehat' : 'notes')
    setAnnotationMode(mode)
    setContextMenu(null)
    setEditingNoteId(null)
  }

  function selectAyah(ayahKey: string) {
    setSelectedTarget({ targetType: 'ayah', ayahKey, pageNumber }, 'note')
  }

  function selectWord(word: MushafWord) {
    setSelectedWordRange(null)
    setSelectedTarget({ targetType: 'word', ayahKey: word.ayahKey, pageNumber: word.pageNumber, word }, 'note')
  }

  function openMutshabehatPopup(ayahKey: string) {
    setMutshabehatPopupAyahKey(ayahKey)
    setExpandedPopupGroups({})
    setContextMenu(null)
  }

  function togglePopupGroup(groupId: string) {
    const willExpand = !expandedPopupGroups[groupId]
    setExpandedPopupGroups((current) => ({ ...current, [groupId]: willExpand }))
    if (willExpand) void loadGroupDetail(groupId)
  }

  async function loadGroupDetail(groupId: string) {
    const existing = groupDetails[groupId]
    if (existing && existing !== 'error') return
    setGroupDetails((current) => ({ ...current, [groupId]: 'loading' }))
    try {
      const response = await fetch(`/api/groups/${groupId}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const { group } = await response.json() as { group: PopupGroup }
      setGroupDetails((current) => ({ ...current, [groupId]: group }))
    } catch {
      setGroupDetails((current) => ({ ...current, [groupId]: 'error' }))
    }
  }

  // Mouse wheel / trackpad turns pages: scroll down → next page, up → previous.
  // One page per gesture — the momentum that follows a turn is ignored.
  function handleWheel(event: ReactWheelEvent) {
    if (event.ctrlKey || isMenuOpen || contextMenu || mutshabehatPopupAyahKey || isMobileNotesOpen) return
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
    if (delta === 0) return
    const state = wheelStateRef.current
    const now = Date.now()
    const gap = now - state.lastEvent
    state.lastEvent = now
    if (now - state.lastTurn < 350 || (gap < 140 && now - state.lastTurn < 1200)) {
      state.accumulated = 0
      return
    }
    state.accumulated += delta
    if (Math.abs(state.accumulated) < WHEEL_TURN_THRESHOLD) return
    const direction = state.accumulated > 0 ? 1 : -1
    state.accumulated = 0
    state.lastTurn = now
    void goToPage(pageNumber + direction)
  }

  function openContextMenu(target: AnnotationTarget, x: number, y: number) {
    setContextMenu({ target, x, y })
  }

  function openWordContextMenu(event: ReactMouseEvent<HTMLButtonElement>, word: MushafWord) {
    event.preventDefault()
    event.stopPropagation()
    openContextMenu({ targetType: 'word', ayahKey: word.ayahKey, pageNumber: word.pageNumber, word }, event.clientX, event.clientY)
  }

  function openAyahContextMenu(event: ReactMouseEvent<HTMLButtonElement>, ayahKey: string) {
    event.preventDefault()
    event.stopPropagation()
    openContextMenu({ targetType: 'ayah', ayahKey, pageNumber }, event.clientX, event.clientY)
  }

  function getSelectedTarget() {
    if (selectedWordRange) {
      return {
        targetType: 'word-range' as const,
        ayahKey: selectedWordRange.startWord.ayahKey,
        pageNumber: selectedWordRange.startWord.pageNumber,
        startWord: selectedWordRange.startWord,
        endWord: selectedWordRange.endWord,
      }
    }
    if (selectedWord) {
      return { targetType: 'word' as const, ayahKey: selectedWord.ayahKey, pageNumber: selectedWord.pageNumber, word: selectedWord }
    }
    if (selectedAyahKey) {
      return { targetType: 'ayah' as const, ayahKey: selectedAyahKey, pageNumber }
    }
    return null
  }

  function getSelectedAyahTarget() {
    if (!selectedAyahKey) return null
    return { targetType: 'ayah' as const, ayahKey: selectedAyahKey, pageNumber }
  }

  function createWordRangeTarget(startWord: MushafWord, endWord: MushafWord): AnnotationTarget {
    return {
      targetType: 'word-range',
      ayahKey: startWord.ayahKey,
      pageNumber: startWord.pageNumber,
      startWord,
      endWord,
    }
  }

  function isWordInsideAnnotationRange(annotation: MushafAnnotation, word: MushafWord) {
    if (annotation.targetType !== 'word-range' || !annotation.wordRangeStartId || !annotation.wordRangeEndId) return false

    const startIndex = pageWordOrder.get(annotation.wordRangeStartId)
    const endIndex = pageWordOrder.get(annotation.wordRangeEndId)
    const wordIndex = pageWordOrder.get(word.id)
    if (startIndex === undefined || endIndex === undefined || wordIndex === undefined) return false

    const min = Math.min(startIndex, endIndex)
    const max = Math.max(startIndex, endIndex)
    return wordIndex >= min && wordIndex <= max
  }

  function buildAnnotationPayload(
    target: AnnotationTarget,
    annotationType: MushafAnnotation['annotationType'],
    extra: Partial<Record<string, unknown>> = {}
  ) {
    return {
      annotationType,
      targetType: target.targetType,
      ayahKey: target.ayahKey,
      pageNumber: target.pageNumber,
      wordId: isWordTarget(target) ? target.word.id : undefined,
      lineNumber: isWordTarget(target) ? target.word.lineNumber : isWordRangeTarget(target) ? target.startWord.lineNumber : undefined,
      wordIndexInLine: isWordTarget(target) ? target.word.wordIndexInLine : isWordRangeTarget(target) ? target.startWord.wordIndexInLine : undefined,
      wordRangeStartId: isWordRangeTarget(target) ? target.startWord.id : undefined,
      wordRangeEndId: isWordRangeTarget(target) ? target.endWord.id : undefined,
      title: typeof extra.title === 'string' ? extra.title.trim() || undefined : undefined,
      body: typeof extra.body === 'string' ? extra.body.trim() || undefined : undefined,
      textColor: typeof extra.textColor === 'string' ? extra.textColor.trim() || undefined : undefined,
      backgroundColor: typeof extra.backgroundColor === 'string' ? extra.backgroundColor.trim() || undefined : undefined,
      tags: Array.isArray(extra.tags) ? extra.tags : [],
      metadata: typeof extra.metadata === 'object' && extra.metadata !== null ? extra.metadata : {},
    }
  }

  function toAyahNote(annotation: MushafAnnotation): AyahNote {
    return {
      id: annotation.id,
      ayahKey: annotation.ayahKey,
      title: annotation.title,
      body: annotation.body ?? '',
      tags: annotation.tags,
      createdAt: annotation.createdAt,
      updatedAt: annotation.updatedAt,
    }
  }

  function findAnnotationForTarget(
    target: AnnotationTarget,
    annotationType: MushafAnnotation['annotationType']
  ) {
    return pageAnnotations.find((annotation) => (
      annotation.annotationType === annotationType
      && annotation.ayahKey === target.ayahKey
      && (
        isWordTarget(target)
          ? annotation.wordId === target.word.id
          : isWordRangeTarget(target)
            ? annotation.wordRangeStartId === target.startWord.id && annotation.wordRangeEndId === target.endWord.id
            : annotation.targetType === 'ayah'
      )
    ))
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = getSelectedTarget()
    if (!target) return
    const body = annotationDraft.body.trim()

    if (annotationMode === 'highlight') {
      await createHighlight(target)
      return
    }

    if (annotationMode === 'bookmark') {
      await toggleBookmark(getSelectedAyahTarget() ?? target)
      return
    }

    if (annotationMode === 'favorite') {
      await toggleFavorite(getSelectedAyahTarget() ?? target)
      return
    }

    if (!body) return

    const payload = buildAnnotationPayload(target, 'note', {
      title: annotationDraft.title,
      body,
      tags: splitTags(annotationDraft.tags),
      textColor: annotationDraft.textColor,
      backgroundColor: annotationDraft.backgroundColor,
      metadata: { source: 'mushaf-1441-preview', editor: 'notes-panel' },
    })

    const saved = await persistAnnotation(
      payload,
      editingNoteId ? { mode: 'update', id: editingNoteId } : { mode: 'create' }
    )

    if (saved) {
      setAnnotationStatus('تم حفظ الملاحظة في Supabase.')
      setEditingNoteId(null)
      setAnnotationDraft(EMPTY_ANNOTATION_DRAFT)
    }
  }

  function editNote(note: MushafAnnotation) {
    const targetWord = note.wordId
      ? visiblePage?.lines.flatMap((line) => line.words).find((word) => word.id === note.wordId) ?? null
      : null
    setSelectedTarget(
      targetWord
        ? { targetType: 'word', ayahKey: note.ayahKey, pageNumber: note.pageNumber, word: targetWord }
        : { targetType: 'ayah', ayahKey: note.ayahKey, pageNumber: note.pageNumber },
      'note'
    )
    setEditingNoteId(note.id)
    setAnnotationDraft({
      title: note.title ?? '',
      body: note.body ?? '',
      tags: note.tags.join(', '),
      textColor: note.textColor ?? '#171717',
      backgroundColor: note.backgroundColor ?? '#fff3c4',
    })
  }

  async function deleteNote(noteId: string) {
    const deleted = await deleteAnnotation(noteId)
    if (!deleted) return

    setEditingNoteId(null)
    setAnnotationDraft(EMPTY_ANNOTATION_DRAFT)
    await loadAnnotationsForPage(pageNumber)
  }

  function cancelEdit() {
    setEditingNoteId(null)
    setAnnotationDraft(EMPTY_ANNOTATION_DRAFT)
  }

  async function toggleBookmark(target: AnnotationTarget) {
    const existing = findAnnotationForTarget(target, 'bookmark')
    if (existing) {
      const deleted = await deleteAnnotation(existing.id)
      if (deleted) await loadAnnotationsForPage(pageNumber)
      return
    }

    await persistAnnotation(buildAnnotationPayload(target, 'bookmark', {
      metadata: { source: 'mushaf-1441-preview', action: 'bookmark' },
    }))
  }

  async function toggleFavorite(target: AnnotationTarget) {
    const existing = findAnnotationForTarget(target, 'favorite')
    if (existing) {
      const deleted = await deleteAnnotation(existing.id)
      if (deleted) await loadAnnotationsForPage(pageNumber)
      return
    }

    await persistAnnotation(buildAnnotationPayload(target, 'favorite', {
      metadata: { source: 'mushaf-1441-preview', action: 'favorite' },
    }))
  }

  async function createHighlight(target: AnnotationTarget) {
    await persistAnnotation(buildAnnotationPayload(target, 'highlight', {
      textColor: annotationDraft.textColor,
      backgroundColor: annotationDraft.backgroundColor,
      metadata: { source: 'mushaf-1441-preview', action: 'highlight' },
    }))
    setAnnotationMode('highlight')
  }

  function inlineAyahMarker(word: MushafWord) {
    if (lastWordIdByAyah.get(word.ayahKey) !== word.id) return null
    const ayahAnnotations = annotationsByAyahKey.get(word.ayahKey) ?? []
    const hasBookmark = ayahAnnotations.some((annotation) => annotation.annotationType === 'bookmark')
    const hasFavorite = ayahAnnotations.some((annotation) => annotation.annotationType === 'favorite')

    return (
      <button
        type="button"
        onClick={() => {
          if (longPressFiredRef.current) {
            longPressFiredRef.current = false
            return
          }
          if (Date.now() - recentTouchRef.current < 700) return
          selectAyah(word.ayahKey)
        }}
        onMouseEnter={() => setHoveredAyahKey(word.ayahKey)}
        onMouseLeave={() => setHoveredAyahKey((current) => (current === word.ayahKey ? null : current))}
        onContextMenu={(event) => openAyahContextMenu(event, word.ayahKey)}
        onTouchStart={(event) => startLongPress({ targetType: 'ayah', ayahKey: word.ayahKey, pageNumber }, event)}
        onTouchMove={cancelLongPress}
        onTouchEnd={() => { cancelLongPress(); recentTouchRef.current = Date.now() }}
        className={`mx-1 inline-flex size-7 items-center justify-center rounded-full border align-middle text-xs font-black transition-colors hover:bg-[#f5d77b] ${
          hasFavorite
            ? 'border-[#8c5f0a] bg-[#fff3c4] text-[#59461d]'
            : hasBookmark
              ? 'border-[#b8871d] bg-[#fff9e9] text-[#59461d]'
              : 'border-[#b99b51] bg-[#fff9e9] text-[#59461d]'
        }`}
        aria-label={`اختيار الآية ${word.ayahKey}`}
      >
        {word.ayahNumber}
      </button>
    )
  }

  function findHighlightAnnotation(word: MushafWord) {
    const wordHighlightAnnotation = (annotationsByWordId.get(word.id) ?? [])
      .find((annotation) => annotation.annotationType === 'highlight')
    const rangeHighlightAnnotation = pageAnnotations.find((annotation) => (
      annotation.annotationType === 'highlight' && isWordInsideAnnotationRange(annotation, word)
    ))
    const ayahHighlightAnnotation = (annotationsByAyahKey.get(word.ayahKey) ?? []).find((annotation) => (
      annotation.annotationType === 'highlight' && annotation.targetType === 'ayah'
    ))
    return wordHighlightAnnotation ?? rangeHighlightAnnotation ?? ayahHighlightAnnotation
  }

  // Background a word shows (same precedence as renderQcfWord), used to colour the gaps.
  function getWordBandColor(word: MushafWord): string | null {
    const annotationColor = findHighlightAnnotation(word)?.backgroundColor
    if (annotationColor) return annotationColor
    if (selectedAyahKey === word.ayahKey) return SELECTION_BG
    const link = mutshabehatHighlightByAyahKey.get(word.ayahKey)
    return link ? tintForGroup(link.groupId ?? link.ayahKey).bg : null
  }

  // The space between two words. On justified lines it grows to fill the line (like
  // justify-between); when both neighbours share a highlight colour the gap takes it, so an
  // ayah's highlight reads as one continuous band instead of separate word marks.
  function renderWordGap(left: MushafWord, right: MushafWord, isCentered: boolean) {
    const leftColor = getWordBandColor(left)
    const color = leftColor && leftColor === getWordBandColor(right) ? leftColor : undefined
    return (
      <span
        aria-hidden="true"
        className={isCentered ? 'w-[0.12em] shrink-0' : 'min-w-[0.06em] flex-1'}
        style={{ height: MUSHAF_WORD_BAND_HEIGHT, backgroundColor: color }}
      />
    )
  }

  function renderQcfWord(word: MushafWord) {
    const isSelectedWord = selectedWord?.id === word.id
    const isHighlightedAyah = selectedAyahKey === word.ayahKey
    const mutshabehatHighlight = mutshabehatHighlightByAyahKey.get(word.ayahKey)
    const isMutshabehatHighlighted = Boolean(mutshabehatHighlight)
    const mutshabehatTint = mutshabehatHighlight ? tintForGroup(mutshabehatHighlight.groupId ?? mutshabehatHighlight.ayahKey) : null
    const showMutshabehatTint = Boolean(mutshabehatTint) && !isSelectedWord && !isHighlightedAyah
    const ayahAnnotations = annotationsByAyahKey.get(word.ayahKey) ?? []
    const highlightAnnotation = findHighlightAnnotation(word)
    const hasAyahBookmark = ayahAnnotations.some((annotation) => annotation.annotationType === 'bookmark')
    const hasAyahFavorite = ayahAnnotations.some((annotation) => annotation.annotationType === 'favorite')
    // QCF glyphs only with this page's own loaded font; otherwise readable Unicode text.
    const useGlyph = isQcfFontLoaded && Boolean(word.glyph)
    const displayText = useGlyph ? word.glyph : (word.textQpcHafs ?? word.textUthmani)
    const fontFamily = useGlyph
      ? `"${qcfFontFamily}", serif`
      : 'var(--font-amiri-quran), "Times New Roman", serif'

    return (
      <button
        key={word.id}
        type="button"
        id={word.wordIndexInAyah === 1 ? navigateToAyah(word.ayahKey).slice(1) : undefined}
        onClick={() => {
          if (longPressFiredRef.current) {
            longPressFiredRef.current = false
            return
          }
          // An ayah that is in your personal mutashabihat opens its card (click or tap).
          if (isMutshabehatHighlighted) {
            openMutshabehatPopup(word.ayahKey)
            return
          }
          // On touch devices a tap does not open details — long-press does.
          if (Date.now() - recentTouchRef.current < 700) return
          selectWord(word)
        }}
        onDoubleClick={() => void copyAyahText(word.ayahKey)}
        onMouseEnter={() => setHoveredAyahKey(word.ayahKey)}
        onMouseLeave={() => setHoveredAyahKey((current) => (current === word.ayahKey ? null : current))}
        onContextMenu={(event) => openWordContextMenu(event, word)}
        onTouchStart={(event) => startLongPress(
          { targetType: 'word', ayahKey: word.ayahKey, pageNumber: word.pageNumber, word },
          event,
        )}
        onTouchMove={cancelLongPress}
        onTouchEnd={() => {
          cancelLongPress()
          const now = Date.now()
          if (now - lastTapRef.current < 300) {
            void copyAyahText(word.ayahKey)
            lastTapRef.current = 0
          } else {
            lastTapRef.current = now
          }
          recentTouchRef.current = now
        }}
        aria-label={`اختيار ${word.charTypeName === 'end' ? 'علامة نهاية الآية' : 'كلمة'} ${word.textUthmani} من الآية ${word.ayahKey}`}
        aria-pressed={isSelectedWord}
        className={`inline rounded-[3px] px-0 py-0 align-baseline transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30 ${
          isSelectedWord
            ? 'bg-[#ece2c8] text-[#171717] ring-1 ring-[#d8c9a3]'
            : highlightAnnotation
              ? ''
            : isHighlightedAyah
              ? 'bg-[#ece2c8] text-[#171717]'
              : isMutshabehatHighlighted
                ? 'cursor-pointer text-[#171717] hover:brightness-95'
                : 'text-[#171717] hover:bg-[#f3ecd9]'
        }`}
        style={{
          fontFamily,
          fontSize: useGlyph ? '1em' : '0.78em',
          lineHeight: 'inherit',
          paddingBlock: MUSHAF_WORD_BAND_PADDING,
          color: highlightAnnotation?.textColor,
          // Highlight band: the word and the gaps next to it (renderWordGap) share one colour.
          backgroundColor: highlightAnnotation?.backgroundColor ?? (showMutshabehatTint ? mutshabehatTint?.bg : undefined),
          borderRadius: showMutshabehatTint || highlightAnnotation ? 0 : undefined,
          boxShadow: hasAyahBookmark || hasAyahFavorite ? 'inset 0 0 0 1px rgba(185,155,81,0.35)' : undefined,
        }}
      >
        <span dangerouslySetInnerHTML={{ __html: displayText ?? '' }} />
      </button>
    )
  }

  // Surah header band: one SVG so frame, cartouche and name scale together and the name is
  // centred by geometry (dominant-baseline), not by a text line box inside a fixed-height div.
  function renderSurahBanner(surahNumber: number) {
    const name = surahNameByNumber.get(surahNumber) ?? `${surahNumber}`
    const ayahCount = surahAyahCountByNumber.get(surahNumber)
    const gradientId = `surah-gold-${surahNumber}`
    const panelId = `surah-panel-${surahNumber}`
    const latticeId = `surah-lattice-${surahNumber}`
    const medallion = (cx: number, label: string) => (
      <g>
        <circle cx={cx} cy={50} r={33} fill="#fffdf6" stroke={`url(#${gradientId})`} strokeWidth={3} />
        <rect x={cx - 19} y={31} width={38} height={38} rx={3} fill="none" stroke="#b8871d" strokeOpacity={0.55} strokeWidth={1.4} />
        <rect x={cx - 19} y={31} width={38} height={38} rx={3} fill="none" stroke="#b8871d" strokeOpacity={0.55} strokeWidth={1.4} transform={`rotate(45 ${cx} 50)`} />
        <text
          x={cx}
          y={50}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#6b531f"
          style={{ fontFamily: 'var(--font-cairo), system-ui, sans-serif', fontSize: 21, fontWeight: 800 }}
        >
          {label}
        </text>
      </g>
    )

    return (
      <div className="flex h-full w-full items-center justify-center" role="heading" aria-level={2} aria-label={`سورة ${name}`}>
        <svg viewBox="0 0 1000 100" preserveAspectRatio="xMidYMid meet" className="block h-[94%] w-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#d6ad55" />
              <stop offset="1" stopColor="#9c7016" />
            </linearGradient>
            <linearGradient id={panelId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fbf0d2" />
              <stop offset="1" stopColor="#efd9a0" />
            </linearGradient>
            <pattern id={latticeId} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 8H16M8 0V16" stroke="#9c7016" strokeOpacity="0.16" strokeWidth="1.3" />
            </pattern>
          </defs>

          {/* Outer band with lattice and an inner hairline rule */}
          <rect x="2" y="3" width="996" height="94" rx="12" fill={`url(#${panelId})`} stroke={`url(#${gradientId})`} strokeWidth="3.5" />
          <rect x="2" y="3" width="996" height="94" rx="12" fill={`url(#${latticeId})`} />
          <rect x="11" y="11" width="978" height="78" rx="7" fill="none" stroke="#9c7016" strokeOpacity="0.42" strokeWidth="1.3" />

          {/* Central cartouche with pointed ends */}
          <path d="M262 15H738Q782 15 806 50Q782 85 738 85H262Q218 85 194 50Q218 15 262 15Z" fill="#fffdf6" stroke={`url(#${gradientId})`} strokeWidth="3" />
          <path d="M266 22H734Q771 22 791 50Q771 78 734 78H266Q229 78 209 50Q229 22 266 22Z" fill="none" stroke="#b8871d" strokeOpacity="0.38" strokeWidth="1.2" />

          {/* Surah number (right, where reading starts) and ayah count (left) */}
          {medallion(928, surahNumber.toLocaleString('ar-EG'))}
          {ayahCount ? medallion(72, ayahCount.toLocaleString('ar-EG')) : null}

          {/* Amiri Quran's tall ascent/descent push a "central" baseline low; an alphabetic
              baseline at y=64 puts the letter bodies on the cartouche's optical centre (y=50). */}
          <text
            x="500"
            y="64"
            textAnchor="middle"
            dominantBaseline="alphabetic"
            fill="#4a3a17"
            style={{ fontFamily: 'var(--font-amiri-quran), "Amiri Quran", serif', fontSize: 50 }}
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
        className="flex h-full items-center justify-center text-[#171717]"
        style={{ fontSize: MUSHAF_QCF_FONT_SIZE, lineHeight: MUSHAF_QCF_LINE_HEIGHT }}
      >
        <span style={{ fontFamily: 'var(--font-amiri-quran), "Times New Roman", serif', fontSize: '0.9em' }}>{BASMALA_TEXT}</span>
      </div>
    )
  }

  function getLineDecorations(page: MushafPage): Map<number, LineDecoration> {
    // Server-computed decorations also cover surahs whose header sits on the previous page.
    if (page.lineDecorations) {
      return new Map(Object.entries(page.lineDecorations).map(([line, decoration]) => [Number(line), decoration]))
    }
    return computeLineDecorations(page)
  }

  function renderPageSkeleton() {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 grid"
        style={{
          gridTemplateRows: 'repeat(15, minmax(0, 1fr))',
          paddingBlock: MUSHAF_PAGE_PRINT_PADDING_Y,
          paddingInline: MUSHAF_PAGE_PRINT_PADDING_X,
        }}
      >
        {Array.from({ length: 15 }, (_, index) => (
          <div key={index} className="flex items-center">
            <div
              className="h-[38%] animate-pulse rounded-full bg-[#efe4c9]"
              style={{ width: index === 14 ? '60%' : '100%', marginInline: 'auto', animationDelay: `${index * 60}ms` }}
            />
          </div>
        ))}
      </div>
    )
  }

  function renderLineWords() {
    const isOpeningPage = pageNumber <= 2
    const isPageReady = Boolean(visiblePage) && (isQcfFontLoaded || isQcfFontFailed)
    const decorations = visiblePage ? getLineDecorations(visiblePage) : new Map<number, LineDecoration>()
    const isRightPage = pageNumber % 2 === 1
    const marginFontSize = 'clamp(8px, 2cqw, 13px)'
    // Al-Fatihah and the start of Al-Baqarah are set as a short centred block in a framed
    // middle area; every other page uses the full 15-line grid.
    const lines = !visiblePage
      ? []
      : isOpeningPage
        ? visiblePage.lines.filter((line) => line.words.length > 0 || decorations.has(line.lineNumber))
        : visiblePage.lines
    const wordCounts = (visiblePage?.lines ?? []).map((line) => line.words.length).filter(Boolean).sort((a, b) => a - b)
    const typicalLineWordCount = wordCounts[Math.floor(wordCounts.length * 0.75)] ?? 0

    return (
      <div
        dir="rtl"
        className="relative select-none overflow-hidden bg-[#fffdf6] shadow-[0_8px_30px_rgba(63,49,21,0.12)] [-webkit-touch-callout:none] sm:rounded-[10px] sm:border sm:border-[#e2d4b3]"
        style={{
          width: MUSHAF_PAGE_WIDTH,
          height: MUSHAF_PAGE_HEIGHT,
          maxWidth: '100%',
          maxHeight: '100%',
          containerType: 'inline-size',
        }}
        onClick={handlePageClick}
        onTouchStart={handlePageTouchStart}
        onTouchEnd={handlePageTouchEnd}
      >
        {/* In-page top margin: juz / hizb / rub + surah name */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-[5.5%] pt-[1.4%] font-bold text-[#9a7b35]"
          style={{ fontSize: marginFontSize }}
        >
          <span className="tabular-nums">
            الجزء {visiblePageMetadata?.juzNumber ?? '—'} · الحزب {visiblePageMetadata?.hizbNumber ?? '—'} · الربع {visiblePageMetadata ? `${visiblePageMetadata.rubInJuz}/8` : '—'}
          </span>
          <span className="truncate">{visiblePageMetadata?.surahNames.join(' · ') ?? ''}</span>
        </div>

        {/* Left / right page indicator tab on the outer edge */}
        <span
          className={`pointer-events-none absolute top-[3.5%] rounded-md bg-[#b8871d] px-2 py-0.5 font-bold text-white ${isRightPage ? 'right-0 rounded-r-none' : 'left-0 rounded-l-none'}`}
          style={{ fontSize: 'clamp(7px,1.7cqw,11px)' }}
        >
          {isRightPage ? 'يُمنى' : 'يُسرى'}
        </span>

        {!visiblePage && !isPageLoading ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <div>
              <p className="text-3xl font-black text-[#80662c]">{pageNumber}</p>
              <p className="mt-3 text-sm leading-7 text-[#665b48]">لا توجد بيانات كلمات لهذه الصفحة.</p>
            </div>
          </div>
        ) : !isPageReady ? (
          renderPageSkeleton()
        ) : (
          /* The mushaf lines, evenly distributed top-to-bottom */
          <div
            className="absolute grid"
            style={isOpeningPage
              ? { inset: '22% 13%', gridTemplateRows: `repeat(${lines.length}, minmax(0, 1fr))` }
              : {
                  inset: 0,
                  gridTemplateRows: 'repeat(15, minmax(0, 1fr))',
                  paddingBlock: MUSHAF_PAGE_PRINT_PADDING_Y,
                  paddingInline: MUSHAF_PAGE_PRINT_PADDING_X,
                }}
          >
            {lines.map((line) => {
              const decoration = decorations.get(line.lineNumber)
              const lastWord = line.words[line.words.length - 1]
              const endsSurah = Boolean(
                lastWord
                && lastWord.charTypeName === 'end'
                && lastWord.ayahNumber === surahAyahCountByNumber.get(lastWord.surahNumber)
              )
              // Justify full lines edge to edge like the printed mushaf; centre short lines.
              const isCentered = isOpeningPage || isQcfFontFailed || (endsSurah && line.words.length < typicalLineWordCount * 0.7)
              return (
                <div
                  key={`${line.pageNumber}-${line.lineNumber}`}
                  className="flex items-center justify-center overflow-visible"
                  style={{ fontSize: MUSHAF_QCF_FONT_SIZE, lineHeight: MUSHAF_QCF_LINE_HEIGHT }}
                  aria-label={`صفحة ${line.pageNumber} سطر ${line.lineNumber}`}
                >
                  {decoration?.surahHeader ? (
                    renderSurahBanner(decoration.surahHeader)
                  ) : decoration?.basmala ? (
                    renderBasmala()
                  ) : line.words.length > 0 ? (
                    <div
                      data-role="line-words"
                      className={`flex w-full items-center whitespace-nowrap [word-spacing:0] ${isCentered ? 'justify-center' : ''}`}
                    >
                      {line.words.map((word, index) => (
                        <Fragment key={word.id}>
                          {renderQcfWord(word)}
                          {index < line.words.length - 1 ? renderWordGap(word, line.words[index + 1], isCentered) : null}
                        </Fragment>
                      ))}
                    </div>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* In-page bottom margin: page number */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center pb-[1.4%] font-black text-[#59461d]"
          style={{ fontSize: marginFontSize }}
        >
          <span className="tabular-nums">{pageNumber}</span>
        </div>

        {isQcfFontFailed ? (
          <p className="absolute inset-x-2 bottom-6 rounded-md border border-[#c07662] bg-[#fff1ed] px-3 py-1 text-center text-[10px] font-bold text-[#8a2f1b]">
            تعذّر تحميل خط المصحف لهذه الصفحة، يُعرض النص بخط بديل.
          </p>
        ) : null}
      </div>
    )
  }

  // Card for an ayah that belongs to your personal mutashabihat: every group containing it,
  // with all similar ayat (colour-coded parts), jump-to-ayah and open/edit group actions.
  function renderMutshabehatPopup() {
    if (!mutshabehatPopupAyahKey) return null
    const [surahNo, ayahNo] = mutshabehatPopupAyahKey.split(':').map(Number)
    const surahName = surahNameByNumber.get(surahNo) ?? ''
    const links = pageHighlights.filter((highlight) => highlight.ayahKey === mutshabehatPopupAyahKey)
    const groupIds = [...new Set(links.map((link) => link.groupId).filter((id): id is string => Boolean(id)))]
    const close = () => setMutshabehatPopupAyahKey(null)

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="mutshabehat-popup-title">
        <button type="button" aria-label="إغلاق" onClick={close} className="absolute inset-0 cursor-default bg-[#2a2111]/40" />
        <section
          className="relative flex max-h-[86dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-[#d7c7a7] bg-[#fffdf8] shadow-[0_24px_60px_-12px_rgba(42,33,17,0.45)] sm:rounded-2xl"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <header className="flex items-start justify-between gap-3 border-b border-[#eadfc9] px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold" style={{ color: PERSONAL_AYAH_HIGHLIGHT.text }}>من متشابهاتك</p>
              <h2 id="mutshabehat-popup-title" className="text-base font-black leading-snug text-[#171717]">
                سورة {surahName} · الآية {Number.isFinite(ayahNo) ? ayahNo.toLocaleString('ar-EG') : ''}
              </h2>
            </div>
            <button
              type="button"
              autoFocus
              onClick={close}
              aria-label="إغلاق البطاقة"
              className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[#d7c7a7] text-xl font-bold text-[#59461d] transition-colors hover:bg-[#fff7df]"
            >
              ×
            </button>
          </header>

          <div className="space-y-2 overflow-y-auto px-4 py-4">
            {groupIds.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#665b48]">لا توجد مجموعة مرتبطة بهذه الآية.</p>
            ) : groupIds.map((groupId) => {
              const link = links.find((candidate) => candidate.groupId === groupId)
              const detail = groupDetails[groupId]
              const isExpanded = Boolean(expandedPopupGroups[groupId])
              const detailsId = `mutshabehat-group-${groupId}`
              return (
                <article key={groupId} className="overflow-hidden rounded-xl border border-[#eadfc9] bg-[#fffdf8]">
                  <h3>
                    <button
                      type="button"
                      onClick={() => togglePopupGroup(groupId)}
                      aria-expanded={isExpanded}
                      aria-controls={detailsId}
                      className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2.5 text-right transition-colors hover:bg-[#fbf5e6]"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-[15px] font-black leading-snug text-[#171717]">
                        <span
                          aria-hidden="true"
                          className="block flex-none rounded-full"
                          style={{
                            width: 12,
                            height: 12,
                            backgroundColor: tintForGroup(groupId).bg,
                            boxShadow: `inset 0 0 0 1.5px ${tintForGroup(groupId).edge}`,
                          }}
                        />
                        <span className="min-w-0">{link?.title ?? 'مجموعة متشابهات'}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-[11px] font-bold tabular-nums text-[#80662c]">
                        {((link?.similarAyat?.length ?? 0) + 1).toLocaleString('ar-EG')} مواضع
                        <svg
                          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                          className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </span>
                    </button>
                  </h3>
                  {isExpanded ? (
                  <div id={detailsId} className="space-y-3 border-t border-[#eadfc9] px-3 pb-3 pt-3">
                  {link?.tags && link.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {link.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-[#f4ecd8] px-2 py-0.5 text-[11px] font-bold text-[#6b531f]">{tag}</span>
                      ))}
                    </div>
                  ) : null}

                  {!detail || detail === 'loading' ? (
                    <div className="space-y-2" aria-busy="true" aria-label="جارٍ تحميل المواضع">
                      {[0, 1].map((index) => (
                        <div key={index} className="h-16 animate-pulse rounded-lg bg-[#f4ecd8]" />
                      ))}
                    </div>
                  ) : detail === 'error' ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#c07662] bg-[#fff1ed] px-3 py-2 text-xs font-bold text-[#8a2f1b]">
                      <span>تعذّر تحميل مواضع هذه المجموعة.</span>
                      <button type="button" onClick={() => void loadGroupDetail(groupId)} className="min-h-9 rounded-md px-2 underline">
                        إعادة المحاولة
                      </button>
                    </div>
                  ) : (
                    <ol className="space-y-2">
                      {detail.verses.map((verse, index) => {
                        const verseSurahNo = surahOptions.find((surah) => surah.name === verse.surah)?.surahNumber ?? null
                        const isCurrent = verseSurahNo !== null && `${verseSurahNo}:${verse.ayah}` === mutshabehatPopupAyahKey
                        return (
                          <li
                            key={`${verse.surah}-${verse.ayah}-${index}`}
                            className="rounded-lg px-3 py-2.5"
                            style={{
                              backgroundColor: isCurrent ? tintForGroup(groupId).bg : '#faf5e8',
                              boxShadow: isCurrent ? `inset 0 0 0 1px ${tintForGroup(groupId).edge}` : undefined,
                            }}
                          >
                            <div className="mb-1 flex items-center justify-between gap-2 text-xs font-bold">
                              <span className="text-[#59461d]">
                                سورة {verse.surah} · {verse.ayah.toLocaleString('ar-EG')}
                                {isCurrent ? <span style={{ color: PERSONAL_AYAH_HIGHLIGHT.text }}> · هذه الآية</span> : null}
                              </span>
                              {!isCurrent && verseSurahNo ? (
                                <button
                                  type="button"
                                  onClick={() => { close(); void goToAyah(verseSurahNo, verse.ayah) }}
                                  className="min-h-9 rounded-md px-2 text-[#80662c] transition-colors hover:bg-[#fff1cf]"
                                >
                                  انتقل إليها ←
                                </button>
                              ) : null}
                            </div>
                            <ArabicDiff parts={verse.parts as Part[]} size="sm" />
                          </li>
                        )
                      })}
                    </ol>
                  )}

                  <div className="flex gap-2">
                    <Link
                      href={`/groups/${groupId}`}
                      className="flex min-h-11 flex-1 items-center justify-center rounded-md bg-[#171717] px-4 text-sm font-bold text-white transition-colors hover:bg-[#3a3326]"
                    >
                      فتح المجموعة
                    </Link>
                    <Link
                      href={`/groups/${groupId}/edit`}
                      className="flex min-h-11 items-center justify-center rounded-md border border-[#b99b51] px-4 text-sm font-bold text-[#3f3215] transition-colors hover:bg-[#fff9e9]"
                    >
                      تعديل
                    </Link>
                  </div>
                  </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </section>
      </div>
    )
  }

  function renderContextMenu() {
    if (!contextMenu) return null

    const targetLabel = isWordTarget(contextMenu.target)
      ? contextMenu.target.word.textUthmani
      : contextMenu.target.ayahKey
    const rangeTarget = isWordTarget(contextMenu.target)
      && selectedWord
      && selectedWord.id !== contextMenu.target.word.id
      && selectedWord.ayahKey === contextMenu.target.word.ayahKey
        ? createWordRangeTarget(selectedWord, contextMenu.target.word)
        : null

    const targetAyahAnnotations = annotationsByAyahKey.get(contextMenu.target.ayahKey) ?? []
    const hasBookmarkOnTarget = targetAyahAnnotations.some((annotation) => annotation.annotationType === 'bookmark')
    const hasFavoriteOnTarget = targetAyahAnnotations.some((annotation) => annotation.annotationType === 'favorite')
    // Bookmark / favourite always act on the whole ayah, even when a word was tapped.
    const ayahTargetForMenu: AnnotationTarget = {
      targetType: 'ayah',
      ayahKey: contextMenu.target.ayahKey,
      pageNumber: contextMenu.target.pageNumber,
    }

    return (
      <div className="fixed inset-0 z-50">
        <button
          type="button"
          aria-label="إغلاق قائمة الخيارات"
          onClick={() => setContextMenu(null)}
          className="absolute inset-0 bg-transparent"
        />
        <div
          className="absolute w-[280px] max-w-[86%] rounded-xl border border-[#d7c7a7] bg-[#fffdf8] p-2 shadow-[0_18px_60px_rgba(23,23,23,0.2)]"
          style={{
            left: Math.max(12, Math.min(contextMenu.x, typeof window !== 'undefined' ? window.innerWidth - 300 : contextMenu.x)),
            top: Math.max(12, Math.min(contextMenu.y, typeof window !== 'undefined' ? window.innerHeight - 260 : contextMenu.y)),
          }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="mb-2 border-b border-[#eadfc9] pb-2">
            <p className="text-[11px] font-bold text-[#80662c]">الاختيار الحالي</p>
            <p className="mt-1 truncate text-sm font-black text-[#171717]">{targetLabel}</p>
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                setSelectedTarget(contextMenu.target, 'note')
                setAnnotationMode('note')
                setContextMenu(null)
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm font-bold text-[#59461d] transition-colors hover:bg-[#fff7df]"
            >
              <span className="flex items-center gap-2"><IconNote className="text-[#80662c]" />ملاحظة</span>
              <span className="text-[11px] text-[#80662c]">Note</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedTarget(contextMenu.target, 'highlight')
                setAnnotationMode('highlight')
                setContextMenu(null)
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm font-bold text-[#59461d] transition-colors hover:bg-[#fff7df]"
            >
              <span className="flex items-center gap-2"><IconHighlight className="text-[#80662c]" />تمييز</span>
              <span className="text-[11px] text-[#80662c]">Highlight</span>
            </button>
            {rangeTarget ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedTarget(rangeTarget, 'highlight')
                  setAnnotationMode('highlight')
                  setContextMenu(null)
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm font-bold text-[#59461d] transition-colors hover:bg-[#fff7df]"
              >
                <span>تمييز نطاق الكلمات</span>
                <span className="text-[11px] text-[#80662c]">Range</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void toggleBookmark(ayahTargetForMenu)
                setContextMenu(null)
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm font-bold text-[#59461d] transition-colors hover:bg-[#fff7df]"
            >
              <span className="flex items-center gap-2"><IconBookmark className={hasBookmarkOnTarget ? 'text-[#8c5f0a]' : 'text-[#80662c]'} />{hasBookmarkOnTarget ? 'إزالة الإشارة' : 'إشارة مرجعية'}</span>
              <span className="text-[11px] text-[#80662c]">Bookmark</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void toggleFavorite(ayahTargetForMenu)
                setContextMenu(null)
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm font-bold text-[#59461d] transition-colors hover:bg-[#fff7df]"
            >
              <span className="flex items-center gap-2"><IconStar filled={hasFavoriteOnTarget} className={hasFavoriteOnTarget ? 'text-[#b8871d]' : 'text-[#80662c]'} />{hasFavoriteOnTarget ? 'إزالة المفضلة' : 'مفضلة'}</span>
              <span className="text-[11px] text-[#80662c]">Favorite</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderNotesPanel(surface: 'desktop' | 'mobile') {
    const suffix = surface === 'desktop' ? 'desktop' : 'mobile'
    const titleId = `mushaf-note-title-${suffix}`
    const bodyId = `mushaf-note-body-${suffix}`
    const tagsId = `mushaf-note-tags-${suffix}`

    return (
      <div className="space-y-4">
        <div className="border-b border-[#eadfc9] pb-4">
          <p className="text-xs font-bold text-[#80662c]">الآية المحددة</p>
          {selectedAyahKey ? (
            <p className="mt-1 text-xl font-black">
              {surahNameByNumber.get(Number(selectedAyahKey.split(':')[0])) ?? ''}
              <span className="text-[#80662c]"> — آية {selectedAyahKey.split(':')[1]}</span>
            </p>
          ) : (
            <p className="mt-1 text-base text-[#665b48]">لم يتم اختيار آية بعد.</p>
          )}
          {selectedWordRange ? (
            <p className="mt-2 font-[family-name:var(--font-amiri-quran)] text-2xl leading-relaxed text-[#171717]">
              {selectedWordRange.startWord.textUthmani} … {selectedWordRange.endWord.textUthmani}
            </p>
          ) : selectedWord ? (
            <p className="mt-2 font-[family-name:var(--font-amiri-quran)] text-2xl leading-relaxed text-[#171717]">
              {selectedWord.textUthmani}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#f4efe6] p-1">
          {[
            ['notes', 'Notes'],
            ['mutshabehat', 'Mutshabehat'],
            ['qiraat', 'Qiraat'],
          ].map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveDetailTab(tab as DetailPanelTab)}
              className={`min-h-11 rounded-md px-2 text-xs font-black transition-colors ${
                activeDetailTab === tab
                  ? 'bg-[#171717] text-white'
                  : 'text-[#59461d] hover:bg-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeDetailTab === 'notes' ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-[#d7c7a7] bg-[#fffaf0] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#80662c]">التعليقات والتمييز</p>
                  <p className="text-xs text-[#665b48]">
                    {annotationSyncAvailable ? 'الحفظ والمزامنة عبر Supabase.' : 'المزامنة غير متاحة حالياً.'}
                  </p>
                </div>
                {editingNoteId ? (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="min-h-11 rounded-md border border-[#b99b51] px-3 text-xs font-bold text-[#59461d] transition-colors hover:bg-white"
                  >
                    إلغاء التعديل
                  </button>
                ) : null}
              </div>

              {annotationStatus ? (
                <p className="mt-3 rounded-md border border-[#b99b51] bg-white px-3 py-2 text-xs font-bold text-[#59461d]">
                  {annotationStatus}
                </p>
              ) : null}
              {annotationError ? (
                <p className="mt-3 rounded-md border border-[#c07662] bg-[#fff1ed] px-3 py-2 text-xs font-bold text-[#8a2f1b]">
                  {annotationError}
                </p>
              ) : null}

              {selectedAyahKey ? (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['note', 'ملاحظة'],
                      ['highlight', 'تمييز'],
                      ['bookmark', 'إشارة'],
                      ['favorite', 'مفضلة'],
                    ].map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAnnotationMode(mode as AnnotationEditorMode)}
                        className={`min-h-11 rounded-md px-3 text-xs font-black transition-colors ${
                          annotationMode === mode ? 'bg-[#171717] text-white' : 'bg-white text-[#59461d] hover:bg-[#fff7df]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void createHighlight(getSelectedTarget() ?? { targetType: 'ayah', ayahKey: selectedAyahKey, pageNumber })}
                      className="min-h-11 rounded-md border border-[#b99b51] px-3 text-xs font-bold text-[#59461d] transition-colors hover:bg-white"
                    >
                      حفظ التمييز
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleBookmark(getSelectedAyahTarget() ?? { targetType: 'ayah', ayahKey: selectedAyahKey, pageNumber })}
                      className="min-h-11 rounded-md border border-[#b99b51] px-3 text-xs font-bold text-[#59461d] transition-colors hover:bg-white"
                    >
                      {bookmarksForSelectedAyah.length > 0 ? 'إزالة الإشارة' : 'إضافة إشارة'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleFavorite(getSelectedAyahTarget() ?? { targetType: 'ayah', ayahKey: selectedAyahKey, pageNumber })}
                      className="min-h-11 rounded-md border border-[#b99b51] px-3 text-xs font-bold text-[#59461d] transition-colors hover:bg-white"
                    >
                      {favoritesForSelectedAyah.length > 0 ? 'إزالة المفضلة' : 'إضافة مفضلة'}
                    </button>
                  </div>

                  {annotationMode === 'highlight' ? (
                    <div className="space-y-3 rounded-md border border-[#eadfc9] bg-white p-3">
                      <div className="flex flex-wrap gap-2">
                        {HIGHLIGHT_COLOR_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setAnnotationDraft((current) => ({
                              ...current,
                              textColor: preset.textColor,
                              backgroundColor: preset.backgroundColor,
                            }))}
                            className="flex min-h-11 items-center gap-2 rounded-md border border-[#d7c7a7] px-3 text-xs font-bold text-[#59461d] transition-colors hover:bg-[#fff7df]"
                          >
                            <span
                              className="inline-block size-4 rounded-full border border-black/10"
                              style={{ backgroundColor: preset.backgroundColor, color: preset.textColor }}
                            />
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1 text-xs font-bold text-[#665b48]">
                          <span>لون النص</span>
                          <input
                            type="color"
                            value={annotationDraft.textColor}
                            onChange={(event) => setAnnotationDraft((current) => ({ ...current, textColor: event.target.value }))}
                            className="h-11 w-full rounded-md border border-[#d7c7a7] bg-white p-1"
                          />
                        </label>
                        <label className="space-y-1 text-xs font-bold text-[#665b48]">
                          <span>لون الخلفية</span>
                          <input
                            type="color"
                            value={annotationDraft.backgroundColor}
                            onChange={(event) => setAnnotationDraft((current) => ({ ...current, backgroundColor: event.target.value }))}
                            className="h-11 w-full rounded-md border border-[#d7c7a7] bg-white p-1"
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {annotationMode === 'bookmark' || annotationMode === 'favorite' ? (
                    <p className="rounded-md border border-[#eadfc9] bg-white px-3 py-2 text-xs leading-6 text-[#665b48]">
                      هذه الآية جاهزة كإشارة مرجعية أو مفضلة عبر الأزرار أعلاه.
                    </p>
                  ) : null}

                  <form onSubmit={saveNote} className="space-y-3">
                    <div>
                      <label htmlFor={titleId} className="mb-1 block text-xs font-bold text-[#665b48]">
                        العنوان
                      </label>
                      <input
                        id={titleId}
                        value={annotationDraft.title}
                        onChange={(event) => setAnnotationDraft((current) => ({ ...current, title: event.target.value }))}
                        className="h-11 w-full rounded-md border border-[#d7c7a7] bg-white px-3 text-sm outline-none transition-shadow focus:ring-4 focus:ring-[#d4af37]/30"
                        placeholder="اختياري"
                      />
                    </div>
                    <div>
                      <label htmlFor={bodyId} className="mb-1 block text-xs font-bold text-[#665b48]">
                        نص الملاحظة
                      </label>
                      <textarea
                        id={bodyId}
                        value={annotationDraft.body}
                        onChange={(event) => setAnnotationDraft((current) => ({ ...current, body: event.target.value }))}
                        className="min-h-28 w-full resize-y rounded-md border border-[#d7c7a7] bg-white px-3 py-2 text-sm leading-7 outline-none transition-shadow focus:ring-4 focus:ring-[#d4af37]/30"
                        placeholder="اكتب ملاحظة لهذه الآية أو الكلمة"
                        required={annotationMode === 'note'}
                      />
                    </div>
                    <div>
                      <label htmlFor={tagsId} className="mb-1 block text-xs font-bold text-[#665b48]">
                        الوسوم
                      </label>
                      <input
                        id={tagsId}
                        value={annotationDraft.tags}
                        onChange={(event) => setAnnotationDraft((current) => ({ ...current, tags: event.target.value }))}
                        className="h-11 w-full rounded-md border border-[#d7c7a7] bg-white px-3 text-sm outline-none transition-shadow focus:ring-4 focus:ring-[#d4af37]/30"
                        placeholder="افصل الوسوم بفواصل"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isAnnotationSaving}
                      className="min-h-11 w-full rounded-md bg-[#171717] px-4 text-sm font-bold text-white transition-colors hover:bg-[#3a3326] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isAnnotationSaving
                        ? 'جاري الحفظ...'
                        : annotationMode === 'highlight'
                          ? 'حفظ التمييز'
                          : annotationMode === 'bookmark'
                            ? 'حفظ الإشارة'
                            : annotationMode === 'favorite'
                              ? 'حفظ المفضلة'
                              : editingNoteId
                                ? 'حفظ التعديل'
                                : 'إضافة ملاحظة'}
                    </button>
                  </form>
                </div>
              ) : (
                <p className="mt-3 rounded-md bg-white px-3 py-4 text-sm leading-7 text-[#665b48]">
                  اختر آية أو كلمة من أعلى الصفحة لفتح لوحة التعليقات.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#80662c]">الملاحظات المحفوظة</p>
                <p className="text-xs text-[#665b48]">
                  {notesForSelectedAyah.length} ملاحظة
                </p>
              </div>
              {notesForSelectedAyah.length > 0 ? (
                notesForSelectedAyah.map((annotation) => {
                  const note = toAyahNote(annotation)
                  return (
                  <article key={note.id} className="rounded-lg border border-[#eadfc9] bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-[#171717]">{note.title || 'ملاحظة بدون عنوان'}</h3>
                        <p className="mt-1 text-[11px] text-[#80662c]">{new Date(note.updatedAt).toLocaleDateString('ar')}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => editNote(annotation)}
                          className="min-h-11 rounded-md border border-[#d7c7a7] px-3 text-xs font-bold text-[#59461d] transition-colors hover:bg-[#fff7df]"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteNote(note.id)}
                          className="min-h-11 rounded-md border border-[#c07662] px-3 text-xs font-bold text-[#8a2f1b] transition-colors hover:bg-[#fff1ed]"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#3a3326]">{note.body}</p>
                    {note.tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {note.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-[#f4efe6] px-2 py-1 text-[11px] font-bold text-[#665b48]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                  )
                })
              ) : (
                <p className="rounded-md bg-[#f4efe6] px-3 py-4 text-sm leading-7 text-[#665b48]">
                  لا توجد ملاحظات لهذه الآية بعد.
                </p>
              )}
            </div>
          </div>
        ) : null}

        {activeDetailTab === 'mutshabehat' ? (
          <div className="rounded-lg border border-[#d7c7a7] bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#80662c]">ربط المتشابهات</p>
                <p className="text-xs text-[#665b48]">
                  {mutshabehatLinkEnabled ? 'مفعل في وضع المعاينة.' : 'معطل افتراضيا عبر feature flag.'}
                </p>
              </div>
              {mutshabehatPanelAyahKey ? (
                <a
                  href={navigateToAyah(mutshabehatPanelAyahKey)}
                  className="min-h-11 rounded-md border border-[#d7c7a7] px-3 py-2 text-xs font-bold text-[#59461d] transition-colors hover:bg-[#fff7df]"
                >
                  موضع الآية
                </a>
              ) : null}
            </div>

            {mutshabehatLoadError ? (
              <p className="mb-3 rounded-md border border-[#c07662] bg-[#fff1ed] px-3 py-2 text-xs font-bold text-[#8a2f1b]">
                {mutshabehatLoadError}
              </p>
            ) : null}

            {mutshabehatLinkEnabled && mutshabehatPanelAyahKey ? (
              mutshabehatPanelLinks.length > 0 ? (
                <div className="space-y-2">
                  {mutshabehatPanelLinks.map((link) => (
                    <article key={`${link.ayahKey}-${link.groupId ?? 'ungrouped'}`} className="rounded-md bg-[#fffaf0] p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-[#171717]">{link.title ?? 'مجموعة متشابهات تجريبية'}</p>
                          <p className="mt-1 font-mono text-xs text-[#80662c]" dir="ltr">{link.ayahKey}</p>
                        </div>
                        {link.groupId ? (
                          <span className="rounded-full bg-[#171717] px-2 py-1 text-[11px] font-bold text-white" dir="ltr">
                            {link.groupId}
                          </span>
                        ) : null}
                      </div>
                      {link.category ? (
                        <p className="mt-2 text-xs font-bold text-[#665b48]">التصنيف: {link.category}</p>
                      ) : null}
                      {link.similarAyat && link.similarAyat.length > 0 ? (
                        <p className="mt-2 text-xs text-[#665b48]" dir="ltr">
                          similarAyat: {link.similarAyat.join(', ')}
                        </p>
                      ) : null}
                      {link.tags && link.tags.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {link.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-[#f4efe6] px-2 py-1 text-[11px] font-bold text-[#665b48]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {link.notes && link.notes.length > 0 ? (
                        <ul className="mt-3 space-y-1 text-xs leading-6 text-[#3a3326]">
                          {link.notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="rounded-md bg-[#f4efe6] px-3 py-4 text-sm leading-7 text-[#665b48]">
                  لا توجد بيانات متشابهات محملة لهذه الآية.
                </p>
              )
            ) : (
              <p className="rounded-md bg-[#f4efe6] px-3 py-4 text-sm leading-7 text-[#665b48]">
                الربط مع قاعدة متشابهات جاهز بنيويا لكنه غير مفعل الآن.
              </p>
            )}
          </div>
        ) : null}

        {activeDetailTab === 'qiraat' ? (
          <div className="rounded-lg border border-[#d7c7a7] bg-white p-3">
            <div className="mb-3">
              <p className="text-xs font-bold text-[#80662c]">Qiraat</p>
              <p className="text-xs text-[#665b48]">
                البنية منفصلة في qiraat-core، ولا توجد بيانات قراءات موثقة محملة بعد.
              </p>
            </div>

            {qiraatVariantsForSelectedAyah.length > 0 ? (
              <div className="space-y-2">
                {qiraatVariantsForSelectedAyah.map((variant) => (
                  <article key={variant.id} className="rounded-md bg-[#fffaf0] p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-[#171717]">{variant.reading}</p>
                      <p className="font-mono text-xs text-[#80662c]" dir="ltr">{variant.ayahKey}</p>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[#3a3326]">{variant.text}</p>
                    {variant.explanation ? (
                      <p className="mt-2 text-xs leading-6 text-[#665b48]">{variant.explanation}</p>
                    ) : null}
                    {variant.source ? (
                      <p className="mt-2 text-[11px] text-[#80662c]">{variant.source}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-md bg-[#f4efe6] px-3 py-4 text-sm leading-7 text-[#665b48]">
                No qiraat data loaded yet.
              </p>
            )}
          </div>
        ) : null}
      </div>
    )
  }

  function renderHoverCard() {
    if (!hoveredAyahKey) return null
    const annos = annotationsByAyahKey.get(hoveredAyahKey) ?? []
    const highlight = annos.find((annotation) => annotation.annotationType === 'highlight')
    const notes = annos.filter((annotation) => annotation.annotationType === 'note')
    const hasBookmark = annos.some((annotation) => annotation.annotationType === 'bookmark')
    const hasFavorite = annos.some((annotation) => annotation.annotationType === 'favorite')
    const mutshabehat = mutshabehatHighlightByAyahKey.get(hoveredAyahKey)
    if (!highlight && notes.length === 0 && !hasBookmark && !hasFavorite && !mutshabehat) return null

    const surahName = surahNameByNumber.get(Number(hoveredAyahKey.split(':')[0])) ?? ''
    const ayahNo = hoveredAyahKey.split(':')[1]

    return (
      <div className="pointer-events-none absolute left-1/2 top-3 z-20 hidden w-[320px] max-w-[92%] -translate-x-1/2 rounded-xl border border-[#d7c7a7] bg-[#fffdf8]/97 p-3 text-right shadow-[0_14px_50px_rgba(23,23,23,0.22)] lg:block">
        <div className="flex items-center justify-between gap-2 border-b border-[#eadfc9] pb-2">
          <span className="text-sm font-black text-[#171717]">{surahName} — آية {ayahNo}</span>
          <span className="flex items-center gap-1.5">
            {hasBookmark ? <IconBookmark className="text-[#8c5f0a]" /> : null}
            {hasFavorite ? <IconStar filled className="text-[#b8871d]" /> : null}
          </span>
        </div>
        {highlight ? (
          <div className="mt-2 flex items-center gap-2 text-xs font-bold text-[#665b48]">
            <span className="inline-block size-4 rounded-full border border-black/10" style={{ backgroundColor: highlight.backgroundColor ?? '#ece2c8' }} />
            <span>تمييز مطبّق</span>
          </div>
        ) : null}
        {notes.length > 0 ? (
          <div className="mt-2 space-y-1">
            <p className="text-[11px] font-bold text-[#80662c]">{notes.length} ملاحظة</p>
            {notes.slice(0, 2).map((note) => (
              <p key={note.id} className="truncate text-xs text-[#3a3326]">• {note.title || note.body || 'ملاحظة'}</p>
            ))}
          </div>
        ) : null}
        {mutshabehat ? (
          <div className="mt-2 border-t border-[#eadfc9] pt-2 text-xs text-[#665b48]">
            <span className="font-bold text-[#8c5f0a]">متشابهات: </span>
            {mutshabehat.similarAyat && mutshabehat.similarAyat.length > 0
              ? <span dir="ltr">{mutshabehat.similarAyat.join('، ')}</span>
              : <span>{mutshabehat.category ?? 'مرتبطة'}</span>}
          </div>
        ) : null}
      </div>
    )
  }

  function renderNavControls() {
    return (
      <div className="space-y-5">
        {/* Surah slider */}
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-bold text-[#80662c]">السورة</span>
            <span className="text-sm font-black text-[#171717]">{selectedSurahNumber}. {selectedSurah?.name}</span>
          </div>
          <input
            type="range"
            min={1}
            max={114}
            value={selectedSurahNumber}
            aria-label="اختيار السورة"
            onChange={(event) => {
              setSelectedSurahNumber(Number(event.target.value))
              setSelectedAyahNumber(1)
            }}
            onPointerUp={() => void jumpToSelectedAyah()}
            onKeyUp={() => void jumpToSelectedAyah()}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e6d8b6] accent-[#171717]"
          />
        </div>

        {/* Ayah slider */}
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-bold text-[#80662c]">الآية</span>
            <span className="text-sm font-black text-[#171717] tabular-nums">{selectedAyahNumber} / {selectedSurahAyahCount}</span>
          </div>
          <input
            type="range"
            min={1}
            max={selectedSurahAyahCount}
            value={Math.min(selectedAyahNumber, selectedSurahAyahCount)}
            aria-label="اختيار رقم الآية"
            onChange={(event) => setSelectedAyahNumber(Number(event.target.value))}
            onPointerUp={() => void jumpToSelectedAyah()}
            onKeyUp={() => void jumpToSelectedAyah()}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e6d8b6] accent-[#171717]"
          />
          <button
            type="button"
            onClick={() => void jumpToSelectedAyah()}
            className="mt-2 min-h-11 w-full rounded-md bg-[#171717] px-4 text-sm font-bold text-white transition-colors hover:bg-[#3a3326]"
          >
            انتقل للآية {selectedSurahNumber}:{selectedAyahNumber}
          </button>
        </div>

        {/* Page slider + prev/next */}
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-bold text-[#80662c]">الصفحة</span>
            <span className="text-sm font-black text-[#171717] tabular-nums">{pageNumber} / {MAX_PAGE}</span>
          </div>
          <input
            type="range"
            min={MIN_PAGE}
            max={MAX_PAGE}
            value={pageNumber}
            aria-label="اختيار الصفحة"
            onChange={(event) => setPageInput(event.target.value)}
            onPointerUp={(event) => void goToPage(Number((event.target as HTMLInputElement).value))}
            onKeyUp={(event) => void goToPage(Number((event.target as HTMLInputElement).value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e6d8b6] accent-[#171717]"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void goToPage(pageNumber - 1)}
              disabled={pageNumber <= MIN_PAGE}
              className="min-h-11 flex-1 rounded-md border border-[#b99b51] px-3 text-sm font-bold text-[#3f3215] transition-colors hover:bg-[#fff9e9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← السابقة
            </button>
            <button
              type="button"
              onClick={() => void goToPage(pageNumber + 1)}
              disabled={pageNumber >= MAX_PAGE}
              className="min-h-11 flex-1 rounded-md border border-[#b99b51] px-3 text-sm font-bold text-[#3f3215] transition-colors hover:bg-[#fff9e9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              التالية →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      dir="rtl"
      className="flex h-[100dvh] flex-col overflow-hidden bg-[#efe7d6] text-[#171717]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Slim top bar — the main screen is the mushaf itself */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#d7c7a7] bg-[#f7f0e0] px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black leading-tight sm:text-base">
            {visiblePageMetadata?.surahNames.join(' · ') ?? 'مصحف المدينة ١٤٤١'}
          </p>
          <p className="text-[11px] font-bold tabular-nums text-[#80662c]" dir="ltr">
            {visiblePageMetadata ? `${visiblePageMetadata.firstAyahKey} → ${visiblePageMetadata.lastAyahKey}` : ''} · ص {pageNumber}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => void goToPage(pageNumber - 1)}
            disabled={pageNumber <= MIN_PAGE}
            aria-label="الصفحة السابقة"
            className="flex size-10 items-center justify-center rounded-md border border-[#b99b51] text-lg font-bold text-[#3f3215] transition-colors hover:bg-[#fff9e9] disabled:opacity-40"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => void goToPage(pageNumber + 1)}
            disabled={pageNumber >= MAX_PAGE}
            aria-label="الصفحة التالية"
            className="flex size-10 items-center justify-center rounded-md border border-[#b99b51] text-lg font-bold text-[#3f3215] transition-colors hover:bg-[#fff9e9] disabled:opacity-40"
          >
            ←
          </button>
          <Link
            href="/"
            aria-label="العودة إلى المتشابهات"
            title="المتشابهات"
            className="flex size-10 items-center justify-center rounded-md border border-[#b99b51] text-[#3f3215] transition-colors hover:bg-[#fff9e9]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 11.5 12 4l9 7.5" />
              <path d="M5.5 10v9a1 1 0 0 0 1 1H10v-5h4v5h3.5a1 1 0 0 0 1-1v-9" />
            </svg>
          </Link>
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            aria-label="القائمة والإعدادات"
            className="flex size-10 items-center justify-center rounded-md bg-[#171717] text-white transition-colors hover:bg-[#3a3326]"
          >
            <span className="flex flex-col gap-[3px]">
              <span className="block h-0.5 w-5 rounded bg-white" />
              <span className="block h-0.5 w-5 rounded bg-white" />
              <span className="block h-0.5 w-5 rounded bg-white" />
            </span>
          </button>
        </div>
      </header>

      {/* The mushaf page fills the screen; swipe to turn pages */}
      <main
        className="relative min-h-0 flex-1"
        style={{ containerType: 'size' }}
        onTouchStart={handlePageTouchStart}
        onTouchEnd={handlePageTouchEnd}
        onWheel={handleWheel}
      >
        <div className="absolute inset-0 flex items-center justify-center p-0 sm:p-3">
          {renderLineWords()}
        </div>
        {renderHoverCard()}
        {isPageLoading || (!isQcfFontLoaded && !isQcfFontFailed) ? (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <span className="rounded-full bg-[#171717]/85 px-3 py-1 text-xs font-bold text-white">جاري التحميل…</span>
          </div>
        ) : null}
      </main>

      {/* Bottom quick surah slider — preview while dragging, navigate on release */}
      {(() => {
        const sliderValue = surahSliderPreview ?? selectedSurahNumber
        const previewName = surahNameByNumber.get(sliderValue) ?? ''
        // RTL slider: value 1 sits on the right, 114 on the left.
        const leftPct = 100 - ((sliderValue - 1) / 113) * 100
        const commit = () => {
          if (surahSliderPreview && surahSliderPreview !== selectedSurahNumber) {
            void goToAyah(surahSliderPreview, 1)
          }
          setSurahSliderPreview(null)
        }
        return (
          <div
            className="relative flex shrink-0 items-center gap-3 border-t border-[#d7c7a7] bg-[#f7f0e0] px-3 py-2"
            style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
          >
            {surahSliderPreview !== null ? (
              <div
                className="pointer-events-none absolute -top-12 z-50 -translate-x-1/2 rounded-xl border border-[#b8871d] bg-[#171717] px-4 py-2 text-center shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
                style={{ left: `clamp(60px, ${leftPct}%, calc(100% - 60px))` }}
              >
                <p className="text-base font-black text-white">{previewName}</p>
                <p className="text-[10px] font-bold text-[#e6d8b6] tabular-nums">سورة {sliderValue}</p>
              </div>
            ) : null}
            <span className="w-24 shrink-0 truncate text-xs font-black text-[#59461d]">
              {sliderValue}. {previewName}
            </span>
            <input
              type="range"
              min={1}
              max={114}
              step={1}
              value={sliderValue}
              aria-label="انتقال سريع للسورة"
              onPointerDown={() => setSurahSliderPreview(selectedSurahNumber)}
              onChange={(event) => setSurahSliderPreview(Number(event.target.value))}
              onPointerUp={commit}
              onPointerCancel={() => setSurahSliderPreview(null)}
              onKeyUp={commit}
              onBlur={() => setSurahSliderPreview(null)}
              className="h-3 flex-1 cursor-pointer appearance-none rounded-full bg-[#e6d8b6] accent-[#171717] [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#171717]"
            />
          </div>
        )
      })()}

      {/* Burger drawer: navigation sliders, account / sign-in, settings */}
      {isMenuOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="إغلاق القائمة"
            onClick={() => setIsMenuOpen(false)}
            className="absolute inset-0 bg-black/35"
          />
          <aside
            className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col gap-5 overflow-y-auto border-l border-[#d7c7a7] bg-[#fffdf8] p-4 shadow-[-18px_0_70px_rgba(23,23,23,0.25)]"
            style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#80662c]">Mushaf 1441</p>
                <h2 className="text-lg font-black">القائمة</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                aria-label="إغلاق"
                className="flex size-10 items-center justify-center rounded-md border border-[#d7c7a7] text-xl font-bold text-[#59461d] hover:bg-[#fff7df]"
              >
                ×
              </button>
            </div>

            {/* Account / sign-in */}
            <div className="rounded-lg border border-[#d7c7a7] bg-[#fffaf0] p-3">
              <p className="text-xs font-bold text-[#80662c]">الحساب</p>
              {needsSignIn ? (
                <>
                  <p className="mt-1 text-xs leading-6 text-[#665b48]">
                    لإضافة تمييز أو ملاحظات أو إشارات أو مفضلة وحفظها، سجّل الدخول أولاً.
                  </p>
                  <a
                    href={SIGN_IN_HREF}
                    className="mt-2 block min-h-11 rounded-md bg-[#171717] px-4 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-[#3a3326]"
                  >
                    تسجيل الدخول
                  </a>
                </>
              ) : annotationSyncAvailable ? (
                <p className="mt-1 text-xs leading-6 text-[#11643f]">مزامنة التمييز والملاحظات مع حسابك مفعّلة.</p>
              ) : (
                <p className="mt-1 text-xs leading-6 text-[#665b48]">{annotationStatus ?? 'المزامنة غير متاحة حالياً.'}</p>
              )}
            </div>

            {/* Navigation sliders */}
            <div className="rounded-lg border border-[#d7c7a7] bg-white p-3">
              <p className="mb-3 text-xs font-bold text-[#80662c]">التنقل</p>
              {renderNavControls()}
            </div>

            {/* Page / font info */}
            <div className="rounded-lg border border-[#d7c7a7] bg-[#fffaf0] p-3 text-xs leading-6 text-[#665b48]">
              <p className="font-bold text-[#80662c]">معلومات الصفحة</p>
              <p className="mt-1">
                الجزء {visiblePageMetadata?.juzNumber ?? '—'} · الحزب {visiblePageMetadata?.hizbNumber ?? '—'} · الربع {visiblePageMetadata ? `${visiblePageMetadata.rubInJuz}/8` : '—'}
              </p>
              <p className="mt-1">{isQcfFontLoaded ? 'خط QCF V2 محمّل.' : isQcfFontFailed ? 'تعذّر تحميل خط QCF V2 لهذه الصفحة.' : 'جاري تحميل خط QCF V2…'}</p>
              <p className="mt-1">{pageNumber % 2 === 1 ? 'الصفحة على الجهة اليمنى.' : 'الصفحة على الجهة اليسرى.'}</p>
              <p className="mt-2 text-[11px] text-[#80662c]">اسحب يميناً/يساراً على الصفحة للتنقل، واضغط مطوّلاً على كلمة أو آية للتمييز والملاحظات.</p>
            </div>
          </aside>
        </div>
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <span className="rounded-full bg-[#171717] px-4 py-2 text-xs font-bold text-white shadow-[0_8px_30px_rgba(0,0,0,0.3)]">{toast}</span>
        </div>
      ) : null}

      {renderContextMenu()}

      {renderMutshabehatPopup()}

      {/* Notes / annotation sheet — opens when an ayah or word is selected */}
      {selectedAyahKey && isMobileNotesOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="إغلاق لوحة الملاحظات"
            onClick={() => setIsMobileNotesOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <section
            className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-2xl border-t border-[#d7c7a7] bg-[#fffdf8] p-4 shadow-[0_-18px_70px_rgba(23,23,23,0.22)] lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[400px] lg:max-h-none lg:rounded-none lg:border-l lg:border-t-0"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="h-1.5 w-12 rounded-full bg-[#d7c7a7] lg:hidden" />
              <button
                type="button"
                onClick={() => setIsMobileNotesOpen(false)}
                className="min-h-11 rounded-md border border-[#d7c7a7] px-3 text-xs font-bold text-[#59461d] transition-colors hover:bg-[#fff7df]"
              >
                إغلاق
              </button>
            </div>
            {needsSignIn ? (
              <a
                href={SIGN_IN_HREF}
                className="mb-3 block min-h-11 rounded-md bg-[#171717] px-4 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-[#3a3326]"
              >
                سجّل الدخول لحفظ التمييز والملاحظات
              </a>
            ) : null}
            {renderNotesPanel('mobile')}
          </section>
        </div>
      ) : null}
    </div>
  )
}
