export type MergeAction =
  | 'CORROBORATE'       // Both exist and agree: add source citation
  | 'GAP_FILL'          // Only new source has it: insert additively
  | 'CONFLICT'          // Differing content at same natural key: insert with is_conflict=true
  | 'RE_EXTRACTION_DIFF'// Same source id changed: flag for review
  | 'EXISTING_KEPT'     // In DB only: preserve untouched

export interface NaturalKey {
  surah: number
  ayah: number
  startWord: number
  endWord: number
  narratorId: string
  kind: 'variant' | 'ruling'
  categoryCode?: string
}

export function computeNaturalKey(key: NaturalKey): string {
  const cat = key.categoryCode ?? 'DEFAULT'
  return `${key.surah}:${key.ayah}:${key.startWord}-${key.endWord}:${key.narratorId}:${key.kind}:${cat}`
}

export interface ExistingDbRecord {
  entryId: string
  locusId: string
  surah: number
  ayah: number
  startWord: number
  endWord: number
  narratorId: string
  kind: 'variant' | 'ruling'
  categoryCode?: string
  readingText?: string
  actionAr?: string
}

export interface IngestItem {
  sourceId: string
  surah: number
  ayah: number
  startWord: number
  endWord: number
  narratorId: string
  kind: 'variant' | 'ruling'
  categoryCode?: string
  readingText?: string
  actionAr?: string
  sourceTokenRaw?: string | number
  pdfPage?: number
  sourceReference?: string
}

export interface PlannedMergeItem {
  action: MergeAction
  naturalKey: string
  existingRecord?: ExistingDbRecord
  newItem?: IngestItem
  conflictDiff?: Record<string, { db: any; source: any }>
  note?: string
}

/**
 * Plans merge actions between incoming items and existing DB records.
 */
export function planMerges(
  incomingItems: readonly IngestItem[],
  existingRecords: readonly ExistingDbRecord[]
): {
  plan: PlannedMergeItem[]
  counts: {
    corroborate: number
    gapFill: number
    conflict: number
    existingKept: number
  }
} {
  const dbByKey = new Map<string, ExistingDbRecord>()
  for (const rec of existingRecords) {
    const key = computeNaturalKey(rec)
    dbByKey.set(key, rec)
  }

  const plan: PlannedMergeItem[] = []
  const seenDbKeys = new Set<string>()

  let corroborate = 0
  let gapFill = 0
  let conflict = 0

  for (const item of incomingItems) {
    const key = computeNaturalKey(item)
    const existing = dbByKey.get(key)

    if (!existing) {
      // Gap filled: insert new row
      gapFill++
      plan.push({
        action: 'GAP_FILL',
        naturalKey: key,
        newItem: item,
      })
      continue
    }

    seenDbKeys.add(key)

    // Compare content: readingText (for variant) or actionAr (for ruling)
    const dbText = (existing.readingText ?? existing.actionAr ?? '').trim()
    const srcText = (item.readingText ?? item.actionAr ?? '').trim()

    if (dbText === srcText || !dbText || !srcText) {
      // Both agree -> Corroborate
      corroborate++
      plan.push({
        action: 'CORROBORATE',
        naturalKey: key,
        existingRecord: existing,
        newItem: item,
      })
    } else {
      // Conflict -> Keep both, flag conflict with diff
      conflict++
      plan.push({
        action: 'CONFLICT',
        naturalKey: key,
        existingRecord: existing,
        newItem: item,
        conflictDiff: {
          text: { db: dbText, source: srcText },
        },
        note: `Source text mismatch: DB="${dbText}" vs SOURCE="${srcText}"`,
      })
    }
  }

  // Count existing records untouched
  let existingKept = 0
  for (const [key, rec] of dbByKey.entries()) {
    if (!seenDbKeys.has(key)) {
      existingKept++
      plan.push({
        action: 'EXISTING_KEPT',
        naturalKey: key,
        existingRecord: rec,
      })
    }
  }

  return {
    plan,
    counts: {
      corroborate,
      gapFill,
      conflict,
      existingKept,
    },
  }
}
