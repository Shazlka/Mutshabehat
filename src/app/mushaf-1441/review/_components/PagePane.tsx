'use client'

// D5 — the rendered Hafs page, with variant words highlighted by the covering row's status.
// D9 — this is the RIGHT pane (rendered first in ReviewApp's RTL flex row).
//
// Words render `words[].text` verbatim — never retyped, normalised or "fixed".

import { useMemo } from 'react'
import type { ReviewPage, ReviewRow, ReviewWord } from '../_lib/types'
import { STATUS_BG_VAR, STATUS_COLOR_VAR, worstStatus } from './statusMeta'

type Props = {
  page: ReviewPage
  selectedRow: ReviewRow | null
  hoveredRowId: string | null
  onSelectWord(key: string): void
  onHoverWord(rowIds: string[] | null): void
}

// A word is covered by a row when startKey <= key <= endKey (string compare — safe because the
// keys are zero-padded SSS:AAA:WWW and never cross a surah within one row).
function buildWordRowsMap(page: ReviewPage): Map<string, ReviewRow[]> {
  const map = new Map<string, ReviewRow[]>()
  const rows = page.rows.filter((row) => !row.deleted)
  for (const word of page.words) {
    const covering = rows.filter((row) => row.startKey <= word.key && word.key <= row.endKey)
    if (covering.length) map.set(word.key, covering)
  }
  return map
}

function groupByLine(words: ReviewWord[]): [number, ReviewWord[]][] {
  const byLine = new Map<number, ReviewWord[]>()
  for (const word of words) {
    const list = byLine.get(word.line)
    if (list) list.push(word)
    else byLine.set(word.line, [word])
  }
  for (const list of byLine.values()) list.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  return [...byLine.entries()].sort((a, b) => a[0] - b[0])
}

export default function PagePane({ page, selectedRow, hoveredRowId, onSelectWord, onHoverWord }: Props) {
  const wordRowsMap = useMemo(() => buildWordRowsMap(page), [page])
  const lines = useMemo(() => groupByLine(page.words), [page.words])

  return (
    <section
      dir="rtl"
      aria-label="نص الصفحة"
      className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--color-surface)] px-6 py-6"
    >
      <header className="mb-4 flex items-center justify-between border-b border-[var(--color-border-soft)] pb-3">
        <h2 className="text-sm font-bold text-[var(--color-ink)]">صفحة {page.page}</h2>
        <p className="text-xs text-[var(--color-ink-muted)]">
          الإجمالي {page.stats.total} · غير مراجَع {page.stats.unreviewed} · معلَّم {page.stats.flagged} · مُراجَع{' '}
          {page.stats.reviewed}
        </p>
      </header>

      <div className="flex flex-1 flex-col justify-start gap-3 font-quran text-[26px] text-[var(--color-ink)]">
        {lines.map(([lineNumber, words]) => (
          <div key={lineNumber} className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1">
            {words.map((word) => {
              const covering = wordRowsMap.get(word.key)
              const status = covering ? worstStatus(covering.map((row) => row.reviewStatus)) : null
              const isSelected = covering?.some((row) => row.entryId === selectedRow?.entryId) ?? false
              const isHovered = covering?.some((row) => row.entryId === hoveredRowId) ?? false
              return (
                <button
                  key={word.key}
                  type="button"
                  data-word-key={word.key}
                  onClick={() => covering && onSelectWord(word.key)}
                  onMouseEnter={() => covering && onHoverWord(covering.map((row) => row.entryId))}
                  onMouseLeave={() => onHoverWord(null)}
                  onFocus={() => covering && onHoverWord(covering.map((row) => row.entryId))}
                  onBlur={() => onHoverWord(null)}
                  disabled={!covering}
                  aria-label={`${word.text} — ${word.surah}:${word.ayah}:${word.word}`}
                  aria-pressed={isSelected}
                  className="rounded px-0.5 py-0.5 leading-[2.4] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-default"
                  style={
                    status
                      ? {
                          color: `var(${STATUS_COLOR_VAR[status]})`,
                          background: `var(${STATUS_BG_VAR[status]})`,
                          outline: isSelected
                            ? '2px solid var(--color-primary)'
                            : isHovered
                              ? '1.5px dashed var(--color-primary)'
                              : undefined,
                          outlineOffset: isSelected || isHovered ? '1px' : undefined,
                        }
                      : undefined
                  }
                >
                  {word.text}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <p className="mt-6 border-t border-[var(--color-border-soft)] pt-3 text-[11px] text-[var(--color-ink-muted)]">
        الكلمات الملوّنة مرتبطة بقراءة أو أصل مُسجَّل. مرّر المؤشر فوق كلمة لإبراز صفّها في الجدول، واضغط عليها
        لفتحه.
      </p>
    </section>
  )
}
