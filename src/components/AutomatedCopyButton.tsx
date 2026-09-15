'use client'

import { useState } from 'react'
import Link from 'next/link'

// Copies one automated candidate into the personal database.
export default function AutomatedCopyButton({ id }: { id: number }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function copy() {
    setState('busy'); setMessage('')
    try {
      const res = await fetch('/api/automated/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automated_ids: [id] }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.copied) { setState('done'); setMessage('تم النسخ إلى قاعدتك الشخصية') }
      else { setState('error'); setMessage(j.error || 'تعذّر النسخ') }
    } catch {
      setState('error'); setMessage('تعذّر الاتصال')
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button type="button" onClick={copy} disabled={state === 'busy' || state === 'done'}
        className="px-4 py-2 text-[13px] font-bold rounded-xl bg-[var(--color-primary)] text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60 tap-shrink transition-colors">
        {state === 'busy' ? 'جارٍ النسخ…' : state === 'done' ? 'تم النسخ ✓' : 'نسخ إلى الشخصية'}
      </button>
      {message && (
        <span role="status" className="text-[12px] font-bold"
              style={{ color: state === 'error' ? 'var(--color-danger)' : 'var(--color-success)' }}>
          {message}
        </span>
      )}
      {state === 'done' && (
        <Link href="/" className="text-[12px] font-bold text-[var(--color-primary)] hover:underline">
          فتح المتشابهات
        </Link>
      )}
    </div>
  )
}
