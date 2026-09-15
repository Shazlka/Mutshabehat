import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sanitizeNote } from '@/lib/sanitize'
import type {
  MushafAnnotation,
  MushafAnnotationTargetType,
  MushafAnnotationType,
} from '../../../../../packages/quran-data/mushaf1441/types'

const TABLE = 'mushaf_annotations'
const ANNOTATION_TYPES = new Set<MushafAnnotationType>(['note', 'highlight', 'bookmark', 'favorite'])
const TARGET_TYPES = new Set<MushafAnnotationTargetType>(['ayah', 'word', 'word-range'])

type MushafAnnotationRow = {
  id: string
  user_id: string
  annotation_type: MushafAnnotationType
  target_type: MushafAnnotationTargetType
  ayah_key: string
  page_number: number
  word_id: string | null
  line_number: number | null
  word_index_in_line: number | null
  word_range_start_id: string | null
  word_range_end_id: string | null
  title: string | null
  body: string | null
  text_color: string | null
  background_color: string | null
  tags: string[] | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

async function getAuthenticatedSupabase() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      // A missing/expired session is a normal "not signed in" state, not a server
      // fault — return 401 so the UI can prompt sign-in instead of showing an error.
      const sessionMissing =
        error.name === 'AuthSessionMissingError' ||
        /auth session missing/i.test(error.message)
      if (sessionMissing) {
        return {
          supabase: null,
          user: null,
          response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
        }
      }

      return {
        supabase: null,
        user: null,
        response: NextResponse.json(
          {
            error: 'Supabase authentication is unavailable for the Mushaf 1441 preview',
            detail: error.message,
          },
          { status: 503 }
        ),
      }
    }

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

function normalizeTableError(error: { message: string; code?: string }) {
  const missingTable =
    error.code === '42P01' ||
    error.message.toLowerCase().includes('could not find the table') ||
    error.message.toLowerCase().includes('does not exist')
  const missingGrant =
    error.code === '42501' ||
    error.message.toLowerCase().includes('permission denied')

  if (missingTable || missingGrant) {
    return NextResponse.json(
      {
        error: missingTable
          ? 'mushaf_annotations table is not installed yet'
          : 'mushaf_annotations table is not exposed to the authenticated Supabase role yet',
        migration: 'packages/quran-data/mushaf1441/supabase-interactions-schema-proposal.sql',
      },
      { status: 501 }
    )
  }

  return NextResponse.json({ error: error.message }, { status: 500 })
}

function isAyahKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d+:\d+$/.test(value)
}

function sanitizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined
}

function toOptionalInteger(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

type ValidatedAnnotationTarget = {
  wordId: string | null
  lineNumber: number | null
  wordIndexInLine: number | null
  wordRangeStartId: string | null
  wordRangeEndId: string | null
}

function validateAnnotationTarget(
  targetType: MushafAnnotationTargetType,
  input: {
    wordId: string | undefined
    lineNumber: number | null
    wordIndexInLine: number | null
    wordRangeStartId: string | undefined
    wordRangeEndId: string | undefined
  }
): { target: ValidatedAnnotationTarget; error?: never } | { target?: never; error: string } {
  if (targetType === 'ayah') {
    return {
      target: {
        wordId: null,
        lineNumber: null,
        wordIndexInLine: null,
        wordRangeStartId: null,
        wordRangeEndId: null,
      },
    }
  }

  if (targetType === 'word') {
    if (!input.wordId) return { error: 'word target requires wordId' }
    if (!input.lineNumber || input.lineNumber < 1 || input.lineNumber > 15) {
      return { error: 'lineNumber must be 1-15 for word target' }
    }
    if (!input.wordIndexInLine || input.wordIndexInLine < 1) {
      return { error: 'wordIndexInLine must be a positive integer for word target' }
    }

    return {
      target: {
        wordId: input.wordId,
        lineNumber: input.lineNumber,
        wordIndexInLine: input.wordIndexInLine,
        wordRangeStartId: null,
        wordRangeEndId: null,
      },
    }
  }

  if (!input.wordRangeStartId || !input.wordRangeEndId) {
    return { error: 'word-range target requires wordRangeStartId and wordRangeEndId' }
  }

  return {
    target: {
      wordId: null,
      lineNumber: null,
      wordIndexInLine: null,
      wordRangeStartId: input.wordRangeStartId,
      wordRangeEndId: input.wordRangeEndId,
    },
  }
}

function toAnnotation(row: MushafAnnotationRow): MushafAnnotation {
  return {
    id: row.id,
    userId: row.user_id,
    annotationType: row.annotation_type,
    targetType: row.target_type,
    ayahKey: row.ayah_key,
    pageNumber: row.page_number,
    wordId: row.word_id ?? undefined,
    lineNumber: row.line_number ?? undefined,
    wordIndexInLine: row.word_index_in_line ?? undefined,
    wordRangeStartId: row.word_range_start_id ?? undefined,
    wordRangeEndId: row.word_range_end_id ?? undefined,
    title: row.title ?? undefined,
    body: row.body ?? undefined,
    textColor: row.text_color ?? undefined,
    backgroundColor: row.background_color ?? undefined,
    tags: Array.isArray(row.tags) ? row.tags : [],
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function GET(request: NextRequest) {
  const { supabase, user, response } = await getAuthenticatedSupabase()
  if (response) return response
  if (!supabase || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const pageNumber = Number(searchParams.get('pageNumber'))
  const ayahKey = searchParams.get('ayahKey')
  const annotationType = searchParams.get('annotationType')

  let query = supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= 604) {
    query = query.eq('page_number', pageNumber)
  }
  if (ayahKey) query = query.eq('ayah_key', ayahKey)
  if (annotationType && ANNOTATION_TYPES.has(annotationType as MushafAnnotationType)) {
    query = query.eq('annotation_type', annotationType)
  }

  const { data, error } = await query
  if (error) return normalizeTableError(error)

  return NextResponse.json({ annotations: ((data ?? []) as MushafAnnotationRow[]).map(toAnnotation) })
}

export async function POST(request: NextRequest) {
  const { supabase, user, response } = await getAuthenticatedSupabase()
  if (response) return response
  if (!supabase || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || !ANNOTATION_TYPES.has(body.annotationType) || !TARGET_TYPES.has(body.targetType)) {
    return NextResponse.json({ error: 'valid annotationType and targetType are required' }, { status: 400 })
  }
  if (!isAyahKey(body.ayahKey)) {
    return NextResponse.json({ error: 'valid ayahKey is required' }, { status: 400 })
  }

  const pageNumber = Number(body.pageNumber)
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 604) {
    return NextResponse.json({ error: 'valid pageNumber 1-604 is required' }, { status: 400 })
  }

  const targetValidation = validateAnnotationTarget(body.targetType as MushafAnnotationTargetType, {
    wordId: sanitizeString(body.wordId),
    lineNumber: toOptionalInteger(body.lineNumber),
    wordIndexInLine: toOptionalInteger(body.wordIndexInLine),
    wordRangeStartId: sanitizeString(body.wordRangeStartId),
    wordRangeEndId: sanitizeString(body.wordRangeEndId),
  })
  if (targetValidation.error || !targetValidation.target) {
    return NextResponse.json(
      { error: targetValidation.error ?? 'invalid annotation target' },
      { status: 400 }
    )
  }

  const target = targetValidation.target
  const row = {
    user_id: user.id,
    annotation_type: body.annotationType as MushafAnnotationType,
    target_type: body.targetType as MushafAnnotationTargetType,
    ayah_key: body.ayahKey,
    page_number: pageNumber,
    word_id: target.wordId,
    line_number: target.lineNumber,
    word_index_in_line: target.wordIndexInLine,
    word_range_start_id: target.wordRangeStartId,
    word_range_end_id: target.wordRangeEndId,
    title: sanitizeString(body.title),
    body: sanitizeNote(typeof body.body === 'string' ? body.body : undefined),
    text_color: sanitizeString(body.textColor),
    background_color: sanitizeString(body.backgroundColor),
    tags: Array.isArray(body.tags)
      ? (body.tags as unknown[]).map(String).map((tag: string) => tag.trim()).filter(Boolean)
      : [],
    metadata: typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : {},
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select('*')
    .single()

  if (error) return normalizeTableError(error)
  return NextResponse.json({ annotation: toAnnotation(data as MushafAnnotationRow) }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const { supabase, user, response } = await getAuthenticatedSupabase()
  if (response) return response
  if (!supabase || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'request body is required' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (typeof (body as { title?: unknown }).title === 'string') {
    const value = sanitizeString((body as { title?: string }).title)
    if (value !== undefined) updates.title = value
  }
  if (typeof (body as { body?: unknown }).body === 'string') {
    const value = sanitizeNote((body as { body?: string }).body)
    if (value !== undefined) updates.body = value
  }
  if (typeof (body as { textColor?: unknown }).textColor === 'string') {
    const value = sanitizeString((body as { textColor?: string }).textColor)
    if (value !== undefined) updates.text_color = value
  }
  if (typeof (body as { backgroundColor?: unknown }).backgroundColor === 'string') {
    const value = sanitizeString((body as { backgroundColor?: string }).backgroundColor)
    if (value !== undefined) updates.background_color = value
  }
  if (Array.isArray((body as { tags?: unknown }).tags)) {
    updates.tags = (body as { tags: unknown[] }).tags.map(String).map((tag: string) => tag.trim()).filter(Boolean)
  }
  if (typeof (body as { metadata?: unknown }).metadata === 'object' && (body as { metadata?: unknown }).metadata !== null) {
    updates.metadata = (body as { metadata: Record<string, unknown> }).metadata
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) return normalizeTableError(error)
  return NextResponse.json({ annotation: toAnnotation(data as MushafAnnotationRow) })
}

export async function DELETE(request: NextRequest) {
  const { supabase, user, response } = await getAuthenticatedSupabase()
  if (response) return response
  if (!supabase || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return normalizeTableError(error)
  return NextResponse.json({ success: true })
}
