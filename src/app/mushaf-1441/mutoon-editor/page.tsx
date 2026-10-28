import type { Metadata } from 'next'
import Link from 'next/link'
import MutoonEditor from './MutoonEditor'

export const metadata: Metadata = { title: 'تحرير المتون — القراءات العشر' }

export default function MutoonEditorPage() {
  return <main dir="rtl" lang="ar" className="min-h-dvh bg-[var(--color-paper)] text-[var(--color-ink)]">
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold">تحرير المتون</h1><p className="text-sm text-[var(--color-ink-soft)]">الشاطبية · الدرة · طيبة النشر</p></div>
        <Link href="/mushaf-1441/review" className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm">مراجعة القراءات</Link>
      </div>
    </header>
    <MutoonEditor />
  </main>
}
