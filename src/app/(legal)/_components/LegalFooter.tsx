import Link from 'next/link'

interface LegalFooterProps {
  lang: 'ar' | 'en'
}

export default function LegalFooter({ lang }: LegalFooterProps) {
  const isArabic = lang === 'ar'
  const privacyUrl = isArabic ? '/privacy' : '/privacy/en'
  const supportUrl = isArabic ? '/support' : '/support/en'

  return (
    <footer className="mt-auto border-t border-[var(--color-border-soft)] py-8 bg-[var(--color-surface)]/50 text-xs text-[var(--color-ink-muted)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-start">
          <span className="font-semibold text-[var(--color-ink-soft)]">
            {isArabic ? 'تطبيق قراءات (Qiraat)' : 'Qiraat App (قراءات)'}
          </span>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <span className="font-mono text-[11px]">com.shazlka.qiraat</span>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <span>
            {isArabic ? 'الجهة المشغلة: ' : 'Operator: '}
            <code className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border-soft)] text-[var(--color-ink)]">
              OPERATOR_NAME_TBD
            </code>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href={supportUrl}
            className="hover:text-[var(--color-ink)] transition-colors underline-offset-4 hover:underline"
          >
            {isArabic ? 'الدعم الفني' : 'Support'}
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            href={privacyUrl}
            className="hover:text-[var(--color-ink)] transition-colors underline-offset-4 hover:underline"
          >
            {isArabic ? 'سياسة الخصوصية' : 'Privacy Policy'}
          </Link>
        </div>
      </div>
    </footer>
  )
}
