import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session-user'
import GroupDetail from '@/components/GroupDetail'
import GroupBrowseNav from '@/components/GroupBrowseNav'
import GroupMobileBottomBar from '@/components/GroupMobileBottomBar'
import BackButton from '@/components/BackButton'
import PrefetchNeighbours from '@/components/PrefetchNeighbours'
import SwipeNavWrapper from '@/components/SwipeNavWrapper'

type GroupRecord = {
  id: string; title: string; color: string | null
  status: 'draft'|'published'|'locked'
  favorite: boolean; completed: boolean
  note: string | null; unote: string | null
  created_at: string
  verses: Array<{
    id: string; surah: string; ayah: number; label: string | null
    sort_order: number | null
    parts: Array<{ id: string; type: string; text: string; sort_order: number | null }>
  }>
}

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  // Round-trip 1 — all three in parallel:
  //   a) auth  (usually free — React.cache dedupes with layout's call)
  //   b) group scalar fields
  //   c) verses for this group
  const [
    user,
    { data: groupRaw },
    { data: versesRaw },
  ] = await Promise.all([
    getSessionUser(supabase),
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
  //   a) parts for all verses  (needs verseIds from round-trip 1)
  //   b+c) next/prev neighbours  (need created_at from round-trip 1)
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
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-6 md:py-10 pb-28 md:pb-28">
      {/* Desktop: slim top toolbar — back + edit only */}
      <div className="hidden md:flex sticky top-0 -mx-8 px-8 py-3 mb-6 bg-[var(--color-paper)]/95 backdrop-blur-sm border-b border-[var(--color-border)] z-10 items-center justify-between gap-3">
        <BackButton className="text-[13px] font-bold text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] tap-shrink transition-colors" />
        <Link href={`/groups/${group.id}/edit`}
          className="px-4 py-1.5 text-[13px] font-bold rounded-full bg-[var(--color-primary)] text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)] tap-shrink transition-colors shadow-sm">
          تعديل
        </Link>
      </div>

      {/* On mobile: wrap GroupDetail in swipe-to-navigate (left=next, right=prev in RTL) */}
      <SwipeNavWrapper prevGroupId={prevGroupId} nextGroupId={nextGroupId}>
        <GroupDetail group={group} />
      </SwipeNavWrapper>

      {/* Pre-warm the router cache for both neighbours so tapping is instant */}
      <PrefetchNeighbours
        prev={prevGroupId ? `/groups/${prevGroupId}` : null}
        next={nextGroupId ? `/groups/${nextGroupId}` : null}
      />

      {/* Mobile: full-width bottom bar — 5 large tap-target cells */}
      <GroupMobileBottomBar id={group.id} prevGroupId={prevGroupId} nextGroupId={nextGroupId} />

      {/* Desktop: fixed bottom navigation strip — always visible without scrolling */}
      <div
        className="hidden md:block fixed bottom-0 left-0 right-0 z-20 bg-[var(--color-paper)]/95 backdrop-blur-sm border-t border-[var(--color-border)]"
      >
        <div className="max-w-3xl mx-auto px-8 py-3">
          <GroupBrowseNav id={group.id} prevGroupId={prevGroupId} nextGroupId={nextGroupId} />
        </div>
      </div>
    </div>
  )
}
