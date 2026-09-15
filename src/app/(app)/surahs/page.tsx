import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSurahNames } from '@/lib/quran'
import { cn } from '@/lib/cn'

type CountRow = { surah: string; cnt: number }

function toMap(rows: CountRow[] | null): Record<string, number> {
  return Object.fromEntries((rows ?? []).map((r) => [r.surah, Number(r.cnt)]))
}

export default async function SurahsPage() {
  const supabase = await createServerSupabaseClient()
  const [{ data: personalRows }, { data: automatedRows }] = await Promise.all([
    supabase.from('surah_counts').select('surah, cnt'),
    supabase.from('automated_surah_counts').select('surah, cnt'),
  ])
  const personal = toMap(personalRows as CountRow[] | null)
  const automated = toMap(automatedRows as CountRow[] | null)

  const surahs = Object.entries(getSurahNames())
    .map(([no, name]) => ({ no: Number(no), name, personal: personal[name] ?? 0, automated: automated[name] ?? 0 }))
    .sort((a, b) => a.no - b.no)
  const withPersonal = surahs.filter((s) => s.personal > 0).length

  return (
    <div className="max-w-5xl mx-auto px-3 md:px-8 py-5 md:py-14">
      <header className="mb-6 md:mb-10">
        <h1 className="text-[22px] md:text-[32px] font-bold tracking-tight text-[var(--color-ink)] leading-none">السور</h1>
        <p className="mt-1.5 md:mt-2 text-[12px] md:text-[13px] text-[var(--color-ink-muted)]">
          {withPersonal.toLocaleString('ar-EG')} سورة فيها متشابهات شخصية · اختر سورة لعرض كل متشابهاتها
        </p>
      </header>

      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 md:gap-3">
        {surahs.map((s) => {
          const empty = s.personal === 0 && s.automated === 0
          return (
            <li key={s.no}>
              <Link href={`/surahs/${s.no}`}
                className={cn(
                  'flex flex-col gap-2 h-full p-3 md:p-4 rounded-xl border tap-shrink transition-colors',
                  empty
                    ? 'bg-[var(--color-surface-2)] border-[var(--color-border-soft)] opacity-70 hover:opacity-100'
                    : 'bg-[var(--color-surface)] border-[var(--color-border-soft)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]'
                )}>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 shrink-0 rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-[11px] font-bold tabular-nums flex items-center justify-center">
                    {s.no.toLocaleString('ar-EG')}
                  </span>
                  <span className="text-[15px] font-bold text-[var(--color-ink)] truncate">{s.name}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-bold">
                  <span className={cn('px-2 py-0.5 rounded-md tabular-nums',
                    s.personal ? 'bg-[var(--color-shared-bg)] text-[var(--color-shared)]' : 'text-[var(--color-ink-muted)]')}>
                    شخصية {s.personal.toLocaleString('ar-EG')}
                  </span>
                  <span className={cn('px-2 py-0.5 rounded-md tabular-nums',
                    s.automated ? 'bg-[var(--color-surface-2)] text-[var(--color-ink-soft)]' : 'text-[var(--color-ink-muted)]')}>
                    آلية {s.automated.toLocaleString('ar-EG')}
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
