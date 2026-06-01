'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

const NAV = [
  { href: '/',          label: 'المتشابهات',  count: 'groups' as const },
  { href: '/automated', label: 'الآلية',      count: null },
  { href: '/network',   label: 'شبكة السور',  count: null },
  { href: '/stats',     label: 'إحصائيات',   count: null },
  { href: '/tools',     label: 'أدوات',      count: null },
  { href: '/settings',  label: 'إعدادات',    count: null },
]

interface Props {
  email: string
  groupCount: number
}

export default function MobileTopbar({ email, groupCount }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Auto-close drawer on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Prevent scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <header className="md:hidden sticky top-0 z-20 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Burger Button */}
          <button
            onClick={() => setOpen(true)}
            aria-label="فتح القائمة الرئيسية"
            aria-expanded={open}
            className="p-1.5 rounded-lg text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] transition-colors touch-target-sm flex items-center justify-center cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          
          <div>
            <h1 className="text-[15px] font-bold tracking-tight text-[var(--color-ink)]">متشابهات القرآن</h1>
            <p className="text-[9px] tracking-wider text-[var(--color-ink-muted)] uppercase mt-0.5">
              Similarity Explorer
            </p>
          </div>
        </div>

        <span className="px-2 py-1 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-[11px] font-bold font-mono tabular-nums">
          {groupCount}
        </span>
      </header>

      {/* Drawer Overlay */}
      <div
        className={cn(
          "md:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity duration-300",
          open ? "opacity-100 animate-fade-in" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        className={cn(
          "md:hidden fixed top-0 right-0 bottom-0 w-72 max-w-[80vw] bg-[var(--color-surface-2)] border-l border-[var(--color-border)] z-50 shadow-2xl transition-transform duration-300 ease-out flex flex-col",
          open ? "translate-x-0" : "translate-x-full"
        )}
        dir="rtl"
      >
        {/* Drawer Header */}
        <div className="px-5 pt-7 pb-5 border-b border-[var(--color-border-soft)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] text-[var(--color-paper)] flex items-center justify-center text-[16px] font-bold shadow-sm">
              ق
            </div>
            <div>
              <h2 className="text-[14px] font-bold tracking-tight text-[var(--color-ink)] leading-none">
                متشابهات القرآن
              </h2>
              <p className="text-[8px] mt-1 text-[var(--color-ink-muted)] tracking-widest uppercase">
                Similarity Explorer
              </p>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={() => setOpen(false)}
            aria-label="إغلاق القائمة"
            className="p-1 rounded-md text-[var(--color-ink-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] tap-shrink transition-colors cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer Nav links */}
        <nav aria-label="التنقل بين الصفحات" className="px-3 py-4 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {NAV.map((item) => {
              const active = pathname === item.href
              return (
                <li key={item.href}>
                  <Link href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center justify-between px-3 py-3 rounded-lg text-[13px] font-bold tap-shrink transition-colors duration-150',
                      active
                        ? 'bg-[var(--color-primary)] text-[var(--color-paper)] font-bold shadow-sm'
                        : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]'
                    )}>
                    <span>{item.label}</span>
                    {item.count === 'groups' && (
                      <span className={cn(
                        'text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-md transition-colors',
                        active
                          ? 'bg-white/20 text-[var(--color-paper)]'
                          : 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                      )}>
                        {groupCount}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User strip & Signout at bottom */}
        <div className="px-3 pb-6 pt-3 border-t border-[var(--color-border-soft)] bg-[var(--color-surface)]">
          <div className="px-3 py-2 text-[11px] text-[var(--color-ink-muted)] truncate" dir="ltr" title={email}>
            {email}
          </div>
          <form action="/auth/signout" method="POST">
            <button type="submit"
              className="w-full text-right px-3 py-2 rounded-md text-[12px] font-bold text-[var(--color-ink-soft)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)] tap-shrink transition-colors cursor-pointer">
              تسجيل الخروج
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
