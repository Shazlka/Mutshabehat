'use client'

import { useRef, useState } from 'react'

export default function TagToolbox() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const text = await f.text()
      const json = JSON.parse(text)
      const res = await fetch('/api/tags/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
      const j = await res.json()
      if (res.ok) setStatus({ ok: true, msg: `تم استيراد ${j.tagsCreated} وسماً و ${j.linksCreated} ارتباطاً` })
      else        setStatus({ ok: false, msg: j.error || 'فشل الاستيراد' })
    } catch (err) {
      setStatus({ ok: false, msg: 'ملف غير صالح. يجب أن يكون JSON صادر من نفس التطبيق.' })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a href="/api/tags/export?format=json" download
          className="inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-paper)] tap-shrink transition-colors">
          تصدير JSON
        </a>
        <a href="/api/tags/export?format=csv" download
          className="inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold rounded-full bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)] tap-shrink transition-colors">
          تصدير CSV
        </a>
        <button type="button" onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold rounded-full bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)] tap-shrink transition-colors">
          استيراد JSON
        </button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
      </div>

      {status && (
        <p role="status" aria-live="polite"
          className="text-[12px] px-3 py-2 rounded-md font-bold animate-fade-rise"
          style={{
            color:      status.ok ? 'var(--color-success)' : 'var(--color-danger)',
            background: status.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
          }}>
          {status.msg}
        </p>
      )}
    </div>
  )
}
