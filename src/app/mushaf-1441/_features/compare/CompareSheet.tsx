'use client'

import { useMemo, useState } from 'react'
import {
  compare, defaultLocus, defaultPair, loci,
  type CompareSelection, type ComparedUsul, type Voice,
} from '../../../../../packages/qiraat-core/features/compare'
import type { QiraatComparisonFilter } from '../../_components/qiraat/types'
import { FeatureSheet } from '../host/FeatureSheet'
import { ReaderPicker } from '../reader-picker/ReaderPicker'

const ALL: QiraatComparisonFilter = { kind: 'all' }

function sourceLabel(source: { kind: 'variant' } | { kind: 'base'; sameAsHafs: boolean }): string {
  if (source.kind === 'variant') return 'وجه مسجَّل في البيانات'
  return source.sameAsHafs ? 'كحفص (لا اختلاف مسجَّل)' : 'على رسم المصحف (لم يُذكر له وجه)'
}

function UsulLine({ usul }: { usul: ComparedUsul }) {
  return (
    <li className="rounded border border-[var(--mushaf-rule-soft)] p-1.5 text-[11px]">
      <span className="font-black" style={{ color: usul.color }}>{usul.categoryAr}</span>
      {usul.status.kind === 'entries' ? (
        <ul className="mt-0.5 space-y-0.5">
          {usul.status.entries.map((e, i) => (
            <li key={i}>
              {e.wajhOrder && e.wajhOrder > 1 ? <b>وجه {e.wajhOrder}: </b> : null}{e.action}
              {e.condition ? <span className="text-[var(--mushaf-muted)]"> ({e.condition})</span> : null}
              {e.wajhNote ? <span className="block text-[var(--mushaf-muted)]">الخلاف: {e.wajhNote}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <span className="block text-[var(--mushaf-muted)]">{usul.status.sameAsHafs ? 'لم يُذكر: كحفص' : 'لم يُذكر: على الأصل'}</span>
      )}
    </li>
  )
}

function VoiceColumn({ voice }: { voice: Voice }) {
  return (
    <div data-testid={`compare-voice-${voice.authorityId}`} className="rounded-lg border bg-white p-2" style={{ borderColor: voice.color }}>
      <p className="mb-1 text-xs font-black" style={{ color: voice.color }}>{voice.name}</p>
      <ul className="space-y-1">
        {voice.content.wajhs.map((w, i) => (
          <li key={i} className="text-center">
            <span className="block font-[family-name:var(--font-amiri-quran)] text-2xl">{w.text}</span>
            {w.note ? <span className="block text-[11px] font-bold">{w.note}</span> : null}
            <span className="block text-[11px] text-[var(--mushaf-muted)]">{sourceLabel(w.source)}</span>
          </li>
        ))}
      </ul>
      {voice.content.usul.length > 0 ? <ul className="mt-2 space-y-1">{voice.content.usul.map((u) => <UsulLine key={u.groupId} usul={u} />)}</ul> : null}
    </div>
  )
}

/** «مقارنة»: what two readers or narrators read at the open word, side by side. */
export function CompareSheet(props: { word: { surah: number; ayah: number; token: number; text: string }; selection: CompareSelection; onClose: () => void }) {
  const { word, selection, onClose } = props
  const [pair, setPair] = useState<[string, string] | null>(() => defaultPair(selection))
  const [choosing, setChoosing] = useState(false)
  const all = useMemo(() => loci(selection), [selection])
  const [locusIndex, setLocusIndex] = useState<number | null>(null)
  const locus = locusIndex !== null ? all[locusIndex] : defaultLocus(all, word)
  const result = useMemo(() => (pair && locus ? compare(pair[0], pair[1], locus, word.text) : null), [pair, locus, word.text])

  if (choosing || !pair) {
    return <ReaderPicker filter={ALL} onPick={() => undefined} onClose={() => (pair ? setChoosing(false) : onClose())} onCompare={(ids) => { setPair(ids); setChoosing(false) }} />
  }
  return (
    <FeatureSheet title="مقارنة" onClose={onClose} testId="compare-sheet">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="font-[family-name:var(--font-amiri-quran)] text-2xl">{word.text}</span>
        <button type="button" data-testid="compare-change" onClick={() => setChoosing(true)} className="min-h-6 rounded border border-[var(--mushaf-rule)] px-3 text-xs font-bold [@media(pointer:coarse)]:min-h-11">تغيير القارئين</button>
      </div>
      {all.length > 1 ? (
        <label className="mb-3 block text-[11px] font-bold">
          الموضع المقارَن
          <select value={locusIndex ?? Math.max(0, locus ? all.indexOf(locus) : 0)} onChange={(e) => setLocusIndex(Number(e.target.value))} className="mt-1 min-h-6 w-full rounded border border-[var(--mushaf-rule)] bg-white px-2 py-1 text-xs [@media(pointer:coarse)]:min-h-11">
            {all.map((l, i) => <option key={i} value={i}>{l.ayah}:{l.startToken}{l.endToken !== l.startToken ? `–${l.endToken}` : ''}</option>)}
          </select>
        </label>
      ) : null}
      {result ? (
        <>
          <p data-testid="compare-verdict" className={`mb-3 rounded px-2 py-1 text-xs font-black ${result.isSame ? 'bg-[#e4f1df] text-[#2a5a1f]' : 'bg-[#fbe9d3] text-[#7a3d10]'}`}>
            {result.isSame ? '✓ يقرآن الكلمة بالطريقة نفسها' : '≠ يختلفان في قراءة الكلمة'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[result.first, result.second].map((reading, i) => (
              <div key={`${reading.authorityId}-${i}`} className="space-y-2">
                {reading.voices.length === 0 ? <p className="text-xs text-[var(--mushaf-muted)]">غير معروف.</p> : reading.voices.map((voice) => <VoiceColumn key={voice.authorityId} voice={voice} />)}
              </div>
            ))}
          </div>
        </>
      ) : <p className="text-xs text-[var(--mushaf-muted)]">لا بيانات لهذه الكلمة.</p>}
    </FeatureSheet>
  )
}
