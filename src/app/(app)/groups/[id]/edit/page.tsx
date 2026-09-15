import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import EditForm from '@/components/EditForm'
import PrefetchNeighbours from '@/components/PrefetchNeighbours'

type GroupRecord = {
  id: string; title: string; color: string; status: 'draft'|'published'|'locked'
  favorite: boolean; completed: boolean; note: string | null; unote: string | null
  created_at: string
  verses: Array<{
    id: string; surah: string; ayah: number; label: string | null; sort_order: number | null
    parts: Array<{ id: string; type: string; text: string; sort_order: number | null }>
  }>
}

export default async function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  // Round-trip 1 — all three in parallel:
  //   a) auth  (usually free — React.cache dedupes with layout's call)
  //   b) group scalar fields
  //   c) verses for this group
  const [
    { data: { user } },
    { data: groupRaw },
    { data: versesRaw },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('groups')
      .select('id, title, color, status, favorite, completed, note, unote, created_at')
      .eq('id', id)
      .single(),
    supabase.from('verses')
      .select('id, surah, ayah, label, sort_order')
      .eq('group_id', id)
      .order('sort_order', { ascending: true }),
  ])

  if (!groupRaw) notFound()

  const verseIds = (versesRaw || []).map((v) => v.id)

  // Round-trip 2 — all four in parallel:
  //   a) parts for all verses  (needs verseIds)
  //   b+c) next/prev neighbours  (need created_at)
  const [
    { data: partsRaw },
    { data: nextRow },
    { data: prevRow },
  ] = await Promise.all([
    verseIds.length > 0
      ? supabase.from('parts')
          .select('id, type, text, sort_order, verse_id')
          .in('verse_id', verseIds)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] as Array<{ id: string; type: string; text: string; sort_order: number | null; verse_id: string }> }),
    user
      ? supabase.from('groups').select('id').eq('user_id', user.id)
          .lt('created_at', groupRaw.created_at)
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from('groups').select('id').eq('user_id', user.id)
          .gt('created_at', groupRaw.created_at)
          .order('created_at', { ascending: true }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const nextGroupId: string | null = (nextRow as { id: string } | null)?.id ?? null
  const prevGroupId: string | null = (prevRow as { id: string } | null)?.id ?? null

  // Assemble group with sorted verses + parts
  const group: GroupRecord = {
    ...groupRaw,
    verses: (versesRaw || [])
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((v) => ({
        ...v,
        parts: (partsRaw || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((p: any) => p.verse_id === v.id)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      })),
  }

  return (
    <>
      <EditForm initialGroup={group} nextGroupId={nextGroupId} prevGroupId={prevGroupId} />
      {/* Pre-warm the editor routes for both neighbours so save-and-go is instant */}
      <PrefetchNeighbours
        prev={prevGroupId ? `/groups/${prevGroupId}/edit` : null}
        next={nextGroupId ? `/groups/${nextGroupId}/edit` : null}
      />
    </>
  )
}
