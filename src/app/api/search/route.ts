import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session-user'
import { normalizeArabic, rasmSkeleton } from '@/lib/arabic'

// GET /api/search?q=<arabic>&limit=20
//
// Search runs as a cascade, exact results first:
//   1. FTS on search_vec (GIN-indexed, normalized)        → exact
//   2. ILIKE on raw text                                  → exact (prefix/substring)
//   3. ILIKE on rasm_skeleton (long-alef removed)         → approximate (Tier 2)
// Tier 3 (skeleton) only runs when there is room left under `limit` and the
// query skeleton is long enough to be meaningful (≥ 3 chars), so a plene/defective
// Uthmani variant (السموات ↔ السماوات, عاكفين ↔ عكفين) still surfaces.
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const user = await getSessionUser(supabase)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q     = searchParams.get('q')?.trim() || ''
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

  if (!q) return NextResponse.json({ groups: [], parts: [] })

  const qNorm      = normalizeArabic(q)
  const searchTerm = qNorm || q
  const qSkeleton  = rasmSkeleton(q)
  const canSkeleton = qSkeleton.length >= 3

  // ── 1) GROUPS (title) ──────────────────────────────────────────────────────
  type GroupHit = {
    id: string; title: string; color: string; status: string
    favorite: boolean; completed: boolean; updated_at: string
    approximate?: boolean
  }
  const GROUP_SELECT = 'id, title, color, status, favorite, completed, updated_at'

  let titleHits: GroupHit[] = []

  if (searchTerm.length >= 2) {
    const { data: ftsHits, error: ftsErr } = await supabase
      .from('groups')
      .select(GROUP_SELECT)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .textSearch('search_vec', searchTerm, { type: 'websearch', config: 'simple' } as any)
      .limit(limit)
    if (!ftsErr && ftsHits?.length) titleHits = ftsHits as GroupHit[]
  }

  // ILIKE (exact substring / prefix) when FTS returns nothing
  if (titleHits.length === 0) {
    const { data: ilikeHits } = await supabase
      .from('groups')
      .select(GROUP_SELECT)
      .ilike('title', `%${searchTerm}%`)
      .limit(limit)
    titleHits = (ilikeHits as GroupHit[]) || []
  }

  // Tier 2 — rasm skeleton (approximate) to fill remaining room
  if (titleHits.length < limit && canSkeleton) {
    const seen = new Set(titleHits.map((g) => g.id))
    const { data: skelHits } = await supabase
      .from('groups')
      .select(GROUP_SELECT)
      .ilike('rasm_skeleton', `%${qSkeleton}%`)
      .limit(limit)
    for (const g of (skelHits as GroupHit[]) || []) {
      if (!seen.has(g.id)) { titleHits.push({ ...g, approximate: true }); seen.add(g.id) }
    }
    titleHits = titleHits.slice(0, limit)
  }

  // ── 2) PARTS (text) ────────────────────────────────────────────────────────
  const PART_SELECT = `
    id, text, type,
    verses ( id, surah, ayah, label,
      groups ( id, title, color )
    )
  `
  type PartHit = { id: string; text: string; type: string; verses: unknown; approximate?: boolean }

  let partHits: PartHit[] = []

  if (searchTerm.length >= 2) {
    const { data: ftsHits } = await supabase
      .from('parts')
      .select(PART_SELECT)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .textSearch('search_vec', searchTerm, { type: 'websearch', config: 'simple' } as any)
      .limit(limit)
    if (ftsHits?.length) partHits = ftsHits as PartHit[]
  }

  // ILIKE (exact substring / prefix) when FTS returns nothing
  if (partHits.length === 0) {
    const { data: ilikeHits, error: pErr } = await supabase
      .from('parts')
      .select(PART_SELECT)
      .ilike('text', `%${searchTerm}%`)
      .limit(limit)
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
    partHits = (ilikeHits as PartHit[]) || []
  }

  // Tier 2 — rasm skeleton (approximate) to fill remaining room
  if (partHits.length < limit && canSkeleton) {
    const seen = new Set(partHits.map((p) => p.id))
    const { data: skelHits } = await supabase
      .from('parts')
      .select(PART_SELECT)
      .ilike('rasm_skeleton', `%${qSkeleton}%`)
      .limit(limit)
    for (const p of (skelHits as PartHit[]) || []) {
      if (!seen.has(p.id)) { partHits.push({ ...p, approximate: true }); seen.add(p.id) }
    }
    partHits = partHits.slice(0, limit)
  }

  return NextResponse.json({
    query:      q,
    normalized: qNorm,
    skeleton:   qSkeleton,
    groups:     titleHits,
    parts:      partHits,
  })
}
