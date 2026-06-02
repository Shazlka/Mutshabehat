'use client'

import { useState, useMemo, useRef } from 'react'
import ArabicDiff, { type Part } from './ArabicDiff'
import ImageShareButton from './ImageShareButton'
import { ayahToArabic } from '@/lib/arabic'
import { autoColorPair } from '@/lib/diff'
import { cn } from '@/lib/cn'
import { sanitizeNote } from '@/lib/sanitize'

interface Verse {
  id: string; surah: string; ayah: number; label: string | null
  parts: Part[]
}
interface Group {
  id: string; title: string; color: string | null
  status: 'draft' | 'published' | 'locked'
  favorite: boolean; completed: boolean
  note: string | null; unote: string | null
  verses: Verse[]
}

export default function GroupDetail({ group }: { group: Group }) {
  const [view, setView] = useState<'as-is' | 'master-slave'>('as-is')
  const [masterIdx, setMasterIdx] = useState(0)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const lastTapTime = useRef<Record<number, number>>({})

  function copyVerse(vi: number, parts: Part[], surah: string, ayah: number) {
    const text = `${surah} (${ayah})\n${parts.map((p) => p.text).join('')}`
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedIdx(vi)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  function handleDoubleTap(vi: number, parts: Part[], surah: string, ayah: number) {
    const now = Date.now()
    if (now - (lastTapTime.current[vi] ?? 0) < 350) {
      copyVerse(vi, parts, surah, ayah)
    }
    lastTapTime.current[vi] = now
  }

  const masterText = useMemo(() => {
    const v = group.verses[masterIdx]
    if (!v) return ''
    return (v.parts || []).map((p) => p.text).join(' ').replace(/\s+/g, ' ').trim()
  }, [group.verses, masterIdx])

  return (
    <article aria-labelledby="g-title">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-baseline gap-3 mb-2">
          {group.color && (
            <span aria-hidden="true"
                  className="inline-block w-3 h-3 rounded-full shrink-0 mt-1"
                  style={{ background: group.color }} />
          )}
          <h1 id="g-title" className="text-[18px] md:text-[26px] font-bold text-[var(--color-ink)] leading-tight">
            {group.title}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          {group.favorite && (
            <span className="px-2 py-0.5 rounded-full font-bold tracking-wider uppercase"
                  style={{ color: 'var(--color-warn)', background: 'var(--color-warn-bg)' }}>★ مفضّلة</span>
          )}
          {group.completed && (
            <span className="px-2 py-0.5 rounded-full font-bold tracking-wider uppercase"
                  style={{ color: 'var(--color-success)', background: 'var(--color-success-bg)' }}>✓ مكتمل</span>
          )}
          {group.status === 'locked' && (
            <span className="px-2 py-0.5 rounded-full font-bold tracking-wider uppercase"
                  style={{ color: 'var(--color-ink-muted)', background: 'var(--color-surface-2)' }}>🔒 مقفل</span>
          )}
          <span className="text-[var(--color-ink-muted)]">{group.verses.length} آية</span>
        </div>
      </header>

      {/* Toolbar — image export */}
      <div className="mb-6">
        <ImageShareButton title={group.title} verses={group.verses} />
      </div>

      {/* View switcher */}
      {group.verses.length >= 2 && (
        <div className="flex items-center gap-1.5 mb-6 p-1 bg-[var(--color-surface)] border border-[var(--color-border-soft)] rounded-full w-fit">
          <button onClick={() => setView('as-is')}
            className={cn(
              'px-4 py-1.5 text-[12px] font-bold rounded-full tap-shrink transition-colors',
              view === 'as-is'
                ? 'bg-[var(--color-primary)] text-[var(--color-paper)] shadow-sm'
                : 'text-[var(--color-ink-soft)] hover:text-[var(--color-primary)]'
            )}>
            العرض كما حُفظ
          </button>
          <button onClick={() => setView('master-slave')}
            className={cn(
              'px-4 py-1.5 text-[12px] font-bold rounded-full tap-shrink transition-colors',
              view === 'master-slave'
                ? 'bg-[var(--color-primary)] text-[var(--color-paper)] shadow-sm'
                : 'text-[var(--color-ink-soft)] hover:text-[var(--color-primary)]'
            )}>
            مقارنة بآية مرجع
          </button>
        </div>
      )}

      {/* Master picker (only shown in master-slave mode) */}
      {view === 'master-slave' && (
        <div className="mb-6">
          <label className="block text-[10px] text-[var(--color-ink-muted)] uppercase tracking-wider mb-1.5 font-bold">
            الآية المرجع
          </label>
          <select value={masterIdx} onChange={(e) => setMasterIdx(parseInt(e.target.value, 10))}
            className="w-full md:w-auto px-3 py-2 text-[13px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md focus:border-[var(--color-primary)] focus:outline-none transition-colors">
            {group.verses.map((v, i) => (
              <option key={v.id} value={i}>
                {i + 1}. {v.surah} — آية {v.ayah}{v.label ? ` (${v.label})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Verses */}
      <ol className="space-y-6 divide-y divide-[var(--color-border-soft)]">
        {group.verses.map((v, vi) => {
          // In master-slave mode, recompute parts via auto-diff against master
          let display: Part[] = v.parts
          if (view === 'master-slave' && vi !== masterIdx) {
            const slaveText = (v.parts || []).map((p) => p.text).join(' ').replace(/\s+/g, ' ').trim()
            const { partsB } = autoColorPair(masterText, slaveText)
            display = partsB
          } else if (view === 'master-slave' && vi === masterIdx) {
            display = [{ type: 'shared', text: masterText }]
          }
          const isCopied = copiedIdx === vi
          return (
            <li key={v.id}
              className="pt-5 md:pt-6 first:pt-0 md:flex md:items-start md:gap-5 relative select-none cursor-default"
              onDoubleClick={() => copyVerse(vi, display, v.surah, v.ayah)}
              onTouchEnd={() => handleDoubleTap(vi, display, v.surah, v.ayah)}>
              {/* Copied flash */}
              {isCopied && (
                <span className="absolute left-0 top-4 md:top-5 z-10 text-[11px] font-bold px-2.5 py-1 rounded-full pointer-events-none animate-fade-rise"
                      style={{ color: 'var(--color-success)', background: 'var(--color-success-bg)' }}>
                  تم النسخ ✓
                </span>
              )}
              {/* Meta — stacked on mobile (above text), column on desktop (left of text) */}
              <div className="md:shrink-0 md:w-24 md:pt-0.5
                              flex md:block items-baseline gap-2 mb-2 md:mb-0 flex-wrap">
                <span className="text-[12px] md:text-[13px] font-bold text-[var(--color-primary)] leading-tight">{v.surah}</span>
                <span className="text-[11px] md:text-[12px] font-mono tabular-nums text-[var(--color-ink-muted)] leading-tight font-bold md:mt-1">
                  {ayahToArabic(v.ayah)}
                </span>
                {v.label && (
                  <span className="text-[10px] md:text-[11px] text-[var(--color-ink-muted)] md:mt-1.5 leading-snug md:block">
                    {v.label}
                  </span>
                )}
                {view === 'master-slave' && vi === masterIdx && (
                  <span className="text-[9px] md:text-[10px] md:mt-2 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded md:inline-block"
                       style={{ color: 'var(--color-primary)', background: 'var(--color-primary-soft)' }}>
                    مرجع
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <ArabicDiff parts={display} size="md" />
              </div>
            </li>
          )
        })}
      </ol>

      {/* Notes */}
      {(group.note || group.unote) && (
        <div className="mt-12 space-y-6">
          {group.note && (
            <div>
              <h2 className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-2 font-bold">
                ملاحظة
              </h2>
              <div className="rich-content text-[14px] leading-[1.9] text-[var(--color-ink)] p-4 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)]"
                   dangerouslySetInnerHTML={{ __html: sanitizeNote(group.note) ?? '' }} dir="rtl" />
            </div>
          )}
          {group.unote && (
            <div>
              <h2 className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase mb-2 font-bold">
                <span className="inline-block w-2.5 h-2.5 rounded-sm align-middle ml-1.5"
                      style={{ background: 'var(--color-diff2)' }} aria-hidden="true" />
                فائدة فريدة
              </h2>
              <div className="rich-content text-[14px] leading-[1.9] text-[var(--color-ink)] p-4 rounded-xl border-2"
                   style={{ background: 'var(--color-diff2-bg)', borderColor: 'var(--color-diff2)' }}
                   dangerouslySetInnerHTML={{ __html: sanitizeNote(group.unote) ?? '' }} dir="rtl" />
            </div>
          )}
        </div>
      )}
    </article>
  )
}
