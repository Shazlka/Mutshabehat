'use client'

import { useState } from 'react'
import type { Part } from './ArabicDiff'

interface VerseShape {
  surah: string; ayah: number; label: string | null
  parts: Part[]
}
interface Props {
  title: string
  verses: VerseShape[]
}

// Part-type colors mirroring CSS (resolved at render time)
const PART_COLORS: Record<string, { fg: string; bg: string | null }> = {
  normal:   { fg: '#171717', bg: null      },
  shared:   { fg: '#15803d', bg: '#dcfce7' },
  diff:     { fg: '#9a5d00', bg: '#fef3c7' },
  diff2:    { fg: '#7c3aed', bg: '#ede9fe' },
  diff3:    { fg: '#0f766e', bg: '#ccfbf1' },
  addition: { fg: '#2563eb', bg: '#dbeafe' },
  unique:   { fg: '#d92323', bg: '#fee2e2' },
}

const W = 1080
const PAD = 64
const LINE_H = 56
const TITLE_SIZE = 40
const VERSE_FONT = '36px "Amiri Quran","Noto Naskh Arabic",serif'
const META_FONT  = '20px "Cairo","Noto Naskh Arabic",sans-serif'

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line); line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

async function render(title: string, verses: VerseShape[]): Promise<Blob> {
  // First pass: measure to figure out canvas height
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = VERSE_FONT
  let totalH = PAD + TITLE_SIZE + 30 // title block
  const innerW = W - PAD * 2

  // For each verse: meta line + wrapped text lines
  const blocks: { metaLines: string[]; textLines: { parts: { word: string; type: string }[] }[] }[] = []
  for (const v of verses) {
    const meta = `${v.surah} — آية ${v.ayah}${v.label ? ` (${v.label})` : ''}`
    measure.font = META_FONT
    const metaLines = wrap(measure, meta, innerW)

    // Expand to (word, type)
    const words: { word: string; type: string }[] = []
    for (const p of v.parts) {
      for (const w of (p.text || '').split(/\s+/).filter(Boolean)) {
        words.push({ word: w, type: p.type })
      }
    }
    // Wrap words into lines based on combined width (each word + space)
    measure.font = VERSE_FONT
    const lines: { parts: { word: string; type: string }[] }[] = []
    let line: { word: string; type: string }[] = []
    let lineW = 0
    for (const w of words) {
      const wW = measure.measureText(w.word + ' ').width
      if (lineW + wW > innerW && line.length) {
        lines.push({ parts: line }); line = []; lineW = 0
      }
      line.push(w); lineW += wW
    }
    if (line.length) lines.push({ parts: line })
    blocks.push({ metaLines, textLines: lines })

    totalH += metaLines.length * 28 + 8     // meta lines
    totalH += lines.length * LINE_H + 32    // verse lines + gap
  }
  totalH += PAD // bottom

  // Real canvas
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = totalH
  const ctx = canvas.getContext('2d')!
  ctx.direction = 'rtl'

  // Background
  ctx.fillStyle = '#fdfcfa'
  ctx.fillRect(0, 0, W, totalH)

  // Title
  ctx.fillStyle = '#171717'
  ctx.font = `bold ${TITLE_SIZE}px "Cairo","Noto Naskh Arabic",sans-serif`
  ctx.textAlign = 'right'
  ctx.fillText(title, W - PAD, PAD + TITLE_SIZE)

  // Underline
  ctx.fillStyle = '#4b63e6'
  ctx.fillRect(W - PAD - 80, PAD + TITLE_SIZE + 8, 80, 3)

  let y = PAD + TITLE_SIZE + 50

  for (const block of blocks) {
    // Meta
    ctx.font = META_FONT
    ctx.fillStyle = '#64748b'
    for (const ml of block.metaLines) {
      ctx.fillText(ml, W - PAD, y)
      y += 28
    }
    y += 6

    // Verse lines
    ctx.font = VERSE_FONT
    for (const line of block.textLines) {
      // Draw right-to-left: start at W-PAD, subtract widths as we go
      let x = W - PAD
      for (const w of line.parts) {
        const text = w.word + ' '
        const tw = ctx.measureText(text).width
        const colors = PART_COLORS[w.type] ?? PART_COLORS.normal
        if (colors.bg) {
          ctx.fillStyle = colors.bg
          roundRect(ctx, x - tw + 2, y - 32, tw - 4, 44, 6)
          ctx.fill()
        }
        ctx.fillStyle = colors.fg
        ctx.fillText(text, x, y)
        x -= tw
      }
      y += LINE_H
    }
    y += 24
  }

  // Footer credit
  ctx.font = '14px "Cairo",sans-serif'
  ctx.fillStyle = '#94a3b8'
  ctx.textAlign = 'left'
  ctx.fillText('متشابهات القرآن الكريم — V2', PAD, totalH - PAD / 2 + 12)

  return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), 'image/png'))
}

export default function ImageShareButton({ title, verses }: Props) {
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState<string | null>(null)

  async function exportPNG() {
    setBusy(true); setErr(null)
    try {
      const blob = await render(title, verses)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.slice(0, 60).replace(/[^\w؀-ۿ\s-]/g, '')}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setErr((e as Error).message || 'فشل التصدير')
    } finally { setBusy(false) }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button onClick={exportPNG} disabled={busy} type="button"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold rounded-full bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] disabled:opacity-50 tap-shrink transition-colors border border-[var(--color-border-soft)]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="m21 15-5-5L5 21"/>
        </svg>
        {busy ? 'جارٍ التصدير…' : 'صورة PNG'}
      </button>
      {err && <span className="text-[11px] text-[var(--color-danger)]">{err}</span>}
    </div>
  )
}
