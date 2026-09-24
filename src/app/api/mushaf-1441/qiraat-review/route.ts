import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  mapReviewDatabaseError,
  validateGetQuery,
  validatePatchBody,
  validatePostBody,
} from './review-http'

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' }

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS })
}

function validationResponse(result: { ok: false; status: number; body: Record<string, unknown> }) {
  return json(result.body, result.status)
}

async function authenticatedClient() {
  const supabase = await createServerSupabaseClient()
  let {
    data: { user },
  } = await supabase.auth.getUser()

  // Auto-login with owner credentials if no active session cookie on this device
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
  const mapped = mapReviewDatabaseError(message)
  return json(mapped.body, mapped.status)
}

export async function GET(request: NextRequest) {
  const query = validateGetQuery({
    overview: request.nextUrl.searchParams.get('overview') ?? undefined,
    history: request.nextUrl.searchParams.get('history') ?? undefined,
    page: request.nextUrl.searchParams.get('page') ?? undefined,
    includeDeleted: request.nextUrl.searchParams.get('includeDeleted') ?? undefined,
  })

  if (!query.ok) return validationResponse(query)

  try {
    const { supabase, response } = await authenticatedClient()
    if (response || !supabase) return response!

    if (query.value.mode === 'overview') {
      const [editor, overview] = await Promise.all([
        supabase.rpc('qiraat_review_is_editor'),
        supabase.rpc('qiraat_review_overview'),
      ])
      if (editor.error) return databaseError(editor.error.message)
      if (overview.error) return databaseError(overview.error.message)

      return json({ isEditor: Boolean(editor.data), pages: overview.data ?? [] })
    }

    if (query.value.mode === 'history') {
      const result = await supabase.rpc('qiraat_review_history', {
        p_page: query.value.page,
      })
      if (result.error) return databaseError(result.error.message)
      return json(result.data ?? [])
    }

    const result = await supabase.rpc('qiraat_review_page', {
      p_page: query.value.page,
      p_include_deleted: query.value.includeDeleted,
    })
    if (result.error) return databaseError(result.error.message)
    return json(result.data ?? {})
  } catch (error) {
    return databaseError(error instanceof Error ? error.message : 'unknown qiraat review error')
  }
}

export async function PATCH(request: NextRequest) {
  const payload = await request.json().catch(() => null)
  const body = validatePatchBody(payload)
  if (!body.ok) return validationResponse(body)

  try {
    const { supabase, response } = await authenticatedClient()
    if (response || !supabase) return response!

    const value = body.value

    if (value.action === 'status') {
      const result = await supabase.rpc('qiraat_review_set_status', {
        p_entry_id: value.entryId,
        p_status: value.status,
        p_expected: value.version,
        p_note: value.note,
        p_device_id: value.deviceId,
      })
      if (result.error) return databaseError(result.error.message)
      return json(result.data ?? {})
    }

    if (value.action === 'update') {
      const result = await supabase.rpc('qiraat_review_update_entry', {
        p: {
          entryId: value.entryId,
          expectedVersion: value.version,
          deviceId: value.deviceId,
          ...value.fields,
        },
      })
      if (result.error) return databaseError(result.error.message)
      return json(result.data ?? {})
    }

    if (value.action === 'narrators') {
      const result = await supabase.rpc('qiraat_review_set_narrators', {
        p_entry_id: value.entryId,
        p_narrators: value.narrators,
        p_expected: value.version,
        p_device_id: value.deviceId,
      })
      if (result.error) return databaseError(result.error.message)
      return json(result.data ?? {})
    }

    if (value.action === 'delete') {
      const result = await supabase.rpc('qiraat_review_delete_entry', {
        p_entry_id: value.entryId,
        p_expected: value.version,
        p_note: value.note,
        p_device_id: value.deviceId,
      })
      if (result.error) return databaseError(result.error.message)
      return json(result.data ?? {})
    }

    const result = await supabase.rpc('qiraat_review_restore_entry', {
      p_entry_id: value.entryId,
      p_expected: value.version,
      p_device_id: value.deviceId,
    })
    if (result.error) return databaseError(result.error.message)
    return json(result.data ?? {})
  } catch (error) {
    return databaseError(error instanceof Error ? error.message : 'unknown qiraat review error')
  }
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null)
  const body = validatePostBody(payload)
  if (!body.ok) return validationResponse(body)

  try {
    const { supabase, response } = await authenticatedClient()
    if (response || !supabase) return response!

    if (body.value.action === 'undo') {
      const result = await supabase.rpc('qiraat_review_undo', {
        p_txid: body.value.txid,
        p_device_id: body.value.deviceId,
      })
      if (result.error) return databaseError(result.error.message)
      return json({ undone: Number(result.data ?? 0) })
    }

    if (body.value.action === 'bulkDelete') {
      const result = await supabase.rpc('qiraat_review_bulk_delete', {
        p_items: body.value.items.map((item) => ({ entryId: item.entryId, expectedVersion: item.expectedVersion })),
        p_note: body.value.note,
        p_device_id: body.value.deviceId,
      })
      if (result.error) return databaseError(result.error.message)
      return json(result.data ?? {})
    }

    if (body.value.action === 'findSameWord') {
      const result = await supabase.rpc('qiraat_review_find_same_word', {
        p_surah: body.value.surah,
        p_ayah: body.value.ayah,
        p_word: body.value.word,
        p_exclude_locus_id: body.value.excludeLocusId ?? null,
      })
      if (result.error) return databaseError(result.error.message)
      return json(result.data ?? [])
    }

    if (body.value.action === 'copyEntry') {
      const result = await supabase.rpc('qiraat_review_copy_entry', {
        p: {
          sourceEntryId: body.value.sourceEntryId,
          surah: body.value.surah,
          ayah: body.value.ayah,
          startWord: body.value.startWord,
          deviceId: body.value.deviceId,
        },
      })
      if (result.error) return databaseError(result.error.message)
      return json(result.data ?? {}, 201)
    }

    if (body.value.action === 'findOccurrences') {
      const result = await supabase.rpc('qiraat_review_find_occurrences', { p_entry_id: body.value.entryId })
      if (result.error) return databaseError(result.error.message)
      return json(result.data ?? [])
    }

    if (body.value.action === 'bulkApply') {
      const result = await supabase.rpc('qiraat_review_bulk_apply', {
        p_source_entry_id: body.value.sourceEntryId,
        p_targets: body.value.targets,
        p_device_id: body.value.deviceId,
      })
      if (result.error) return databaseError(result.error.message)
      return json(result.data ?? {})
    }

    // body.value.action === 'create'
    const result = await supabase.rpc('qiraat_review_create_entry', {
      p: {
        ...body.value.entry,
        deviceId: body.value.deviceId,
      },
    })
    if (result.error) return databaseError(result.error.message)
    return json(result.data ?? {}, 201)
  } catch (error) {
    return databaseError(error instanceof Error ? error.message : 'unknown qiraat review error')
  }
}
