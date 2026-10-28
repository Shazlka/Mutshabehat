'use client'

import { useState } from 'react'
import type { DispatchLike, VerseState } from './stage-types'
import { MAX_SHARH_LENGTH } from './ops'
import { Btn, ConfirmBtn, Field, FOCUS, INPUT, SectionTitle } from './ui'

const ar = (n: number) => n.toLocaleString('ar-EG', { useGrouping: false })
const COLLAPSED_AT = 700
const LABEL = /^([\p{L}\s]{2,16}):\s*/u

/** One paragraph of a شرح; a leading label («اللغة:»، «المعنى:») is set in bold. */
function Paragraph({ text }: { text: string }) {
  const match = LABEL.exec(text)
  if (!match) return <p>{text}</p>
  return <p><strong className="font-bold text-[var(--color-ink)]">{match[1]}:</strong> {text.slice(match[0].length)}</p>
}

export function SharhPanel({ state, onSave, onRemove }: {
  state: VerseState
  onSave: (text: string, title?: string, author?: string) => DispatchLike
  onRemove: () => void
}) {
  const sharh = state.sharh && state.sharh.version > 0 ? state.sharh : null
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [problem, setProblem] = useState('')

  const long = !!sharh && sharh.text.length > COLLAPSED_AT
  const start = () => { setDraft(sharh?.text ?? ''); setTitle(sharh?.title ?? ''); setAuthor(sharh?.author ?? ''); setProblem(''); setEditing(true) }
  const save = () => {
    const result = onSave(draft, sharh ? undefined : title.trim(), sharh ? undefined : author.trim())
    if (result.ok) { setEditing(false); setProblem('') } else setProblem(result.error)
  }
  const source = sharh && [sharh.title, sharh.author, sharh.pages.length ? `ص ${sharh.pages.map(p => p.replace(/\d/g, d => ar(Number(d)))).join('، ')}` : ''].filter(Boolean).join(' · ')

  return (
    <section aria-label="شرح البيت">
      <SectionTitle aside={!editing && (
        <span className="flex gap-1.5">
          <Btn compact icon={sharh ? 'edit' : 'plus'} onClick={start}>{sharh ? 'تحرير الشرح' : 'إضافة شرح'}</Btn>
          {sharh && <ConfirmBtn compact label="حذف" confirmLabel="تأكيد حذف الشرح" onConfirm={onRemove} />}
        </span>
      )}>الشرح</SectionTitle>

      {editing ? (
        <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          {!sharh && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="الكتاب"><input className={INPUT} value={title} maxLength={200} onChange={e => setTitle(e.target.value)} placeholder="مثال: الوافي في شرح الشاطبية" /></Field>
              <Field label="المؤلف"><input className={INPUT} value={author} maxLength={200} onChange={e => setAuthor(e.target.value)} /></Field>
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-[var(--color-ink-soft)]">نص الشرح (فقرة لكل سطر، ويُبرَز ما قبل النقطتين في أول السطر مثل «المعنى:»)</span>
            <textarea dir="rtl" rows={10} value={draft} maxLength={MAX_SHARH_LENGTH} onChange={e => setDraft(e.target.value)}
              className={`w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-3 text-[15px] leading-[2] ${FOCUS}`} />
          </label>
          <p className="text-[11px] text-[var(--color-ink-muted)]">{ar(draft.length)} / {ar(MAX_SHARH_LENGTH)} حرفًا. ترك النص فارغًا يحذف الشرح.</p>
          {problem && <p role="alert" className="text-xs font-bold text-[var(--color-danger)]">{problem}</p>}
          <div className="flex gap-2"><Btn tone="primary" icon="check" onClick={save}>حفظ الشرح</Btn><Btn onClick={() => setEditing(false)}>إلغاء</Btn></div>
        </div>
      ) : sharh ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          {source && <p className="mb-2 text-[11px] font-bold text-[var(--color-ink-muted)]">{source}</p>}
          <div id="sharh-text" className={`space-y-2 text-[15px] leading-[2] text-[var(--color-ink-soft)] ${long && !expanded ? 'max-h-44 overflow-hidden' : ''}`}>
            {sharh.text.split('\n').filter(l => l.trim()).map((line, i) => <Paragraph key={i} text={line.trim()} />)}
          </div>
          {long && (
            <button type="button" aria-expanded={expanded} aria-controls="sharh-text" onClick={() => setExpanded(e => !e)}
              className={`mt-2 cursor-pointer rounded text-xs font-bold text-[var(--color-primary)] hover:underline ${FOCUS}`}>
              {expanded ? 'طيّ الشرح' : `عرض الشرح كاملًا (${ar(sharh.text.length)} حرفًا)`}
            </button>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-ink-soft)]">لا شرح لهذا البيت في قاعدة البيانات. يمكنك إضافته.</p>
      )}
    </section>
  )
}
