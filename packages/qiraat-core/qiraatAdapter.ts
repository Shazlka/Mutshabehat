import type { QiraatSource, QiraatVariant } from './types'

const EMPTY_QIRAAT_SOURCE: QiraatSource = {
  variants: [],
}

export function normalizeAyahKey(ayahKey: string) {
  const trimmed = ayahKey.trim()
  return /^\d+:\d+$/.test(trimmed) ? trimmed : null
}

export function getQiraatVariantsByAyahKey(
  ayahKey: string,
  source: QiraatSource = EMPTY_QIRAAT_SOURCE,
): QiraatVariant[] {
  const normalizedAyahKey = normalizeAyahKey(ayahKey)
  if (!normalizedAyahKey) return []
  return source.variants.filter((variant) => variant.ayahKey === normalizedAyahKey)
}
