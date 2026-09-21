'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MushafWord } from '../../../../../packages/quran-data/mushaf1441/types'

type Entity = { id: string; parentId: string | null; type: string; nameAr: string; color: string | null }
type Taxonomy = { id: string; parentId: string | null; category: 'USUL' | 'FARSH'; nameAr: string }
type Source = { id: string; titleAr: string }
type Corpus = { id: string; code: string; nameAr: string }
type Framework = { id: string; corpusId: string; code: string; nameAr: string }
type Face = { faceType: string; faceValue: string; labelAr: string; preferenceStatus: '' | 'muqaddam' | 'secondary' | 'equal' }
type Variant = { uthmanicText: string; normalizedText: string; phoneticNote: string; faceIndex: string }
type Existing = { id: string; scopeType: 'WORD' | 'RANGE' | 'BOUNDARY'; startCanonicalKey: string; endCanonicalKey: string; targetAuthorityId: string; taxonomyId: string; corpusId: string | null; frameworkId: string | null; status: string; version: number; readingContext: string; inheritanceAction: string; appliesToDescendants: boolean; colorOverride: string | null; notes: string | null; faces: Array<{ id: string; faceType: string; faceValue: unknown; labelAr: string; preferenceStatus: Face['preferenceStatus']; sortOrder: number }>; variants: Array<{ uthmanicText: string | null; normalizedText: string | null; phoneticNote: string | null; faceId: string | null }>; sources: Array<{ sourceId: string }> }

const emptyFace = (): Face => ({ faceType: 'CUSTOM', faceValue: '', labelAr: '', preferenceStatus: '' })
const emptyVariant = (): Variant => ({ uthmanicText: '', normalizedText: '', phoneticNote: '', faceIndex: '' })
const editorLoadRequests = new Map<string, Promise<{ response: Response; data: { catalog?: { entities?: Entity[]; taxonomies?: Taxonomy[]; sources?: Source[]; corpora?: Corpus[]; frameworks?: Framework[] }; annotations?: Existing[] } | null }>>()

function loadEditorData(key: string) {
  const cached = editorLoadRequests.get(key)
  if (cached) return cached
  const request = fetch(`/api/mushaf-1441/qiraat-editor?canonicalKey=${encodeURIComponent(key)}`).then(async (response) => ({ response, data: await response.json().catch(() => null) }))
  editorLoadRequests.set(key, request)
  return request
}

export function canonicalKeyForWord(word: MushafWord) {
  return `${String(word.surahNumber).padStart(3, '0')}:${String(word.ayahNumber).padStart(3, '0')}:${String(word.wordIndexInAyah).padStart(3, '0')}`
}

export default function QiraatEditor({ word, onClose, onSaved, onNavigate }: { word: MushafWord; onClose(): void; onSaved(): void; onNavigate?(direction: 1 | -1): Promise<void> }) {
  const key = useMemo(() => canonicalKeyForWord(word), [word])
  const [entities, setEntities] = useState<Entity[]>([])
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [corpora, setCorpora] = useState<Corpus[]>([])
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [existing, setExisting] = useState<Existing[]>([])
  const [entityId, setEntityId] = useState('')
  const [taxonomyId, setTaxonomyId] = useState('')
  const [assignments, setAssignments] = useState<Array<{ entityId: string; taxonomyId: string }>>([])
  const [status, setStatus] = useState('draft')
  const [colorOverride, setColorOverride] = useState('')
  const [faces, setFaces] = useState<Face[]>([emptyFace()])
  const [variants, setVariants] = useState<Variant[]>([])
  const [sourceIds, setSourceIds] = useState<string[]>([])
  const [advanced, setAdvanced] = useState(false)
  const [corpusId, setCorpusId] = useState('')
  const [frameworkId, setFrameworkId] = useState('')
  const [notes, setNotes] = useState('')
  const [scopeType, setScopeType] = useState<'WORD' | 'RANGE' | 'BOUNDARY'>('WORD')
  const [editing, setEditing] = useState<Existing | null>(null)
  const [readingContext, setReadingContext] = useState('BOTH')
  const [inheritanceAction, setInheritanceAction] = useState('INHERIT')
  const [appliesToDescendants, setAppliesToDescendants] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true); setError(null)
      const { response, data } = await loadEditorData(key)
      if (!response.ok) { setError(data?.error === 'unauthorized' ? 'يلزم تسجيل الدخول لتحرير القراءات.' : (data?.error ?? 'تعذر تحميل محرر القراءات.')); setLoading(false); return }
      setEntities(data.catalog?.entities ?? []); setTaxonomies(data.catalog?.taxonomies ?? []); setSources(data.catalog?.sources ?? []); setCorpora(data.catalog?.corpora ?? []); setFrameworks(data.catalog?.frameworks ?? []); setExisting(data.annotations ?? [])
      setLoading(false)
    })().catch(() => { setError('تعذر تحميل محرر القراءات.'); setLoading(false) })
  }, [key])

  const selectedEntity = entities.find((entity) => entity.id === entityId)
  function edit(item: Existing) {
    setEditing(item); setEntityId(item.targetAuthorityId); setTaxonomyId(item.taxonomyId); setStatus(item.status)
    setColorOverride(item.colorOverride ?? ''); setReadingContext(item.readingContext); setInheritanceAction(item.inheritanceAction); setAppliesToDescendants(item.appliesToDescendants); setScopeType(item.scopeType); setNotes(item.notes ?? ''); setCorpusId(item.corpusId ?? ''); setFrameworkId(item.frameworkId ?? '')
    setFaces(item.faces.length ? item.faces.map((face) => ({ faceType: face.faceType, faceValue: typeof face.faceValue === 'string' ? face.faceValue : JSON.stringify(face.faceValue), labelAr: face.labelAr, preferenceStatus: face.preferenceStatus ?? '' })) : [emptyFace()])
    setVariants(item.variants.map((variant) => ({ uthmanicText: variant.uthmanicText ?? '', normalizedText: variant.normalizedText ?? '', phoneticNote: variant.phoneticNote ?? '', faceIndex: variant.faceId ? String(item.faces.findIndex((face) => face.id === variant.faceId)) : '' })))
    setSourceIds(item.sources.map((source) => source.sourceId)); setAdvanced(true); setError(null)
  }
  async function remove(item: Existing) {
    setError(null)
    const response = await fetch(`/api/mushaf-1441/qiraat-editor?id=${encodeURIComponent(item.id)}&expectedVersion=${item.version}`, { method: 'DELETE' })
    const data = await response.json().catch(() => null)
    if (response.status === 409) { setError('تم تعديل التعليق في مكان آخر. أعد فتحه لمراجعة النسخة الحالية.'); return }
    if (!response.ok) { setError(data?.error ?? 'تعذر حذف التعليق.'); return }
    editorLoadRequests.delete(key)
    setExisting(existing.filter((entry) => entry.id !== item.id)); onSaved()
  }
  async function save(navigate?: 1 | -1) {
    if ((!entityId || !taxonomyId) && !assignments.length) { setError('اختر القارئ أو الراوي والقاعدة أولاً.'); return }
    setSaving(true); setError(null)
    const payload = {
      startCanonicalKey: key, endCanonicalKey: key, scopeType, targetAuthorityId: entityId, taxonomyId, corpusId, frameworkId, status, colorOverride, notes,
      readingContext, inheritanceAction, appliesToDescendants,
      faces: faces.filter((face) => face.labelAr || face.faceValue).map((face, sortOrder) => ({ ...face, faceValue: face.faceValue || null, sortOrder })),
      variants: variants.filter((variant) => variant.uthmanicText || variant.normalizedText || variant.phoneticNote).map((variant) => ({ ...variant, faceIndex: variant.faceIndex === '' ? null : Number(variant.faceIndex) })),
      sources: sourceIds.map((sourceId) => ({ sourceId })),
    }
    const targets = editing ? [{ entityId, taxonomyId }] : assignments.length ? assignments : [{ entityId, taxonomyId }]
    let data: { annotations?: Existing[]; error?: string } | null = null
    let response: Response | null = null
    for (const target of targets) {
      response = await fetch('/api/mushaf-1441/qiraat-editor', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing ? { ...payload, ...target, id: editing.id, expectedVersion: editing.version } : { ...payload, ...target }) })
      data = await response.json().catch(() => null)
      if (!response.ok) break
    }
    setSaving(false)
    if (response?.status === 409) { setError('تم تعديل التعليق في مكان آخر. أعد فتحه لمراجعة النسخة الحالية.'); return }
    if (!response?.ok) { setError(data?.error ?? 'تعذر حفظ التعليق.'); return }
    setExisting(data?.annotations ?? []); onSaved()
    editorLoadRequests.delete(key)
    setEditing(null); setAssignments([]); setFaces([emptyFace()]); setVariants([]); setSourceIds([]); setColorOverride('')
    if (navigate && onNavigate) await onNavigate(navigate)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return <div className="fixed inset-0 z-[70] flex items-end bg-black/40 sm:items-stretch sm:justify-end" role="dialog" aria-modal="true" aria-label="محرر القراءات">
    <button className="absolute inset-0" aria-label="إغلاق محرر القراءات" onClick={onClose} />
    <section className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-[#fffdf8] shadow-2xl sm:max-h-none sm:w-[min(620px,48vw)] sm:rounded-none" dir="rtl">
      <header className="flex items-start justify-between border-b border-[#eadfc9] px-5 py-4">
        <div><p className="text-xs font-bold text-[#80662c]">محرر القراءات</p><h2 className="font-[family-name:var(--font-amiri-quran)] text-2xl text-[#171717]">{word.textUthmani}</h2><p className="text-xs text-[#665b48]">سورة {word.surahNumber} · آية {word.ayahNumber} · كلمة {word.wordIndexInAyah} · صفحة {word.pageNumber}</p><code className="text-[11px] text-[#80662c]">{key}</code></div>
        <button type="button" className="min-h-11 min-w-11 rounded border border-[#d7c7a7] text-xl" onClick={onClose}>×</button>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {loading ? <p className="text-sm text-[#665b48]">جارٍ تحميل البيانات…</p> : <>
          <div className="rounded-lg border border-[#eadfc9] bg-[#fffaf0] p-3 text-xs text-[#59461d]">{existing.length} تعليقاً محفوظاً · {existing.filter((a) => a.status === 'verified').length} موثق · {existing.filter((a) => a.status === 'reviewed').length} مراجع</div>
          {existing.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#eadfc9] p-3 text-sm"><button type="button" className="min-h-10 text-right" onClick={() => edit(item)}><b>{entities.find((x) => x.id === item.targetAuthorityId)?.nameAr ?? item.targetAuthorityId}</b><span className="mx-2 text-[#80662c]">{taxonomies.find((x) => x.id === item.taxonomyId)?.nameAr ?? 'قاعدة'}</span><span className="text-xs">{item.faces.length} أوجه · v{item.version} · {item.status}</span></button><button type="button" className="min-h-10 rounded border border-[#c07662] px-2 text-xs text-[#8a2f1b]" onClick={() => void remove(item)}>حذف</button></div>)}
          <label className="block text-sm font-bold">القارئ / الراوي<select className="mt-1 min-h-11 w-full rounded border border-[#d7c7a7] bg-white px-2" value={entityId} onChange={(e) => setEntityId(e.target.value)}><option value="">اختر…</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{'— '.repeat(entity.parentId ? 1 : 0)}{entity.nameAr}</option>)}</select></label>
          {selectedEntity ? <p className="text-xs text-[#80662c]" style={selectedEntity.color ? { color: selectedEntity.color } : undefined}>اللون الافتراضي: {selectedEntity.color ?? 'غير محدد'}</p> : null}
          <label className="block text-sm font-bold">الأصول / فرش الحروف<select className="mt-1 min-h-11 w-full rounded border border-[#d7c7a7] bg-white px-2" value={taxonomyId} onChange={(e) => setTaxonomyId(e.target.value)}><option value="">اختر القاعدة…</option>{taxonomies.map((taxonomy) => <option key={taxonomy.id} value={taxonomy.id}>{taxonomy.category} — {taxonomy.nameAr}</option>)}</select></label>
          {!editing ? <div className="rounded border border-[#eadfc9] p-2"><button type="button" className="text-xs font-bold text-[#80662c]" onClick={() => { if (!entityId || !taxonomyId) { setError('اختر السلطة والقاعدة قبل إضافتهما.'); return } if (!assignments.some((item) => item.entityId === entityId && item.taxonomyId === taxonomyId)) setAssignments([...assignments, { entityId, taxonomyId }]) }}>+ إضافة التعيين الصريح</button>{assignments.map((assignment, index) => <div key={`${assignment.entityId}-${assignment.taxonomyId}`} className="mt-1 flex justify-between text-xs"><span>{entities.find((entity) => entity.id === assignment.entityId)?.nameAr} ← {taxonomies.find((taxonomy) => taxonomy.id === assignment.taxonomyId)?.nameAr}</span><button type="button" onClick={() => setAssignments(assignments.filter((_, i) => i !== index))}>×</button></div>)}</div> : null}
          <label className="block text-sm font-bold">الحالة<select className="mt-1 min-h-11 w-full rounded border border-[#d7c7a7] bg-white px-2" value={status} onChange={(e) => setStatus(e.target.value)}><option value="draft">مسودة</option><option value="reviewed">مراجع</option><option value="verified">موثق</option></select></label>
          <div className="space-y-2"><div className="flex items-center justify-between"><b className="text-sm">الأوجه</b><button type="button" className="text-xs text-[#80662c]" onClick={() => setFaces([...faces, emptyFace()])}>+ إضافة وجه</button></div>{faces.map((face, index) => <div key={index} className="grid grid-cols-2 gap-2 rounded border border-[#eadfc9] p-2"><input className="min-h-10 rounded border px-2" placeholder="نوع الوجه" value={face.faceType} onChange={(e) => setFaces(faces.map((v,i)=>i===index?{...v,faceType:e.target.value}:v))}/><input className="min-h-10 rounded border px-2" placeholder="التسمية العربية" value={face.labelAr} onChange={(e) => setFaces(faces.map((v,i)=>i===index?{...v,labelAr:e.target.value}:v))}/><input className="min-h-10 rounded border px-2" placeholder="القيمة" value={face.faceValue} onChange={(e) => setFaces(faces.map((v,i)=>i===index?{...v,faceValue:e.target.value}:v))}/><select className="min-h-10 rounded border px-2" value={face.preferenceStatus} onChange={(e) => setFaces(faces.map((v,i)=>i===index?{...v,preferenceStatus:e.target.value as Face['preferenceStatus']}:v))}><option value="">بلا تفضيل</option><option value="muqaddam">مقدم</option><option value="secondary">ثانوي</option><option value="equal">متساوٍ</option></select><button type="button" className="min-h-9 text-xs text-[#8a2f1b]" onClick={() => setFaces(faces.length > 1 ? faces.filter((_, i) => i !== index) : [emptyFace()])}>حذف الوجه</button></div>)}</div>
          <div className="space-y-2"><div className="flex items-center justify-between"><b className="text-sm">البديل القرائي</b><button type="button" className="text-xs text-[#80662c]" onClick={() => setVariants([...variants, emptyVariant()])}>+ إضافة بديل</button></div>{variants.map((variant,index) => <div key={index} className="grid gap-2 rounded border border-[#eadfc9] p-2"><input className="min-h-10 rounded border px-2" placeholder="النص العثماني البديل" value={variant.uthmanicText} onChange={(e)=>setVariants(variants.map((v,i)=>i===index?{...v,uthmanicText:e.target.value}:v))}/><input className="min-h-10 rounded border px-2" placeholder="النص المعياري" value={variant.normalizedText} onChange={(e)=>setVariants(variants.map((v,i)=>i===index?{...v,normalizedText:e.target.value}:v))}/><input className="min-h-10 rounded border px-2" placeholder="ملاحظة صوتية" value={variant.phoneticNote} onChange={(e)=>setVariants(variants.map((v,i)=>i===index?{...v,phoneticNote:e.target.value}:v))}/><select className="min-h-10 rounded border px-2" value={variant.faceIndex} onChange={(e)=>setVariants(variants.map((v,i)=>i===index?{...v,faceIndex:e.target.value}:v))}><option value="">للتعليق كله</option>{faces.map((_,i)=><option key={i} value={i}>وجه {i+1}</option>)}</select></div>)}</div>
          <div className="space-y-1"><b className="text-sm">المصادر</b>{sources.length ? sources.map((source) => <label key={source.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sourceIds.includes(source.id)} onChange={(e) => setSourceIds(e.target.checked ? [...sourceIds, source.id] : sourceIds.filter((id) => id !== source.id))}/>{source.titleAr}</label>) : <p className="text-xs text-[#665b48]">لا توجد مصادر موثقة مهيأة بعد.</p>}</div>
          <button type="button" className="text-sm font-bold text-[#80662c]" onClick={()=>setAdvanced(!advanced)}>خيارات متقدمة {advanced ? '−' : '+'}</button>
          {advanced ? <div className="grid gap-3 rounded-lg border border-[#eadfc9] p-3"><p className="text-xs text-[#665b48]">نقطة البداية: {key} · نقطة النهاية: {key}</p><label>المصحف<select className="mt-1 w-full rounded border p-2" value={corpusId} onChange={(e)=>{setCorpusId(e.target.value);setFrameworkId('')}}><option value="">بدون تحديد</option>{corpora.map((corpus)=><option key={corpus.id} value={corpus.id}>{corpus.nameAr}</option>)}</select></label><label>المنهج<select className="mt-1 w-full rounded border p-2" value={frameworkId} onChange={(e)=>setFrameworkId(e.target.value)}><option value="">بدون تحديد</option>{frameworks.filter((framework)=>!corpusId || framework.corpusId===corpusId).map((framework)=><option key={framework.id} value={framework.id}>{framework.nameAr}</option>)}</select></label><label>النطاق<select className="mt-1 w-full rounded border p-2" value={scopeType} onChange={(e)=>setScopeType(e.target.value as typeof scopeType)}><option value="WORD">كلمة</option><option value="RANGE">نطاق</option><option value="BOUNDARY">حد فاصل</option></select></label><label>السياق<select className="mt-1 w-full rounded border p-2" value={readingContext} onChange={(e)=>setReadingContext(e.target.value)}><option>BOTH</option><option>WASL_ONLY</option><option>WAQF_ONLY</option></select></label><label>الإرث<select className="mt-1 w-full rounded border p-2" value={inheritanceAction} onChange={(e)=>setInheritanceAction(e.target.value)}><option>INHERIT</option><option>OVERRIDE</option><option>EXCLUDE</option></select></label><label className="flex gap-2"><input type="checkbox" checked={appliesToDescendants} onChange={(e)=>setAppliesToDescendants(e.target.checked)}/> ينطبق على الفروع</label><label>تجاوز اللون<input className="mt-1 w-full rounded border p-2" placeholder="#RRGGBB" value={colorOverride} onChange={(e)=>setColorOverride(e.target.value)}/></label><label>ملاحظات<textarea className="mt-1 min-h-20 w-full rounded border p-2" value={notes} onChange={(e)=>setNotes(e.target.value)}/></label></div> : null}
          {error ? <p className="rounded border border-[#c07662] bg-[#fff1ed] p-2 text-sm text-[#8a2f1b]">{error}</p> : null}
        </>}
      </div>
      <footer className="flex flex-wrap gap-2 border-t border-[#eadfc9] p-4"><button type="button" className="min-h-11 flex-1 rounded bg-[#59461d] px-4 font-bold text-white disabled:opacity-50" disabled={loading || saving} onClick={()=>void save()}>{saving ? 'جارٍ الحفظ…' : editing ? 'حفظ التعديل' : 'حفظ'}</button><button type="button" className="min-h-11 rounded border border-[#b99b51] px-3 text-xs" disabled={loading || saving} onClick={()=>void save(-1)}>حفظ وسابقة</button><button type="button" className="min-h-11 rounded border border-[#b99b51] px-3 text-xs" disabled={loading || saving} onClick={()=>void save(1)}>حفظ وتالية</button><button type="button" className="min-h-11 rounded border border-[#d7c7a7] px-4" onClick={onClose}>إلغاء</button></footer>
    </section>
  </div>
}
