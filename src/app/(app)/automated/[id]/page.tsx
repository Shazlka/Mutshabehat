import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSurahNumberByName } from '@/lib/quran'
import { ayahToArabic } from '@/lib/arabic'
import ArabicDiff, { type Part } from '@/components/ArabicDiff'
import AutomatedCopyButton from '@/components/AutomatedCopyButton'
import { ayahNum, CopiedBadge, type AutomatedRow } from '@/components/AutomatedCard'

export default async function AutomatedDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numericId = Number(id)
  if (!Number.isInteger(numericId) || numericId <= 0) notFound()

  const supabase = await createServerSupabaseClient()
  const [{ data }, { data: copies }] = await Promise.all([
    supabase
      .from('automated_groups')
      .select('id, title, color, surahs, payload')
      .eq('id', numericId)
      .maybeSingle(),
    supabase
      .from('groups')
      .select('id')
      .eq('source_automated_id', numericId)
      .order('created_at', { ascending: true })
      .limit(1),
  ])
  if (!data) notFound()
  const copiedGroupId = (copies as { id: string }[] | null)?.[0]?.id ?? null

  const row = data as AutomatedRow
  const verses = row.payload?.verses ?? []
  const surahs = row.surahs?.length ? row.surahs : [...new Set(verses.map((v) => v.surah).filter(Boolean) as string[])]

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-14">
      <Link href="/automated"
        className="inline-flex items-center gap-1 mb-6 text-[12px] font-bold text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] tap-shrink transition-colors">
        <span aria-hidden="true">→</span> القاعدة الآلية
      </Link>

      <header className="mb-8">
        <p className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-1">Automated #{row.id}</p>
        <div className="flex items-baseline gap-2.5">
          {row.color && (
            <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: row.color }} />
          )}
          <h1 className="text-[22px] md:text-[28px] font-bold tracking-tight leading-snug text-[var(--color-ink)]">
            {row.title}
          </h1>
        </div>
        <p className="mt-2 text-[13px] text-[var(--color-ink-muted)]">
          {verses.length.toLocaleString('ar-EG')} آية · {surahs.length.toLocaleString('ar-EG')} سورة
        </p>
        {surahs.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {surahs.map((s) => {
              const no = getSurahNumberByName(s)
              const chip = 'px-2.5 py-1 text-[11px] font-bold rounded-md bg-[var(--color-surface-2)] text-[var(--color-ink-soft)]'
              return no ? (
                <Link key={s} href={`/surahs/${no}`}
                  className={`${chip} hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] tap-shrink transition-colors`}>
                  سورة {s}
                </Link>
              ) : <span key={s} className={chip}>سورة {s}</span>
            })}
          </div>
        )}
      </header>

      <div className="mb-8">
        {copiedGroupId ? (
          <div className="flex items-center gap-3 flex-wrap p-3 rounded-xl bg-[var(--color-copied-bg)] border-s-4 border-[var(--color-copied)]">
            <CopiedBadge />
            <span className="text-[13px] text-[var(--color-ink-soft)]">هذه المجموعة موجودة في قاعدتك الشخصية.</span>
            <Link href={`/groups/${copiedGroupId}`} className="text-[13px] font-bold text-[var(--color-copied)] hover:underline">
              فتح النسخة الشخصية ←
            </Link>
          </div>
        ) : (
          <AutomatedCopyButton id={row.id} />
        )}
      </div>

      <ol className="space-y-4">
        {verses.map((v, vi) => (
          <li key={vi} className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-soft)]">
            <div className="flex items-baseline gap-2 mb-2 flex-wrap">
              <span className="text-[13px] font-bold text-[var(--color-primary)]">{v.surah ?? '—'}</span>
              <span className="text-[12px] font-mono tabular-nums text-[var(--color-ink-muted)] font-bold">
                {ayahToArabic(ayahNum(v.ayah))}
              </span>
              {v.label && <span className="text-[11px] text-[var(--color-ink-muted)]">{v.label}</span>}
            </div>
            <ArabicDiff parts={(v.parts ?? []) as Part[]} />
          </li>
        ))}
      </ol>

      {(row.payload?.note || row.payload?.unote) && (
        <section className="mt-8 p-4 rounded-xl bg-[var(--color-surface-2)] text-[13px] leading-relaxed text-[var(--color-ink-soft)] space-y-2">
          {row.payload.note && <p>{row.payload.note}</p>}
          {row.payload.unote && <p className="text-[var(--color-ink-muted)]">{row.payload.unote}</p>}
        </section>
      )}
    </div>
  )
}
