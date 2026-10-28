'use client'

import { useEffect, useMemo, useState } from 'react'
import { QIRAAT_MULTI_READER_COLOR, readerColor, narratorColor } from '../../../../packages/qiraat-core/colors'
import type { ReaderId, NarratorId } from '../../../../packages/qiraat-core/types'
import { AUTHORITIES, definitionFor, definitions, key, wordKey, validateDocuments, validateMark, validateAssignment, verseFor, wordLetters, WORK_IDS, type EditorData, type Mark, type WordAssignment, type WorkId } from './data'

const API = '/api/mushaf-1441/mutoon-editor'
const LABELS: Record<WorkId,string> = { shatibiyyah:'الشاطبية', durrah:'الدرة', tayyibah:'طيبة النشر' }
type Selection = { work: WorkId; verse: number }
type Remote = { revision: number; document: EditorData | null; updatedAt?: string }
async function remote(): Promise<Remote> {
  const response = await fetch(API,{cache:'no-store'})
  const body = await response.json()
  if (!response.ok) throw Object.assign(new Error(body.error ?? 'تعذر تحميل المتون'),{status:response.status})
  return body as Remote
}
async function putRemote(revision: number, document: EditorData): Promise<{revision:number;updatedAt:string}> {
  const response = await fetch(API,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,document})})
  const body = await response.json()
  if (!response.ok) throw Object.assign(new Error(body.error ?? 'تعذر حفظ المتون'),{status:response.status})
  return body
}
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json;charset=utf-8'}))
  const a = document.createElement('a'); a.href=url; a.download=name; a.click()
  setTimeout(() => URL.revokeObjectURL(url),30000)
}
function clone<T>(value: T): T { return structuredClone(value) }
function normalize(value: EditorData | null): EditorData | null {
  return value ? { ...value, assignments: value.assignments ?? { schemaVersion: 1, assignments: [] } } : null
}
function assignmentSlot(a: Pick<WordAssignment,'work'|'verse'|'line'|'word'|'occurrence'>) {
  return `${a.work}:${a.verse}:${a.line}:${a.word}:${a.occurrence}`
}
function marksOf(data: EditorData, work: WorkId, number: number) { return data.marks.marks.filter(m => m.work === work && m.verse === number) }
function candidates(line: string): Array<{text:string; occurrence:number}> {
  const counts = new Map<string,number>()
  return line.split(/\s+/).filter(Boolean).map(text => {
    const plain = text.replace(/[^\p{L}\p{M}\u0640]/gu,'')
    const id = plain; const occurrence = (counts.get(id) ?? 0)+1; counts.set(id,occurrence)
    return {text:plain,occurrence}
  }).filter(c => c.text)
}
function describe(ids: string[]) { return ids.map(id => AUTHORITIES.find(a => a.id === id)?.name ?? id).join('، ') }
function authorityColor(id: string) { return id.includes('-') ? narratorColor(id as NarratorId) : readerColor(id as ReaderId) }
function previewColor(ids: string[]) { return ids.length === 1 ? authorityColor(ids[0]) : QIRAAT_MULTI_READER_COLOR }

function VersePreview({ lines, assignments, marks, work, verse }: { lines: string[]; assignments: WordAssignment[]; marks: Mark[]; work: WorkId; verse: number }) {
  return <section aria-label="معاينة البيت المباشرة" className="sticky top-0 z-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm">
    <div className="flex items-center justify-between gap-2"><h2 className="font-bold">معاينة البيت المباشرة</h2><span className="text-xs text-[var(--color-ink-soft)]">بيت {verse} · المسودة الحالية</span></div>
    <div className="mt-2 rounded-lg border bg-[var(--color-paper)] px-3 py-2 text-right text-xl leading-[2.25]" dir="rtl">
      {lines.map((line, lineIndex) => {
        const counts = new Map<string, number>()
        return <p key={lineIndex} className="min-h-10 whitespace-pre-wrap">{line.split(/(\s+)/).map((token, tokenIndex) => {
          if (!token.trim()) return <span key={tokenIndex}>{token}</span>
          const plain = token.replace(/[^\p{L}\p{M}\u0640]/gu, '')
          if (!plain) return <span key={tokenIndex}>{token}</span>
          const occurrence = (counts.get(plain) ?? 0) + 1
          counts.set(plain, occurrence)
          const slot = assignmentSlot({ work, verse, line: lineIndex, word: plain, occurrence })
          const assignment = assignments.find(a => assignmentSlot(a) === slot)
          const mark = marks.find(m => m.line === lineIndex && m.word === plain && m.occurrence === occurrence && m.status === 'verified')
          const start = token.indexOf(plain)
          const before = start < 0 ? '' : token.slice(0, start)
          const after = start < 0 ? '' : token.slice(start + plain.length)
          const letters = wordLetters(plain)
          const color = assignment ? previewColor(assignment.readingIds) : '#DC2626'
          const letterIndex = assignment?.mode === 'letter' ? assignment.letterIndex ?? 0 : mark?.mode === 'letter' && !assignment ? 0 : -1
          const decoration = mark && assignment ? { textDecoration: 'underline' as const, textDecorationColor: '#DC2626', textDecorationThickness: '2px' } : undefined
          return <span key={tokenIndex}>{before}{assignment || mark ? letterIndex >= 0 ? letters.map((letter, i) => <span key={i} style={i === letterIndex ? { color, fontWeight: 700, ...decoration } : undefined}>{letter}</span>) : <span style={{ color, fontWeight: 700, ...decoration }}>{plain}</span> : plain}{after}</span>
        })}</p>
      })}
    </div>
    {assignments.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{assignments.flatMap(a => a.readingIds.map(id => <span key={`${assignmentSlot(a)}:${id}`} className="rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: authorityColor(id), color: authorityColor(id), backgroundColor: `${authorityColor(id)}16` }}>{AUTHORITIES.find(x => x.id === id)?.name ?? id} · {a.word}</span>))}</div>}
    {marks.some(m => m.status === 'verified') && <p className="mt-1 text-xs text-[var(--color-ink-soft)]"><span className="font-bold text-red-700">الأحمر</span> للرموز الموثقة في المتن؛ الخط الأحمر تحت التعيين يعني وجود رمز في موضعه.</p>}
  </section>
}


export default function MutoonEditor() {
  const [data,setData] = useState<EditorData|null>(null)
  const [saved,setSaved] = useState<EditorData|null>(null)
  const [revision,setRevision] = useState(0)
  const [updatedAt,setUpdatedAt] = useState<string|null>(null)
  const [unlocked,setUnlocked] = useState(false)
  const [saving,setSaving] = useState(false)
  const [problems,setProblems] = useState<string[]>([])
  const [selection,setSelection] = useState<Selection>({work:'shatibiyyah',verse:1})
  const [query,setQuery] = useState('')
  const [message,setMessage] = useState('')
  const [busy,setBusy] = useState(true)
  const [newLine,setNewLine] = useState(0)
  const [newWord,setNewWord] = useState(0)
  const [newSymbol,setNewSymbol] = useState('')
  const [source,setSource] = useState('')
  const [note,setNote] = useState('')
  const [verified,setVerified] = useState(false)
  const [authorityQuery,setAuthorityQuery] = useState('')
  const [pendingMode,setPendingMode] = useState<'letter'|'word'>('word')
  const [pendingLetterIndex,setPendingLetterIndex] = useState(0)
  const dirty = !!data && data !== saved
  useEffect(() => {
    remote().then(value => { setUnlocked(true);const doc=normalize(value.document);setData(doc);setSaved(doc);setRevision(value.revision);setUpdatedAt(value.updatedAt ?? null) })
      .catch(e => setMessage(e instanceof Error ? e.message : 'تعذر تحميل المتون')).finally(() => setBusy(false))
  },[])
  async function reload() {
    if (dirty && !confirm('ستفقد المسودة غير المحفوظة. نزّل ملفات JSON أولًا إذا أردت الاحتفاظ بها. هل تريد إعادة التحميل؟')) return
    try { const value=await remote();const doc=normalize(value.document);setData(doc);setSaved(doc);setRevision(value.revision);setUpdatedAt(value.updatedAt ?? null);setProblems([]);setMessage('حُمّلت أحدث نسخة من الخادم') }
    catch(e) {if ((e as {status?:number}).status===401) setUnlocked(false);setMessage(e instanceof Error?e.message:'تعذر إعادة التحميل')}
  }
  useEffect(() => { if (!dirty) return; const handler = (event: BeforeUnloadEvent) => { event.preventDefault() }; window.addEventListener('beforeunload',handler); return () => window.removeEventListener('beforeunload',handler) },[dirty])
  const work = data?.mutoon.works.find(w => w.work === selection.work)
  const verses = useMemo(() => work?.chapters.flatMap(chapter => chapter.verses.map(verse => ({...verse,chapter:chapter.title}))) ?? [],[work])
  const filtered = useMemo(() => {
    const q = key(query)
    return q ? verses.filter(v => String(v.number).includes(query) || key(v.lines.join(' ')).includes(q) || key(v.chapter).includes(q)) : verses
  },[verses,query])
  const verse = verseFor(data?.mutoon ?? {schemaVersion:1,works:[]},selection.work,selection.verse)
  const marks = data ? marksOf(data,selection.work,selection.verse) : []
  const words = verse ? candidates(verse.lines[newLine] ?? '') : []
  const selectedWord = words[newWord]
  const selectedSlot = selectedWord ? assignmentSlot({work:selection.work,verse:selection.verse,line:newLine,word:selectedWord.text,occurrence:selectedWord.occurrence}) : null
  const assignment = data?.assignments.assignments.find(a => assignmentSlot(a) === selectedSlot)
  const currentMode = assignment ? assignment.mode ?? 'word' : pendingMode
  const currentLetterIndex = assignment?.letterIndex ?? pendingLetterIndex
  const verseAssignments = data?.assignments.assignments.filter(a => a.work===selection.work && a.verse===selection.verse) ?? []
  const authorityGroups = Array.from({length:10},(_,i)=>AUTHORITIES.slice(i*3,i*3+3)).filter(group => !authorityQuery || group.some(a => key(a.name).includes(key(authorityQuery)) || a.id.toLowerCase().includes(authorityQuery.toLowerCase())))
  const possibleDefinitions = selectedWord ? definitions(selection.work).filter(d => {
    const first = key(selectedWord.text)[0] ?? ''
    return d.symbol.length === 1 ? key(d.symbol) === first : key(d.symbol) === key(selectedWord.text) || wordKey(d.symbol) === wordKey(selectedWord.text)
  }) : []
  const invalid = verse ? marks.map((m,i) => ({i,error:validateMark(m,verse)})).filter(x => x.error) : []
  function checkAll(value: EditorData): string[] {
    const found: string[]=[]
    for (const mark of value.marks.marks) {
      const v=verseFor(value.mutoon,mark.work,mark.verse)
      const error=v ? validateMark(mark,v) : 'البيت غير موجود'
      if (error) found.push(`${LABELS[mark.work]} ${mark.verse}: ${error}`)
    }
    for (const item of value.assignments.assignments) {
      const v=verseFor(value.mutoon,item.work,item.verse)
      const error=v ? validateAssignment(item,v) : 'البيت غير موجود'
      if (error) found.push(`${LABELS[item.work]} ${item.verse}: ${error}`)
    }
    setProblems(found)
    return found
  }
  function choose(next: Selection) { if (dirty && !confirm('توجد تعديلات لم تُحفظ. الانتقال سيبقيها في المسودة، لكن احفظها قبل التصدير.')) return; setSelection(next); setNewWord(0); setNewSymbol(''); setSource(''); setNote('') }
  async function importFiles(files: FileList | null) {
    if (!files || files.length < 2) { setMessage('اختر mutoon.json و symbols-all.json معًا'); return }
    if (data && !confirm('استيراد الملفات سيستبدل مسودة المتون الحالية عند الحفظ. نزّل نسخة احتياطية أولًا إذا لزم. هل تريد المتابعة؟')) return
    try {
      const docs = await Promise.all(Array.from(files).map(async f => ({name:f.name,value:JSON.parse(await f.text()) as unknown})))
      const mutoon=docs.find(d => d.name === 'mutoon.json')?.value
      const marks=docs.find(d => d.name === 'symbols-all.json')?.value
      const assignmentFile=docs.find(d => d.name === 'mutoon-authorities.json')?.value
      const value=validateDocuments(mutoon,marks,assignmentFile ?? data?.assignments)
      setData(value); setProblems([]); setSelection({work:'shatibiyyah',verse:1}); setMessage('استُوردت الملفات إلى المسودة. اضغط حفظ لإرسالها إلى قاعدة البيانات.')
    } catch (e) { setMessage(e instanceof Error?e.message:'تعذر قراءة الملفات') }
  }
  function editLine(index: number, text: string) {
    if (!data) return
    const next=clone(data), v=verseFor(next.mutoon,selection.work,selection.verse)
    if (v) v.lines[index]=text
    setData(next); setProblems([])
  }
  function updateMark(index: number, patch: Partial<Mark>) {
    if (!data) return
    const next=clone(data); const selected=next.marks.marks.filter(m => m.work===selection.work && m.verse===selection.verse)[index]
    if (!selected) return
    Object.assign(selected,patch)
    setData(next); setProblems([])
  }
  function removeMark(index: number) {
    if (!data || !confirm('حذف هذا الرمز من البيت؟')) return
    const next=clone(data); const target=marks[index]; const idx=next.marks.marks.findIndex(m => m===target || JSON.stringify(m)===JSON.stringify(target))
    if (idx>=0) next.marks.marks.splice(idx,1)
    setData(next); setProblems([])
  }
  function setAssignmentMode(mode: 'letter'|'word') {
    setPendingMode(mode)
    if (!data || !assignment) return
    const next=clone(data), item=next.assignments.assignments.find(a=>assignmentSlot(a)===selectedSlot)
    if (!item) return
    item.mode=mode
    if (mode==='letter') item.letterIndex=Math.min(item.letterIndex ?? 0, Math.max(0,wordLetters(item.word).length-1))
    else delete item.letterIndex
    setData(next)
  }
  function setAssignmentLetter(index: number) {
    setPendingLetterIndex(index)
    if (!data || !assignment) return
    const next=clone(data), item=next.assignments.assignments.find(a=>assignmentSlot(a)===selectedSlot)
    if (!item) return
    item.mode='letter';item.letterIndex=index;setData(next)
  }
  function toggleAuthority(id: string) {
    if (!data || !selectedWord || !AUTHORITIES.some(a => a.id===id)) return
    const next=clone(data)
    const slot=assignmentSlot({work:selection.work,verse:selection.verse,line:newLine,word:selectedWord.text,occurrence:selectedWord.occurrence})
    const index=next.assignments.assignments.findIndex(a=>assignmentSlot(a)===slot)
    if (index<0) next.assignments.assignments.push({work:selection.work,verse:selection.verse,line:newLine,word:selectedWord.text,occurrence:selectedWord.occurrence,mode:pendingMode,letterIndex:pendingMode==='letter'?pendingLetterIndex:undefined,readingIds:[id],note:'',source:''})
    else {
      const item=next.assignments.assignments[index]
      item.readingIds=item.readingIds.includes(id) ? item.readingIds.filter(value=>value!==id) : [...item.readingIds,id]
      if (!item.readingIds.length) next.assignments.assignments.splice(index,1)
    }
    setData(next);setProblems([])
  }
  function updateAssignment(patch: Partial<Pick<WordAssignment,'note'|'source'>>) {
    if (!data || !selectedSlot) return
    const next=clone(data), item=next.assignments.assignments.find(a=>assignmentSlot(a)===selectedSlot)
    if (!item) return
    Object.assign(item,patch);setData(next)
  }
  function addMark() {
    if (!data || !verse || !selectedWord) return
    const definition=definitionFor(selection.work,newSymbol)
    if (!definition) {setMessage('اختر رمزًا معرّفًا لهذا المتن');return}
    const newMark:Mark={work:selection.work,verse:selection.verse,line:newLine,word:selectedWord.text,occurrence:selectedWord.occurrence,mode:definition.symbol.length===1?'letter':'word',symbol:definition.symbol,kind:definition.kind,readingIds:definition.readingIds,note,source,status:verified?'verified':'extracted',method:'hand'}
    const error=validateMark(newMark,verse)
    if (error) {setMessage(error);return}
    if (marks.some(m => m.line===newLine && m.occurrence===selectedWord.occurrence && key(m.word)===key(selectedWord.text))) {setMessage('هذه الكلمة معلّمة بالفعل');return}
    const next=clone(data); next.marks.marks.push(newMark); setData(next); setProblems([]);setMessage('أُضيف الرمز إلى المسودة');setSource('');setNote('');setVerified(false)
  }
  async function save() {
    if (!data) return
    const invalidAll=checkAll(data)
    if (invalidAll.length) {setMessage(`تعذر الحفظ: ${invalidAll.length} تعيينًا أو رمزًا يحتاج مراجعة. أولها: ${invalidAll[0]}`);return}
    setSaving(true)
    try { const result=await putRemote(revision,data);setSaved(data);setRevision(result.revision);setUpdatedAt(result.updatedAt);setMessage('حُفظت التعديلات في قاعدة البيانات') }
    catch(e) {if ((e as {status?:number}).status===401) setUnlocked(false);setMessage(e instanceof Error?e.message:'تعذر حفظ المتون')}
    finally {setSaving(false)}
  }
  function exportFile(name: 'mutoon.json' | 'symbols-all.json' | 'mutoon-authorities.json') {
    if (!data) return
    const invalidAll=checkAll(data)
    if (invalidAll.length) {setMessage(`تعذر التصدير: ${invalidAll.length} تعيينًا أو رمزًا يحتاج مراجعة`);return}
    download(name,name==='mutoon.json'?data.mutoon:name==='symbols-all.json'?data.marks:data.assignments); setMessage(`نُزّل ${name}${dirty?' من المسودة غير المحفوظة':''}.`)
  }
  if (busy) return <p className="p-8">جارٍ فتح محرر المتون…</p>
  if (!unlocked) return <section className="mx-auto max-w-md p-6"><h2 className="mb-3 text-lg font-bold">تعذر تحميل المتون</h2><p role="alert" className="text-sm text-red-700">{message || 'تعذر الوصول إلى قاعدة البيانات. أعد المحاولة.'}</p><button type="button" onClick={()=>window.location.reload()} className="mt-3 rounded-lg border p-2 text-sm">إعادة المحاولة</button>{data&&<div className="mt-4 flex gap-2"><button type="button" onClick={()=>download('mutoon.json',data.mutoon)} className="rounded border p-2 text-xs">تنزيل مسودة المتون</button><button type="button" onClick={()=>download('symbols-all.json',data.marks)} className="rounded border p-2 text-xs">تنزيل مسودة الرموز</button><button type="button" onClick={()=>download('mutoon-authorities.json',data.assignments)} className="rounded border p-2 text-xs">تنزيل تعيينات القراء</button></div>}</section>
  if (!data) return <section className="mx-auto max-w-xl p-6"><h2 className="mb-3 text-lg font-bold">استيراد بيانات المتون</h2><p className="mb-5 text-sm leading-7">اختر الملفين المحليين <b>mutoon.json</b> و <b>symbols-all.json</b> من مجلد <b>apps/ios/Generated/QiraatMutoon</b>. اضغط حفظ بعد الاستيراد لرفعها إلى قاعدة البيانات الخاصة.</p><input aria-label="ملفا المتون والرموز" type="file" accept=".json,application/json" multiple onChange={e=>void importFiles(e.target.files)} /><p role="status" className="mt-4 text-sm">{message}</p></section>
  return <div className="mx-auto grid max-w-[1800px] gap-3 p-3 lg:h-[calc(100dvh-5.5rem)] lg:grid-cols-[15rem_minmax(19rem,1fr)_minmax(30rem,1.3fr)] lg:overflow-hidden">
    <aside className="min-h-0 overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <label className="block text-sm font-bold" htmlFor="work">المتن</label>
      <select id="work" className="mt-2 w-full rounded-lg border p-2" value={selection.work} onChange={e=>{const work=e.target.value as WorkId;choose({work,verse:data.mutoon.works.find(w=>w.work===work)?.chapters[0]?.verses[0]?.number??1});setQuery('')}}>{WORK_IDS.map(id=><option key={id} value={id}>{LABELS[id]}</option>)}</select>
      <label className="mt-4 block text-sm font-bold" htmlFor="search">البحث في الأبيات</label>
      <input id="search" className="mt-2 w-full rounded-lg border p-2" value={query} onChange={e=>setQuery(e.target.value)} placeholder="رقم البيت أو نصه أو بابه" />
      <div className="mt-3 lg:max-h-[calc(100dvh-15rem)] overflow-auto border-t pt-2" aria-label="قائمة الأبيات">{filtered.slice(0,300).map(v=><button key={v.number} type="button" onClick={()=>choose({work:selection.work,verse:v.number})} className={`mb-1 block w-full rounded-lg p-2 text-right text-sm ${selection.verse===v.number?'bg-[var(--color-primary)] text-white':'hover:bg-[var(--color-paper)]'}`}><b>بيت {v.number}</b><span className="block truncate">{v.lines[0]}</span></button>)}{filtered.length>300&&<p className="text-xs">تظهر أول ٣٠٠ نتيجة؛ استخدم البحث للتضييق.</p>}</div>
    </aside>
    <section className="min-h-0 min-w-0 space-y-3 overflow-auto lg:pr-1">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><b>بيت {selection.verse}</b><span className="text-sm text-[var(--color-ink-soft)]">{verses.find(v=>v.number===selection.verse)?.chapter}</span><span className="ms-auto text-sm">{dirty?'تعديلات لم تحفظ':`محفوظ · نسخة ${revision}`}</span><button type="button" onClick={()=>void save()} disabled={!dirty||saving} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving?'جارٍ الحفظ…':'حفظ'}</button><button type="button" onClick={()=>void reload()} className="rounded-lg border px-4 py-2 text-sm">تحديث من الخادم</button><button type="button" onClick={()=>exportFile('mutoon.json')} className="rounded-lg border px-4 py-2 text-sm">تنزيل المتون</button><button type="button" onClick={()=>exportFile('symbols-all.json')} className="rounded-lg border px-4 py-2 text-sm">تنزيل الرموز</button><button type="button" onClick={()=>exportFile('mutoon-authorities.json')} className="rounded-lg border px-4 py-2 text-sm">تنزيل القراء</button></div>
      {verse && <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><h2 className="mb-3 font-bold">نص البيت وضبطه</h2>{verse.lines.map((line,index)=><label key={index} className="mb-3 block text-sm">الشطر {index+1}<textarea dir="rtl" value={line} rows={2} onChange={e=>editLine(index,e.target.value)} className="mt-1 block w-full rounded-lg border p-3 text-lg leading-9" /></label>)}<p className="text-xs text-[var(--color-ink-soft)]">عند تغيير الكلمة التي تحمل رمزًا، راجع علامات هذا البيت قبل الحفظ.</p></div>}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><h2 className="mb-3 font-bold">القراء والرواة في البيت <span className="text-sm font-normal">({marks.length} رموز)</span></h2>{marks.length===0&&<p className="text-sm text-[var(--color-ink-soft)]">لا توجد رموز معلّمة في هذا البيت.</p>}{marks.map((mark,index)=>{const error=invalid.find(x=>x.i===index)?.error;return <div key={`${index}-${mark.line}-${mark.word}`} className="mb-3 rounded-lg border p-3"><div className="flex flex-wrap items-center gap-2"><b className="text-red-700">{mark.symbol} · {mark.word}</b><span className="text-sm">{describe(mark.readingIds)}</span><span className="text-xs">الشطر {mark.line+1} · {mark.status==='verified'?'موثّق':'بانتظار التحقق'}</span><button type="button" className="ms-auto text-sm text-red-700" onClick={()=>removeMark(index)}>حذف</button></div>{error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}<div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="text-xs">حالة الرمز<select value={mark.status} onChange={e=>updateMark(index,{status:e.target.value as Mark['status'],method:'hand'})} className="mt-1 block w-full rounded border p-2"><option value="extracted">بانتظار التحقق</option><option value="verified">موثّق</option></select></label><label className="text-xs">المصدر<input value={mark.source??''} onChange={e=>updateMark(index,{source:e.target.value,method:'hand'})} className="mt-1 block w-full rounded border p-2" /></label><label className="text-xs sm:col-span-2">ملاحظة<input value={mark.note??''} onChange={e=>updateMark(index,{note:e.target.value,method:'hand'})} className="mt-1 block w-full rounded border p-2" /></label></div></div>})}</div>
      {verse&&<div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><h2 className="mb-3 font-bold">إضافة رمز إلى البيت</h2><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">الشطر<select className="mt-1 block w-full rounded border p-2" value={newLine} onChange={e=>{setNewLine(Number(e.target.value));setNewWord(0);setNewSymbol('')}}><option value={0}>الأول</option>{verse.lines.length>1&&<option value={1}>الثاني</option>}</select></label><label className="text-sm">الكلمة<select className="mt-1 block w-full rounded border p-2" value={newWord} onChange={e=>{setNewWord(Number(e.target.value));setNewSymbol('')}}>{words.map((w,i)=><option key={i} value={i}>{w.text} {w.occurrence>1?`(${w.occurrence})`:''}</option>)}</select></label><label className="text-sm sm:col-span-2">الرمز ومدلوله<select className="mt-1 block w-full rounded border p-2" value={newSymbol} onChange={e=>setNewSymbol(e.target.value)}><option value="">اختر الرمز</option>{possibleDefinitions.map(d=><option key={d.symbol} value={d.symbol}>{d.symbol} — {describe(d.readingIds)}</option>)}</select></label><label className="text-sm">المصدر<input className="mt-1 block w-full rounded border p-2" value={source} onChange={e=>setSource(e.target.value)} placeholder="الشرح والصفحة" /></label><label className="text-sm">ملاحظة<input className="mt-1 block w-full rounded border p-2" value={note} onChange={e=>setNote(e.target.value)} placeholder="وجه القراءة في البيت" /></label></div><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)} />راجعت الرمز ومدلوله في المصدر المذكور</label><button type="button" onClick={addMark} className="mt-3 rounded-lg border border-[var(--color-primary)] px-4 py-2 text-sm font-bold text-[var(--color-primary)]">إضافة إلى المسودة</button><p className="mt-2 text-xs text-[var(--color-ink-soft)]">مدلول الرمز يحدده المتن. لإضافة راوٍ أو قارئ، اختر الرمز الذي يدل عليه في هذا البيت.</p></div>}
      {problems.length>0&&<details className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"><summary>{problems.length} تعيينًا أو رمزًا يحتاج مراجعة قبل الحفظ أو التصدير</summary><ul className="mt-2 list-inside list-disc">{problems.slice(0,20).map((problem,i)=><li key={i}>{problem}</li>)}</ul></details>}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm"><label className="font-bold">استيراد المتون والرموز مع تعيينات الكلمات الاختيارية <input type="file" accept=".json,application/json" multiple onChange={e=>void importFiles(e.target.files)} className="mt-2 block w-full font-normal" /></label><p className="mt-2 text-[var(--color-ink-soft)]">التحرير محفوظ في قاعدة البيانات بعد الضغط على حفظ. نزّل ملفات JSON عند تحديث تطبيق iOS؛ أي مسودة غير محفوظة تبقى في هذه الصفحة فقط.</p></div>
      {updatedAt&&<p className="text-xs text-[var(--color-ink-soft)]">آخر حفظ: {new Date(updatedAt).toLocaleString('ar-AE')}</p>}
      <p role="status" aria-live="polite" className="text-sm">{message}</p>
    </section>
    <aside className="min-h-0 overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3" aria-label="تعيين القراء والرواة للكلمات">
      {verse&&<VersePreview lines={verse.lines} assignments={verseAssignments} marks={marks} work={selection.work} verse={selection.verse} />}
      <h2 className="mt-3 font-bold">تعيين القراء والرواة</h2>
      <p className="mt-1 text-xs text-[var(--color-ink-soft)]">اختر كلمة من البيت، ثم عيّن لها أي قارئ أو راوٍ. هذه تعيينات مستقلة عن مدلول رموز المتن.</p>
      {verse ? <>
        {verse.lines.map((line,lineIndex)=><div key={lineIndex} className="mt-3"><b className="text-xs">الشطر {lineIndex+1}</b><div dir="rtl" className="mt-1 flex flex-wrap gap-1 rounded-lg border p-2">{candidates(line).map((word,index)=>{const slot=assignmentSlot({work:selection.work,verse:selection.verse,line:lineIndex,word:word.text,occurrence:word.occurrence});const assigned=data.assignments.assignments.find(a=>assignmentSlot(a)===slot);return <button key={`${index}-${word.text}`} type="button" onClick={()=>{setNewLine(lineIndex);setNewWord(index);setNewSymbol('');setPendingMode('word');setPendingLetterIndex(0)}} aria-pressed={lineIndex===newLine&&index===newWord} className={`rounded px-2 py-1 text-base leading-7 ${lineIndex===newLine&&index===newWord?'bg-[var(--color-primary)] text-white':assigned?'border border-[var(--color-primary)] text-[var(--color-primary)]':'hover:bg-[var(--color-paper)]'}`}>{word.text}{assigned&&<span className="ms-1 text-xs">{assigned.readingIds.length}</span>}</button>})}</div></div>)}
        <p className="mt-3 text-sm font-bold">{selectedWord ? `الكلمة: ${selectedWord.text}${selectedWord.occurrence>1?` (${selectedWord.occurrence})`:''}` : 'اختر كلمة'}</p>
        <p className="text-xs text-[var(--color-ink-soft)]">{assignment ? describe(assignment.readingIds) : 'لا يوجد تعيين لهذه الكلمة'} · {verseAssignments.length} كلمات معيّنة في البيت</p>
        <div className="mt-3" role="group" aria-label="نوع علامة الكلمة"><p className="text-xs font-bold">لوّن الحرف أو الكلمة كاملة</p><div className="mt-1 flex gap-2">{(['letter','word'] as const).map(mode=><button key={mode} type="button" aria-pressed={currentMode===mode} onClick={()=>setAssignmentMode(mode)} disabled={!selectedWord} className={`rounded-lg border px-3 py-1.5 text-sm ${currentMode===mode?'border-[var(--color-primary)] bg-[var(--color-primary)] text-white':'hover:bg-[var(--color-paper)]'}`}>{mode==='letter'?'حرف من الكلمة':'الكلمة كاملة'}</button>)}</div></div>
        {selectedWord&&currentMode==='letter'&&<div className="mt-2" role="group" aria-label="اختر الحرف"><p className="text-xs">اختر الحرف الملوّن</p><div dir="rtl" className="mt-1 flex flex-wrap gap-1">{wordLetters(selectedWord.text).map((letter,index)=><button key={index} type="button" aria-pressed={currentLetterIndex===index} onClick={()=>setAssignmentLetter(index)} className={`min-w-9 rounded border p-1 text-lg ${currentLetterIndex===index?'border-[var(--color-primary)] bg-[var(--color-primary)] text-white':'hover:bg-[var(--color-paper)]'}`}>{letter}</button>)}</div></div>}
        <label className="mt-3 block text-xs">ابحث عن قارئ أو راوٍ<input value={authorityQuery} onChange={e=>setAuthorityQuery(e.target.value)} className="mt-1 w-full rounded border p-2" placeholder="الاسم أو Q01" /></label>
        <div className="mt-2 space-y-2">{authorityGroups.map(group=><div key={group[0].id} className="grid grid-cols-3 gap-1 rounded-lg border p-2">{group.map((a,i)=>{const chosen=!!assignment?.readingIds.includes(a.id);const color=authorityColor(a.id);return <button key={a.id} type="button" aria-pressed={chosen} onClick={()=>toggleAuthority(a.id)} disabled={!selectedWord} className="min-w-0 rounded-lg border px-2 py-2 text-right text-sm disabled:opacity-50" style={{borderColor:color,color,backgroundColor:chosen?`${color}26`:undefined}}><span className="block font-bold">{chosen?'−':'+'} {a.name}</span><span className="block text-xs">{i===0?'قارئ':'راوٍ'} · {chosen?'إزالة':'إضافة'}</span></button>})}</div>)}</div>
        {assignment&&<div className="mt-3 space-y-2"><label className="block text-xs">المصدر<input value={assignment.source} onChange={e=>updateAssignment({source:e.target.value})} className="mt-1 w-full rounded border p-2" /></label><label className="block text-xs">ملاحظة<input value={assignment.note} onChange={e=>updateAssignment({note:e.target.value})} className="mt-1 w-full rounded border p-2" /></label></div>}
      </> : <p className="mt-3 text-sm">البيت غير موجود</p>}
    </aside>
  </div>
}
