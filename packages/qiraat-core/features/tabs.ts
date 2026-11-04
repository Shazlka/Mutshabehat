// Keyboard model of a horizontal tab list (WAI-ARIA tabs): arrows follow the visual direction, Home/End jump.
export function nextTabIndex(count: number, current: number, key: string, rtl: boolean): number | null {
  if (count <= 0) return null
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  // In RTL the tabs run right to left, so the left arrow reaches the next tab.
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
  const back = rtl ? 'ArrowRight' : 'ArrowLeft'
  if (key === forward) return (current + 1) % count
  if (key === back) return (current - 1 + count) % count
  return null
}
