import { createClient } from '@supabase/supabase-js'
import { resilientFetch } from '@/lib/resilient-fetch'

/** Server-only access to the متون tables (closed to the browser roles; the API is the gatekeeper). */
export function mutoonConfigured(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL
}

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: resilientFetch },
  })
}

export type MutoonRpcError = { status: 400 | 404 | 409 | 503; message: string }
export type MutoonRpcResult<T> = { data: T; error?: undefined } | { data?: undefined; error: MutoonRpcError }

/** Calls one of the qiraat_mutoon_* functions and turns the database's answer into an HTTP-shaped result. */
export async function mutoonRpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<MutoonRpcResult<T>> {
  try {
    const { data, error, status } = await admin().rpc(fn, args)
    if (!error) return { data: data as T }
    if (error.code === 'PT409' || status === 409 || error.code === '23505') return { error: { status: 409, message: 'تغيّر هذا البيت من مكان آخر؛ حُدّث بأحدث نسخة' } }
    if (error.code === 'PT400') return { error: { status: 400, message: 'طلب غير صالح' } }
    // 42883 = function missing, 42P01 = table missing: the migration has not been applied yet.
    if (error.code === '42883' || error.code === '42P01' || error.code === 'PGRST202') {
      console.error('[mutoon] database objects are missing; apply supabase/migrations/20261028150000_qiraat_mutoon_rows.sql', error.message)
      return { error: { status: 503, message: 'قاعدة بيانات المتون لم تُهيّأ بعد' } }
    }
    console.error('[mutoon] rpc failed', fn, error.code, error.message)
    return { error: { status: 503, message: 'تعذر الوصول إلى قاعدة البيانات' } }
  } catch (e) {
    console.error('[mutoon] rpc threw', fn, e instanceof Error ? e.message : e)
    return { error: { status: 503, message: 'تعذر الوصول إلى قاعدة البيانات' } }
  }
}
