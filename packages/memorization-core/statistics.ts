import {
  type AyahKey,
  type AyahMemorizationRecord,
  type ChangeEvent,
  ALL_MEMORIZATION_STATUSES,
  ayahKeyString,
  epochMs,
  makeAyahKey,
  MemorizationStatus,
  toNormalizedIsoString,
} from './types'
import {
  type MemorizationPolicy,
  STANDARD_MEMORIZATION_POLICY,
  getPolicyStatusWeight,
} from './policy'
import type { QuranIndex } from './quranIndex'
import { canonicalArabic } from './selectionParser'
import { isAyahDue } from './reviewEngine'
import type { GoalDefinition } from './backup'

export type SurahState = 'complete' | 'partial' | 'none'

export interface SurahProgress {
  readonly surah: number
  readonly ayahCount: number
  readonly counts: Readonly<Record<MemorizationStatus, number>>
  readonly strictPercent: number
  readonly learningPercent: number
  readonly state: SurahState
  readonly isCompleteIncludingErrors: boolean
}

export interface JuzProgress {
  readonly juz: number
  readonly counts: Readonly<Record<MemorizationStatus, number>>
  readonly strictPercent: number
  readonly learningPercent: number
  readonly isComplete: boolean
}

export interface PageMix {
  readonly counts: Readonly<Record<MemorizationStatus, number>>
  readonly fractions: Readonly<Record<MemorizationStatus, number>>
  readonly ayahCount: number
  readonly masteredAyahs: number
}

export interface MemorizationPageProgress {
  readonly page: number
  readonly state: MemorizationStatus
  readonly mix: PageMix
}

export interface MemorizationSnapshot {
  readonly totalAyahs: number
  readonly counts: Readonly<Record<MemorizationStatus, number>>
  readonly strictPercent: number
  readonly learningPercent: number
  readonly canReciteCount: number
  readonly surahs: readonly SurahProgress[]
  readonly juz: readonly JuzProgress[]
  readonly completedSurahs: number
  readonly partialSurahs: number
  readonly completeIncludingErrorsSurahs: number
  readonly completedJuz: number
  readonly pages: readonly MemorizationPageProgress[]
  readonly pagesFullyMastered: number
  readonly pageEquivalentMastered: number
}

class StatusTotalsBuilder {
  counts: Record<MemorizationStatus, number> = {
    [MemorizationStatus.mastered]: 0,
    [MemorizationStatus.memorizedWithErrors]: 0,
    [MemorizationStatus.needsMushaf]: 0,
    [MemorizationStatus.notMemorized]: 0,
  }
  ayahCount = 0
  learningWeight = 0.0

  add(status: MemorizationStatus, weight: number): void {
    this.counts[status] = (this.counts[status] ?? 0) + 1
    this.ayahCount += 1
    this.learningWeight += weight
  }

  get mastered(): number {
    return this.counts[MemorizationStatus.mastered] ?? 0
  }

  get canReciteCount(): number {
    return this.mastered + (this.counts[MemorizationStatus.memorizedWithErrors] ?? 0)
  }

  get isComplete(): boolean {
    return this.ayahCount > 0 && this.mastered === this.ayahCount
  }

  get strictPercent(): number {
    return this.ayahCount > 0 ? (this.mastered / this.ayahCount) * 100 : 0
  }

  get learningPercent(): number {
    return this.ayahCount > 0 ? (this.learningWeight / this.ayahCount) * 100 : 0
  }
}

class PageTotalsBuilder {
  counts: Record<MemorizationStatus, number> = {
    [MemorizationStatus.mastered]: 0,
    [MemorizationStatus.memorizedWithErrors]: 0,
    [MemorizationStatus.needsMushaf]: 0,
    [MemorizationStatus.notMemorized]: 0,
  }
  fractions: Record<MemorizationStatus, number> = {
    [MemorizationStatus.mastered]: 0,
    [MemorizationStatus.memorizedWithErrors]: 0,
    [MemorizationStatus.needsMushaf]: 0,
    [MemorizationStatus.notMemorized]: 0,
  }
  ayahCount = 0
  weakest: MemorizationStatus = MemorizationStatus.mastered

  add(status: MemorizationStatus, wordShare: number): void {
    this.counts[status] = (this.counts[status] ?? 0) + 1
    this.fractions[status] = (this.fractions[status] ?? 0) + wordShare
    this.ayahCount += 1
    if (status > this.weakest) {
      this.weakest = status
    }
  }

  toProgress(page: number): MemorizationPageProgress {
    return {
      page,
      state: this.ayahCount === 0 ? MemorizationStatus.notMemorized : this.weakest,
      mix: {
        counts: { ...this.counts },
        fractions: { ...this.fractions },
        ayahCount: this.ayahCount,
        masteredAyahs: this.counts[MemorizationStatus.mastered] ?? 0,
      },
    }
  }
}

function getRecord(
  records: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  key: AyahKey,
): AyahMemorizationRecord | undefined {
  const kStr = ayahKeyString(key)
  if (records instanceof Map) {
    return records.get(kStr)
  }
  return records[kStr]
}

export function computeMemorizationSnapshot(
  records: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  index: QuranIndex,
  policy: MemorizationPolicy = STANDARD_MEMORIZATION_POLICY,
): MemorizationSnapshot {
  const total = new StatusTotalsBuilder()
  const surahTotals = new Map<number, StatusTotalsBuilder>()
  const juzTotals = new Map<number, StatusTotalsBuilder>()
  const pageTotals = new Map<number, PageTotalsBuilder>()
  let pageEquivalentMastered = 0.0

  for (const key of index.ayahKeys) {
    const rec = getRecord(records, key)
    const status = rec?.status ?? MemorizationStatus.notMemorized
    const learningWeight = getPolicyStatusWeight(policy, status)

    total.add(status, learningWeight)

    let sTotals = surahTotals.get(key.surah)
    if (!sTotals) {
      sTotals = new StatusTotalsBuilder()
      surahTotals.set(key.surah, sTotals)
    }
    sTotals.add(status, learningWeight)

    const page = index.page(key)
    if (page !== undefined) {
      const wordShare = index.weight(key)
      let pTotals = pageTotals.get(page)
      if (!pTotals) {
        pTotals = new PageTotalsBuilder()
        pageTotals.set(page, pTotals)
      }
      pTotals.add(status, wordShare)

      if (status === MemorizationStatus.mastered) {
        pageEquivalentMastered += wordShare
      }

      const juz = index.juzOfPage(page)
      if (juz !== undefined) {
        let jTotals = juzTotals.get(juz)
        if (!jTotals) {
          jTotals = new StatusTotalsBuilder()
          juzTotals.set(juz, jTotals)
        }
        jTotals.add(status, learningWeight)
      }
    }
  }

  const surahs: SurahProgress[] = index.surahNumbers.map((surah) => {
    const val = surahTotals.get(surah) ?? new StatusTotalsBuilder()
    let state: SurahState
    if (val.isComplete) {
      state = 'complete'
    } else if (val.counts[MemorizationStatus.notMemorized] === val.ayahCount) {
      state = 'none'
    } else {
      state = 'partial'
    }
    return {
      surah,
      ayahCount: val.ayahCount,
      counts: { ...val.counts },
      strictPercent: val.strictPercent,
      learningPercent: val.learningPercent,
      state,
      isCompleteIncludingErrors: val.ayahCount > 0 && val.canReciteCount === val.ayahCount,
    }
  })

  const juzList: JuzProgress[] = index.juzNumbers.map((juz) => {
    const val = juzTotals.get(juz) ?? new StatusTotalsBuilder()
    return {
      juz,
      counts: { ...val.counts },
      strictPercent: val.strictPercent,
      learningPercent: val.learningPercent,
      isComplete: val.isComplete,
    }
  })

  const pages: MemorizationPageProgress[] = index.pageNumbers.map((page) => {
    const pTotals = pageTotals.get(page) ?? new PageTotalsBuilder()
    return pTotals.toProgress(page)
  })

  return {
    totalAyahs: total.ayahCount,
    counts: { ...total.counts },
    strictPercent: total.strictPercent,
    learningPercent: total.learningPercent,
    canReciteCount: total.canReciteCount,
    surahs,
    juz: juzList,
    completedSurahs: surahs.filter((s) => s.state === 'complete').length,
    partialSurahs: surahs.filter((s) => s.state === 'partial').length,
    completeIncludingErrorsSurahs: surahs.filter((s) => s.isCompleteIncludingErrors).length,
    completedJuz: juzList.filter((j) => j.isComplete).length,
    pages,
    pagesFullyMastered: pages.filter((p) => p.state === MemorizationStatus.mastered).length,
    pageEquivalentMastered,
  }
}

export function computePageProgress(
  page: number,
  records: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  index: QuranIndex,
): MemorizationPageProgress {
  const totals = new PageTotalsBuilder()
  for (const key of index.ayat(page)) {
    const rec = getRecord(records, key)
    const status = rec?.status ?? MemorizationStatus.notMemorized
    totals.add(status, index.weight(key))
  }
  return totals.toProgress(page)
}

export interface AyahRun {
  readonly status: MemorizationStatus
  readonly from: number
  readonly to: number
}

/**
 * Contiguous runs of ayahs sharing the same memorization status in a surah.
 */
export function computeAyahRuns(
  surah: number,
  records: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  index: QuranIndex,
): AyahRun[] {
  const ayat = index.ayatOfSurah(surah)
  if (ayat.length === 0) return []

  const runs: AyahRun[] = []
  let currentStatus: MemorizationStatus | null = null
  let currentFrom = 1
  let currentTo = 1

  for (const key of ayat) {
    const rec = getRecord(records, key)
    const status = rec?.status ?? MemorizationStatus.notMemorized
    if (currentStatus !== null) {
      if (currentStatus === status) {
        currentTo = key.ayah
      } else {
        runs.push({ status: currentStatus, from: currentFrom, to: currentTo })
        currentStatus = status
        currentFrom = key.ayah
        currentTo = key.ayah
      }
    } else {
      currentStatus = status
      currentFrom = key.ayah
      currentTo = key.ayah
    }
  }

  if (currentStatus !== null) {
    runs.push({ status: currentStatus, from: currentFrom, to: currentTo })
  }

  return runs
}

// MARK: - Surah and Ayah list queries

export type SurahSortOrder = 'mushafOrder' | 'mostMemorized' | 'leastMemorized'
export type SurahFilter = 'all' | 'complete' | 'incomplete' | 'currentlyLearning' | 'needsReview'

export interface SurahListItem {
  readonly number: number
  readonly name: string
}

export function querySurahList(
  surahs: readonly SurahListItem[],
  progressMap: Record<number, SurahProgress> | Map<number, SurahProgress> | readonly SurahProgress[],
  records: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  searchText: string,
  sort: SurahSortOrder,
  filter: SurahFilter,
  now: Date | string | number = new Date(),
): SurahListItem[] {
  let map: Map<number, SurahProgress>
  if (Array.isArray(progressMap)) {
    map = new Map(progressMap.map((p) => [p.surah, p]))
  } else if (progressMap instanceof Map) {
    map = progressMap
  } else {
    map = new Map(Object.entries(progressMap).map(([k, v]) => [Number(k), v]))
  }

  let filtered = [...surahs]

  const trimmed = searchText.trim()
  if (trimmed.length > 0) {
    const canonicalQuery = canonicalArabic(trimmed)
    filtered = filtered.filter((s) => {
      const canonicalName = canonicalArabic(s.name)
      return canonicalName.includes(canonicalQuery)
    })
  }

  const allRecordsList = records instanceof Map ? Array.from(records.values()) : Object.values(records)

  switch (filter) {
    case 'all':
      break
    case 'complete':
      filtered = filtered.filter((s) => map.get(s.number)?.state === 'complete')
      break
    case 'incomplete':
      filtered = filtered.filter((s) => map.get(s.number)?.state !== 'complete')
      break
    case 'currentlyLearning': {
      const learningSurahs = new Set(
        allRecordsList.filter((r) => r.isCurrentlyLearning).map((r) => r.surah),
      )
      filtered = filtered.filter((s) => learningSurahs.has(s.number))
      break
    }
    case 'needsReview': {
      const dueSurahs = new Set(
        allRecordsList.filter((r) => isAyahDue(r, now)).map((r) => r.surah),
      )
      filtered = filtered.filter((s) => dueSurahs.has(s.number))
      break
    }
  }

  switch (sort) {
    case 'mushafOrder':
      filtered.sort((a, b) => a.number - b.number)
      break
    case 'mostMemorized':
      filtered.sort((a, b) => {
        const pA = map.get(a.number)?.strictPercent ?? 0
        const pB = map.get(b.number)?.strictPercent ?? 0
        if (pA !== pB) return pB - pA
        return a.number - b.number
      })
      break
    case 'leastMemorized':
      filtered.sort((a, b) => {
        const pA = map.get(a.number)?.strictPercent ?? 0
        const pB = map.get(b.number)?.strictPercent ?? 0
        if (pA !== pB) return pA - pB
        return a.number - b.number
      })
      break
  }

  return filtered
}

export type AyahFilter =
  | { readonly type: 'status'; readonly status: MemorizationStatus }
  | { readonly type: 'dueForReview' }
  | { readonly type: 'currentlyLearning' }

export function queryAyahListKeys(
  filter: AyahFilter,
  records: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  index: QuranIndex,
  now: Date | string | number,
): AyahKey[] {
  return index.ayahKeys.filter((key) => {
    const rec = getRecord(records, key)
    switch (filter.type) {
      case 'status': {
        const currentStatus = rec?.status ?? MemorizationStatus.notMemorized
        return currentStatus === filter.status
      }
      case 'dueForReview': {
        if (!rec) return false
        return isAyahDue(rec, now)
      }
      case 'currentlyLearning':
        return rec?.isCurrentlyLearning === true
    }
  })
}

// MARK: - History & Dominant transition

export function getDominantTransition(
  events: readonly ChangeEvent[],
): { from: MemorizationStatus; to: MemorizationStatus } | null {
  if (events.length === 0) return null

  const counts = new Map<string, { from: MemorizationStatus; to: MemorizationStatus; count: number }>()
  for (const event of events) {
    const from = event.before?.status ?? MemorizationStatus.notMemorized
    const to = event.after.status
    const key = `${from}:${to}`
    const existing = counts.get(key)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(key, { from, to, count: 1 })
    }
  }

  let best: { from: MemorizationStatus; to: MemorizationStatus; count: number } | null = null

  for (const item of counts.values()) {
    if (!best || item.count > best.count) {
      best = item
    } else if (item.count === best.count) {
      if (item.from < best.from) {
        best = item
      } else if (item.from === best.from && item.to < best.to) {
        best = item
      }
    }
  }

  return best ? { from: best.from, to: best.to } : null
}

export interface PeriodGains {
  readonly newAyat: number
  readonly pageEquivalents: number
  readonly surahsCompleted: number
}

function chronologicalEvents(events: readonly ChangeEvent[]): ChangeEvent[] {
  return events
    .map((event, index) => ({ event, index, time: epochMs(event.at) }))
    .sort((a, b) => (a.time !== b.time ? a.time - b.time : a.index - b.index))
    .map((x) => x.event)
}

export function getHistoryRecordsAsOf(
  date: Date | string | number,
  current: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  events: readonly ChangeEvent[],
): Record<string, AyahMemorizationRecord> {
  const dateMs = epochMs(date)
  const result: Record<string, AyahMemorizationRecord> = {}

  if (current instanceof Map) {
    for (const [k, v] of current.entries()) {
      result[k] = { ...v }
    }
  } else {
    for (const [k, v] of Object.entries(current)) {
      result[k] = { ...v }
    }
  }

  const restoredKeys = new Set<string>()
  for (const event of chronologicalEvents(events)) {
    if (epochMs(event.at) > dateMs) {
      const kStr = `${event.surah}:${event.ayah}`
      if (!restoredKeys.has(kStr)) {
        restoredKeys.add(kStr)
        if (event.before === null) {
          delete result[kStr]
        } else {
          result[kStr] = { ...event.before }
        }
      }
    }
  }

  return result
}

function isRecitable(status: MemorizationStatus): boolean {
  return status === MemorizationStatus.mastered || status === MemorizationStatus.memorizedWithErrors
}

function isUnrecitable(status: MemorizationStatus): boolean {
  return status === MemorizationStatus.notMemorized || status === MemorizationStatus.needsMushaf
}

export function computePeriodGains(
  from: Date | string | number,
  to: Date | string | number,
  current: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  events: readonly ChangeEvent[],
  index: QuranIndex,
  policy: MemorizationPolicy = STANDARD_MEMORIZATION_POLICY,
): PeriodGains {
  const start = getHistoryRecordsAsOf(from, current, events)
  const end = getHistoryRecordsAsOf(to, current, events)

  let newAyat = 0
  let pageEquivalents = 0.0

  for (const key of index.ayahKeys) {
    const kStr = ayahKeyString(key)
    const beforeStatus = start[kStr]?.status ?? MemorizationStatus.notMemorized
    const afterStatus = end[kStr]?.status ?? MemorizationStatus.notMemorized
    if (isUnrecitable(beforeStatus) && isRecitable(afterStatus)) {
      newAyat += 1
      pageEquivalents += index.weight(key)
    }
  }

  const startSnapshot = computeMemorizationSnapshot(start, index, policy)
  const endSnapshot = computeMemorizationSnapshot(end, index, policy)

  const completedBefore = new Set(
    startSnapshot.surahs.filter((s) => s.state === 'complete').map((s) => s.surah),
  )
  const completedAfter = endSnapshot.surahs
    .filter((s) => s.state === 'complete')
    .map((s) => s.surah)

  const newlyCompletedSurahs = completedAfter.filter((s) => !completedBefore.has(s)).length

  return {
    newAyat,
    pageEquivalents,
    surahsCompleted: newlyCompletedSurahs,
  }
}

export type ProgressRange = 'days7' | 'days30' | 'months3' | 'months6' | 'year' | 'all'

export interface ProgressPoint {
  readonly date: string
  readonly strictPercent: number
  readonly learningPercent: number
}

function getStartOfDayUtc(dateMs: number): number {
  const d = new Date(dateMs)
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime()
}

export function computeProgressSampleDates(
  range: ProgressRange,
  now: Date | string | number,
  firstEventAt?: Date | string | number | null,
): string[] {
  const nowMs = epochMs(now)
  const normalizedNow = toNormalizedIsoString(nowMs)

  function endOfDayDaysBefore(days: number): string {
    const targetDate = new Date(nowMs - (days - 1) * 86_400_000)
    targetDate.setUTCHours(0, 0, 0, 0)
    return toNormalizedIsoString(targetDate.getTime() - 1)
  }

  let dates: string[] = []
  switch (range) {
    case 'days7': {
      for (let d = 6; d >= 1; d -= 1) {
        dates.push(endOfDayDaysBefore(d))
      }
      dates.push(normalizedNow)
      break
    }
    case 'days30': {
      for (let d = 29; d >= 1; d -= 1) {
        dates.push(endOfDayDaysBefore(d))
      }
      dates.push(normalizedNow)
      break
    }
    case 'months3': {
      for (let w = 12; w >= 1; w -= 1) {
        dates.push(toNormalizedIsoString(nowMs - w * 7 * 86_400_000))
      }
      dates.push(normalizedNow)
      break
    }
    case 'months6': {
      for (let w = 25; w >= 1; w -= 1) {
        dates.push(toNormalizedIsoString(nowMs - w * 7 * 86_400_000))
      }
      dates.push(normalizedNow)
      break
    }
    case 'year': {
      const nowD = new Date(nowMs)
      for (let m = 11; m >= 1; m -= 1) {
        const d = new Date(nowD)
        d.setUTCMonth(d.getUTCMonth() - m)
        dates.push(toNormalizedIsoString(d.getTime()))
      }
      dates.push(normalizedNow)
      break
    }
    case 'all': {
      if (!firstEventAt) return [normalizedNow]
      const firstMs = epochMs(firstEventAt)
      const firstDate = new Date(firstMs)
      firstDate.setUTCDate(1)
      firstDate.setUTCHours(0, 0, 0, 0)

      const currentDate = new Date(nowMs)
      currentDate.setUTCDate(1)
      currentDate.setUTCHours(0, 0, 0, 0)

      dates = []
      let cursor = new Date(firstDate)
      while (cursor.getTime() < currentDate.getTime()) {
        const next = new Date(cursor)
        next.setUTCMonth(next.getUTCMonth() + 1)
        dates.push(toNormalizedIsoString(next.getTime() - 1))
        cursor = next
      }
      dates.push(normalizedNow)
      break
    }
  }

  const seen = new Set<string>()
  return dates
    .map((d) => toNormalizedIsoString(d))
    .sort((a, b) => epochMs(a) - epochMs(b))
    .filter((d) => {
      if (seen.has(d)) return false
      seen.add(d)
      return true
    })
}

export function computeProgressSeries(
  range: ProgressRange,
  now: Date | string | number,
  current: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  events: readonly ChangeEvent[],
  index: QuranIndex,
  policy: MemorizationPolicy = STANDARD_MEMORIZATION_POLICY,
): ProgressPoint[] {
  const firstEventAt = events.length > 0 ? Math.min(...events.map((e) => epochMs(e.at))) : null
  const samples = computeProgressSampleDates(range, now, firstEventAt)
  const total = index.totalAyahs

  const state: Record<string, AyahMemorizationRecord | null> = {}
  if (current instanceof Map) {
    for (const [k, v] of current.entries()) {
      state[k] = { ...v }
    }
  } else {
    for (const [k, v] of Object.entries(current)) {
      state[k] = { ...v }
    }
  }

  let mastered = 0
  let weighted = 0.0

  for (const [kStr, record] of Object.entries(state)) {
    if (!record) continue
    const key = makeAyahKey(record.surah, record.ayah)
    if (index.ordinal(key) !== undefined) {
      if (record.status === MemorizationStatus.mastered) mastered += 1
      weighted += getPolicyStatusWeight(policy, record.status)
    }
  }

  const newestFirst = [...chronologicalEvents(events)].reverse()
  let cursor = 0
  const points: ProgressPoint[] = []

  const reversedSamples = [...samples].reverse()
  for (const dateStr of reversedSamples) {
    const sampleTime = epochMs(dateStr)
    while (cursor < newestFirst.length && epochMs(newestFirst[cursor].at) > sampleTime) {
      const event = newestFirst[cursor]
      cursor += 1
      const kStr = `${event.surah}:${event.ayah}`
      const key = makeAyahKey(event.surah, event.ayah)
      if (index.ordinal(key) !== undefined) {
        const existing = state[kStr]
        if (existing) {
          if (existing.status === MemorizationStatus.mastered) mastered -= 1
          weighted -= getPolicyStatusWeight(policy, existing.status)
        }
        if (event.before) {
          if (event.before.status === MemorizationStatus.mastered) mastered += 1
          weighted += getPolicyStatusWeight(policy, event.before.status)
        }
      }
      state[kStr] = event.before ? { ...event.before } : null
    }

    points.push({
      date: dateStr,
      strictPercent: total > 0 ? (mastered / total) * 100 : 0,
      learningPercent: total > 0 ? (weighted / total) * 100 : 0,
    })
  }

  return points.reverse()
}

// MARK: - Goal Progress

export interface GoalProgress {
  readonly fraction: number
  readonly remainingAyat: number
  readonly remainingPageEquivalents: number
  readonly remainingDays: number | null
  readonly isReached: boolean
}

export function computeGoalProgress(
  goal: GoalDefinition,
  _snapshot: MemorizationSnapshot,
  records: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  events: readonly ChangeEvent[],
  index: QuranIndex,
  now: Date | string | number,
  firstDayOfWeek = 0, // 0 = Sunday (default in standard Gregorian calendar)
): GoalProgress {
  const nowMs = epochMs(now)
  const nowDate = new Date(nowMs)

  function capped(value: number, target: number): number {
    if (target <= 0) return 0
    return Math.min(1, Math.max(0, value / target))
  }

  function mastery(keys: readonly AyahKey[], remainingDays: number | null): GoalProgress {
    if (keys.length === 0) {
      return { fraction: 0, remainingAyat: 0, remainingPageEquivalents: 0, remainingDays, isReached: false }
    }
    let mastered = 0
    let remainingPages = 0.0
    for (const key of keys) {
      const rec = getRecord(records, key)
      if (rec?.status === MemorizationStatus.mastered) {
        mastered += 1
      } else {
        remainingPages += index.weight(key)
      }
    }
    const isReached = mastered === keys.length
    return {
      fraction: mastered / keys.length,
      remainingAyat: keys.length - mastered,
      remainingPageEquivalents: remainingPages,
      remainingDays,
      isReached,
    }
  }

  switch (goal.kind.type) {
    case 'ayatPerDay': {
      const target = goal.kind.count
      const startOfDay = new Date(nowMs)
      startOfDay.setUTCHours(0, 0, 0, 0)
      const instantBefore = startOfDay.getTime() - 1
      const gained = computePeriodGains(instantBefore, nowMs, records, events, index).newAyat
      return {
        fraction: capped(gained, target),
        remainingAyat: Math.max(0, target - gained),
        remainingPageEquivalents: 0,
        remainingDays: null,
        isReached: target > 0 && gained >= target,
      }
    }

    case 'pageEquivalentsPerWeek': {
      const target = goal.kind.target
      const d = new Date(nowMs)
      const dayOfWeek = d.getUTCDay() // 0 = Sun
      const daysToStart = (dayOfWeek - firstDayOfWeek + 7) % 7
      const weekStart = new Date(nowMs - daysToStart * 86_400_000)
      weekStart.setUTCHours(0, 0, 0, 0)
      const instantBefore = weekStart.getTime() - 1
      const gained = computePeriodGains(instantBefore, nowMs, records, events, index).pageEquivalents
      return {
        fraction: capped(gained, target),
        remainingAyat: 0,
        remainingPageEquivalents: Math.max(0, target - gained),
        remainingDays: null,
        isReached: target > 0 && gained >= target - 1e-9,
      }
    }

    case 'completeSurah':
      return mastery(index.ayatOfSurah(goal.kind.surah), null)

    case 'completeJuz':
      return mastery(index.ayatOfJuz(goal.kind.juz), null)

    case 'completeQuranBy': {
      const targetMs = epochMs(goal.kind.date)
      const todayStart = new Date(nowMs)
      todayStart.setUTCHours(0, 0, 0, 0)
      const targetStart = new Date(targetMs)
      targetStart.setUTCHours(0, 0, 0, 0)
      const days = Math.floor((targetStart.getTime() - todayStart.getTime()) / 86_400_000)
      return mastery(index.ayahKeys, Math.max(0, days))
    }
  }
}
