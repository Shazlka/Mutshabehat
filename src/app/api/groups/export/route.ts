import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type ExcelJS from 'exceljs'

type Part  = { id: string; type: string; text: string; sort_order: number }
type Verse = { id: string; surah: string; ayah: number; label: string | null; sort_order: number; parts: Part[] }
type Group = {
  id: string; title: string; color: string; status: string
  favorite: boolean; completed: boolean; note: string | null; unote: string | null
  created_at: string; updated_at: string; verses: Verse[]
}

// GET /api/groups/export?format=json|csv|xlsx
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')
  const exportFormat =
    format === 'csv' ? 'csv'
    : format === 'xlsx' ? 'xlsx'
    : format === 'sql' ? 'sql'
    : 'json'

  const { data: groups, error } = await supabase
    .from('groups')
    .select(`
      id, title, color, status, favorite, completed, note, unote, created_at, updated_at,
      verses (
        id, surah, ayah, label, sort_order,
        parts ( id, type, text, sort_order )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sorted = (groups as unknown as Group[]).map((g) => ({
    ...g,
    verses: [...(g.verses || [])].sort((a, b) => a.sort_order - b.sort_order).map((v) => ({
      ...v,
      parts: [...(v.parts || [])].sort((a, b) => a.sort_order - b.sort_order),
    })),
  }))

  // ── JSON ──────────────────────────────────────────────────────────────────
  if (exportFormat === 'json') {
    const payload = { exported_at: new Date().toISOString(), count: sorted.length, groups: sorted }
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="mutshabehat-export-${new Date().toISOString().slice(0,10)}.json"`,
      },
    })
  }

  // ── SQL (Supabase-compatible restore file) ─────────────────────────────────
  // Produces an idempotent, FK-ordered upsert script scoped to this user.
  // Re-run it in Supabase → SQL Editor (or psql) to restore data after loss.
  if (exportFormat === 'sql') {
    // Tags + group↔tag links live in separate tables — fetch them too.
    const [{ data: tags }, { data: groupTags }] = await Promise.all([
      supabase.from('tags').select('id, name, color').eq('user_id', user.id),
      supabase
        .from('group_tags')
        .select('group_id, tag_id, groups!inner(user_id)')
        .eq('groups.user_id', user.id),
    ])

    // SQL literal helpers
    const q = (s: string | null | undefined) =>
      s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`
    const b = (v: boolean) => (v ? 'true' : 'false')
    const n = (v: number | null | undefined) => (v == null ? 'NULL' : String(v))
    const uid = q(user.id) // literal owner id; restore must target the same auth user

    const lines: string[] = []
    lines.push('-- ============================================================')
    lines.push('-- Mutshabehat V2 — Database restore (Supabase-compatible)')
    lines.push(`-- Exported: ${new Date().toISOString()}`)
    lines.push(`-- Owner user_id: ${user.id}`)
    lines.push(`-- Groups: ${sorted.length}  |  Tags: ${tags?.length ?? 0}`)
    lines.push('--')
    lines.push('-- Idempotent: safe to re-run. Existing rows are updated (upsert),')
    lines.push('-- missing rows are recreated. Schema (tables/RLS) must already exist.')
    lines.push('-- Restore into the SAME Supabase project & user the data came from,')
    lines.push('-- otherwise row-level security will reject the inserts.')
    lines.push('-- ============================================================')
    lines.push('')
    lines.push('begin;')
    lines.push('')

    // ── Tags ──
    if (tags && tags.length) {
      lines.push('-- Tags')
      for (const t of tags as { id: string; name: string; color: string | null }[]) {
        lines.push(
          `insert into public.tags (id, user_id, name, color) values ` +
          `(${q(t.id)}, ${uid}, ${q(t.name)}, ${q(t.color)}) ` +
          `on conflict (id) do update set name = excluded.name, color = excluded.color;`
        )
      }
      lines.push('')
    }

    // ── Groups → Verses → Parts ──
    lines.push('-- Groups, verses, and parts')
    for (const g of sorted) {
      lines.push(
        `insert into public.groups (id, user_id, title, color, note, unote, status, favorite, completed, created_at, updated_at) values ` +
        `(${q(g.id)}, ${uid}, ${q(g.title)}, ${q(g.color)}, ${q(g.note)}, ${q(g.unote)}, ${q(g.status)}, ${b(g.favorite)}, ${b(g.completed)}, ${q(g.created_at)}, ${q(g.updated_at)}) ` +
        `on conflict (id) do update set title = excluded.title, color = excluded.color, note = excluded.note, unote = excluded.unote, status = excluded.status, favorite = excluded.favorite, completed = excluded.completed, updated_at = excluded.updated_at;`
      )
      for (const v of g.verses) {
        lines.push(
          `insert into public.verses (id, group_id, surah, ayah, label, sort_order) values ` +
          `(${q(v.id)}, ${q(g.id)}, ${q(v.surah)}, ${n(v.ayah)}, ${q(v.label)}, ${n(v.sort_order)}) ` +
          `on conflict (id) do update set group_id = excluded.group_id, surah = excluded.surah, ayah = excluded.ayah, label = excluded.label, sort_order = excluded.sort_order;`
        )
        for (const p of v.parts) {
          lines.push(
            `insert into public.parts (id, verse_id, type, text, sort_order) values ` +
            `(${q(p.id)}, ${q(v.id)}, ${q(p.type)}, ${q(p.text)}, ${n(p.sort_order)}) ` +
            `on conflict (id) do update set verse_id = excluded.verse_id, type = excluded.type, text = excluded.text, sort_order = excluded.sort_order;`
          )
        }
      }
    }
    lines.push('')

    // ── Group↔Tag links ──
    if (groupTags && groupTags.length) {
      lines.push('-- Group ↔ tag links')
      for (const gt of groupTags as unknown as { group_id: string; tag_id: string }[]) {
        lines.push(
          `insert into public.group_tags (group_id, tag_id) values ` +
          `(${q(gt.group_id)}, ${q(gt.tag_id)}) on conflict (group_id, tag_id) do nothing;`
        )
      }
      lines.push('')
    }

    lines.push('commit;')
    lines.push('')

    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'application/sql; charset=utf-8',
        'Content-Disposition': `attachment; filename="mutshabehat-restore-${new Date().toISOString().slice(0,10)}.sql"`,
      },
    })
  }

  // ── CSV ───────────────────────────────────────────────────────────────────
  if (exportFormat === 'csv') {
    const escape = (s: string | null | undefined) =>
      `"${String(s ?? '').replace(/"/g, '""')}"`

    const header = 'group_id,group_title,group_color,group_status,favorite,completed,verse_surah,verse_ayah,verse_label,parts_text,created_at'
    const rows: string[] = []

    for (const g of sorted) {
      if (g.verses.length === 0) {
        rows.push([g.id, escape(g.title), escape(g.color), g.status, g.favorite, g.completed, '', '', '', '', g.created_at].join(','))
      } else {
        for (const v of g.verses) {
          const partsText = v.parts.map((p) => p.text).join(' ')
          rows.push([g.id, escape(g.title), escape(g.color), g.status, g.favorite, g.completed, escape(v.surah), v.ayah, escape(v.label), escape(partsText), g.created_at].join(','))
        }
      }
    }

    // UTF-8 BOM for Excel/Numbers Arabic encoding
    const csv = '﻿' + [header, ...rows].join('\n')
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="mutshabehat-export-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    })
  }

  // ── XLSX ──────────────────────────────────────────────────────────────────
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Mutshabehat V2'
  wb.created = new Date()

  const ws = wb.addWorksheet('متشابهات', {
    views: [{ rightToLeft: true }],
    properties: { defaultRowHeight: 18 },
  })

  // Column definitions (widths tuned for Arabic content)
  ws.columns = [
    { key: 'num',    width: 5  },
    { key: 'surah',  width: 20 },
    { key: 'ayah',   width: 8  },
    { key: 'label',  width: 18 },
    { key: 'shared', width: 50 },
    { key: 'diff',   width: 30 },
    { key: 'diff2',  width: 30 },
    { key: 'add',    width: 30 },
    { key: 'status', width: 12 },
    { key: 'notes',  width: 30 },
  ]

  const COL_HEADERS = ['#', 'السورة', 'الآية', 'الملصق', 'المشترك', 'مختلف ١', 'مختلف ٢', 'إضافة', 'الحالة', 'الملاحظات']
  const TOTAL_COLS = COL_HEADERS.length

  // Helper: parse hex color → ARGB string for ExcelJS (e.g. "#55b94f" → "FF55b94f")
  function toArgb(hex: string, alpha = 'FF'): string {
    const clean = hex.replace('#', '')
    return `${alpha}${clean.length === 6 ? clean : '55b94f'}`
  }

  // Helper: blend hex color with white at given opacity (0–1) for tinted rows
  function tintHex(hex: string, amount: number): string {
    const clean = hex.replace('#', '')
    const r = parseInt(clean.slice(0, 2), 16)
    const g = parseInt(clean.slice(2, 4), 16)
    const b = parseInt(clean.slice(4, 6), 16)
    const tr = Math.round(r + (255 - r) * amount).toString(16).padStart(2, '0')
    const tg = Math.round(g + (255 - g) * amount).toString(16).padStart(2, '0')
    const tb = Math.round(b + (255 - b) * amount).toString(16).padStart(2, '0')
    return `FF${tr}${tg}${tb}`
  }

  function applyGroupHeaderStyle(row: ExcelJS.Row, hexColor: string) {
    row.height = 22
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(hexColor) } }
      cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' }, name: 'Arial' }
      cell.alignment = { vertical: 'middle', horizontal: 'right', readingOrder: 'rtl' }
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF888888' } },
      }
    })
  }

  function applyColHeaderStyle(row: ExcelJS.Row, hexColor: string) {
    row.height = 18
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tintHex(hexColor, 0.35) } }
      cell.font = { bold: true, size: 10, color: { argb: 'FF222222' }, name: 'Arial' }
      cell.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: 'rtl' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FF888888' } },
        left:  { style: 'thin', color: { argb: 'FFDDDDDD' } },
        right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      }
    })
  }

  function applyVerseRowStyle(row: ExcelJS.Row, hexColor: string, even: boolean) {
    row.height = 20
    const bgArgb = tintHex(hexColor, even ? 0.85 : 0.92)
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }
      cell.font = { size: 10, color: { argb: 'FF111111' }, name: 'Arial' }
      cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true, readingOrder: 'rtl' }
      cell.border = {
        left:  { style: 'hair', color: { argb: 'FFCCCCCC' } },
        right: { style: 'hair', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } },
      }
    })
    // Right-align number column
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' }
  }

  // ── Title row (document header) ───────────────────────────────────────────
  const titleRow = ws.addRow(['', '', '', '', 'قاعدة بيانات المتشابهات', '', '', '', '', ''])
  ws.mergeCells(titleRow.number, 1, titleRow.number, TOTAL_COLS)
  titleRow.height = 28
  titleRow.getCell(1).value = 'قاعدة بيانات المتشابهات'
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1a3a1a' }, name: 'Arial' }
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center', readingOrder: 'rtl' }
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe8f5e9' } }

  const subtitleRow = ws.addRow([])
  ws.mergeCells(subtitleRow.number, 1, subtitleRow.number, TOTAL_COLS)
  subtitleRow.height = 16
  subtitleRow.getCell(1).value = `تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}  |  عدد المجموعات: ${sorted.length}`
  subtitleRow.getCell(1).font = { size: 9, color: { argb: 'FF666666' }, italic: true, name: 'Arial' }
  subtitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
  subtitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf1f8f1' } }

  // Spacer
  ws.addRow([])

  // ── Per-group blocks ──────────────────────────────────────────────────────
  for (const g of sorted) {
    const hexColor = g.color || '#55b94f'

    // Group header (merged, colored)
    const statusLabel: Record<string, string> = { draft: 'مسودة', published: 'منشورة', locked: 'مقفلة' }
    const headerLabel = `${g.title}   |   ${statusLabel[g.status] ?? g.status}${g.favorite ? '   ★' : ''}${g.completed ? '   ✓' : ''}`
    const groupHeaderRow = ws.addRow(Array(TOTAL_COLS).fill(''))
    ws.mergeCells(groupHeaderRow.number, 1, groupHeaderRow.number, TOTAL_COLS)
    groupHeaderRow.getCell(1).value = headerLabel
    applyGroupHeaderStyle(groupHeaderRow, hexColor)

    // If group has a note, add a sub-header row
    if (g.note) {
      const noteRow = ws.addRow(Array(TOTAL_COLS).fill(''))
      ws.mergeCells(noteRow.number, 1, noteRow.number, TOTAL_COLS)
      noteRow.getCell(1).value = `📝 ${g.note}`
      noteRow.height = 16
      noteRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tintHex(hexColor, 0.6) } }
      noteRow.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF444444' }, name: 'Arial' }
      noteRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right', readingOrder: 'rtl' }
    }

    // Column header row
    const colHeaderRow = ws.addRow(COL_HEADERS)
    applyColHeaderStyle(colHeaderRow, hexColor)

    if (g.verses.length === 0) {
      const emptyRow = ws.addRow(['—', '—', '—', '—', 'لا توجد آيات', '', '', '', '', ''])
      applyVerseRowStyle(emptyRow, hexColor, false)
    } else {
      g.verses.forEach((v, i) => {
        const shared   = v.parts.filter(p => p.type === 'shared').map(p => p.text).join(' ')
        const diff     = v.parts.filter(p => p.type === 'diff').map(p => p.text).join(' ')
        const diff2    = v.parts.filter(p => p.type === 'diff2').map(p => p.text).join(' ')
        const addition = v.parts.filter(p => ['addition', 'unique', 'normal'].includes(p.type)).map(p => p.text).join(' ')

        const verseRow = ws.addRow([
          i + 1,
          v.surah,
          v.ayah,
          v.label ?? '',
          shared,
          diff,
          diff2,
          addition,
          g.status,
          g.note ?? '',
        ])
        applyVerseRowStyle(verseRow, hexColor, i % 2 === 0)
      })
    }

    // Spacer between groups
    ws.addRow([])
  }

  // Freeze top 3 rows (title + subtitle + spacer) and left 0 cols
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3, rightToLeft: true }]

  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="mutshabehat-export-${new Date().toISOString().slice(0,10)}.xlsx"`,
    },
  })
}
