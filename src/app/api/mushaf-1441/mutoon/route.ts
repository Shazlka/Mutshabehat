import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resilientFetch } from '@/lib/resilient-fetch'
import { compileAnnotations, type EditorData, type MatnSymbolAnnotation } from '@/app/mushaf-1441/mutoon-editor/data'

export const runtime = 'nodejs'
const ROW_ID = 'current'

function configured() {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL
}

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: resilientFetch },
  })
}

export async function GET() {
  if (!configured()) {
    return NextResponse.json({ error: 'unconfigured' }, { status: 503 })
  }

  try {
    const { data, error } = await admin()
      .from('qiraat_mutoon_documents')
      .select('revision,document,updated_at')
      .eq('id', ROW_ID)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'unavailable' }, { status: 503 })
    }

    const doc = data.document as EditorData
    let annotations: MatnSymbolAnnotation[] = []
    try {
      annotations = compileAnnotations(doc)
    } catch (e) {
      console.error('Failed to compile annotations:', e)
    }

    return NextResponse.json({
      revision: data.revision,
      updatedAt: data.updated_at,
      document: doc,
      symbols: {
        schemaVersion: 1,
        annotations,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    })
  } catch {
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
