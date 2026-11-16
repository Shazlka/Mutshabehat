import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fnv1a64,
  getMagazineColor,
  buildMagazineBlocks,
  getCardSize,
  getCardSizeFromHash,
  MAGAZINE_PALETTE,
  type MagazineBlock,
} from '../../src/lib/magazine-layout'

test('fnv1a64 produces stable, deterministic 64-bit unsigned integer hashes', () => {
  // Empty string returns FNV-1a offset basis BigInt('14695981039346656037')
  assert.equal(fnv1a64(''), BigInt('14695981039346656037'))

  // Repeated calls with same input produce identical hashes
  const hash1 = fnv1a64('group-uuid-1234')
  const hash2 = fnv1a64('group-uuid-1234')
  assert.equal(hash1, hash2)

  // Different inputs produce distinct hashes
  const hashA = fnv1a64('group-A')
  const hashB = fnv1a64('group-B')
  assert.notEqual(hashA, hashB)

  // Works with Arabic text
  const hashArabic = fnv1a64('متشابهات البقرة وآل عمران')
  assert.equal(typeof hashArabic, 'bigint')
  assert.ok(hashArabic >= BigInt(0))
  assert.ok(hashArabic <= BigInt('0xffffffffffffffff'))
})

test('getMagazineColor deterministically maps group id to jewel-tone palette', () => {
  assert.equal(MAGAZINE_PALETTE.length, 12)

  // Default web swatch #55b94f triggers jewel tone palette selection
  const colorDefault1 = getMagazineColor('grp-1', '#55b94f')
  const colorDefault2 = getMagazineColor('grp-1', '55b94f')
  const colorNone = getMagazineColor('grp-1', null)
  assert.equal(colorDefault1, colorDefault2)
  assert.equal(colorDefault1, colorNone)
  assert.ok(MAGAZINE_PALETTE.includes(colorDefault1 as typeof MAGAZINE_PALETTE[number]))

  // Custom colors other than #55b94f are preserved
  assert.equal(getMagazineColor('grp-1', '#1A4A6E'), '#1A4A6E')
  assert.equal(getMagazineColor('grp-1', '2563eb'), '#2563eb')
  assert.equal(getMagazineColor('grp-1', '#c9a84c'), '#c9a84c')
})

test('buildMagazineBlocks exactly matches Swift buildMagazineBlocks partition', () => {
  // 0 items -> empty blocks
  assert.deepEqual(buildMagazineBlocks([]), [])

  // 1 item -> [ hero(0) ]
  const one = [{ id: '1' }]
  const blocks1 = buildMagazineBlocks(one)
  assert.equal(blocks1.length, 1)
  assert.equal(blocks1[0].type, 'hero')
  assert.equal((blocks1[0] as { type: 'hero'; item: { id: string } }).item.id, '1')

  // 2 items -> [ hero(0), hero(1) ] (since i=1 is items.count - 1)
  const two = [{ id: '1' }, { id: '2' }]
  const blocks2 = buildMagazineBlocks(two)
  assert.equal(blocks2.length, 2)
  assert.equal(blocks2[0].type, 'hero')
  assert.equal(blocks2[1].type, 'hero')

  // 3 items -> [ hero(0), pair(1, 2) ]
  const three = [{ id: '1' }, { id: '2' }, { id: '3' }]
  const blocks3 = buildMagazineBlocks(three)
  assert.equal(blocks3.length, 2)
  assert.equal(blocks3[0].type, 'hero')
  assert.equal(blocks3[1].type, 'pair')
  if (blocks3[1].type === 'pair') {
    assert.equal(blocks3[1].first.id, '2')
    assert.equal(blocks3[1].second.id, '3')
    assert.equal(blocks3[1].firstSize, 'tall')
    assert.equal(blocks3[1].secondSize, 'tall')
  }

  // 4 items -> [ hero(0), pair(1, 2), hero(3) ]
  const four = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
  const blocks4 = buildMagazineBlocks(four)
  assert.equal(blocks4.length, 3)
  assert.equal(blocks4[0].type, 'hero')
  assert.equal(blocks4[1].type, 'pair')
  assert.equal(blocks4[2].type, 'hero')

  // 5 items -> [ hero(0), pair(1, 2), pair(3, 4) ]
  const five = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }]
  const blocks5 = buildMagazineBlocks(five)
  assert.equal(blocks5.length, 3)
  assert.equal(blocks5[0].type, 'hero')
  assert.equal(blocks5[1].type, 'pair')
  assert.equal(blocks5[2].type, 'pair')

  // 6 items -> [ hero(0), pair(1, 2), pair(3, 4), hero(5) ]
  const six = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }]
  const blocks6 = buildMagazineBlocks(six)
  assert.equal(blocks6.length, 4)
  assert.equal(blocks6[0].type, 'hero')
  assert.equal(blocks6[1].type, 'pair')
  assert.equal(blocks6[2].type, 'pair')
  assert.equal(blocks6[3].type, 'hero')

  // 7 items -> [ hero(0), pair(1, 2), pair(3, 4), hero(5), hero(6) ]
  const seven = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }, { id: '7' }]
  const blocks7 = buildMagazineBlocks(seven)
  assert.equal(blocks7.length, 5)
  assert.equal(blocks7[0].type, 'hero')
  assert.equal(blocks7[1].type, 'pair')
  assert.equal(blocks7[2].type, 'pair')
  assert.equal(blocks7[3].type, 'hero')
  assert.equal(blocks7[4].type, 'hero')
})

test('buildMagazineBlocks preserves item order and all elements without dropping any', () => {
  const items = Array.from({ length: 24 }, (_, i) => ({ id: `group-${i + 1}` }))
  const blocks: MagazineBlock<{ id: string }>[] = buildMagazineBlocks(items)

  const extractedIds: string[] = []
  for (const block of blocks) {
    if (block.type === 'hero' || block.type === 'single') {
      extractedIds.push(block.item.id)
    } else if (block.type === 'pair') {
      extractedIds.push(block.first.id)
      extractedIds.push(block.second.id)
    }
  }

  assert.equal(extractedIds.length, items.length)
  assert.deepEqual(extractedIds, items.map((it) => it.id))
})

test('getCardSize and getCardSizeFromHash return valid MagazineCardSize', () => {
  assert.equal(getCardSize('hero'), 'hero')
  assert.equal(getCardSize('single'), 'hero')
  assert.equal(getCardSize('pair'), 'tall')
  assert.equal(getCardSize('pair', { compactIfSingleVerse: true, verseCount: 1 }), 'compact')
  assert.equal(getCardSize('pair', { compactIfSingleVerse: true, verseCount: 3 }), 'tall')

  const validSizes = new Set(['hero', 'tall', 'compact'])
  for (let i = 0; i < 20; i++) {
    const size = getCardSizeFromHash(`test-id-${i}`)
    assert.ok(validSizes.has(size))
  }
})
