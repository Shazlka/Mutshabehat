import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase-server'
import { bulkApproveValid, QiraatAdminError } from '@/lib/qiraat-admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 })
  const { batchId } = await params
  const page = req.nextUrl.searchParams.get('page')
  try {
    const approved = await bulkApproveValid(batchId, user.email || user.id, page ? Number(page) : undefined)
    return NextResponse.json({ approved })
  } catch (e) {
    const status = e instanceof QiraatAdminError ? e.status : 500
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status })
  }
}
