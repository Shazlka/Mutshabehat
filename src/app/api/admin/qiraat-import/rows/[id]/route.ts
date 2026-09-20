import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase-server'
import { setRowReviewStatus, editRowNormalized, QiraatAdminError } from '@/lib/qiraat-admin'

const ALLOWED_ACTIONS = new Set(['approve', 'reject', 'needs_correction', 'needs_mapping', 'reset'])
const ACTION_TO_STATUS: Record<string, string> = {
  approve: 'approved', reject: 'rejected', needs_correction: 'needs_correction',
  needs_mapping: 'needs_mapping', reset: 'pending',
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
  const { id } = await params
  const rowId = Number(id)
  const body = await req.json().catch(() => ({}))

  try {
    if (body.action) {
      if (!ALLOWED_ACTIONS.has(body.action)) {
        return NextResponse.json({ error: 'إجراء غير معروف.' }, { status: 400 })
      }
      await setRowReviewStatus(rowId, ACTION_TO_STATUS[body.action], user.email || user.id, body.note)
    }
    if (body.edits && typeof body.edits === 'object') {
      await editRowNormalized(rowId, body.edits, user.email || user.id)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const status = e instanceof QiraatAdminError ? e.status : 500
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status })
  }
}
