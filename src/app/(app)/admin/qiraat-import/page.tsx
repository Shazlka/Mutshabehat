import Link from 'next/link'
import { listBatches } from '@/lib/qiraat-admin'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  UPLOADED: 'مرفوع', PARSED: 'مُحلَّل', VALIDATED: 'مُتحقَّق منه', REVIEWING: 'قيد المراجعة',
  APPROVED: 'معتمد', PUBLISHED: 'منشور', FAILED: 'فشل', ROLLED_BACK: 'تراجُع',
}

export default async function QiraatImportDashboard() {
  const batches = await listBatches()

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-bold mb-1">استيراد القراءات — لوحة الدُفعات</h1>
      <p className="text-sm text-[var(--color-muted,#6b7280)] mb-6">
        كل ملف Excel يوضع في <code>data/qiraat/import/</code> ويُستورد عبر{' '}
        <code>npm run qiraat:import</code> يظهر هنا كدُفعة مستقلة. لا شيء يصل إلى المصحف قبل
        المراجعة والاعتماد والنشر.
      </p>

      {batches.length === 0 ? (
        <div className="border border-dashed rounded-lg p-8 text-center text-sm text-gray-500">
          لا توجد دُفعات بعد. ضع ملفات Excel في <code>data/qiraat/import/</code> ثم شغّل{' '}
          <code>npm run qiraat:import:dry</code> للمعاينة، أو <code>npm run qiraat:import</code>{' '}
          للتحميل إلى جداول المراجعة.
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map((b) => (
            <Link
              key={b.id}
              href={`/admin/qiraat-import/${b.id}`}
              className="block border rounded-lg p-4 hover:border-[var(--color-accent,#80662c)] transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-mono text-xs text-gray-400">{b.id}</span>
                  <span className="mx-2 px-2 py-0.5 rounded text-xs bg-gray-100">
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(b.created_at).toLocaleString('ar')}
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center text-xs">
                <Card label="إجمالي" value={b.rows_total} />
                <Card label="صحيح" value={b.rows_valid} tone="ok" />
                <Card label="تحذير" value={b.rows_warning} tone="warn" />
                <Card label="خطأ" value={b.rows_error} tone="error" />
                <Card label="مكرر" value={b.rows_duplicate} />
                <Card label="غير محلول" value={b.rows_unresolved} tone="warn" />
                <Card label="معتمد" value={b.rows_approved} tone="ok" />
                <Card label="منشور" value={b.rows_published} tone="ok" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Card({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' | 'error' }) {
  const color = tone === 'ok' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : tone === 'error' ? 'text-red-600' : 'text-gray-700'
  return (
    <div className="border rounded p-2">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-gray-500">{label}</div>
    </div>
  )
}
