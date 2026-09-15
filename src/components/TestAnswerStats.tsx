import Link from 'next/link'
import { ayahToArabic } from '@/lib/arabic'

export type TestAnswerStatsData = {
  total: number
  correct: number
  wrong: number
  byKind: { source: string; kind: string; correct: number; wrong: number }[]
}

const KIND_LABEL: Record<string, string> = { mcq: 'اختيار الموضع', words: 'الكلمات المتشابهة', flash: 'بطاقات الاستذكار' }
const SOURCE_LABEL: Record<string, string> = { personal: 'مجموعاتي', quran: 'القرآن كاملًا' }

// Test-mode results on the statistics tab: right vs wrong overall and per test type.
export default function TestAnswerStats({ stats }: { stats: TestAnswerStatsData }) {
  const accuracy = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0

  return (
    <section className="mb-14">
      <div className="flex items-baseline justify-between gap-3 mb-5">
        <h2 className="text-[11px] tracking-widest text-[var(--color-ink-muted)] uppercase font-bold">نتائج الاختبارات</h2>
        <Link href="/test" className="text-[12px] font-bold text-[var(--color-primary)] hover:underline">ابدأ اختبارًا</Link>
      </div>

      {stats.total === 0 ? (
        <p className="p-6 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-soft)] text-[13px] text-[var(--color-ink-muted)]">
          لم تُجب عن أي سؤال بعد. نتائج كل اختبار تُحفظ هنا تلقائيًا.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'صحيحة ✓', value: ayahToArabic(stats.correct), fg: '--color-success', bg: '--color-success-bg' },
              { label: 'خاطئة ✗', value: ayahToArabic(stats.wrong), fg: '--color-danger', bg: '--color-danger-bg' },
              { label: 'نسبة الصواب', value: `${ayahToArabic(accuracy)}٪`, fg: '--color-primary', bg: '--color-primary-soft' },
            ].map((card) => (
              <div key={card.label} className="p-5 rounded-xl border"
                style={{ background: `var(${card.bg})`, borderColor: `oklch(from var(${card.fg}) l c h / 0.2)` }}>
                <div className="text-[11px] font-bold mb-2" style={{ color: `var(${card.fg})` }}>{card.label}</div>
                <div className="text-[30px] md:text-[36px] font-bold tabular-nums leading-none" style={{ color: `var(${card.fg})` }}>{card.value}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-[var(--color-ink-muted)]">من {ayahToArabic(stats.total)} سؤالًا</p>

          {stats.byKind.length > 0 && (
            <ol className="mt-6 space-y-3">
              {stats.byKind.map((row) => {
                const rowTotal = row.correct + row.wrong
                const correctPct = rowTotal ? (row.correct / rowTotal) * 100 : 0
                return (
                  <li key={`${row.source}-${row.kind}`} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="w-full sm:w-44 shrink-0 text-[12px] font-bold text-[var(--color-ink)]">
                      {KIND_LABEL[row.kind] ?? row.kind}
                      <span className="font-normal text-[var(--color-ink-muted)]"> · {SOURCE_LABEL[row.source] ?? row.source}</span>
                    </span>
                    <div className="flex-1 flex h-2.5 rounded-full overflow-hidden bg-[var(--color-surface-2)]"
                      role="img" aria-label={`صحيح ${row.correct}، خطأ ${row.wrong}`}>
                      <div className="h-full bg-[var(--color-success)]" style={{ width: `${correctPct}%` }} />
                      <div className="h-full bg-[var(--color-danger)]" style={{ width: `${100 - correctPct}%` }} />
                    </div>
                    <span className="text-[12px] tabular-nums text-[var(--color-ink-muted)] w-24 text-left">
                      <span className="text-[var(--color-success)] font-bold">{ayahToArabic(row.correct)}</span>
                      {' / '}
                      <span className="text-[var(--color-danger)] font-bold">{ayahToArabic(row.wrong)}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </>
      )}
    </section>
  )
}
