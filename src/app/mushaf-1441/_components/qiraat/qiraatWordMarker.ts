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

/**
 * Inline paint for a comparison marker.
 *
 * A multi-reader attribution is a CSS gradient, which cannot be assigned to
 * `color`.  Rendering it as clipped text preserves the reader segments in the
 * Mushaf instead of silently falling back to the normal ink colour.
 */
export function markerPaintForWord(marker: Pick<WordMarker, 'color' | 'isGradient'>) {
  return marker.isGradient
    ? {
        backgroundImage: marker.color,
        WebkitBackgroundClip: 'text' as const,
        WebkitTextFillColor: 'transparent' as const,
      }
    : { color: marker.color }
}

const UNRESOLVED_MARKER_COLOR = '#8a8a8a'
export const PERFORMANCE_MARKER_COLOR = '#4F46E5'

function isPerformanceOnlyVariant(variant: QiraatVariant): boolean {
  return variant.variantText === variant.hafsText
}

export function matchesFilter(variant: QiraatVariant, filter: QiraatComparisonFilter): boolean {
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

  const allReadingIds = Array.from(new Set(filtered.flatMap((variant) => variant.readingIds)))
  if (allReadingIds.length === 0) {
    // needs_manual_review placeholder(s) with no confident attribution yet (Part 29) — never guess
    // a reader/narrator color for this; computeAttribution requires at least one reading id.
    return { color: UNRESOLVED_MARKER_COLOR, isGradient: false, variants: filtered, unresolved: true }
  }
  if (filtered.every(isPerformanceOnlyVariant)) {
    return { color: PERFORMANCE_MARKER_COLOR, isGradient: false, variants: filtered, isPerformanceOnly: true }
  }

  // When filtered by a specific reader or narrator, scope attribution exclusively to that authority.
  // This ensures selecting a reader (e.g. Nafi) or narrator (e.g. Warsh) never draws other readers'
  // colors or a multi-reader gradient.
  const readingIds = filter.kind === 'reader'
    ? allReadingIds.filter((id) => getReading(id).readerId === filter.readerId)
    : filter.kind === 'reading'
      ? allReadingIds.filter((id) => id === filter.readingId)
      : allReadingIds

  if (readingIds.length === 0) return null

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

// ── أصول (usul) rulings ──────────────────────────────────────────────────────
import type { QiraatRuling } from '../../../../../packages/qiraat-core/types'

export interface RulingMarker {
  /** The usul family colour — one colour per family (إمالة+تقليل share one, both إدغام kinds
   * share one, ترقيق+تغليظ share one, and so on), so the KIND of ruling is readable at a glance. */
  color: string
  rulings: QiraatRuling[]
  /** True when more than one usul family applies to this same word; the word takes the first
   * family's colour and the rest are listed on tap. */
  multiple: boolean
  /** True when some Riwayah has two valid وجهان here («بخلف عنه») — the word is marked ذو وجهين. */
  hasAlternate: boolean
}

/**
 * All أصول rulings that touch one token, or null when none do.
 *
 * `filter` narrows to a reader/narrator exactly like the variant marker does, so selecting ورش
 * shows only ورش's ترقيق/تغليظ/مد البدل and nothing else.
 */
export function rulingMarkerForWord(
  rulings: readonly QiraatRuling[],
  surah: number,
  ayah: number,
  token: number,
  filter: QiraatComparisonFilter,
  enabledCategories?: ReadonlySet<string>,
): RulingMarker | null {
  const matches = rulings.filter((ruling) => (
    ruling.wordAnchored
    && rulingTouchesToken(ruling, surah, ayah, token)
    && (!enabledCategories || enabledCategories.has(ruling.category))
    && matchesRulingFilter(ruling, filter)
  ))
  if (matches.length === 0) return null
  const families = new Set(matches.map((ruling) => ruling.color))
  return {
    color: matches[0].color,
    rulings: matches,
    multiple: families.size > 1,
    hasAlternate: matches.some((ruling) => {
      if (!ruling.hasAlternate) return false
      if (filter.kind === 'all') return true
      if (filter.kind === 'reader') {
        return ruling.readings.some((r) => getReading(r.readingId).readerId === filter.readerId && !r.isDefault)
          || ruling.attribution.some((a) => a.authorityId === filter.readerId && a.condition?.includes('بخلف'))
      }
      return ruling.readings.some((r) => r.readingId === filter.readingId && !r.isDefault)
    }),
  }
}

/**
 * A ruling may span the ayah boundary (for example, page 1's
 * ﴿ٱلرَّحِيمِ مَـٰلِكِ﴾ إدغام كبير).  The historical matcher compared only
 * `ruling.ayah`, which made the second anchored word silently disappear.
 *
 * Tokens remain single-word addresses; this predicate simply includes every
 * endpoint-aware token in the declared span. Multi-ayah spans are deliberately
 * not guessed: a record with an invalid reversed span is not rendered and is
 * reported by the deterministic audit.
 */
export function rulingTouchesToken(
  ruling: Pick<QiraatRuling, 'surah' | 'ayah' | 'startToken' | 'endAyah' | 'endToken'>,
  surah: number,
  ayah: number,
  token: number,
): boolean {
  if (ruling.surah !== surah) return false
  const endAyah = ruling.endAyah ?? ruling.ayah
  if (endAyah < ruling.ayah) return false
  if (ayah < ruling.ayah || ayah > endAyah) return false
  if (ruling.ayah === endAyah) {
    return ayah === ruling.ayah && token >= ruling.startToken && token <= ruling.endToken
  }
  if (ayah === ruling.ayah) return token >= ruling.startToken
  if (ayah === endAyah) return token <= ruling.endToken
  return true
}

export function matchesRulingFilter(ruling: QiraatRuling, filter: QiraatComparisonFilter): boolean {
  if (filter.kind === 'all') return true
  if (filter.kind === 'reader') {
    return ruling.readings.some((r) => getReading(r.readingId).readerId === filter.readerId)
  }
  return ruling.readings.some((r) => r.readingId === filter.readingId)
}

/** Distinct usul families present on a page, for the legend/panel. */
export function rulingCategoriesOnPage(rulings: readonly QiraatRuling[]) {
  const seen = new Map<string, { category: string; categoryAr: string; color: string; count: number }>()
  for (const ruling of rulings) {
    if (!ruling.wordAnchored) continue
    const entry = seen.get(ruling.category)
    if (entry) entry.count += 1
    else seen.set(ruling.category, { category: ruling.category, categoryAr: ruling.categoryAr, color: ruling.color, count: 1 })
  }
  return Array.from(seen.values())
}
