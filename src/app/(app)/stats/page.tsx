import { createServerSupabaseClient } from '@/lib/supabase-server'
import CountUp from '@/components/CountUp'
import TagDonut from '@/components/TagDonut'
import ActivityChart from '@/components/ActivityChart'
import JuzHeatmap from '@/components/JuzHeatmap'
import { getSurahNumberByName } from '@/lib/quran'
import { juzOfSurah } from '@/lib/juz'

export default async function StatsPage() {
  const supabase = await createServerSupabaseClient()

  const [groupsRes, versesRes, partsRes, favRes, doneRes, lockedRes] = await Promise.all([
    supabase.from('groups').select('*', { count: 'exact', head: true }),
    supabase.from('verses').select('*', { count: 'exact', head: true }),
    supabase.from('parts').select('*', { count: 'exact', head: true }),
    supabase.from('groups').select('*', { count: 'exact', head: true }).eq('favorite', true),
    supabase.from('groups').select('*', { count: 'exact', head: true }).eq('completed', true),
    supabase.from('groups').select('*', { count: 'exact', head: true }).eq('status', 'locked'),
  ])

  // Surah distribution
  const { data: verseList } = await supabase.from('verses').select('surah')
  const surahCounts: Record<string, number> = {}
  ;(verseList || []).forEach((v: { surah: string }) => {
    surahCounts[v.surah] = (surahCounts[v.surah] || 0) + 1
  })
  const top = Object.entries(surahCounts).sort((a, b) => b[1] - a[1]).slice(0, 12)
  const maxCount = top[0]?.[1] || 1

  // Parts breakdown
  const { data: partsList } = await supabase.from('parts').select('type')
  const partsBreakdown: Record<string, number> = {}
  ;(partsList || []).forEach((p: { type: string }) => {
    partsBreakdown[p.type] = (partsBreakdown[p.type] || 0) + 1
  })
  const totalParts = partsRes.count ?? 0

  const PART_META: Record<string, { label: string; varName: string }> = {
    shared:   { label: 'مشترك',   varName: '--color-shared'   },
    diff:     { label: 'اختلاف',  varName: '--color-diff'     },
    diff2:    { label: 'اختلاف ٢', varName: '--color-diff2'    },
    diff3:    { label: 'اختلاف ٣', varName: '--color-diff3'    },
    addition: { label: 'زيادة',   varName: '--color-addition' },
    unique:   { label: 'فريد',    varName: '--color-unique'   },
    normal:   { label: 'عادي',    varName: '--color-ink-muted'},
  }

  // Tags distribution
  const { data: tagsList } = await supabase.from('tags').select('id, name, color')
  const { data: gtList }   = await supabase.from('group_tags').select('tag_id')
  const tagCounts = new Map<string, number>()
  ;(gtList || []).forEach((r: { tag_id: string }) => {
    tagCounts.set(r.tag_id, (tagCounts.get(r.tag_id) || 0) + 1)
  })
  const tagSlices = (tagsList || [])
    .map((t: { id: string; name: string; color: string | null }) => ({
      ...t, count: tagCounts.get(t.id) || 0,
    }))
    .filter((s: { count: number }) => s.count > 0)
    .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
  const totalTagUses = tagSlices.reduce((s: number, t: { count: number }) => s + t.count, 0)

  // Activity — count groups updated per day, last 30 days
  const { data: updates } = await supabase.from('groups').select('updated_at')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayMs = 24 * 60 * 60 * 1000
  const days: { date: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * dayMs)
    days.push({ date: d.toISOString().slice(0, 10), count: 0 })
  }
  const dayIndex = new Map(days.map((d, i) => [d.date, i]))
  ;(updates || []).forEach((g: { updated_at: string | null }) => {
    if (!g.updated_at) return
    const key = g.updated_at.slice(0, 10)
    const idx = dayIndex.get(key)
    if (idx !== undefined) days[idx].count++
  })

  // Juz heatmap — count groups per juz (a group counts once per juz its verses touch)
  const { data: verseGroups } = await supabase.from('verses').select('surah, group_id')
  const juzGroupSet: Set<string>[] = Array.from({ length: 30 }, () => new Set())
  ;(verseGroups || []).forEach((v: { surah: string; group_id: string }) => {
    const sno = getSurahNumberByName(v.surah)
    if (!sno) return
    const j = juzOfSurah(sno)
    juzGroupSet[j - 1].add(v.group_id)
  })
  const juzCounts = juzGroupSet.map((s) => s.size)

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-14 animate-fade-in">
      <header className="mb-10">
        <p className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-1">Dashboard</p>
        <h1 className="text-[28px] md:text-[36px] font-bold tracking-tight leading-none">إحصائيات</h1>
        <p className="mt-2 text-[13px] text-[var(--color-ink-muted)]">نظرة عامة على مكتبتك</p>
      </header>

      {/* Hero */}
      <section className="mb-14 p-8 md:p-10 rounded-2xl bg-[var(--color-primary)] text-[var(--color-paper)] relative overflow-hidden animate-scale-pop">
        <div aria-hidden="true"
             className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full opacity-25 blur-3xl"
             style={{ background: 'oklch(0.70 0.20 50)' }} />
        <div className="relative">
          <div className="text-[10px] tracking-widest opacity-70 uppercase mb-2">إجمالي المجموعات</div>
          <div className="text-[80px] md:text-[120px] font-bold tracking-tight leading-none tabular-nums">
            <CountUp to={groupsRes.count ?? 0} />
          </div>
          <div className="text-[14px] opacity-80 mt-4">
            تشمل <span className="font-bold tabular-nums"><CountUp to={versesRes.count ?? 0} duration={1100} /></span> آية
            و <span className="font-bold tabular-nums"><CountUp to={partsRes.count ?? 0} duration={1300} /></span> جزء نصّي
          </div>
        </div>
      </section>

      {/* Sub-stats */}
      <section className="mb-14 grid grid-cols-3 gap-4">
        {[
          { label: 'مفضّلة ★', value: favRes.count ?? 0, fg: '--color-warn',    bg: '--color-warn-bg' },
          { label: 'مكتملة ✓', value: doneRes.count ?? 0, fg: '--color-success', bg: '--color-success-bg' },
          { label: 'مقفلة 🔒', value: lockedRes.count ?? 0, fg: '--color-ink-soft', bg: '--color-surface' },
        ].map((s, i) => (
          <div key={i} className="p-5 rounded-xl border animate-fade-rise"
            style={{ background: `var(${s.bg})`, borderColor: `oklch(from var(${s.fg}) l c h / 0.2)`, animationDelay: `${i * 80}ms` }}>
            <div className="text-[10px] tracking-widest uppercase mb-2 font-bold" style={{ color: `var(${s.fg})` }}>{s.label}</div>
            <div className="text-[36px] font-bold tabular-nums leading-none" style={{ color: `var(${s.fg})` }}>
              <CountUp to={s.value} duration={700 + i * 120} />
            </div>
          </div>
        ))}
      </section>

      {/* 30-day activity */}
      <section className="mb-14 p-6 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-soft)]">
        <h2 className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-3 font-bold">
          النشاط
        </h2>
        <ActivityChart days={days} />
      </section>

      {/* Juz heatmap */}
      <section className="mb-14">
        <h2 className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-5 font-bold">
          توزيع المتشابهات على أجزاء القرآن
        </h2>
        <JuzHeatmap juzCounts={juzCounts} />
      </section>

      {/* Tag donut */}
      {tagSlices.length > 0 && (
        <section className="mb-14">
          <h2 className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-5 font-bold">
            توزيع الوسوم
          </h2>
          <TagDonut slices={tagSlices} total={totalTagUses} />
        </section>
      )}

      {/* Parts breakdown */}
      <section className="mb-14">
        <h2 className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-5 font-bold">
          توزيع الأجزاء حسب النوع
        </h2>
        <ol className="space-y-3">
          {Object.entries(partsBreakdown).sort((a, b) => b[1] - a[1]).map(([type, count], i) => {
            const meta = PART_META[type] ?? { label: type, varName: '--color-ink-muted' }
            const pct = totalParts ? (count / totalParts) * 100 : 0
            return (
              <li key={type} className="flex items-center gap-3 animate-fade-rise" style={{ animationDelay: `${i * 60}ms` }}>
                <span className="w-20 text-[12px] font-bold shrink-0" style={{ color: `var(${meta.varName})` }}>{meta.label}</span>
                <div className="flex-1 h-2.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700 ease-out"
                       style={{ width: `${pct}%`, background: `var(${meta.varName})` }} />
                </div>
                <span className="text-[12px] tabular-nums font-mono text-[var(--color-ink-muted)] w-20 text-left">
                  {count} <span className="text-[10px]">({pct.toFixed(0)}%)</span>
                </span>
              </li>
            )
          })}
        </ol>
      </section>

      {/* Top surahs */}
      <section>
        <h2 className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-5 font-bold">
          أكثر السور تكراراً
        </h2>
        <ol className="space-y-3">
          {top.map(([surah, count], i) => (
            <li key={surah} className="flex items-center gap-3 animate-fade-rise" style={{ animationDelay: `${i * 50}ms` }}>
              <span className="text-[13px] text-[var(--color-ink)] w-24 shrink-0 font-bold">{surah}</span>
              <div className="flex-1 h-2.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-700 ease-out"
                     style={{ width: `${(count / maxCount) * 100}%` }} />
              </div>
              <span className="text-[12px] tabular-nums font-mono text-[var(--color-ink-muted)] w-10 text-left">{count}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
