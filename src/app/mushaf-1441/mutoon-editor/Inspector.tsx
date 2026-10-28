'use client'

import { useMemo, useState } from 'react'
import { AUTHORITIES, CLASSICAL_GROUPS, definitions, insertWordInLine, key, wordKey, wordLetters, type WorkId } from './data'
import type { DispatchLike, Intent, VerseState, WordRef } from './stage-types'
import { authorityColor, authorityLabel, describeAuthorities } from './authority'
import { Btn, CommitInput, ConfirmBtn, Field, FOCUS, Icon, INPUT, Segmented, SectionTitle, TOUCH } from './ui'

type Props = {
  state: VerseState
  work: WorkId
  word: (WordRef & { index: number; text: string }) | null
  onIntent: (intent: Intent) => DispatchLike
  onError: (message: string) => void
}

const ar = (n: number) => n.toLocaleString('ar-EG', { useGrouping: false })

export function Inspector({ state, work, word, onIntent, onError }: Props) {
  const [scope, setScope] = useState<{ mode: 'word' | 'letter'; letterIndex: number }>({ mode: 'word', letterIndex: 0 })
  const [filter, setFilter] = useState('')

  const ref = word ? { line: word.line, word: word.word, occurrence: word.occurrence } : null
  const assignment = useMemo(
    () => (ref ? state.assignments.find(a => a.line === ref.line && a.occurrence === ref.occurrence && a.word === ref.word) : undefined),
    [state.assignments, ref?.line, ref?.occurrence, ref?.word], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const mark = ref ? state.marks.find(m => m.line === ref.line && m.occurrence === ref.occurrence && m.word === ref.word) : undefined

  const run = (intent: Intent) => { const result = onIntent(intent); if (!result.ok) onError(result.error) }

  if (!word || !ref) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div className="max-w-56 space-y-2">
          <Icon name="book" size={28} className="mx-auto text-[var(--color-ink-muted)]" />
          <p className="text-sm font-bold text-[var(--color-ink)]">اختر كلمة من البيت</p>
          <p className="text-xs leading-5 text-[var(--color-ink-soft)]">ثم أضف إليها القراء والرواة. يُحفظ كل تعيين فور اختياره ويظهر في التطبيق على الجوال.</p>
        </div>
      </div>
    )
  }

  const current = assignment ? { mode: assignment.mode ?? 'word', letterIndex: assignment.letterIndex ?? 0 } : scope
  const ids = assignment?.readingIds ?? []
  const q = key(filter)
  const readers = Array.from({ length: 10 }, (_, i) => AUTHORITIES.slice(i * 3, i * 3 + 3))
    .filter(([r, n1, n2]) => !q || [r, n1, n2].some(a => key(a.name).includes(q)) || r.id.toLowerCase() === filter.toLowerCase())
  const symbols = definitions(work).filter(d => d.symbol.length === 1 ? key(d.symbol) === (key(word.text)[0] ?? '') : key(d.symbol) === key(word.text) || wordKey(d.symbol) === wordKey(word.text))

  const authorityToggle = (id: string) => {
    const on = ids.includes(id)
    const color = authorityColor(id)
    return (
      <button key={id} type="button" aria-pressed={on} onClick={() => run({ k: 'authority', ref, scope: current, id })}
        className={`flex min-w-0 cursor-pointer items-center justify-between gap-1.5 rounded-lg border px-2.5 text-start text-xs font-bold transition-colors duration-150 ${TOUCH} ${FOCUS} ${on ? '' : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'}`}
        style={on ? { borderColor: color, backgroundColor: `color-mix(in oklab, ${color} 14%, white)`, color: `color-mix(in oklab, ${color} 72%, black)` } : undefined}>
        <span className="flex min-w-0 items-center gap-1.5"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" /><span className="truncate">{authorityLabel(id)}</span></span>
        {on && <Icon name="check" size={14} />}
      </button>
    )
  }

  return (
    <div className="space-y-5 p-4">
      {/* the word */}
      <section>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-quran text-4xl leading-[1.8] text-[var(--color-ink)]">{word.text}</p>
            <p className="text-[11px] text-[var(--color-ink-muted)]">{state.verse.lines.length === 2 ? (word.line === 0 ? 'الصدر' : 'العجز') : 'الشطر'} · الكلمة {ar(word.index + 1)}</p>
          </div>
          {assignment && <ConfirmBtn compact label="إزالة التعيين" confirmLabel="تأكيد الإزالة" onConfirm={() => run({ k: 'unassign', ref })} />}
        </div>
        {assignment && <p className="mt-2 text-xs leading-5 text-[var(--color-ink-soft)]">{describeAuthorities(assignment.readingIds)}</p>}
      </section>

      {/* what carries the reading */}
      <section>
        <SectionTitle>موضع القراءة</SectionTitle>
        <Segmented label="موضع القراءة" value={current.mode} onChange={mode => {
          const next = { mode, letterIndex: current.letterIndex }
          setScope(next)
          if (assignment) run({ k: 'scope', ref, scope: next })
        }} options={[{ value: 'word', label: 'الكلمة كاملة' }, { value: 'letter', label: 'حرف محدد' }]} />
        {current.mode === 'letter' && (
          <div className="mt-2 flex flex-wrap gap-1.5" dir="rtl" role="radiogroup" aria-label="الحرف">
            {wordLetters(word.text).map((letter, i) => (
              <button key={i} type="button" role="radio" aria-checked={current.letterIndex === i}
                onClick={() => { const next = { mode: 'letter' as const, letterIndex: i }; setScope(next); if (assignment) run({ k: 'scope', ref, scope: next }) }}
                className={`font-quran grid min-w-10 cursor-pointer place-items-center rounded-lg border px-2 text-xl transition-colors duration-150 ${TOUCH} ${FOCUS} ${current.letterIndex === i ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]'}`}>
                {letter}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* groups */}
      <section>
        <SectionTitle aside={<span className="text-[10px] text-[var(--color-ink-muted)]">تضيف الجميع أو تزيلهم</span>}>مجموعات جاهزة</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {CLASSICAL_GROUPS.map(g => {
            const full = g.readingIds.every(id => ids.includes(id))
            return (
              <button key={g.id} type="button" aria-pressed={full} title={g.description} onClick={() => run({ k: 'group', ref, scope: current, ids: g.readingIds })}
                className={`cursor-pointer rounded-lg border px-2.5 text-xs font-bold transition-colors duration-150 ${TOUCH} ${FOCUS} ${full ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]'}`}>
                {full && <Icon name="check" size={12} className="me-1 inline" />}{g.name}
              </button>
            )
          })}
        </div>
      </section>

      {/* readers and narrators */}
      <section>
        <SectionTitle aside={<span className="text-[11px] text-[var(--color-ink-muted)]">{ar(ids.length)} محدد</span>}>القراء والرواة</SectionTitle>
        <input type="search" aria-label="ابحث عن قارئ أو راوٍ" value={filter} onChange={e => setFilter(e.target.value)} placeholder="ابحث: حفص، ورش، نافع" className={`${INPUT} mb-2`} />
        <div className="space-y-2">
          {readers.map(([reader, n1, n2]) => (
            <div key={reader.id} className="space-y-1.5 rounded-xl bg-[var(--color-paper)] p-2">
              {authorityToggle(reader.id)}
              <div className="grid grid-cols-2 gap-1.5">{authorityToggle(n1.id)}{authorityToggle(n2.id)}</div>
            </div>
          ))}
          {readers.length === 0 && <p className="p-3 text-center text-xs text-[var(--color-ink-soft)]">لا قارئ بهذا الاسم.</p>}
        </div>
      </section>

      {/* note and source */}
      <section>
        <SectionTitle>التوثيق</SectionTitle>
        {assignment ? (
          <div className="space-y-2">
            <Field label="المصدر"><CommitInput label="المصدر" value={assignment.source} placeholder="مثال: الوافي في شرح الشاطبية، ص ٥٠" onCommit={source => run({ k: 'details', ref, source })} /></Field>
            <Field label="ملاحظة"><CommitInput label="ملاحظة" value={assignment.note} placeholder="مثال: إمالة الألف، تسهيل الهمز" onCommit={note => run({ k: 'details', ref, note })} /></Field>
          </div>
        ) : <p className="rounded-lg border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-ink-soft)]">اختر قارئًا أو راويًا أولًا لإضافة مصدر وملاحظة.</p>}
      </section>

      {/* the poem's own symbol */}
      <SymbolSection work={work} symbols={symbols} mark={mark} onAdd={(symbol, note, source, verified) => run({ k: 'mark', ref, symbol, note, source, verified })} onRemove={() => run({ k: 'unmark', ref })} />

      {/* the word's text */}
      <WordText state={state} word={word} onIntent={run} />
    </div>
  )
}

function SymbolSection({ symbols, mark, onAdd, onRemove }: {
  work: WorkId
  symbols: ReturnType<typeof definitions>
  mark: VerseState['marks'][number] | undefined
  onAdd: (symbol: string, note: string, source: string, verified: boolean) => void
  onRemove: () => void
}) {
  const [source, setSource] = useState('')
  const [note, setNote] = useState('')
  const [verified, setVerified] = useState(true)
  return (
    <section>
      <SectionTitle>رمز المتن</SectionTitle>
      {mark && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-[var(--color-unique-bg)] p-2.5 text-xs">
          <span><b className="text-[var(--color-unique)]">{mark.symbol}</b> · {describeAuthorities(mark.readingIds)} · {mark.status === 'verified' ? 'موثّق' : 'غير موثّق'}</span>
          <ConfirmBtn compact label="إزالة" confirmLabel="تأكيد" onConfirm={onRemove} />
        </div>
      )}
      {symbols.length === 0 ? <p className="text-xs text-[var(--color-ink-soft)]">لا رمز في هذا المتن يبدأ به هذا الحرف أو يطابق هذه الكلمة.</p> : (
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Field label="مصدر التوثيق"><input className={INPUT} aria-label="مصدر توثيق الرمز" value={source} onChange={e => setSource(e.target.value)} placeholder="الوافي، الهادي…" /></Field>
            <Field label="ملاحظة"><input className={INPUT} aria-label="ملاحظة الرمز" value={note} onChange={e => setNote(e.target.value)} /></Field>
            <label className={`flex cursor-pointer items-center gap-2 text-xs ${TOUCH}`}><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />موثّق على الشرح (يظهر في التطبيق)</label>
          </div>
          {symbols.map(d => (
            <div key={d.symbol} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] p-2 text-xs">
              <span><b className="text-[var(--color-unique)]">{d.symbol}</b> · {describeAuthorities(d.readingIds)}</span>
              <Btn compact tone="primary" onClick={() => { onAdd(d.symbol, note, source, verified); setSource(''); setNote('') }}>{mark?.symbol === d.symbol ? 'تحديث' : 'اعتماد'}</Btn>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function WordText({ state, word, onIntent }: { state: VerseState; word: NonNullable<Props['word']>; onIntent: (i: Intent) => void }) {
  const [mode, setMode] = useState<'none' | 'rename' | 'insert'>('none')
  const [text, setText] = useState('')
  const [after, setAfter] = useState(true)
  const lineText = state.verse.lines[word.line] ?? ''
  const withLine = (replacement: string) => state.verse.lines.map((l, i) => (i === word.line ? replacement : l))
  const clean = (s: string) => s.trim()

  return (
    <section>
      <SectionTitle>تحرير الكلمة</SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        <Btn compact icon="edit" onClick={() => { setMode(mode === 'rename' ? 'none' : 'rename'); setText(word.text) }}>تصحيح</Btn>
        <Btn compact icon="plus" onClick={() => { setMode(mode === 'insert' ? 'none' : 'insert'); setText('') }}>إدراج كلمة</Btn>
        <ConfirmBtn compact label="حذف الكلمة" confirmLabel="تأكيد حذف الكلمة" onConfirm={() => {
          const tokens = lineText.split(/\s+/).filter(Boolean)
          tokens.splice(word.index, 1)
          onIntent({ k: 'lines', lines: withLine(tokens.join(' ')), drop: { line: word.line, word: word.word, occurrence: word.occurrence } })
        }} />
      </div>
      {mode !== 'none' && (
        <form className="mt-2 space-y-2" onSubmit={e => {
          e.preventDefault()
          const value = clean(text)
          if (!value) return
          if (mode === 'rename') {
            const tokens = lineText.split(/\s+/).filter(Boolean)
            tokens[word.index] = value
            onIntent({ k: 'lines', lines: withLine(tokens.join(' ')), rename: { ref: { line: word.line, word: word.word, occurrence: word.occurrence }, to: value } })
          } else {
            onIntent({ k: 'lines', lines: withLine(insertWordInLine(lineText, word.index, value, after ? 'after' : 'before')) })
          }
          setMode('none')
        }}>
          <input dir="rtl" autoFocus aria-label={mode === 'rename' ? 'نص الكلمة بعد التصحيح' : 'الكلمة الجديدة'} className={`${INPUT} font-quran text-lg`} value={text} onChange={e => setText(e.target.value)} />
          {mode === 'insert' && <Segmented label="موضع الإدراج" value={after ? 'after' : 'before'} onChange={v => setAfter(v === 'after')} options={[{ value: 'after', label: 'بعد الكلمة' }, { value: 'before', label: 'قبل الكلمة' }]} />}
          <div className="flex gap-2"><Btn tone="primary" type="submit">تطبيق</Btn><Btn onClick={() => setMode('none')}>إلغاء</Btn></div>
        </form>
      )}
    </section>
  )
}
