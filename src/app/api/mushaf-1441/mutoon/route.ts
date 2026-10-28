import { NextRequest, NextResponse } from 'next/server'
import { mutoonConfigured, mutoonRpc } from '@/lib/mutoon-db'
import { compileAnnotations, compileVerse, type EditorData, type Mark, type Mutoon, type WordAssignment, type WorkId } from '@/app/mushaf-1441/mutoon-editor/data'

export const runtime = 'nodejs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

type VerseBundle = {
  work: WorkId
  verse: { number: number; lines: string[]; printedPage: string | null; pageId: number | null; version: number }
  marks: Mark[]
  assignments: WordAssignment[]
}

function reply(body: unknown, status: number, cache: string) {
  return NextResponse.json(body, { status, headers: { ...CORS, 'Cache-Control': cache } })
}

/**
 * The iOS app's feed.
 *   GET            the whole متون and every mark, compiled (taken once on a fresh install, or after `full`)
 *   GET ?since=S   only the verses that changed after sequence S, each with its complete current marks. A verse is
 *                  replaced as a whole, so the app needs no merge logic beyond "swap this verse".
 */
export async function GET(request: NextRequest) {
  if (!mutoonConfigured()) return reply({ error: 'unconfigured' }, 503, 'no-store')

  if (request.nextUrl.searchParams.has('since')) {
    const since = Number(request.nextUrl.searchParams.get('since'))
    if (!Number.isSafeInteger(since) || since < 0) return reply({ error: 'bad-since' }, 400, 'no-store')
    const result = await mutoonRpc<{ seq: number; full: boolean; verses: Array<VerseBundle & { chapter: string }> }>('qiraat_mutoon_changes_json', { p_since: since })
    if (result.error) return reply({ error: 'unavailable' }, result.error.status, 'no-store')
    const { seq, full, verses } = result.data
    return reply({
      seq, full,
      verses: verses.map(b => ({
        work: b.work, chapter: b.chapter,
        verse: { number: b.verse.number, lines: b.verse.lines, printedPage: b.verse.printedPage, pageId: b.verse.pageId },
        annotations: compileVerse(b.work, b.verse.number, b.verse.lines, b.marks, b.assignments),
      })),
    }, 200, 'no-store')
  }

  const result = await mutoonRpc<{ seq: number; mutoon: Mutoon; marks: Mark[]; assignments: WordAssignment[] }>('qiraat_mutoon_snapshot_json')
  if (result.error) return reply({ error: 'unavailable' }, result.error.status, 'no-store')
  const { seq, mutoon, marks, assignments } = result.data
  const doc: EditorData = { mutoon, marks: { marks }, assignments: { schemaVersion: 1, assignments } }
  let annotations: ReturnType<typeof compileAnnotations> = []
  try { annotations = compileAnnotations(doc) } catch (e) { console.error('[mutoon] compile failed', e) }
  // `revision` and `document.mutoon` keep older app builds working; the marks live in `symbols`.
  return reply({ seq, revision: seq, document: { mutoon }, symbols: { schemaVersion: 1, annotations } }, 200, 'public, s-maxage=30, stale-while-revalidate=300')
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
