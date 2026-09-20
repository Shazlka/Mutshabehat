import Link from 'next/link'
import { exportPage, pageCoverage, qaBlocking } from '@/lib/qiraat-admin'

export const dynamic = 'force-dynamic'

type Entry = {
  id: string
  kind: 'variant' | 'ruling'
  status: string
  locus: { surah: number; startAyah: number; startWord: number; baseText: string }
  variant?: { readingText?: string }
  ruling?: { categoryAr?: string }
  readingIds?: string[]
  flags?: { severity: string; issue: string }[]
}

export default async function QiraatDatabaseBrowser({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, Math.min(604, Number(sp.page) || 1))
  const [data, coverage, blocking] = await Promise.all([
    exportPage(page, true),
    pageCoverage(),
    qaBlocking(),
  ])
  const entries = (data?.entries ?? []) as Entry[]
  const variants = entries.filter((e) => e.kind === 'variant')
  const rulings = entries.filter((e) => e.kind === 'ruling')

  const pagesImported = new Set(coverage.map((c) => c.mushaf_page_number)).size

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-bold mb-1">قاعدة بيانات القراءات — تصفّح</h1>
      <p className="text-sm text-gray-500 mb-4">
        يعرض ما هو موجود فعليًا في PostgreSQL (عبر <code>qiraat_export_page()</code>)، بما في ذلك
        السجلات غير المنشورة بعد للمراجعة الداخلية.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6 text-center text-sm">
        <div className="border rounded p-3">
          <div className="text-xl font-bold">{pagesImported} / 604</div>
          <div className="text-gray-500 text-xs">صفحات مستوردة</div>
        </div>
        <div className="border rounded p-3">
          <div className="text-xl font-bold">{variants.length + rulings.length}</div>
          <div className="text-gray-500 text-xs">سجلات في الصفحة الحالية</div>
        </div>
        <div className={`border rounded p-3 ${blocking.length ? 'border-red-400' : ''}`}>
          <div className={`text-xl font-bold ${blocking.length ? 'text-red-600' : 'text-emerald-600'}`}>
            {blocking.length}
          </div>
          <div className="text-gray-500 text-xs">مشكلات حاجبة (qiraat_qa_blocking)</div>
        </div>
      </div>

      <form className="flex items-center gap-2 mb-6" action="/admin/qiraat-database">
        <label className="text-sm">الصفحة:</label>
        <input type="number" name="page" min={1} max={604} defaultValue={page} className="border rounded px-2 py-1 w-24 text-sm" />
        <button className="px-3 py-1.5 border rounded text-sm">عرض</button>
        <div className="flex-1" />
        {page > 1 && <Link className="text-sm hover:underline" href={`/admin/qiraat-database?page=${page - 1}`}>الصفحة السابقة</Link>}
        {page < 604 && <Link className="text-sm hover:underline" href={`/admin/qiraat-database?page=${page + 1}`}>الصفحة التالية</Link>}
        <Link className="text-sm text-[var(--color-accent,#80662c)] hover:underline" href={`/mushaf-1441?page=${page}`} target="_blank">
          فتح في عارض المصحف ↗
        </Link>
      </form>

      <Section title={`القراءات (Farsh) — ${variants.length}`}>
        {variants.map((e) => (
          <Row key={e.id} entry={e}>
            <span dir="rtl">{e.locus.baseText}</span>
            <span className="text-gray-400 mx-1">←</span>
            <span dir="rtl">{e.variant?.readingText}</span>
          </Row>
        ))}
      </Section>

      <Section title={`الأصول (Rulings) — ${rulings.length}`}>
        {rulings.map((e) => (
          <Row key={e.id} entry={e}>
            <span dir="rtl">{e.locus.baseText}</span>
            <span className="text-gray-400 mx-2">—</span>
            <span dir="rtl">{e.ruling?.categoryAr}</span>
          </Row>
        ))}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="font-semibold mb-2">{title}</h2>
      <div className="border rounded-lg divide-y">{children}</div>
    </div>
  )
}

function Row({ entry, children }: { entry: Entry; children: React.ReactNode }) {
  const statusColor =
    entry.status === 'PUBLISHED' || entry.status === 'VERIFIED' ? 'text-emerald-600' : 'text-amber-600'
  return (
    <div className="p-2 text-sm flex items-center justify-between gap-2">
      <div className="flex-1">
        سورة {entry.locus.surah}:{entry.locus.startAyah} — {children}
      </div>
      <span className={`text-xs ${statusColor}`}>{entry.status}</span>
      {!!entry.flags?.length && <span className="text-xs text-red-600">⚑ {entry.flags.length}</span>}
    </div>
  )
}
