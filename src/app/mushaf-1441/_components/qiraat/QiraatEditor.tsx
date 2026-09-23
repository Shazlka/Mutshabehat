'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MushafWord } from '../../../../../packages/quran-data/mushaf1441/types'

type Entity = { id: string; parentId: string | null; type: string; nameAr: string; color: string | null }
type FacePreset = { faceType: string; faceValue: string; labelAr: string }
type Taxonomy = { id: string; parentId: string | null; category: 'USUL' | 'FARSH'; nameAr: string; code?: string; metadata?: { face_presets?: FacePreset[] } }
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
  const request = fetch(`/api/mushaf-1441/qiraat-editor?canonicalKey=${encodeURIComponent(key)}`)
    .then(async (response) => {
      const result = { response, data: await response.json().catch(() => null) }
      // A 401/4xx/5xx is not a usable catalog snapshot. Keep the cache only for successful
      // responses so reopening after login/recovery retries instead of replaying a stale failure.
      if (!response.ok) editorLoadRequests.delete(key)
      return result
    })
    .catch((error) => {
      // Do not poison the per-word request cache after a transient network/503 failure. The
      // editor's retry/reopen path must be able to issue a fresh request.
      editorLoadRequests.delete(key)
      throw error
    })
  editorLoadRequests.set(key, request)
  return request
}

export function canonicalKeyForWord(word: MushafWord) {
  return `${String(word.surahNumber).padStart(3, '0')}:${String(word.ayahNumber).padStart(3, '0')}:${String(word.wordIndexInAyah).padStart(3, '0')}`
}

export default function QiraatEditor({ word, onClose, onSaved, onNavigate, initialScope, inline = false }: { word: MushafWord; onClose(): void; onSaved(): void; onNavigate?(direction: 1 | -1): Promise<void>; initialScope?: { startCanonicalKey: string; endCanonicalKey: string; scopeType: 'RANGE' | 'BOUNDARY' }; inline?: boolean }) {
  const key = useMemo(() => canonicalKeyForWord(word), [word])
  // Lazy initialization keeps the open timestamp stable without calling an impure function during
  // every render (React's purity lint correctly rejects useRef(Date.now())).
  const [openedAt] = useState(() => Date.now())
  const [startCanonicalKey, setStartCanonicalKey] = useState(initialScope?.startCanonicalKey ?? key)
  const [endCanonicalKey, setEndCanonicalKey] = useState(initialScope?.endCanonicalKey ?? key)
  const [entities, setEntities] = useState<Entity[]>([])
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [corpora, setCorpora] = useState<Corpus[]>([])
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [existing, setExisting] = useState<Existing[]>([])
  const [entityId, setEntityId] = useState('')
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([])
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
  const [faceEditorIndex, setFaceEditorIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      setLoading(true); setError(null)
      const { response, data } = await loadEditorData(key)
      if (!active) return
      if (!response.ok) { setError(data?.error === 'unauthorized' ? 'يلزم تسجيل الدخول لتحرير القراءات.' : (data?.error ?? 'تعذر تحميل محرر القراءات.')); setLoading(false); return }
      setEntities(data.catalog?.entities ?? []); setTaxonomies(data.catalog?.taxonomies ?? []); setSources(data.catalog?.sources ?? []); setCorpora(data.catalog?.corpora ?? []); setFrameworks(data.catalog?.frameworks ?? []); setExisting(data.annotations ?? [])
      setLoading(false)
    })().catch(() => { if (active) { setError('تعذر تحميل محرر القراءات.'); setLoading(false) } })
    return () => { active = false }
  }, [key])

  const selectedEntity = entities.find((entity) => entity.id === entityId)
  function edit(item: Existing) {
    setEditing(item); setEntityId(item.targetAuthorityId); setSelectedEntityIds([item.targetAuthorityId]); setTaxonomyId(item.taxonomyId); setStatus(item.status)
    setStartCanonicalKey(item.startCanonicalKey); setEndCanonicalKey(item.endCanonicalKey)
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
      startCanonicalKey, endCanonicalKey, scopeType, targetAuthorityId: entityId, taxonomyId, corpusId, frameworkId, status, colorOverride, notes,
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
    setEditing(null); setAssignments([]); setSelectedEntityIds([]); setFaces([emptyFace()]); setVariants([]); setSourceIds([]); setColorOverride('')
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

  const readerEntities = entities.filter((entity) => entity.type === 'reader')
  const selectedReaderId = selectedEntity?.type === 'reader' ? selectedEntity.id : selectedEntity?.parentId
  const narratorEntities = entities.filter((entity) => entity.parentId === selectedReaderId)
  const taxonomyRoots = taxonomies.filter((taxonomy) => taxonomy.parentId === null)
  const selectedTaxonomy = taxonomies.find((taxonomy) => taxonomy.id === taxonomyId)
  const selectedRoot = taxonomyRoots.find((root) => root.category === selectedTaxonomy?.category)
  const selectedParent = selectedTaxonomy?.parentId ? taxonomies.find((taxonomy) => taxonomy.id === selectedTaxonomy.parentId) : null
  const taxonomyGroups = selectedRoot ? taxonomies.filter((taxonomy) => taxonomy.parentId === selectedRoot.id) : []
  const selectedIsRoot = selectedTaxonomy?.id === selectedRoot?.id
  const taxonomyChildren = selectedTaxonomy && !selectedIsRoot
    ? taxonomies.filter((taxonomy) => taxonomy.parentId === selectedTaxonomy.id)
    : []
  const facePresets = !selectedIsRoot && taxonomyChildren.length === 0 ? (selectedTaxonomy?.metadata?.face_presets ?? []) : []
  const setPresetFace = (labelAr: string, faceType = 'CUSTOM', faceValue = '') => {
    setFaces((current) => current.some((face) => face.labelAr === labelAr) ? current : [...current.filter((face) => face.labelAr || face.faceValue), { faceType, faceValue, labelAr, preferenceStatus: '' }])
  }
  const chooseEntity = (id: string) => {
    setEntityId(id)
    setSelectedEntityIds((current) => {
      if (!current.includes(id)) return [...current, id]
      const next = current.filter((selectedId) => selectedId !== id)
      if (entityId === id) setEntityId(next[next.length - 1] ?? '')
      return next
    })
    setAssignments((current) => current.filter((assignment) => assignment.entityId !== id))
  }
  const removeSelectedEntity = (id: string) => {
    setSelectedEntityIds((current) => current.filter((selectedId) => selectedId !== id))
    if (entityId === id) setEntityId(selectedEntityIds.find((selectedId) => selectedId !== id) ?? '')
  }
  const compactButton = 'min-h-8 rounded-full border border-[#d7c7a7] bg-white px-3 py-1 text-xs font-bold transition-colors hover:border-[#80662c] data-[selected=true]:border-[#80662c] data-[selected=true]:bg-[#f2e7c7]'

  const shell = inline ? 'flex h-full min-h-0 w-[min(460px,42vw)] shrink-0 flex-col border-s border-[#d7c7a7] bg-[#fffdf8]' : 'fixed inset-0 z-[70] flex items-end bg-black/40 sm:items-stretch sm:justify-end'
  return <div className={shell} role="dialog" aria-modal={!inline} aria-label="محرر القراءات" data-qiraat-editor-pane="true">
    {!inline ? <button className="absolute inset-0" aria-label="إغلاق محرر القراءات" onClick={() => { if (Date.now() - openedAt > 500) onClose() }} /> : null}
    <section className={inline ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-[#fffdf8] shadow-2xl sm:max-h-none sm:w-[min(620px,48vw)] sm:rounded-none'} dir="rtl">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#eadfc9] bg-[#fffaf0] px-3 py-2">
        <div className="min-w-0"><div className="flex items-center gap-2"><b className="text-xs text-[#80662c]">محرر القراءات</b><span className="rounded-full bg-[#f2e7c7] px-2 py-0.5 text-[10px]">{existing.length} تعليق · {existing.filter((a) => a.status === 'verified').length} موثق</span></div><div className="flex items-baseline gap-2"><span className="font-[family-name:var(--font-amiri-quran)] text-xl text-[#171717]">{word.textUthmani}</span><span className="truncate text-[11px] text-[#665b48]">{word.surahNumber}:{word.ayahNumber} · كلمة {word.wordIndexInAyah} · ص {word.pageNumber}</span></div><code className="text-[10px] text-[#80662c]">{key}</code></div>
        <button type="button" className="min-h-9 min-w-9 rounded border border-[#d7c7a7] text-lg" onClick={onClose}>×</button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3" data-qiraat-editor-scroll="true">
        {loading ? <p className="text-sm text-[#665b48]">جارٍ تحميل البيانات…</p> : <>
          {existing.length ? <div className="flex flex-wrap gap-1.5">{existing.map((item) => <div key={item.id} className="flex items-center gap-1 rounded-full border border-[#eadfc9] bg-white px-2 py-1 text-[11px]"><button type="button" onClick={() => edit(item)}>{entities.find((x) => x.id === item.targetAuthorityId)?.nameAr ?? item.targetAuthorityId} · {taxonomies.find((x) => x.id === item.taxonomyId)?.nameAr ?? 'قاعدة'} · {item.faces.length} أوجه</button><button type="button" aria-label="حذف" className="text-[#8a2f1b]" onClick={() => void remove(item)}>×</button></div>)}</div> : <p className="text-[11px] text-[#8b7f6a]">لا توجد تعليقات محفوظة على هذه الكلمة.</p>}
          <div className="space-y-2 rounded-lg border border-[#eadfc9] bg-[#fffaf0] p-2">
            <div className="flex items-center justify-between"><b className="text-xs">السلطة</b>{selectedEntity ? <span className="text-[10px]" style={selectedEntity.color ? { color: selectedEntity.color } : undefined}>● {selectedEntity.nameAr}</span> : null}</div>
            <div className="flex flex-wrap gap-1.5">{readerEntities.map((entity) => <button key={entity.id} type="button" className={compactButton} data-selected={selectedEntityIds.includes(entity.id)} style={entity.color ? { borderColor: selectedEntityIds.includes(entity.id) ? entity.color : undefined } : undefined} onClick={() => chooseEntity(entity.id)}>{entity.nameAr}</button>)}</div>
            {narratorEntities.length ? <div className="flex flex-wrap gap-1.5 border-t border-[#eadfc9] pt-2">{narratorEntities.map((entity) => <button key={entity.id} type="button" className={compactButton} data-selected={selectedEntityIds.includes(entity.id)} onClick={() => chooseEntity(entity.id)}>{entity.nameAr.replace(/^—\s*/, '')}</button>)}</div> : null}
            {selectedEntityIds.length ? <div className="flex flex-wrap gap-1"><span className="w-full text-[10px] text-[#665b48]">السلطات المختارة</span>{selectedEntityIds.map((id) => { const selected = entities.find((entity) => entity.id === id); return selected ? <span key={id} className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1 text-[11px]" style={selected.color ? { borderColor: selected.color } : undefined}><span>{selected.nameAr}</span><button type="button" aria-label={`إزالة ${selected.nameAr}`} className="text-[#8a2f1b]" onClick={() => removeSelectedEntity(id)}>×</button></span> : null })}</div> : null}
            {selectedEntityIds.length ? <button type="button" className="text-[11px] font-bold text-[#80662c]" onClick={() => { if (!taxonomyId) { setError('اختر القاعدة أولاً.'); return } setAssignments((current) => [...current, ...selectedEntityIds.filter((id) => !current.some((item) => item.entityId === id && item.taxonomyId === taxonomyId)).map((id) => ({ entityId: id, taxonomyId }))]) }}>+ إضافة السلطات للقاعدة المختارة</button> : null}
          </div>
          <div className="space-y-2 rounded-lg border border-[#eadfc9] p-2"><div className="flex gap-1.5"><button type="button" className={compactButton} data-selected={selectedTaxonomy?.category === 'USUL'} onClick={() => { const root = taxonomyRoots.find((t) => t.category === 'USUL'); if (root) { setTaxonomyId(root.id); setError(null) } }}>الأصول</button><button type="button" className={compactButton} data-selected={selectedTaxonomy?.category === 'FARSH'} onClick={() => { const root = taxonomyRoots.find((t) => t.category === 'FARSH'); if (root) { setTaxonomyId(root.id); setError(null) } }}>فرش الحروف</button></div>{selectedTaxonomy ? <div className="flex flex-wrap gap-1.5 border-t border-[#eadfc9] pt-2">{taxonomyGroups.map((taxonomy) => <button key={taxonomy.id} type="button" className={compactButton} data-selected={taxonomyId === taxonomy.id} onClick={() => setTaxonomyId(taxonomy.id)}>{taxonomy.nameAr}</button>)}</div> : null}{taxonomyChildren.length ? <div className="flex flex-wrap gap-1.5 border-t border-[#eadfc9] pt-2">{taxonomyChildren.map((taxonomy) => <button key={taxonomy.id} type="button" className={compactButton} data-selected={taxonomyId === taxonomy.id} onClick={() => setTaxonomyId(taxonomy.id)}>{taxonomy.nameAr}</button>)}</div> : null}<p className="text-[10px] text-[#80662c]">{selectedTaxonomy ? [selectedRoot?.nameAr, ...(selectedIsRoot ? [] : [selectedParent && selectedParent.id !== selectedRoot?.id ? selectedParent.nameAr : null, selectedTaxonomy.nameAr])].filter(Boolean).join(' › ') : 'اختر نوع القاعدة'}</p></div>
          {!editing && assignments.length ? <div className="flex flex-wrap gap-1.5 rounded-lg border border-[#eadfc9] p-2"><b className="w-full text-[11px]">التعيينات</b>{assignments.map((assignment, index) => <span key={`${assignment.entityId}-${assignment.taxonomyId}`} className="rounded-full border border-[#b99b51] bg-[#fffaf0] px-2 py-1 text-[11px]">{entities.find((e) => e.id === assignment.entityId)?.nameAr} → {taxonomies.find((t) => t.id === assignment.taxonomyId)?.nameAr}<button type="button" className="mr-1 text-[#8a2f1b]" onClick={() => setAssignments(assignments.filter((_, i) => i !== index))}>×</button></span>)}</div> : null}
          <div className="space-y-1.5"><div className="flex flex-wrap items-center gap-1.5"><b className="ml-1 text-xs">الأوجه</b>{faces.filter((face) => face.labelAr || face.faceValue).map((face, index) => <span key={`${face.labelAr}-${index}`} className={`inline-flex items-center rounded-full border px-1 py-0.5 text-[11px] ${face.preferenceStatus === 'muqaddam' ? 'border-[#80662c] bg-[#f2e7c7]' : 'border-[#b99b51] bg-[#fffaf0]'}`}><button type="button" className="px-1" onClick={() => setFaceEditorIndex(faceEditorIndex === index ? null : index)}>{face.labelAr || face.faceValue}</button><button type="button" aria-label={`حذف الوجه ${face.labelAr || index + 1}`} className="px-1 text-[#8a2f1b]" onClick={() => { setFaces(faces.filter((_, faceIndex) => faceIndex !== index)); setFaceEditorIndex(null) }}>×</button></span>)}{facePresets.length ? facePresets.map((preset) => <button type="button" key={`${preset.faceType}-${preset.faceValue}-${preset.labelAr}`} className={compactButton} onClick={() => setPresetFace(preset.labelAr, preset.faceType, preset.faceValue)}>{preset.labelAr}</button>) : selectedTaxonomy && taxonomyChildren.length === 0 ? <button type="button" className={compactButton} onClick={() => setPresetFace('وجه مخصص')}>وجه مخصص +</button> : <span className="text-[11px] text-[#8b7f6a]">اختر القاعدة أولاً لإظهار الأوجه.</span>}</div>{faceEditorIndex !== null && faces[faceEditorIndex] ? <div className="grid grid-cols-2 gap-1.5 rounded border border-[#eadfc9] bg-[#fffaf0] p-1.5"><input className="min-h-8 rounded border border-[#d7c7a7] bg-white px-2 text-[11px]" aria-label="تسمية الوجه" value={faces[faceEditorIndex].labelAr} onChange={(e) => setFaces(faces.map((face, index) => index === faceEditorIndex ? { ...face, labelAr: e.target.value } : face))}/><select className="min-h-8 rounded border border-[#d7c7a7] bg-white px-1 text-[11px]" aria-label="أفضلية الوجه" value={faces[faceEditorIndex].preferenceStatus} onChange={(e) => setFaces(faces.map((face, index) => index === faceEditorIndex ? { ...face, preferenceStatus: e.target.value as Face['preferenceStatus'] } : face))}><option value="">بلا أفضلية</option><option value="muqaddam">مقدم</option><option value="secondary">ثانوي</option><option value="equal">متساوٍ</option></select></div> : null}</div>
          <div className="grid grid-cols-2 gap-2"><label className="text-[11px] font-bold">الحالة<select className="mt-1 min-h-9 w-full rounded border border-[#d7c7a7] bg-white px-2 text-xs" value={status} onChange={(e) => setStatus(e.target.value)}><option value="draft">مسودة</option><option value="reviewed">مراجع</option><option value="verified">موثق</option></select></label><label className="text-[11px] font-bold">اللون<input className="mt-1 min-h-9 w-full rounded border border-[#d7c7a7] bg-white px-2 text-xs" placeholder="افتراضي" value={colorOverride} onChange={(e) => setColorOverride(e.target.value)}/></label></div>
          <div className="space-y-2"><button type="button" className="text-xs font-bold text-[#80662c]" onClick={() => setVariants([...variants, emptyVariant()])}>+ بديل قرائي</button>{variants.map((variant,index) => <div key={index} className="grid grid-cols-2 gap-1.5"><input className="min-h-9 rounded border px-2 text-xs" placeholder="النص البديل" value={variant.uthmanicText} onChange={(e)=>setVariants(variants.map((v,i)=>i===index?{...v,uthmanicText:e.target.value}:v))}/><select className="min-h-9 rounded border px-2 text-xs" value={variant.faceIndex} onChange={(e)=>setVariants(variants.map((v,i)=>i===index?{...v,faceIndex:e.target.value}:v))}><option value="">للتعليق كله</option>{faces.map((_,i)=><option key={i} value={i}>وجه {i+1}</option>)}</select></div>)}</div>
          <button type="button" className="text-xs font-bold text-[#80662c]" onClick={() => setAdvanced(!advanced)}>تفاصيل متقدمة {advanced ? '▲' : '▼'}</button>
          {advanced ? <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#eadfc9] p-2 text-xs"><span className="col-span-2 text-[10px] text-[#665b48]">{startCanonicalKey} → {endCanonicalKey} · {scopeType}</span><label>المصحف<select className="mt-1 w-full rounded border p-1.5" value={corpusId} onChange={(e)=>{setCorpusId(e.target.value);setFrameworkId('')}}><option value="">افتراضي</option>{corpora.map((corpus) => <option key={corpus.id} value={corpus.id}>{corpus.nameAr}</option>)}</select></label><label>المنهج<select className="mt-1 w-full rounded border p-1.5" value={frameworkId} onChange={(e)=>setFrameworkId(e.target.value)}><option value="">افتراضي</option>{frameworks.filter((framework) => !corpusId || framework.corpusId === corpusId).map((framework) => <option key={framework.id} value={framework.id}>{framework.nameAr}</option>)}</select></label><label>السياق<select className="mt-1 w-full rounded border p-1.5" value={readingContext} onChange={(e)=>setReadingContext(e.target.value)}><option>BOTH</option><option>WASL_ONLY</option><option>WAQF_ONLY</option></select></label><label>الإرث<select className="mt-1 w-full rounded border p-1.5" value={inheritanceAction} onChange={(e)=>setInheritanceAction(e.target.value)}><option>INHERIT</option><option>OVERRIDE</option><option>EXCLUDE</option></select></label><label className="col-span-2 flex gap-2"><input type="checkbox" checked={appliesToDescendants} onChange={(e)=>setAppliesToDescendants(e.target.checked)}/> ينطبق على الفروع</label>{sources.length ? <fieldset className="col-span-2"><legend className="mb-1 font-bold">المراجع</legend><div className="flex flex-wrap gap-1.5">{sources.map((source) => <label key={source.id} className="flex items-center gap-1 rounded border border-[#d7c7a7] bg-white px-2 py-1"><input type="checkbox" checked={sourceIds.includes(source.id)} onChange={(e)=>setSourceIds(e.target.checked ? [...sourceIds, source.id] : sourceIds.filter((id) => id !== source.id))}/>{source.titleAr}</label>)}</div></fieldset> : <p className="col-span-2 text-[11px] text-[#8b7f6a]">لا توجد مراجع موثقة مهيأة بعد.</p>}<label className="col-span-2">ملاحظات<textarea className="mt-1 min-h-14 w-full rounded border p-1.5" value={notes} onChange={(e)=>setNotes(e.target.value)}/></label></div> : null}
          {error ? <p className="rounded border border-[#c07662] bg-[#fff1ed] p-2 text-xs text-[#8a2f1b]">{error}</p> : null}
        </>}
      </div>
      <footer className="sticky bottom-0 z-10 flex shrink-0 gap-1.5 border-t border-[#eadfc9] bg-[#fffaf0]/95 p-2 backdrop-blur"><button type="button" className="min-h-9 flex-1 rounded bg-[#59461d] px-2 text-xs font-bold text-white disabled:opacity-50" disabled={loading || saving} onClick={()=>void save()}>{saving ? 'حفظ…' : editing ? 'حفظ التعديل' : 'حفظ'}</button><button type="button" className="min-h-9 rounded border border-[#b99b51] px-2 text-[11px]" disabled={loading || saving} onClick={()=>void save(-1)}>سابق</button><button type="button" className="min-h-9 rounded border border-[#b99b51] px-2 text-[11px]" disabled={loading || saving} onClick={()=>void save(1)}>تالي</button><button type="button" className="min-h-9 rounded border border-[#d7c7a7] px-2 text-[11px]" onClick={onClose}>إلغاء</button></footer>
    </section>
  </div>
}
