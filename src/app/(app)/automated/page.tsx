import { createServerSupabaseClient } from '@/lib/supabase-server'
import AutomatedList from '@/components/AutomatedList'

type SP = Promise<{ page?: string; q?: string; surah?: string }>

export default async function AutomatedPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const page  = Math.max(1, parseInt(sp.page ?? '1', 10))
  const limit = 20
  const from = (page - 1) * limit
  const to   = from + limit - 1
  const q     = (sp.q ?? '').trim()
  const surah = (sp.surah ?? '').trim()

  const supabase = await createServerSupabaseClient()

  // Not-yet-copied candidates first; ones already copied to personal go to the end.
  let query = supabase
    .from('automated_groups_with_copy')
    .select('id, title, color, surahs, payload, copied', { count: 'exact' })
    .order('copied', { ascending: true })
    .order('id', { ascending: true })
    .range(from, to)

  if (q)     query = query.ilike('title', `%${q}%`)
  if (surah) query = query.contains('surahs', [surah])

  const { data, count } = await query

  const total = count ?? 0
  const totalPages = Math.ceil(total / limit)

  type Row = {
    id: number; title: string; color: string; surahs: string[]; copied: boolean
    payload: { verses?: { surah?: string; ayah?: number|string; label?: string; parts?: { type: string; text: string }[] }[] }
  }
  const rows = (data as Row[]) || []

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-14">
      <header className="mb-8">
        <p className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-1">Automated DB</p>
        <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight leading-none">
          القاعدة الآلية
        </h1>
        <p className="mt-2 text-[13px] text-[var(--color-ink-muted)]">
          {total.toLocaleString('ar-EG')} مجموعة مرشّحة — اختر ما يهمّك ونسخه إلى قاعدتك الشخصية
        </p>
      </header>

      <AutomatedList
        rows={rows}
        page={page}
        totalPages={totalPages}
        q={q}
        surah={surah} />
    </div>
  )
}
