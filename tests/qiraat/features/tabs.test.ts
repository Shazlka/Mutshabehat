import assert from 'node:assert/strict'
import test from 'node:test'
import { nextTabIndex } from '../../../packages/qiraat-core/features/tabs'

// Audit fix: tab widgets move with the arrow keys, following the visual direction in RTL.
test('in RTL the left arrow goes to the next tab and the right arrow to the previous one', () => {
  assert.equal(nextTabIndex(3, 0, 'ArrowLeft', true), 1)
  assert.equal(nextTabIndex(3, 1, 'ArrowRight', true), 0)
})

test('in LTR the arrows follow the reading order', () => {
  assert.equal(nextTabIndex(3, 0, 'ArrowRight', false), 1)
  assert.equal(nextTabIndex(3, 1, 'ArrowLeft', false), 0)
})

test('the arrows wrap around, Home and End jump, other keys do nothing', () => {
  assert.equal(nextTabIndex(3, 2, 'ArrowLeft', true), 0)
  assert.equal(nextTabIndex(3, 0, 'ArrowRight', true), 2)
  assert.equal(nextTabIndex(3, 1, 'Home', true), 0)
  assert.equal(nextTabIndex(3, 1, 'End', true), 2)
  assert.equal(nextTabIndex(3, 1, 'a', true), null)
  assert.equal(nextTabIndex(0, 0, 'ArrowLeft', true), null)
})

import { nextLimit, INITIAL_LIMIT } from '../../../packages/qiraat-core/features/progressive'

// Audit fix: long result lists render in chunks instead of thousands of buttons at once.
test('a long list starts with a chunk and grows by a chunk up to its length', () => {
  assert.equal(INITIAL_LIMIT, 100)
  assert.equal(nextLimit(100, 250), 200)
  assert.equal(nextLimit(200, 250), 250)
  assert.equal(nextLimit(250, 250), 250)
  assert.equal(nextLimit(100, 40), 40)
  assert.equal(nextLimit(100, 0), 0)
})
