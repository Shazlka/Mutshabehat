// WCAG contrast helpers for text drawn on identity and أصول colours. Pure.

/** The أصول family colours the data carries (one per family). */
export const USUL_COLORS = ['#0891B2', '#0D9488', '#15803D', '#2563EB', '#64748B', '#7C3AED', '#B45309', '#C026D3', '#CA8A04', '#DB2777', '#DC2626', '#EA580C'] as const

/** The cream surface of the reader's cards, the usual background of text drawn in a family colour. */
export const CREAM_SURFACE = '#fffdf8'

const channels = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const DARK = '#171717'
const LIGHT = '#ffffff'

/** White or near-black, whichever reads better on `background`. */
export function readableTextOn(background: string): string {
  return contrastRatio(LIGHT, background) >= contrastRatio(DARK, background) ? LIGHT : DARK
}

const toHex = (v: [number, number, number]) => `#${v.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`

/** `color` itself when it already reads on `background`, else the nearest darker shade that does (minimum 4.5:1). */
export function readableInkOn(color: string, background: string, minimum = 4.5): string {
  if (contrastRatio(color, background) >= minimum) return color
  const base = channels(color)
  for (let step = 1; step <= 20; step += 1) {
    const f = 1 - step * 0.05
    const shade = toHex([base[0] * f, base[1] * f, base[2] * f])
    if (contrastRatio(shade, background) >= minimum) return shade
  }
  return DARK
}
