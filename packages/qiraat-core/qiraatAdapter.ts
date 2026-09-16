// Thin query helpers over an already-loaded variant list (from `repository.ts`). Kept as a
// separate module — as in the original scaffold — so the viewer never depends on Mushaf word
// text or on the Mutshabehat package (checked by scripts/validate-mushaf1441-phase5.mjs).
import type { QiraatVariant } from './types'

export function normalizeAyahKey(ayahKey: string): string | null {
  const trimmed = ayahKey.trim()
  return /^\d+:\d+$/.test(trimmed) ? trimmed : null
}

function ayahKeyOfVariant(variant: QiraatVariant): string {
  return `${variant.surah}:${variant.ayah}`
}

export function getQiraatVariantsByAyahKey(
  ayahKey: string,
  variants: readonly QiraatVariant[],
): QiraatVariant[] {
  const normalized = normalizeAyahKey(ayahKey)
  if (!normalized) return []
  return variants.filter((variant) => ayahKeyOfVariant(variant) === normalized)
}
