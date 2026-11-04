'use client'

// Qiraat data for all 604 pages, for the sheets that look across the Mushaf (usul index, search). Loaded on first
// use from the public API (15 s CDN cache), six requests at a time, falling back per page to the bundled fixtures,
// and kept for the rest of the visit. Progress is reported so a sheet can show partial results while it fills.
import { useEffect, useState } from 'react'
import { defaultQiraatRepository } from '../../../../../packages/qiraat-core/repository'
import type { QiraatRuling, QiraatVariant } from '../../../../../packages/qiraat-core/types'

const PAGE_COUNT = 604
const CONCURRENCY = 6

export interface AllPagesSnapshot {
  variantsByPage: Record<number, QiraatVariant[]>
  rulingsByPage: Record<number, QiraatRuling[]>
  loaded: number
  total: number
  done: boolean
}

const store: { variants: Record<number, QiraatVariant[]>; rulings: Record<number, QiraatRuling[]>; loaded: number; running: Promise<void> | null } = {
  variants: {}, rulings: {}, loaded: 0, running: null,
}
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())

async function loadPage(page: number): Promise<{ variants: QiraatVariant[]; rulings: QiraatRuling[] }> {
  try {
    const res = await fetch(`/api/public/v1/qiraat?page=${page}`)
    if (res.ok) {
      const data = (await res.json()) as { variants?: QiraatVariant[]; rulings?: QiraatRuling[] }
      return { variants: data.variants ?? [], rulings: data.rulings ?? [] }
    }
  } catch {
    // fall through to the bundled data
  }
  const [variants, rulings] = await Promise.all([
    defaultQiraatRepository.getVariantsForPage(page, { includeUnpublished: true }),
    defaultQiraatRepository.getRulingsForPage(page, { includeUnpublished: true }),
  ])
  return { variants: variants as QiraatVariant[], rulings: rulings as QiraatRuling[] }
}

function start(): Promise<void> {
  if (store.running) return store.running
  let next = 1
  const worker = async () => {
    while (next <= PAGE_COUNT) {
      const page = next
      next += 1
      const { variants, rulings } = await loadPage(page)
      store.variants[page] = variants
      store.rulings[page] = rulings
      store.loaded += 1
      if (store.loaded % 20 === 0 || store.loaded === PAGE_COUNT) notify()
    }
  }
  store.running = Promise.all(Array.from({ length: CONCURRENCY }, worker)).then(() => { notify() })
  return store.running
}

function snapshot(): AllPagesSnapshot {
  return {
    variantsByPage: { ...store.variants },
    rulingsByPage: { ...store.rulings },
    loaded: store.loaded,
    total: PAGE_COUNT,
    done: store.loaded >= PAGE_COUNT,
  }
}

/** Starts the load when `enabled` first becomes true and returns what has arrived so far. */
export function useAllPagesData(enabled: boolean): AllPagesSnapshot {
  const [snap, setSnap] = useState<AllPagesSnapshot>(() => snapshot())
  useEffect(() => {
    if (!enabled) return
    const update = () => setSnap(snapshot())
    listeners.add(update)
    void start()
    update()
    return () => { listeners.delete(update) }
  }, [enabled])
  return snap
}
