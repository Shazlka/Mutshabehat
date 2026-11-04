'use client'

import { useMemo } from 'react'
import { buildPageSummary, type SummaryWord } from '../../../../../packages/qiraat-core/features/pageSummary'
import type { QiraatRuling, QiraatVariant } from '../../../../../packages/qiraat-core/types'
import type { QiraatComparisonFilter } from '../../_components/qiraat/types'
import { CREAM_SURFACE, readableInkOn } from '../../../../../packages/qiraat-core/features/contrast'
import { AuthorityPills } from '../host/AuthorityPills'
import { FeatureSheet } from '../host/FeatureSheet'

/** «ملخص الصفحة»: every marked word of the visible page(s) with what is recorded on it. */
export function PageSummarySheet(props: {
  pages: number[]
  words: SummaryWord[]
  variantsByPage: Record<number, readonly QiraatVariant[]>
  rulingsByPage: Record<number, readonly QiraatRuling[]>
  filter: QiraatComparisonFilter
  onSelectWord: (wordId: string) => void
  onClose: () => void
}) {
  const { pages, words, variantsByPage, rulingsByPage, filter, onSelectWord, onClose } = props
  const items = useMemo(
    () => pages.flatMap((page) => buildPageSummary({ page, words, variants: variantsByPage[page] ?? [], rulings: rulingsByPage[page] ?? [], filter })),
    [pages, words, variantsByPage, rulingsByPage, filter],
  )
  return (
    <FeatureSheet title={pages.length > 1 ? `ملخص الصفحتين ${pages.join(' و ')}` : `ملخص الصفحة ${pages[0]}`} onClose={onClose} testId="page-summary">
      {items.length === 0 ? (
        <p data-testid="page-summary-empty" className="text-sm text-[var(--qx-muted)]">لا توجد قراءات على هذه الصفحة.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.wordId}>
              <button
                type="button"
                data-testid="summary-item"
                onClick={() => { onSelectWord(item.wordId); onClose() }}
                className="w-full rounded-lg border border-[var(--mushaf-rule-soft)] bg-white p-2 text-start"
              >
                <span className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="font-[family-name:var(--font-amiri-quran)] text-xl font-bold">{item.text}</span>
                  <span className="text-[11px] font-bold text-[var(--qx-muted)]" dir="ltr">{item.surah}:{item.ayah}</span>
                </span>
                {item.variants.map(({ variant, pills }) => (
                  <span key={variant.id} className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-black">فرش</span>
                    <span className="font-[family-name:var(--font-amiri-quran)] text-lg">{variant.uthmaniText ?? variant.variantText}</span>
                    <AuthorityPills pills={pills} />
                  </span>
                ))}
                {item.rulingGroups.map((group) => (
                  <span key={group.category} className="mb-1 block text-xs">
                    <span className="font-black" style={{ color: readableInkOn(group.rulings[0].ruling.color, CREAM_SURFACE) }}>أصول · {group.categoryAr}</span>
                    {group.rulings.flatMap((r) => r.actionGroups).map((g, i) => (
                      <span key={`${g.action}-${i}`} className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="text-[var(--qx-muted)]">{g.action}</span>
                        <AuthorityPills pills={g.pills} />
                      </span>
                    ))}
                  </span>
                ))}
              </button>
            </li>
          ))}
        </ul>
      )}
    </FeatureSheet>
  )
}
