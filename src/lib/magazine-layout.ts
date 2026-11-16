/**
 * magazine-layout.ts
 *
 * Pure layout and partition engine for Mutshabehat Magazine feed.
 * Ported directly from native iOS reference:
 *   /Users/amrelshazly/Projects/qiraat-ios/apps/ios/Sources/Mutshabehat/MutshabehatMagazine.swift
 *
 * References:
 * - MutshabehatMagazineTheme jewel tones: MutshabehatMagazine.swift:13-39
 * - FNV-1a 64-bit hash over UTF-8 bytes: MutshabehatMagazine.swift:36
 * - buildMagazineBlocks partition (hero / pair / single): MutshabehatMagazine.swift:55-75
 * - MagazineCardSize (hero / tall / compact): MutshabehatMagazine.swift:7-11, 87-106
 */

export type MagazineCardSize = 'hero' | 'tall' | 'compact'

/**
 * 12 canonical jewel-tone palette colors from MutshabehatMagazineTheme.palette
 * (MutshabehatMagazine.swift:14-27)
 */
export const MAGAZINE_PALETTE = [
  '#0F5132', // Emerald green
  '#1D4ED8', // Royal blue
  '#6D28D9', // Deep purple / amethyst
  '#C2410C', // Desert terracotta
  '#BE123C', // Imperial ruby
  '#B45309', // Warm amber / ochre
  '#0F766E', // Byzantine teal
  '#4D7C0F', // Olive bronze
  '#3730A3', // Persian indigo
  '#831843', // Antique rosewood
  '#78350F', // Walnut brown
  '#0284C7', // Mediterranean azure
] as const

const FNV_OFFSET_BASIS = BigInt('14695981039346656037')
const FNV_PRIME = BigInt('1099511628211')
const MASK64 = BigInt('0xffffffffffffffff')

/**
 * 64-bit FNV-1a hash over UTF-8 bytes, exactly matching Swift:
 * id.utf8.reduce(UInt64(14_695_981_039_346_656_037)) { ($0 ^ UInt64($1)) &* 1_099_511_628_211 }
 * (MutshabehatMagazine.swift:36)
 */
export function fnv1a64(str: string): bigint {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(str)
  let hash = FNV_OFFSET_BASIS
  for (let i = 0; i < bytes.length; i++) {
    hash = ((hash ^ BigInt(bytes[i])) * FNV_PRIME) & MASK64
  }
  return hash
}

/**
 * Deterministically computes the jewel-tone theme color for a group.
 * Matches MutshabehatMagazineTheme.color(for:customColor:):
 * If customColor is provided and not default #55b94f (web default green swatch), uses customColor.
 * Otherwise, maps the group ID's FNV-1a 64-bit hash modulo 12 to the jewel-tone palette.
 * (MutshabehatMagazine.swift:29-38)
 */
export function getMagazineColor(id: string, customColor?: string | null): string {
  const raw = (customColor ?? '').trim()
  const lower = raw.toLowerCase()
  if (lower && lower !== '#55b94f' && lower !== '55b94f') {
    return raw.startsWith('#') ? raw : `#${raw}`
  }
  const hash = fnv1a64(id)
  const index = Number(hash % BigInt(MAGAZINE_PALETTE.length))
  return MAGAZINE_PALETTE[index]
}

export type MagazineBlock<T> =
  | { type: 'hero'; item: T; size: MagazineCardSize }
  | { type: 'pair'; first: T; second: T; firstSize: MagazineCardSize; secondSize: MagazineCardSize }
  | { type: 'single'; item: T; size: MagazineCardSize }

/**
 * Builds magazine layout blocks from items.
 * Matches buildMagazineBlocks<T>(from:) in Swift:
 *
 * while i < items.count {
 *   if step % 3 == 0 || i == items.count - 1 {
 *     blocks.append(.hero(items[i]))
 *     i += 1
 *   } else {
 *     if i + 1 < items.count {
 *       blocks.append(.pair(items[i], items[i + 1]))
 *       i += 2
 *     } else {
 *       blocks.append(.single(items[i]))
 *       i += 1
 *     }
 *   }
 *   step += 1
 * }
 * (MutshabehatMagazine.swift:55-75)
 */
export function buildMagazineBlocks<T extends { id: string }>(items: T[]): MagazineBlock<T>[] {
  const blocks: MagazineBlock<T>[] = []
  let i = 0
  let step = 0
  while (i < items.length) {
    if (step % 3 === 0 || i === items.length - 1) {
      blocks.push({
        type: 'hero',
        item: items[i],
        size: 'hero',
      })
      i += 1
    } else {
      if (i + 1 < items.length) {
        blocks.push({
          type: 'pair',
          first: items[i],
          second: items[i + 1],
          firstSize: 'tall',
          secondSize: 'tall',
        })
        i += 2
      } else {
        blocks.push({
          type: 'single',
          item: items[i],
          size: 'hero',
        })
        i += 1
      }
    }
    step += 1
  }
  return blocks
}

/**
 * Resolves the card size for a block type.
 * Hero and single blocks receive 'hero' (MutshabehatMagazine.swift:95-96).
 * Pair blocks receive 'tall' (MutshabehatMagazine.swift:98-101), or 'compact' if opted.
 */
export function getCardSize(
  blockType: 'hero' | 'pair' | 'single',
  opts?: { compactIfSingleVerse?: boolean; verseCount?: number }
): MagazineCardSize {
  if (blockType === 'hero' || blockType === 'single') {
    return 'hero'
  }
  if (opts?.compactIfSingleVerse && opts.verseCount === 1) {
    return 'compact'
  }
  return 'tall'
}

/**
 * Pure hash-based card size selector partition.
 */
export function getCardSizeFromHash(id: string): MagazineCardSize {
  const hash = fnv1a64(id)
  const mod = Number(hash % BigInt(3))
  if (mod === 0) return 'hero'
  if (mod === 1) return 'tall'
  return 'compact'
}
