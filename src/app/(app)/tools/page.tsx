import { createServerSupabaseClient } from '@/lib/supabase-server'
import BulkTagger from '@/components/BulkTagger'

export default async function ToolsPage() {
  const supabase = await createServerSupabaseClient()
  const [{ data: groups }, { data: tags }] = await Promise.all([
    supabase.from('groups').select('id, title').order('title', { ascending: true }),
    supabase.from('tags').select('id, name, color').order('name', { ascending: true }),
  ])

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-14">
      <header className="mb-10">
        <p className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-1">Tools</p>
        <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight leading-none">أدوات</h1>
        <p className="mt-2 text-[13px] text-[var(--color-ink-muted)]">عمليات جماعية على المجموعات</p>
      </header>

      <BulkTagger
        groups={(groups as { id: string; title: string }[]) || []}
        tags={(tags as { id: string; name: string; color: string | null }[]) || []} />
    </div>
  )
}
