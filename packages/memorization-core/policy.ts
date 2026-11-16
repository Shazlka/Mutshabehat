import { MemorizationStatus } from './types'

/**
 * The single source of truth for memorization weights, intervals, and thresholds.
 * Matches iOS `MemorizationPolicy`.
 */
export interface MemorizationPolicy {
  /** Share of an ayah counted towards weighted "learning progress", per status. */
  readonly statusWeights: Readonly<Record<MemorizationStatus, number>>
  /** Days until the next review after 1, 2, 3 … consecutive successful reviews (the last entry repeats). */
  readonly intervalLadderDays: readonly number[]
  readonly forgotIntervalDays: number
  readonly mistakesIntervalDays: number
  /** A whole surah, or more ayat than this, asks for confirmation before it is applied. */
  readonly confirmationAyahThreshold: number
  /** Strict-percentage milestones that are celebrated once. */
  readonly milestonePercents: readonly number[]
}

export const STANDARD_MEMORIZATION_POLICY: MemorizationPolicy = Object.freeze({
  statusWeights: Object.freeze({
    [MemorizationStatus.mastered]: 1.0,
    [MemorizationStatus.memorizedWithErrors]: 0.75,
    [MemorizationStatus.needsMushaf]: 0.4,
    [MemorizationStatus.notMemorized]: 0.0,
  }),
  intervalLadderDays: Object.freeze([1, 3, 7, 14, 30, 60]),
  forgotIntervalDays: 1,
  mistakesIntervalDays: 2,
  confirmationAyahThreshold: 30,
  milestonePercents: Object.freeze([25, 50, 75, 100]),
})

export const DEFAULT_MEMORIZATION_POLICY = STANDARD_MEMORIZATION_POLICY

export function createMemorizationPolicy(
  overrides: Partial<MemorizationPolicy> = {},
): MemorizationPolicy {
  return Object.freeze({
    statusWeights: Object.freeze({
      ...STANDARD_MEMORIZATION_POLICY.statusWeights,
      ...(overrides.statusWeights ?? {}),
    }),
    intervalLadderDays: Object.freeze([
      ...(overrides.intervalLadderDays ?? STANDARD_MEMORIZATION_POLICY.intervalLadderDays),
    ]),
    forgotIntervalDays: overrides.forgotIntervalDays ?? STANDARD_MEMORIZATION_POLICY.forgotIntervalDays,
    mistakesIntervalDays: overrides.mistakesIntervalDays ?? STANDARD_MEMORIZATION_POLICY.mistakesIntervalDays,
    confirmationAyahThreshold:
      overrides.confirmationAyahThreshold ?? STANDARD_MEMORIZATION_POLICY.confirmationAyahThreshold,
    milestonePercents: Object.freeze([
      ...(overrides.milestonePercents ?? STANDARD_MEMORIZATION_POLICY.milestonePercents),
    ]),
  })
}

export function getPolicyStatusWeight(
  policy: MemorizationPolicy = STANDARD_MEMORIZATION_POLICY,
  status: MemorizationStatus,
): number {
  return policy.statusWeights[status] ?? 0
}
