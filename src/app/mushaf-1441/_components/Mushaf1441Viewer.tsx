'use client'

import { Fragment, memo, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent, type WheelEvent as ReactWheelEvent } from 'react'
import ReactDOM from 'react-dom'
import Link from 'next/link'
import PageCurlOverlay, { type PageCurlHandle, type PageCurlRect } from './PageCurlOverlay'
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
import { defaultQiraatRepository, variantsForToken } from '../../../../packages/qiraat-core/repository'
import { attributionLabelsAr, readingsNotIn } from '../../../../packages/qiraat-core/attribution'
import { getReading, getReadingOrNull, QIRAAT_READINGS } from '../../../../packages/qiraat-core/readings'
import { getReader } from '../../../../packages/qiraat-core/readers'
import { getNarrator, narratorsOfReader } from '../../../../packages/qiraat-core/narrators'
import { QIRAAT_MULTI_READER_COLOR, readerColor, narratorColor } from '../../../../packages/qiraat-core/colors'
import { DIFFERENCE_TYPE_LABELS_AR, BASE_READING, type QiraatVariant, type QiraatRule, type QiraatRuling, type ReadingId } from '../../../../packages/qiraat-core/types'
import QiraatToolbar from './qiraat/QiraatToolbar'
import QiraatLegend from './qiraat/QiraatLegend'
import QiraatReferenceSheet from './qiraat/QiraatReferenceSheet'
import QiraatEditor, { canonicalKeyForWord } from './qiraat/QiraatEditor'
import {
  comparisonMarkerForWord,
  riwayahResolutionForWord,
  rulingMarkerForWord,
  rulingCategoriesOnPage,
  matchesFilter,
  matchesRulingFilter,
  PERFORMANCE_MARKER_COLOR,
  type WordMarker,
  type RulingMarker,
} from './qiraat/qiraatWordMarker'
import { QIRAAT_PREFS_STORAGE_KEY, type QiraatComparisonFilter, type QiraatMode, type QiraatPrefs } from './qiraat/types'
import { impactHaptic } from './haptics'
import {
  type MushafTheme,
  MUSHAF_THEME_STORAGE_KEY,
  THEME_TOKENS,
  tintForGroupWithTheme,
  adaptColorForDark,
  adaptAnnotationForDark,
} from './mushafTheme'

const EMPTY_QIRAAT_VARIANTS: QiraatVariant[] = []
const EMPTY_QIRAAT_RULES: QiraatRule[] = []
const EMPTY_QIRAAT_RULINGS: QiraatRuling[] = []
// Per-device store of which imported loci the user has personally checked against the paper
// original. The import ships everything at REVIEWED; this is how a locus earns VERIFIED.
const QIRAAT_REVIEW_STORAGE_KEY = 'mushaf1441:qiraat-review:v1'
type QiraatReviewVerdict = 'confirmed' | 'rejected'

// Three colour systems want the very same letters — personal annotations (notes, highlight
// colours, bookmarks, favourites), the متشابهات links, and the Qiraat/أصول layer — so the reader
// runs exactly ONE of them at a time. This is a single enum rather than three booleans on purpose:
// three booleans can represent states the reader is not allowed to be in (two layers on at once),
// and every one of those states would have to be defended against separately at each render site.
// It governs more than colour: a press on a word is answered by the active layer and no other.
type ReaderLayer = 'none' | 'annotations' | 'mutshabehat' | 'qiraat'
const READER_LAYER_STORAGE_KEY = 'mushaf1441:reader-layer:v1'
// Superseded by the single key above; read once on first load so a reader who had already chosen
// keeps that choice instead of being reset (see readReaderLayer).
const LEGACY_MUTSHABEHAT_HIGHLIGHT_STORAGE_KEY = 'mushaf1441:mutshabehat-highlight:v1'
const LEGACY_ANNOTATIONS_VISIBLE_STORAGE_KEY = 'mushaf1441:annotations-visible:v1'
const EMPTY_ANNOTATIONS: MushafAnnotation[] = []

function isReaderLayer(value: unknown): value is ReaderLayer {
  return value === 'none' || value === 'annotations' || value === 'mutshabehat' || value === 'qiraat'
}

// Every access try/caught: private windows and blocked site data make these throw.
function readReaderLayer(): ReaderLayer {
  try {
    const stored = window.localStorage.getItem(READER_LAYER_STORAGE_KEY)
    if (isReaderLayer(stored)) return stored
    // One-time migration off the two independent switches. Only an explicit "annotations on,
    // متشابهات off" can have meant the annotation layer; anything else lands on متشابهات, which
    // is both this app's reason to exist and what the mushaf showed before either switch existed.
    const annotations = window.localStorage.getItem(LEGACY_ANNOTATIONS_VISIBLE_STORAGE_KEY)
    const mutshabehat = window.localStorage.getItem(LEGACY_MUTSHABEHAT_HIGHLIGHT_STORAGE_KEY)
    if (annotations === '1' && mutshabehat === '0') return 'annotations'
  } catch {
    // Storage unavailable — fall through to the default.
  }
  return 'mutshabehat'
}

function readMushafTheme(): MushafTheme {
  if (typeof window === 'undefined') return 'sepia'
  try {
    const stored = window.localStorage.getItem(MUSHAF_THEME_STORAGE_KEY)
    if (stored === 'sepia' || stored === 'dark' || stored === 'white') return stored
  } catch {
    // Storage unavailable
  }
  return 'sepia'
}

/** What the permanent Qiraat sidebar is currently explaining. */
interface QiraatSelection {
  word: MushafWord
  rulings: QiraatRuling[]
  variants: QiraatVariant[]
}

/** A locus key that is stable across rebuilds: position, not record id. */
function qiraatLocusKey(surah: number, ayah: number, token: number): string {
  return `${surah}:${ayah}:${token}`
}

/** Review-mode ring: green once confirmed, red once rejected, amber while untouched. */
function qiraatReviewRingColor(
  variantMarker: WordMarker | null,
  rulingMarker: RulingMarker | null,
  review: Record<string, QiraatReviewVerdict>,
): string {
  const source = variantMarker?.variants[0] ?? rulingMarker?.rulings[0]
  if (!source) return 'rgba(185,155,81,0.5)'
  const verdict = review[qiraatLocusKey(source.surah, source.ayah, source.startToken)]
  if (verdict === 'confirmed') return '#16A34A'
  if (verdict === 'rejected') return '#DC2626'
  return '#D97706'
}

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

// Two-page spread like an open mushaf on wide landscape screens (desktop, iPad landscape).
const SPREAD_MEDIA_QUERY = '(min-width: 1024px) and (orientation: landscape)'
function subscribeToSpreadQuery(onChange: () => void) {
  const query = window.matchMedia(SPREAD_MEDIA_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const getSpreadSnapshot = () => window.matchMedia(SPREAD_MEDIA_QUERY).matches
const getSpreadServerSnapshot = () => false

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
// In a spread each page takes half the width (minus the spine gap) at the printed ratio.
const MUSHAF_SPREAD_PAGE_WIDTH = 'min(calc(50cqw - 4px), calc(100cqh * 1994 / 2850))'
const MUSHAF_SPREAD_PAGE_HEIGHT = 'min(100cqh, calc(min(calc(50cqw - 4px), calc(100cqh * 1994 / 2850)) * 2850 / 1994))'
const MUSHAF_PAGE_PRINT_PADDING_X = '7.2%'
const MUSHAF_PAGE_PRINT_PADDING_Y = '5.8%'
const MUSHAF_QCF_FONT_SIZE = '4.35cqw'
const MUSHAF_QCF_LINE_HEIGHT = 1.04
// Word box = line height + vertical padding; gaps use the same height so highlight bands are flush.
const MUSHAF_WORD_BAND_PADDING = '0.08em'
const MUSHAF_WORD_BAND_HEIGHT = `calc(${MUSHAF_QCF_LINE_HEIGHT}em + 0.16em)`
// A horizontal drag this long (px) starts curling the page under the finger.
const DRAG_START_PX = 12

type PageLayout = 'single' | 'right' | 'left'
type PageTurn = {
  id: number
  mode: 'auto' | 'drag'
  fromPage: number
  /** Slot group (page, or a spread's right page) the turn starts from; kept mounted until it ends. */
  fromGroup: number
  leaf: PageCurlRect
  peelFrom: 'left' | 'right'
  travel: number
  front: HTMLElement
  still: HTMLElement | null
  /** Incoming page printed on the back of the turning sheet (spread only; a single page's back is paper). */
  backPageNo: number | null
  /** Where that incoming page sits (the other half of the spread), measured before the turn. */
  backRect: PageCurlRect | null
}

type MushafPageSlotProps = {
  pageNo: number
  layout: PageLayout
  page: MushafPage | null
  metadata: Mushaf1441PageMetadata | null
  fontStatus: QcfFontStatus | undefined
  highlights: unknown
  annotations: unknown
  qiraat: unknown
  selection: string
  loading: boolean
  theme: MushafTheme
  render: () => ReactNode
}

// One mushaf page. It re-renders only when that page's own inputs change, so turning to an
// already-mounted neighbour is a visibility swap instead of rebuilding hundreds of words.
// `render` is intentionally excluded from the comparison: its output depends only on the other props.
const MushafPageSlot = memo(
  function MushafPageSlot({ render }: MushafPageSlotProps) {
    return render()
  },
  (prev, next) => prev.pageNo === next.pageNo
    && prev.layout === next.layout
    && prev.page === next.page
    && prev.metadata === next.metadata
    && prev.fontStatus === next.fontStatus
    && prev.highlights === next.highlights
    && prev.annotations === next.annotations
    && prev.qiraat === next.qiraat
    && prev.selection === next.selection
    && prev.loading === next.loading
    && prev.theme === next.theme,
)
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
  ReactDOM.preconnect('https://verses.quran.foundation', { crossOrigin: 'anonymous' })
  ReactDOM.preload(getQcfV2FontUrl(initialPage.pageNumber), {
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous',
    fetchPriority: 'high',
  })

  const [pageNumber, setPageNumber] = useState(initialPage.pageNumber)
  const [pageInput, setPageInput] = useState(String(initialPage.pageNumber))
  const [currentPage, setCurrentPage] = useState<MushafPage | null>(initialPage)
  const [pageCache, setPageCache] = useState<Record<number, MushafPage>>({
    [initialPage.pageNumber]: initialPage,
  })
  const pageCacheRef = useRef<Record<number, MushafPage>>({
    [initialPage.pageNumber]: initialPage,
  })
  const pageWordsRequestsRef = useRef(new Map<number, Promise<MushafPage>>())
  const [currentPageMetadata, setCurrentPageMetadata] = useState<Mushaf1441PageMetadata>(initialPageMetadata)
  const [pageMetadataCache, setPageMetadataCache] = useState<Record<number, Mushaf1441PageMetadata>>({
    [initialPageMetadata.pageNumber]: initialPageMetadata,
  })
  const pageMetadataCacheRef = useRef<Record<number, Mushaf1441PageMetadata>>({
    [initialPageMetadata.pageNumber]: initialPageMetadata,
  })
  const pageMetadataRequestsRef = useRef(new Map<number, Promise<Mushaf1441PageMetadata>>())
  const [isPageLoading, setIsPageLoading] = useState(false)
  // Per-page QCF V2 font state. Render the readable Uthmani fallback immediately, then swap
  // each page to its page-specific private-use glyphs only after THAT page's font is loaded.
  const [qcfFontStatus, setQcfFontStatus] = useState<Record<number, QcfFontStatus>>({})
  const qcfFontStatusRef = useRef<Record<number, QcfFontStatus>>({})
  const [selectedSurahNumber, setSelectedSurahNumber] = useState(initialPageMetadata.surahNumbers[0] ?? 1)
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
  const [annotationStatus, setAnnotationStatus] = useState<string | null>(null)
  const [annotationError, setAnnotationError] = useState<string | null>(null)
  const [isAnnotationSaving, setIsAnnotationSaving] = useState(false)
  const [annotationSyncAvailable, setAnnotationSyncAvailable] = useState(true)
  const [allMutshabehatHighlights, setAllMutshabehatHighlights] = useState<MutshabehatAyahLink[] | null>(initialMutshabehatHighlights)
  const [mutshabehatLoadError, setMutshabehatLoadError] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSurahPickerOpen, setIsSurahPickerOpen] = useState(false)
  const [surahPickerSearch, setSurahPickerSearch] = useState('')
  const currentSurahItemRef = useRef<HTMLButtonElement | null>(null)
  const [needsSignIn, setNeedsSignIn] = useState(false)
  const [hoveredAyahKey, setHoveredAyahKey] = useState<string | null>(null)
  // Preview of a Qiraat marker on hover (desktop) or first tap (mobile) — Part 20's "never rely on
  // color alone." A second tap/click on the SAME already-peeked word opens the full detail panel.
  const [hoveredQiraatWord, setHoveredQiraatWord] = useState<{ word: MushafWord; marker: WordMarker } | null>(null)
  const [hoveredQiraatSelection, setHoveredQiraatSelection] = useState<QiraatSelection | null>(null)
  const [hoveredQiraatFocusWord, setHoveredQiraatFocusWord] = useState<MushafWord | null>(null)
  // Word buttons live inside a memoized MushafPageSlot that intentionally does not re-render on
  // this state alone (only the sibling popup does) — so a word's own onClick closure can be stale.
  // This ref mirrors the state and is always read fresh, so the peek/open-detail decision in
  // onClick is correct even when the page slot hasn't re-rendered since the peek was set.
  const hoveredQiraatWordIdRef = useRef<string | null>(null)
  function updateHoveredQiraatWord(value: { word: MushafWord; marker: WordMarker } | null) {
    hoveredQiraatWordIdRef.current = value?.word.id ?? null
    setHoveredQiraatWord(value)
    if (!value) {
      setHoveredQiraatSelection(null)
      setHoveredQiraatFocusWord(null)
    }
  }
  const [toast, setToast] = useState<string | null>(null)
  const [pageSliderPreview, setPageSliderPreview] = useState<number | null>(null)
  const [mutshabehatPopupAyahKey, setMutshabehatPopupAyahKey] = useState<string | null>(null)
  const [groupDetails, setGroupDetails] = useState<Record<string, PopupGroup | 'loading' | 'error'>>({})
  // Groups in the ayah card start collapsed (title only); tapping a title expands its details.
  const [expandedPopupGroups, setExpandedPopupGroups] = useState<Record<string, boolean>>({})

  // Which of the three colour systems owns the page right now. `readReaderLayer` is not used as
  // the initial value: it touches localStorage, which the server render cannot, so it is read in
  // an effect after mount (same pattern as the other reader preferences below).
  const [readerLayer, setReaderLayer] = useState<ReaderLayer>('mutshabehat')
  const readerLayerRef = useRef<ReaderLayer>('mutshabehat')
  useEffect(() => { readerLayerRef.current = readerLayer }, [readerLayer])
  const annotationsVisible = readerLayer === 'annotations'
  const mutshabehatHighlightEnabled = readerLayer === 'mutshabehat'
  // Which panel the detail sheet shows is not a separate choice the reader makes any more — it
  // follows the layer, so the sheet can never show متشابهات links while the page is painted with
  // Qiraat. A plain mushaf (no layer) still opens the notes panel: that is what a press means
  // when no colour system owns the page.
  const activeDetailTab: DetailPanelTab = readerLayer === 'qiraat'
    ? 'qiraat'
    : readerLayer === 'mutshabehat' ? 'mutshabehat' : 'notes'

  // Mushaf Appearance & Theme (Sepia / Dark / White)
  const [mushafTheme, setMushafTheme] = useState<MushafTheme>('sepia')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const currentThemeTokens = THEME_TOKENS[mushafTheme]

  function switchMushafTheme(nextTheme: MushafTheme) {
    setMushafTheme(nextTheme)
    try {
      window.localStorage.setItem(MUSHAF_THEME_STORAGE_KEY, nextTheme)
    } catch { /* ignore */ }
  }

  // Qiraat Ashr state model (Part 23). Persisted locally like other reader preferences.
  // Which Qiraat mode the burger panel last selected. Kept apart from `readerLayer` so that
  // leaving the layer and coming back returns the reader to the mode they were in, rather than
  // silently resetting them to مقارنة القراءات.
  const [qiraatSubMode, setQiraatSubMode] = useState<Exclude<QiraatMode, 'normal'>>('comparison')
  const [qiraatEditMode, setQiraatEditMode] = useState(false)
  const [qiraatEditorWord, setQiraatEditorWord] = useState<MushafWord | null>(null)
  const [qiraatEditorDesktop, setQiraatEditorDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches)
  const [qiraatScopeMode, setQiraatScopeMode] = useState<'RANGE' | 'BOUNDARY' | null>(null)
  const [qiraatScopeStart, setQiraatScopeStart] = useState<MushafWord | null>(null)
  const [qiraatScopePreview, setQiraatScopePreview] = useState<{ startCanonicalKey: string; endCanonicalKey: string; scopeType: 'RANGE' | 'BOUNDARY' } | undefined>(undefined)
  const qiraatScopeModeRef = useRef<'RANGE' | 'BOUNDARY' | null>(null)
  const qiraatScopeStartRef = useRef<MushafWord | null>(null)
  // The single source of truth every render site reads: Qiraat is on only while it owns the layer,
  // so no code path can paint Qiraat colours over متشابهات or annotations.
  const qiraatMode: QiraatMode = readerLayer === 'qiraat' ? qiraatSubMode : 'normal'
  const [qiraatSelectedReadingId, setQiraatSelectedReadingId] = useState<ReadingId>(BASE_READING)
  const [qiraatStudyMode, setQiraatStudyMode] = useState(false)
  const [qiraatShowDiffFromHafs, setQiraatShowDiffFromHafs] = useState(false)
  const [qiraatFilter, setQiraatFilter] = useState<QiraatComparisonFilter>({ kind: 'all' })
  // Defaults ON: none of the imported Qiraat data has reached VERIFIED/PUBLISHED yet, so leaving
  // this off would mean nothing ever appears without a manual per-session toggle.
  const [qiraatIncludeReviewed, setQiraatIncludeReviewed] = useState(true)
  const [qiraatLegendOpen, setQiraatLegendOpen] = useState(false)
  // المرجع: القرّاء العشرة ورموز الشاطبية والدرة — its own sheet, like the legend.
  const [qiraatReferenceOpen, setQiraatReferenceOpen] = useState(false)
  // Keyed `${page}:${includeReviewed ? 1 : 0}` so toggling the debug flag never serves stale data.
  const [qiraatVariantsByPage, setQiraatVariantsByPage] = useState<Record<string, QiraatVariant[]>>({})
  const qiraatVariantsByPageRef = useRef<Record<string, QiraatVariant[]>>({})
  // Page-level rules (عدّ الآي, الإدغام الكبير, أوجه الوصل بين السورتين, …) — a separate domain from
  // per-word variants (see the QiraatRule doc comment in packages/qiraat-core/types.ts), fetched
  // and cached alongside them from the same /api/mushaf-1441/qiraat response.
  const [qiraatRulesByPage, setQiraatRulesByPage] = useState<Record<string, QiraatRule[]>>({})
  const qiraatRulesByPageRef = useRef<Record<string, QiraatRule[]>>({})
  // Per-occurrence أصول rulings — the ones that colour a word without changing its rasm.
  const [qiraatRulingsByPage, setQiraatRulingsByPage] = useState<Record<string, QiraatRuling[]>>({})
  const [resolvedQiraatByPage, setResolvedQiraatByPage] = useState<Record<number, Array<{ canonical_word_key: string; target_authority_id: string; resolved_face_count: number; has_multiple_faces: boolean; resolved_color: string | null }>>>({})
  const resolvedQiraatRequestsRef = useRef(new Map<number, Promise<Array<{ canonical_word_key: string; target_authority_id: string; resolved_face_count: number; has_multiple_faces: boolean; resolved_color: string | null }>>>() )
  const qiraatRulingsByPageRef = useRef<Record<string, QiraatRuling[]>>({})
  const qiraatRequestsRef = useRef(new Map<string, Promise<{ variants: QiraatVariant[]; rules: QiraatRule[]; rulings: QiraatRuling[] }>>())
  // أصول colouring is its own toggle: a reader who knows the rules may not want the page tinted.
  const [qiraatShowUsul, setQiraatShowUsul] = useState(true)
  const [qiraatDisabledCategories, setQiraatDisabledCategories] = useState<string[]>([])
  // Location-review mode (Part: "confirm the locations after import").
  const [qiraatReviewMode, setQiraatReviewMode] = useState(false)
  // What the permanent sidebar explains: set by clicking any Qiraat/أصول-marked word. Deliberately
  // NOT part of any MushafPageSlot prop, so selecting a word never re-renders a page slot and the
  // ~1 ms page-turn invariant holds (same rule as hoveredAyahKey / hoveredQiraatWord).
  const [qiraatSelection, setQiraatSelection] = useState<QiraatSelection | null>(null)
  const [qiraatReview, setQiraatReview] = useState<Record<string, QiraatReviewVerdict>>({})
  const wheelStateRef = useRef({ accumulated: 0, lastTurn: 0, lastEvent: 0 })
  const isSpread = useSyncExternalStore(subscribeToSpreadQuery, getSpreadSnapshot, getSpreadServerSnapshot)
  const lastTapRef = useRef(0)

  const pageStageRef = useRef<HTMLDivElement | null>(null)
  const pageMainRef = useRef<HTMLElement | null>(null)
  const [pageTurn, setPageTurn] = useState<PageTurn | null>(null)
  const pageTurnIdRef = useRef(0)
  const curlRef = useRef<PageCurlHandle | null>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; lastX: number; lastTime: number; velocity: number; direction: 1 | -1 | 0; progress: number; width: number } | null>(null)
  const suppressClickRef = useRef(false)
  // Page slots are memoized, so their event handlers call through this ref to reach the latest closures.
  const liveRef = useRef({ handlePageClick, handleSpreadPageClick, openMutshabehatPopup, selectWord, selectWordForQiraat, copyAyahText, openWordContextMenu, startLongPress, cancelLongPress })
  useLayoutEffect(() => {
    liveRef.current = { handlePageClick, handleSpreadPageClick, openMutshabehatPopup, selectWord, selectWordForQiraat, copyAyahText, openWordContextMenu, startLongPress, cancelLongPress }
  })
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
  // Surah starts sorted by page, for naming the surah shown on any page.
  const surahStarts = useMemo(
    () => surahOptions
      .filter((surah) => surah.firstPage !== null)
      .map((surah) => ({ page: surah.firstPage as number, surahNumber: surah.surahNumber, name: surah.name }))
      .sort((a, b) => a.page - b.page || a.surahNumber - b.surahNumber),
    [surahOptions],
  )
  const surahStartForPage = (page: number) => {
    let found = surahStarts[0]
    for (const start of surahStarts) {
      if (start.page > page) break
      found = start
    }
    return found
  }
  const surahAyahCountByNumber = useMemo(() => {
    const map = new Map<number, number>()
    for (const surah of surahOptions) map.set(surah.surahNumber, surah.ayahCount)
    return map
  }, [surahOptions])

  const filteredSurahOptions = useMemo(() => {
    const q = surahPickerSearch.trim().toLowerCase()
    if (!q) return surahOptions
    const norm = (str: string) =>
      str
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[إأآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
        .toLowerCase()
    const cleanQ = norm(q)
    return surahOptions.filter((surah) => {
      if (String(surah.surahNumber) === cleanQ || String(surah.firstPage) === cleanQ) return true
      if (String(surah.surahNumber).includes(cleanQ)) return true
      const cleanName = norm(surah.name)
      return cleanName.includes(cleanQ)
    })
  }, [surahOptions, surahPickerSearch])

  useEffect(() => {
    if (!isSurahPickerOpen) return
    const timer = setTimeout(() => {
      currentSurahItemRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' })
    }, 60)
    return () => clearTimeout(timer)
  }, [isSurahPickerOpen])

  useEffect(() => {
    if (!isSurahPickerOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsSurahPickerOpen(false)
        setSurahPickerSearch('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSurahPickerOpen])

  async function selectSurahFromPicker(surah: Mushaf1441SurahOption) {
    setIsSurahPickerOpen(false)
    setSurahPickerSearch('')
    setSelectedSurahNumber(surah.surahNumber)
    if (surah.firstPage) {
      await goToPage(surah.firstPage, `${surah.surahNumber}:1`)
    } else {
      await goToAyah(surah.surahNumber, 1)
    }
  }

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
    const timer = setTimeout(() => { void goToPage(savedPage as number, undefined, { animate: false }) }, 0)
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

  // In a spread, also load notes/highlights for the other page of the spread.
  useEffect(() => {
    if (!isSpread) return
    const companion = pageNumber % 2 === 1 ? pageNumber + 1 : pageNumber - 1
    if (companion >= MIN_PAGE && companion <= MAX_PAGE) void loadAnnotationsForPage(companion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, isSpread])

  useEffect(() => {
    // Prefetch neighbours so flipping to the next/previous page is instant.
    void prefetchPage(pageNumber + 1)
    void prefetchPage(pageNumber - 1)
    if (isSpread) {
      // Both pages of the next and previous spreads, so their mounted slots are ready before a turn.
      const spreadStart = pageNumber % 2 === 1 ? pageNumber : pageNumber - 1
      for (const page of [spreadStart + 2, spreadStart + 3, spreadStart - 2, spreadStart - 1]) void prefetchPage(page)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, isSpread])

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

  useEffect(() => {
    setReaderLayer(readReaderLayer())
    setMushafTheme(readMushafTheme())
  }, [])

  // The ONE place the active layer changes. Switching layers also drops whatever the previous one
  // had open — a متشابهات card, a notes sheet, a Qiraat peek — so the reader never ends up looking
  // at a panel belonging to a layer that is no longer on.
  function activateLayer(next: ReaderLayer) {
    setReaderLayer(next)
    if (next !== 'qiraat') setQiraatEditMode(false)
    try {
      window.localStorage.setItem(READER_LAYER_STORAGE_KEY, next)
    } catch { /* ignore */ }
    setContextMenu(null)
    setMutshabehatPopupAyahKey(null)
    setIsMobileNotesOpen(false)
    updateHoveredQiraatWord(null)
    if (next !== 'qiraat') setQiraatSelection(null)
    if (next === 'qiraat') {
      setSelectedAyahKey(null)
      setSelectedWord(null)
      setSelectedWordRange(null)
    }
  }

  // A press on an already-active button turns that layer off (plain mushaf, no colour system).
  function toggleLayer(layer: Exclude<ReaderLayer, 'none'>) {
    activateLayer(readerLayer === layer ? 'none' : layer)
  }

  function toggleQiraatEditMode() {
    setQiraatEditMode((current) => !current)
    setQiraatSelection(null)
    updateHoveredQiraatWord(null)
  }

  // The burger panel's mode select. Choosing المصحف leaves the layer entirely; choosing either
  // Qiraat mode both records the sub-mode and claims the layer, so the panel and the "ق" button
  // can never disagree about whether Qiraat is on.
  function applyQiraatMode(mode: QiraatMode) {
    if (mode === 'normal') {
      activateLayer(readerLayer === 'qiraat' ? 'none' : readerLayer)
      return
    }
    setQiraatSubMode(mode)
    if (readerLayer !== 'qiraat') activateLayer('qiraat')
  }

  // Location-review verdicts are per-device (localStorage), like the other reader preferences.
  // Wrapped in try/catch: private windows and blocked site data make these throw.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(QIRAAT_REVIEW_STORAGE_KEY)
      if (raw) setQiraatReview(JSON.parse(raw) as Record<string, QiraatReviewVerdict>)
    } catch { /* storage unavailable — review simply starts empty */ }
  }, [])

  function setQiraatVerdict(key: string, verdict: QiraatReviewVerdict | null) {
    setQiraatReview((current) => {
      const next = { ...current }
      if (verdict === null) delete next[key]
      else next[key] = verdict
      try {
        window.localStorage.setItem(QIRAAT_REVIEW_STORAGE_KEY, JSON.stringify(next))
      } catch { /* ignore */ }
      return next
    })
  }

  function exportQiraatReview() {
    const blob = new Blob([JSON.stringify(qiraatReview, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'qiraat-review.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  // The Qiraat peek closes on any click, on the popup itself or elsewhere — the marked word's own
  // click stops propagation (see its onClick) so opening/switching a peek is never immediately
  // undone by this same listener.
  useEffect(() => {
    if (!hoveredQiraatWord) return
    function onDocumentClick() {
      updateHoveredQiraatWord(null)
    }
    document.addEventListener('click', onDocumentClick)
    return () => document.removeEventListener('click', onDocumentClick)
  }, [hoveredQiraatWord])

  const visiblePage = currentPage?.pageNumber === pageNumber ? currentPage : null
  const visiblePageMetadata = currentPageMetadata.pageNumber === pageNumber ? currentPageMetadata : null
  // Spread: odd page on the right, its even partner on the left. `pageNumber` stays the page
  // the user navigated to (URL, header); the companion is the other half of the spread.
  const companionPageNumber = isSpread ? (pageNumber % 2 === 1 ? pageNumber + 1 : pageNumber - 1) : null
  const hasCompanion = companionPageNumber !== null && companionPageNumber >= MIN_PAGE && companionPageNumber <= MAX_PAGE
  const companionPage = hasCompanion ? pageCache[companionPageNumber as number] ?? null : null
  const isQcfFontLoaded = qcfFontStatus[pageNumber] === 'loaded'
  const isQcfFontFailed = qcfFontStatus[pageNumber] === 'error'
  // Mounted page slots: the current page/spread plus its neighbours on each side (computed from the
  // deferred page number, so newly needed neighbours mount after the turn has painted).
  const deferredPageNumber = useDeferredValue(pageNumber)
  const slotGroups = useMemo(() => {
    const groupOf = (page: number) => (isSpread ? (page % 2 === 1 ? page : page - 1) : page)
    const step = isSpread ? 2 : 1
    const lastGroup = isSpread ? MAX_PAGE - 1 : MAX_PAGE
    const center = groupOf(deferredPageNumber)
    const groups = new Set([center - step, center, center + step, groupOf(pageNumber)])
    if (pageTurn) groups.add(pageTurn.fromGroup)
    return [...groups].filter((group) => group >= MIN_PAGE && group <= lastGroup).sort((a, b) => a - b)
  }, [deferredPageNumber, isSpread, pageNumber, pageTurn])
  const ayahKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const shownPage of [visiblePage, companionPage]) {
      for (const line of shownPage?.lines ?? []) {
        for (const word of line.words) keys.add(word.ayahKey)
      }
    }
    return [...keys]
  }, [visiblePage, companionPage])
  const lastWordIdByAyah = useMemo(() => {
    const lastWords = new Map<string, string>()
    const shownPages = [visiblePage, companionPage].filter(Boolean) as MushafPage[]
    shownPages.sort((a, b) => a.pageNumber - b.pageNumber)
    for (const shownPage of shownPages) {
      for (const line of shownPage.lines) {
        for (const word of line.words) {
          lastWords.set(word.ayahKey, word.id)
        }
      }
    }

    return lastWords
  }, [visiblePage, companionPage])
  const pageWordOrder = useMemo(() => {
    const order = new Map<string, number>()
    const shownPages = [visiblePage, companionPage].filter(Boolean) as MushafPage[]
    shownPages.sort((a, b) => a.pageNumber - b.pageNumber)

    let index = 0
    for (const shownPage of shownPages) {
      for (const line of shownPage.lines) {
        for (const word of line.words) {
          order.set(word.id, index)
          index += 1
        }
      }
    }

    return order
  }, [visiblePage, companionPage])
  const pageAnnotations = useMemo(
    () => annotations.filter((annotation) => (
      annotation.pageNumber === pageNumber || annotation.pageNumber === companionPageNumber
    )),
    [annotations, pageNumber, companionPageNumber]
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
  // Page slots read whole-session maps (not the shown-pages subsets above), so a page's output
  // only changes when its own data does and pages stay memoized across turns.
  const allHighlightByAyahKey = useMemo(() => {
    const map = new Map<string, MutshabehatAyahLink>()
    for (const highlight of allMutshabehatHighlights ?? []) {
      if (!map.has(highlight.ayahKey)) map.set(highlight.ayahKey, highlight)
    }
    return map
  }, [allMutshabehatHighlights])
  // Only the offline sample source is page-scoped; the real link list is session-wide.
  const slotHighlightByAyahKeyRaw = mutshabehatLinkEnabled ? allHighlightByAyahKey : mutshabehatHighlightByAyahKey
  // One switch, one colour system: with the highlight off the page shows only the Qiraat layer.
  const EMPTY_HIGHLIGHTS = useMemo(() => new Map<string, MutshabehatAyahLink>(), [])
  const slotHighlightByAyahKey = mutshabehatHighlightEnabled ? slotHighlightByAyahKeyRaw : EMPTY_HIGHLIGHTS
  // `annotationsVisible` gates these two maps rather than each of the ~6 render sites that read
  // them, so the highlight colour, the bookmark/favourite ring and the ayah badge all disappear
  // together and none can be forgotten. The annotations themselves are untouched — the context
  // menu and the notes editor still see everything, so nothing is lost by hiding the layer.
  const slotAnnotationsByWordId = useMemo(() => {
    const map = new Map<string, MushafAnnotation[]>()
    if (!annotationsVisible && readerLayer !== 'qiraat') return map
    for (const annotation of annotations) {
      if (!annotation.wordId) continue
      map.set(annotation.wordId, [...(map.get(annotation.wordId) ?? []), annotation])
    }
    return map
  }, [annotations, annotationsVisible, readerLayer])
  const slotAnnotationsByAyahKey = useMemo(() => {
    const map = new Map<string, MushafAnnotation[]>()
    if (!annotationsVisible && readerLayer !== 'qiraat') return map
    for (const annotation of annotations) {
      map.set(annotation.ayahKey, [...(map.get(annotation.ayahKey) ?? []), annotation])
    }
    return map
  }, [annotations, annotationsVisible, readerLayer])
  const mutshabehatPanelLinks = useMemo(() => (
    mutshabehatPanelAyahKey
      ? pageHighlights.filter((highlight) => highlight.ayahKey === mutshabehatPanelAyahKey).length > 0
        ? pageHighlights.filter((highlight) => highlight.ayahKey === mutshabehatPanelAyahKey)
        : getMutshabehatByAyahKey(mutshabehatPanelAyahKey, SAMPLE_MUTSHABEHAT_LINK_SOURCE)
      : []
  ), [mutshabehatPanelAyahKey, pageHighlights])
  // The one stable object gated through MushafPageSlot's memo comparator (like `highlights`
  // above) — a mounted page's Qiraat rendering only updates when THIS reference changes.
  const qiraatView = useMemo(() => ({
    mode: qiraatMode,
    selectedReadingId: qiraatSelectedReadingId,
    studyMode: qiraatStudyMode,
    showDifferenceFromHafs: qiraatShowDiffFromHafs,
    filter: qiraatFilter,
    includeReviewed: qiraatIncludeReviewed,
    variantsByPage: qiraatVariantsByPage,
    rulesByPage: qiraatRulesByPage,
    rulingsByPage: qiraatRulingsByPage,
    showUsul: qiraatShowUsul,
    disabledCategories: qiraatDisabledCategories,
    reviewMode: qiraatReviewMode,
    review: qiraatReview,
  }), [qiraatMode, qiraatSelectedReadingId, qiraatStudyMode, qiraatShowDiffFromHafs, qiraatFilter, qiraatIncludeReviewed, qiraatVariantsByPage, qiraatRulesByPage, qiraatRulingsByPage, qiraatShowUsul, qiraatDisabledCategories, qiraatReviewMode, qiraatReview])

  function qiraatVariantsForPage(pageNo: number): QiraatVariant[] {
    return qiraatView.variantsByPage[`${pageNo}:${qiraatView.includeReviewed ? 1 : 0}`] ?? EMPTY_QIRAAT_VARIANTS
  }

  // The sidebar is a landscape/desktop affordance and only earns its width once the Qiraat layer
  // is actually on; on phones and portrait tablets the burger drawer stays the only path.
  // The side rail belongs to whichever layer is on, not to Qiraat alone: in متشابهات and
  // الملاحظات the same real estate shows that layer's panel instead of stealing a modal
  // over the page. A plain mushaf ('none') keeps the full width for the page.
  const showReaderSidebar = isSpread && readerLayer !== 'none' && !qiraatEditorWord

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const update = () => setQiraatEditorDesktop(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  function qiraatRulingsForPage(pageNo: number): QiraatRuling[] {
    return qiraatView.rulingsByPage[`${pageNo}:${qiraatView.includeReviewed ? 1 : 0}`] ?? EMPTY_QIRAAT_RULINGS
  }

  function qiraatRulesForPage(pageNo: number): QiraatRule[] {
    return qiraatView.rulesByPage[`${pageNo}:${qiraatView.includeReviewed ? 1 : 0}`] ?? EMPTY_QIRAAT_RULES
  }

  // Rules for the currently displayed page — shown in the القراءات burger-menu panel whenever
  // comparison/riwayah mode has fetched some (Part 24: never fetched at all in normal mode).
  const qiraatRulesForCurrentPage = useMemo(
    () => (qiraatView.mode === 'normal' ? EMPTY_QIRAAT_RULES : qiraatRulesForPage(pageNumber)),
    [qiraatView, pageNumber],
  )

  const qiraatVariantsForSelectedAyah = useMemo(() => {
    if (!selectedAyahKey) return []
    const [surahPart, ayahPart] = selectedAyahKey.split(':')
    const surah = Number(surahPart)
    const ayah = Number(ayahPart)
    const page = selectedWord?.pageNumber ?? pageNumber
    const pageVariants = qiraatView.variantsByPage[`${page}:${qiraatView.includeReviewed ? 1 : 0}`] ?? EMPTY_QIRAAT_VARIANTS
    const effectiveFilter: QiraatComparisonFilter = qiraatView.mode === 'riwayah'
      ? { kind: 'reading', readingId: qiraatView.selectedReadingId }
      : qiraatView.filter
    return getQiraatVariantsByAyahKey(selectedAyahKey, pageVariants)
      .filter((variant) => variant.surah === surah && variant.ayah === ayah)
      .filter((variant) => matchesFilter(variant, effectiveFilter))
  }, [selectedAyahKey, selectedWord, pageNumber, qiraatView])

  // Load Qiraat data for exactly the page slots already mounted around the current page. In spread
  // mode this includes BOTH leaves of the previous/current/next spreads; deriving targets from the
  // raw page number skipped one leaf and caused its colors to appear only after the turn.
  useEffect(() => {
    if (qiraatMode === 'normal') return
    let cancelled = false
    const pages = slotGroups.flatMap((group) => (isSpread ? [group, group + 1] : [group]))
      .filter((page) => page >= MIN_PAGE && page <= MAX_PAGE)

    void Promise.all(pages.map((page) => fetchQiraatForPage(page, qiraatIncludeReviewed)))
      .then(() => {
        if (cancelled) return
        // One state publication for the whole mounted window avoids rerendering every page slot as
        // each independent chunk arrives. The refs above remain the in-flight/cache authority.
        setQiraatVariantsByPage(qiraatVariantsByPageRef.current)
        setQiraatRulesByPage(qiraatRulesByPageRef.current)
        setQiraatRulingsByPage(qiraatRulingsByPageRef.current)
        // Resolved annotations are an optional, mutable authoring/QA enhancement. They must never
        // hold up immutable fixture-backed variants/rulings (or make their markers disappear when
        // the supplemental endpoint is unavailable).
        void Promise.all(pages.map((page) => fetchResolvedQiraatForPage(page))).catch(() => {})
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [slotGroups, isSpread, qiraatMode, qiraatIncludeReviewed])

  // Restore/persist Qiraat preferences (mode, reading, study mode, diff toggle, filter) the same
  // way the swipe-nav setting and the last-page key do: read after mount, write on change.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(QIRAAT_PREFS_STORAGE_KEY)
      if (!raw) return
      const prefs = JSON.parse(raw) as Partial<QiraatPrefs>
      // Restores only WHICH Qiraat mode, never whether Qiraat is on: that is the layer's call
      // (READER_LAYER_STORAGE_KEY), so restoring a preference can't quietly claim the page.
      if (prefs.mode && prefs.mode !== 'normal') setQiraatSubMode(prefs.mode)
      if (prefs.selectedReadingId) setQiraatSelectedReadingId(prefs.selectedReadingId)
      if (typeof prefs.studyMode === 'boolean') setQiraatStudyMode(prefs.studyMode)
      if (typeof prefs.showDifferenceFromHafs === 'boolean') setQiraatShowDiffFromHafs(prefs.showDifferenceFromHafs)
      if (prefs.filter) setQiraatFilter(prefs.filter)
    } catch {
      // Ignore malformed/blocked storage — defaults (Mode 1, Hafs) still work.
    }
  }, [])

  useEffect(() => {
    try {
      const prefs: QiraatPrefs = {
        mode: qiraatMode,
        selectedReadingId: qiraatSelectedReadingId,
        studyMode: qiraatStudyMode,
        showDifferenceFromHafs: qiraatShowDiffFromHafs,
        filter: qiraatFilter,
      }
      localStorage.setItem(QIRAAT_PREFS_STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // Best-effort only.
    }
  }, [qiraatMode, qiraatSelectedReadingId, qiraatStudyMode, qiraatShowDiffFromHafs, qiraatFilter])

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

  function slotGroupOf(page: number) {
    return isSpread ? (page % 2 === 1 ? page : page - 1) : page
  }

  // Grab the on-screen page elements before navigating so the outgoing page can curl away over the new one.
  function measurePageTurn(fromPage: number, toPage: number): Omit<PageTurn, 'id' | 'mode'> | null {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null
    const main = pageMainRef.current
    const group = pageStageRef.current?.querySelector<HTMLElement>('[data-page-slot-current]')
    const fromGroup = slotGroupOf(fromPage)
    if (!main || !group || fromGroup === slotGroupOf(toPage)) return null
    const origin = main.getBoundingClientRect()
    const leafOf = (layout: PageLayout) => group.querySelector<HTMLElement>(`[data-mushaf-leaf="${layout}"]`)
    const rectOf = (el: HTMLElement): PageCurlRect => {
      const r = el.getBoundingClientRect()
      return { x: r.left - origin.left, y: r.top - origin.top, width: r.width, height: r.height }
    }
    const forward = toPage > fromPage

    const right = leafOf('right')
    const left = leafOf('left')
    if (right && left) {
      const rightRect = rectOf(right)
      const leftRect = rectOf(left)
      const gap = Math.max(0, rightRect.x - (leftRect.x + leftRect.width))
      const toRight = slotGroupOf(toPage)
      // Forward lifts the left-hand page over the spine; back lifts the right-hand page.
      return forward
        ? { fromPage, fromGroup, leaf: leftRect, peelFrom: 'left', travel: leftRect.width * 2 + gap, front: left, still: right, backPageNo: toRight, backRect: rightRect }
        : { fromPage, fromGroup, leaf: rightRect, peelFrom: 'right', travel: rightRect.width * 2 + gap, front: right, still: left, backPageNo: toRight + 1, backRect: leftRect }
    }
    const single = leafOf('single')
    if (!single) return null
    const rect = rectOf(single)
    return { fromPage, fromGroup, leaf: rect, peelFrom: forward ? 'left' : 'right', travel: rect.width * 2, front: single, still: null, backPageNo: null, backRect: null }
  }

  async function goToPage(nextPage: number, targetAyahKey?: string, options: { animate?: boolean; turnMode?: 'auto' | 'drag' } = {}) {
    const clamped = clampPage(nextPage)
    const turn = clamped !== pageNumber && options.animate !== false ? measurePageTurn(pageNumber, clamped) : null
    pageTurnIdRef.current += 1
    setPageTurn(turn ? { ...turn, id: pageTurnIdRef.current, mode: options.turnMode ?? 'auto' } : null)
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
    setQiraatSelection(null)
    updateHoveredQiraatWord(null)
    setMutshabehatPanelAyahKey(null)
    setMutshabehatPopupAyahKey(null)
    setContextMenu(null)
    setEditingNoteId(null)
    setAnnotationDraft(EMPTY_ANNOTATION_DRAFT)
    setAnnotationMode('note')

    const cachedPage = pageCacheRef.current[clamped]
    if (cachedPage) {
      setCurrentPage(cachedPage)
      const metadata = await loadPageMetadata(clamped)
      if (!targetAyahKey) syncJumpControlsToMetadata(metadata)
      return
    }

    setIsPageLoading(true)
    try {
      const loadedPage = await loadPageWords(clamped)
      const metadata = await loadPageMetadata(clamped)
      setCurrentPage(loadedPage)
      if (!targetAyahKey) syncJumpControlsToMetadata(metadata)
    } finally {
      setIsPageLoading(false)
    }
  }

  function syncJumpControlsToMetadata(metadata: Mushaf1441PageMetadata) {
    setSelectedSurahNumber(metadata.surahNumbers[0] ?? 1)
  }

  async function goToAyah(surahNumber: number, ayahNumber: number) {
    const ayahKey = `${surahNumber}:${ayahNumber}`
    const response = await fetch(`/api/mushaf-1441/page-metadata?ayahKey=${encodeURIComponent(ayahKey)}`)
    if (!response.ok) return
    const data = await response.json() as { pageNumber: number }
    setSelectedSurahNumber(surahNumber)
    await goToPage(data.pageNumber, ayahKey)
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
    const cached = pageCacheRef.current[nextPage]
    if (cached) return cached

    const inFlight = pageWordsRequestsRef.current.get(nextPage)
    if (inFlight) return inFlight

    // loadMushaf1441Page legacy compatibility only.
    const request = (async () => {
      const response = await fetch(`/api/mushaf-1441/page-words?page=${nextPage}`)
      if (!response.ok) throw new Error(`Failed to load word lines for page ${nextPage}`)
      const loadedPage = await response.json() as MushafPage & { metadata?: Mushaf1441PageMetadata }
      if (loadedPage.metadata) {
        const metadata = loadedPage.metadata
        pageMetadataCacheRef.current = { ...pageMetadataCacheRef.current, [metadata.pageNumber]: metadata }
        setPageMetadataCache((current) => (current[metadata.pageNumber]
          ? current
          : { ...current, [metadata.pageNumber]: metadata }))
      }
      pageCacheRef.current = { ...pageCacheRef.current, [loadedPage.pageNumber]: loadedPage }
      setPageCache((current) => (current[loadedPage.pageNumber]
        ? current
        : { ...current, [loadedPage.pageNumber]: loadedPage }))
      return loadedPage
    })()
    pageWordsRequestsRef.current.set(nextPage, request)
    try {
      return await request
    } finally {
      if (pageWordsRequestsRef.current.get(nextPage) === request) {
        pageWordsRequestsRef.current.delete(nextPage)
      }
    }
  }

  async function fetchPageMetadata(nextPage: number) {
    const cached = pageMetadataCacheRef.current[nextPage]
    if (cached) return cached

    const inFlight = pageMetadataRequestsRef.current.get(nextPage)
    if (inFlight) return inFlight

    const request = (async () => {
      const response = await fetch(`/api/mushaf-1441/page-metadata?page=${nextPage}`)
      if (!response.ok) throw new Error(`Failed to load metadata for page ${nextPage}`)
      const metadata = await response.json() as Mushaf1441PageMetadata
      pageMetadataCacheRef.current = { ...pageMetadataCacheRef.current, [metadata.pageNumber]: metadata }
      setPageMetadataCache((current) => (current[metadata.pageNumber]
        ? current
        : { ...current, [metadata.pageNumber]: metadata }))
      return metadata
    })()
    pageMetadataRequestsRef.current.set(nextPage, request)
    try {
      return await request
    } finally {
      if (pageMetadataRequestsRef.current.get(nextPage) === request) {
        pageMetadataRequestsRef.current.delete(nextPage)
      }
    }
  }

  async function loadPageMetadata(nextPage: number) {
    const metadata = await fetchPageMetadata(nextPage)
    setCurrentPageMetadata(metadata)
    return metadata
  }

  // Qiraat variants + page-level rules are shared immutable reference data (no auth), cached per
  // page with the same in-flight dedup pattern as fetchPageMetadata. Loading their generated page
  // chunks directly avoids a route-handler round trip while keeping non-Qiraat sessions lazy.
  async function fetchQiraatForPage(nextPage: number, includeUnpublished: boolean) {
    const cacheKey = `${nextPage}:${includeUnpublished ? 1 : 0}`
    const cachedVariants = qiraatVariantsByPageRef.current[cacheKey]
    const cachedRules = qiraatRulesByPageRef.current[cacheKey]
    const cachedRulings = qiraatRulingsByPageRef.current[cacheKey]
    if (cachedVariants && cachedRules && cachedRulings) {
      return { variants: cachedVariants, rules: cachedRules, rulings: cachedRulings }
    }

    const inFlight = qiraatRequestsRef.current.get(cacheKey)
    if (inFlight) return inFlight

    const request = (async () => {
      // Qiraat fixtures are immutable application assets. Load their page chunks directly in the
      // browser instead of paying for a route-handler round trip and a second JSON serialization.
      // Adjacent-page prefetch therefore warms the same module cache used by the page turn.
      const options = { includeUnpublished }
      const [variants, rules, rulings] = await Promise.all([
        defaultQiraatRepository.getVariantsForPage(nextPage, options),
        defaultQiraatRepository.getRulesForPage(nextPage, options),
        defaultQiraatRepository.getRulingsForPage(nextPage, options),
      ])
      qiraatVariantsByPageRef.current = { ...qiraatVariantsByPageRef.current, [cacheKey]: variants }
      qiraatRulesByPageRef.current = { ...qiraatRulesByPageRef.current, [cacheKey]: rules }
      qiraatRulingsByPageRef.current = { ...qiraatRulingsByPageRef.current, [cacheKey]: rulings }
      return { variants, rules, rulings }
    })()
    qiraatRequestsRef.current.set(cacheKey, request)
    try {
      return await request
    } finally {
      if (qiraatRequestsRef.current.get(cacheKey) === request) qiraatRequestsRef.current.delete(cacheKey)
    }
  }

  async function fetchResolvedQiraatForPage(nextPage: number) {
    const cached = resolvedQiraatByPage[nextPage]
    if (cached) return cached
    const inFlight = resolvedQiraatRequestsRef.current.get(nextPage)
    if (inFlight) return inFlight
    const request = fetch(`/api/mushaf-1441/qiraat-resolved?page=${nextPage}`)
      .then(async (response) => {
        if (!response.ok) return []
        const payload = await response.json() as { annotations?: Array<{ canonical_word_key: string; target_authority_id: string; resolved_face_count: number; has_multiple_faces: boolean; resolved_color: string | null }> }
        const rows = Array.isArray(payload.annotations) ? payload.annotations : []
        setResolvedQiraatByPage((current) => ({ ...current, [nextPage]: rows }))
        return rows
      })
    resolvedQiraatRequestsRef.current.set(nextPage, request)
    try { return await request } finally { resolvedQiraatRequestsRef.current.delete(nextPage) }
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

  function turnTarget(direction: 1 | -1) {
    if (!isSpread) return clampPage(pageNumber + direction)
    // A spread turns by two pages and keeps the odd (right-hand) page as the current page.
    const spreadStart = pageNumber % 2 === 1 ? pageNumber : pageNumber - 1
    return clampPage(spreadStart + direction * 2)
  }

  // Drag a page to curl it under the finger (RTL: drag right → next page, drag left → previous).
  function handlePagePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (isMenuOpen || isSurahPickerOpen || contextMenu || mutshabehatPopupAyahKey || isMobileNotesOpen) return
    // Words on the page are buttons too; only controls outside the page block a drag.
    const target = event.target as HTMLElement
    if (target.closest('a, input, textarea, select') || (target.closest('button') && !target.closest('[data-mushaf-leaf]'))) return
    dragRef.current = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, direction: 0, progress: 0, width: 1,
    }
  }

  function handlePagePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (drag.direction === 0) {
      if (Math.abs(dx) < DRAG_START_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return
      const direction = dx > 0 ? 1 : -1
      const target = turnTarget(direction)
      if (target === pageNumber) {
        dragRef.current = null
        return
      }
      drag.direction = direction
      cancelLongPress()
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Capture is best-effort (the pointer may already be gone).
      }
      const leaf = stageLeafWidth()
      drag.width = leaf
      void goToPage(target, undefined, { turnMode: 'drag' })
    }
    const elapsed = Math.max(1, event.timeStamp - drag.lastTime)
    drag.velocity = ((event.clientX - drag.lastX) / elapsed) * drag.direction
    drag.lastX = event.clientX
    drag.lastTime = event.timeStamp
    const travelled = Math.max(0, dx * drag.direction - DRAG_START_PX)
    drag.progress = travelled / drag.width
    curlRef.current?.drag(travelled, dy)
  }

  function handlePagePointerEnd(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (drag.direction === 0) return
    suppressClickRef.current = true
    setTimeout(() => { suppressClickRef.current = false }, 400)
    const commit = event.type !== 'pointercancel' && (drag.progress > 0.3 || drag.velocity > 0.35)
    if (curlRef.current) {
      curlRef.current.release(commit)
    } else if (commit) {
      setPageTurn((turn) => (turn ? { ...turn, mode: 'auto' } : turn))
    } else {
      finishPageTurn(false)
    }
  }

  function stageLeafWidth() {
    const el = pageStageRef.current?.querySelector<HTMLElement>('[data-page-slot-current] [data-mushaf-leaf]')
    return Math.max(1, el?.getBoundingClientRect().width ?? 1)
  }

  function finishPageTurn(committed: boolean) {
    const turn = pageTurn
    setPageTurn(null)
    // A drag let go early falls back to the page it started from.
    if (!committed && turn) void goToPage(turn.fromPage, undefined, { animate: false })
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
    if (x < rect.width / 2) turnPage(1)
    else turnPage(-1)
  }

  function turnPage(direction: 1 | -1) {
    void goToPage(turnTarget(direction))
  }

  function handleSpreadPageClick(event: ReactMouseEvent<HTMLDivElement>, side: 'right' | 'left') {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false
      return
    }
    const target = event.target as HTMLElement
    if (target.closest('button') || target.closest('a')) return
    // Arabic book: tapping the left-hand page goes forward, the right-hand page goes back.
    turnPage(side === 'left' ? 1 : -1)
  }

  // Warm the cache (words + metadata + font) for adjacent pages so turning is instant.
  async function prefetchPage(target: number) {
    const clamped = clampPage(target)
    if (clamped < MIN_PAGE || clamped > MAX_PAGE) return
    void loadQcfFontForPage(clamped)
    if (!pageCacheRef.current[clamped]) {
      try {
        await loadPageWords(clamped)
      } catch {
        // Ignore prefetch failures; the page will load on demand.
      }
    }
    if (!pageMetadataCacheRef.current[clamped]) {
      try {
        await fetchPageMetadata(clamped)
      } catch {
        // Ignore prefetch failures.
      }
    }
  }

  // Long-press (touch) on a word / ayah. What it opens is the active layer's business
  // (`openContextMenu`); what it FEELS like is this function's: hold a word the way you hold an
  // iOS home-screen icon and you get one crisp tick at the moment the press is recognised.
  //
  // The tick fires only when the press actually produced something — a long press that opens
  // nothing (a plain word while the متشابهات layer is on) buzzing anyway would be a lie about
  // what just happened. `longPressFiredRef` is set either way, so the click that follows the
  // release is still swallowed and can't be mistaken for a tap.
  function startLongPress(target: AnnotationTarget, event: ReactTouchEvent) {
    const touch = event.touches[0]
    if (!touch) return
    const x = touch.clientX
    const y = touch.clientY
    cancelLongPress()
    longPressFiredRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      if (openContextMenu(target, x, y)) impactHaptic()
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
        setAnnotations((current) => (current.length ? [] : current))
        return
      }
      if (response.status === 501) {
        setAnnotationSyncAvailable(false)
        setAnnotationStatus('جدول Supabase الخاص بالمصحف غير مفعل بعد.')
        setAnnotationError(await readPreviewApiError(response, 'جدول Supabase الخاص بالمصحف غير مفعل بعد.'))
        setAnnotations((current) => (current.length ? [] : current))
        return
      }
      if (response.status === 503) {
        setAnnotationSyncAvailable(false)
        setAnnotationStatus('تعذر الاتصال بإعدادات Supabase للمصحف.')
        setAnnotationError(await readPreviewApiError(response, 'تعذر تحميل الملاحظات من Supabase.'))
        setAnnotations((current) => (current.length ? [] : current))
        return
      }
      if (!response.ok) {
        setAnnotationError(await readPreviewApiError(response, 'تعذر تحميل الملاحظات من Supabase.'))
        return
      }

      const payload = await response.json() as { annotations?: MushafAnnotation[] }
      const loaded = Array.isArray(payload.annotations) ? payload.annotations : []
      setAnnotations((current) => {
        const existing = current.filter((annotation) => annotation.pageNumber === nextPage)
        const unchanged = existing.length === loaded.length
          && existing.every((annotation, index) => annotation.id === loaded[index].id && annotation.updatedAt === loaded[index].updatedAt)
        // Keep the same array when nothing changed, so memoized pages don't re-render on every turn.
        return unchanged ? current : [...current.filter((annotation) => annotation.pageNumber !== nextPage), ...loaded]
      })
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
    // Only the متشابهات layer fills the متشابهات panel: in the annotations layer a word whose ayah
    // happens to sit in one of the user's groups still opens its notes, not the links.
    const hasMutshabehatHighlight = readerLayer === 'mutshabehat' && highlightedMutshabehatAyahKeys.has(target.ayahKey)
    setSelectedAyahKey(target.ayahKey)
    setSelectedWord(isWordTarget(target) ? target.word : isWordRangeTarget(target) ? target.endWord : null)
    setSelectedWordRange(isWordRangeTarget(target) ? { startWord: target.startWord, endWord: target.endWord } : null)
    // The sheet is for viewports without a rail; where the rail exists it already shows the
    // editor, and opening a sheet on top of it would hide the page for no reason.
    setIsMobileNotesOpen(!(isSpread && readerLayer === 'annotations'))
    setMutshabehatPanelAyahKey(hasMutshabehatHighlight ? target.ayahKey : null)
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

  async function navigateQiraatEditorWord(direction: 1 | -1) {
    const focusWord = (target: MushafWord) => {
      setQiraatEditorWord(target)
      window.setTimeout(() => {
        const element = Array.from(document.querySelectorAll<HTMLElement>('[data-quran-word-id]')).find((candidate) => candidate.dataset.quranWordId === target.id)
        element?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
      }, 0)
    }
    const pages = [visiblePage, companionPage].filter(Boolean) as MushafPage[]
    const words = pages.sort((a, b) => a.pageNumber - b.pageNumber).flatMap((page) => page.lines.flatMap((line) => line.words.filter((candidate) => candidate.charTypeName === undefined || candidate.charTypeName === 'word')))
    const index = words.findIndex((candidate) => candidate.id === qiraatEditorWord?.id)
    const localTarget = index >= 0 ? words[index + direction] : null
    if (localTarget) { focusWord(localTarget); return }
    const nextPage = clampPage(pageNumber + (isSpread ? direction * 2 : direction))
    if (nextPage === pageNumber) return
    const loaded = await loadPageWords(nextPage)
    const nextWords = loaded.lines.flatMap((line) => line.words.filter((candidate) => candidate.charTypeName === undefined || candidate.charTypeName === 'word'))
    const target = direction > 0 ? nextWords[0] : nextWords[nextWords.length - 1]
    if (!target) return
    await goToPage(nextPage)
    focusWord(target)
  }

  function renderQiraatEditor(inline: boolean) {
    if (!qiraatEditorWord) return null
    return (
      <QiraatEditor
        key={`${qiraatEditorWord.id}:${qiraatScopePreview?.startCanonicalKey ?? ''}:${qiraatScopePreview?.endCanonicalKey ?? ''}:${qiraatScopePreview?.scopeType ?? ''}`}
        word={qiraatEditorWord}
        inline={inline}
        onClose={() => { setQiraatEditorWord(null); setQiraatScopePreview(undefined) }}
        onSaved={() => {
          setToast('تم حفظ تعليق القراءات وتحديث القراءة المعروضة.')
          resolvedQiraatRequestsRef.current.delete(qiraatEditorWord.pageNumber)
          setResolvedQiraatByPage((current) => { const next = { ...current }; delete next[qiraatEditorWord.pageNumber]; return next })
          void fetchResolvedQiraatForPage(qiraatEditorWord.pageNumber)
        }}
        onNavigate={navigateQiraatEditorWord}
        initialScope={qiraatScopePreview}
      />
    )
  }

  // Tapping a word carrying Qiraat data opens the same detail panel, straight to its Qiraat tab
  // (Part 13's "tap a word/phrase → bottom sheet"), instead of the notes tab `selectWord` opens.
  // Returns false when the token carries no Qiraat data at all, so a press that would open an
  // empty panel simply does nothing (and plays no haptic).
  function qiraatSelectionForWord(word: MushafWord): QiraatSelection | null {
    const effectiveFilter: QiraatComparisonFilter = qiraatView.mode === 'riwayah'
      ? { kind: 'reading', readingId: qiraatView.selectedReadingId }
      : qiraatView.filter
    const rulings = rulingMarkerForWord(
      qiraatRulingsForPage(word.pageNumber), word.surahNumber, word.ayahNumber, word.wordIndexInAyah,
      effectiveFilter,
    )?.rulings ?? []
    const allVariants = variantsForToken(
      qiraatVariantsForPage(word.pageNumber), word.surahNumber, word.ayahNumber, word.wordIndexInAyah,
      { includeUnpublished: qiraatView.includeReviewed },
    )
    const variants = effectiveFilter.kind === 'all'
      ? allVariants
      : allVariants.filter((variant) => matchesFilter(variant, effectiveFilter))
    if (!rulings.length && !variants.length) return null
    return { word, rulings, variants }
  }

  function selectWordForQiraat(word: MushafWord): boolean {
    setSelectedAyahKey(null)
    setSelectedWord(null)
    setSelectedWordRange(null)
    if (qiraatSelection?.word.id === word.id) {
      setQiraatSelection(null)
      return true
    }
    const selection = qiraatSelectionForWord(word)
    if (!selection) return false
    setQiraatSelection(selection)
    return true
  }

  function openMutshabehatPopup(ayahKey: string) {
    setExpandedPopupGroups({})
    setContextMenu(null)
    // With a rail on screen the links belong in it; a modal over the page would cover the very
    // ayat the reader is comparing. Phones and portrait tablets keep the card.
    if (isSpread && readerLayer === 'mutshabehat') {
      setMutshabehatPanelAyahKey(ayahKey)
      setMutshabehatPopupAyahKey(null)
      return
    }
    setMutshabehatPopupAyahKey(ayahKey)
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
    if (event.ctrlKey || isMenuOpen || isSurahPickerOpen || contextMenu || mutshabehatPopupAyahKey || isMobileNotesOpen) return
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
    turnPage(direction > 0 ? 1 : -1)
  }

  // The single funnel for a deliberate press on a word or an ayah marker — a long-press on touch,
  // a right-click with a mouse. The ACTIVE LAYER decides what that press means, so the annotation
  // menu (note / highlight / bookmark / favourite) belongs to the annotations layer alone and can
  // never open over a page the reader is studying in Qiraat or متشابهات mode.
  // Returns whether the press produced anything, so the caller only plays the haptic when it did.
  function openContextMenu(target: AnnotationTarget, x: number, y: number): boolean {
    if (readerLayer === 'mutshabehat') {
      if (!highlightedMutshabehatAyahKeys.has(target.ayahKey)) return false
      openMutshabehatPopup(target.ayahKey)
      return true
    }
    setContextMenu({ target, x, y })
    return true
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

  function isWordInsideAnnotationRange(annotation: MushafAnnotation, word: MushafWord, wordOrder: Map<string, number> = pageWordOrder) {
    if (annotation.targetType !== 'word-range' || !annotation.wordRangeStartId || !annotation.wordRangeEndId) return false

    const startIndex = wordOrder.get(annotation.wordRangeStartId)
    const endIndex = wordOrder.get(annotation.wordRangeEndId)
    const wordIndex = wordOrder.get(word.id)
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
    // The ayah-end medallion is tinted by bookmark/favourite too, so it follows the same switch.
    const ayahAnnotations = annotationsVisible ? (annotationsByAyahKey.get(word.ayahKey) ?? []) : []
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
          // Same one-layer rule as a word. The medallion carries no Qiraat data of its own, so in
          // Qiraat mode it is inert rather than a back door into the notes sheet.
          if (readerLayer === 'qiraat') return
          if (readerLayer === 'mutshabehat') {
            if (highlightedMutshabehatAyahKeys.has(word.ayahKey)) openMutshabehatPopup(word.ayahKey)
            return
          }
          if (Date.now() - recentTouchRef.current < 700) return
          selectAyah(word.ayahKey)
        }}
        onMouseEnter={() => { if (readerLayer !== 'qiraat') setHoveredAyahKey(word.ayahKey) }}
        onMouseLeave={() => { if (readerLayer !== 'qiraat') setHoveredAyahKey((current) => (current === word.ayahKey ? null : current)) }}
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

  function findHighlightAnnotation(word: MushafWord, wordOrder: Map<string, number>) {
    const wordHighlightAnnotation = (slotAnnotationsByWordId.get(word.id) ?? [])
      .find((annotation) => annotation.annotationType === 'highlight')
    const rangeHighlightAnnotation = annotations.find((annotation) => (
      annotation.pageNumber === word.pageNumber
      && annotation.annotationType === 'highlight'
      && isWordInsideAnnotationRange(annotation, word, wordOrder)
    ))
    const ayahHighlightAnnotation = (slotAnnotationsByAyahKey.get(word.ayahKey) ?? []).find((annotation) => (
      annotation.annotationType === 'highlight' && annotation.targetType === 'ayah'
    ))
    return wordHighlightAnnotation ?? rangeHighlightAnnotation ?? ayahHighlightAnnotation
  }

  // Background a word shows (same precedence as renderQcfWord), used to colour the gaps.
  function getWordBandColor(word: MushafWord, wordOrder: Map<string, number>): string | null {
    const rawColor = findHighlightAnnotation(word, wordOrder)?.backgroundColor
    if (rawColor) {
      return mushafTheme === 'dark'
        ? adaptAnnotationForDark({ backgroundColor: rawColor }).backgroundColor ?? rawColor
        : rawColor
    }
    if (readerLayer !== 'qiraat' && selectedAyahKey === word.ayahKey) return currentThemeTokens.selectionBg
    const link = slotHighlightByAyahKey.get(word.ayahKey)
    return link ? tintForGroupWithTheme(link.groupId ?? link.ayahKey, mushafTheme).bg : null
  }

  // The space between two words. On justified lines it grows to fill the line (like
  // justify-between); when both neighbours share a highlight colour the gap takes it, so an
  // ayah's highlight reads as one continuous band instead of separate word marks.
  function renderWordGap(left: MushafWord, right: MushafWord, isCentered: boolean, wordOrder: Map<string, number>) {
    const leftColor = getWordBandColor(left, wordOrder)
    const color = leftColor && leftColor === getWordBandColor(right, wordOrder) ? leftColor : undefined
    return (
      <span
        aria-hidden="true"
        className={isCentered ? 'w-[0.12em] shrink-0' : 'min-w-[0.06em] flex-1'}
        style={{ height: MUSHAF_WORD_BAND_HEIGHT, backgroundColor: color }}
      />
    )
  }

  function renderQcfWord(word: MushafWord, wordOrder: Map<string, number>) {
    const isSelectedWord = readerLayer !== 'qiraat' && selectedWord?.id === word.id
    const isQiraatEditorSelected = qiraatEditorWord?.id === word.id
    const isQiraatReadSelected = qiraatSelection?.word.id === word.id
    const isHighlightedAyah = readerLayer !== 'qiraat' && selectedAyahKey === word.ayahKey
    const mutshabehatHighlight = slotHighlightByAyahKey.get(word.ayahKey)
    const isMutshabehatHighlighted = Boolean(mutshabehatHighlight)
    const mutshabehatTint = mutshabehatHighlight ? tintForGroupWithTheme(mutshabehatHighlight.groupId ?? mutshabehatHighlight.ayahKey, mushafTheme) : null
    const showMutshabehatTint = Boolean(mutshabehatTint) && !isSelectedWord && !isHighlightedAyah
    const ayahAnnotations = slotAnnotationsByAyahKey.get(word.ayahKey) ?? []
    const highlightAnnotation = findHighlightAnnotation(word, wordOrder)
    const adaptedAnnotation = (highlightAnnotation && mushafTheme === 'dark')
      ? adaptAnnotationForDark(highlightAnnotation)
      : highlightAnnotation
    const hasAyahBookmark = ayahAnnotations.some((annotation) => annotation.annotationType === 'bookmark')
    const hasAyahFavorite = ayahAnnotations.some((annotation) => annotation.annotationType === 'favorite')

    // Qiraat Ashr: Mode 1 (normal) never touches rendering — no marks, no colour noise (Part 3).
    // Ayah-end/pause/sajdah glyphs are page furniture, not real Quran tokens — never anchor variants there.
    const isRealWordToken = word.charTypeName === undefined || word.charTypeName === 'word'
    const qiraatPageVariants = qiraatView.mode === 'normal' || !isRealWordToken ? EMPTY_QIRAAT_VARIANTS : qiraatVariantsForPage(word.pageNumber)
    const qiraatHafsBaseText = word.textQpcHafs ?? word.textUthmani
    let qiraatOverrideText: string | null = null
    let qiraatSuppressed = false
    let qiraatMarker: WordMarker | null = null
    const effectiveFilter: QiraatComparisonFilter = qiraatView.mode === 'riwayah'
      ? { kind: 'reading', readingId: qiraatView.selectedReadingId }
      : qiraatView.filter

    if (qiraatView.mode === 'comparison') {
      qiraatMarker = comparisonMarkerForWord(
        qiraatPageVariants, word.surahNumber, word.ayahNumber, word.wordIndexInAyah, qiraatView.filter,
        { includeUnpublished: qiraatView.includeReviewed },
      )
    } else if (qiraatView.mode === 'riwayah') {
      const resolution = riwayahResolutionForWord(
        qiraatPageVariants, word.surahNumber, word.ayahNumber, word.wordIndexInAyah, qiraatHafsBaseText,
        qiraatView.selectedReadingId, qiraatView.showDifferenceFromHafs, { includeUnpublished: qiraatView.includeReviewed },
      )
      qiraatSuppressed = resolution.suppressed
      qiraatMarker = resolution.marker
      // A reading can describe deletion/suppression, but the canonical Mushaf layer must never
      // disappear. Keep an empty alternate as a visual reading state and retain the Hafs text.
      if (!resolution.suppressed && resolution.text && resolution.text !== qiraatHafsBaseText) {
        qiraatOverrideText = resolution.text
      }
    }
    // أصول rulings colour the word itself (إمالة/تقليل one colour, الإدغام another, الترقيق/التغليظ
    // another, السكت another …) so the KIND of ruling is legible without opening anything. They do
    // not change the rasm, so they never touch displayText.
    const rulingMarker: RulingMarker | null = (qiraatView.mode === 'normal' || !isRealWordToken || !qiraatView.showUsul)
      ? null
      : rulingMarkerForWord(
        qiraatRulingsForPage(word.pageNumber), word.surahNumber, word.ayahNumber, word.wordIndexInAyah,
        effectiveFilter,
        qiraatView.disabledCategories.length
          ? new Set(rulingCategoriesOnPage(qiraatRulingsForPage(word.pageNumber))
            .map((c) => c.category).filter((c) => !qiraatView.disabledCategories.includes(c)))
          : undefined,
      )
    const resolvedAnnotations = (resolvedQiraatByPage[word.pageNumber] ?? []).filter((annotation) => annotation.canonical_word_key === canonicalKeyForWord(word))
    const resolvedFaceCount = resolvedAnnotations.reduce((count, annotation) => Math.max(count, annotation.resolved_face_count), 0)
    const hasQiraatData = Boolean(qiraatMarker) || Boolean(rulingMarker) || qiraatOverrideText !== null || qiraatSuppressed || resolvedAnnotations.length > 0

    // QCF glyphs only with this page's own loaded font, and only for the exact Hafs text they were
    // drawn for; a Riwayah substitution always falls back to flowing Unicode text (Part 21).
    const useGlyph = qiraatOverrideText === null && qcfFontStatus[word.pageNumber] === 'loaded' && Boolean(word.glyph)
    // Never hide a canonical word when a selected reading suppresses it. The alternate reading is
    // an overlay/detail concern; the immutable Mushaf text remains readable on every viewport.
    const displayText = qiraatOverrideText ?? (useGlyph ? word.glyph : qiraatHafsBaseText)
    const fontFamily = useGlyph
      ? `"${getQcfV2FontFamily(word.pageNumber)}", serif`
      : 'var(--font-amiri-quran), "Times New Roman", serif'
    const qiraatMarkerCss = qiraatMarker
      ? { height: qiraatView.studyMode ? 4 : 2, offset: qiraatView.studyMode ? -3 : -2 }
      : null
    const rawQiraatColor = qiraatMarker && qiraatView.studyMode
      ? (qiraatMarker.isGradient ? '#8a7c5c' : qiraatMarker.color)
      : null
    const qiraatTintColor = rawQiraatColor && mushafTheme === 'dark'
      ? adaptColorForDark(rawQiraatColor)
      : rawQiraatColor

    const effectiveRulingColor = rulingMarker?.color
      ? (mushafTheme === 'dark' ? adaptColorForDark(rulingMarker.color) : rulingMarker.color)
      : undefined

    const effectiveMarkerColor = qiraatMarker?.isPerformanceOnly
      ? (mushafTheme === 'dark' ? adaptColorForDark(PERFORMANCE_MARKER_COLOR) : PERFORMANCE_MARKER_COLOR)
      : qiraatMarker
        ? (qiraatMarker.isGradient
            ? (mushafTheme === 'dark' ? adaptColorForDark(QIRAAT_MULTI_READER_COLOR) : QIRAAT_MULTI_READER_COLOR)
            : (mushafTheme === 'dark' ? adaptColorForDark(qiraatMarker.color) : qiraatMarker.color))
        : undefined
    const annotationTextColor = adaptedAnnotation?.textColor ?? highlightAnnotation?.textColor

    return (
      <button
        key={word.id}
        type="button"
        data-quran-word-id={word.id}
        data-qiraat-multi-reader={qiraatMarker?.isGradient ? 'true' : undefined}
        id={word.wordIndexInAyah === 1 ? navigateToAyah(word.ayahKey).slice(1) : undefined}
        onPointerUp={(event) => {
          // Some mobile WebKit builds suppress the synthetic click after a touch gesture on the
          // transformed Mushaf page. Pointer-up is the reliable semantic tap boundary there.
          if (event.pointerType === 'touch' && readerLayerRef.current === 'qiraat') {
            event.stopPropagation()
            updateHoveredQiraatWord(null)
            if (qiraatEditMode || qiraatScopeModeRef.current) setQiraatEditorWord(word)
            else selectWordForQiraat(word)
          }
        }}
        onClick={(event) => {
          if (longPressFiredRef.current) {
            longPressFiredRef.current = false
            return
          }
          // Only the active layer answers a press. Qiraat first and exclusively: while it owns the
          // page a word never opens a متشابهات card or the notes sheet, however much other data it
          // carries. Runs before the touch-suppression guard below (that guard exists for
          // annotations/متشابهات, not this) so a first tap on mobile — which fires no pointer hover
          // — still peeks. First tap/hover shows the lite popup; a second tap on the SAME
          // already-peeked word (or a desktop click, since hover already peeked it) opens the full
          // detail. Reads the ref, not the state, so a stale page-slot closure can't misread it.
          // Stops here (never bubbles to the document click-outside listener below) so opening or
          // switching a peek is never immediately undone by that same click.
          if (readerLayerRef.current === 'qiraat') {
            event.stopPropagation()
            updateHoveredQiraatWord(null)
            if (qiraatScopeModeRef.current) {
              if (!qiraatScopeStartRef.current) { qiraatScopeStartRef.current = word; setQiraatScopeStart(word); return }
              const startKey = canonicalKeyForWord(qiraatScopeStartRef.current)
              const endKey = canonicalKeyForWord(word)
              setQiraatScopePreview({ startCanonicalKey: startKey, endCanonicalKey: endKey, scopeType: qiraatScopeModeRef.current })
              setQiraatEditorWord(word)
              qiraatScopeModeRef.current = null; qiraatScopeStartRef.current = null
              setQiraatScopeMode(null); setQiraatScopeStart(null)
              return
            }
            if (qiraatEditMode) setQiraatEditorWord(word)
            else selectWordForQiraat(word)
            return
          }
          // متشابهات layer: an ayah that is in one of your groups opens its card, and a word that
          // is in none of them does nothing at all — no notes panel behind the reader's back.
          if (readerLayer === 'mutshabehat') {
            if (isMutshabehatHighlighted) liveRef.current.openMutshabehatPopup(word.ayahKey)
            return
          }
          // Annotations layer (and the plain mushaf) — notes, highlight, bookmark, favourite.
          // On touch devices a tap does not open details — long-press does.
          if (Date.now() - recentTouchRef.current < 700) return
          liveRef.current.selectWord(word)
        }}
        onDoubleClick={() => void liveRef.current.copyAyahText(word.ayahKey)}
        onPointerEnter={(event) => {
          // Mouse only: touch taps are driven entirely by onClick above. Chromium's touch-tap
          // emulation (and some real devices) also synthesizes pointerenter/pointerleave around a
          // tap, which would otherwise clear a peek the instant after onClick just set it.
          if (event.pointerType !== 'mouse') return
          if (readerLayer !== 'qiraat') setHoveredAyahKey(word.ayahKey)
          if (readerLayer === 'qiraat') {
            const selection = qiraatSelectionForWord(word)
            setHoveredQiraatFocusWord(word)
            setHoveredQiraatSelection(selection)
            if (qiraatMarker) updateHoveredQiraatWord({ word, marker: qiraatMarker })
          }
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== 'mouse') return
          if (readerLayer !== 'qiraat') setHoveredAyahKey((current) => (current === word.ayahKey ? null : current))
          if (hoveredQiraatWordIdRef.current === word.id || readerLayer === 'qiraat') {
            updateHoveredQiraatWord(null)
            setHoveredQiraatSelection(null)
            setHoveredQiraatFocusWord(null)
          }
        }}
        onContextMenu={(event) => liveRef.current.openWordContextMenu(event, word)}
        onTouchStart={(event) => {
          // Qiraat edit mode owns the tap gesture. The notes long-press timer must not compete
          // with it on real mobile browsers, where the synthetic click can otherwise be delayed
          // or swallowed before the editor opens.
          if (readerLayerRef.current === 'qiraat') return
          liveRef.current.startLongPress({ targetType: 'word', ayahKey: word.ayahKey, pageNumber: word.pageNumber, word }, event)
        }}
        onTouchMove={() => { if (readerLayerRef.current !== 'qiraat') liveRef.current.cancelLongPress() }}
        onTouchEnd={() => {
          if (readerLayerRef.current === 'qiraat') return
          liveRef.current.cancelLongPress()
          const now = Date.now()
          if (now - lastTapRef.current < 300) {
            void liveRef.current.copyAyahText(word.ayahKey)
            lastTapRef.current = 0
          } else {
            lastTapRef.current = now
          }
          recentTouchRef.current = now
        }}
        aria-label={`اختيار ${word.charTypeName === 'end' ? 'علامة نهاية الآية' : 'كلمة'} ${word.textUthmani} من الآية ${word.ayahKey}${
          rulingMarker
            ? ` — أصول: ${Array.from(new Set(rulingMarker.rulings.map((r) => r.categoryAr))).join('، ')}`
            : ''
        }${
          qiraatMarker
            ? (qiraatMarker.unresolved
              ? ' — قراءة قيد المراجعة (لم تُحدَّد نسبتها بعد)'
              : ` — قراءات مختلفة: ${attributionLabelsAr(
                  Array.from(new Set(
                    (effectiveFilter.kind === 'reader'
                      ? qiraatMarker.variants.flatMap((variant) => variant.readingIds).filter((id) => getReadingOrNull(id)?.readerId === effectiveFilter.readerId)
                      : effectiveFilter.kind === 'reading'
                        ? qiraatMarker.variants.flatMap((variant) => variant.readingIds).filter((id) => id === effectiveFilter.readingId)
                        : qiraatMarker.variants.flatMap((variant) => variant.readingIds)
                    )
                  ))
                ).join('، ')}`)
            : ''
        }`}
        aria-pressed={isSelectedWord}
        // `active:` gives the press its own visual state for as long as the finger is down — the
        // other half of the iOS icon-hold feel, and the half that works on every device, since
        // mobile Safari has no vibration API to ask (see haptics.ts). Pure CSS on purpose: a
        // per-word "is pressed" state would re-render the memoized page slot and cost the ~1 ms
        // page-turn invariant on every touch.
        className={`relative z-10 inline rounded-[3px] px-0 py-0 align-baseline transition-colors select-none [-webkit-touch-callout:none] ${currentThemeTokens.wordActiveClass} focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30 ${
          isQiraatEditorSelected
            ? 'bg-[#eadfc9]/80 text-[#171717] outline outline-2 outline-offset-1 outline-[#b99b51]'
            : isQiraatReadSelected
            ? 'bg-[#f1e2b6]/70 text-[#171717] outline outline-2 outline-offset-1 outline-[#80662c]'
            : isSelectedWord
            ? currentThemeTokens.wordSelectedClass
            : highlightAnnotation
              ? ''
            : isHighlightedAyah
              ? currentThemeTokens.wordHighlightedAyahClass
              : isMutshabehatHighlighted || hasQiraatData
                ? `cursor-pointer ${currentThemeTokens.wordDefaultTextClass} hover:brightness-95`
                : `${currentThemeTokens.wordDefaultTextClass} ${currentThemeTokens.wordHoverClass}`
        }`}
        style={{
          fontFamily,
          fontSize: useGlyph ? '1em' : '0.78em',
          lineHeight: 'inherit',
          paddingBlock: MUSHAF_WORD_BAND_PADDING,
          color: annotationTextColor
            ?? effectiveMarkerColor
            ?? effectiveRulingColor
            ?? currentThemeTokens.textPrimaryHex,
          // ذو وجهين («بخلف عنه») — two equally valid readings here; never silently pick one.
          textDecoration: rulingMarker?.hasAlternate ? 'underline dotted' : undefined,
          textDecorationColor: rulingMarker?.hasAlternate ? effectiveRulingColor : undefined,
          textUnderlineOffset: rulingMarker?.hasAlternate ? '0.28em' : undefined,
          // Highlight band: the word and the gaps next to it (renderWordGap) share one colour.
          backgroundColor: (adaptedAnnotation?.backgroundColor ?? highlightAnnotation?.backgroundColor)
            ?? (showMutshabehatTint ? mutshabehatTint?.bg : undefined)
            ?? (qiraatTintColor ? `color-mix(in srgb, ${qiraatTintColor} 16%, transparent)` : undefined),
          borderRadius: showMutshabehatTint || highlightAnnotation ? 0 : undefined,
          boxShadow: qiraatView.reviewMode && (qiraatMarker || rulingMarker)
            ? `inset 0 0 0 2px ${qiraatReviewRingColor(qiraatMarker, rulingMarker, qiraatView.review)}`
            : (hasAyahBookmark || hasAyahFavorite ? (mushafTheme === 'dark' ? 'inset 0 0 0 1px rgba(200,168,107,0.5)' : 'inset 0 0 0 1px rgba(185,155,81,0.35)') : undefined),
        }}
      >
        <span style={{ position: 'relative', display: 'inline-block' }}>
          {/* Quran/Qiraat text is rendered as text, never HTML.  Besides being unnecessary for
              private-use QCF glyphs, an HTML sink would allow a future DB-backed annotation or
              imported variant to inject markup into the Mushaf. */}
          <span>{displayText ?? ''}</span>
          {rulingMarker && rulingMarker.multiple ? (
            <span
              aria-hidden="true"
              title="أكثر من أصل في هذه الكلمة"
              style={{
                position: 'absolute', insetInlineEnd: -3, top: -2,
                width: 4, height: 4, borderRadius: 9999, background: effectiveRulingColor,
              }}
            />
          ) : null}
          {qiraatMarker && qiraatMarkerCss ? (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                insetInlineStart: 0,
                insetInlineEnd: 0,
                bottom: qiraatMarkerCss.offset,
                height: qiraatMarkerCss.height,
                borderRadius: 9999,
                background: qiraatMarker?.isGradient ? qiraatMarker.color : effectiveMarkerColor,
              }}
            />
          ) : null}
          {resolvedAnnotations.length ? <span aria-hidden="true" title={`${resolvedAnnotations.length} تعليقات محفوظة`} style={{ position: 'absolute', insetInlineEnd: -4, top: -5, minWidth: 7, height: 7, paddingInline: resolvedFaceCount > 1 ? 2 : 0, borderRadius: 9999, background: resolvedAnnotations[0].resolved_color ?? '#80662c', color: 'white', fontSize: 7, lineHeight: '7px', textAlign: 'center' }}>{resolvedFaceCount > 1 ? resolvedFaceCount : ''}</span> : null}
        </span>
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
        <circle cx={cx} cy={50} r={33} fill={currentThemeTokens.surahBanner.medallionFill} stroke={`url(#${gradientId})`} strokeWidth={3} />
        <rect x={cx - 19} y={31} width={38} height={38} rx={3} fill="none" stroke={currentThemeTokens.surahBanner.medallionStroke} strokeOpacity={0.55} strokeWidth={1.4} />
        <rect x={cx - 19} y={31} width={38} height={38} rx={3} fill="none" stroke={currentThemeTokens.surahBanner.medallionStroke} strokeOpacity={0.55} strokeWidth={1.4} transform={`rotate(45 ${cx} 50)`} />
        <text
          x={cx}
          y={50}
          textAnchor="middle"
          dominantBaseline="central"
          fill={currentThemeTokens.surahBanner.medallionText}
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
              <stop offset="0" stopColor={currentThemeTokens.surahBanner.goldGradient[0]} />
              <stop offset="1" stopColor={currentThemeTokens.surahBanner.goldGradient[1]} />
            </linearGradient>
            <linearGradient id={panelId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={currentThemeTokens.surahBanner.panelGradient[0]} />
              <stop offset="1" stopColor={currentThemeTokens.surahBanner.panelGradient[1]} />
            </linearGradient>
            <pattern id={latticeId} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 8H16M8 0V16" stroke={currentThemeTokens.surahBanner.latticeStroke} strokeOpacity={currentThemeTokens.surahBanner.latticeOpacity} strokeWidth="1.3" />
            </pattern>
          </defs>

          {/* Outer band with lattice and an inner hairline rule */}
          <rect x="2" y="3" width="996" height="94" rx="12" fill={`url(#${panelId})`} stroke={`url(#${gradientId})`} strokeWidth="3.5" />
          <rect x="2" y="3" width="996" height="94" rx="12" fill={`url(#${latticeId})`} />
          <rect x="11" y="11" width="978" height="78" rx="7" fill="none" stroke={currentThemeTokens.surahBanner.innerRuleStroke} strokeOpacity={currentThemeTokens.surahBanner.innerRuleOpacity} strokeWidth="1.3" />

          {/* Central cartouche with pointed ends */}
          <path d="M262 15H738Q782 15 806 50Q782 85 738 85H262Q218 85 194 50Q218 15 262 15Z" fill={currentThemeTokens.surahBanner.cartoucheFill} stroke={`url(#${gradientId})`} strokeWidth="3" />
          <path d="M266 22H734Q771 22 791 50Q771 78 734 78H266Q229 78 209 50Q229 22 266 22Z" fill="none" stroke={currentThemeTokens.surahBanner.cartoucheInnerStroke} strokeOpacity={currentThemeTokens.surahBanner.cartoucheInnerOpacity} strokeWidth="1.2" />

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
            fill={currentThemeTokens.surahBanner.surahNameColor}
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
        className={`flex h-full items-center justify-center ${currentThemeTokens.basmalaTextClass}`}
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
              className={`h-[38%] animate-pulse rounded-full ${currentThemeTokens.skeletonBoneClass}`}
              style={{ width: index === 14 ? '60%' : '100%', marginInline: 'auto', animationDelay: `${index * 60}ms` }}
            />
          </div>
        ))}
      </div>
    )
  }

  function renderLineWords(
    page: MushafPage | null,
    pageNo: number,
    metadata: Mushaf1441PageMetadata | null,
    layout: 'single' | 'right' | 'left' = 'single',
  ) {
    const fontLoaded = qcfFontStatus[pageNo] === 'loaded'
    const fontFailed = qcfFontStatus[pageNo] === 'error'
    const isOpeningPage = pageNo <= 2
    // Page words have safe Uthmani/Amiri fallbacks. Never hold readable Quran text behind
    // the page-specific QCF font network request; swap to the exact glyph font when ready.
    const isPageReady = Boolean(page)
    const decorations = page ? getLineDecorations(page) : new Map<number, LineDecoration>()
    const isRightPage = pageNo % 2 === 1
    const marginFontSize = 'clamp(8px, 2cqw, 13px)'
    // Al-Fatihah and the start of Al-Baqarah are set as a short centred block in a framed
    // middle area; every other page uses the full 15-line grid.
    const lines = !page
      ? []
      : isOpeningPage
        ? page.lines.filter((line) => line.words.length > 0 || decorations.has(line.lineNumber))
        : page.lines
    const wordCounts = (page?.lines ?? []).map((line) => line.words.length).filter(Boolean).sort((a, b) => a - b)
    const typicalLineWordCount = wordCounts[Math.floor(wordCounts.length * 0.75)] ?? 0
    const wordOrder = new Map<string, number>()
    for (const line of page?.lines ?? []) {
      for (const word of line.words) wordOrder.set(word.id, wordOrder.size)
    }

    return (
      <div
        dir="rtl"
        className={`relative select-none overflow-visible sm:overflow-hidden ${currentThemeTokens.pageBorderClass} ${currentThemeTokens.pageShadowClass} [-webkit-touch-callout:none] sm:rounded-[10px] ${layout === 'right' ? 'sm:rounded-l-[3px]' : layout === 'left' ? 'sm:rounded-r-[3px]' : ''}`}
        style={{
          backgroundColor: currentThemeTokens.pageBg,
          width: layout === 'single' ? MUSHAF_PAGE_WIDTH : MUSHAF_SPREAD_PAGE_WIDTH,
          height: layout === 'single' ? MUSHAF_PAGE_HEIGHT : MUSHAF_SPREAD_PAGE_HEIGHT,
          maxWidth: '100%',
          maxHeight: '100%',
          containerType: 'inline-size',
        }}
        data-mushaf-leaf={layout}
        data-page-no={pageNo}
        onClick={(event) => (layout === 'single' ? liveRef.current.handlePageClick(event) : liveRef.current.handleSpreadPageClick(event, layout))}
      >
        {/* Spine shading on the inner edge of a spread page */}
        {layout !== 'single' ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-[7%]"
            style={layout === 'right'
              ? { left: 0, background: currentThemeTokens.spineGradientRight }
              : { right: 0, background: currentThemeTokens.spineGradientLeft }}
          />
        ) : null}

        {/* In-page top margin: juz / hizb / rub + surah name */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-[5.5%] pt-[1.4%] font-bold ${currentThemeTokens.marginMetaClass}`}
          style={{ fontSize: marginFontSize }}
        >
          <span className="tabular-nums">
            الجزء {metadata?.juzNumber ?? '—'} · الحزب {metadata?.hizbNumber ?? '—'} · الربع {metadata ? `${metadata.rubInJuz}/8` : '—'}
          </span>
          <span className="truncate">{metadata?.surahNames.join(' · ') ?? ''}</span>
        </div>

        {/* Left / right page indicator tab on the outer edge */}
        <span
          className={`pointer-events-none absolute top-[3.5%] rounded-md px-2 py-0.5 font-bold ${currentThemeTokens.sideTabClass} ${isRightPage ? 'right-0 rounded-r-none' : 'left-0 rounded-l-none'}`}
          style={{ fontSize: 'clamp(7px,1.7cqw,11px)' }}
        >
          {isRightPage ? 'يُمنى' : 'يُسرى'}
        </span>

        {!page && !isPageLoading && layout === 'single' ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <div>
              <p className={`text-3xl font-black ${currentThemeTokens.emptyPageNumClass}`}>{pageNo}</p>
              <p className={`mt-3 text-sm leading-7 ${currentThemeTokens.emptyPageTextClass}`}>لا توجد بيانات كلمات لهذه الصفحة.</p>
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
              const isCentered = isOpeningPage || !fontLoaded || (endsSurah && line.words.length < typicalLineWordCount * 0.7)
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
                          {renderQcfWord(word, wordOrder)}
                          {index < line.words.length - 1 ? renderWordGap(word, line.words[index + 1], isCentered, wordOrder) : null}
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
          className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center pb-[1.4%] font-black ${currentThemeTokens.marginPageNoClass}`}
          style={{ fontSize: marginFontSize }}
        >
          <span className="tabular-nums">{pageNo}</span>
        </div>

        {fontFailed ? (
          <p className="absolute inset-x-2 bottom-6 rounded-md border border-[#c07662] bg-[#fff1ed] px-3 py-1 text-center text-[10px] font-bold text-[#8a2f1b]">
            تعذّر تحميل خط المصحف لهذه الصفحة، يُعرض النص بخط بديل.
          </p>
        ) : null}
      </div>
    )
  }

  // The group list for one linked ayah. Shared by the modal (phone / portrait) and the side
  // rail (desktop / iPad landscape) so the two can never drift apart.
  function renderMutshabehatGroups(ayahKey: string) {
    const links = pageHighlights.filter((highlight) => highlight.ayahKey === ayahKey)
    const groupIds = [...new Set(links.map((link) => link.groupId).filter((id): id is string => Boolean(id)))]
    return (
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
    )
  }

  /** متشابهات rail body: the ayah's own heading plus the shared group list. */
  function renderMutshabehatSidebarBody(ayahKey: string) {
    const [surahNo, ayahNo] = ayahKey.split(':').map(Number)
    return (
      <div>
        <div className="mb-2 flex items-start justify-between gap-2 border-b border-[#eadfc9] pb-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold" style={{ color: PERSONAL_AYAH_HIGHLIGHT.text }}>من متشابهاتك</p>
            <p className="text-sm font-black leading-snug text-[#171717]">
              سورة {surahNameByNumber.get(surahNo) ?? ''} · الآية {Number.isFinite(ayahNo) ? ayahNo.toLocaleString('ar-EG') : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMutshabehatPanelAyahKey(null)}
            className="shrink-0 rounded border border-[#d7c7a7] px-2 py-0.5 text-[11px] font-bold text-[#80662c] hover:bg-[#fff7df]"
          >
            مسح التحديد
          </button>
        </div>
        {renderMutshabehatGroups(ayahKey)}
      </div>
    )
  }

  // Card for an ayah that belongs to your personal mutashabihat: every group containing it,
  // with all similar ayat (colour-coded parts), jump-to-ayah and open/edit group actions.
  function renderMutshabehatPopup() {
    if (!mutshabehatPopupAyahKey) return null
    const [surahNo, ayahNo] = mutshabehatPopupAyahKey.split(':').map(Number)
    const surahName = surahNameByNumber.get(surahNo) ?? ''
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

          {renderMutshabehatGroups(mutshabehatPopupAyahKey)}
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

    const menuTarget = contextMenu.target
    const targetAyahAnnotations = annotationsByAyahKey.get(menuTarget.ayahKey) ?? []
    const hasBookmarkOnTarget = targetAyahAnnotations.some((annotation) => annotation.annotationType === 'bookmark')
    const hasFavoriteOnTarget = targetAyahAnnotations.some((annotation) => annotation.annotationType === 'favorite')
    const existingHighlightOnTarget = isWordTarget(menuTarget)
      ? annotations.find((a) => a.annotationType === 'highlight' && a.wordId === menuTarget.word.id)
      : targetAyahAnnotations.find((a) => a.annotationType === 'highlight' && a.targetType === 'ayah')
    // Bookmark / favourite always act on the whole ayah, even when a word was tapped.
    const ayahTargetForMenu: AnnotationTarget = {
      targetType: 'ayah',
      ayahKey: menuTarget.ayahKey,
      pageNumber: menuTarget.pageNumber,
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
          <div className="space-y-1.5">
            <div className="rounded-lg border border-[#eadfc9] bg-[#fffaf0] p-1.5">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="flex items-center gap-1.5 text-xs font-bold text-[#59461d]">
                  <IconHighlight className="text-[#80662c]" />تمييز
                </span>
                {existingHighlightOnTarget ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteAnnotation(existingHighlightOnTarget.id)
                      setContextMenu(null)
                    }}
                    className="text-[11px] font-bold text-[#8a2f1b] hover:underline"
                  >
                    إزالة التمييز ✕
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTarget(contextMenu.target, 'highlight')
                      setAnnotationMode('highlight')
                      setContextMenu(null)
                    }}
                    className="text-[11px] font-bold text-[#80662c] hover:underline"
                  >
                    مخصص…
                  </button>
                )}
              </div>
              <div className="flex items-center justify-center gap-1.5 pt-1">
                {HIGHLIGHT_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    title={preset.label}
                    onClick={async () => {
                      if (existingHighlightOnTarget) {
                        await deleteAnnotation(existingHighlightOnTarget.id)
                      }
                      await persistAnnotation(buildAnnotationPayload(contextMenu.target, 'highlight', {
                        textColor: preset.textColor,
                        backgroundColor: preset.backgroundColor,
                        metadata: { source: 'mushaf-1441-preview', action: 'highlight' },
                      }))
                      setContextMenu(null)
                    }}
                    className="size-6 rounded-full border border-black/15 shadow-sm transition-transform hover:scale-110 active:scale-95"
                    style={{ backgroundColor: preset.backgroundColor }}
                  />
                ))}
              </div>
            </div>
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

        {/* Was a three-way tab bar. The layer decides now, so this is a label, not a choice — the
            sheet shows one layer's data and switching means switching layer in the top bar. */}
        <div className="rounded-lg bg-[#f4efe6] p-1">
          <p className="min-h-11 rounded-md bg-[#171717] px-2 py-3 text-center text-xs font-black text-white">
            {activeDetailTab === 'qiraat'
              ? 'القراءات العشر'
              : activeDetailTab === 'mutshabehat' ? 'المتشابهات' : 'الملاحظات والتمييز'}
          </p>
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
              <p className="text-xs font-bold text-[#80662c]">القراءات في هذا الموضع</p>
              {selectedAyahKey ? (
                <p className="text-xs text-[#665b48]">
                  سورة {surahNameByNumber.get(Number(selectedAyahKey.split(':')[0])) ?? ''} · الآية {selectedAyahKey.split(':')[1]}
                </p>
              ) : null}
            </div>

            {qiraatVariantsForSelectedAyah.length > 0 ? (
              <div className="space-y-3">
                {qiraatVariantsForSelectedAyah.map((variant) => {
                  const readerGroups = new Map<string, string[]>()
                  for (const readingId of variant.readingIds) {
                    const reading = getReadingOrNull(readingId)
                    if (!reading) continue
                    const reader = getReader(reading.readerId)
                    const narrator = getNarrator(reading.narratorId)
                    readerGroups.set(reader.nameAr, [...(readerGroups.get(reader.nameAr) ?? []), narrator.nameAr])
                  }
                  const remaining = readingsNotIn(variant.readingIds, QIRAAT_READINGS.map((reading) => reading.id))
                  const needsManualReview = variant.verificationStatus === 'NEEDS_MANUAL_REVIEW'
                  const isPerformanceOnly = variant.variantText === variant.hafsText && Boolean(variant.performanceNote)
                  return (
                    <article key={variant.id} className="rounded-md bg-[#fffaf0] p-3 text-sm">
                      {needsManualReview ? (
                        <p className="mb-2 inline-block rounded-full bg-[#f7d2c4] px-2 py-0.5 text-[10px] font-bold text-[#8a2f10]">
                          تحتاج مراجعة يدوية — غير مؤكدة من المصدر الأصلي
                        </p>
                      ) : null}
                      {isPerformanceOnly ? (
                        <p className="text-sm leading-8 text-[#3a3326]" dir="rtl">
                          <span className="font-bold text-[#171717]">{variant.uthmaniText ?? variant.hafsText}</span>
                          <span className="mr-2 text-xs text-[#8a7c5c]">(اختلاف أداء لا يغيّر الرسم)</span>
                        </p>
                      ) : (
                        <p className="text-sm leading-8 text-[#3a3326]" dir="rtl">
                          <span className="text-[#8a7c5c] line-through decoration-1">{variant.hafsText}</span>
                          {' ← '}
                          <span className="font-bold text-[#171717]">{variant.uthmaniText ?? variant.variantText}</span>
                        </p>
                      )}
                      {variant.performanceNote ? (
                        <p className="mt-1 text-xs leading-6 text-[#7a5a10]">الأداء: {variant.performanceNote}</p>
                      ) : null}
                      {variant.readingIds.length === 0 ? (
                        <p className="mt-2 border-t border-dashed border-[#e3d6b4] pt-2 text-xs font-bold text-[#8a2f10]">
                          لم تُحدَّد نسبة هذه القراءة إلى قارئ/راوٍ بعد — لا تُعرض على أنها منسوبة لأحد ولا على أنها غير موجودة عند الباقين.
                        </p>
                      ) : (
                        <>
                          <div className="mt-2 space-y-1.5 border-t border-dashed border-[#e3d6b4] pt-2">
                            {Array.from(readerGroups.entries()).map(([readerName, narrators]) => (
                              <div key={readerName}>
                                <p className="font-black text-[#171717]">{readerName}</p>
                                <p className="text-xs text-[#665b48]">{narrators.join(' · ')}</p>
                              </div>
                            ))}
                          </div>
                          <p className="mt-2 text-[11px] text-[#8a7c5c]">
                            الباقون (حفص عن عاصم وغيرهم ممن لم يُذكر أعلاه): {remaining.length} رواية بلا تغيير عن النص الأساس.
                          </p>
                        </>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#80662c]">
                        <span>نوع الاختلاف: {DIFFERENCE_TYPE_LABELS_AR[variant.differenceType]}</span>
                        <span>حالة التحقق: {variant.verificationStatus}</span>
                      </div>
                      {variant.sources?.length ? (
                        <div className="mt-1 space-y-0.5 text-[11px] text-[#8a7c5c]">
                          {variant.sources.map((source) => (
                            <p key={source.id}>المصدر: {source.sourceName} — {source.sourceReference}</p>
                          ))}
                        </div>
                      ) : null}
                      {variant.notes ? (
                        <p className="mt-2 text-xs leading-6 text-[#665b48]">{variant.notes}</p>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="rounded-md bg-[#f4efe6] px-3 py-4 text-sm leading-7 text-[#665b48]">
                {qiraatMode === 'normal'
                  ? 'فعّل وضع المقارنة أو القراءة برواية من القائمة لعرض اختلافات القراءات على هذه الصفحة.'
                  : 'لا توجد قراءات مختلفة موثقة عند هذه الآية (أو أنها مستبعدة بحسب المرشِّح الحالي).'}
              </p>
            )}
          </div>
        ) : null}
      </div>
    )
  }

  function renderHoverCard() {
    if (!hoveredAyahKey) return null
    if (readerLayer === 'qiraat') return null
    if (readerLayer !== 'mutshabehat' && readerLayer !== 'annotations') return null
    const annos = annotationsByAyahKey.get(hoveredAyahKey) ?? []
    const highlight = annos.find((annotation) => annotation.annotationType === 'highlight')
    const notes = annos.filter((annotation) => annotation.annotationType === 'note')
    const hasBookmark = annos.some((annotation) => annotation.annotationType === 'bookmark')
    const hasFavorite = annos.some((annotation) => annotation.annotationType === 'favorite')
    const mutshabehat = readerLayer === 'mutshabehat' ? mutshabehatHighlightByAyahKey.get(hoveredAyahKey) : null
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

  // Groups a set of readingIds into colored "who reads this" pills: one pill per reader when both
  // of that reader's narrators are present (reader color — Part 10 Case B), otherwise one pill per
  // individual narrator that IS present (narrator color — Case A). Never a plain black-text list.
  // Labeled "الإمام {short name}" / "الراوي {name}" — narrator names are never shortened further
  // (the two "الدوري" narrators are only disambiguated by their full name).
  function readerPillsForReadingIds(readingIds: ReadingId[]): { key: string; name: string; color: string }[] {
    const knownReadingIds = readingIds.filter((id) => getReadingOrNull(id) !== null)
    const readerIds = Array.from(new Set(knownReadingIds.map((id) => getReading(id).readerId)))
    const pills: { key: string; name: string; color: string }[] = []
    for (const readerId of readerIds) {
      const totalNarrators = narratorsOfReader(readerId).length
      const presentForReader = knownReadingIds.filter((id) => getReading(id).readerId === readerId)
      if (presentForReader.length >= totalNarrators) {
        pills.push({ key: readerId, name: `الإمام ${getReader(readerId).nameArShort}`, color: readerColor(readerId) })
      } else {
        for (const narratorId of presentForReader) {
          pills.push({ key: narratorId, name: `الراوي ${getNarrator(narratorId).nameAr}`, color: narratorColor(narratorId) })
        }
      }
    }
    return pills
  }

  function renderReaderPill(pill: { key: string; name: string; color: string }) {
    return (
      <span
        key={pill.key}
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold"
        style={{ borderColor: `${pill.color}55`, backgroundColor: `${pill.color}14`, color: pill.color }}
      >
        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: pill.color }} />
        {pill.name}
      </span>
    )
  }

  /** One authority (reader OR narrator, whichever level the source used) as a coloured pill. */
  function renderAuthorityPill(authorityId: string, key: string) {
    const isNarrator = authorityId.includes('-')
    const reading = isNarrator ? getReadingOrNull(authorityId) : null
    const narrator = reading ? getNarrator(reading.narratorId) : null
    const reader = isNarrator ? null : QIRAAT_READINGS.find((item) => item.readerId === authorityId)
    const color = reading ? narratorColor(authorityId as ReadingId) : reader ? readerColor(reader.readerId) : '#8a7c5c'
    const name = narrator
      ? `الراوي ${narrator.nameAr}`
      : reader
        ? `الإمام ${getReader(reader.readerId).nameArShort}`
        : 'نسبة غير معروفة'
    return (
      <span
        key={key}
        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold"
        style={{ borderColor: color, background: `color-mix(in srgb, ${color} 12%, white)`, color }}
      >
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 9999, background: color }} />
        {name}
      </span>
    )
  }

  /**
   * The sidebar's answer to "what is going on with this word?": for every أصول ruling on it, HOW it
   * is read (the action, e.g. إمالة / تقليل / ترقيق الراء) and WHO reads it that way — grouped by
   * action, because one word routinely carries two different actions by two different groups.
   */
  function renderQiraatSelection(selection: QiraatSelection | null = qiraatSelection) {
    if (!selection) {
      return (
        <p className="rounded-lg border border-dashed border-[#d7c7a7] bg-[#fffdf8] p-3 text-xs leading-6 text-[#8b7f6a]">
          اضغط على أي كلمة ملوَّنة في الصفحة ليظهر هنا بيانُ حكمها: كيف تُقرأ، ولمن.
        </p>
      )
    }
    const { word, rulings, variants } = selection
    return (
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-2 border-b border-[#eadfc9] pb-2">
          <span className="text-[11px] font-bold text-[#8b7f6a]" dir="ltr">{word.ayahKey}</span>
          <span className="font-[family-name:var(--font-amiri-quran)] text-2xl font-bold text-[#171717]">
            {word.textUthmani}
          </span>
        </div>

        {variants.map((variant) => {
          const isPerformanceOnly = variant.variantText === variant.hafsText && Boolean(variant.performanceNote)
          const label = variant.performanceNote ?? DIFFERENCE_TYPE_LABELS_AR[variant.differenceType]
          return (
            <div key={variant.id} className="rounded-lg border border-[#e3d6b4] bg-white p-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="rounded-full bg-[#f1e2b6] px-2 py-0.5 text-[10px] font-bold text-[#7a5a10]">{label}</span>
                <span className="text-[10px] font-bold text-[#8b7f6a]">خلاف في الرسم</span>
              </div>
              <p className="text-center font-[family-name:var(--font-amiri-quran)] text-2xl font-bold text-[#7a1f1a]">
                {variant.uthmaniText ?? (isPerformanceOnly ? variant.hafsText : variant.variantText)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {readerPillsForReadingIds(
                  (qiraatFilter.kind === 'reader' && qiraatMode === 'comparison'
                    ? variant.readingIds.filter((id) => getReadingOrNull(id)?.readerId === qiraatFilter.readerId)
                    : qiraatFilter.kind === 'reading' && qiraatMode === 'comparison'
                      ? variant.readingIds.filter((id) => id === qiraatFilter.readingId)
                      : qiraatMode === 'riwayah'
                        ? variant.readingIds.filter((id) => id === qiraatSelectedReadingId)
                        : variant.readingIds).length > 0
                    ? (qiraatFilter.kind === 'reader' && qiraatMode === 'comparison'
                        ? variant.readingIds.filter((id) => getReadingOrNull(id)?.readerId === qiraatFilter.readerId)
                        : qiraatFilter.kind === 'reading' && qiraatMode === 'comparison'
                          ? variant.readingIds.filter((id) => id === qiraatFilter.readingId)
                          : qiraatMode === 'riwayah'
                            ? variant.readingIds.filter((id) => id === qiraatSelectedReadingId)
                            : variant.readingIds)
                    : variant.readingIds
                ).map(renderReaderPill)}
              </div>
            </div>
          )
        })}

        {rulings.map((ruling) => {
          // Group by action so "أمالها حمزة والكسائي وخلف، وقلّلها ورش" reads as two lines, not one
          // flattened list that loses which group does which.
          const byAction = new Map<string, typeof ruling.attribution>()
          for (const a of ruling.attribution) {
            const list = byAction.get(a.action) ?? []
            list.push(a)
            byAction.set(a.action, list)
          }
          const alternates = ruling.readings.filter((r) => !r.isDefault)
          return (
            <div key={ruling.id} className="rounded-lg border p-2.5" style={{ borderColor: ruling.color, background: `color-mix(in srgb, ${ruling.color} 5%, white)` }}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: ruling.color }}>
                  {ruling.categoryAr}
                </span>
                {ruling.condition ? (
                  <span className="text-[10px] font-bold text-[#8b7f6a]">{ruling.condition}</span>
                ) : null}
              </div>
              {Array.from(byAction.entries()).map(([action, list]) => (
                <div key={action} className="mb-1.5 last:mb-0">
                  <p className="mb-1 text-xs font-black text-[#171717]">{action}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((a, i) => renderAuthorityPill(a.authorityId, `${ruling.id}-${action}-${i}`))}
                  </div>
                </div>
              ))}
              {ruling.text ? <p className="mt-1.5 text-[11px] leading-6 text-[#665b48]">{ruling.text}</p> : null}
              {alternates.length > 0 ? (
                <p className="mt-1.5 rounded bg-[#fdf3d8] px-2 py-1 text-[10px] font-bold text-[#7a5a10]">
                  ذو وجهين (بخلف عنه) — الوجه الآخر جائز أيضًا
                </p>
              ) : null}
              {ruling.notes ? <p className="mt-1.5 text-[11px] leading-6 text-[#8b7f6a]">{ruling.notes}</p> : null}
              {ruling.sourceNotes?.map((note, i) => (
                <p key={`${ruling.id}-source-note-${i}`} className="mt-1.5 text-[11px] leading-6 text-[#8b7f6a]">{note}</p>
              ))}
              {ruling.verificationStatus === 'NEEDS_MANUAL_REVIEW' ? (
                <p className="mt-1.5 inline-block rounded-full bg-[#f7d2c4] px-2 py-0.5 text-[10px] font-bold text-[#8a2f10]">تحتاج مراجعة يدوية</p>
              ) : null}
            </div>
          )
        })}

        {variants.length === 0 && rulings.length === 0 ? (
          <p className="text-xs text-[#8b7f6a]">لا توجد أحكام مسجَّلة على هذه الكلمة.</p>
        ) : null}
      </div>
    )
  }

  /** The permanent Qiraat sidebar — desktop and iPad landscape only (same breakpoint as the spread). */
  /** The one side rail, titled and filled by whichever layer currently owns the page. */
  function renderReaderSidebar() {
    const title = readerLayer === 'qiraat'
      ? 'القراءات العشر'
      : readerLayer === 'mutshabehat' ? 'المتشابهات' : 'الملاحظات والتمييز'
    return (
      <aside
        dir="rtl"
        data-reader-sidebar={readerLayer}
        className={`flex w-[330px] shrink-0 flex-col gap-3 overflow-y-auto border-e p-3 ${currentThemeTokens.sidebarContainerClass}`}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className={`text-sm font-black ${currentThemeTokens.sidebarTitleClass}`}>{title}</h2>
          {qiraatSelection ? (
            <button
              type="button"
              onClick={() => setQiraatSelection(null)}
              className={`rounded border px-2 py-0.5 text-[11px] font-bold ${currentThemeTokens.headerBtnClass}`}
            >
              مسح التحديد
            </button>
          ) : null}
        </div>

        {readerLayer !== 'qiraat' ? renderSidebarLayerBody() : null}

        {readerLayer === 'qiraat' ? (
        <>
        <button
          type="button"
          aria-label={qiraatEditMode ? 'إيقاف وضع تعديل القراءات' : 'تفعيل وضع تعديل القراءات'}
          aria-pressed={qiraatEditMode}
          onClick={toggleQiraatEditMode}
          className={`min-h-9 rounded border px-2 text-xs font-bold ${qiraatEditMode ? 'border-[#8c5f0a] bg-[#8c5f0a] text-white' : currentThemeTokens.headerBtnClass}`}
        >
          {qiraatEditMode ? 'وضع التعديل مفعّل' : 'تفعيل وضع التعديل'}
        </button>
        {/* The Qiraat peek lives here rather than floating over the page: an overlay on top of
            the lines swallowed the next word press and closed itself before it could be read. */}
        {hoveredQiraatWord && !hoveredQiraatSelection ? <div className={`rounded-lg border p-2.5 ${currentThemeTokens.sidebarCardClass}`}>{renderQiraatHoverCard('sidebar')}</div> : null}

        <div className={`rounded-lg border p-2.5 ${currentThemeTokens.sidebarCardClass}`}>
          {renderQiraatSelection(hoveredQiraatFocusWord ? hoveredQiraatSelection : qiraatSelection)}
        </div>

        <div className={`rounded-lg border p-2.5 ${currentThemeTokens.sidebarCardClass}`}>
          <QiraatToolbar
            mode={qiraatMode}
            onModeChange={applyQiraatMode}
            selectedReadingId={qiraatSelectedReadingId}
            onReadingChange={setQiraatSelectedReadingId}
            studyMode={qiraatStudyMode}
            onStudyModeChange={setQiraatStudyMode}
            showDifferenceFromHafs={qiraatShowDiffFromHafs}
            onShowDifferenceFromHafsChange={setQiraatShowDiffFromHafs}
            filter={qiraatFilter}
            onFilterChange={setQiraatFilter}
            includeReviewed={qiraatIncludeReviewed}
            onIncludeReviewedChange={setQiraatIncludeReviewed}
            onOpenLegend={() => setQiraatLegendOpen(true)}
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" className={`min-h-9 rounded border px-2 text-xs font-bold ${qiraatScopeMode === 'RANGE' ? 'bg-[#eadfc9]' : ''}`} onClick={() => { const next = qiraatScopeMode === 'RANGE' ? null : 'RANGE'; qiraatScopeModeRef.current = next; qiraatScopeStartRef.current = null; setQiraatScopeMode(next); setQiraatScopeStart(null); setQiraatScopePreview(undefined) }}>تحديد نطاق</button>
            <button type="button" className={`min-h-9 rounded border px-2 text-xs font-bold ${qiraatScopeMode === 'BOUNDARY' ? 'bg-[#eadfc9]' : ''}`} onClick={() => { const next = qiraatScopeMode === 'BOUNDARY' ? null : 'BOUNDARY'; qiraatScopeModeRef.current = next; qiraatScopeStartRef.current = null; setQiraatScopeMode(next); setQiraatScopeStart(null); setQiraatScopePreview(undefined) }}>تحديد حد فاصل</button>
          </div>
          {qiraatScopeMode ? <p className="mt-1 text-[11px] text-[#80662c]">اضغط الكلمة الأولى ثم الثانية لتحديد {qiraatScopeMode === 'RANGE' ? 'النطاق' : 'الحد الفاصل'}.</p> : null}
          {qiraatScopePreview ? <p className="mt-1 rounded border border-[#d7c7a7] p-2 text-[11px]">النطاق المحدد: {qiraatScopePreview.startCanonicalKey} → {qiraatScopePreview.endCanonicalKey}</p> : null}
          {renderQiraatUsulPanel()}
          {renderQiraatRules()}
        </div>
        </>
        ) : null}
      </aside>
    )
  }

  /** What the rail shows for the متشابهات and الملاحظات layers. */
  function renderSidebarLayerBody() {
    if (readerLayer === 'mutshabehat') {
      const linkedOnPage = [...new Set(pageHighlights.map((h) => h.ayahKey))]
      return (
        <div className={`rounded-lg border p-2.5 ${currentThemeTokens.sidebarCardClass}`}>
          {mutshabehatPanelAyahKey ? (
            renderMutshabehatSidebarBody(mutshabehatPanelAyahKey)
          ) : (
            <>
              <p className={`text-xs leading-6 ${currentThemeTokens.sidebarSubtextClass}`}>
                {linkedOnPage.length
                  ? `على هذه الصفحة ${linkedOnPage.length} آية من متشابهاتك. اضغط على آية ملوَّنة ليظهر هنا كل ما يرتبط بها.`
                  : 'لا توجد على هذه الصفحة آية من متشابهاتك.'}
              </p>
            </>
          )}
        </div>
      )
    }
    // الملاحظات
    return (
      <div className={`rounded-lg border p-2.5 ${currentThemeTokens.sidebarCardClass}`}>
        {needsSignIn ? (
          <a
            href={SIGN_IN_HREF}
            className={`block min-h-11 rounded-md px-4 py-3 text-center text-sm font-bold transition-colors ${
              mushafTheme === 'dark' ? 'bg-[#c8a86b] text-[#18191d] hover:bg-[#d6ba80]' : 'bg-[#171717] text-white hover:bg-[#3a3326]'
            }`}
          >
            سجّل الدخول لحفظ التمييز والملاحظات
          </a>
        ) : selectedAyahKey ? (
          renderNotesPanel('desktop')
        ) : (
          <p className={`text-xs leading-6 ${currentThemeTokens.sidebarSubtextClass}`}>
            اضغط على أي كلمة أو آية في الصفحة لتضيف لها ملاحظة أو تمييزًا أو إشارة، ويظهر تحريرها هنا.
          </p>
        )}
      </div>
    )
  }

  // أصول panel: one swatch per usul family present on this page, each togglable, plus the
  // location-review controls. The colours come from the data, never from a hardcoded UI map, so a
  // newly-imported category shows up here automatically.
  function renderQiraatUsulPanel() {
    const allRulings = qiraatRulingsForPage(pageNumber)
    const effectiveFilter: QiraatComparisonFilter = qiraatMode === 'riwayah'
      ? { kind: 'reading', readingId: qiraatSelectedReadingId }
      : qiraatFilter
    const rulings = effectiveFilter.kind === 'all'
      ? allRulings
      : allRulings.filter((r) => matchesRulingFilter(r, effectiveFilter))
    const families = rulingCategoriesOnPage(rulings)
    const pending = rulings.filter((r) => !qiraatReview[qiraatLocusKey(r.surah, r.ayah, r.startToken)])
    if (families.length === 0 && rulings.length === 0) return null
    return (
      <div className="mt-3 space-y-2 border-t border-[#eadfc9] pt-3">
        <label className="flex items-center gap-2 text-xs font-bold text-[#80662c]">
          <input
            type="checkbox"
            checked={qiraatShowUsul}
            onChange={(event) => setQiraatShowUsul(event.target.checked)}
          />
          تلوين الأصول على الكلمات
        </label>
        {qiraatShowUsul ? (
          <div className="flex flex-wrap gap-1.5">
            {families.map((family) => {
              const off = qiraatDisabledCategories.includes(family.category)
              return (
                <button
                  key={family.category}
                  type="button"
                  onClick={() => setQiraatDisabledCategories((current) => (
                    off ? current.filter((c) => c !== family.category) : [...current, family.category]
                  ))}
                  aria-pressed={!off}
                  className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px]"
                  style={{
                    borderColor: off ? '#d7c7a7' : family.color,
                    background: off ? 'transparent' : `color-mix(in srgb, ${family.color} 12%, white)`,
                    color: off ? '#8b7f6a' : family.color,
                    textDecoration: off ? 'line-through' : undefined,
                  }}
                >
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 9999, background: family.color }} />
                  {family.categoryAr}
                  <span className="opacity-60">{family.count}</span>
                </button>
              )
            })}
          </div>
        ) : null}

        <label className="flex items-center gap-2 pt-1 text-xs font-bold text-[#80662c]">
          <input
            type="checkbox"
            checked={qiraatReviewMode}
            onChange={(event) => setQiraatReviewMode(event.target.checked)}
          />
          مراجعة المواضع المستوردة
        </label>
        {qiraatReviewMode ? (
          <div className="space-y-2 rounded-lg border border-[#e3d6b4] bg-[#fffdf8] p-2.5 text-xs">
            <p className="text-[#665b48]">
              كل موضع في هذه الصفحة محاط بإطار: <span style={{ color: '#D97706' }}>برتقالي</span> لم يُراجَع بعد،
              و<span style={{ color: '#16A34A' }}>أخضر</span> مؤكَّد، و<span style={{ color: '#DC2626' }}>أحمر</span> فيه خطأ.
              قارن الكلمة بالأصل الورقي ثم أكِّد أو ارفض.
            </p>
            <p className="font-bold text-[#80662c]">بقي {pending.length} من {rulings.length} موضعًا في هذه الصفحة.</p>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {rulings.map((ruling) => {
                const key = qiraatLocusKey(ruling.surah, ruling.ayah, ruling.startToken)
                const verdict = qiraatReview[key]
                return (
                  <div key={ruling.id} className="flex items-center justify-between gap-2 rounded border border-[#eadfc9] bg-white px-2 py-1">
                    <span className="min-w-0 flex-1 truncate" style={{ color: ruling.color }} title={ruling.categoryAr}>
                      <span className="font-[var(--font-amiri-quran)] text-sm">{ruling.baseText}</span>
                      <span className="mr-1 text-[10px] opacity-70">{ruling.categoryAr}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-[#8b7f6a]">{ruling.surah}:{ruling.ayah}</span>
                    <button
                      type="button"
                      onClick={() => setQiraatVerdict(key, verdict === 'confirmed' ? null : 'confirmed')}
                      aria-pressed={verdict === 'confirmed'}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[11px]"
                      style={{ background: verdict === 'confirmed' ? '#16A34A' : '#f1efe8', color: verdict === 'confirmed' ? 'white' : '#4b463c' }}
                    >✓</button>
                    <button
                      type="button"
                      onClick={() => setQiraatVerdict(key, verdict === 'rejected' ? null : 'rejected')}
                      aria-pressed={verdict === 'rejected'}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[11px]"
                      style={{ background: verdict === 'rejected' ? '#DC2626' : '#f1efe8', color: verdict === 'rejected' ? 'white' : '#4b463c' }}
                    >✕</button>
                  </div>
                )
              })}
            </div>
            <button
              type="button"
              onClick={exportQiraatReview}
              className="w-full rounded border border-[#d7c7a7] bg-white px-2 py-1 text-[11px] font-bold text-[#80662c]"
            >
              تصدير نتائج المراجعة (JSON)
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  // Page-level Qiraat "rules" (عدّ الآي, الإدغام الكبير, أوجه الوصل بين السورتين, مد قبل الإدغام
  // الكبير, …) — a different domain from the per-word variant markers above: not anchored to one
  // token, so this renders as a plain list in the burger-menu panel rather than a word marker.
  function renderQiraatRules() {
    if (qiraatRulesForCurrentPage.length === 0) return null
    return (
      <div className="mt-3 space-y-2 border-t border-[#eadfc9] pt-3">
        <p className="text-xs font-bold text-[#80662c]">قواعد ذات صلة بهذه الصفحة</p>
        {qiraatRulesForCurrentPage.map((rule) => {
          const pills = rule.readingIds ? readerPillsForReadingIds(rule.readingIds) : []
          const needsManualReview = rule.verificationStatus === 'NEEDS_MANUAL_REVIEW'
          return (
            <div key={rule.id} className="rounded-lg border border-[#e3d6b4] bg-[#fffdf8] p-2.5 text-xs">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="rounded-full bg-[#f1e2b6] px-2 py-0.5 text-[10px] font-bold text-[#7a5a10]">{rule.category}</span>
                {needsManualReview ? (
                  <span className="rounded-full bg-[#f7d2c4] px-2 py-0.5 text-[10px] font-bold text-[#8a2f10]">تحتاج مراجعة يدوية</span>
                ) : null}
              </div>
              {rule.text ? <p className="font-bold text-[#171717]" dir="rtl">{rule.text}</p> : null}
              {rule.reading ? <p className="mt-0.5 text-[#3a3326]">الوجه: <span className="font-bold">{rule.reading}</span></p> : null}
              {rule.options && rule.options.length > 0 ? (
                <p className="mt-0.5 text-[#3a3326]">الأوجه: {rule.options.join('، ')}</p>
              ) : null}
              {pills.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">{pills.map(renderReaderPill)}</div>
              ) : rule.attributionLabel ? (
                <p className="mt-1 text-[11px] text-[#665b48]">{rule.attributionLabel}</p>
              ) : null}
              {rule.notes ? <p className="mt-1 text-[11px] leading-5 text-[#8a7c5c]">{rule.notes}</p> : null}
            </div>
          )
        })}
      </div>
    )
  }

  // The peek. `placement` decides the shell, never the contents:
  //   'sidebar' — plain block inside the side rail (desktop / iPad landscape), over no text at all;
  //   'overlay' — a fixed sheet pinned to the BOTTOM of the viewport on phones and portrait.
  // It used to be an absolutely-positioned card at the top-centre of the page stage, sitting
  // directly on the first lines. Pressing a word underneath it hit the card instead — and the
  // card closes on click — so the peek vanished and the word was never selected. Moving it off
  // the text is the fix; nothing about closing behaviour needed to change.
  function renderQiraatHoverCard(placement: 'sidebar' | 'overlay' = 'overlay') {
    if (!hoveredQiraatWord) return null
    const { word, marker } = hoveredQiraatWord
    const surahName = surahNameByNumber.get(word.surahNumber) ?? ''
    const shownVariants = marker.variants.slice(0, 3)
    const showWajhNumbers = shownVariants.length > 1
    const effectiveFilter: QiraatComparisonFilter = qiraatView.mode === 'riwayah'
      ? { kind: 'reading', readingId: qiraatView.selectedReadingId }
      : qiraatView.filter

    // Only who DIFFERS from Hafs, and how — never Hafs's own reading or whoever merely agrees
    // with him (no "الباقون"/baseline group here; that stays a full-detail-panel-only concept).
    const shellClass = placement === 'sidebar'
      ? 'block cursor-pointer text-right'
      : 'fixed inset-x-2 bottom-2 z-30 mx-auto block max-h-[52vh] w-auto max-w-lg cursor-pointer overflow-y-auto rounded-xl border border-[#d7c7a7] bg-[#fffdf8]/98 p-3 text-right shadow-[0_-14px_50px_rgba(23,23,23,0.28)] backdrop-blur-sm'

    return (
      <div
        className={shellClass}
        data-qiraat-peek={placement}
        style={placement === 'overlay' ? { paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' } : undefined}
        dir="rtl"
        onClick={() => updateHoveredQiraatWord(null)}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#eadfc9] pb-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#f1e2b6] px-2.5 py-1 text-[11px] font-bold text-[#7a5a10]">خلاف في الكلمة</span>
            <span className="text-sm font-black text-[#171717]">{surahName} — آية {word.ayahNumber}</span>
          </div>
          <button
            type="button"
            aria-label="إغلاق"
            onClick={(e) => {
              e.stopPropagation()
              updateHoveredQiraatWord(null)
            }}
            className="rounded px-1.5 py-0.5 text-xs font-bold text-[#8b7f6a] hover:bg-[#ebdcc0] hover:text-[#171717]"
          >
            ✕
          </button>
        </div>
        {marker.unresolved ? (
          <p className="mt-2 text-xs font-bold text-[#8a2f10]">قراءة قيد المراجعة — لم تُحدَّد نسبتها بعد</p>
        ) : (
          <div className="mt-2.5 space-y-2.5">
            {shownVariants.map((variant, index) => {
              const needsManualReview = variant.verificationStatus === 'NEEDS_MANUAL_REVIEW'
              const isPerformanceOnly = variant.variantText === variant.hafsText && Boolean(variant.performanceNote)
              // The exact ruling (تشكيل/تقليل/إمالة/إدغام/تحقيق أو إبدال الهمزة/مد...), never a
              // generic "أداء" placeholder — performanceNote is the precise phonetic description
              // when this locus has one, otherwise the variant's own difference-type category.
              const rulingLabel = variant.performanceNote ?? DIFFERENCE_TYPE_LABELS_AR[variant.differenceType]
              const displayedReadingIds = effectiveFilter.kind === 'reader'
                ? variant.readingIds.filter((id) => getReadingOrNull(id)?.readerId === effectiveFilter.readerId)
                : effectiveFilter.kind === 'reading'
                  ? variant.readingIds.filter((id) => id === effectiveFilter.readingId)
                  : variant.readingIds
              const pills = readerPillsForReadingIds(displayedReadingIds.length > 0 ? displayedReadingIds : variant.readingIds)
              return (
                <div key={variant.id} className="rounded-xl border border-[#e3d6b4] bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-[#f1e2b6] px-2 py-0.5 text-[10px] font-bold leading-relaxed text-[#7a5a10]">{rulingLabel}</span>
                    {showWajhNumbers ? <span className="rounded-full bg-[#171717] px-2 py-0.5 text-[10px] font-bold text-white">الوجه {index + 1}</span> : null}
                  </div>
                  {needsManualReview ? (
                    <p className="mb-1.5 inline-block rounded-full bg-[#f7d2c4] px-2 py-0.5 text-[10px] font-bold text-[#8a2f10]">تحتاج مراجعة يدوية</p>
                  ) : null}
                  <p className="text-center text-3xl font-bold leading-relaxed text-[#7a1f1a] font-[family-name:var(--font-amiri-quran)]">
                    {variant.uthmaniText ?? (isPerformanceOnly ? variant.hafsText : variant.variantText)}
                  </p>
                  <p className="mb-1.5 mt-2 text-[10px] font-bold text-[#8a7c5c]">القرّاء والرواة:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pills.map(renderReaderPill)}
                  </div>
                </div>
              )
            })}
            {marker.variants.length > 3 ? (
              <p className="text-[11px] text-[#8a7c5c]">و{marker.variants.length - 3} أخرى — اضغط للتفاصيل الكاملة</p>
            ) : null}
          </div>
        )}
        <p className="mt-2.5 text-[10px] text-[#a8987a]">اضغط في أي مكان للإغلاق</p>
      </div>
    )
  }


  // Anchored dropdown under the surah name, not a full-screen modal: the reader is picking a
  // surah while looking at the page, so the list stays small and beside its own trigger.
  function renderSurahPicker() {
    if (!isSurahPickerOpen) return null
    const close = () => { setIsSurahPickerOpen(false); setSurahPickerSearch('') }
    return (
      <>
        {/* Click-away catcher; the panel sits above it. */}
        <button type="button" aria-label="إغلاق قائمة السور" onClick={close} className="fixed inset-0 z-40 cursor-default" />
        <div
          dir="rtl"
          role="dialog"
          aria-label="فهرس السور"
          className="absolute right-0 top-full z-50 mt-1 flex max-h-[min(60vh,420px)] w-[17rem] sm:w-[19rem] flex-col overflow-hidden rounded-xl border border-[#d7c7a7] bg-[#fffdf8] shadow-[0_18px_50px_rgba(23,23,23,0.28)]"
        >
            <div className="border-b border-[#eadfc9] bg-[#fffaf0] p-2.5">
              <div className="relative">
                <input
                  type="text"
                  value={surahPickerSearch}
                  onChange={(e) => setSurahPickerSearch(e.target.value)}
                  placeholder="ابحث باسم السورة أو رقمها…"
                  aria-label="بحث في السور"
                  className="w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#a8987a] focus:border-[#171717] focus:outline-none"
                  autoFocus
                />
                {surahPickerSearch ? (
                  <button
                    type="button"
                    onClick={() => setSurahPickerSearch('')}
                    aria-label="مسح البحث"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-xs text-[#80662c] hover:bg-[#f0e4cc]"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#f0e4cc] p-2">
              {filteredSurahOptions.length === 0 ? (
                <p className="p-6 text-center text-xs font-bold text-[#8a7c5c]">
                  لا توجد سورة مطابقة للبحث
                </p>
              ) : (
                filteredSurahOptions.map((surah) => {
                  const currentSurahNumber = visiblePageMetadata?.surahNumbers[0] ?? selectedSurahNumber
                  const isCurrent = surah.surahNumber === currentSurahNumber
                  return (
                    <button
                      key={surah.surahNumber}
                      type="button"
                      ref={isCurrent ? currentSurahItemRef : null}
                      onClick={() => void selectSurahFromPicker(surah)}
                      className={`flex w-full items-center justify-between px-3 py-2.5 rounded-lg text-right transition-colors ${
                        isCurrent
                          ? 'bg-[#171717] text-white shadow-sm'
                          : 'hover:bg-[#f7f0e0] active:bg-[#ebdcc0] text-[#171717]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                          isCurrent ? 'bg-white/20 text-white' : 'bg-[#f0e4cc] text-[#80662c]'
                        }`}>
                          {surah.surahNumber}
                        </span>
                        <div>
                          <p className="text-base font-black font-[family-name:var(--font-amiri-quran)] leading-tight">
                            سورة {surah.name}
                          </p>
                          <p className={`text-[11px] font-bold ${isCurrent ? 'text-white/80' : 'text-[#80662c]'}`}>
                            {surah.ayahCount} آية
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold tabular-nums ${
                          isCurrent ? 'bg-white/20 text-white' : 'bg-[#fffaf0] border border-[#d7c7a7] text-[#80662c]'
                        }`}>
                          ص {surah.firstPage ?? '—'}
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
        </div>
      </>
    )
  }

  function renderSettingsModal() {
    if (!isSettingsOpen) return null

    const isDark = mushafTheme === 'dark'

    const themes: Array<{
      id: MushafTheme
      title: string
      subtitle: string
      previewBg: string
      previewBorder: string
      previewText: string
      previewAccent: string
      desc: string
    }> = [
      {
        id: 'sepia',
        title: 'ورق كلاسيكي دافئ',
        subtitle: 'المظهر التراثي الأصلي لمصحف المدينة المنورة',
        previewBg: '#fcf8ed',
        previewBorder: '#d7c7a7',
        previewText: '#1b1b1b',
        previewAccent: '#80662c',
        desc: 'صفحات بلون الورق الطبيعي المعتق، مريح للعين في الإضاءة النهارية والمعتدلة.',
      },
      {
        id: 'dark',
        title: 'الوضع الليلي الداكن',
        subtitle: 'قراءة ليلية مريحة مع حبر ذهبي ورمادي عالي التباين',
        previewBg: '#18191d',
        previewBorder: '#3b3d45',
        previewText: '#f1f5f9',
        previewAccent: '#c8a86b',
        desc: 'خلفية داكنة خافتة مع نصوص عالية التباين، مخصصة للقراءة في الظلام وتوفير طاقة الشاشة.',
      },
      {
        id: 'white',
        title: 'صفحة بيضاء ناصعة',
        subtitle: 'ورق أبيض ناصع بتباين استثنائي وألوان طباعة دقيقة',
        previewBg: '#ffffff',
        previewBorder: '#d1d5db',
        previewText: '#111827',
        previewAccent: '#92400e',
        desc: 'صفحة بيضاء صافية بحبر كربوني فاحم، تبرز علامات المصحف وتلوينات المتشابهات بوضوح تام.',
      },
    ]

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" dir="rtl">
        {/* Backdrop */}
        <button
          type="button"
          aria-label="إغلاق إعدادات المظهر"
          onClick={() => setIsSettingsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity"
        />

        {/* Modal Window */}
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="mushaf-settings-title"
          className={`relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-2xl border shadow-2xl transition-all sm:rounded-2xl ${
            isDark
              ? 'border-[#2d2f36] bg-[#18191d] text-[#f1f5f9]'
              : 'border-[#d7c7a7] bg-[#fffdf8] text-[#1f2937]'
          }`}
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          {/* Header */}
          <div className={`flex items-center justify-between border-b px-5 py-4 ${
            isDark ? 'border-[#2d2f36] bg-[#1f2127]' : 'border-[#eadfc9] bg-[#faf4e6]'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className={`flex size-9 items-center justify-center rounded-lg border text-base ${
                isDark ? 'border-[#3b3d45] bg-[#18191d] text-[#c8a86b]' : 'border-[#d7c7a7] bg-white text-[#80662c]'
              }`}>
                ⚙
              </span>
              <div>
                <h2 id="mushaf-settings-title" className="text-base font-black sm:text-lg">
                  مظهر المصحف وقراءة الصفحات
                </h2>
                <p className={`text-xs ${isDark ? 'text-[#9ca3af]' : 'text-[#80662c]'}`}>
                  اختر الطابع البصري الملائم لبيئة قراءتك
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className={`size-9 rounded-lg border text-sm font-bold transition-colors ${
                isDark
                  ? 'border-[#3b3d45] text-[#9ca3af] hover:bg-[#2d2f36] hover:text-white'
                  : 'border-[#d7c7a7] text-[#59461d] hover:bg-[#f3ebd7]'
              }`}
              aria-label="إغلاق النافذة"
            >
              ✕
            </button>
          </div>

          {/* Body: Theme Options */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="space-y-3" role="radiogroup" aria-labelledby="mushaf-settings-title">
              {themes.map((theme) => {
                const isSelected = mushafTheme === theme.id
                return (
                  <button
                    key={theme.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => switchMushafTheme(theme.id)}
                    className={`group relative flex w-full flex-col gap-3 rounded-xl border p-3.5 text-right transition-all sm:flex-row sm:items-center sm:p-4 ${
                      isSelected
                        ? isDark
                          ? 'border-[#c8a86b] bg-[#22242a] shadow-[0_0_0_2px_#c8a86b]'
                          : 'border-[#80662c] bg-[#fffaf0] shadow-[0_0_0_2px_#80662c]'
                        : isDark
                          ? 'border-[#2d2f36] bg-[#1a1c22] hover:border-[#3b3d45] hover:bg-[#22242a]'
                          : 'border-[#eadfc9] bg-white hover:border-[#d7c7a7] hover:bg-[#fcf8ed]'
                    }`}
                  >
                    {/* Visual Preview Card */}
                    <div
                      className="relative flex h-24 w-full shrink-0 flex-col justify-between overflow-hidden rounded-lg border p-2.5 shadow-sm sm:h-24 sm:w-36"
                      style={{
                        backgroundColor: theme.previewBg,
                        borderColor: theme.previewBorder,
                        color: theme.previewText,
                      }}
                    >
                      <div className="flex items-center justify-between border-b pb-1" style={{ borderColor: theme.previewBorder }}>
                        <span className="text-[9px] font-black" style={{ color: theme.previewAccent }}>
                          سورة الفاتحة
                        </span>
                        <span className="text-[9px] tabular-nums opacity-60">١</span>
                      </div>
                      <div className="my-auto text-center font-serif text-sm font-bold tracking-wide">
                        ﴿ بِسْمِ ٱللَّهِ ﴾
                      </div>
                      <div className="flex items-center justify-between pt-1" style={{ borderColor: theme.previewBorder }}>
                        <span className="h-1 w-6 rounded-full" style={{ backgroundColor: theme.previewAccent }} />
                        <span className="text-[8px] opacity-70">١٤٤١ هـ</span>
                      </div>
                    </div>

                    {/* Text Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black sm:text-base">{theme.title}</span>
                          {isSelected ? (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                              isDark ? 'bg-[#c8a86b] text-[#18191d]' : 'bg-[#80662c] text-white'
                            }`}>
                              المظهر النشط ✓
                            </span>
                          ) : null}
                        </div>
                        {/* Radio circle indicator */}
                        <span
                          className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            isSelected
                              ? isDark
                                ? 'border-[#c8a86b] bg-[#c8a86b] text-[#18191d]'
                                : 'border-[#80662c] bg-[#80662c] text-white'
                              : isDark
                                ? 'border-[#4b5563] bg-transparent'
                                : 'border-[#c2b291] bg-transparent'
                          }`}
                        >
                          {isSelected ? (
                            <span className="size-2 rounded-full bg-current" />
                          ) : null}
                        </span>
                      </div>
                      <p className={`mt-0.5 text-xs font-medium ${isDark ? 'text-[#c8a86b]' : 'text-[#80662c]'}`}>
                        {theme.subtitle}
                      </p>
                      <p className={`mt-1 text-[11px] leading-relaxed ${isDark ? 'text-[#9ca3af]' : 'text-[#6b7280]'}`}>
                        {theme.desc}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Explanatory note */}
            <div className={`mt-4 rounded-xl border p-3 text-xs leading-relaxed ${
              isDark
                ? 'border-[#2d2f36] bg-[#1a1c22] text-[#9ca3af]'
                : 'border-[#eadfc9] bg-[#fbf7ee] text-[#786438]'
            }`}>
              <div className="flex items-start gap-2">
                <span className="text-sm">✦</span>
                <p>
                  يتم حفظ المظهر تلقائياً على جهازك، ويشمل ضبط تلوينات الآيات المتشابهة، أحكام أصول القراءات، وهوامش المصحف، وتأثير طي الصفحات.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-end gap-2 border-t px-5 py-3 ${
            isDark ? 'border-[#2d2f36] bg-[#1f2127]' : 'border-[#eadfc9] bg-[#faf4e6]'
          }`}>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className={`min-h-11 rounded-lg px-6 text-sm font-black transition-colors ${
                isDark
                  ? 'bg-[#c8a86b] text-[#18191d] hover:bg-[#dfbe7f]'
                  : 'bg-[#80662c] text-white hover:bg-[#59461d]'
              }`}
            >
              تم الحفظ والتطبيق
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div
      dir="rtl"
      className={`flex h-[100dvh] flex-col overflow-hidden ${currentThemeTokens.viewerBgClass}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Slim top bar — the main screen is the mushaf itself */}
      <header className={`flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2 ${currentThemeTokens.headerBgClass}`}>
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            aria-label="القائمة والإعدادات"
            className={`flex size-10 shrink-0 items-center justify-center rounded-md border transition-colors ${currentThemeTokens.headerBtnClass}`}
          >
            <span className="flex flex-col gap-[3px]">
              <span className={`block h-0.5 w-5 rounded ${mushafTheme === 'dark' ? 'bg-[#f1f5f9]' : 'bg-current'}`} />
              <span className={`block h-0.5 w-5 rounded ${mushafTheme === 'dark' ? 'bg-[#f1f5f9]' : 'bg-current'}`} />
              <span className={`block h-0.5 w-5 rounded ${mushafTheme === 'dark' ? 'bg-[#f1f5f9]' : 'bg-current'}`} />
            </span>
          </button>
          <div className="relative min-w-0">
          <button
            type="button"
            onClick={() => {
              setSurahPickerSearch('')
              setIsSurahPickerOpen((open) => !open)
            }}
            aria-label="اختيار السورة من القائمة"
            aria-haspopup="dialog"
            aria-expanded={isSurahPickerOpen}
            className="flex min-w-0 items-center gap-1 rounded-lg px-2 py-1 text-right transition-colors hover:brightness-95 active:brightness-90"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className={`truncate text-sm font-black leading-tight sm:text-base ${currentThemeTokens.headerTitleClass}`}>
                  {visiblePageMetadata?.surahNames.join(' · ') ?? 'مصحف المدينة ١٤٤١'}
                </p>
                <svg className={`size-3.5 shrink-0 ${currentThemeTokens.headerSubClass}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </div>
              <p className={`truncate text-[11px] font-bold tabular-nums ${currentThemeTokens.headerSubClass}`} dir="ltr">
                {visiblePageMetadata ? `${visiblePageMetadata.firstAyahKey} → ${visiblePageMetadata.lastAyahKey}` : ''}
              </p>
            </div>
          </button>
          {renderSurahPicker()}
          </div>
          {/* The page number gets its own fixed-width frame OUTSIDE the truncating block: inside
              it, a long surah name pushed it into the ellipsis and the number became unreadable. */}
          <span
            className={`flex shrink-0 flex-col items-center justify-center rounded-md border px-2.5 py-1 leading-none ${currentThemeTokens.headerPageFrameClass}`}
            title={`الصفحة ${pageNumber} من ${MUSHAF_1441_PAGE_COUNT}`}
          >
            <span className={`text-[9px] font-bold ${currentThemeTokens.headerPageFrameLabelClass}`}>صفحة</span>
            <span className={`text-sm font-black tabular-nums ${currentThemeTokens.headerPageFrameNumClass}`} dir="ltr">{pageNumber}</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => turnPage(-1)}
            disabled={pageNumber <= MIN_PAGE}
            aria-label="الصفحة السابقة"
            className={`hidden size-10 items-center justify-center rounded-md border text-lg font-bold transition-colors disabled:opacity-40 sm:flex ${currentThemeTokens.headerBtnClass}`}
          >
            →
          </button>
          <button
            type="button"
            onClick={() => turnPage(1)}
            disabled={pageNumber >= MAX_PAGE}
            aria-label="الصفحة التالية"
            className={`hidden size-10 items-center justify-center rounded-md border text-lg font-bold transition-colors disabled:opacity-40 sm:flex ${currentThemeTokens.headerBtnClass}`}
          >
            ←
          </button>
          <Link
            href="/"
            prefetch={false}
            aria-label="العودة إلى المتشابهات"
            title="المتشابهات"
            className={`flex size-10 items-center justify-center rounded-md border transition-colors ${currentThemeTokens.headerBtnClass}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 11.5 12 4l9 7.5" />
              <path d="M5.5 10v9a1 1 0 0 0 1 1H10v-5h4v5h3.5a1 1 0 0 0 1-1v-9" />
            </svg>
          </Link>
          <button
            type="button"
            onClick={() => toggleLayer('annotations')}
            aria-label={annotationsVisible ? 'إخفاء الملاحظات والتظليل' : 'إظهار الملاحظات والتظليل — وإيقاف المتشابهات والقراءات'}
            aria-pressed={annotationsVisible}
            title="الملاحظات والتظليل"
            className={`flex size-10 items-center justify-center rounded-md border text-sm font-black transition-colors ${
              annotationsVisible
                ? 'border-[#8c5f0a] bg-[#8c5f0a] text-white'
                : currentThemeTokens.headerBtnClass
            }`}
          >
            ن
          </button>
          <button
            type="button"
            onClick={() => toggleLayer('mutshabehat')}
            aria-label={mutshabehatHighlightEnabled ? 'إخفاء تظليل المتشابهات' : 'إظهار تظليل المتشابهات — وإيقاف الملاحظات والقراءات'}
            aria-pressed={mutshabehatHighlightEnabled}
            title="المتشابهات"
            className={`flex size-10 items-center justify-center rounded-md border text-sm font-black transition-colors ${
              mutshabehatHighlightEnabled
                ? 'border-[#0d7a6f] bg-[#0d7a6f] text-white'
                : currentThemeTokens.headerBtnClass
            }`}
          >
            م
          </button>
          <button
            type="button"
            onClick={() => toggleLayer('qiraat')}
            aria-label={qiraatMode === 'normal' ? 'تفعيل عرض القراءات — وإيقاف الملاحظات والمتشابهات' : 'إيقاف عرض القراءات — العودة إلى المصحف العادي'}
            aria-pressed={qiraatMode !== 'normal'}
            title="عرض القراءات"
            className={`flex min-h-10 items-center justify-center gap-1 rounded-md border px-2 text-sm font-black transition-colors ${
              qiraatMode !== 'normal'
                ? (mushafTheme === 'dark' ? 'border-[#c8a86b] bg-[#c8a86b] text-[#18191d]' : 'border-[#171717] bg-[#171717] text-white')
                : currentThemeTokens.headerBtnClass
            }`}
          >
            <span aria-hidden="true">ق</span><span className="hidden text-[10px] sm:inline">قراءات</span>
          </button>
        </div>
      </header>

      {/* On desktop / iPad landscape the Qiraat panel is a permanent sidebar beside the page
          instead of living inside the burger drawer; the page re-fits itself via container queries. */}
      <div className="flex min-h-0 flex-1">
      {showReaderSidebar ? renderReaderSidebar() : null}

      {/* The mushaf page fills the screen; drag a page to curl it over */}
      <main
        ref={pageMainRef}
        className="relative min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain"
        style={{ containerType: 'size', touchAction: 'none' }}
        onPointerDown={handlePagePointerDown}
        onPointerMove={handlePagePointerMove}
        onPointerUp={handlePagePointerEnd}
        onPointerCancel={handlePagePointerEnd}
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return
          suppressClickRef.current = false
          event.stopPropagation()
          event.preventDefault()
        }}
        onWheel={handleWheel}
      >
        <div ref={pageStageRef} className="absolute inset-0 grid grid-cols-1 grid-rows-1 p-0 sm:p-3">
          {slotGroups.map((group) => {
            const isCurrent = group === slotGroupOf(pageNumber)
            const groupPages = isSpread ? [group, group + 1].filter((no) => no <= MAX_PAGE) : [group]
            return (
              <div
                key={`${isSpread ? 'spread' : 'page'}-${group}`}
                dir="rtl"
                data-page-slot-group={group}
                data-page-slot-current={isCurrent ? '' : undefined}
                aria-hidden={isCurrent ? undefined : true}
                inert={!isCurrent}
                className={`flex min-h-0 min-w-0 items-center justify-center [grid-area:1/1] ${isSpread ? 'gap-[3px]' : ''}`}
                style={{ visibility: isCurrent ? 'visible' : 'hidden' }}
              >
                {groupPages.map((no) => {
                  const layout: PageLayout = isSpread ? (no % 2 === 1 ? 'right' : 'left') : 'single'
                  const slotPage = pageCache[no] ?? (currentPage?.pageNumber === no ? currentPage : null)
                  const slotMetadata = pageMetadataCache[no] ?? (currentPageMetadata.pageNumber === no ? currentPageMetadata : null)
                  return (
                    <MushafPageSlot
                      key={no}
                      pageNo={no}
                      layout={layout}
                      page={slotPage}
                      metadata={slotMetadata}
                      fontStatus={qcfFontStatus[no]}
                      highlights={slotHighlightByAyahKey}
                      // Gated here, not just at the maps: MushafPageSlot compares props by
                      // identity, so passing the raw array would leave the slot convinced nothing
                      // changed and the layer would only vanish when some other prop happened to move.
                      annotations={annotationsVisible ? annotations : EMPTY_ANNOTATIONS}
                      qiraat={qiraatView}
                      // `readerLayer` rides along because renderQcfWord's click/press
                      // routing reads it: without it a slot could keep a closure from the
                      // previous layer and answer a press the way that layer used to.
                      selection={`${readerLayer}|${qiraatEditMode ? 'edit' : 'read'}|${selectedAyahKey ?? ''}|${selectedWord?.id ?? ''}|${qiraatEditorWord?.id ?? ''}|${qiraatSelection?.word.id ?? ''}`}
                      loading={isCurrent && isPageLoading}
                      theme={mushafTheme}
                      render={() => renderLineWords(slotPage, no, slotMetadata, layout)}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
        {pageTurn ? (
          <PageCurlOverlay
            key={pageTurn.id}
            ref={curlRef}
            mode={pageTurn.mode}
            leaf={pageTurn.leaf}
            peelFrom={pageTurn.peelFrom}
            travel={pageTurn.travel}
            front={pageTurn.front}
            still={pageTurn.still}
            backRect={pageTurn.backRect}
            paperColor={currentThemeTokens.pageBg}
            resolveBack={() => (pageTurn.backPageNo === null
              ? null
              : pageStageRef.current?.querySelector<HTMLElement>(`[data-page-slot-current] [data-page-no="${pageTurn.backPageNo}"]`) ?? null)}
            onFinish={finishPageTurn}
          />
        ) : null}
        {hoveredQiraatWord ? (
          <>
            <button
              type="button"
              aria-label="إغلاق بطاقة القراءات"
              onClick={() => updateHoveredQiraatWord(null)}
              className="fixed inset-0 z-10 bg-black/20 backdrop-blur-[1px] sm:hidden"
            />
            {showReaderSidebar ? null : renderQiraatHoverCard('overlay')}
          </>
        ) : (readerLayer === 'qiraat' ? null : renderHoverCard())}
        {isPageLoading ? (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <span className="rounded-full bg-[#171717]/85 px-3 py-1 text-xs font-bold text-white">جاري التحميل…</span>
          </div>
        ) : null}
      </main>
      {qiraatEditorWord ? <div className={qiraatEditorDesktop ? 'flex min-h-0' : 'contents'}>{renderQiraatEditor(qiraatEditorDesktop)}</div> : null}
      </div>

      {/* Bottom quick page slider — preview page + surah while dragging, navigate on release */}
      {(() => {
        const sliderValue = pageSliderPreview ?? pageNumber
        const previewSurah = surahStartForPage(sliderValue)
        const previewName = previewSurah?.name ?? ''
        // RTL slider: page 1 sits on the right, the last page on the left.
        const leftPct = 100 - ((sliderValue - 1) / (MUSHAF_1441_PAGE_COUNT - 1)) * 100
        const commit = () => {
          if (pageSliderPreview && pageSliderPreview !== pageNumber) {
            void goToPage(pageSliderPreview)
          }
          setPageSliderPreview(null)
        }
        return (
          <div
            className={`relative flex shrink-0 items-center gap-3 border-t px-3 py-2 ${currentThemeTokens.sliderContainerClass}`}
            style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
          >
            {pageSliderPreview !== null ? (
              <div
                className={`pointer-events-none absolute -top-12 z-50 -translate-x-1/2 rounded-xl border px-4 py-2 text-center shadow-[0_10px_30px_rgba(0,0,0,0.3)] ${currentThemeTokens.sliderPreviewClass}`}
                style={{ left: `clamp(60px, ${leftPct}%, calc(100% - 60px))` }}
              >
                <p className={`text-base font-black tabular-nums ${currentThemeTokens.sliderPreviewTextClass}`}>ص {sliderValue}</p>
                <p className={`text-[10px] font-bold ${currentThemeTokens.sliderPreviewSubClass}`}>{previewName}</p>
              </div>
            ) : null}
            <span className={`w-24 shrink-0 truncate text-xs font-black ${currentThemeTokens.sliderTextClass}`}>
              <span className="tabular-nums">ص {sliderValue}</span> · {previewName}
            </span>
            <input
              type="range"
              min={1}
              max={MUSHAF_1441_PAGE_COUNT}
              step={1}
              value={sliderValue}
              aria-label="انتقال سريع للصفحة"
              onPointerDown={() => setPageSliderPreview(pageNumber)}
              onChange={(event) => setPageSliderPreview(Number(event.target.value))}
              onPointerUp={commit}
              onPointerCancel={() => setPageSliderPreview(null)}
              onKeyUp={commit}
              onBlur={() => setPageSliderPreview(null)}
              className={`h-3 flex-1 cursor-pointer appearance-none rounded-full ${currentThemeTokens.sliderTrackClass} [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full`}
              style={{ accentColor: currentThemeTokens.sliderThumbColor }}
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
            className={`absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col gap-5 overflow-y-auto border-l p-4 shadow-[-18px_0_70px_rgba(23,23,23,0.25)] ${currentThemeTokens.drawerAsideClass}`}
            style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${currentThemeTokens.drawerHeaderSubClass}`}>Mushaf 1441</p>
                <h2 className={`text-lg font-black ${currentThemeTokens.drawerTitleClass}`}>القائمة</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  aria-label="إعدادات مظهر المصحف"
                  title="المظهر والسمات"
                  className={`flex size-10 items-center justify-center rounded-md border transition-colors ${currentThemeTokens.drawerCloseBtnClass}`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="إغلاق"
                  className={`flex size-10 items-center justify-center rounded-md border text-xl font-bold transition-colors ${currentThemeTokens.drawerCloseBtnClass}`}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Appearance & Settings */}
            <div className={`rounded-lg border p-3 ${currentThemeTokens.drawerCardClass}`}>
              <div className="flex items-center justify-between">
                <p className={`text-xs font-bold ${currentThemeTokens.drawerHeaderSubClass}`}>مظهر المصحف والإعدادات</p>
                <span className={`text-[11px] font-bold ${currentThemeTokens.drawerHeaderSubClass}`}>
                  {currentThemeTokens.nameArShort}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className={`mt-2 flex min-h-11 w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-right transition-colors ${currentThemeTokens.drawerCardAltClass} hover:brightness-95`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="size-4 shrink-0 rounded-full border shadow-xs"
                    style={{
                      backgroundColor: currentThemeTokens.pageBg,
                      borderColor: mushafTheme === 'dark' ? '#3f4046' : '#d7c7a7',
                    }}
                  />
                  <div>
                    <span className={`block text-sm font-black ${currentThemeTokens.drawerTitleClass}`}>
                      تغيير مظهر الصفحات
                    </span>
                    <span className={`block text-[11px] leading-5 ${currentThemeTokens.drawerSubtextClass}`}>
                      ورق دافئ · ليلي داكن · ورق أبيض
                    </span>
                  </div>
                </div>
                <span aria-hidden className={`text-lg font-bold ${currentThemeTokens.drawerHeaderSubClass}`}>‹</span>
              </button>
            </div>

            {/* Account / sign-in */}
            <div className={`rounded-lg border p-3 ${currentThemeTokens.drawerCardClass}`}>
              <p className={`text-xs font-bold ${currentThemeTokens.drawerHeaderSubClass}`}>الحساب</p>
              {needsSignIn ? (
                <>
                  <p className={`mt-1 text-xs leading-6 ${currentThemeTokens.drawerSubtextClass}`}>
                    لإضافة تمييز أو ملاحظات أو إشارات أو مفضلة وحفظها، سجّل الدخول أولاً.
                  </p>
                  <a
                    href={SIGN_IN_HREF}
                    className={`mt-2 block min-h-11 rounded-md px-4 py-3 text-center text-sm font-bold transition-colors ${
                      mushafTheme === 'dark' ? 'bg-[#c8a86b] text-[#18191d] hover:bg-[#d6ba80]' : 'bg-[#171717] text-white hover:bg-[#3a3326]'
                    }`}
                  >
                    تسجيل الدخول
                  </a>
                </>
              ) : annotationSyncAvailable ? (
                <p className="mt-1 text-xs leading-6 text-[#16a34a]">مزامنة التمييز والملاحظات مع حسابك مفعّلة.</p>
              ) : (
                <p className={`mt-1 text-xs leading-6 ${currentThemeTokens.drawerSubtextClass}`}>{annotationStatus ?? 'المزامنة غير متاحة حالياً.'}</p>
              )}
            </div>

            {/* Qiraat Ashr: mode, Riwayah selection, study mode, filters */}
            <div className={`rounded-lg border p-3 ${currentThemeTokens.drawerCardAltClass}`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className={`text-xs font-bold ${currentThemeTokens.drawerHeaderSubClass}`}>القراءات</p>
                {qiraatSelection ? (
                  <button
                    type="button"
                    onClick={() => setQiraatSelection(null)}
                    className={`rounded border px-2 py-0.5 text-[11px] font-bold ${currentThemeTokens.headerBtnClass}`}
                  >
                    مسح التحديد
                  </button>
                ) : null}
              </div>
              {qiraatSelection ? (
                <div className={`mb-3 rounded-lg border p-2.5 ${currentThemeTokens.drawerCardClass}`}>
                  {renderQiraatSelection()}
                </div>
              ) : null}
              <QiraatToolbar
                mode={qiraatMode}
                onModeChange={applyQiraatMode}
                selectedReadingId={qiraatSelectedReadingId}
                onReadingChange={setQiraatSelectedReadingId}
                studyMode={qiraatStudyMode}
                onStudyModeChange={setQiraatStudyMode}
                showDifferenceFromHafs={qiraatShowDiffFromHafs}
                onShowDifferenceFromHafsChange={setQiraatShowDiffFromHafs}
                filter={qiraatFilter}
                onFilterChange={setQiraatFilter}
                includeReviewed={qiraatIncludeReviewed}
                onIncludeReviewedChange={setQiraatIncludeReviewed}
                onOpenLegend={() => setQiraatLegendOpen(true)}
              />
              {readerLayer === 'qiraat' ? (
                <button
                  type="button"
                  aria-label={qiraatEditMode ? 'إيقاف وضع تعديل القراءات' : 'تفعيل وضع تعديل القراءات'}
                  aria-pressed={qiraatEditMode}
                  onClick={toggleQiraatEditMode}
                  className={`mt-2 min-h-10 w-full rounded border px-3 text-xs font-bold ${qiraatEditMode ? 'border-[#8c5f0a] bg-[#8c5f0a] text-white' : currentThemeTokens.headerBtnClass}`}
                >
                  {qiraatEditMode ? 'وضع التعديل مفعّل — اضغط كلمة للتحرير' : 'تفعيل وضع تعديل القراءات'}
                </button>
              ) : null}
              {renderQiraatUsulPanel()}
              {renderQiraatRules()}
            </div>

            {/* Info / reference */}
            <div className={`rounded-lg border p-3 ${currentThemeTokens.drawerCardAltClass}`}>
              <p className={`mb-2 text-xs font-bold ${currentThemeTokens.drawerHeaderSubClass}`}>معلومات ومراجع</p>
              <button
                type="button"
                onClick={() => { setQiraatReferenceOpen(true); setIsMenuOpen(false) }}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-right transition-colors ${currentThemeTokens.drawerCardClass} hover:brightness-95`}
              >
                <span>
                  <span className={`block text-sm font-black ${currentThemeTokens.drawerTitleClass}`}>القرّاء العشرة ورموز الشاطبية والدرة</span>
                  <span className={`block text-[11px] leading-5 ${currentThemeTokens.drawerSubtextClass}`}>
                    ٢٠ رواية، والرموز الكلمية والحرفية ومدلولاتها، وفروق الدرة عن الشاطبية
                  </span>
                </span>
                <span aria-hidden className={`text-lg font-bold ${currentThemeTokens.drawerHeaderSubClass}`}>‹</span>
              </button>
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

      {qiraatLegendOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="إغلاق مفتاح القراءات"
            onClick={() => setQiraatLegendOpen(false)}
            className="absolute inset-0 bg-black/35"
          />
          <section
            className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-2xl border-t border-[#d7c7a7] bg-[#fffdf8] p-4 shadow-[0_-18px_70px_rgba(23,23,23,0.22)] lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[380px] lg:max-h-none lg:rounded-none lg:border-l lg:border-t-0"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">مفتاح القراءات</h2>
              <button
                type="button"
                onClick={() => setQiraatLegendOpen(false)}
                className="min-h-11 rounded-md border border-[#d7c7a7] px-3 text-xs font-bold text-[#59461d] transition-colors hover:bg-[#fff7df]"
              >
                إغلاق
              </button>
            </div>
            <QiraatLegend />
          </section>
        </div>
      ) : null}

      {qiraatReferenceOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="إغلاق المرجع"
            onClick={() => setQiraatReferenceOpen(false)}
            className="absolute inset-0 bg-black/35"
          />
          <section
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qiraat-reference-title"
            className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl border-t border-[#d7c7a7] bg-[#fffdf8] p-4 shadow-[0_-18px_70px_rgba(23,23,23,0.22)] lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[440px] lg:max-h-none lg:rounded-none lg:border-l lg:border-t-0"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#80662c]">مرجع</p>
                <h2 id="qiraat-reference-title" className="text-lg font-black leading-snug">
                  القرّاء العشرة ورموز الشاطبية والدرة
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setQiraatReferenceOpen(false)}
                className="min-h-11 shrink-0 rounded-md border border-[#d7c7a7] px-3 text-xs font-bold text-[#59461d] transition-colors hover:bg-[#fff7df]"
              >
                إغلاق
              </button>
            </div>
            <QiraatReferenceSheet />
          </section>
        </div>
      ) : null}

      {/* Dedicated Qiraat bottom card on mobile & portrait screens */}
      {!isSpread && qiraatSelection && qiraatMode !== 'normal' ? (
        <div className="fixed inset-0 z-40 flex flex-col justify-end p-2 sm:p-4" dir="rtl">
          <button
            type="button"
            aria-label="إغلاق بطاقة القراءات"
            onClick={() => {
              setQiraatSelection(null)
              updateHoveredQiraatWord(null)
            }}
            className="fixed inset-0 bg-black/25 backdrop-blur-[1px] transition-opacity"
          />
          <div
            className="relative z-10 mx-auto w-full max-w-lg cursor-pointer rounded-2xl border border-[#d7c7a7] bg-[#fffdf8]/98 p-3.5 shadow-[0_-12px_45px_rgba(23,23,23,0.22)] backdrop-blur-md"
            style={{ paddingBottom: 'calc(0.875rem + env(safe-area-inset-bottom))' }}
            onClick={() => {
              setQiraatSelection(null)
              updateHoveredQiraatWord(null)
            }}
          >
            <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-[#eadfc9] pb-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#171717] px-2.5 py-0.5 text-[11px] font-black text-white">القراءات العشر</span>
                <span className="text-xs font-bold text-[#80662c]">
                  {surahNameByNumber.get(qiraatSelection.word.surahNumber) ?? ''} — آية {qiraatSelection.word.ayahNumber}
                </span>
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={(e) => {
                  e.stopPropagation()
                  setQiraatSelection(null)
                  updateHoveredQiraatWord(null)
                }}
                className="rounded-md border border-[#d7c7a7] bg-white px-2.5 py-1 text-xs font-bold text-[#80662c] shadow-sm transition-colors hover:bg-[#fff7df]"
              >
                مسح التحديد ✕
              </button>
            </div>
            <div className="max-h-[48vh] overflow-y-auto pr-0.5">
              {renderQiraatSelection()}
            </div>
            <p className="mt-2 text-center text-[10px] text-[#a8987a]">اضغط في أي مكان داخل البطاقة أو خارجها للإغلاق</p>
          </div>
        </div>
      ) : null}

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

      {renderSettingsModal()}
    </div>
  )
}
