'use client'

import { useEffect, useState } from 'react'
import { openPersonalStore, type PersonalStore } from '../../../../lib/personal-store'

let shared: Promise<PersonalStore> | null = null

/** The one per-device personal store of this visit; null until it has opened. */
export function usePersonalStore(): PersonalStore | null {
  const [store, setStore] = useState<PersonalStore | null>(null)
  useEffect(() => {
    let alive = true
    shared ??= openPersonalStore()
    void shared.then((s) => { if (alive) setStore(s) })
    return () => { alive = false }
  }, [])
  return store
}
