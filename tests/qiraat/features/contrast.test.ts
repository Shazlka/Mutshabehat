import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { contrastRatio, readableInkOn, readableTextOn } from '../../../packages/qiraat-core/features/contrast'
import { NARRATOR_COLOR, READER_COLOR } from '../../../packages/qiraat-core/colors'
import { USUL_COLORS } from '../../../packages/qiraat-core/features/contrast'

const CREAM = '#fffdf8'
const css = fs.readFileSync(new URL('../../../src/app/globals.css', import.meta.url), 'utf8')
const token = (name: string): string => {
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))
  assert.ok(m, `${name} is defined in globals.css`)
  return m![1]
}

test('contrastRatio matches the WCAG reference values', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff') * 10) / 10, 21)
  assert.equal(Math.round(contrastRatio('#777777', '#ffffff') * 100) / 100, 4.48)
})

test('white or near-black text on every reader and narrator colour reaches 4.5:1', () => {
  for (const [id, color] of [...Object.entries(READER_COLOR), ...Object.entries(NARRATOR_COLOR)]) {
    const text = readableTextOn(color)
    assert.ok(contrastRatio(text, color) >= 4.5, `${id} ${color} with ${text} is ${contrastRatio(text, color).toFixed(2)}`)
  }
})

test('readableInkOn darkens a colour only as far as needed and keeps an already readable one', () => {
  assert.equal(readableInkOn('#171717', CREAM), '#171717')
  const yellow = readableInkOn('#CA8A04', CREAM)
  assert.ok(contrastRatio(yellow, CREAM) >= 4.5)
  assert.notEqual(yellow.toLowerCase(), '#ca8a04')
})

test('every أصول family colour is readable as text on the cream page', () => {
  for (const color of USUL_COLORS) assert.ok(contrastRatio(readableInkOn(color, CREAM), CREAM) >= 4.5, color)
})

test('the Qiraat UX text tokens reach 4.5:1 on the surfaces they are used on', () => {
  const pairs: [string, string][] = [
    ['--qx-muted', '#ffffff'], ['--qx-muted', CREAM], ['--qx-err', '#ffffff'],
    ['--qx-ok-ink', token('--qx-ok-bg')], ['--qx-diff-ink', token('--qx-diff-bg')],
    ['--qx-info-ink', token('--qx-info-bg')], ['--qx-warn-ink', token('--qx-warn-bg')], ['--qx-face-ink', token('--qx-face-bg')],
  ].map(([fg, bg]) => [fg, bg])
  for (const [fg, bg] of pairs) {
    const ratio = contrastRatio(token(fg), bg)
    assert.ok(ratio >= 4.5, `${fg} on ${bg} is ${ratio.toFixed(2)}`)
  }
})
