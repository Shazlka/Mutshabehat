// Pure view-layer glue between the qiraat-core engine and one Mushaf word. No React here so it
// stays trivially unit-testable independent of the (huge) viewer component.
import {
  variantsForToken,
  resolveTokenForReading,
  type EngineOptions,
} from '../../../../../packages/qiraat-core/engine'
import { computeAttribution, gradientCss } from '../../../../../packages/qiraat-core/attribution'
import { narratorColor } from '../../../../../packages/qiraat-core/colors'
import { getReading } from '../../../../../packages/qiraat-core/readings'
import type { QiraatVariant, ReadingId } from '../../../../../packages/qiraat-core/types'
import type { QiraatComparisonFilter } from './types'

export interface WordMarker {
  /** Solid hex, or a `linear-gradient(...)` CSS string when `isGradient`. */
  color: string
  isGradient: boolean
  variants: QiraatVariant[]
  /**
   * True when none of the matched variants carry any `readingIds` yet — a `NEEDS_MANUAL_REVIEW`
   * placeholder (Part 29's flagged loci) surfaced only via the debug "include reviewed" toggle.
   * Never color-coded to a reader/narrator (that would be a guess); shown as a neutral marker.
   */
  unresolved?: boolean
  /**
   * True when every matched variant is a phonetic/performance-only ruling (إمالة، تقليل، إدغام،
   * سكت، إشمام، اختلاس...) — `variantText === hafsText`, no spelling changes. These get one fixed
   * "this word has a recitation ruling" color instead of the usual reader/narrator identity color,
   * so a performance ruling is recognizable across the page at a glance; the word's own text color
   * is set to this too (not just the underline) — the full attribution is still one tap away.
   */
  isPerformanceOnly?: boolean
}

const UNRESOLVED_MARKER_COLOR = '#8a8a8a'
export const PERFORMANCE_MARKER_COLOR = '#4F46E5'

function isPerformanceOnlyVariant(variant: QiraatVariant): boolean {
  return variant.variantText === variant.hafsText
}

function matchesFilter(variant: QiraatVariant, filter: QiraatComparisonFilter): boolean {
  if (filter.kind === 'all') return true
  if (filter.kind === 'reader') return variant.readingIds.some((id) => getReading(id).readerId === filter.readerId)
  return variant.readingIds.includes(filter.readingId)
}

/** Part 10/11: the comparison-mode marker for one token, or null if nothing applies (no noise). */
export function comparisonMarkerForWord(
  variants: readonly QiraatVariant[],
  surah: number,
  ayah: number,
  token: number,
  filter: QiraatComparisonFilter,
  options?: EngineOptions,
): WordMarker | null {
  const matches = variantsForToken(variants, surah, ayah, token, options)
  const filtered = matches.filter((variant) => matchesFilter(variant, filter))
  if (filtered.length === 0) return null

  const readingIds = Array.from(new Set(filtered.flatMap((variant) => variant.readingIds)))
  if (readingIds.length === 0) {
    // needs_manual_review placeholder(s) with no confident attribution yet (Part 29) — never guess
    // a reader/narrator color for this; computeAttribution requires at least one reading id.
    return { color: UNRESOLVED_MARKER_COLOR, isGradient: false, variants: filtered, unresolved: true }
  }
  if (filtered.every(isPerformanceOnlyVariant)) {
    return { color: PERFORMANCE_MARKER_COLOR, isGradient: false, variants: filtered, isPerformanceOnly: true }
  }
  const attribution = computeAttribution(readingIds)
  return {
    color: attribution.kind === 'multi-reader' ? gradientCss(attribution.segments) : attribution.color,
    isGradient: attribution.kind === 'multi-reader',
    variants: filtered,
  }
}

export interface RiwayahResolution {
  /** What this word should display for the selected Riwayah. */
  text: string
  /** Token is part of a MERGE/SPLIT span and already shown at its span's start token. */
  suppressed: boolean
  /** Set when this token's text actually differs from the Hafs baseline (drives Part 18 marker). */
  marker: WordMarker | null
}

/** Part 17/18/37: resolve+render one token for the selected Riwayah, with the optional Hafs-diff marker. */
export function riwayahResolutionForWord(
  variants: readonly QiraatVariant[],
  surah: number,
  ayah: number,
  token: number,
  hafsText: string,
  selectedReadingId: ReadingId,
  showDifferenceFromHafs: boolean,
  options?: EngineOptions,
): RiwayahResolution {
  const resolution = resolveTokenForReading(variants, surah, ayah, token, hafsText, selectedReadingId, options)

  if (resolution.kind === 'suppressed') {
    return { text: '', suppressed: true, marker: null }
  }

  // A matched non-baseline variant IS a difference from Hafs even when it's performance-only
  // and its display text is identical to hafsText (Part 23) — never gate this on text equality.
  const marker = showDifferenceFromHafs && resolution.kind === 'variant'
    ? { color: narratorColor(selectedReadingId), isGradient: false, variants: [resolution.variant] }
    : null

  return { text: resolution.text, suppressed: false, marker }
}
