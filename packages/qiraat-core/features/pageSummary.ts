// Port of apps/ios MushafCore QiraatPageSummary.swift: every marked word of a page with what is recorded on it,
// in the page's reading order. Pure.
import {
  matchesFilter,
  matchesRulingFilter,
  rulingTouchesToken,
} from '../../../src/app/mushaf-1441/_components/qiraat/qiraatWordMarker'
import type { QiraatComparisonFilter } from '../../../src/app/mushaf-1441/_components/qiraat/types'
import { rollupAuthorityPills, type AuthorityPill } from '../attribution'
import { getReadingOrNull } from '../readings'
import type { QiraatRuling, QiraatRulingAttribution, QiraatVariant } from '../types'
import type { OrderableWord } from './wordOrder'

export interface SummaryWord extends OrderableWord {
  /** The word as printed, for display. */
  text: string
}

export interface PageSummaryActionGroup {
  action: string
  entries: QiraatRulingAttribution[]
  pills: AuthorityPill[]
}

export interface PageSummaryRuling {
  ruling: QiraatRuling
  actionGroups: PageSummaryActionGroup[]
}

export interface PageSummaryItem {
  wordId: string
  text: string
  surah: number
  ayah: number
  token: number
  variants: { variant: QiraatVariant; pills: AuthorityPill[] }[]
  rulingGroups: { category: string; categoryAr: string; rulings: PageSummaryRuling[] }[]
}

function readerOf(authorityId: string): string {
  return authorityId.includes('-') ? (getReadingOrNull(authorityId)?.readerId ?? authorityId.split('-')[0]) : authorityId
}

/** Whether an authority (reader Q0N or narrator Q0N-R0M) is inside the filter. */
function matchesAuthority(id: string, filter: QiraatComparisonFilter): boolean {
  if (filter.kind === 'all') return true
  if (filter.kind === 'reader') return readerOf(id) === filter.readerId
  return id === filter.readingId || id === readerOf(filter.readingId)
}

function actionGroupsOf(ruling: QiraatRuling, filter: QiraatComparisonFilter): PageSummaryActionGroup[] {
  const byAction = new Map<string, QiraatRulingAttribution[]>()
  for (const row of ruling.attribution) {
    if (!matchesAuthority(row.authorityId, filter)) continue
    byAction.set(row.action, [...(byAction.get(row.action) ?? []), row])
  }
  let groups = Array.from(byAction, ([action, entries]) => ({ action, entries, pills: rollupAuthorityPills(entries.map((e) => e.authorityId)) }))
  if (groups.length === 0) {
    // Some imports carry `readings` without attribution rows: keep their source actions.
    const byReadingAction = new Map<string, QiraatRulingAttribution[]>()
    for (const reading of ruling.readings) {
      if (!matchesAuthority(reading.readingId, filter)) continue
      const action = reading.action || ruling.categoryAr
      byReadingAction.set(action, [...(byReadingAction.get(action) ?? []), { authorityId: reading.readingId, action }])
    }
    groups = Array.from(byReadingAction, ([action, entries]) => ({ action, entries, pills: rollupAuthorityPills(entries.map((e) => e.authorityId)) }))
  }
  return groups
}

export function buildPageSummary(args: {
  page: number
  words: SummaryWord[]
  variants: readonly QiraatVariant[]
  rulings: readonly QiraatRuling[]
  filter: QiraatComparisonFilter
}): PageSummaryItem[] {
  const { page, variants, rulings, filter } = args
  const ordered = args.words
    .filter((w) => w.page === page)
    .sort((a, b) => a.line - b.line || a.indexInLine - b.indexInLine)
  const seen = new Set<string>()
  const items: PageSummaryItem[] = []
  for (const word of ordered) {
    const key = `${word.surah}:${word.ayah}:${word.tokenInAyah}`
    if (seen.has(key)) continue
    const wordVariants = variants
      .filter((v) => v.surah === word.surah && v.ayah === word.ayah && word.tokenInAyah >= v.startToken && word.tokenInAyah <= v.endToken && matchesFilter(v, filter))
      .map((variant) => ({
        variant,
        pills: rollupAuthorityPills(variant.readingIds.filter((id) => matchesAuthority(id, filter))),
      }))
    const wordRulings: PageSummaryRuling[] = rulings
      .filter((r) => r.wordAnchored && rulingTouchesToken(r, word.surah, word.ayah, word.tokenInAyah) && matchesRulingFilter(r, filter))
      .map((ruling) => ({ ruling, actionGroups: actionGroupsOf(ruling, filter) }))
      .filter((r) => r.actionGroups.length > 0)
    if (wordVariants.length === 0 && wordRulings.length === 0) continue
    seen.add(key)
    const groups = new Map<string, { category: string; categoryAr: string; rulings: PageSummaryRuling[] }>()
    for (const r of wordRulings) {
      const g = groups.get(r.ruling.category) ?? { category: r.ruling.category, categoryAr: r.ruling.categoryAr, rulings: [] }
      g.rulings.push(r)
      groups.set(r.ruling.category, g)
    }
    items.push({
      wordId: word.id, text: word.text, surah: word.surah, ayah: word.ayah, token: word.tokenInAyah,
      variants: wordVariants, rulingGroups: Array.from(groups.values()),
    })
  }
  return items
}
