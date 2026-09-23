import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const canonicalKey = /^\d{3}:\d{3}:\d{3}$/

async function authenticatedClient() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { supabase: null, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  return { supabase, response: null }
}

function databaseError(message: string) {
  // Keep database/RPC diagnostics in server logs. Returning raw Postgres messages leaks schema
  // details (and, for some providers, SQL fragments) to the browser.
  if (/VERSION_CONFLICT/i.test(message)) {
    console.error('[qiraat-editor] version conflict', message)
    return NextResponse.json({ error: 'VERSION_CONFLICT' }, { status: 409 })
  }
  if (/unauthorized/i.test(message)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (/invalid canonical|missing taxonomy|invalid target|invalid source|scope requires|requires identical/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 400 })
  }
  console.error('[qiraat-editor] database failure', message)
  return NextResponse.json({ error: 'Qiraat editor data is unavailable' }, { status: 503 })
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('canonicalKey')
  if (!key || !canonicalKey.test(key)) return NextResponse.json({ error: 'invalid canonical key' }, { status: 400 })
  try {
    const { supabase, response } = await authenticatedClient()
    if (response || !supabase) return response!
    const [catalog, annotations] = await Promise.all([
      supabase.rpc('qiraat_editor_catalog'),
      supabase.rpc('qiraat_editor_annotations', { p_canonical_key: key }),
    ])
    if (catalog.error) return databaseError(catalog.error.message)
    if (annotations.error) return databaseError(annotations.error.message)
    return NextResponse.json({ catalog: catalog.data, annotations: annotations.data })
  } catch (error) {
    return databaseError(error instanceof Error ? error.message : 'unknown editor error')
  }
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null)
  if (!payload || typeof payload !== 'object' || !canonicalKey.test(String(payload.startCanonicalKey ?? ''))) {
    return NextResponse.json({ error: 'valid startCanonicalKey is required' }, { status: 400 })
  }
  try {
    const { supabase, response } = await authenticatedClient()
    if (response || !supabase) return response!
    const { data, error } = await supabase.rpc('qiraat_editor_create_annotation', { p: payload })
    if (error) return databaseError(error.message)
    return NextResponse.json({ annotations: data }, { status: 201 })
  } catch (error) {
    return databaseError(error instanceof Error ? error.message : 'unknown editor error')
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  const expectedVersion = Number(request.nextUrl.searchParams.get('expectedVersion'))
  if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1) return NextResponse.json({ error: 'id and expectedVersion are required' }, { status: 400 })
  try {
    const { supabase, response } = await authenticatedClient()
    if (response || !supabase) return response!
    const { error } = await supabase.rpc('qiraat_editor_soft_delete_annotation', { p_annotation_id: id, p_expected_version: expectedVersion })
    if (error) return databaseError(error.message)
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return databaseError(error instanceof Error ? error.message : 'unknown editor error')
  }
}

export async function PATCH(request: NextRequest) {
  const payload = await request.json().catch(() => null)
  if (!payload || typeof payload !== 'object' || !payload.id || !Number.isInteger(payload.expectedVersion) || !canonicalKey.test(String(payload.startCanonicalKey ?? ''))) {
    return NextResponse.json({ error: 'id, expectedVersion, and startCanonicalKey are required' }, { status: 400 })
  }
  try {
    const { supabase, response } = await authenticatedClient()
    if (response || !supabase) return response!
    const { data, error } = await supabase.rpc('qiraat_editor_update_annotation', { p: payload })
    if (error) return databaseError(error.message)
    return NextResponse.json({ annotations: data })
  } catch (error) {
    return databaseError(error instanceof Error ? error.message : 'unknown editor error')
  }
}
