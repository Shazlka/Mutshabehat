import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSurahNumberByName } from '@/lib/quran'
import { normalizeArabic } from '@/lib/arabic'
import GroupRow from '@/components/GroupRow'
import GroupRowTitlesOnly, { type GroupRowTitleData } from '@/components/GroupRowTitlesOnly'
import FilterBar from '@/components/FilterBar'
import SortBar from '@/components/SortBar'
import SurahFilter from '@/components/SurahFilter'
import Pagination from '@/components/Pagination'
import ColorLegend from '@/components/ColorLegend'
import MainGroupSwipePager from '@/components/MainGroupSwipePager'
import GroupCardGrid from '@/components/GroupCardGrid'

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

type MiniGroup = {
  id: string
  verses: Array<{ surah: string; ayah: number }>
}

type TitleOnlyGroup = GroupRowTitleData & {
  id: string
  title: string
  color: string | null
  status: 'draft' | 'published' | 'locked'
  favorite: boolean
  completed: boolean
}

const FULL_SELECT = `
  id, title, color, status, favorite, completed, updated_at,
  verses (
    id, surah, ayah, label, sort_order,
    parts ( id, type, text, sort_order )
  )
`

// Only fields needed for mushaf/most-verses sort key — no parts, no title
const MINI_SELECT = `id, verses ( surah, ayah )`

const TITLES_ONLY_SELECT = `id, title, color, status, favorite, completed`

export default async function HomePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const page   = Math.max(1, parseInt(sp.page ?? '1', 10))
  const filter = sp.filter ?? ''
  const q      = sp.q ?? ''
  const sort   = sp.sort ?? 'created'
  const view   = sp.view ?? 'flat'
  // Card views fill a wide screen, so they show more groups per page.
  const isCardView = view === 'collapsed' || view === 'magazine'
  const limit  = isCardView ? 24 : 12
  const surah  = sp.surah ?? ''

  const supabase = await createServerSupabaseClient()

  // Surah filter is an inner join on a second `verses` embed (alias `sv`) inside the main
  // query itself, instead of a separate "which groups contain this surah?" round-trip.
  const SURAH_JOIN = surah ? ', sv:verses!inner(surah)' : ''

  // Text search: title + parts FTS with ILIKE fallback, all in ONE RPC round-trip.
  let qGroupIds: string[] | null = null
  if (q.trim()) {
    const st = normalizeArabic(q.trim()) || q.trim()
    const { data: ids } = await supabase.rpc('search_group_ids', { p_q: st })
    qGroupIds = (ids as string[] | null) ?? []
  }

  // Generic filter applicator — casts through any to keep type-system happy across
  // different Supabase builder shapes (QueryBuilder vs FilterBuilder).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters<T>(qb: T): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let qBuilder = qb as any
    if (filter === 'favorite')  qBuilder = qBuilder.eq('favorite', true)
    if (filter === 'completed') qBuilder = qBuilder.eq('completed', true)
    if (filter === 'draft')     qBuilder = qBuilder.eq('status', 'draft')
    if (filter === 'locked')    qBuilder = qBuilder.eq('status', 'locked')
    if (qGroupIds !== null) {
      if (qGroupIds.length === 0) qBuilder = qBuilder.eq('id', 'no-match')
      else                        qBuilder = qBuilder.in('id', qGroupIds)
    }
    if (surah) qBuilder = qBuilder.eq('sv.surah', surah)
    return qBuilder
  }

  let groups: GroupShape[] = []
  let total = 0
  let surahCounts: Record<string, number> = {}
  let titleOnlyGroups: TitleOnlyGroup[] = []

  if (view === 'titles-only') {
    if (sort === 'mushaf' || sort === 'most-verses') {
      // Two-step: sort by verse data, then fetch title-only fields for current page
      let miniQ = supabase.from('groups').select(MINI_SELECT + SURAH_JOIN)
      miniQ = applyFilters(miniQ)
      const { data: miniRaw } = await miniQ
      const mini = (miniRaw as unknown as MiniGroup[]) || []

      if (sort === 'most-verses') {
        mini.sort((a, b) => (b.verses?.length ?? 0) - (a.verses?.length ?? 0))
      } else {
        mini.sort((a, b) => {
          const ma = Math.min(...a.verses.map((v) => getSurahNumberByName(v.surah) ?? 9999), 9999)
          const mb = Math.min(...b.verses.map((v) => getSurahNumberByName(v.surah) ?? 9999), 9999)
          if (ma !== mb) return ma - mb
          const minAa = Math.min(...a.verses.filter((v) => (getSurahNumberByName(v.surah) ?? 9999) === ma).map((v) => v.ayah), 9999)
          const minAb = Math.min(...b.verses.filter((v) => (getSurahNumberByName(v.surah) ?? 9999) === mb).map((v) => v.ayah), 9999)
          return minAa - minAb
        })
      }

      total = mini.length
      const from = (page - 1) * limit
      const pageIds = mini.slice(from, from + limit).map((g) => g.id)

      const { data: titlesRaw } = await supabase
        .from('groups')
        .select(TITLES_ONLY_SELECT)
        .in('id', pageIds)

      const groupMap = new Map((titlesRaw || []).map((g: any) => [g.id, g]))
      titleOnlyGroups = pageIds.map((id) => groupMap.get(id)).filter(Boolean) as TitleOnlyGroup[]

    } else {
      // Standard paginated fetch — no verses needed
      let mainQ = supabase.from('groups').select(TITLES_ONLY_SELECT + SURAH_JOIN, { count: 'exact' })
      mainQ = applyFilters(mainQ)
      if (sort === 'created')      mainQ = (mainQ as any).order('created_at', { ascending: false })
      else if (sort === 'updated') mainQ = (mainQ as any).order('updated_at', { ascending: false })
      else if (sort === 'title')   mainQ = (mainQ as any).order('title',      { ascending: true })

      const from = (page - 1) * limit
      mainQ = (mainQ as any).range(from, from + limit - 1)

      const { data: titlesRaw, count } = await mainQ
      titleOnlyGroups = (titlesRaw as unknown as TitleOnlyGroup[]) || []
      total = count ?? 0
    }
  } else if (view === 'group-surah') {
    // Needs ALL matching groups for bucketing — can't page
    // Surah counts always run in parallel
    let mainQ = supabase.from('groups').select(FULL_SELECT + SURAH_JOIN, { count: 'exact' })
    mainQ = applyFilters(mainQ)
    if (sort === 'created')     mainQ = (mainQ as any).order('created_at', { ascending: false })
    else if (sort === 'updated') mainQ = (mainQ as any).order('updated_at', { ascending: false })
    else if (sort === 'title')   mainQ = (mainQ as any).order('title',      { ascending: true })
    // mushaf/most-verses applied in JS after fetch since all data is present anyway

    const [{ data: groupsRaw, count }, { data: surahAgg }] = await Promise.all([
      mainQ,
      supabase.from('surah_counts').select('surah, cnt'),
    ])

    groups = (groupsRaw as unknown as GroupShape[]) || []
    total = count ?? 0

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

    surahCounts = Object.fromEntries((surahAgg || []).map((r: { surah: string; cnt: number }) => [r.surah, Number(r.cnt)]))

  } else if (sort === 'mushaf' || sort === 'most-verses') {
    // Two-step: fetch lightweight sort-key data for ALL matching groups,
    // sort in JS, then fetch full data (with parts) for only the current page.
    // Avoids transferring all parts text for every group in the dataset.
    let miniQ = supabase.from('groups').select(MINI_SELECT + SURAH_JOIN)
    miniQ = applyFilters(miniQ)

    const [{ data: miniRaw }, { data: surahAgg }] = await Promise.all([
      miniQ,
      supabase.from('surah_counts').select('surah, cnt'),
    ])

    let mini = (miniRaw as unknown as MiniGroup[]) || []

    if (sort === 'most-verses') {
      mini.sort((a, b) => (b.verses?.length ?? 0) - (a.verses?.length ?? 0))
    } else {
      mini.sort((a, b) => {
        const ma = Math.min(...a.verses.map((v) => getSurahNumberByName(v.surah) ?? 9999), 9999)
        const mb = Math.min(...b.verses.map((v) => getSurahNumberByName(v.surah) ?? 9999), 9999)
        if (ma !== mb) return ma - mb
        const minAa = Math.min(...a.verses.filter((v) => (getSurahNumberByName(v.surah) ?? 9999) === ma).map((v) => v.ayah), 9999)
        const minAb = Math.min(...b.verses.filter((v) => (getSurahNumberByName(v.surah) ?? 9999) === mb).map((v) => v.ayah), 9999)
        return minAa - minAb
      })
    }

    total = mini.length
    const from = (page - 1) * limit
    const pageIds = mini.slice(from, from + limit).map((g) => g.id)

    // Fetch full data for this page only
    const { data: fullRaw } = await supabase
      .from('groups')
      .select(FULL_SELECT)
      .in('id', pageIds)

    // Preserve sort order from the mini-sorted IDs
    const groupMap = new Map((fullRaw || []).map((g: any) => [g.id, g]))
    groups = pageIds.map((id) => groupMap.get(id)).filter(Boolean) as GroupShape[]

    surahCounts = Object.fromEntries((surahAgg || []).map((r: { surah: string; cnt: number }) => [r.surah, Number(r.cnt)]))

  } else {
    // Default path: server-side paging with sort, surah counts run in parallel
    let mainQ = supabase.from('groups').select(FULL_SELECT + SURAH_JOIN, { count: 'exact' })
    mainQ = applyFilters(mainQ)
    if (sort === 'created')      mainQ = (mainQ as any).order('created_at', { ascending: false })
    else if (sort === 'updated') mainQ = (mainQ as any).order('updated_at', { ascending: false })
    else if (sort === 'title')   mainQ = (mainQ as any).order('title',      { ascending: true })

    const from = (page - 1) * limit
    mainQ = (mainQ as any).range(from, from + limit - 1)

    const [{ data: groupsRaw, count }, { data: surahAgg }] = await Promise.all([
      mainQ,
      supabase.from('surah_counts').select('surah, cnt'),
    ])

    groups = (groupsRaw as unknown as GroupShape[]) || []
    total = count ?? 0

    surahCounts = Object.fromEntries((surahAgg || []).map((r: { surah: string; cnt: number }) => [r.surah, Number(r.cnt)]))
  }

  const totalPages = view === 'group-surah' ? 1 : Math.ceil(total / limit)

  // Sort nested arrays
  const sorted = groups.map((g) => ({
    ...g,
    verses: [...g.verses].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((v) => ({
      ...v,
      parts: [...v.parts].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    })),
  }))

  // Build pagination params
  const paginationParams: Record<string, string> = {}
  if (filter) paginationParams.filter = filter
  if (q)      paginationParams.q = q
  if (sort !== 'created') paginationParams.sort = sort
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
    <div className={`${isCardView ? 'max-w-3xl lg:max-w-none lg:px-10' : 'max-w-3xl'} mx-auto px-3 md:px-8 py-5 md:py-14`}>
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
      {(view === 'titles-only' ? titleOnlyGroups.length === 0 : sorted.length === 0) ? (
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
      ) : view === 'titles-only' ? (
        // Titles-only view — compact rows, no verse details
        <MainGroupSwipePager
          mode="titles-only"
          groups={titleOnlyGroups}
          startIndex={(page - 1) * limit + 1}
        />
      ) : isCardView ? (
        // Collapsed / magazine cards on wide screens; phones and portrait tablets keep the list
        <>
          <div className="lg:hidden">
            <MainGroupSwipePager mode="full" groups={sorted} startIndex={(page - 1) * limit + 1} />
          </div>
          <div className="hidden lg:block">
            <GroupCardGrid mode={view as 'collapsed' | 'magazine'} groups={sorted} startIndex={(page - 1) * limit + 1} />
          </div>
        </>
      ) : (
        // Flat view
        <MainGroupSwipePager
          mode="full"
          groups={sorted}
          startIndex={(page - 1) * limit + 1}
        />
      )}

      <Pagination page={page} totalPages={totalPages} searchParams={paginationParams} />
    </div>
  )
}
