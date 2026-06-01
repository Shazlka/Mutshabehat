import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import GroupDetail from '@/components/GroupDetail'

type GroupRecord = {
  id: string; title: string; color: string
  status: 'draft'|'published'|'locked'
  favorite: boolean; completed: boolean
  note: string | null; unote: string | null
  verses: Array<{
    id: string; surah: string; ayah: number; label: string | null
    sort_order: number | null
    parts: Array<{ id: string; type: string; text: string; sort_order: number | null }>
  }>
}

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data } = await supabase
    .from('groups')
    .select(`
      id, title, color, status, favorite, completed, note, unote,
      verses (
        id, surah, ayah, label, sort_order,
        parts ( id, type, text, sort_order )
      )
    `).eq('id', id).single()

  if (!data) notFound()
  const group = data as unknown as GroupRecord

  group.verses = [...group.verses]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((v) => ({
      ...v,
      parts: [...v.parts].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    }))

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-6 md:py-10">
      <div className="sticky top-0 -mx-5 md:-mx-8 px-5 md:px-8 py-3 mb-6 bg-[var(--color-paper)]/95 backdrop-blur-sm border-b border-[var(--color-border)] z-10 flex items-center justify-between">
        <Link href="/"
          className="text-[13px] font-bold text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] tap-shrink transition-colors">
          ← العودة
        </Link>
        <Link href={`/groups/${group.id}/edit`}
          className="px-4 py-1.5 text-[13px] font-bold rounded-full bg-[var(--color-primary)] text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)] tap-shrink transition-colors shadow-sm">
          تعديل
        </Link>
      </div>

      <GroupDetail group={group} />
    </div>
  )
}
