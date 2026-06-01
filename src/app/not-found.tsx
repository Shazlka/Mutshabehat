import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md animate-fade-rise">
        <div className="text-[120px] font-bold leading-none text-[var(--color-primary)] tabular-nums">404</div>
        <h1 className="text-[20px] font-bold text-[var(--color-ink)] mt-4">الصفحة غير موجودة</h1>
        <p className="text-[13px] text-[var(--color-ink-muted)] mt-2 leading-relaxed">
          الرابط الذي طلبته لا يقابل أي صفحة في التطبيق.
        </p>
        <Link href="/"
          className="inline-block mt-6 px-5 py-2 text-[13px] font-bold rounded-full bg-[var(--color-primary)] text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)] tap-shrink transition-colors">
          العودة للرئيسية
        </Link>
      </div>
    </main>
  )
}
