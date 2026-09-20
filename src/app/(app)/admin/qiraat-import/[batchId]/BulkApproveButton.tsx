'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function BulkApproveButton({ batchId }: { batchId: string }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const run = () => {
    startTransition(async () => {
      const res = await fetch(`/api/admin/qiraat-import/${batchId}/bulk-approve`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data.error ?? 'تعذّر الاعتماد الجماعي.')
        return
      }
      setMessage(`تم اعتماد ${data.approved ?? 0} صف صالح.`)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={pending}
        className="px-3 py-2 rounded-lg text-sm bg-emerald-600 text-white disabled:opacity-50"
      >
        {pending ? 'جارٍ الاعتماد…' : 'اعتماد كل الصفوف الصحيحة غير المكررة'}
      </button>
      {message && <span className="text-xs text-gray-500">{message}</span>}
    </div>
  )
}
