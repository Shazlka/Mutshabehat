'use client'

import { useState } from 'react'
import { candidates, wordLetters } from './data'
import type { AssignmentRow, DispatchLike, MarkRow, VerseState, WordRef } from './stage-types'
import { AuthorityPill, previewColor } from './authority'
import { Btn, ConfirmBtn, FOCUS, Icon, IconBtn, INPUT, SectionTitle } from './ui'
import { findOrphans } from './ops'
import { SharhPanel } from './SharhPanel'

const ar = (n: number) => n.toLocaleString('ar-EG', { useGrouping: false })
const HEMISTICH = ['الصدر', 'العجز']

export function VerseStage({ state, chapter, position, total, selected, onSelect, onPrev, onNext, onJump, onEditLines, onUnassign, onUnmark, onCopied, onSaveSharh, onRemoveSharh }: {
  state: VerseState
  chapter: string
  position: number
  total: number
  selected: { line: number; index: number } | null
  onSelect: (line: number, index: number) => void
  onPrev: () => void
  onNext: () => void
  onJump: (n: number) => void
  onEditLines: (lines: string[], dropOrphans?: boolean) => DispatchLike
  onUnassign: (ref: WordRef) => void
  onUnmark: (ref: WordRef) => void
  onCopied: () => void
  onSaveSharh: (text: string, title?: string, author?: string) => DispatchLike
  onRemoveSharh: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string[]>(state.verse.lines)
  const [orphans, setOrphans] = useState(0)
  const [problem, setProblem] = useState('')
  const [jump, setJump] = useState('')

  const save = (dropOrphans = false) => {
    const result = onEditLines(draft, dropOrphans)
    if (result.ok) { setEditing(false); setOrphans(0); setProblem(''); return }
    if (result.error === 'ORPHANS') { setOrphans(result.orphans ?? 1); setProblem(''); return }
    setProblem(result.error)
  }
  const pendingOrphans = editing ? findOrphans(state, draft.map(l => l.replace(/\s+/g, ' ').trim())) : { assignments: [], marks: [] }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {/* verse navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-[var(--color-ink-soft)]">{chapter}</p>
          <p className="text-sm font-bold text-[var(--color-ink)]">البيت {ar(state.verse.number)} <span className="font-normal text-[var(--color-ink-muted)]">· {ar(position)} من {ar(total)}{state.verse.printedPage ? ` · ص ${state.verse.printedPage}` : ''}</span></p>
        </div>
        <div className="flex items-center gap-1">
          <form className="flex items-center" onSubmit={e => { e.preventDefault(); const n = Number(jump.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))); if (Number.isInteger(n) && n > 0) { onJump(n); setJump('') } }}>
            <input aria-label="الانتقال إلى بيت برقمه" inputMode="numeric" value={jump} onChange={e => setJump(e.target.value)} placeholder="رقم" className={`${INPUT} w-20 text-center`} />
          </form>
          <IconBtn icon="right" label="البيت السابق (PageUp)" tone="quiet" onClick={onPrev} disabled={position <= 1} />
          <IconBtn icon="left" label="البيت التالي (PageDown)" tone="quiet" onClick={onNext} disabled={position >= total} />
        </div>
      </div>

      {/* the verse */}
      <section aria-label="نص البيت" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 md:px-8">
        {!editing ? (
          <div dir="rtl" className="grid gap-x-10 gap-y-5 md:grid-cols-2">
            {state.verse.lines.map((line, lineIndex) => (
              <div key={lineIndex}>
                <p className="mb-1.5 text-[10px] font-bold text-[var(--color-ink-muted)]">{state.verse.lines.length === 2 ? HEMISTICH[lineIndex] : 'الشطر'}</p>
                <div className="flex flex-wrap gap-x-1 gap-y-2">
                  {candidates(line).map((w, index) => {
                    const row = state.assignments.find(a => a.line === lineIndex && a.occurrence === w.occurrence && a.word === w.text)
                    const mark = state.marks.find(m => m.line === lineIndex && m.occurrence === w.occurrence && m.word === w.text)
                    const isSelected = selected?.line === lineIndex && selected.index === index
                    const color = row ? previewColor(row.readingIds) : undefined
                    const letters = wordLetters(w.text)
                    return (
                      <button key={`${index}-${w.text}`} type="button" aria-pressed={isSelected}
                        aria-label={`${w.text}${row ? `، ${row.readingIds.length} من القراء والرواة` : ''}${mark ? `، رمز ${mark.symbol}` : ''}`}
                        onClick={() => onSelect(lineIndex, index)}
                        className={`font-quran relative cursor-pointer rounded-lg px-2 pb-2.5 pt-1 text-[28px] leading-[1.9] transition-colors duration-150 md:text-[32px] ${FOCUS} ${isSelected ? 'bg-[var(--color-primary-soft)] outline-2 outline-[var(--color-primary)]' : 'hover:bg-[var(--color-surface-2)]'}`}>
                        {row?.mode === 'letter' ? letters.map((l, i) => <span key={i} style={i === (row.letterIndex ?? 0) ? { color, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 6 } : undefined}>{l}</span>) : w.text}
                        {row && (
                          <span className="absolute inset-x-2 bottom-0.5 flex justify-center gap-0.5" aria-hidden="true">
                            {row.readingIds.slice(0, 6).map(id => <span key={id} className="h-1 min-w-3 flex-1 rounded-full" style={{ backgroundColor: previewColor([id]) }} />)}
                          </span>
                        )}
                        {mark && <span className="absolute -top-0.5 end-0 grid size-5 place-items-center rounded-full bg-[var(--color-unique)] text-[11px] font-bold leading-none text-white" aria-hidden="true">{mark.symbol.length > 2 ? '·' : mark.symbol}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {draft.map((line, i) => (
              <label key={i} className="block">
                <span className="mb-1 block text-[11px] font-bold text-[var(--color-ink-soft)]">{draft.length === 2 ? HEMISTICH[i] : 'الشطر'}</span>
                <textarea dir="rtl" rows={2} value={line} onChange={e => setDraft(d => d.map((x, j) => j === i ? e.target.value : x))} className={`font-quran w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-3 text-2xl leading-[2] ${FOCUS}`} />
              </label>
            ))}
            {(orphans > 0 || pendingOrphans.assignments.length + pendingOrphans.marks.length > 0) && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-[var(--color-warn-bg)] p-3 text-xs leading-5 text-[var(--color-ink)]">
                <Icon name="alert" size={16} className="mt-0.5 text-[var(--color-warn)]" />
                <span>{ar(pendingOrphans.assignments.length + pendingOrphans.marks.length || orphans)} من التعيينات أو الرموز على كلمات لم تعد في النص. عند الحفظ سيُسأل عن حذفها.</span>
              </p>
            )}
            {problem && <p role="alert" className="text-xs font-bold text-[var(--color-danger)]">{problem}</p>}
            <div className="flex flex-wrap gap-2">
              {orphans > 0
                ? <Btn tone="primary" onClick={() => save(true)}>احذف المتأثرة واحفظ</Btn>
                : <Btn tone="primary" icon="check" onClick={() => save(false)}>حفظ النص</Btn>}
              <Btn onClick={() => { setEditing(false); setDraft(state.verse.lines); setOrphans(0); setProblem('') }}>إلغاء</Btn>
            </div>
          </div>
        )}

        {!editing && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border-soft)] pt-3">
            <p className="text-xs text-[var(--color-ink-muted)]">اختر كلمة ثم عيّن القراء والرواة من اللوحة.</p>
            <div className="flex gap-1.5">
              <Btn compact icon="edit" onClick={() => { setDraft(state.verse.lines); setEditing(true) }}>تحرير النص</Btn>
              <Btn compact icon="copy" onClick={() => { void navigator.clipboard?.writeText(state.verse.lines.join(' ... ')); onCopied() }}>نسخ</Btn>
            </div>
          </div>
        )}
      </section>

      <SharhPanel state={state} onSave={onSaveSharh} onRemove={onRemoveSharh} />

      {/* what is attached to this verse */}
      <section aria-label="تعيينات البيت">
        <SectionTitle aside={<span className="text-[11px] text-[var(--color-ink-muted)]">{ar(state.assignments.length)}</span>}>التعيينات في هذا البيت</SectionTitle>
        {state.assignments.length === 0
          ? <p className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-ink-soft)]">لا تعيينات بعد. اختر كلمة من البيت ثم قارئًا أو راويًا.</p>
          : <ul className="divide-y divide-[var(--color-border-soft)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              {[...state.assignments].sort((a, b) => a.line - b.line).map(a => <AssignmentRowView key={a.id} row={a} state={state} onSelect={onSelect} onUnassign={onUnassign} />)}
            </ul>}
      </section>

      {state.marks.length > 0 && (
        <section aria-label="رموز المتن">
          <SectionTitle aside={<span className="text-[11px] text-[var(--color-ink-muted)]">{ar(state.marks.length)}</span>}>رموز المتن في هذا البيت</SectionTitle>
          <ul className="divide-y divide-[var(--color-border-soft)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            {state.marks.map(m => <MarkRowView key={m.id} row={m} state={state} onSelect={onSelect} onUnmark={onUnmark} />)}
          </ul>
        </section>
      )}
    </div>
  )
}

function indexOfWord(state: VerseState, row: { line: number; word: string; occurrence: number }): number {
  return candidates(state.verse.lines[row.line] ?? '').findIndex(w => w.text === row.word && w.occurrence === row.occurrence)
}

function AssignmentRowView({ row, state, onSelect, onUnassign }: { row: AssignmentRow; state: VerseState; onSelect: (l: number, i: number) => void; onUnassign: (r: WordRef) => void }) {
  const index = indexOfWord(state, row)
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
      <button type="button" disabled={index < 0} onClick={() => onSelect(row.line, index)} className={`font-quran cursor-pointer rounded-md px-1 text-xl text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] ${FOCUS}`} aria-label={`تحديد الكلمة ${row.word}`}>{row.word}{row.mode === 'letter' && <span className="ms-1 text-[10px] font-bold text-[var(--color-ink-muted)]">حرف {ar((row.letterIndex ?? 0) + 1)}</span>}</button>
      <span className="flex min-w-0 flex-1 flex-wrap gap-1">{row.readingIds.map(id => <AuthorityPill key={id} id={id} size="sm" />)}</span>
      {row.note && <span className="basis-full text-[11px] text-[var(--color-ink-soft)]">{row.note}</span>}
      <ConfirmBtn compact label="حذف" confirmLabel="تأكيد الحذف" onConfirm={() => onUnassign({ line: row.line, word: row.word, occurrence: row.occurrence })} />
    </li>
  )
}

function MarkRowView({ row, state, onSelect, onUnmark }: { row: MarkRow; state: VerseState; onSelect: (l: number, i: number) => void; onUnmark: (r: WordRef) => void }) {
  const index = indexOfWord(state, row)
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
      <span className="grid size-6 place-items-center rounded-full bg-[var(--color-unique-bg)] text-xs font-bold text-[var(--color-unique)]">{row.symbol}</span>
      <button type="button" disabled={index < 0} onClick={() => onSelect(row.line, index)} className={`font-quran cursor-pointer rounded-md px-1 text-xl hover:bg-[var(--color-surface-2)] ${FOCUS}`}>{row.word}</button>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {row.readingIds.map(id => <AuthorityPill key={id} id={id} size="sm" />)}
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${row.status === 'verified' ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' : 'bg-[var(--color-warn-bg)] text-[var(--color-ink-soft)]'}`}>{row.status === 'verified' ? 'موثّق' : 'غير موثّق'}</span>
      </span>
      <ConfirmBtn compact label="حذف" confirmLabel="تأكيد الحذف" onConfirm={() => onUnmark({ line: row.line, word: row.word, occurrence: row.occurrence })} />
    </li>
  )
}
