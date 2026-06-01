'use client'

import { useState } from 'react'

// Build identifier set at build time — bump on each deploy via vercel.json or env.
// We surface it so the user knows which version they're on.
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'dev'

export default function ClearCacheButton() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function clearAndReload() {
    if (busy) return
    setBusy(true); setStatus('جارٍ المسح…')
    try {
      // 1. Clear Cache API (service workers, fetch caches)
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      // 2. Unregister any service workers
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
      // 3. Clear web storage (localStorage / sessionStorage)
      try { localStorage.clear() } catch {}
      try { sessionStorage.clear() } catch {}

      setStatus('تم المسح. جارٍ إعادة التحميل…')
      // 4. Hard reload — bypass cache. Append a cache-buster so any
      //    intermediate proxies refetch from origin.
      const url = new URL(window.location.href)
      url.searchParams.set('_v', String(Date.now()))
      // Use replace so the cache-buster doesn't pollute history
      window.location.replace(url.toString())
    } catch (e) {
      setStatus(`فشل المسح: ${(e as Error).message}`)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-[var(--color-ink-soft)] leading-relaxed">
        إذا واجهت سلوكاً غريباً أو لم تظهر آخر تحديثات، امسح التخزين المؤقت
        وأعد التحميل من المصدر.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={clearAndReload} disabled={busy} type="button"
          className="inline-flex items-center gap-2 px-4 py-2 text-[12px] font-bold rounded-full
                     bg-[var(--color-primary)] text-[var(--color-paper)]
                     hover:bg-[var(--color-primary-hover)] disabled:opacity-50
                     tap-shrink transition-colors shadow-sm">
          {busy ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round" className="animate-spin" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
          )}
          {busy ? 'جارٍ المسح…' : 'مسح وإعادة التحميل'}
        </button>
        <span className="text-[10px] font-mono text-[var(--color-ink-muted)] tabular-nums" dir="ltr">
          build: {BUILD_ID.slice(0, 8)}
        </span>
      </div>
      {status && (
        <p role="status" aria-live="polite"
          className="text-[11px] font-bold animate-fade-rise">
          {status}
        </p>
      )}
    </div>
  )
}
