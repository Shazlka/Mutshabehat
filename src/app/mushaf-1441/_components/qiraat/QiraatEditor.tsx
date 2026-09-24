'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MushafWord } from '../../../../../packages/quran-data/mushaf1441/types'

type Entity = { id: string; parentId: string | null; type: string; nameAr: string; color: string | null }
type FacePreset = { faceType: string; faceValue: string; labelAr: string }
type Taxonomy = { id: string; parentId: string | null; category: 'USUL' | 'FARSH'; nameAr: string; code?: string; metadata?: { face_presets?: FacePreset[] } }
type Source = { id: string; titleAr: string }
type Corpus = { id: string; code: string; nameAr: string }
type Framework = { id: string; corpusId: string; code: string; nameAr: string }
type HamzahValue = { first: string; second?: string; relation?: string; insertion?: boolean; replacementFirst?: string; replacementSecond?: string }
type Face = { id?: string; faceType: string; faceValue: string | HamzahValue; labelAr: string; preferenceStatus: '' | 'muqaddam' | 'secondary' | 'equal' }
type Variant = { uthmanicText: string; normalizedText: string; phoneticNote: string; faceIndex: string }
type Existing = { id: string; scopeType: 'WORD' | 'RANGE' | 'BOUNDARY'; startCanonicalKey: string; endCanonicalKey: string; targetAuthorityId: string; taxonomyId: string; corpusId: string | null; frameworkId: string | null; status: string; version: number; readingContext: string; inheritanceAction: string; appliesToDescendants: boolean; colorOverride: string | null; notes: string | null; faces: Array<{ id: string; faceType: string; faceValue: unknown; labelAr: string; preferenceStatus: Face['preferenceStatus']; sortOrder: number }>; variants: Array<{ uthmanicText: string | null; normalizedText: string | null; phoneticNote: string | null; renderMode?: string; faceId: string | null }>; sources: Array<{ sourceId: string; referenceText?: string; notes?: string }> }
type Match = { id: string; canonicalKey: string; surah: number; ayah: number; page: number; word: string; authorityId: string; taxonomyId: string; readingContext: string; faces: Array<{ label: string }>; status: string }
type Occurrence = { canonicalKey: string; surah: number; ayah: number; page: number; token: number; word: string; state: 'source' | 'existing' | 'review' | 'conflict' | 'add'; verification: string | null; existingVariant: string | null }

const emptyFace = (): Face => ({ faceType: 'CUSTOM', faceValue: '', labelAr: '', preferenceStatus: '' })
const emptyVariant = (): Variant => ({ uthmanicText: '', normalizedText: '', phoneticNote: '', faceIndex: '' })
type EditorCatalog = { entities?: Entity[]; taxonomies?: Taxonomy[]; sources?: Source[]; corpora?: Corpus[]; frameworks?: Framework[] }
let catalogCache: EditorCatalog | null = null
const editorLoadRequests = new Map<string, Promise<{ response: Response; data: { catalog?: EditorCatalog; annotations?: Existing[]; error?: string } | null }>>()

function loadEditorData(key: string) {
  const cached = editorLoadRequests.get(key)
  if (cached) return cached
  const request = fetch(`/api/mushaf-1441/qiraat-editor?canonicalKey=${encodeURIComponent(key)}${catalogCache ? '&catalog=0' : ''}`)
    .then(async (response) => {
      const data = await response.json().catch(() => null) as { catalog?: EditorCatalog; annotations?: Existing[]; error?: string } | null
      if (response.ok && data?.catalog) catalogCache = data.catalog
      if (response.ok && data && !data.catalog && catalogCache) data.catalog = catalogCache
      const result = { response, data }
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
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [copyOpen, setCopyOpen] = useState(false)
  const [copySource, setCopySource] = useState<Existing | null>(null)
  const [copySelectedFaceIds, setCopySelectedFaceIds] = useState<string[]>([])
  const [occurrences, setOccurrences] = useState<Occurrence[] | null>(null)
  const [bulkSourceId, setBulkSourceId] = useState('')
  const [bulkSelected, setBulkSelected] = useState<string[]>([])
  const [visibleOccurrenceCount, setVisibleOccurrenceCount] = useState(100)
  const [busyAction, setBusyAction] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      setLoading(true); setError(null)
      const { response, data } = await loadEditorData(key)
      if (!active) return
      if (!response.ok) { setError(data?.error === 'unauthorized' ? 'يلزم تسجيل الدخول لتحرير القراءات.' : (data?.error ?? 'تعذر تحميل محرر القراءات.')); setLoading(false); return }
      setEntities(data?.catalog?.entities ?? []); setTaxonomies(data?.catalog?.taxonomies ?? []); setSources(data?.catalog?.sources ?? []); setCorpora(data?.catalog?.corpora ?? []); setFrameworks(data?.catalog?.frameworks ?? []); setExisting(data?.annotations ?? [])
      setLoading(false)
      void fetch(`/api/mushaf-1441/qiraat-editor?canonicalKey=${encodeURIComponent(key)}&verified=1`)
        .then((response) => response.ok ? response.json() : null)
        .then((result) => { if (active) setMatches(result?.matches ?? []) })
        .catch(() => {})
    })().catch(() => { if (active) { setError('تعذر تحميل محرر القراءات.'); setLoading(false) } })
    return () => { active = false }
  }, [key])

  const selectedEntity = entities.find((entity) => entity.id === entityId)
  function edit(item: Existing) {
    setEditing(item); setEntityId(item.targetAuthorityId); setSelectedEntityIds([item.targetAuthorityId]); setTaxonomyId(item.taxonomyId); setStatus(item.status)
    setStartCanonicalKey(item.startCanonicalKey); setEndCanonicalKey(item.endCanonicalKey)
    setColorOverride(item.colorOverride ?? ''); setReadingContext(item.readingContext); setInheritanceAction(item.inheritanceAction); setAppliesToDescendants(item.appliesToDescendants); setScopeType(item.scopeType); setNotes(item.notes ?? ''); setCorpusId(item.corpusId ?? ''); setFrameworkId(item.frameworkId ?? '')
    setFaces(item.faces.length ? item.faces.map((face) => ({ id: face.id, faceType: face.faceType, faceValue: typeof face.faceValue === 'string' || (face.faceValue && typeof face.faceValue === 'object') ? face.faceValue as string | HamzahValue : '', labelAr: face.labelAr, preferenceStatus: face.preferenceStatus ?? '' })) : [emptyFace()])
    setVariants(item.variants.map((variant) => ({ uthmanicText: variant.uthmanicText ?? '', normalizedText: variant.normalizedText ?? '', phoneticNote: variant.phoneticNote ?? '', faceIndex: variant.faceId ? String(item.faces.findIndex((face) => face.id === variant.faceId)) : '' })))
    setSourceIds(item.sources.map((source) => source.sourceId)); setAdvanced(true); setError(null)
  }
  function duplicate(item: Existing) { edit(item); setFaces((current) => current.map((face) => ({ faceType: face.faceType, faceValue: face.faceValue, labelAr: face.labelAr, preferenceStatus: face.preferenceStatus }))); setEditing(null); setStatus('draft'); setMessage('نُسخ الوجه إلى النموذج. راجع التفاصيل ثم احفظه.') }
  async function removeSelected() {
    const items = existing.filter((item) => selectedIds.includes(item.id))
    if (!items.length) return
    const names = items.map((item) => entities.find((entity) => entity.id === item.targetAuthorityId)?.nameAr ?? item.targetAuthorityId).join('، ')
    if (!window.confirm(`سيتم حذف ${items.length} أوجه مسجلة لهذه الكلمة. هل تريد المتابعة؟\n${names}`)) return
    setBusyAction(true); setError(null)
    const response = await fetch('/api/mushaf-1441/qiraat-editor?bulk=1', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: items.map((item) => ({ id: item.id, expectedVersion: item.version })) }) })
    const data = await response.json().catch(() => null)
    setBusyAction(false)
    if (response.status === 409) { setError('تعارض في نسخة أحد الأوجه؛ لم يُحذف أي وجه. أعد فتح الكلمة للمراجعة.'); return }
    if (!response.ok) { setError(data?.error ?? 'تعذر حذف الأوجه.'); return }
    editorLoadRequests.delete(key)
    setExisting((current) => current.filter((entry) => !selectedIds.includes(entry.id)))
    setSelectedIds([]); setEditing(null); onSaved()
  }
  async function openBulk(item: Existing) {
    setBusyAction(true); setError(null); setBulkSourceId(item.id)
    try {
      const response = await fetch(`/api/mushaf-1441/qiraat-editor?sourceId=${encodeURIComponent(item.id)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      const rows: Occurrence[] = data.occurrences ?? []
      setOccurrences(rows); setVisibleOccurrenceCount(100); setBulkSelected(rows.filter((row) => row.state === 'add').map((row) => row.canonicalKey))
    } catch { setError('تعذر عرض مواضع الكلمة.') }
    setBusyAction(false)
  }
  async function openCopySource(match: Match) {
    setBusyAction(true); setError(null)
    try {
      const loaded = await loadEditorData(match.canonicalKey)
      if (!loaded.response.ok) throw new Error('source lookup failed')
      const source = loaded.data?.annotations?.find((item) => item.id === match.id && item.status === 'verified' && item.scopeType === 'WORD')
      if (!source) throw new Error('verified source unavailable')
      setCopySource(source); setCopySelectedFaceIds(source.faces.map((face) => face.id))
    } catch { setError('تعذر نسخ الوجه من الموضع السابق.') }
    setBusyAction(false)
  }
  async function copyVerifiedFaces() {
    if (!copySource || !copySelectedFaceIds.length) return
    setBusyAction(true); setError(null)
    const selectedFaces = copySource.faces.filter((face) => copySelectedFaceIds.includes(face.id))
    const response = await fetch('/api/mushaf-1441/qiraat-editor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      startCanonicalKey: key, endCanonicalKey: key, scopeType: 'WORD', targetAuthorityId: copySource.targetAuthorityId,
      taxonomyId: copySource.taxonomyId, corpusId: copySource.corpusId, frameworkId: copySource.frameworkId,
      readingContext: copySource.readingContext, inheritanceAction: copySource.inheritanceAction,
      appliesToDescendants: copySource.appliesToDescendants, colorOverride: copySource.colorOverride,
      notes: copySource.notes, status: 'draft', sourceAnnotationId: copySource.id,
      faces: selectedFaces.map((face, index) => ({ faceType: face.faceType, faceValue: face.faceValue,
        labelAr: face.labelAr, preferenceStatus: face.preferenceStatus, sortOrder: index })),
      variants: copySource.variants.filter((variant) => !variant.faceId || copySelectedFaceIds.includes(variant.faceId)).map((variant) => ({
        uthmanicText: variant.uthmanicText, normalizedText: variant.normalizedText, phoneticNote: variant.phoneticNote, renderMode: variant.renderMode,
        faceIndex: variant.faceId ? selectedFaces.findIndex((face) => face.id === variant.faceId) : null })),
      sources: copySource.sources,
    }) })
    const data = await response.json().catch(() => null)
    setBusyAction(false)
    if (!response.ok) { setError(response.status === 409 ? 'تعارض مع وجه مسجل لهذا الراوي والباب؛ راجع الموضع قبل النسخ.' : (data?.error ?? 'تعذر نسخ الوجه.')); return }
    editorLoadRequests.delete(key); setExisting(data?.annotations ?? []); setCopySource(null)
    setMessage(data?.result === 'existing' ? 'موجود مسبقًا؛ لم يُنشأ سجل مكرر.' : 'نُسخت الأوجه المحددة إلى هذا الموضع كمسودة مستقلة.'); onSaved()
  }
  async function applyBulk() {
    const safe = occurrences?.filter((row) => bulkSelected.includes(row.canonicalKey) && row.state === 'add') ?? []
    if (!safe.length) return
    if (!window.confirm(`سيتم تطبيق هذا الوجه على ${safe.length} موضعًا آمنًا. هل تريد المتابعة؟`)) return
    setBusyAction(true); setError(null)
    try {
      const response = await fetch('/api/mushaf-1441/qiraat-editor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'apply-occurrences', sourceId: bulkSourceId, keys: safe.map((row) => row.canonicalKey) }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setMessage(`أضيف ${data.result.added} · موجود مسبقًا ${data.result.existing} · يحتاج مراجعة ${data.result.review} · تعارض ${data.result.conflicts} · غير صالح ${data.result.invalid}`)
      setOccurrences(null); setBulkSelected([]); editorLoadRequests.delete(key); onSaved()
      if (safe.some((row) => row.canonicalKey === key)) {
        const refreshed = await loadEditorData(key)
        if (refreshed.response.ok) setExisting(refreshed.data?.annotations ?? [])
      }
    } catch { setError('تعذر تطبيق الأوجه. لم تُعتمد عملية جزئية.') }
    setBusyAction(false)
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
    let data: { annotations?: Existing[]; error?: string; result?: string } | null = null
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
    if (data?.result === 'existing') setMessage('موجود مسبقًا؛ لم يُنشأ سجل مكرر.')
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
  const hamzahRule = selectedTaxonomy && (/همز/.test(selectedTaxonomy.nameAr) || selectedTaxonomy.code?.includes('HAMZ')) && taxonomyChildren.length === 0
  const twoHamzahs = hamzahRule && /الهمزتان|همزتين/.test(selectedTaxonomy.nameAr)
  const betweenWords = twoHamzahs && /كلمتين/.test(selectedTaxonomy.nameAr)
  const hamzahValue = faces.find((face) => face.faceType === 'HAMZAH' && typeof face.faceValue === 'object')?.faceValue as HamzahValue | undefined
  const setHamzah = (change: Partial<HamzahValue>) => {
    const value: HamzahValue = { first: hamzahValue?.first ?? 'تحقيق', ...(twoHamzahs ? { second: hamzahValue?.second ?? 'تحقيق' } : {}), ...hamzahValue, ...change }
    const label = twoHamzahs ? `${value.first} الأولى${value.replacementFirst ? ` ${value.replacementFirst}` : ''} + ${value.second} الثانية${value.replacementSecond ? ` ${value.replacementSecond}` : ''}${value.insertion === undefined ? '' : value.insertion ? ' · إدخال ألف' : ' · دون إدخال'}${value.relation ? ` · ${value.relation}` : ''}` : `${value.first} الهمزة${value.replacementFirst ? ` ${value.replacementFirst}` : ''}`
    setFaces((current) => {
      const prior = current.find((face) => face.faceType === 'HAMZAH')
      return [...current.filter((face) => face.faceType !== 'HAMZAH' && (face.labelAr || face.faceValue)), { id: prior?.id, faceType: 'HAMZAH', faceValue: value, labelAr: label, preferenceStatus: prior?.preferenceStatus ?? '' }]
    })
  }
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

  const shell = inline ? 'flex h-full min-h-0 w-full min-w-0 flex-col border-s border-[#d7c7a7] bg-[#fffdf8]' : 'fixed inset-0 z-[70] flex items-end bg-black/40 sm:items-stretch sm:justify-end'
  return <div className={shell} role="dialog" aria-modal={!inline} aria-label="محرر القراءات" data-qiraat-editor-pane="true">
    {!inline ? <button className="absolute inset-0" aria-label="إغلاق محرر القراءات" onClick={() => { if (Date.now() - openedAt > 500) onClose() }} /> : null}
    <section className={inline ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-[#fffdf8] shadow-2xl sm:max-h-none sm:w-[min(620px,48vw)] sm:rounded-none'} dir="rtl">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#eadfc9] bg-[#fffaf0] px-3 py-2">
        <div className="min-w-0"><div className="flex items-center gap-2"><b className="text-xs text-[#80662c]">الكلمة المحددة</b><span className="rounded-full bg-[#f2e7c7] px-2 py-0.5 text-[10px]">{existing.length} تعليق · {existing.filter((a) => a.status === 'verified').length} موثق</span></div><div className="flex items-baseline gap-2"><span className="font-[family-name:var(--font-amiri-quran)] text-xl text-[#171717]">{word.textUthmani}</span><span className="truncate text-[11px] text-[#665b48]">سورة {word.surahNumber} — الآية {word.ayahNumber} — الصفحة {word.pageNumber}</span></div><code className="text-[10px] text-[#80662c]">{key}</code></div>
        <button type="button" className="min-h-9 min-w-9 rounded border border-[#d7c7a7] text-lg" onClick={onClose}>×</button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3" data-qiraat-editor-scroll="true">
        {loading ? <p className="text-sm text-[#665b48]">جارٍ تحميل البيانات…</p> : <>
          <section className="space-y-1.5 rounded-lg border border-[#eadfc9] p-2" aria-label="الأوجه المسجلة">
            <div className="flex flex-wrap items-center gap-2"><b className="text-xs">الأوجه المسجلة</b><button type="button" className="text-[11px] underline" onClick={() => setSelectedIds(existing.map((item) => item.id))}>تحديد الكل</button><button type="button" className="text-[11px] underline" onClick={() => setSelectedIds([])}>إلغاء التحديد</button>{selectedIds.length ? <><span className="text-[11px]">تم تحديد {selectedIds.length} أوجه</span><button type="button" disabled={busyAction} className="rounded bg-[#8a2f1b] px-2 py-1 text-[11px] text-white" onClick={() => void removeSelected()}>حذف المحدد</button></> : null}</div>
            {existing.length ? existing.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-1 rounded border border-[#eadfc9] bg-white px-2 py-1 text-[11px]"><input type="checkbox" aria-label={`تحديد وجه ${entities.find((x) => x.id === item.targetAuthorityId)?.nameAr ?? item.targetAuthorityId}`} checked={selectedIds.includes(item.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}/><span className="min-w-0 flex-1">{entities.find((x) => x.id === item.targetAuthorityId)?.nameAr ?? item.targetAuthorityId} · {taxonomies.find((x) => x.id === item.taxonomyId)?.nameAr ?? 'قاعدة'} · {item.faces.map((face) => face.labelAr).join('، ') || 'بلا وجه'} · {item.readingContext === 'WASL_ONLY' ? 'وصل فقط' : item.readingContext === 'WAQF_ONLY' ? 'وقف فقط' : 'الوصل والوقف'} · {item.status}</span><button type="button" className="underline" onClick={() => edit(item)}>تعديل</button><button type="button" className="underline" onClick={() => duplicate(item)}>نسخ الوجه</button><button type="button" className="underline" onClick={() => void openBulk(item)}>تطبيق على جميع مواضع الكلمة</button></div>) : <p className="text-[11px] text-[#8b7f6a]">لا توجد تعليقات محفوظة على هذه الكلمة.</p>}
          </section>
          {matches.length ? <section className="space-y-1.5 rounded-lg border border-[#eadfc9] p-2"><button type="button" className="text-xs font-bold text-[#80662c]" onClick={() => setCopyOpen(!copyOpen)}>تمت مراجعة هذه الكلمة سابقًا · نسخ الأوجه من موضع سابق {copyOpen ? '▲' : '▼'}</button>{copyOpen ? <div className="max-h-40 space-y-1 overflow-y-auto">{matches.map((match) => <div key={match.id} className="flex items-center gap-2 rounded border p-1 text-[11px]"><span className="flex-1">سورة {match.surah}:{match.ayah} · ص {match.page} · {match.word} · {entities.find((e) => e.id === match.authorityId)?.nameAr} · {taxonomies.find((t) => t.id === match.taxonomyId)?.nameAr} · {match.faces.map((face) => face.label).join('، ')} · {match.readingContext} · موثق</span><button type="button" className="rounded border px-2 py-1" onClick={() => void openCopySource(match)}>اختيار الأوجه</button></div>)}</div> : null}</section> : null}
          {copySource ? <section className="space-y-1.5 rounded border border-[#b99b51] bg-[#fffaf0] p-2 text-xs"><b>اختر الأوجه المنسوخة · {entities.find((e) => e.id === copySource.targetAuthorityId)?.nameAr}</b><div className="flex gap-2"><button type="button" className="underline" onClick={() => setCopySelectedFaceIds(copySource.faces.map((face) => face.id))}>تحديد الكل</button><button type="button" className="underline" onClick={() => setCopySelectedFaceIds([])}>إلغاء التحديد</button></div>{copySource.faces.map((face) => <label key={face.id} className="flex items-center gap-2"><input type="checkbox" checked={copySelectedFaceIds.includes(face.id)} onChange={(event) => setCopySelectedFaceIds((current) => event.target.checked ? [...current,face.id] : current.filter((id) => id !== face.id))}/>{face.labelAr}</label>)}<div className="flex gap-2"><button type="button" disabled={busyAction || !copySelectedFaceIds.length} className="rounded bg-[#59461d] px-2 py-1 text-white disabled:opacity-50" onClick={() => void copyVerifiedFaces()}>نسخ إلى هذا الموضع</button><button type="button" className="underline" onClick={() => setCopySource(null)}>إلغاء</button></div></section> : null}
          {occurrences ? <section className="space-y-2 rounded-lg border border-[#b99b51] bg-[#fffaf0] p-2"><b className="text-xs">تم العثور على {occurrences.length} موضع</b><p className="text-[11px]">سيتم الإضافة: {occurrences.filter((row) => row.state === 'add').length} · موجود مسبقًا: {occurrences.filter((row) => row.state === 'existing').length} · يحتاج مراجعة: {occurrences.filter((row) => row.state === 'review').length} · تعارض: {occurrences.filter((row) => row.state === 'conflict').length}</p><div className="flex gap-2 text-[11px]"><button type="button" className="underline" onClick={() => setBulkSelected(occurrences.filter((row) => row.state === 'add').map((row) => row.canonicalKey))}>تحديد الكل الآمن</button><button type="button" className="underline" onClick={() => setBulkSelected([])}>إلغاء التحديد</button></div><div className="max-h-52 space-y-1 overflow-y-auto">{occurrences.slice(0,visibleOccurrenceCount).map((row) => <label key={row.canonicalKey} className="flex items-center gap-2 border-b py-1 text-[11px]"><input type="checkbox" disabled={row.state !== 'add'} checked={bulkSelected.includes(row.canonicalKey)} onChange={(event) => setBulkSelected((current) => event.target.checked ? [...current,row.canonicalKey] : current.filter((key) => key !== row.canonicalKey))}/><span>ص {row.page} · {row.surah}:{row.ayah} · كلمة {row.token} · {row.word} · {row.state === 'add' ? 'سيتم الإضافة' : row.state === 'existing' ? 'موجود مسبقًا' : row.state === 'review' ? 'يحتاج مراجعة' : row.state === 'conflict' ? 'تعارض' : 'المصدر'}{row.verification ? ` · ${row.verification}` : ''}{row.existingVariant ? ` · ${row.existingVariant}` : ''}</span></label>)}</div>{visibleOccurrenceCount < occurrences.length ? <button type="button" className="text-[11px] underline" onClick={() => setVisibleOccurrenceCount((count) => count + 100)}>عرض المزيد ({occurrences.length - visibleOccurrenceCount})</button> : null}<div className="flex gap-2"><button type="button" disabled={busyAction || !bulkSelected.length} className="rounded bg-[#59461d] px-2 py-1 text-xs text-white disabled:opacity-50" onClick={() => void applyBulk()}>تطبيق على المواضع الآمنة ({bulkSelected.length})</button><button type="button" className="text-xs underline" onClick={() => setOccurrences(null)}>إغلاق</button></div></section> : null}
          {message ? <p className="text-xs text-[#59461d]" role="status">{message}</p> : null}
          <div className="space-y-2 rounded-lg border border-[#eadfc9] bg-[#fffaf0] p-2">
            <div className="flex items-center justify-between"><b className="text-xs">السلطة</b>{selectedEntity ? <span className="text-[10px]" style={selectedEntity.color ? { color: selectedEntity.color } : undefined}>● {selectedEntity.nameAr}</span> : null}</div>
            <div className="flex flex-wrap gap-1.5">{readerEntities.map((entity) => <button key={entity.id} type="button" className={compactButton} data-selected={selectedEntityIds.includes(entity.id)} style={entity.color ? { borderColor: selectedEntityIds.includes(entity.id) ? entity.color : undefined } : undefined} onClick={() => chooseEntity(entity.id)}>{entity.nameAr}</button>)}</div>
            {narratorEntities.length ? <div className="flex flex-wrap gap-1.5 border-t border-[#eadfc9] pt-2">{narratorEntities.map((entity) => <button key={entity.id} type="button" className={compactButton} data-selected={selectedEntityIds.includes(entity.id)} onClick={() => chooseEntity(entity.id)}>{entity.nameAr.replace(/^—\s*/, '')}</button>)}</div> : null}
            {selectedEntityIds.length ? <div className="flex flex-wrap gap-1"><span className="w-full text-[10px] text-[#665b48]">السلطات المختارة</span>{selectedEntityIds.map((id) => { const selected = entities.find((entity) => entity.id === id); return selected ? <span key={id} className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1 text-[11px]" style={selected.color ? { borderColor: selected.color } : undefined}><span>{selected.nameAr}</span><button type="button" aria-label={`إزالة ${selected.nameAr}`} className="text-[#8a2f1b]" onClick={() => removeSelectedEntity(id)}>×</button></span> : null })}</div> : null}
            {selectedEntityIds.length ? <button type="button" className="text-[11px] font-bold text-[#80662c]" onClick={() => { if (!taxonomyId) { setError('اختر القاعدة أولاً.'); return } setAssignments((current) => [...current, ...selectedEntityIds.filter((id) => !current.some((item) => item.entityId === id && item.taxonomyId === taxonomyId)).map((id) => ({ entityId: id, taxonomyId }))]) }}>+ إضافة السلطات للقاعدة المختارة</button> : null}
          </div>
          <div className="space-y-2 rounded-lg border border-[#eadfc9] p-2"><div className="flex gap-1.5"><button type="button" className={compactButton} data-selected={selectedTaxonomy?.category === 'USUL'} onClick={() => { const root = taxonomyRoots.find((t) => t.category === 'USUL'); if (root) { setTaxonomyId(root.id); setError(null) } }}>الأصول</button><button type="button" className={compactButton} data-selected={selectedTaxonomy?.category === 'FARSH'} onClick={() => { const root = taxonomyRoots.find((t) => t.category === 'FARSH'); if (root) { setTaxonomyId(root.id); setError(null) } }}>فرش الحروف</button></div>{selectedTaxonomy ? <div className="flex flex-wrap gap-1.5 border-t border-[#eadfc9] pt-2">{taxonomyGroups.map((taxonomy) => <button key={taxonomy.id} type="button" className={compactButton} data-selected={taxonomyId === taxonomy.id} onClick={() => setTaxonomyId(taxonomy.id)}>{taxonomy.nameAr}</button>)}</div> : null}{taxonomyChildren.length ? <div className="flex flex-wrap gap-1.5 border-t border-[#eadfc9] pt-2">{taxonomyChildren.map((taxonomy) => <button key={taxonomy.id} type="button" className={compactButton} data-selected={taxonomyId === taxonomy.id} onClick={() => setTaxonomyId(taxonomy.id)}>{taxonomy.nameAr}</button>)}</div> : null}<p className="text-[10px] text-[#80662c]">{selectedTaxonomy ? [selectedRoot?.nameAr, ...(selectedIsRoot ? [] : [selectedParent && selectedParent.id !== selectedRoot?.id ? selectedParent.nameAr : null, selectedTaxonomy.nameAr])].filter(Boolean).join(' › ') : 'اختر نوع القاعدة'}</p></div>
          {!editing && assignments.length ? <div className="flex flex-wrap gap-1.5 rounded-lg border border-[#eadfc9] p-2"><b className="w-full text-[11px]">التعيينات</b>{assignments.map((assignment, index) => <span key={`${assignment.entityId}-${assignment.taxonomyId}`} className="rounded-full border border-[#b99b51] bg-[#fffaf0] px-2 py-1 text-[11px]">{entities.find((e) => e.id === assignment.entityId)?.nameAr} → {taxonomies.find((t) => t.id === assignment.taxonomyId)?.nameAr}<button type="button" className="mr-1 text-[#8a2f1b]" onClick={() => setAssignments(assignments.filter((_, i) => i !== index))}>×</button></span>)}</div> : null}
          {hamzahRule ? <div className="space-y-1.5 rounded-lg border border-[#eadfc9] bg-[#fffaf0] p-2 text-xs">
            <b>تفاصيل أداء الهمز</b>
            {betweenWords ? <div className="flex flex-wrap gap-1"><span>حركة الهمزتين</span>{['متفقتان في الحركة','مختلفتان في الحركة'].map((relation) => <button key={relation} type="button" className={compactButton} data-selected={hamzahValue?.relation === relation} onClick={() => setHamzah({ relation })}>{relation}</button>)}</div> : null}
            {(['first',...(twoHamzahs ? ['second'] : [])] as Array<'first' | 'second'>).map((part) => <div key={part} className="flex flex-wrap items-center gap-1">
              <span className="w-12">{twoHamzahs ? part === 'first' ? 'الأولى' : 'الثانية' : 'الهمزة'}</span>
              {['تحقيق','تسهيل','إبدال','نقل','حذف','سكت قبل الهمز'].filter((option) => twoHamzahs ? !['نقل','سكت قبل الهمز'].includes(option) : true).map((option) => <button key={option} type="button" className={compactButton} data-selected={hamzahValue?.[part] === option} aria-pressed={hamzahValue?.[part] === option} onClick={() => setHamzah(part === 'first' ? { first: option, replacementFirst: option === 'إبدال' ? hamzahValue?.replacementFirst : undefined } : { second: option, replacementSecond: option === 'إبدال' ? hamzahValue?.replacementSecond : undefined })}>{option}</button>)}
              {hamzahValue?.[part] === 'إبدال' ? <div className="flex flex-wrap items-center gap-1"><span>حرف المد</span>{['ألف','واو','ياء'].map((letter) => <button key={letter} type="button" className={compactButton} data-selected={hamzahValue[part === 'first' ? 'replacementFirst' : 'replacementSecond'] === letter} aria-pressed={hamzahValue[part === 'first' ? 'replacementFirst' : 'replacementSecond'] === letter} onClick={() => setHamzah(part === 'first' ? { replacementFirst: letter } : { replacementSecond: letter })}>{letter}</button>)}</div> : null}
            </div>)}
            {twoHamzahs && !betweenWords ? <div className="flex flex-wrap items-center gap-1"><span>إدخال ألف</span>{[true,false].map((value) => <button key={String(value)} type="button" className={compactButton} data-selected={hamzahValue?.insertion === value} aria-pressed={hamzahValue?.insertion === value} onClick={() => setHamzah({ insertion: value })}>{value ? 'نعم' : 'لا'}</button>)}</div> : null}
            <p className="text-[10px] text-[#665b48]">اختر الوجه الثابت في المصدر؛ الخيارات لا تقرر صحة النسبة إلى الراوي.</p>
          </div> : null}
          <div className="space-y-1.5"><div className="flex flex-wrap items-center gap-1.5"><b className="ml-1 text-xs">الأوجه</b>{faces.filter((face) => face.labelAr || face.faceValue).map((face, index) => <span key={`${face.labelAr}-${index}`} className={`inline-flex items-center rounded-full border px-1 py-0.5 text-[11px] ${face.preferenceStatus === 'muqaddam' ? 'border-[#80662c] bg-[#f2e7c7]' : 'border-[#b99b51] bg-[#fffaf0]'}`}><button type="button" className="px-1" onClick={() => setFaceEditorIndex(faceEditorIndex === index ? null : index)}>{face.labelAr}</button><button type="button" aria-label={`حذف الوجه ${face.labelAr || index + 1}`} className="px-1 text-[#8a2f1b]" onClick={() => { setFaces(faces.filter((_, faceIndex) => faceIndex !== index)); setFaceEditorIndex(null) }}>×</button></span>)}{facePresets.length ? facePresets.map((preset) => <button type="button" key={`${preset.faceType}-${preset.faceValue}-${preset.labelAr}`} className={compactButton} onClick={() => setPresetFace(preset.labelAr, preset.faceType, preset.faceValue)}>{preset.labelAr}</button>) : selectedTaxonomy && taxonomyChildren.length === 0 && !hamzahRule ? <button type="button" className={compactButton} onClick={() => setPresetFace('وجه مخصص')}>وجه مخصص +</button> : !hamzahRule ? <span className="text-[11px] text-[#8b7f6a]">اختر القاعدة أولاً لإظهار الأوجه.</span> : null}</div>{faceEditorIndex !== null && faces[faceEditorIndex] ? <div className="grid grid-cols-2 gap-1.5 rounded border border-[#eadfc9] bg-[#fffaf0] p-1.5"><input className="min-h-8 rounded border border-[#d7c7a7] bg-white px-2 text-[11px]" aria-label="تسمية الوجه" value={faces[faceEditorIndex].labelAr} onChange={(e) => setFaces(faces.map((face, index) => index === faceEditorIndex ? { ...face, labelAr: e.target.value } : face))}/><select className="min-h-8 rounded border border-[#d7c7a7] bg-white px-1 text-[11px]" aria-label="أفضلية الوجه" value={faces[faceEditorIndex].preferenceStatus} onChange={(e) => setFaces(faces.map((face, index) => index === faceEditorIndex ? { ...face, preferenceStatus: e.target.value as Face['preferenceStatus'] } : face))}><option value="">بلا أفضلية</option><option value="muqaddam">مقدم</option><option value="secondary">ثانوي</option><option value="equal">متساوٍ</option></select></div> : null}</div>
          <div className="flex flex-wrap items-center gap-1.5 rounded border border-[#eadfc9] p-2 text-xs"><b>حالة الأداء</b><button type="button" className={compactButton} data-selected={readingContext !== 'WAQF_ONLY'} aria-pressed={readingContext !== 'WAQF_ONLY'} onClick={() => setReadingContext(readingContext === 'BOTH' ? 'WAQF_ONLY' : 'BOTH')}>✓ الوصل</button><button type="button" className={compactButton} data-selected={readingContext !== 'WASL_ONLY'} aria-pressed={readingContext !== 'WASL_ONLY'} onClick={() => setReadingContext(readingContext === 'BOTH' ? 'WASL_ONLY' : 'BOTH')}>✓ الوقف</button></div>
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
