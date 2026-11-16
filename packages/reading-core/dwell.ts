import { DWELL_TARGET_SECONDS } from './types'

/**
 * Calculates how many ayahs should be credited on a page based on dwell duration.
 *
 * Rules:
 * - Dwell < 1.0s (flick or accidental swipe): 0 ayahs credited.
 * - Dwell >= 30.0s: 100% of ayahs on page credited.
 * - 1.0s <= Dwell < 30.0s: proportional completion:
 *   e.g. 6 ayahs on page, 12.0s elapsed -> Math.floor(6 * 12 / 30) = 2 ayahs.
 */
export function calculateProportionalAyahs(
  totalAyahsOnPage: number,
  elapsedSeconds: number,
): number {
  if (totalAyahsOnPage <= 0) return 0
  if (elapsedSeconds < 1.0) return 0
  if (elapsedSeconds >= DWELL_TARGET_SECONDS) return totalAyahsOnPage

  const ratio = Math.min(1.0, elapsedSeconds / DWELL_TARGET_SECONDS)
  return Math.floor(totalAyahsOnPage * ratio)
}

/**
 * When returning to a page where some ayahs were already credited,
 * calculates the elapsed time credit already earned so timing resumes without double counting.
 */
export function calculateResumeElapsed(
  creditedAyahsCount: number,
  totalAyahsOnPage: number,
): number {
  if (totalAyahsOnPage <= 0) return 0
  const clamped = Math.min(Math.max(creditedAyahsCount, 0), totalAyahsOnPage)
  return DWELL_TARGET_SECONDS * (clamped / totalAyahsOnPage)
}

/**
 * Calculates remaining dwell seconds required to achieve full page completion.
 */
export function calculateRemainingDwellSeconds(
  creditedAyahsCount: number,
  totalAyahsOnPage: number,
): number {
  const earned = calculateResumeElapsed(creditedAyahsCount, totalAyahsOnPage)
  return Math.max(1.0, DWELL_TARGET_SECONDS - earned)
}
