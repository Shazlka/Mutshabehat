import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBatch, listRows, batchSummaryCards } from '@/lib/qiraat-admin'
import BulkApproveButton from './BulkApproveButton'

export const dynamic = 'force-dynamic'

const VALIDATION_BADGE: Record<string, string> = {
  valid: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
}
const REVIEW_LABEL: Record<string, string> = {
  pending: 'بانتظار المراجعة', approved: 'معتمد', rejected: 'مرفوض',
  needs_correction: 'يحتاج تصحيحًا', needs_mapping: 'يحتاج ربطًا يدويًا', published: 'منشور',
}

export default async function BatchDetail({
  params, searchParams,
}: {
  params: Promise<{ batchId: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { batchId } = await params
  const sp = await searchParams
  const batch = await getBatch(batchId)
  if (!batch) notFound()

  const page = Math.max(1, Number(sp.p) || 1)
  const limit = 50
  const filters = {
    validation_status: sp.validation, review_status: sp.review, duplicate_status: sp.dup,
    page: sp.page ? Number(sp.page) : undefined, surah: sp.surah ? Number(sp.surah) : undefined,
    search: sp.q, limit, offset: (page - 1) * limit,
  }
  const { rows, total } = await listRows(batchId, filters)

  const qs = (overrides: Record<string, string | undefined>) => {
    const merged = { ...sp, ...overrides, p: overrides.p ?? '1' }
    const params = new URLSearchParams()
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v) })
    return `?${params.toString()}`
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto" dir="rtl">
      <Link href="/admin/qiraat-import" className="text-sm text-gray-500 hover:underline">
        ← كل الدُفعات
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">دُفعة {batch.id.slice(0, 8)}</h1>
      <p className="text-sm text-gray-500 mb-4">المصدر: <code>{batch.source_dir}</code> · الحالة: {batch.status}</p>

      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 text-center text-xs mb-6">
        {(await batchSummaryCards(batch)).map((c) => (
          <div key={c.label} className="border rounded p-2">
            <div className="text-lg font-bold">{c.value}</div>
            <div className="text-gray-500">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <BulkApproveButton batchId={batchId} />
        <div className="border rounded-lg px-3 py-2 text-xs bg-gray-50 flex-1 min-w-[280px]">
          <div className="font-semibold mb-1">للنشر إلى قاعدة البيانات الدائمة (يُشغَّل محليًا حيث توجد صلاحية psql):</div>
          <code className="block bg-white border rounded px-2 py-1 select-all">
            npm run qiraat:publish -- --batch {batch.id}
          </code>
          <div className="mt-1 text-gray-500">
            تأكد من نسخة احتياطية أولًا: <code>npm run qiraat:backup-db</code>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <FilterLink label="الكل" href={qs({ validation: undefined })} active={!sp.validation} />
        <FilterLink label="صحيح" href={qs({ validation: 'valid' })} active={sp.validation === 'valid'} />
        <FilterLink label="تحذير" href={qs({ validation: 'warning' })} active={sp.validation === 'warning'} />
        <FilterLink label="خطأ" href={qs({ validation: 'error' })} active={sp.validation === 'error'} />
        <span className="mx-1 text-gray-300">|</span>
        <FilterLink label="بانتظار المراجعة" href={qs({ review: 'pending' })} active={sp.review === 'pending'} />
        <FilterLink label="معتمد" href={qs({ review: 'approved' })} active={sp.review === 'approved'} />
        <FilterLink label="مرفوض" href={qs({ review: 'rejected' })} active={sp.review === 'rejected'} />
        <FilterLink label="يحتاج ربطًا" href={qs({ review: 'needs_mapping' })} active={sp.review === 'needs_mapping'} />
        <span className="mx-1 text-gray-300">|</span>
        <FilterLink label="مكرر" href={qs({ dup: 'exact_duplicate' })} active={sp.dup === 'exact_duplicate'} />
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <Th>الحالة</Th><Th>المراجعة</Th><Th>الملف</Th><Th>الورقة</Th><Th>الصف</Th>
              <Th>الصفحة</Th><Th>السورة:الآية</Th><Th>النص الأساس</Th><Th>القراءة</Th><Th>تكرار</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const n = r.normalized as Record<string, unknown>
              return (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded ${VALIDATION_BADGE[r.validation_status]}`}>
                      {r.validation_status}
                    </span>
                  </td>
                  <td className="p-2">{REVIEW_LABEL[r.review_status] ?? r.review_status}</td>
                  <td className="p-2 truncate max-w-[120px]">{r.source_file}</td>
                  <td className="p-2">{r.source_sheet}</td>
                  <td className="p-2">{r.source_row}</td>
                  <td className="p-2">{String(n.mushaf_page ?? '—')}</td>
                  <td className="p-2">{String(n.surah_number ?? '—')}:{String(n.ayah_from ?? '—')}</td>
                  <td className="p-2" dir="rtl">
                    <Link href={`/admin/qiraat-import/${batchId}/rows/${r.id}`} className="hover:underline">
                      {String(n.base_text_raw ?? '—')}
                    </Link>
                  </td>
                  <td className="p-2" dir="rtl">{String(n.variant_text ?? '')}</td>
                  <td className="p-2">{r.duplicate_status !== 'none' ? '✓' : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4 text-sm">
        <span className="text-gray-500">{total} صف — صفحة {page} من {Math.max(1, Math.ceil(total / limit))}</span>
        <div className="flex gap-2">
          {page > 1 && <Link className="hover:underline" href={qs({ p: String(page - 1) })}>السابق</Link>}
          {page * limit < total && <Link className="hover:underline" href={qs({ p: String(page + 1) })}>التالي</Link>}
        </div>
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="p-2 text-right font-semibold text-gray-600">{children}</th>
}
function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link href={href} className={`px-2 py-1 rounded border ${active ? 'bg-black text-white' : 'bg-white text-gray-600'}`}>
      {label}
    </Link>
  )
}
