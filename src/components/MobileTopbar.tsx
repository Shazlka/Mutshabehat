'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

const NAV = [
  { href: '/',         label: 'المتشابهات' },
  { href: '/stats',    label: 'إحصائيات'  },
  { href: '/settings', label: 'إعدادات'   },
]

export default function MobileTopbar({ groupCount }: { groupCount: number }) {
  const pathname = usePathname()
  return (
    <header className="md:hidden sticky top-0 z-20 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <h1 className="text-[15px] font-bold tracking-tight">متشابهات القرآن</h1>
          <p className="text-[10px] tracking-wider text-[var(--color-ink-muted)] uppercase mt-0.5">
            Quran Similarity Explorer
          </p>
        </div>
        <span className="px-2 py-1 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-[11px] font-bold font-mono tabular-nums">
          {groupCount}
        </span>
      </div>
      <nav className="px-2 pb-2 flex gap-1.5">
        {NAV.map((item) => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex-1 text-center px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors',
                active
                  ? 'bg-[var(--color-primary)] text-[var(--color-paper)]'
                  : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]'
              )}>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
