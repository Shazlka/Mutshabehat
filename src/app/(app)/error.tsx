'use client'

import { useEffect } from 'react'

export default function AppError({
  error, reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error boundary:', error)
  }, [error])

  return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center animate-fade-rise">
      <div className="w-14 h-14 rounded-full bg-[var(--color-danger-bg)] mx-auto mb-5 flex items-center justify-center text-[var(--color-danger)] text-2xl font-bold">!</div>
      <h2 className="text-[20px] font-bold text-[var(--color-ink)]">حدث خطأ غير متوقع</h2>
      <p className="text-[13px] text-[var(--color-ink-muted)] mt-2 leading-relaxed">
        {error.message || 'لم نستطع إكمال طلبك. حاول مرة أخرى أو عُد إلى الرئيسية.'}
      </p>
      {error.digest && (
        <p className="text-[10px] font-mono text-[var(--color-ink-muted)] mt-3" dir="ltr">
          {error.digest}
        </p>
      )}
      <div className="flex items-center justify-center gap-3 mt-7">
        <button onClick={reset}
          className="px-5 py-2 text-[13px] font-bold rounded-full bg-[var(--color-primary)] text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)] tap-shrink transition-colors">
          إعادة المحاولة
        </button>
        <a href="/" className="text-[13px] text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] transition-colors">
          العودة للرئيسية
        </a>
      </div>
    </div>
  )
}
