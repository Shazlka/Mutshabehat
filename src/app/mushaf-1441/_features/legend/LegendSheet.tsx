'use client'

import { useMemo, useState } from 'react'
import { legendRows, type LegendRow } from '../../../../../packages/qiraat-core/features/legend'
import type { QiraatRuling, QiraatVariant } from '../../../../../packages/qiraat-core/types'
import { FeatureSheet } from '../host/FeatureSheet'

type Tab = 'readers' | 'abwab' | 'marks'
const TABS: { id: Tab; label: string }[] = [
  { id: 'readers', label: 'القرّاء' },
  { id: 'abwab', label: 'الأبواب' },
  { id: 'marks', label: 'العلامات' },
]

/** The word «كلمة» drawn the way the page draws that mark, so a mark row shows its shape, not only words about it. */
function MarkSample({ markKey }: { markKey: string }) {
  const line = (style: React.CSSProperties) => ({ paddingBottom: 2, ...style })
  const dot = (pos: React.CSSProperties, extra: React.CSSProperties = {}) => (
    <span aria-hidden="true" style={{ position: 'absolute', width: 6, height: 6, borderRadius: 9999, background: '#C026D3', ...pos, ...extra }} />
  )
  const styles: Record<string, React.CSSProperties> = {
    'mark-solid': line({ borderBottom: '2px solid #2563EB' }),
    'mark-segmented': line({ borderBottom: '2px solid transparent', borderImage: 'linear-gradient(to left, #2563EB 33%, #16A34A 33% 66%, #DC2626 66%) 1' }),
    'mark-performance': line({ borderBottom: '2px solid #4F46E5' }),
    'mark-unresolved': line({ borderBottom: '2px solid #8a8a8a' }),
    'mark-dotted': line({ borderBottom: '2px dotted #C026D3' }),
    'mark-ruling-word': { color: '#C026D3' },
  }
  return (
    <span aria-hidden="true" className="relative inline-block shrink-0 px-2 font-[family-name:var(--font-amiri-quran)] text-lg" style={styles[markKey]}>
      كلمة
      {markKey === 'mark-family' ? dot({ top: 0, left: 0 }) : null}
      {markKey === 'mark-imalah' ? dot({ bottom: -2, left: 0 }) : null}
      {markKey === 'mark-taqlil' ? dot({ bottom: -2, left: 0 }, { background: 'transparent', border: '1.5px solid #C026D3' }) : null}
    </span>
  )
}

function Row({ row, nested }: { row: LegendRow; nested?: boolean }) {
  return (
    <li data-testid={`legend-row-${row.key}`} className={`flex items-start gap-2 rounded border border-[var(--mushaf-rule-soft)] bg-white p-2 ${nested ? 'ms-4' : ''}`}>
      {row.key.startsWith('mark-')
        ? <MarkSample markKey={row.key} />
        : <span aria-hidden="true" className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full border border-[var(--mushaf-rule)]" style={{ background: row.color }} />}
      <span className="flex-1 text-xs">
        <span className="font-black">{row.label}</span>
        {row.explanation ? <span className="mt-0.5 block leading-5 text-[var(--mushaf-muted)]">{row.explanation}</span> : null}
      </span>
      {row.sampleWord ? (
        <span className="text-end text-[11px] text-[var(--mushaf-muted)]">
          <span className="block font-[family-name:var(--font-amiri-quran)] text-lg text-[var(--mushaf-ink)]">{row.sampleWord.text}</span>
          ص {row.sampleWord.page}
        </span>
      ) : null}
    </li>
  )
}

/** «مفتاح الألوان»: what each line, dot and colour on the page means, with a real word per row. */
export function LegendSheet(props: {
  variantsByPage: Record<number, readonly QiraatVariant[]>
  rulingsByPage: Record<number, readonly QiraatRuling[]>
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('readers')
  const rows = useMemo(() => legendRows(props.variantsByPage, props.rulingsByPage), [props.variantsByPage, props.rulingsByPage])
  return (
    <FeatureSheet title="مفتاح الألوان" onClose={props.onClose} testId="legend-sheet">
      <div role="tablist" className="mb-3 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-6 flex-1 rounded border px-2 py-1 text-xs font-bold [@media(pointer:coarse)]:min-h-11 ${tab === t.id ? 'border-[var(--mushaf-ink)] bg-[var(--mushaf-ink)] text-white' : 'border-[var(--mushaf-rule)]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ul className="space-y-1.5">
        {tab === 'readers'
          ? rows.readers.flatMap((reader) => [
              <Row key={reader.key} row={reader} />,
              ...rows.narrators.filter((n) => n.key.startsWith(`${reader.key}-`)).map((n) => <Row key={n.key} row={{ ...n, explanation: undefined }} nested />),
            ])
          : null}
        {tab === 'abwab' ? (rows.abwab.length > 0 ? rows.abwab.map((row) => <Row key={row.key} row={row} />) : <li className="text-xs text-[var(--mushaf-muted)]">تظهر الأبواب بعد تحميل صفحات فيها أحكام.</li>) : null}
        {tab === 'marks' ? rows.marks.map((row) => <Row key={row.key} row={row} />) : null}
      </ul>
    </FeatureSheet>
  )
}
