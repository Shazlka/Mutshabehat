// Rows of one أصول باب on the same span are one ruling for the reader (93 loci carry several rows). Their per-reader
// attribution rows and readings are kept; the first row's id and text lead.
import type { QiraatRuling } from '../types'

const spanKey = (r: QiraatRuling) => [r.category, r.surah, r.ayah, r.startToken, r.endAyah ?? r.ayah, r.endToken].join(':')

function unique<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => (seen.has(key(item)) ? false : (seen.add(key(item)), true)))
}

export function aggregateRulings(rulings: readonly QiraatRuling[]): QiraatRuling[] {
  const groups = new Map<string, QiraatRuling[]>()
  for (const r of rulings) groups.set(spanKey(r), [...(groups.get(spanKey(r)) ?? []), r])
  return Array.from(groups.values()).map((rows) => {
    if (rows.length === 1) return rows[0]
    const first = rows[0]
    return {
      ...first,
      baseText: rows.map((r) => r.baseText).find(Boolean) ?? first.baseText,
      attribution: unique(rows.flatMap((r) => r.attribution), (a) => JSON.stringify(a)),
      readings: unique(rows.flatMap((r) => r.readings), (x) => JSON.stringify(x)),
      hasAlternate: rows.some((r) => r.hasAlternate),
      text: rows.map((r) => r.text).find(Boolean),
      subCategory: rows.map((r) => r.subCategory).find(Boolean),
      condition: rows.map((r) => r.condition).find(Boolean),
      notes: rows.map((r) => r.notes).find(Boolean),
      sourceNotes: unique(rows.flatMap((r) => r.sourceNotes ?? []), (n) => n),
      verificationStatus: rows.some((r) => r.verificationStatus === 'NEEDS_MANUAL_REVIEW') ? 'NEEDS_MANUAL_REVIEW' : first.verificationStatus,
    }
  })
}
