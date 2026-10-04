import type { ReviewRow } from '../../../src/app/mushaf-1441/review/_lib/types'

// Minimal ReviewRow factory shared by the reference-source tests.
export function row(overrides: Partial<Omit<ReviewRow, 'narrators'>> & { narrators: { id: string }[] }): ReviewRow {
  const { narrators: narratorIds, ...rest } = overrides
  return {
    entryId: 'e1',
    locationId: 'l1',
    version: '1',
    kind: 'farsh',
    categoryCode: null,
    categoryNameAr: null,
    surah: 2,
    ayah: 2,
    startWord: 1,
    endAyah: 2,
    endWord: 1,
    startKey: '002:002:001',
    endKey: '002:002:001',
    page: 1,
    hafsText: 'هدى',
    readingText: null,
    uthmaniText: null,
    description: null,
    performanceNote: null,
    variantType: null,
    rulingText: null,
    options: null,
    notes: null,
    reviewStatus: 'unreviewed',
    locationReviewStatus: 'unreviewed',
    verificationStatus: 'unverified',
    legacyRef: null,
    entryOrder: 1,
    deleted: false,
    appliesWasl: true,
    appliesWaqf: true,
    hamzahDetail: null,
    flags: [],
    narrators: narratorIds.map((n) => ({ id: n.id, code: null, nameAr: n.id, action: null, wajhOrder: 1, wajhNote: null })),
    ...rest,
  }
}
