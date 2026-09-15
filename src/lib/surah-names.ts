'use client'

import { useEffect, useState } from 'react'

export type SurahNames = Record<string, string>

// Module-level cache + in-flight promise. Several components (SurahFilter,
// QuranSearch, AutomatedList) used to each fetch /api/quran?names=1 on mount —
// up to 3 identical requests. This shares a single request across all callers
// for the session (on top of the immutable HTTP cache on the route).
let cache: SurahNames | null = null
let inflight: Promise<SurahNames> | null = null

export function fetchSurahNames(): Promise<SurahNames> {
  if (cache) return Promise.resolve(cache)
  if (inflight) return inflight
  inflight = fetch('/api/quran?names=1')
    .then((r) => r.json())
    .then((j) => {
      cache = (j.surahs || {}) as SurahNames
      return cache
    })
    .catch(() => ({} as SurahNames)) // don't cache failures — allow retry
    .finally(() => { inflight = null })
  return inflight
}

export function useSurahNames(): SurahNames {
  const [names, setNames] = useState<SurahNames>(cache ?? {})
  useEffect(() => {
    let active = true
    fetchSurahNames().then((n) => { if (active) setNames(n) })
    return () => { active = false }
  }, [])
  return names
}
