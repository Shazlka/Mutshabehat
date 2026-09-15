import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session-user'
import { loadMushafMutshabehatHighlights } from '@/lib/mushaf-mutshabehat'

async function getAuthenticatedSupabase() {
  try {
    const supabase = await createServerSupabaseClient()
    // Session cookie, no auth-server round-trip (RLS still enforces ownership).
    const user = await getSessionUser(supabase)

    if (!user) {
      return {
        supabase: null,
        user: null,
        response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
      }
    }

    return { supabase, user, response: null }
  } catch (error) {
    return {
      supabase: null,
      user: null,
      response: NextResponse.json(
        {
          error: 'Supabase configuration is unavailable for the Mushaf 1441 preview',
          detail: error instanceof Error ? error.message : 'Unknown Supabase configuration error',
        },
        { status: 503 }
      ),
    }
  }
}

// GET /api/mushaf-1441/mutshabehat[?ayahKeys=2:10,2:11] — without ayahKeys returns every link.
export async function GET(request: NextRequest) {
  const { supabase, user, response } = await getAuthenticatedSupabase()
  if (response) return response
  if (!supabase || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ayahKeys = new Set(
    (request.nextUrl.searchParams.get('ayahKeys') ?? '')
      .split(',')
      .map((key) => key.trim())
      .filter((key) => /^\d+:\d+$/.test(key))
  )

  const { highlights, error } = await loadMushafMutshabehatHighlights(supabase, user.id, ayahKeys)
  if (error) return NextResponse.json({ error }, { status: 500 })

  return NextResponse.json({ highlights })
}
