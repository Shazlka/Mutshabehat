import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const canonicalKey = /^\d{3}:\d{3}:\d{3}$/

async function authenticatedClient() {
  const supabase = await createServerSupabaseClient()
  let { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const email = process.env.AUTOLOGIN_EMAIL
    const password = process.env.AUTOLOGIN_PASSWORD
    if (email && password) {
      try {
        const signInRes = await supabase.auth.signInWithPassword({ email, password })
        if (signInRes.data?.user) {
          user = signInRes.data.user
        }
      } catch {
        // Continue even if auth call fails
      }
    }
  }

  // Never block the owner from any device as requested
  return { supabase, response: null }
}

function databaseError(message: string) {
  // Keep database/RPC diagnostics in server logs. Returning raw Postgres messages leaks schema
  // details (and, for some providers, SQL fragments) to the browser.
  if (/VERSION_CONFLICT/i.test(message)) {
    console.error('[qiraat-editor] version conflict', message)
    return NextResponse.json({ error: 'VERSION_CONFLICT' }, { status: 409 })
  }
  if (/COPY_CONFLICT/i.test(message)) return NextResponse.json({ error: 'COPY_CONFLICT' }, { status: 409 })
  if (/unauthorized/i.test(message)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (/invalid canonical|missing taxonomy|invalid target|invalid source|scope requires|requires identical/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 400 })
  }
  console.error('[qiraat-editor] database failure', message)
  return NextResponse.json({ error: 'Qiraat editor data is unavailable' }, { status: 503 })
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('canonicalKey')
  const sourceId = request.nextUrl.searchParams.get('sourceId')
  if ((!key || !canonicalKey.test(key)) && !sourceId) return NextResponse.json({ error: 'invalid canonical key' }, { status: 400 })
  try {
    const { supabase, response } = await authenticatedClient()
    if (response || !supabase) return response!
    if (sourceId) {
      const { data, error } = await supabase.rpc('qiraat_editor_occurrences', { p_source_id: sourceId })
      if (error) return databaseError(error.message)
      return NextResponse.json({ occurrences: data })
    }
    if (request.nextUrl.searchParams.get('verified') === '1') {
      const { data, error } = await supabase.rpc('qiraat_editor_verified_matches', { p_canonical_key: key! })
      if (error) return databaseError(error.message)
      return NextResponse.json({ matches: data })
    }
    const [catalog, annotations] = await Promise.all([
      request.nextUrl.searchParams.get('catalog') === '0'
        ? Promise.resolve({ data: null, error: null })
        : supabase.rpc('qiraat_editor_catalog'),
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
  if (payload?.action === 'apply-occurrences') {
    if (!payload.sourceId || !Array.isArray(payload.keys) || payload.keys.some((key: unknown) => typeof key !== 'string' || !canonicalKey.test(key))) {
      return NextResponse.json({ error: 'invalid occurrence selection' }, { status: 400 })
    }
    try {
      const { supabase, response } = await authenticatedClient()
      if (response || !supabase) return response!
      const { data, error } = await supabase.rpc('qiraat_editor_apply_occurrences', { p_source_id: payload.sourceId, p_keys: payload.keys })
      if (error) return databaseError(error.message)
      return NextResponse.json({ result: data })
    } catch (error) { return databaseError(error instanceof Error ? error.message : 'unknown apply error') }
  }
  if (!payload || typeof payload !== 'object' || !canonicalKey.test(String(payload.startCanonicalKey ?? ''))) {
    return NextResponse.json({ error: 'valid startCanonicalKey is required' }, { status: 400 })
  }
  try {
    const { supabase, response } = await authenticatedClient()
    if (response || !supabase) return response!
    const { data, error } = await supabase.rpc('qiraat_editor_create_annotation_v2', { p: payload })
    if (error) return databaseError(error.message)
    return NextResponse.json({ annotations: data?.annotations, result: data?.result }, { status: data?.result === 'existing' ? 200 : 201 })
  } catch (error) {
    return databaseError(error instanceof Error ? error.message : 'unknown editor error')
  }
}

export async function DELETE(request: NextRequest) {
  if (request.nextUrl.searchParams.get('bulk') === '1') {
    const payload = await request.json().catch(() => null)
    if (!Array.isArray(payload?.items) || payload.items.length < 1 || payload.items.length > 200 || payload.items.some((item: { id?: unknown; expectedVersion?: unknown }) =>
      typeof item?.id !== 'string' || !Number.isInteger(item.expectedVersion) || Number(item.expectedVersion) < 1)) {
      return NextResponse.json({ error: 'invalid deletion selection' }, { status: 400 })
    }
    try {
      const { supabase, response } = await authenticatedClient()
      if (response || !supabase) return response!
      const { data, error } = await supabase.rpc('qiraat_editor_bulk_delete', { p_items: payload.items })
      if (error) return databaseError(error.message)
      return NextResponse.json({ deleted: data })
    } catch (error) { return databaseError(error instanceof Error ? error.message : 'unknown delete error') }
  }
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
    const { data, error } = await supabase.rpc('qiraat_editor_update_annotation_v2', { p: payload })
    if (error) return databaseError(error.message)
    return NextResponse.json({ annotations: data })
  } catch (error) {
    return databaseError(error instanceof Error ? error.message : 'unknown editor error')
  }
}
