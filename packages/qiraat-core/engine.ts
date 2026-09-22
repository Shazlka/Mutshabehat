// Part 5/6/7/37: the Qiraat Rendering Engine. Deterministic, token-anchored, never a text search.
import {
  BASE_READING,
  PUBLIC_VERIFICATION_STATUSES,
  type QiraatVariant,
  type ReadingId,
  type VariantOperation,
} from './types'

export function tokenKey(surah: number, ayah: number, token: number): string {
  return `${surah}:${ayah}:${token}`
}

export function ayahKeyOf(surah: number, ayah: number): string {
  return `${surah}:${ayah}`
}

export interface EngineOptions {
  /** Debug/admin only (Part 38) — surfaces REVIEWED/MAPPED/EXTRACTED records too. Never default-on. */
  includeUnpublished?: boolean
}

function isVisible(variant: QiraatVariant, options?: EngineOptions): boolean {
  if (options?.includeUnpublished) return true
  return PUBLIC_VERIFICATION_STATUSES.includes(variant.verificationStatus)
}

/** All variants (of allowed verification status) that touch a given token. */
export function variantsForToken(
  variants: readonly QiraatVariant[],
  surah: number,
  ayah: number,
  token: number,
  options?: EngineOptions,
): QiraatVariant[] {
  return variants.filter((variant) => (
    variant.surah === surah
    && variant.ayah === ayah
    && token >= variant.startToken
    && token <= variant.endToken
    && isVisible(variant, options)
  ))
}

export type TokenResolution =
  | { kind: 'base'; text: string }
  | { kind: 'variant'; text: string; variant: QiraatVariant }
  /** MERGE/SPLIT: this token's own display is folded into its span's start token — render nothing here. */
  | { kind: 'suppressed'; variant: QiraatVariant }

function applyOperation(operation: VariantOperation, hafsText: string, variantText: string): string {
  switch (operation) {
    case 'KEEP':
      return hafsText
    case 'REPLACE':
    case 'DIACRITIC_CHANGE':
    case 'ORTHOGRAPHIC_CHANGE':
    case 'MERGE':
    case 'SPLIT':
      return variantText
    case 'INSERT':
      // The variant text is additional wording anchored at this token (e.g. a Riwayah adds a
      // word Hafs does not have). Token-granular v1 renders it appended to the anchor token;
      // a future multi-DOM-node token model (09-full-rollout-plan.md) can give it its own slot.
      return variantText ? `${hafsText} ${variantText}`.trim() : hafsText
    case 'DELETE':
      // The word this Riwayah omits entirely.
      return ''
    default:
      return hafsText
  }
}

/**
 * Resolves what a single canonical token should display for one selected reading.
 * Query priority (Part 37): a PUBLISHED/VERIFIED variant for the EXACT reading, else the Hafs
 * baseline — never a best guess, never falling back from one narrator to their reader's sibling.
 */
export function resolveTokenForReading(
  variants: readonly QiraatVariant[],
  surah: number,
  ayah: number,
  token: number,
  hafsText: string,
  readingId: ReadingId,
  options?: EngineOptions,
): TokenResolution {
  if (readingId === BASE_READING) return { kind: 'base', text: hafsText }

  const candidates = variantsForToken(variants, surah, ayah, token, options)
    .filter((variant) => variant.readingIds.includes(readingId))

  if (candidates.length === 0) return { kind: 'base', text: hafsText }

  // Deterministic: prefer the most recently updated record if more than one somehow overlaps.
  const variant = [...candidates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]

  if (token !== variant.startToken && (variant.operation === 'MERGE' || variant.operation === 'SPLIT')) {
    return { kind: 'suppressed', variant }
  }

  // A multi-token REPLACE stores the alternate phrase once, but each Mushaf token still owns
  // its own DOM slot. Split a word-for-word phrase across that span so mobile and desktop never
  // duplicate the phrase into one slot or leave the neighbouring variant word blank.
  if (variant.operation === 'REPLACE' && variant.endToken > variant.startToken) {
    const parts = variant.variantText.trim().split(/\s+/).filter(Boolean)
    const spanLength = variant.endToken - variant.startToken + 1
    if (parts.length === spanLength) {
      return { kind: 'variant', text: parts[token - variant.startToken] ?? hafsText, variant }
    }
  }

  return { kind: 'variant', text: applyOperation(variant.operation, hafsText, variant.variantText), variant }
}

/**
 * renderToken(baseToken, selectedReading) from the spec (Part 5), token-object flavored.
 */
export function renderToken(
  baseToken: { surah: number; ayah: number; wordIndexInAyah: number; text: string },
  selectedReading: ReadingId,
  variants: readonly QiraatVariant[],
  options?: EngineOptions,
): TokenResolution {
  return resolveTokenForReading(
    variants,
    baseToken.surah,
    baseToken.ayah,
    baseToken.wordIndexInAyah,
    baseToken.text,
    selectedReading,
    options,
  )
}

/** Comparison-mode helper: does this Riwayah differ from Hafs at this token? (Part 18) */
export function differsFromHafs(resolution: TokenResolution, hafsText: string): boolean {
  if (resolution.kind === 'base') return false
  if (resolution.kind === 'suppressed') return true
  return resolution.text !== hafsText
}
