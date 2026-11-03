import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resilientFetch } from '@/lib/resilient-fetch'

export const runtime = 'nodejs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-None-Match',
}

const PUBLIC_CACHE_HEADERS = {
  ...CORS,
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
}

interface PageVersionEntry {
  page: number
  version: string
}

let cachedFallbackManifest: PageVersionEntry[] | null = null

function getFallbackManifest(): PageVersionEntry[] {
  if (cachedFallbackManifest) {
    return cachedFallbackManifest
  }

  const root = process.cwd()
  const manifest: PageVersionEntry[] = []

  for (let p = 1; p <= 604; p++) {
    const pad = String(p).padStart(3, '0')
    const pPath = path.join(root, 'packages', 'qiraat-core', 'fixtures', 'pages', `page-${pad}.json`)
    const rPath = path.join(root, 'packages', 'qiraat-core', 'fixtures', 'rulings', `page-${pad}.json`)

    let pSize = 0
    let rSize = 0
    try {
      pSize = fs.statSync(pPath).size
    } catch {
      // page fixture missing or unreadable
    }
    try {
      rSize = fs.statSync(rPath).size
    } catch {
      // ruling fixture missing or unreadable
    }

    const version = crypto
      .createHash('md5')
      .update(`${p}:${pSize}:${rSize}`)
      .digest('hex')

    manifest.push({ page: p, version })
  }

  cachedFallbackManifest = manifest
  return manifest
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

function buildEtag(content: string): string {
  return `"${crypto.createHash('sha256').update(content).digest('hex')}"`
}

function matchesIfNoneMatch(ifNoneMatchHeader: string | null, etag: string): boolean {
  if (!ifNoneMatchHeader) return false
  return ifNoneMatchHeader
    .split(',')
    .map((tag) => tag.trim())
    .some((tag) => tag === etag || tag === '*' || tag === `W/${etag}`)
}

// GET /api/public/v1/qiraat/versions
export async function GET(request: NextRequest) {
  let pages: PageVersionEntry[] | null = null

  try {
    const supabase = getAnonClient()
    if (supabase) {
      const { data, error } = await supabase.rpc('qiraat_public_page_versions')
      if (!error && Array.isArray(data) && data.length === 604) {
        pages = data.map((r: { page: number; version: string }) => ({
          page: Number(r.page),
          version: String(r.version),
        }))
      }
    }
  } catch (err) {
    console.error('[public-qiraat-versions] db rpc failed, falling back to static fixtures:', err)
  }

  if (!pages) {
    pages = getFallbackManifest()
  }

  const bodyText = JSON.stringify({ pages })
  const etag = buildEtag(bodyText)

  const ifNoneMatch = request.headers.get('if-none-match')
  if (matchesIfNoneMatch(ifNoneMatch, etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ...PUBLIC_CACHE_HEADERS,
        ETag: etag,
      },
    })
  }

  return new NextResponse(bodyText, {
    status: 200,
    headers: {
      ...PUBLIC_CACHE_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      ETag: etag,
    },
  })
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
