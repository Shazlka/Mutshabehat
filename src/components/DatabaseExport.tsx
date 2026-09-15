'use client'

import { useState } from 'react'

type Format = 'json' | 'csv' | 'xlsx' | 'sql'

export default function DatabaseExport() {
  const [loading, setLoading] = useState<Format | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function download(format: Format) {
    setLoading(format); setError(null)
    try {
      const res = await fetch(`/api/groups/export?format=${format}`)
      if (!res.ok) { setError('فشل التصدير'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = format === 'sql'
        ? `mutshabehat-restore-${date}.sql`
        : `mutshabehat-export-${date}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('حدث خطأ أثناء التصدير')
    } finally {
      setLoading(null)
    }
  }

  const DownloadIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )

  const Spinner = () => (
    <span className="inline-block w-3.5 h-3.5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
  )

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-[var(--color-ink-soft)] leading-relaxed">
        صدّر جميع مجموعاتك مع الآيات والأجزاء المحفوظة. استخدم <strong>XLSX</strong> للحصول على جدول احترافي ملوّن، أو JSON للنسخ الاحتياطي الكامل.
      </p>

      <div className="flex gap-2 flex-wrap">
        {/* XLSX — primary export */}
        <button
          onClick={() => download('xlsx')}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold
                     bg-[var(--color-primary)] text-white hover:opacity-90
                     tap-shrink transition-opacity disabled:opacity-50">
          {loading === 'xlsx' ? <Spinner /> : <DownloadIcon />}
          تصدير XLSX
        </button>

        <button
          onClick={() => download('json')}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold
                     bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]
                     text-[var(--color-ink)] tap-shrink transition-colors disabled:opacity-50">
          {loading === 'json' ? <Spinner /> : <DownloadIcon />}
          تصدير JSON
        </button>

        <button
          onClick={() => download('csv')}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold
                     bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]
                     text-[var(--color-ink)] tap-shrink transition-colors disabled:opacity-50">
          {loading === 'csv' ? <Spinner /> : <DownloadIcon />}
          تصدير CSV
        </button>
      </div>

      {/* SQL backup — Supabase-compatible restore file */}
      <div className="mt-4 pt-4 border-t border-[var(--color-border-soft)] space-y-3">
        <p className="text-[13px] text-[var(--color-ink-soft)] leading-relaxed">
          <strong>نسخة احتياطية (SQL):</strong> ملف <code dir="ltr">.sql</code> متوافق مع Supabase يمكن
          إعادة رفعه عند الطوارئ لاستعادة جميع بياناتك. شغّله في
          {' '}<span dir="ltr">Supabase → SQL Editor</span>. الملف <strong>آمن لإعادة التشغيل</strong>
          {' '}(يحدّث الموجود ويستعيد المفقود)، ويجب استعادته في نفس المشروع والحساب.
        </p>
        <button
          onClick={() => download('sql')}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold
                     bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]
                     text-[var(--color-ink)] tap-shrink transition-colors disabled:opacity-50">
          {loading === 'sql' ? <Spinner /> : <DownloadIcon />}
          نسخة احتياطية SQL
        </button>
      </div>

      {error && (
        <p className="text-[12px] text-[var(--color-danger,#dc2626)]">{error}</p>
      )}
    </div>
  )
}
