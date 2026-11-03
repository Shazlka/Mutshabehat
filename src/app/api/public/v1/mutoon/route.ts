import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resilientFetch } from '@/lib/resilient-fetch'
import {
  compileAnnotations,
  compileVerse,
  type EditorData,
  type Mark,
  type Mutoon,
  type WordAssignment,
  type WorkId,
} from '@/app/mushaf-1441/mutoon-editor/data'

export const runtime = 'nodejs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

type VerseBundle = {
  work: WorkId
  verse: {
    number: number
    lines: string[]
    printedPage: string | null
    pageId: number | null
    version: number
  }
  marks: Mark[]
  assignments: WordAssignment[]
}

function reply(body: unknown, status: number, cache: string) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...CORS,
      'Cache-Control': cache,
    },
  })
}

function getAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: resilientFetch,
    },
  })
}

function methodNotAllowed() {
  return NextResponse.json(
    { error: 'Method Not Allowed' },
    {
      status: 405,
      headers: {
        ...CORS,
        Allow: 'GET, HEAD, OPTIONS',
        'Cache-Control': 'no-store',
      },
    }
  )
}

/**
 * Public, read-only, cookie-less feed for the Qiraat iOS app.
 *   GET            the whole متون and every mark, compiled snapshot
 *   GET ?since=S   only the verses that changed after sequence S
 */
export async function GET(request: NextRequest) {
  const supabase = getAnonClient()
  if (!supabase) return reply({ error: 'unconfigured' }, 503, 'no-store')

  if (request.nextUrl.searchParams.has('since')) {
    const sinceRaw = request.nextUrl.searchParams.get('since')
    const since = Number(sinceRaw)
    if (!sinceRaw || !/^\d+$/.test(sinceRaw) || !Number.isSafeInteger(since) || since < 0) {
      return reply({ error: 'bad-since' }, 400, 'no-store')
    }

    try {
      const { data, error, status } = await supabase.rpc('qiraat_public_mutoon_changes', {
        p_since: since,
      })
      if (error || !data) {
        console.error('[public-mutoon] rpc changes failed', error?.message)
        const httpStatus = status === 400 || status === 404 || status === 409 ? status : 503
        return reply({ error: 'unavailable' }, httpStatus, 'no-store')
      }

      const { seq, full, verses } = data as {
        seq: number
        full: boolean
        verses: Array<VerseBundle & { chapter: string }>
      }
      return reply(
        {
          seq,
          full,
          verses: verses.map((b) => ({
            work: b.work,
            chapter: b.chapter,
            verse: {
              number: b.verse.number,
              lines: b.verse.lines,
              printedPage: b.verse.printedPage,
              pageId: b.verse.pageId,
            },
            annotations: compileVerse(
              b.work,
              b.verse.number,
              b.verse.lines,
              b.marks,
              b.assignments
            ),
          })),
        },
        200,
        'public, s-maxage=300, stale-while-revalidate=86400'
      )
    } catch (e) {
      console.error('[public-mutoon] changes threw', e)
      return reply({ error: 'unavailable' }, 503, 'no-store')
    }
  }

  try {
    const { data, error, status } = await supabase.rpc('qiraat_public_mutoon_snapshot')
    if (error || !data) {
      console.error('[public-mutoon] rpc snapshot failed', error?.message)
      const httpStatus = status === 400 || status === 404 || status === 409 ? status : 503
      return reply({ error: 'unavailable' }, httpStatus, 'no-store')
    }

    const { seq, mutoon, marks, assignments } = data as {
      seq: number
      mutoon: Mutoon
      marks: Mark[]
      assignments: WordAssignment[]
    }
    const doc: EditorData = {
      mutoon,
      marks: { marks },
      assignments: { schemaVersion: 1, assignments },
    }
    let annotations: ReturnType<typeof compileAnnotations> = []
    try {
      annotations = compileAnnotations(doc)
    } catch (e) {
      console.error('[public-mutoon] compile failed', e)
    }

    return reply(
      {
        seq,
        revision: seq,
        document: { mutoon },
        symbols: { schemaVersion: 1, annotations },
      },
      200,
      'public, s-maxage=300, stale-while-revalidate=86400'
    )
  } catch (e) {
    console.error('[public-mutoon] snapshot threw', e)
    return reply({ error: 'unavailable' }, 503, 'no-store')
  }
}

export async function HEAD(request: NextRequest) {
  const res = await GET(request)
  return new NextResponse(null, {
    status: res.status,
    headers: res.headers,
  })
}

export async function POST() {
  return methodNotAllowed()
}

export async function PUT() {
  return methodNotAllowed()
}

export async function DELETE() {
  return methodNotAllowed()
}

export async function PATCH() {
  return methodNotAllowed()
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
      Allow: 'GET, HEAD, OPTIONS',
    },
  })
}
