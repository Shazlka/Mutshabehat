// Part 8/24/26: data access abstraction. The prototype is fixture-backed (same shape as
// packages/quran-data/mushaf1441/pageWordsIndex.ts + pageLoader.ts) because this sandbox has no
// reachability to the self-hosted Supabase backend, and because Mushaf page data itself is already
// fixture-based — see docs/qiraat/00-existing-architecture.md. A future `SupabaseQiraatRepository`
// implementing the same interface (backed by the qiraat_variants/qiraat_variant_readings tables in
// docs/qiraat/03-database-schema.md) is a drop-in replacement; nothing above this interface needs
// to change when that happens.
import type { QiraatVariant } from './types'
import { variantsForToken as engineVariantsForToken, type EngineOptions } from './engine'

export interface QiraatRepository {
  getVariantsForPage(pageNumber: number, options?: EngineOptions): Promise<QiraatVariant[]>
}

type PageVariantsModule = { default: QiraatVariant[] }
type PageVariantsLoader = () => Promise<PageVariantsModule>

// Only page 1 (the prototype page) is wired today. Adding a page is: drop a new
// `fixtures/pages/page-NNN.json`, add one line here — nothing else changes (repository consumers,
// the API route, and the UI are all page-count-agnostic).
const PAGE_VARIANT_LOADERS: Record<number, PageVariantsLoader> = {
  1: () => import('./fixtures/pages/page-001.json') as unknown as Promise<PageVariantsModule>,
  2: () => import('./fixtures/pages/page-002.json') as unknown as Promise<PageVariantsModule>,
  3: () => import('./fixtures/pages/page-003.json') as unknown as Promise<PageVariantsModule>,
  4: () => import('./fixtures/pages/page-004.json') as unknown as Promise<PageVariantsModule>,
  5: () => import('./fixtures/pages/page-005.json') as unknown as Promise<PageVariantsModule>,
  6: () => import('./fixtures/pages/page-006.json') as unknown as Promise<PageVariantsModule>,
  7: () => import('./fixtures/pages/page-007.json') as unknown as Promise<PageVariantsModule>,
  8: () => import('./fixtures/pages/page-008.json') as unknown as Promise<PageVariantsModule>,
  9: () => import('./fixtures/pages/page-009.json') as unknown as Promise<PageVariantsModule>,
  10: () => import('./fixtures/pages/page-010.json') as unknown as Promise<PageVariantsModule>,
  11: () => import('./fixtures/pages/page-011.json') as unknown as Promise<PageVariantsModule>,
  12: () => import('./fixtures/pages/page-012.json') as unknown as Promise<PageVariantsModule>,
  13: () => import('./fixtures/pages/page-013.json') as unknown as Promise<PageVariantsModule>,
  14: () => import('./fixtures/pages/page-014.json') as unknown as Promise<PageVariantsModule>,
  15: () => import('./fixtures/pages/page-015.json') as unknown as Promise<PageVariantsModule>,
  16: () => import('./fixtures/pages/page-016.json') as unknown as Promise<PageVariantsModule>,
  17: () => import('./fixtures/pages/page-017.json') as unknown as Promise<PageVariantsModule>,
  18: () => import('./fixtures/pages/page-018.json') as unknown as Promise<PageVariantsModule>,
  19: () => import('./fixtures/pages/page-019.json') as unknown as Promise<PageVariantsModule>,
  20: () => import('./fixtures/pages/page-020.json') as unknown as Promise<PageVariantsModule>,
}

export class FixtureQiraatRepository implements QiraatRepository {
  async getVariantsForPage(pageNumber: number, options?: EngineOptions): Promise<QiraatVariant[]> {
    const load = PAGE_VARIANT_LOADERS[pageNumber]
    if (!load) return []
    const mod = await load()
    const all = mod.default
    if (options?.includeUnpublished) return all
    return all.filter((variant) => variant.verificationStatus === 'VERIFIED' || variant.verificationStatus === 'PUBLISHED')
  }
}

export const defaultQiraatRepository: QiraatRepository = new FixtureQiraatRepository()

/** Convenience filter reused by the legacy ayahKey-scoped adapter and by UI selection lookups. */
export function variantsForAyah(variants: readonly QiraatVariant[], surah: number, ayah: number): QiraatVariant[] {
  return variants.filter((variant) => variant.surah === surah && variant.ayah === ayah)
}

export { engineVariantsForToken as variantsForToken }
