import assert from 'node:assert/strict'
import test from 'node:test'
import { loadPagesResilient } from '../../../src/app/mushaf-1441/_features/host/allPagesData'

// Final review, Important 4: one failing page must not stall the 604-page loader for the whole visit.
test('every loaded page is reported once, and a page whose load throws is reported as failed, not lost', async () => {
  const seen: number[] = []
  const result = await loadPagesResilient({
    pages: [1, 2, 3, 4, 5],
    concurrency: 2,
    loadPage: async (page) => {
      if (page === 3) throw new Error('chunk failed')
      return { variants: [], rulings: [] }
    },
    onPage: (page) => { seen.push(page) },
  })
  assert.deepEqual(seen.sort(), [1, 2, 4, 5])
  assert.deepEqual(result.failed, [3])
})

test('with every page failing it still completes', async () => {
  const result = await loadPagesResilient({
    pages: [1, 2, 3], concurrency: 3,
    loadPage: async () => { throw new Error('offline') },
    onPage: () => undefined,
  })
  assert.deepEqual(result.failed.sort(), [1, 2, 3])
})

test('an empty page list completes at once', async () => {
  const result = await loadPagesResilient({ pages: [], concurrency: 4, loadPage: async () => ({ variants: [], rulings: [] }), onPage: () => undefined })
  assert.deepEqual(result.failed, [])
})
