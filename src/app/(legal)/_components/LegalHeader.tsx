import Link from 'next/link'

interface LegalHeaderProps {
  lang: 'ar' | 'en'
  currentRoute: 'privacy' | 'support'
  alternateUrl: string
}

export default function LegalHeader({
  lang,
  currentRoute,
  alternateUrl,
}: LegalHeaderProps) {
  const isArabic = lang === 'ar'
  const privacyUrl = isArabic ? '/privacy' : '/privacy/en'
  const supportUrl = isArabic ? '/support' : '/support/en'

  return (
    <header className="w-full border-b border-[var(--color-border-soft)] bg-[var(--color-surface)]/95 backdrop-blur-xs sticky top-0 z-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link
          href={supportUrl}
          className="flex items-center gap-2 text-[var(--color-ink)] hover:text-[var(--color-primary)] transition-colors"
        >
          <span className="font-bold text-base sm:text-lg tracking-tight">
            {isArabic ? 'قراءات' : 'Qiraat'}
          </span>
          <span className="text-xs font-mono text-[var(--color-ink-muted)]">
            {isArabic ? 'Qiraat' : 'قراءات'}
          </span>
        </Link>

        <nav className="flex items-center gap-3 sm:gap-5 text-sm">
          <Link
            href={supportUrl}
            className={`transition-colors ${
              currentRoute === 'support'
                ? 'font-bold text-[var(--color-primary)]'
                : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
            }`}
          >
            {isArabic ? 'الدعم والمساعدة' : 'Support'}
          </Link>

          <Link
            href={privacyUrl}
            className={`transition-colors ${
              currentRoute === 'privacy'
                ? 'font-bold text-[var(--color-primary)]'
                : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
            }`}
          >
            {isArabic ? 'سياسة الخصوصية' : 'Privacy Policy'}
          </Link>

          <span className="text-[var(--color-border)] select-none" aria-hidden="true">
            |
          </span>

          <Link
            href={alternateUrl}
            className="text-xs font-medium px-2.5 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)] transition-colors"
            dir={isArabic ? 'ltr' : 'rtl'}
            title={isArabic ? 'Switch to English' : 'التحويل إلى العربية'}
          >
            {isArabic ? 'English' : 'العربية'}
          </Link>
        </nav>
      </div>
    </header>
  )
}
