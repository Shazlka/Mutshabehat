'use client'

import { useEffect, useState } from 'react'

export const SWIPE_NAV_PRIORITY_KEY = 'mutshabehat-swipe-nav-priority'
export const SWIPE_NAV_PRIORITY_EVENT = 'mutshabehat-swipe-nav-priority-change'

export function isSwipeNavPriorityEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(SWIPE_NAV_PRIORITY_KEY) === '1'
  } catch {
    return false
  }
}

export default function SwipeNavigationSetting() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(isSwipeNavPriorityEnabled())
  }, [])

  function update(next: boolean) {
    setEnabled(next)
    try {
      if (next) localStorage.setItem(SWIPE_NAV_PRIORITY_KEY, '1')
      else localStorage.removeItem(SWIPE_NAV_PRIORITY_KEY)
      window.dispatchEvent(new Event(SWIPE_NAV_PRIORITY_EVENT))
    } catch {}
  }

  return (
    <div className="space-y-3">
      <label className="flex items-start justify-between gap-4 border-b border-[var(--color-border-soft)] pb-4">
        <span>
          <span className="block text-[14px] font-bold text-[var(--color-ink)]">
            السحب يميناً ويساراً للتنقل بين المجموعات
          </span>
          <span className="mt-1 block text-[12px] leading-relaxed text-[var(--color-ink-soft)]">
            عند التفعيل، تعرض الشاشة الرئيسية مجموعة واحدة في كل مرة، وتعطي صفحات المجموعة أولوية للسحب الأفقي للانتقال إلى السابقة أو التالية.
          </span>
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => update(e.target.checked)}
          className="mt-1 h-5 w-5 accent-[var(--color-primary)]"
        />
      </label>
      <p className="text-[11px] text-[var(--color-ink-muted)] leading-relaxed">
        إذا أردت الرجوع إلى القائمة العمودية المعتادة، أوقف هذا الخيار مؤقتاً.
      </p>
    </div>
  )
}
