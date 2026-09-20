'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const ACTIONS: { key: string; label: string; className: string }[] = [
  { key: 'approve', label: 'اعتماد', className: 'bg-emerald-600 text-white' },
  { key: 'reject', label: 'رفض', className: 'bg-red-600 text-white' },
  { key: 'needs_correction', label: 'يحتاج تصحيحًا', className: 'bg-amber-500 text-white' },
  { key: 'needs_mapping', label: 'يحتاج ربطًا يدويًا', className: 'bg-amber-500 text-white' },
  { key: 'reset', label: 'إعادة التعيين', className: 'bg-gray-200 text-gray-700' },
]

export default function RowActions({ rowId }: { rowId: number }) {
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const act = (action: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/admin/qiraat-import/rows/${rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: note || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      setMessage(res.ok ? 'تم الحفظ.' : (data.error ?? 'حدث خطأ.'))
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="border-t pt-4 space-y-3">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="ملاحظة المراجعة (اختياري)"
        className="w-full border rounded p-2 text-sm"
        rows={2}
        dir="rtl"
      />
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            disabled={pending}
            onClick={() => act(a.key)}
            className={`px-3 py-2 rounded-lg text-sm disabled:opacity-50 ${a.className}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {message && <p className="text-xs text-gray-500">{message}</p>}
    </div>
  )
}
