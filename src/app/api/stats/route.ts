import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/stats  → dashboard counters
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [groupsCount, versesCount, partsCount, favCount, doneCount, lockedCount] = await Promise.all([
    supabase.from('groups').select('*', { count: 'exact', head: true }),
    supabase.from('verses').select('*', { count: 'exact', head: true }),
    supabase.from('parts').select('*', { count: 'exact', head: true }),
    supabase.from('groups').select('*', { count: 'exact', head: true }).eq('favorite', true),
    supabase.from('groups').select('*', { count: 'exact', head: true }).eq('completed', true),
    supabase.from('groups').select('*', { count: 'exact', head: true }).eq('status', 'locked'),
  ])

  // Surah distribution
  const { data: verses } = await supabase.from('verses').select('surah')
  const surahCounts: Record<string, number> = {}
  ;(verses || []).forEach((v) => {
    surahCounts[v.surah] = (surahCounts[v.surah] || 0) + 1
  })
  const topSurahs = Object.entries(surahCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([surah, count]) => ({ surah, count }))

  return NextResponse.json({
    counts: {
      groups:    groupsCount.count ?? 0,
      verses:    versesCount.count ?? 0,
      parts:     partsCount.count  ?? 0,
      favorites: favCount.count    ?? 0,
      completed: doneCount.count   ?? 0,
      locked:    lockedCount.count ?? 0,
    },
    topSurahs,
  })
}
