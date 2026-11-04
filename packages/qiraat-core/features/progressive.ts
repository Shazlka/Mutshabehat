// Long result lists (search for a reader, a big usul باب) render a chunk at a time.
export const INITIAL_LIMIT = 100
export const CHUNK = 100

/** How many items to show after «عرض المزيد». */
export function nextLimit(current: number, total: number): number {
  return Math.min(total, current + CHUNK)
}
