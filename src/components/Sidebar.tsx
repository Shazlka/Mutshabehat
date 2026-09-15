'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

const NAV = [
  { href: '/',          label: 'المتشابهات',  count: 'groups' as const },
  { href: '/automated', label: 'الآلية',      count: null },
  { href: '/surahs',    label: 'السور',       count: null },
  { href: '/network',   label: 'شبكة السور',  count: null },
  { href: '/stats',     label: 'إحصائيات',   count: null },
  { href: '/tools',     label: 'أدوات',      count: null },
  { href: '/settings',  label: 'إعدادات',    count: null },
]

interface Props {
  email: string
  groupCount: number
}

export default function Sidebar({ email, groupCount }: Props) {
  const pathname = usePathname()
  return (
    <aside
      aria-label="القائمة الرئيسية"
      className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface-2)] animate-fade-in">
      {/* Brand */}
      <Link href="/" className="px-6 pt-7 pb-6 hover:bg-[var(--color-surface)] transition-colors group">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)] text-[var(--color-paper)] flex items-center justify-center text-[18px] font-bold shadow-sm group-hover:scale-105 transition-transform duration-200">
            ق
          </div>
          <div>
            <h1 className="text-[15px] font-bold tracking-tight text-[var(--color-ink)] leading-none">
              متشابهات القرآن
            </h1>
            <p className="text-[9px] mt-1 text-[var(--color-ink-muted)] tracking-widest uppercase">
              Similarity Explorer
            </p>
          </div>
        </div>
      </Link>

      {/* Nav */}
      <nav aria-label="التنقل بين الصفحات" className="px-3 flex-1">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))
            return (
              <li key={item.href}>
                <Link href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] tap-shrink transition-colors duration-150',
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

      {/* User strip */}
      <div className="px-3 pb-3 pt-2 border-t border-[var(--color-border-soft)]">
        <div className="px-3 py-2 text-[11px] text-[var(--color-ink-muted)] truncate" dir="ltr" title={email}>
          {email}
        </div>
      </div>
    </aside>
  )
}
