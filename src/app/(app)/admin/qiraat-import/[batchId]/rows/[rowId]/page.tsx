import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getRow } from '@/lib/qiraat-admin'
import RowActions from './RowActions'

export const dynamic = 'force-dynamic'

export default async function RowDetail({
  params,
}: {
  params: Promise<{ batchId: string; rowId: string }>
}) {
  const { batchId, rowId } = await params
  const row = await getRow(Number(rowId))
  if (!row || row.batch_id !== batchId) notFound()

  const n = row.normalized as Record<string, unknown>
  const anchor = n.anchor as Record<string, unknown> | null

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto" dir="rtl">
      <Link href={`/admin/qiraat-import/${batchId}`} className="text-sm text-gray-500 hover:underline">
        ← دُفعة {batchId.slice(0, 8)}
      </Link>
      <h1 className="text-xl font-bold mt-2 mb-1">
        سجل #{row.id} — {row.source_file} :: {row.source_sheet} :: صف {row.source_row}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        الحالة: <b>{row.validation_status}</b> · المراجعة: <b>{row.review_status}</b> · التكرار: {row.duplicate_status}
      </p>

      {row.validation_messages?.length > 0 && (
        <div className="mb-6 border rounded-lg p-3 bg-amber-50 text-sm space-y-1">
          {row.validation_messages.map((m, i) => (
            <div key={i}>
              <span className={m.level === 'error' ? 'text-red-700 font-semibold' : 'text-amber-700 font-semibold'}>
                [{m.level}] {m.code}
              </span>{' '}
              — {m.detail}
            </div>
          ))}
        </div>
      )}

      {row.production_conflict && (
        <div className="mb-6 border border-red-300 rounded-lg p-3 bg-red-50 text-sm">
          <b>تعارض مع بيانات منشورة سابقًا:</b>
          <pre className="mt-1 text-xs overflow-x-auto" dir="ltr">{JSON.stringify(row.production_conflict, null, 2)}</pre>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Panel title="المصدر (Excel، كما هو)">
          <pre className="text-xs overflow-x-auto whitespace-pre-wrap" dir="rtl">
            {JSON.stringify(row.raw_row, null, 2)}
          </pre>
        </Panel>
        <Panel title="السجل المعياري (بعد التطبيع)">
          <pre className="text-xs overflow-x-auto whitespace-pre-wrap" dir="rtl">
            {JSON.stringify(n, null, 2)}
          </pre>
        </Panel>
        <Panel title="الربط بالمصحف 1441">
          {anchor ? (
            <div className="text-sm space-y-1">
              <div>سورة {String(anchor.surah)} — آية {String(anchor.startAyah)}</div>
              <div>كلمة {String(anchor.startWord)}{anchor.endWord !== anchor.startWord ? ` — ${String(anchor.endWord)}` : ''}</div>
              <div className="text-lg" dir="rtl">{String(anchor.baseText)}</div>
              {typeof n.mushaf_page === 'number' && (
                <Link
                  href={`/mushaf-1441?page=${n.mushaf_page}`}
                  target="_blank"
                  className="inline-block mt-2 text-xs text-[var(--color-accent,#80662c)] hover:underline"
                >
                  فتح صفحة {String(n.mushaf_page)} في عارض المصحف ↗
                </Link>
              )}
            </div>
          ) : (
            <div className="text-sm text-red-600">
              لم يُعثر على مطابقة للنص الأساس على هذه الصفحة — يحتاج ربطًا يدويًا.
            </div>
          )}
        </Panel>
      </div>

      <RowActions rowId={row.id} />
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-3">
      <div className="text-xs font-semibold text-gray-500 mb-2">{title}</div>
      {children}
    </div>
  )
}
