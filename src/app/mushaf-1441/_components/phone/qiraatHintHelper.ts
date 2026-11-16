export const QIRAAT_HINT_STORAGE_KEY = 'mushaf1441:phone:qiraatHintSeen:v1'
export const QIRAAT_HINT_AUTO_DISMISS_MS = 8000

let memoryHintSeen = false

export function resetMemoryHintSeenForTesting(): void {
  memoryHintSeen = false
}

export function shouldShowQiraatHint(options: {
  qiraatEnabled: boolean
  hintSeen: boolean
}): boolean {
  return Boolean(options.qiraatEnabled && !options.hintSeen)
}

export function readQiraatHintSeen(storage?: Pick<Storage, 'getItem'> | null): boolean {
  if (memoryHintSeen) return true
  if (typeof window === 'undefined' && !storage) return false
  try {
    const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null)
    const val = s?.getItem(QIRAAT_HINT_STORAGE_KEY)
    if (val === 'true') {
      memoryHintSeen = true
      return true
    }
    return false
  } catch {
    return memoryHintSeen
  }
}

export function writeQiraatHintSeen(storage?: Pick<Storage, 'setItem'> | null): boolean {
  memoryHintSeen = true
  if (typeof window === 'undefined' && !storage) return true
  try {
    const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null)
    s?.setItem(QIRAAT_HINT_STORAGE_KEY, 'true')
    return true
  } catch {
    return true
  }
}

export function resolveQiraatHintTimer(visible: boolean, durationMs = QIRAAT_HINT_AUTO_DISMISS_MS): number | null {
  return visible ? durationMs : null
}

export function resolveAppVersion(envVersion?: string | null): string {
  return (envVersion && envVersion.trim()) || 'ويب'
}
