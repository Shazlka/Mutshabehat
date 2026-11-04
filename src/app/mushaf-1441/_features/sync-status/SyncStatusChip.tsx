'use client'

import { useEffect, useState } from 'react'
import { syncStatus, type SyncOutcome } from '../../../../../packages/qiraat-core/features/syncStatus'

// How fresh the Qiraat data of the page is: «محدّث الآن» / «محدّث قبل ٥ دقائق» / «نسخة محلية». The glyph and the
// words carry the state, the tint only reinforces it. Re-evaluated every 30 s so «قبل N دقيقة» does not go stale.
export function SyncStatusChip({ outcome, lastSuccess }: { outcome: SyncOutcome | null; lastSuccess: number | null }) {
  const [now, setNow] = useState(() => Date.now())
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000)
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.clearInterval(tick); window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  const status = syncStatus({ outcome, lastSuccess, now, offline })
  const tone = status.kind === 'current' ? 'ok' : status.kind === 'confirmed' ? 'info' : 'warn'
  return (
    <span
      role="status"
      data-testid="sync-status"
      data-kind={status.kind}
      aria-label={offline ? `${status.title} — بلا اتصال` : status.title}
      className="inline-flex min-h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-bold"
      style={{ color: `var(--qx-${tone}-ink)`, borderColor: `var(--qx-${tone}-ink)`, background: `var(--qx-${tone}-bg)` }}
    >
      <span aria-hidden="true">{status.symbol}</span>
      {status.title}
    </span>
  )
}
