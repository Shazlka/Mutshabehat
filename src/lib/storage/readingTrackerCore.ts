import { calculateProportionalAyahs } from '../../../packages/reading-core/dwell'
import type { ReadAyahInput } from './reading-db'

export interface ReadingTrackerState {
  readonly page: number | null
  readonly ayahs: readonly ReadAyahInput[]
  readonly pageStartedAt: number | null
  readonly creditedAyahsCount: number
  readonly isFullPageCompleted: boolean
}

export interface ReadingDwellCredit {
  readonly page: number
  readonly items: readonly ReadAyahInput[]
  readonly targetCount: number
  readonly elapsedSeconds: number
  readonly isFullPage: boolean
}

const EMPTY_STATE: ReadingTrackerState = {
  page: null,
  ayahs: [],
  pageStartedAt: null,
  creditedAyahsCount: 0,
  isFullPageCompleted: false,
}

function orderedUnique(items: readonly ReadAyahInput[], page: number): ReadAyahInput[] {
  const result = new Map<string, ReadAyahInput>()
  for (const item of items) result.set(`${item.surah}:${item.ayah}`, { ...item, page })
  return Array.from(result.values())
}

/** Pure state machine for the iOS 1-second/30-second dwell policy. Time is always supplied by the caller. */
export class ReadingTrackerCore {
  private value: ReadingTrackerState = EMPTY_STATE

  get state(): ReadingTrackerState { return this.value }

  startPage(page: number, ayahs: readonly ReadAyahInput[], nowMs: number): void {
    this.value = {
      page,
      ayahs: orderedUnique(ayahs, page),
      pageStartedAt: nowMs,
      creditedAyahsCount: 0,
      isFullPageCompleted: false,
    }
  }

  creditAt(nowMs: number): ReadingDwellCredit | null {
    const { page, ayahs, pageStartedAt, creditedAyahsCount, isFullPageCompleted } = this.value
    if (page === null || pageStartedAt === null || ayahs.length === 0 || isFullPageCompleted) return null
    const elapsedSeconds = Math.max(0, (nowMs - pageStartedAt) / 1000)
    const targetCount = calculateProportionalAyahs(ayahs.length, elapsedSeconds)
    if (targetCount <= creditedAyahsCount) return null
    return {
      page,
      items: ayahs.slice(0, targetCount),
      targetCount,
      elapsedSeconds,
      isFullPage: targetCount >= ayahs.length,
    }
  }

  creditApplied(credit: ReadingDwellCredit): void {
    if (credit.page !== this.value.page) return
    this.value = {
      ...this.value,
      creditedAyahsCount: Math.max(this.value.creditedAyahsCount, credit.targetCount),
      isFullPageCompleted: credit.isFullPage || this.value.isFullPageCompleted,
    }
  }

  flush(nowMs: number): ReadingDwellCredit | null {
    const credit = this.creditAt(nowMs)
    this.value = { ...this.value, pageStartedAt: null }
    return credit
  }

  resume(nowMs: number): void {
    if (this.value.pageStartedAt !== null || this.value.isFullPageCompleted || this.value.ayahs.length === 0) return
    const earnedSeconds = 30 * this.value.creditedAyahsCount / this.value.ayahs.length
    this.value = { ...this.value, pageStartedAt: nowMs - earnedSeconds * 1000 }
  }

  reset(): void { this.value = EMPTY_STATE }
}

