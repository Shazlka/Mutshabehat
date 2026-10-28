import type { Metadata } from 'next'
import Link from 'next/link'
import MutoonEditor from './MutoonEditor'

export const metadata: Metadata = { title: 'تحرير المتون والقراءات — الشاطبية والدرة والطيبة' }

export default function MutoonEditorPage() {
  return (
    <main dir="rtl" lang="ar" className="min-h-dvh bg-[var(--color-paper)] text-[var(--color-ink)] flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
        <div className="mx-auto flex max-w-[1920px] items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/mushaf-1441/review"
              className="text-xs font-bold text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            >
              ← رجوع لمراجعة القراءات
            </Link>
            <span className="text-[var(--color-border)]">|</span>
            <h1 className="text-xs md:text-sm font-bold">محرر شواهد المتون والقراءات العشر المباشر</h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/mushaf-1441/mutoon"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-ink-soft)] hover:bg-[var(--color-paper)]"
            >
              API المباشر (JSON)
            </a>
          </div>
        </div>
      </header>
      <MutoonEditor />
    </main>
  )
}
