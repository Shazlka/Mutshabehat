'use client'

import { useEffect, useState } from 'react'

const KEY = 'mushaf1441:reading-prefs:v1'
const PHONE_AUTO_HIDE_KEY = 'mushaf1441:phone:autoHideFooter:v1'
export const SUBCATEGORY_KEY = 'mushaf1441:qiraat-show-subcategory:v1'
interface ReadingPreferences { keepAwake: boolean; autoHideFooter: boolean; showSubcategory: boolean }
const DEFAULTS: ReadingPreferences = { keepAwake: false, autoHideFooter: false, showSubcategory: false }

export function useReadingPreferences(holdFooter: boolean) {
  const [prefs, setPrefs] = useState(DEFAULTS)
  const [footerHidden, setFooterHidden] = useState(false)
  const [wakeStatus, setWakeStatus] = useState('')
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<ReadingPreferences>
      const phoneAutoHide = localStorage.getItem(PHONE_AUTO_HIDE_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrefs({ keepAwake: raw?.keepAwake === true, autoHideFooter: phoneAutoHide === null ? raw?.autoHideFooter === true : phoneAutoHide === 'true', showSubcategory: localStorage.getItem(SUBCATEGORY_KEY) === 'true' })
    } catch { /* Use defaults for unavailable or malformed storage. */ }
  }, [])
  function update(next: ReadingPreferences) {
    setPrefs(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
      localStorage.setItem(PHONE_AUTO_HIDE_KEY, String(next.autoHideFooter))
      localStorage.setItem(SUBCATEGORY_KEY, String(next.showSubcategory))
    } catch { /* The choices still apply for this visit. */ }
  }
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      setFooterHidden(false)
      clearTimeout(timer)
      if (prefs.autoHideFooter && !holdFooter) timer = setTimeout(() => setFooterHidden(true), 10_000)
    }
    reset()
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'focusin'] as const
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }))
    return () => {
      clearTimeout(timer)
      events.forEach((event) => window.removeEventListener(event, reset))
    }
  }, [prefs.autoHideFooter, holdFooter])
  useEffect(() => {
    let cancelled = false
    let pending = false
    let lock: WakeLockSentinel | undefined
    async function acquire() {
      if (!prefs.keepAwake || cancelled || pending || document.visibilityState !== 'visible' || (lock && !lock.released)) return
      if (!('wakeLock' in navigator)) { setWakeStatus('إبقاء الشاشة مضاءة غير متاح في هذا المتصفح.'); return }
      pending = true
      try {
        const next = await navigator.wakeLock.request('screen')
        if (cancelled) { await next.release(); return }
        lock = next
        setWakeStatus('الشاشة ستبقى مضاءة أثناء القراءة.')
        next.addEventListener('release', () => { if (!cancelled) setWakeStatus('توقّف إبقاء الشاشة مضاءة مؤقتًا؛ سيُعاد عند العودة للقراءة.') })
      } catch { if (!cancelled) setWakeStatus('لم يسمح المتصفح بإبقاء الشاشة مضاءة. يمكنك المحاولة بإيقاف الخيار وتشغيله.') }
      finally { pending = false }
    }
    void acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => { cancelled = true; document.removeEventListener('visibilitychange', acquire); void lock?.release().catch(() => {}) }
  }, [prefs.keepAwake])
  return { prefs, update, footerHidden: prefs.autoHideFooter && !holdFooter && footerHidden, wakeStatus: prefs.keepAwake ? wakeStatus : '' }
}
