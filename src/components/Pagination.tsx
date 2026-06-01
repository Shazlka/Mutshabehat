import Link from 'next/link'
import { cn } from '@/lib/cn'

interface Props {
  page: number
  totalPages: number
  searchParams: Record<string, string>
}

function buildHref(params: Record<string, string>, newPage: number): string {
  const p = new URLSearchParams(params)
  p.set('page', String(newPage))
  return `/?${p.toString()}`
}

export default function Pagination({ page, totalPages, searchParams }: Props) {
  if (totalPages <= 1) return null

  const pages: (number | '…')[] = []
  // Smart pagination: always show first, last, current, and neighbors
  const window = 2
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= window) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…')
    }
  }

  return (
    <nav className="flex items-center justify-center gap-1 mt-12 mb-4" aria-label="ترقيم الصفحات">
      {page > 1 && (
        <Link href={buildHref(searchParams, page - 1)}
          className="px-3 py-1.5 text-[12px] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors">
          → السابقة
        </Link>
      )}
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-2 text-[var(--color-ink-muted)]">…</span>
        ) : (
          <Link key={p} href={buildHref(searchParams, p)}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`الصفحة ${p}`}
            className={cn(
              'min-w-[36px] h-9 inline-flex items-center justify-center text-[12px] rounded-md tabular-nums tap-shrink transition-all duration-150',
              p === page
                ? 'bg-[var(--color-primary)] text-[var(--color-paper)] font-bold shadow-sm shadow-[var(--color-primary)]/20'
                : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]'
            )}>
            {p}
          </Link>
        )
      )}
      {page < totalPages && (
        <Link href={buildHref(searchParams, page + 1)}
          className="px-3 py-1.5 text-[12px] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors">
          التالية ←
        </Link>
      )}
    </nav>
  )
}
