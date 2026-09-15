import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSurahNames } from '@/lib/quran'
import { cn } from '@/lib/cn'
import GroupRow, { type GroupRowData } from '@/components/GroupRow'
import AutomatedCard, { type AutomatedRow } from '@/components/AutomatedCard'
import Pagination from '@/components/Pagination'
import ColorLegend from '@/components/ColorLegend'

type SP = Promise<{ tab?: string; page?: string }>

type GroupShape = Omit<GroupRowData, 'verses'> & {
  verses: Array<{
    id: string; surah: string; ayah: number; label: string | null; sort_order: number | null
    parts: Array<{ id: string; type: string; text: string; sort_order: number | null }>
  }>
}

// `sv` is a filtering-only inner join so the `verses` embed still returns every ayah of the group.
const GROUP_SELECT = `
  id, title, color, status, favorite, completed,
  verses ( id, surah, ayah, label, sort_order, parts ( id, type, text, sort_order ) ),
  sv:verses!inner(surah)
`

export default async function SurahDetailPage({ params, searchParams }: { params: Promise<{ no: string }>; searchParams: SP }) {
  const [{ no }, sp] = await Promise.all([params, searchParams])
  const names = getSurahNames()
  const surahNo = Number(no)
  const name = names[String(surahNo)]
  if (!name) notFound()

  const tab = sp.tab === 'automated' ? 'automated' : 'personal'
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const limit = tab === 'personal' ? 12 : 20
  const from = (page - 1) * limit

  const supabase = await createServerSupabaseClient()

  // One parallel round: the active tab's page of rows + the other tab's count.
  const personalQ = tab === 'personal'
    ? supabase.from('groups').select(GROUP_SELECT, { count: 'exact' })
        .eq('sv.surah', name).order('created_at', { ascending: false }).range(from, from + limit - 1)
    : supabase.from('groups').select('id, sv:verses!inner(surah)', { count: 'exact', head: true }).eq('sv.surah', name)
  const automatedQ = tab === 'automated'
    ? supabase.from('automated_groups').select('id, title, color, surahs, payload', { count: 'exact' })
        .contains('surahs', [name]).order('id', { ascending: true }).range(from, from + limit - 1)
    : supabase.from('automated_groups').select('id', { count: 'exact', head: true }).contains('surahs', [name])

  const [personalRes, automatedRes] = await Promise.all([personalQ, automatedQ])
  const personalCount = personalRes.count ?? 0
  const automatedCount = automatedRes.count ?? 0

  const groups = tab === 'personal'
    ? ((personalRes.data as unknown as GroupShape[]) ?? []).map((g) => ({
        ...g,
        verses: [...g.verses].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((v) => ({
          ...v,
          parts: [...v.parts].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        })),
      }))
    : []
  const automatedRows = tab === 'automated' ? ((automatedRes.data as unknown as AutomatedRow[]) ?? []) : []

  const total = tab === 'personal' ? personalCount : automatedCount
  const totalPages = Math.ceil(total / limit)
  const prevNo = surahNo > 1 ? surahNo - 1 : null
  const nextNo = names[String(surahNo + 1)] ? surahNo + 1 : null

  const tabs = [
    { key: 'personal', label: 'الشخصية', count: personalCount },
    { key: 'automated', label: 'الآلية', count: automatedCount },
  ] as const

  return (
    <div className="max-w-3xl mx-auto px-3 md:px-8 py-5 md:py-14">
      <nav className="flex items-center justify-between mb-6 text-[12px] font-bold">
        <Link href="/surahs" className="inline-flex items-center gap-1 text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] tap-shrink transition-colors">
          <span aria-hidden="true">→</span> كل السور
        </Link>
        <div className="flex items-center gap-1">
          {prevNo && (
            <Link href={`/surahs/${prevNo}`} className="px-2.5 py-1 rounded-md text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] tap-shrink transition-colors">
              → {names[String(prevNo)]}
            </Link>
          )}
          {nextNo && (
            <Link href={`/surahs/${nextNo}`} className="px-2.5 py-1 rounded-md text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] tap-shrink transition-colors">
              {names[String(nextNo)]} ←
            </Link>
          )}
        </div>
      </nav>

      <header className="mb-6">
        <p className="text-[11px] font-bold tabular-nums text-[var(--color-ink-muted)] mb-1">السورة {surahNo.toLocaleString('ar-EG')}</p>
        <h1 className="text-[26px] md:text-[34px] font-bold tracking-tight text-[var(--color-ink)] leading-none">سورة {name}</h1>
      </header>

      <div role="tablist" aria-label="نوع المتشابهات" className="flex gap-2 mb-6">
        {tabs.map((t) => {
          const active = t.key === tab
          return (
            <Link key={t.key} role="tab" aria-selected={active}
              href={t.key === 'personal' ? `/surahs/${surahNo}` : `/surahs/${surahNo}?tab=automated`}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-[13px] font-bold rounded-full tap-shrink transition-colors',
                active
                  ? 'bg-[var(--color-primary)] text-[var(--color-paper)] shadow-sm'
                  : 'bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]'
              )}>
              {t.label}
              <span className={cn('text-[11px] tabular-nums px-1.5 rounded-md', active ? 'bg-white/20' : 'bg-[var(--color-surface-2)]')}>
                {t.count.toLocaleString('ar-EG')}
              </span>
            </Link>
          )
        })}
      </div>

      {tab === 'personal' && <div className="mb-4"><ColorLegend /></div>}

      {total === 0 ? (
        <div className="py-20 text-center bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)]">
          <p className="text-[14px] text-[var(--color-ink-muted)]">
            {tab === 'personal' ? `لا توجد متشابهات شخصية في سورة ${name} بعد.` : `لا توجد مرشّحات آلية في سورة ${name}.`}
          </p>
        </div>
      ) : tab === 'personal' ? (
        <div className="divide-y divide-[var(--color-border-soft)]">
          {groups.map((g, i) => <GroupRow key={g.id} group={g} index={from + i + 1} />)}
        </div>
      ) : (
        <ol className="divide-y divide-[var(--color-border-soft)]">
          {automatedRows.map((r) => <AutomatedCard key={r.id} row={r} />)}
        </ol>
      )}

      <Pagination page={page} totalPages={totalPages} basePath={`/surahs/${surahNo}`}
        searchParams={tab === 'automated' ? { tab } : {}} />
    </div>
  )
}
