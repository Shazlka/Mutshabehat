import { createServerSupabaseClient } from '@/lib/supabase-server'
import NetworkGraph from '@/components/NetworkGraph'

export default async function NetworkPage() {
  const supabase = await createServerSupabaseClient()

  // Build co-occurrence: surahs that appear in the same group are linked.
  const { data: verseGroups } = await supabase.from('verses').select('surah, group_id')

  type V = { surah: string; group_id: string }
  const surahByGroup = new Map<string, Set<string>>()
  ;((verseGroups as V[]) || []).forEach((v) => {
    if (!surahByGroup.has(v.group_id)) surahByGroup.set(v.group_id, new Set())
    surahByGroup.get(v.group_id)!.add(v.surah)
  })

  // Count nodes (surah occurrences) and edges (co-occurrences)
  const surahCount = new Map<string, number>()
  const edgeCount  = new Map<string, { source: string; target: string; weight: number }>()

  for (const surahs of surahByGroup.values()) {
    const arr = [...surahs]
    arr.forEach((s) => surahCount.set(s, (surahCount.get(s) || 0) + 1))
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const [a, b] = [arr[i], arr[j]].sort()
        const key = `${a}|${b}`
        const e = edgeCount.get(key)
        if (e) e.weight++
        else   edgeCount.set(key, { source: a, target: b, weight: 1 })
      }
    }
  }

  const nodes = [...surahCount.entries()].map(([id, count]) => ({ id, count }))
  const edges = [...edgeCount.values()]

  return (
    <div className="max-w-6xl mx-auto px-3 md:px-6 py-6 md:py-10">
      <header className="mb-8 px-2">
        <p className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-1">Network</p>
        <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight leading-none">
          شبكة السور
        </h1>
        <p className="mt-2 text-[13px] text-[var(--color-ink-muted)]">
          {nodes.length} سورة • {edges.length} ارتباط — كل خط يربط سورتين ظهرتا في نفس المجموعة
        </p>
      </header>
      <NetworkGraph nodes={nodes} edges={edges} />
    </div>
  )
}
