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
