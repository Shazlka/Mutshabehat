import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSurahNumberByName } from '@/lib/quran'
import GroupRow from '@/components/GroupRow'
import FilterBar from '@/components/FilterBar'
import SortBar from '@/components/SortBar'
import SurahFilter from '@/components/SurahFilter'
import Pagination from '@/components/Pagination'
import ColorLegend from '@/components/ColorLegend'

type SP = Promise<{ page?: string; filter?: string; q?: string; sort?: string; view?: string; surah?: string }>

type GroupShape = {
  id: string; title: string; color: string | null
  status: 'draft'|'published'|'locked'
  favorite: boolean; completed: boolean
  updated_at?: string
  verses: Array<{
    id: string; surah: string; ayah: number; label: string | null
    sort_order: number | null
    parts: Array<{ id: string; type: string; text: string; sort_order: number | null }>
  }>
}

export default async function HomePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const page  = Math.max(1, parseInt(sp.page ?? '1', 10))
  const limit = 12
  const filter = sp.filter ?? ''
  const q      = sp.q ?? ''
  const sort   = sp.sort ?? 'updated'
  const view   = sp.view ?? 'flat'
  const surah  = sp.surah ?? ''

  const supabase = await createServerSupabaseClient()

  // Resolve surah filter to a set of group IDs server-side (fast indexed lookup).
  let surahGroupIds: string[] | null = null
  if (surah) {
    const { data: verseRows } = await supabase
      .from('verses')
      .select('group_id')
      .eq('surah', surah)
    surahGroupIds = [...new Set((verseRows || []).map((v: { group_id: string }) => v.group_id))]
  }

  let query = supabase
    .from('groups')
    .select(`
      id, title, color, status, favorite, completed, updated_at,
      verses (
        id, surah, ayah, label, sort_order,
        parts ( id, type, text, sort_order )
      )
    `, { count: 'exact' })

  if (filter === 'favorite')  query = query.eq('favorite', true)
  if (filter === 'completed') query = query.eq('completed', true)
  if (filter === 'draft')     query = query.eq('status', 'draft')
  if (filter === 'locked')    query = query.eq('status', 'locked')
  if (q.trim())               query = query.ilike('title', `%${q.trim()}%`)
  if (surahGroupIds !== null) {
    if (surahGroupIds.length === 0) query = query.eq('id', 'no-match')
    else                            query = query.in('id', surahGroupIds)
  }

  // Sort
  if (sort === 'updated')         query = query.order('updated_at', { ascending: false })
  else if (sort === 'title')      query = query.order('title',      { ascending: true })
  // 'mushaf' and 'most-verses' are applied after fetch

  const needsClientSort = sort === 'mushaf' || sort === 'most-verses'
  const useServerPaging = !needsClientSort

  if (useServerPaging) {
    const from = (page - 1) * limit
    const to   = from + limit - 1
    query = query.range(from, to)
  }

  const { data: groupsRaw, count } = await query
  let groups = (groupsRaw as unknown as GroupShape[]) || []
  let total = count ?? 0

  // Client-side sorting (requires all results)
  if (sort === 'most-verses') {
    groups.sort((a, b) => (b.verses?.length ?? 0) - (a.verses?.length ?? 0))
  } else if (sort === 'mushaf') {
    groups.sort((a, b) => {
      const ma = Math.min(...a.verses.map((v) => getSurahNumberByName(v.surah) ?? 9999), 9999)
      const mb = Math.min(...b.verses.map((v) => getSurahNumberByName(v.surah) ?? 9999), 9999)
      if (ma !== mb) return ma - mb
      const minAa = Math.min(...a.verses.filter((v) => (getSurahNumberByName(v.surah) ?? 9999) === ma).map((v) => v.ayah), 9999)
      const minAb = Math.min(...b.verses.filter((v) => (getSurahNumberByName(v.surah) ?? 9999) === mb).map((v) => v.ayah), 9999)
      return minAa - minAb
    })
  }

  // Client-side pagination only for non-trivial sorts
  if (!useServerPaging) {
    const from = (page - 1) * limit
    groups = groups.slice(from, from + limit)
  }

  const totalPages = Math.ceil(total / limit)

  // Sort nested arrays
  const sorted = groups.map((g) => ({
    ...g,
    verses: [...g.verses].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((v) => ({
      ...v,
      parts: [...v.parts].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    })),
  }))

  // Surah counts (for surah filter dropdown) — compute from all user verses
  const { data: allVerses } = await supabase.from('verses').select('surah')
  const surahCounts: Record<string, number> = {}
  ;(allVerses || []).forEach((v: { surah: string }) => {
    surahCounts[v.surah] = (surahCounts[v.surah] || 0) + 1
  })

  // Build pagination params
  const paginationParams: Record<string, string> = {}
  if (filter) paginationParams.filter = filter
  if (q)      paginationParams.q = q
  if (sort !== 'updated') paginationParams.sort = sort
  if (view !== 'flat')    paginationParams.view = view
  if (surah)  paginationParams.surah = surah

  // Group-by-surah view
  type Grouped = { surah: string; items: typeof sorted }
  const grouped: Grouped[] = []
  if (view === 'group-surah') {
    const map = new Map<string, typeof sorted>()
    for (const g of sorted) {
      const surahs = [...new Set(g.verses.map((v) => v.surah))]
      for (const s of surahs) {
        if (!map.has(s)) map.set(s, [])
        map.get(s)!.push(g)
      }
    }
    for (const [s, items] of map.entries()) grouped.push({ surah: s, items })
  }

  return (
    <div className="max-w-3xl mx-auto px-3 md:px-8 py-5 md:py-14">
      {/* Header */}
      <header className="mb-6 md:mb-10">
        <h1 className="text-[22px] md:text-[32px] font-bold tracking-tight text-[var(--color-ink)] leading-none">
          المتشابهات
        </h1>
        <p className="mt-1.5 md:mt-2 text-[12px] md:text-[13px] text-[var(--color-ink-muted)]">
          {total} مجموعة
          {filter && <> • {filter === 'favorite' ? 'مفضّلة' : filter === 'completed' ? 'مكتملة' : filter === 'draft' ? 'مسودة' : 'مقفلة'}</>}
          {surah && <> • سورة {surah}</>}
          {q && <> • نتائج البحث: {q}</>}
        </p>
      </header>

      <FilterBar />

      {/* Sort + Surah picker row */}
      <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
        <SortBar />
        <SurahFilter surahCounts={surahCounts} />
      </div>

      <div className="mt-4"><ColorLegend /></div>

      {/* Empty */}
      {sorted.length === 0 ? (
        <div className="py-24 text-center bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)]">
          <div className="w-12 h-12 rounded-full bg-[var(--color-primary-soft)] mx-auto mb-4 flex items-center justify-center text-[var(--color-primary)] text-2xl font-bold">∅</div>
          <p className="text-[15px] font-bold text-[var(--color-ink)]">لا توجد نتائج</p>
          <p className="text-[12px] text-[var(--color-ink-muted)] mt-2">جرّب تغيير المرشّحات أو البحث.</p>
        </div>
      ) : view === 'group-surah' ? (
        // Grouped-by-surah view
        <>
          {/* Jump bar */}
          <nav aria-label="القفز إلى سورة" className="flex flex-wrap gap-1.5 mb-6 p-3 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)]">
            {grouped.map((g) => (
              <a key={g.surah} href={`#surah-${encodeURIComponent(g.surah)}`}
                className="px-2.5 py-1 text-[11px] font-bold rounded-md text-[var(--color-ink-soft)] bg-[var(--color-surface-2)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] tap-shrink transition-colors">
                {g.surah} <span className="opacity-60">({g.items.length})</span>
              </a>
            ))}
          </nav>
          {grouped.map((g) => (
            <section key={g.surah} id={`surah-${encodeURIComponent(g.surah)}`} className="mb-10">
              <h2 className="text-[16px] font-bold text-[var(--color-primary)] mb-2 pb-2 border-b-2 border-[var(--color-primary-soft)] sticky top-0 bg-[var(--color-paper)] py-3 z-[5]">
                سورة {g.surah} <span className="text-[12px] text-[var(--color-ink-muted)] font-normal">({g.items.length})</span>
              </h2>
              <div className="divide-y divide-[var(--color-border-soft)]">
                {g.items.map((row, i) => <GroupRow key={`${g.surah}-${row.id}`} group={row} index={i + 1} />)}
              </div>
            </section>
          ))}
        </>
      ) : (
        // Flat view
        <div className="divide-y divide-[var(--color-border-soft)] mt-2">
          {sorted.map((g, i) => (
            <GroupRow key={g.id} group={g} index={(page - 1) * limit + i + 1} />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} searchParams={paginationParams} />
    </div>
  )
}
