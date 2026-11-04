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
  /** Pages that could not be loaded at all (network and bundled data both failed). */
  failed: number
}

const store: {
  variants: Record<number, QiraatVariant[]>
  rulings: Record<number, QiraatRuling[]>
  loaded: Set<number>
  failed: number
  running: Promise<void> | null
} = { variants: {}, rulings: {}, loaded: new Set(), failed: 0, running: null }
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

/**
 * Loads `pages`, `concurrency` at a time. A page whose load throws is reported in `failed` and the rest carry on, so
 * one bad chunk can never leave the sheets waiting forever.
 */
export async function loadPagesResilient(args: {
  pages: number[]
  concurrency: number
  loadPage: (page: number) => Promise<{ variants: QiraatVariant[]; rulings: QiraatRuling[] }>
  onPage: (page: number, data: { variants: QiraatVariant[]; rulings: QiraatRuling[] }) => void
}): Promise<{ failed: number[] }> {
  const failed: number[] = []
  let next = 0
  const worker = async () => {
    while (next < args.pages.length) {
      const page = args.pages[next]
      next += 1
      try {
        args.onPage(page, await args.loadPage(page))
      } catch {
        failed.push(page)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(args.concurrency, args.pages.length) }, worker))
  return { failed }
}

function start(): Promise<void> {
  if (store.running) return store.running
  const pages = Array.from({ length: PAGE_COUNT }, (_, i) => i + 1).filter((p) => !store.loaded.has(p))
  if (pages.length === 0) return Promise.resolve()
  let sinceNotify = 0
  store.running = loadPagesResilient({
    pages,
    concurrency: CONCURRENCY,
    loadPage,
    onPage: (page, data) => {
      store.variants[page] = data.variants
      store.rulings[page] = data.rulings
      store.loaded.add(page)
      sinceNotify += 1
      if (sinceNotify % 20 === 0) notify()
    },
  }).then(({ failed }) => {
    store.failed = failed.length
  }).finally(() => {
    store.running = null
    notify()
  })
  return store.running
}

/** Try again for the pages that failed (after a network error). */
export function retryAllPages(): void {
  store.failed = 0
  notify()
  void start()
}

function snapshot(): AllPagesSnapshot {
  return {
    variantsByPage: { ...store.variants },
    rulingsByPage: { ...store.rulings },
    loaded: store.loaded.size,
    total: PAGE_COUNT,
    done: store.loaded.size >= PAGE_COUNT,
    failed: store.failed,
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
