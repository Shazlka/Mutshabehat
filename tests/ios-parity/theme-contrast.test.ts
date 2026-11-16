import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { MUSHAF_APPEARANCES, MUSHAF_APPEARANCE_STORAGE_KEY } from '../../src/app/mushaf-1441/_components/mushafTheme'

type RGB = readonly [number, number, number]

const hex = (value: string): RGB => {
  const raw = value.slice(1)
  return [0, 2, 4].map((start) => Number.parseInt(raw.slice(start, start + 2), 16) / 255) as unknown as RGB
}
const luminance = ([r, g, b]: RGB) => {
  const linear = (channel: number) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}
const contrast = (foreground: RGB, background: RGB) => {
  const [high, low] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (high + 0.05) / (low + 0.05)
}

const lightPaper: RGB = [1, 0.992, 0.965]
const darkPaper: RGB = [0.11, 0.105, 0.09]
const lightCard = hex('#FFFEFA')
const darkCard = hex('#27241E')

const modes = [
  {
    name: 'light', paper: lightPaper, card: lightCard, ink: [0.09, 0.09, 0.09] as RGB,
    semantic: ['#1A7340', '#A14D07', '#1B5FC1', '#6A3DB0', '#8F6A00', '#B4232A'],
    progressFill: '#1A7340', cautionFill: '#A14D07', variant: '#7A1F1A',
    badge: ['#6B4A00', '#F1E2B6'], review: ['#8A2F10', '#F7D2C4'],
  },
  {
    name: 'dark', paper: darkPaper, card: darkCard, ink: [0.92, 0.91, 0.86] as RGB,
    semantic: ['#5FD38D', '#F7A65E', '#80B4FF', '#C3A5F7', '#F2C94C', '#FF8A8A'],
    progressFill: '#23854D', cautionFill: '#A8530C', variant: '#F2A9A1',
    badge: ['#F0D58A', '#4A3A12'], review: ['#FFC1A8', '#5C2616'],
  },
] as const

test('iOS phone appearance text pairs meet WCAG AA in light and dark', () => {
  for (const mode of modes) {
    const pairs: Array<[string, RGB, RGB, number]> = [
      ['Mushaf ink on paper', mode.ink, mode.paper, 4.5],
      ['variant ink on card', hex(mode.variant), mode.card, 4.5],
      ['badge ink on badge fill', hex(mode.badge[0]), hex(mode.badge[1]), 4.5],
      ['review ink on review fill', hex(mode.review[0]), hex(mode.review[1]), 4.5],
      ['white on progress fill', hex('#FFFFFF'), hex(mode.progressFill), 4.5],
      ['white on caution fill', hex('#FFFFFF'), hex(mode.cautionFill), 4.5],
    ]
    mode.semantic.forEach((color, index) => pairs.push([`semantic ${index} on paper`, hex(color), mode.paper, 4.5]))
    for (const [label, foreground, background, minimum] of pairs) {
      const ratio = contrast(foreground, background)
      assert.ok(ratio >= minimum, `${mode.name} ${label}: ${ratio.toFixed(2)} is below ${minimum}:1`)
    }
  }
})

test('the phone layer keeps the exact iOS values and the five-percent wash', () => {
  const css = fs.readFileSync(new URL('../../src/app/globals.css', import.meta.url), 'utf8')
  for (const value of ['rgb(100% 99.2% 96.5%)', 'rgb(11% 10.5% 9%)', 'rgb(9% 9% 9%)', 'rgb(92% 91% 86%)', '--qiraat-page-wash: 5%']) {
    assert.ok(css.includes(value), `globals.css contains ${value}`)
  }
})

test('phone appearances use their own key and expose the five native choices', () => {
  assert.equal(MUSHAF_APPEARANCE_STORAGE_KEY, 'mushaf1441:appearance:v1')
  assert.deepEqual(MUSHAF_APPEARANCES.map(({ id, nameAr }) => [id, nameAr]), [
    ['system', 'تلقائي'],
    ['light', 'فاتح'],
    ['dark', 'داكن'],
    ['whitePage', 'صفحة بيضاء'],
    ['blackPage', 'صفحة سوداء'],
  ])
})
