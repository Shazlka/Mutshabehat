'use client'

import { useEffect, useMemo, useState } from 'react'
import { AUTHORITIES, definitionFor, definitions, key, wordKey, validateDocuments, validateMark, verseFor, WORK_IDS, type EditorData, type Mark, type WorkId } from './data'

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
  const dirty = !!data && data !== saved
  useEffect(() => {
    remote().then(value => { setUnlocked(true);setData(value.document);setSaved(value.document);setRevision(value.revision);setUpdatedAt(value.updatedAt ?? null) })
      .catch(e => setMessage(e instanceof Error ? e.message : 'تعذر تحميل المتون')).finally(() => setBusy(false))
  },[])
  async function reload() {
    if (dirty && !confirm('ستفقد المسودة غير المحفوظة. نزّل الملفين أولًا إذا أردت الاحتفاظ بها. هل تريد إعادة التحميل؟')) return
    try { const value=await remote();setData(value.document);setSaved(value.document);setRevision(value.revision);setUpdatedAt(value.updatedAt ?? null);setProblems([]);setMessage('حُمّلت أحدث نسخة من الخادم') }
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
      const value=validateDocuments(mutoon,marks)
      setData(value); setProblems([]); setSelection({work:'shatibiyyah',verse:1}); setMessage('استُورد الملفان إلى المسودة. اضغط حفظ لإرسالهما إلى قاعدة البيانات.')
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
    if (invalidAll.length) {setMessage(`تعذر الحفظ: ${invalidAll.length} رمزًا يحتاج مراجعة. أولها: ${invalidAll[0]}`);return}
    setSaving(true)
    try { const result=await putRemote(revision,data);setSaved(data);setRevision(result.revision);setUpdatedAt(result.updatedAt);setMessage('حُفظت التعديلات في قاعدة البيانات') }
    catch(e) {if ((e as {status?:number}).status===401) setUnlocked(false);setMessage(e instanceof Error?e.message:'تعذر حفظ المتون')}
    finally {setSaving(false)}
  }
  function exportFile(name: 'mutoon.json' | 'symbols-all.json') {
    if (!data) return
    const invalidAll=checkAll(data)
    if (invalidAll.length) {setMessage(`تعذر التصدير: ${invalidAll.length} رمزًا يحتاج مراجعة`);return}
    download(name,data && name==='mutoon.json'?data.mutoon:data.marks); setMessage(`نُزّل ${name}${dirty?' من المسودة غير المحفوظة':''}. أعد بناء mutoon-symbols.json بعد تنزيل الملفين.`)
  }
  if (busy) return <p className="p-8">جارٍ فتح محرر المتون…</p>
  if (!unlocked) return <section className="mx-auto max-w-md p-6"><h2 className="mb-3 text-lg font-bold">تعذر تحميل المتون</h2><p role="alert" className="text-sm text-red-700">{message || 'تعذر الوصول إلى قاعدة البيانات. أعد المحاولة.'}</p><button type="button" onClick={()=>window.location.reload()} className="mt-3 rounded-lg border p-2 text-sm">إعادة المحاولة</button>{data&&<div className="mt-4 flex gap-2"><button type="button" onClick={()=>download('mutoon.json',data.mutoon)} className="rounded border p-2 text-xs">تنزيل مسودة المتون</button><button type="button" onClick={()=>download('symbols-all.json',data.marks)} className="rounded border p-2 text-xs">تنزيل مسودة الرموز</button></div>}</section>
  if (!data) return <section className="mx-auto max-w-xl p-6"><h2 className="mb-3 text-lg font-bold">استيراد بيانات المتون</h2><p className="mb-5 text-sm leading-7">اختر الملفين المحليين <b>mutoon.json</b> و <b>symbols-all.json</b> من مجلد <b>apps/ios/Generated/QiraatMutoon</b>. اضغط حفظ بعد الاستيراد لرفعها إلى قاعدة البيانات الخاصة.</p><input aria-label="ملفا المتون والرموز" type="file" accept=".json,application/json" multiple onChange={e=>void importFiles(e.target.files)} /><p role="status" className="mt-4 text-sm">{message}</p></section>
  return <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[19rem_minmax(0,1fr)] lg:p-6">
    <aside className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <label className="block text-sm font-bold" htmlFor="work">المتن</label>
      <select id="work" className="mt-2 w-full rounded-lg border p-2" value={selection.work} onChange={e=>{const work=e.target.value as WorkId;choose({work,verse:data.mutoon.works.find(w=>w.work===work)?.chapters[0]?.verses[0]?.number??1});setQuery('')}}>{WORK_IDS.map(id=><option key={id} value={id}>{LABELS[id]}</option>)}</select>
      <label className="mt-4 block text-sm font-bold" htmlFor="search">البحث في الأبيات</label>
      <input id="search" className="mt-2 w-full rounded-lg border p-2" value={query} onChange={e=>setQuery(e.target.value)} placeholder="رقم البيت أو نصه أو بابه" />
      <div className="mt-3 max-h-[58dvh] overflow-auto border-t pt-2" aria-label="قائمة الأبيات">{filtered.slice(0,300).map(v=><button key={v.number} type="button" onClick={()=>choose({work:selection.work,verse:v.number})} className={`mb-1 block w-full rounded-lg p-2 text-right text-sm ${selection.verse===v.number?'bg-[var(--color-primary)] text-white':'hover:bg-[var(--color-paper)]'}`}><b>بيت {v.number}</b><span className="block truncate">{v.lines[0]}</span></button>)}{filtered.length>300&&<p className="text-xs">تظهر أول ٣٠٠ نتيجة؛ استخدم البحث للتضييق.</p>}</div>
    </aside>
    <section className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><b>بيت {selection.verse}</b><span className="text-sm text-[var(--color-ink-soft)]">{verses.find(v=>v.number===selection.verse)?.chapter}</span><span className="ms-auto text-sm">{dirty?'تعديلات لم تحفظ':`محفوظ · نسخة ${revision}`}</span><button type="button" onClick={()=>void save()} disabled={!dirty||saving} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving?'جارٍ الحفظ…':'حفظ'}</button><button type="button" onClick={()=>void reload()} className="rounded-lg border px-4 py-2 text-sm">تحديث من الخادم</button><button type="button" onClick={()=>exportFile('mutoon.json')} className="rounded-lg border px-4 py-2 text-sm">تنزيل المتون</button><button type="button" onClick={()=>exportFile('symbols-all.json')} className="rounded-lg border px-4 py-2 text-sm">تنزيل الرموز</button></div>
      {verse && <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><h2 className="mb-3 font-bold">نص البيت وضبطه</h2>{verse.lines.map((line,index)=><label key={index} className="mb-3 block text-sm">الشطر {index+1}<textarea dir="rtl" value={line} rows={2} onChange={e=>editLine(index,e.target.value)} className="mt-1 block w-full rounded-lg border p-3 text-lg leading-9" /></label>)}<p className="text-xs text-[var(--color-ink-soft)]">عند تغيير الكلمة التي تحمل رمزًا، راجع علامات هذا البيت قبل الحفظ.</p></div>}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><h2 className="mb-3 font-bold">القراء والرواة في البيت <span className="text-sm font-normal">({marks.length} رموز)</span></h2>{marks.length===0&&<p className="text-sm text-[var(--color-ink-soft)]">لا توجد رموز معلّمة في هذا البيت.</p>}{marks.map((mark,index)=>{const error=invalid.find(x=>x.i===index)?.error;return <div key={`${index}-${mark.line}-${mark.word}`} className="mb-3 rounded-lg border p-3"><div className="flex flex-wrap items-center gap-2"><b className="text-red-700">{mark.symbol} · {mark.word}</b><span className="text-sm">{describe(mark.readingIds)}</span><span className="text-xs">الشطر {mark.line+1} · {mark.status==='verified'?'موثّق':'بانتظار التحقق'}</span><button type="button" className="ms-auto text-sm text-red-700" onClick={()=>removeMark(index)}>حذف</button></div>{error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}<div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="text-xs">حالة الرمز<select value={mark.status} onChange={e=>updateMark(index,{status:e.target.value as Mark['status'],method:'hand'})} className="mt-1 block w-full rounded border p-2"><option value="extracted">بانتظار التحقق</option><option value="verified">موثّق</option></select></label><label className="text-xs">المصدر<input value={mark.source??''} onChange={e=>updateMark(index,{source:e.target.value,method:'hand'})} className="mt-1 block w-full rounded border p-2" /></label><label className="text-xs sm:col-span-2">ملاحظة<input value={mark.note??''} onChange={e=>updateMark(index,{note:e.target.value,method:'hand'})} className="mt-1 block w-full rounded border p-2" /></label></div></div>})}</div>
      {verse&&<div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><h2 className="mb-3 font-bold">إضافة رمز إلى البيت</h2><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">الشطر<select className="mt-1 block w-full rounded border p-2" value={newLine} onChange={e=>{setNewLine(Number(e.target.value));setNewWord(0);setNewSymbol('')}}><option value={0}>الأول</option>{verse.lines.length>1&&<option value={1}>الثاني</option>}</select></label><label className="text-sm">الكلمة<select className="mt-1 block w-full rounded border p-2" value={newWord} onChange={e=>{setNewWord(Number(e.target.value));setNewSymbol('')}}>{words.map((w,i)=><option key={i} value={i}>{w.text} {w.occurrence>1?`(${w.occurrence})`:''}</option>)}</select></label><label className="text-sm sm:col-span-2">الرمز ومدلوله<select className="mt-1 block w-full rounded border p-2" value={newSymbol} onChange={e=>setNewSymbol(e.target.value)}><option value="">اختر الرمز</option>{possibleDefinitions.map(d=><option key={d.symbol} value={d.symbol}>{d.symbol} — {describe(d.readingIds)}</option>)}</select></label><label className="text-sm">المصدر<input className="mt-1 block w-full rounded border p-2" value={source} onChange={e=>setSource(e.target.value)} placeholder="الشرح والصفحة" /></label><label className="text-sm">ملاحظة<input className="mt-1 block w-full rounded border p-2" value={note} onChange={e=>setNote(e.target.value)} placeholder="وجه القراءة في البيت" /></label></div><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)} />راجعت الرمز ومدلوله في المصدر المذكور</label><button type="button" onClick={addMark} className="mt-3 rounded-lg border border-[var(--color-primary)] px-4 py-2 text-sm font-bold text-[var(--color-primary)]">إضافة إلى المسودة</button><p className="mt-2 text-xs text-[var(--color-ink-soft)]">مدلول الرمز يحدده المتن. لإضافة راوٍ أو قارئ، اختر الرمز الذي يدل عليه في هذا البيت.</p></div>}
      {problems.length>0&&<details className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"><summary>{problems.length} رمزًا يحتاج مراجعة قبل الحفظ أو التصدير</summary><ul className="mt-2 list-inside list-disc">{problems.slice(0,20).map((problem,i)=><li key={i}>{problem}</li>)}</ul></details>}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm"><label className="font-bold">استيراد ملفين بديلين <input type="file" accept=".json,application/json" multiple onChange={e=>void importFiles(e.target.files)} className="mt-2 block w-full font-normal" /></label><p className="mt-2 text-[var(--color-ink-soft)]">التحرير محفوظ في قاعدة البيانات بعد الضغط على حفظ. نزّل الملفين عند تحديث تطبيق iOS؛ أي مسودة غير محفوظة تبقى في هذه الصفحة فقط.</p></div>
      {updatedAt&&<p className="text-xs text-[var(--color-ink-soft)]">آخر حفظ: {new Date(updatedAt).toLocaleString('ar-AE')}</p>}
      <p role="status" aria-live="polite" className="text-sm">{message}</p>
    </section>
  </div>
}
