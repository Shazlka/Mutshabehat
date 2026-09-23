// Phase 4 qiraat review screen — server entry point.
//
// Not signed in -> a link to sign in. Signed in but not an allow-listed editor -> a plain
// "غير مصرح" message. Editor -> the client review screen (ReviewApp).
//
// Editor status is checked the same way the DB layer requires: through the *user's* session
// client calling `qiraat_review_is_editor()` (SECURITY DEFINER, checks the `qiraat_editors`
// allowlist server-side). Never call this through a service-role client.

import type { Metadata } from 'next'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session-user'
import ReviewApp from './_components/ReviewApp'

export const metadata: Metadata = {
  title: 'مراجعة القراءات — مصحف المدينة ١٤٤١',
  description: 'شاشة مراجعة فرش الحروف وأصول القراءات، صفحة صفحة، لمحرري القراءات العشر.',
}

type SearchParams = Promise<{ page?: string }>

const MIN_PAGE = 1
const MAX_PAGE = 604

function clampPageParam(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '1', 10)
  if (!Number.isFinite(parsed)) return 1
  return Math.min(MAX_PAGE, Math.max(MIN_PAGE, parsed))
}

function GateShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      dir="rtl"
      lang="ar"
      className="flex min-h-dvh items-center justify-center bg-[var(--color-paper)] px-4"
    >
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-sm">
        {children}
      </div>
    </main>
  )
}

export default async function QiraatReviewPage({ searchParams }: { searchParams: SearchParams }) {
  const { page } = await searchParams
  const initialPage = clampPageParam(page)

  const supabase = await createServerSupabaseClient()
  const user = await getSessionUser(supabase)

  if (!user) {
    return (
      <GateShell>
        <h1 className="mb-2 text-lg font-bold text-[var(--color-ink)]">مراجعة القراءات</h1>
        <p className="mb-4 text-sm text-[var(--color-ink-soft)]">
          يلزم تسجيل الدخول للوصول إلى شاشة مراجعة القراءات العشر.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent('/mushaf-1441/review')}`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--color-primary)] px-5 text-sm font-bold text-[var(--color-paper)] transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
        >
          تسجيل الدخول
        </Link>
      </GateShell>
    )
  }

  const { data: isEditor, error } = await supabase.rpc('qiraat_review_is_editor')

  if (error || !isEditor) {
    return (
      <GateShell>
        <p className="text-lg font-bold text-[var(--color-danger)]">غير مصرح</p>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          هذا الحساب غير مدرَج ضمن محرري القراءات العشر. تواصل مع مسؤول المشروع إن كنت تتوقع صلاحية الوصول.
        </p>
      </GateShell>
    )
  }

  return <ReviewApp initialPage={initialPage} />
}
