import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import EditForm from '@/components/EditForm'

type GroupRecord = {
  id: string; title: string; color: string; status: 'draft'|'published'|'locked'
  favorite: boolean; completed: boolean; note: string | null; unote: string | null
  verses: Array<{
    id: string; surah: string; ayah: number; label: string | null; sort_order: number | null
    parts: Array<{ id: string; type: string; text: string; sort_order: number | null }>
  }>
}

export default async function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
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
    `)
    .eq('id', id)
    .single()

  if (!data) notFound()
  const group = data as unknown as GroupRecord

  // Sort nested
  group.verses = [...group.verses]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((v) => ({
      ...v,
      parts: [...v.parts].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    }))

  return <EditForm initialGroup={group} />
}
