'use client'

import { useState, useMemo } from 'react'
import ArabicDiff, { type Part } from './ArabicDiff'
import ImageShareButton from './ImageShareButton'
import { ayahToArabic } from '@/lib/arabic'
import { autoColorPair } from '@/lib/diff'
import { cn } from '@/lib/cn'

interface Verse {
  id: string; surah: string; ayah: number; label: string | null
  parts: Part[]
}
interface Group {
  id: string; title: string; color: string
  status: 'draft' | 'published' | 'locked'
  favorite: boolean; completed: boolean
  note: string | null; unote: string | null
  verses: Verse[]
}

export default function GroupDetail({ group }: { group: Group }) {
  const [view, setView] = useState<'as-is' | 'master-slave'>('as-is')
  const [masterIdx, setMasterIdx] = useState(0)

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
          <h1 id="g-title" className="text-[22px] md:text-[26px] font-bold text-[var(--color-ink)] leading-tight">
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
          return (
            <li key={v.id} className="pt-6 first:pt-0 flex items-start gap-5">
              <div className="shrink-0 w-24 pt-0.5">
                <div className="text-[13px] font-bold text-[var(--color-primary)] leading-tight">{v.surah}</div>
                <div className="text-[11px] text-[var(--color-ink-soft)] mt-1 font-bold">
                  آية {ayahToArabic(v.ayah)}
                </div>
                {v.label && (
                  <div className="text-[11px] text-[var(--color-ink-muted)] mt-1.5 leading-snug">
                    {v.label}
                  </div>
                )}
                {view === 'master-slave' && vi === masterIdx && (
                  <div className="text-[10px] mt-2 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded inline-block"
                       style={{ color: 'var(--color-primary)', background: 'var(--color-primary-soft)' }}>
                    مرجع
                  </div>
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
                   dangerouslySetInnerHTML={{ __html: group.note }} dir="rtl" />
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
                   dangerouslySetInnerHTML={{ __html: group.unote }} dir="rtl" />
            </div>
          )}
        </div>
      )}
    </article>
  )
}
