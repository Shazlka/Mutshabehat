'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { QIRAAT_MULTI_READER_COLOR, readerColor, narratorColor } from '../../../../packages/qiraat-core/colors'
import type { ReaderId, NarratorId } from '../../../../packages/qiraat-core/types'
import {
  AUTHORITIES,
  CLASSICAL_GROUPS,
  definitionFor,
  definitions,
  key,
  wordKey,
  validateMark,
  findWord,
  verseFor,
  wordLetters,
  WORK_IDS,
  replaceWordInLine,
  insertWordInLine,
  deleteWordInLine,
  type EditorData,
  type Mark,
  type WordAssignment,
  type WorkId,
  type ClassicalGroup,
} from './data'

const API = '/api/mushaf-1441/mutoon-editor'
const LABELS: Record<WorkId, string> = {
  shatibiyyah: 'الشاطبية (حرز الأماني)',
  durrah: 'الدرة المضية',
  tayyibah: 'طيبة النشر',
}
const WORK_SUBTITLES: Record<WorkId, string> = {
  shatibiyyah: 'للإمام الشاطبي · ١١٧٣ بيتًا في القراءات السبع',
  durrah: 'للإمام ابن الجزري · ٢٤١ بيتًا في القراءات الثلاث المتممة',
  tayyibah: 'للإمام ابن الجزري · ١٠١٥ بيتًا في القراءات العشر الكبرى',
}

type Selection = { work: WorkId; verse: number }
type Remote = { revision: number; document: EditorData | null; updatedAt?: string }

async function fetchRemote(): Promise<Remote> {
  const response = await fetch(API, { cache: 'no-store' })
  const body = await response.json()
  if (!response.ok) throw Object.assign(new Error(body.error ?? 'تعذر تحميل المتون'), { status: response.status })
  return body as Remote
}

async function putRemote(revision: number, document: EditorData, force = true): Promise<{ revision: number; updatedAt: string }> {
  const response = await fetch(API, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision, document, force }),
  })
  const body = await response.json()
  if (!response.ok) throw Object.assign(new Error(body.error ?? 'تعذر حفظ المتون'), { status: response.status })
  return body
}

function downloadJSON(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function normalize(value: EditorData | null): EditorData | null {
  return value ? { ...value, assignments: value.assignments ?? { schemaVersion: 1, assignments: [] } } : null
}

function assignmentSlot(a: Pick<WordAssignment, 'work' | 'verse' | 'line' | 'word' | 'occurrence'>) {
  return `${a.work}:${a.verse}:${a.line}:${a.word}:${a.occurrence}`
}

function matchesWord(a: WordAssignment, work: WorkId, verse: number, lineIndex: number, line: string, word: string, occurrence: number) {
  return a.work === work && a.verse === verse && a.line === lineIndex && a.occurrence === occurrence && findWord(line, a.word, a.occurrence) === word
}

function candidates(line: string): Array<{ text: string; occurrence: number; indexInLine: number }> {
  const counts = new Map<string, number>()
  return line.split(/\s+/).filter(Boolean).map((text, indexInLine) => {
    const plain = text.replace(/[^\p{L}\p{M}\u0640]/gu, '')
    const occurrence = (counts.get(plain) ?? 0) + 1
    counts.set(plain, occurrence)
    return { text: plain, occurrence, indexInLine }
  }).filter(c => c.text)
}

function describeAuthorities(ids: string[]) {
  return ids.map(id => AUTHORITIES.find(a => a.id === id)?.name ?? id).join('، ')
}

function authorityColor(id: string) {
  return id.includes('-') ? narratorColor(id as NarratorId) : readerColor(id as ReaderId)
}

function previewColor(ids: string[]) {
  return ids.length === 1 ? authorityColor(ids[0]) : QIRAAT_MULTI_READER_COLOR
}

export default function MutoonEditor() {
  const [data, setData] = useState<EditorData | null>(null)
  const [revision, setRevision] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved')
  const [statusMessage, setStatusMessage] = useState('')
  const [selection, setSelection] = useState<Selection>({ work: 'shatibiyyah', verse: 1 })
  const [query, setQuery] = useState('')
  const [chapterFilter, setChapterFilter] = useState<string>('all')
  const [busy, setBusy] = useState(true)

  // Focused word selection in current verse
  const [selectedLine, setSelectedLine] = useState(0)
  const [selectedWordIndex, setSelectedWordIndex] = useState(0)
  const [pendingMode, setPendingMode] = useState<'letter' | 'word'>('word')
  const [pendingLetterIndex, setPendingLetterIndex] = useState(0)

  // Authority search & filters
  const [authorityQuery, setAuthorityQuery] = useState('')

  // Modals / expanded panels
  const [isEditingLines, setIsEditingLines] = useState(false)
  const [verseLineEdits, setVerseLineEdits] = useState<string[]>([])
  const [isEditingWord, setIsEditingWord] = useState(false)
  const [editingWordValue, setEditingWordValue] = useState('')
  const [isAddingWord, setIsAddingWord] = useState(false)
  const [newWordText, setNewWordText] = useState('')
  const [addWordPosition, setAddWordPosition] = useState<'before' | 'after'>('after')

  // Symbol creation state
  const [newSymbol, setNewSymbol] = useState('')
  const [symbolSource, setSymbolSource] = useState('')
  const [symbolNote, setSymbolNote] = useState('')
  const [symbolVerified, setSymbolVerified] = useState(true)

  // History for Undo / Redo
  const [undoStack, setUndoStack] = useState<EditorData[]>([])
  const [redoStack, setRedoStack] = useState<EditorData[]>([])

  // Auto-save debounce timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const latestDataRef = useRef<EditorData | null>(null)
  const latestRevisionRef = useRef(0)

  latestDataRef.current = data
  latestRevisionRef.current = revision

  // Direct live save
  const saveDirect = useCallback(async (docToSave: EditorData | null = data, force = true) => {
    const target = docToSave ?? data
    if (!target) return
    setSaving(true)
    setSaveStatus('saving')
    try {
      const result = await putRemote(latestRevisionRef.current, target, force)
      setRevision(result.revision)
      setUpdatedAt(result.updatedAt)
      setSaveStatus('saved')
      setStatusMessage(`حُفظت التعديلات مباشرة في قاعدة البيانات (نسخة ${result.revision})`)
    } catch (e) {
      setSaveStatus('error')
      setStatusMessage(e instanceof Error ? e.message : 'تعذر حفظ المتون')
    } finally {
      setSaving(false)
    }
  }, [data])

  // Load from backend on mount
  useEffect(() => {
    fetchRemote()
      .then(value => {
        setUnlocked(true)
        const doc = normalize(value.document)
        setData(doc)
        setRevision(value.revision)
        setUpdatedAt(value.updatedAt ?? null)
        setSaveStatus('saved')
        setStatusMessage('تم الاتصال بالسحابة وتحميل أحدث نسخة')
      })
      .catch(e => {
        setStatusMessage(e instanceof Error ? e.message : 'تعذر تحميل المتون')
        setSaveStatus('error')
      })
      .finally(() => setBusy(false))
  }, [])

  // Push new state with undo history
  const updateData = useCallback((next: EditorData, pushUndo = true) => {
    if (pushUndo && data) {
      setUndoStack(prev => [...prev.slice(-30), clone(data)])
      setRedoStack([])
    }
    setData(next)
    setSaveStatus('dirty')

    // Debounced direct live save (800ms)
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      saveDirect(next)
    }, 800)
  }, [data, saveDirect])

  const undo = useCallback(() => {
    if (undoStack.length === 0 || !data) return
    const prev = undoStack[undoStack.length - 1]
    setUndoStack(u => u.slice(0, -1))
    setRedoStack(r => [...r, clone(data)])
    setData(prev)
    setSaveStatus('dirty')
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => saveDirect(prev), 800)
  }, [undoStack, data, saveDirect])

  const redo = useCallback(() => {
    if (redoStack.length === 0 || !data) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack(r => r.slice(0, -1))
    setUndoStack(u => [...u, clone(data)])
    setData(next)
    setSaveStatus('dirty')
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => saveDirect(next), 800)
  }, [redoStack, data, saveDirect])

  // Reload from database
  const reloadRemote = async () => {
    if (saveStatus === 'dirty' && !confirm('هناك تعديلات لم تُحفظ بعد في السحابة. هل تريد استبدالها بأحدث نسخة من الخادم؟')) return
    setBusy(true)
    try {
      const value = await fetchRemote()
      const doc = normalize(value.document)
      setData(doc)
      setRevision(value.revision)
      setUpdatedAt(value.updatedAt ?? null)
      setSaveStatus('saved')
      setStatusMessage('حُمّلت أحدث نسخة بنجاح من قاعدة البيانات')
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : 'تعذر إعادة التحميل')
    } finally {
      setBusy(false)
    }
  }

  // Warn on page close if dirty
  useEffect(() => {
    if (saveStatus !== 'dirty') return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveStatus])

  // Current work & verses
  const currentWork = data?.mutoon.works.find(w => w.work === selection.work)
  const chapters = useMemo(() => currentWork?.chapters ?? [], [currentWork])
  const allVersesInWork = useMemo(() => {
    return chapters.flatMap(c => c.verses.map(v => ({ ...v, chapterTitle: c.title })))
  }, [chapters])

  // Filtered verses by search query and chapter
  const filteredVerses = useMemo(() => {
    let list = allVersesInWork
    if (chapterFilter !== 'all') {
      list = list.filter(v => v.chapterTitle === chapterFilter)
    }
    const q = key(query)
    if (q) {
      list = list.filter(v =>
        String(v.number).includes(query) ||
        key(v.lines.join(' ')).includes(q) ||
        key(v.chapterTitle).includes(q)
      )
    }
    return list
  }, [allVersesInWork, chapterFilter, query])

  // Current selected verse object
  const currentVerse = useMemo(() => {
    return verseFor(data?.mutoon ?? { schemaVersion: 1, works: [] }, selection.work, selection.verse)
  }, [data, selection.work, selection.verse])

  // Update verse lines when verse changes
  useEffect(() => {
    if (currentVerse) {
      setVerseLineEdits([...currentVerse.lines])
      setSelectedLine(0)
      setSelectedWordIndex(0)
      setIsEditingLines(false)
      setIsEditingWord(false)
      setIsAddingWord(false)
    }
  }, [selection.work, selection.verse, currentVerse])

  // Marks and assignments for current verse
  const verseMarks = useMemo(() => {
    return data?.marks.marks.filter(m => m.work === selection.work && m.verse === selection.verse) ?? []
  }, [data, selection.work, selection.verse])

  const verseAssignments = useMemo(() => {
    return data?.assignments.assignments.filter(a => a.work === selection.work && a.verse === selection.verse) ?? []
  }, [data, selection.work, selection.verse])

  // Current line candidate words
  const currentLineWords = useMemo(() => {
    if (!currentVerse || !currentVerse.lines[selectedLine]) return []
    return candidates(currentVerse.lines[selectedLine])
  }, [currentVerse, selectedLine])

  const activeWord = currentLineWords[selectedWordIndex]

  // Assignment for the currently active word
  const activeAssignment = useMemo(() => {
    if (!activeWord || !currentVerse) return undefined
    const line = currentVerse.lines[selectedLine] ?? ''
    return verseAssignments.find(a => matchesWord(a, selection.work, selection.verse, selectedLine, line, activeWord.text, activeWord.occurrence))
  }, [activeWord, currentVerse, selectedLine, verseAssignments, selection.work, selection.verse])

  const currentMode = activeAssignment ? (activeAssignment.mode ?? 'word') : pendingMode
  const currentLetterIndex = activeAssignment ? (activeAssignment.letterIndex ?? 0) : pendingLetterIndex

  // Auto-detect matching classical symbol for active word
  const matchedDefinitions = useMemo(() => {
    if (!activeWord) return []
    const firstChar = key(activeWord.text)[0] ?? ''
    return definitions(selection.work).filter(d => {
      if (d.symbol.length === 1) return key(d.symbol) === firstChar
      return key(d.symbol) === key(activeWord.text) || wordKey(d.symbol) === wordKey(activeWord.text)
    })
  }, [activeWord, selection.work])

  // Grouped authorities (10 readers + 20 narrators)
  const authorityList = useMemo(() => {
    const q = key(authorityQuery)
    return Array.from({ length: 10 }, (_, i) => {
      const imams = AUTHORITIES.slice(i * 3, i * 3 + 3)
      return {
        reader: imams[0],
        narrator1: imams[1],
        narrator2: imams[2],
      }
    }).filter(group => {
      if (!q) return true
      return (
        key(group.reader.name).includes(q) ||
        key(group.narrator1.name).includes(q) ||
        key(group.narrator2.name).includes(q) ||
        group.reader.id.toLowerCase().includes(authorityQuery.toLowerCase())
      )
    })
  }, [authorityQuery])

  // Navigate verse by delta
  const navigateVerse = useCallback((delta: number) => {
    const idx = allVersesInWork.findIndex(v => v.number === selection.verse)
    if (idx < 0) return
    const nextIdx = idx + delta
    if (nextIdx >= 0 && nextIdx < allVersesInWork.length) {
      setSelection({ work: selection.work, verse: allVersesInWork[nextIdx].number })
    }
  }, [allVersesInWork, selection.verse, selection.work])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key === 'ArrowRight') navigateVerse(-1)
      if (e.key === 'ArrowLeft') navigateVerse(1)
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        if (e.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigateVerse, undo, redo])

  // Mutate: Edit full line text
  const applyVerseLineEdits = () => {
    if (!data || !currentVerse) return
    const next = clone(data)
    const target = verseFor(next.mutoon, selection.work, selection.verse)
    if (!target) return
    target.lines = [...verseLineEdits]
    updateData(next)
    setIsEditingLines(false)
  }

  // Mutate: Rename / Edit single word in line
  const applyWordRename = () => {
    if (!data || !currentVerse || !activeWord || !editingWordValue.trim()) return
    const next = clone(data)
    const target = verseFor(next.mutoon, selection.work, selection.verse)
    if (!target) return
    const oldLine = target.lines[selectedLine]
    const updatedLine = replaceWordInLine(oldLine, activeWord.text, activeWord.occurrence, editingWordValue.trim())
    target.lines[selectedLine] = updatedLine

    // Re-anchor active assignment and marks if text changed
    const newPlain = editingWordValue.trim().replace(/[^\p{L}\p{M}\u0640]/gu, '')
    for (const a of next.assignments.assignments) {
      if (matchesWord(a, selection.work, selection.verse, selectedLine, oldLine, activeWord.text, activeWord.occurrence)) {
        a.word = newPlain
      }
    }
    for (const m of next.marks.marks) {
      if (m.work === selection.work && m.verse === selection.verse && m.line === selectedLine && m.word === activeWord.text && m.occurrence === activeWord.occurrence) {
        m.word = newPlain
      }
    }

    updateData(next)
    setIsEditingWord(false)
    setEditingWordValue('')
  }

  // Mutate: Insert a new word in line
  const applyWordInsert = () => {
    if (!data || !currentVerse || !newWordText.trim()) return
    const next = clone(data)
    const target = verseFor(next.mutoon, selection.work, selection.verse)
    if (!target) return
    const oldLine = target.lines[selectedLine]
    const updatedLine = insertWordInLine(oldLine, selectedWordIndex, newWordText.trim(), addWordPosition)
    target.lines[selectedLine] = updatedLine

    updateData(next)
    setIsAddingWord(false)
    setNewWordText('')
  }

  // Mutate: Delete active word from line
  const applyWordDelete = () => {
    if (!data || !currentVerse || !activeWord || !confirm(`حذف كلمة «${activeWord.text}» من الشطر؟`)) return
    const next = clone(data)
    const target = verseFor(next.mutoon, selection.work, selection.verse)
    if (!target) return

    // Clean up attached assignments and marks
    const oldLine = target.lines[selectedLine]
    next.assignments.assignments = next.assignments.assignments.filter(
      a => !matchesWord(a, selection.work, selection.verse, selectedLine, oldLine, activeWord.text, activeWord.occurrence)
    )
    next.marks.marks = next.marks.marks.filter(
      m => !(m.work === selection.work && m.verse === selection.verse && m.line === selectedLine && m.word === activeWord.text && m.occurrence === activeWord.occurrence)
    )

    target.lines[selectedLine] = deleteWordInLine(oldLine, selectedWordIndex)
    updateData(next)
    setSelectedWordIndex(Math.max(0, selectedWordIndex - 1))
  }

  // Mutate: Toggle authority (Reader or Narrator) on active word
  const toggleAuthority = (id: string) => {
    if (!data || !currentVerse || !activeWord) return
    const next = clone(data)
    const line = currentVerse.lines[selectedLine]
    const idx = next.assignments.assignments.findIndex(
      a => matchesWord(a, selection.work, selection.verse, selectedLine, line, activeWord.text, activeWord.occurrence)
    )

    if (idx < 0) {
      // New assignment
      next.assignments.assignments.push({
        work: selection.work,
        verse: selection.verse,
        line: selectedLine,
        word: activeWord.text,
        occurrence: activeWord.occurrence,
        mode: pendingMode,
        letterIndex: pendingMode === 'letter' ? pendingLetterIndex : undefined,
        readingIds: [id],
        note: '',
        source: '',
      })
    } else {
      const item = next.assignments.assignments[idx]
      const hasId = item.readingIds.includes(id)
      item.readingIds = hasId ? item.readingIds.filter(x => x !== id) : [...item.readingIds, id]
      if (item.readingIds.length === 0) {
        next.assignments.assignments.splice(idx, 1)
      }
    }
    updateData(next)
  }

  // Mutate: Apply classical group
  const applyClassicalGroup = (group: ClassicalGroup) => {
    if (!data || !currentVerse || !activeWord) return
    const next = clone(data)
    const line = currentVerse.lines[selectedLine]
    const idx = next.assignments.assignments.findIndex(
      a => matchesWord(a, selection.work, selection.verse, selectedLine, line, activeWord.text, activeWord.occurrence)
    )

    const allInGroup = group.readingIds
    if (idx < 0) {
      next.assignments.assignments.push({
        work: selection.work,
        verse: selection.verse,
        line: selectedLine,
        word: activeWord.text,
        occurrence: activeWord.occurrence,
        mode: pendingMode,
        letterIndex: pendingMode === 'letter' ? pendingLetterIndex : undefined,
        readingIds: [...allInGroup],
        note: '',
        source: '',
      })
    } else {
      const item = next.assignments.assignments[idx]
      const isFull = allInGroup.every(id => item.readingIds.includes(id))
      if (isFull) {
        item.readingIds = item.readingIds.filter(id => !allInGroup.includes(id))
        if (item.readingIds.length === 0) next.assignments.assignments.splice(idx, 1)
      } else {
        const merged = new Set([...item.readingIds, ...allInGroup])
        item.readingIds = Array.from(merged)
      }
    }
    updateData(next)
  }

  // Mutate: Set assignment mode (whole word vs specific letter)
  const setMode = (mode: 'letter' | 'word') => {
    setPendingMode(mode)
    if (!data || !currentVerse || !activeAssignment) return
    const next = clone(data)
    const line = currentVerse.lines[selectedLine]
    const item = next.assignments.assignments.find(
      a => matchesWord(a, selection.work, selection.verse, selectedLine, line, activeWord.text, activeWord.occurrence)
    )
    if (!item) return
    item.mode = mode
    if (mode === 'letter') {
      item.letterIndex = Math.min(item.letterIndex ?? 0, Math.max(0, wordLetters(item.word).length - 1))
    } else {
      delete item.letterIndex
    }
    updateData(next)
  }

  // Mutate: Set letter index for letter mode
  const setLetterIndex = (index: number) => {
    setPendingLetterIndex(index)
    if (!data || !currentVerse || !activeAssignment) return
    const next = clone(data)
    const line = currentVerse.lines[selectedLine]
    const item = next.assignments.assignments.find(
      a => matchesWord(a, selection.work, selection.verse, selectedLine, line, activeWord.text, activeWord.occurrence)
    )
    if (!item) return
    item.mode = 'letter'
    item.letterIndex = index
    updateData(next)
  }

  // Mutate: Update assignment note / source
  const updateAssignmentDetails = (patch: Partial<Pick<WordAssignment, 'note' | 'source'>>) => {
    if (!data || !currentVerse || !activeAssignment) return
    const next = clone(data)
    const line = currentVerse.lines[selectedLine]
    const item = next.assignments.assignments.find(
      a => matchesWord(a, selection.work, selection.verse, selectedLine, line, activeWord.text, activeWord.occurrence)
    )
    if (!item) return
    Object.assign(item, patch)
    updateData(next)
  }

  // Mutate: Remove assignment completely
  const removeActiveAssignment = () => {
    if (!data || !currentVerse || !activeWord) return
    const next = clone(data)
    const line = currentVerse.lines[selectedLine]
    next.assignments.assignments = next.assignments.assignments.filter(
      a => !matchesWord(a, selection.work, selection.verse, selectedLine, line, activeWord.text, activeWord.occurrence)
    )
    updateData(next)
  }

  // Mutate: Add Poetic Symbol Mark
  const addPoeticSymbol = (symbolDef = definitionFor(selection.work, newSymbol)) => {
    if (!data || !currentVerse || !activeWord || !symbolDef) return
    const mark: Mark = {
      work: selection.work,
      verse: selection.verse,
      line: selectedLine,
      word: activeWord.text,
      occurrence: activeWord.occurrence,
      mode: symbolDef.symbol.length === 1 ? 'letter' : 'word',
      symbol: symbolDef.symbol,
      kind: symbolDef.kind,
      readingIds: symbolDef.readingIds,
      note: symbolNote,
      source: symbolSource,
      status: symbolVerified ? 'verified' : 'extracted',
      method: 'hand',
    }

    const problem = validateMark(mark, currentVerse)
    if (problem) {
      alert(problem)
      return
    }

    const next = clone(data)
    // Remove duplicate if exists
    next.marks.marks = next.marks.marks.filter(
      m => !(m.work === selection.work && m.verse === selection.verse && m.line === selectedLine && m.word === activeWord.text && m.occurrence === activeWord.occurrence)
    )
    next.marks.marks.push(mark)
    updateData(next)
    setNewSymbol('')
    setSymbolSource('')
    setSymbolNote('')
  }

  // Mutate: Remove Poetic Symbol Mark
  const removeMark = (markIndex: number) => {
    if (!data || !confirm('حذف هذا الرمز من البيت؟')) return
    const next = clone(data)
    const target = verseMarks[markIndex]
    const idx = next.marks.marks.findIndex(m => m === target || JSON.stringify(m) === JSON.stringify(target))
    if (idx >= 0) {
      next.marks.marks.splice(idx, 1)
      updateData(next)
    }
  }

  // Export JSON files
  const exportFile = (name: 'mutoon.json' | 'symbols-all.json' | 'mutoon-authorities.json') => {
    if (!data) return
    downloadJSON(
      name,
      name === 'mutoon.json' ? data.mutoon : name === 'symbols-all.json' ? data.marks : data.assignments
    )
  }

  if (busy) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent"></div>
        <p className="text-lg font-bold">جارٍ فتح محرر المتون المباشر…</p>
        <p className="text-sm text-[var(--color-ink-soft)]">يتم الاتصال بقاعدة البيانات وقراءة أحدث التوثيقات</p>
      </div>
    )
  }

  if (!unlocked || !data) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-3xl text-amber-700">
          ⚠️
        </div>
        <h2 className="mb-2 text-xl font-bold">تعذر تحميل بيانات المتون</h2>
        <p className="mb-6 text-sm text-[var(--color-ink-soft)]">
          {statusMessage || 'يرجى التحقق من اتصال الإنترنت وقاعدة البيانات ثم إعادة المحاولة.'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-[var(--color-primary)] px-6 py-2.5 font-bold text-white shadow-sm hover:opacity-90"
        >
          إعادة المحاولة
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-4.5rem)] flex-col bg-[var(--color-paper)] text-[var(--color-ink)]" dir="rtl">
      {/* ===================== Top Bar ===================== */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 shadow-xs">
        {/* Work Selection Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {WORK_IDS.map(workId => {
            const active = selection.work === workId
            return (
              <button
                key={workId}
                type="button"
                onClick={() => {
                  const firstVerse = data.mutoon.works.find(w => w.work === workId)?.chapters[0]?.verses[0]?.number ?? 1
                  setSelection({ work: workId, verse: firstVerse })
                  setChapterFilter('all')
                  setQuery('')
                }}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-bold transition-all ${
                  active
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]'
                }`}
              >
                <span>{LABELS[workId]}</span>
              </button>
            )
          })}
        </div>

        {/* Live Status Indicator & Quick Actions */}
        <div className="flex items-center gap-2 ms-auto">
          {/* Undo / Redo */}
          <div className="flex items-center gap-1 border-e border-[var(--color-border)] pe-2">
            <button
              type="button"
              onClick={undo}
              disabled={undoStack.length === 0}
              title="تراجع (Ctrl+Z)"
              className="rounded-lg p-1.5 text-sm hover:bg-[var(--color-paper)] disabled:opacity-30"
            >
              ↩
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={redoStack.length === 0}
              title="إعادة (Ctrl+Shift+Z)"
              className="rounded-lg p-1.5 text-sm hover:bg-[var(--color-paper)] disabled:opacity-30"
            >
              ↪
            </button>
          </div>

          {/* Realtime Save Status Badge */}
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 font-bold text-amber-600">
                <span className="h-2 w-2 animate-ping rounded-full bg-amber-500"></span>
                جارٍ الحفظ التلقائي…
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                محفوظ بالسحابة (نسخة {revision})
              </span>
            )}
            {saveStatus === 'dirty' && (
              <span className="flex items-center gap-1.5 font-medium text-amber-700">
                <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                مسودة لم تُحفظ
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1.5 font-bold text-red-600">
                <span className="h-2 w-2 rounded-full bg-red-500"></span>
                خطأ في الحفظ
              </span>
            )}
          </div>

          {/* Manual Save Button */}
          <button
            type="button"
            onClick={() => void saveDirect(data, true)}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:opacity-90 disabled:opacity-50"
          >
            💾 {saving ? 'جارٍ الحفظ…' : 'حفظ مباشر'}
          </button>

          {/* Reload from DB */}
          <button
            type="button"
            onClick={() => void reloadRemote()}
            title="تحديث من قاعدة البيانات"
            className="rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold text-[var(--color-ink-soft)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]"
          >
            🔄 تحديث
          </button>

          {/* Download JSON Options */}
          <div className="relative group">
            <button
              type="button"
              className="rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold text-[var(--color-ink-soft)] hover:bg-[var(--color-paper)]"
            >
              تصدير JSON ▾
            </button>
            <div className="absolute left-0 top-full z-30 mt-1 hidden w-48 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-lg group-hover:block">
              <button
                type="button"
                onClick={() => exportFile('mutoon.json')}
                className="block w-full rounded-lg px-3 py-1.5 text-right text-xs hover:bg-[var(--color-paper)]"
              >
                تنزيل المتون (mutoon.json)
              </button>
              <button
                type="button"
                onClick={() => exportFile('symbols-all.json')}
                className="block w-full rounded-lg px-3 py-1.5 text-right text-xs hover:bg-[var(--color-paper)]"
              >
                تنزيل الرموز (symbols-all.json)
              </button>
              <button
                type="button"
                onClick={() => exportFile('mutoon-authorities.json')}
                className="block w-full rounded-lg px-3 py-1.5 text-right text-xs hover:bg-[var(--color-paper)]"
              >
                تنزيل القراء (mutoon-authorities.json)
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ===================== Main 3-Column Studio Workspace ===================== */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)_440px]">
        {/* ---------- Column 1: Chapter & Verse Browser ---------- */}
        <aside className="flex flex-col border-e border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          {/* Work Summary & Verse Search */}
          <div className="p-3 border-b border-[var(--color-border)] space-y-2">
            <div className="text-xs text-[var(--color-ink-soft)] font-medium">
              {WORK_SUBTITLES[selection.work]}
            </div>

            {/* Quick Search */}
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="ابحث برقم البيت أو نصه…"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-paper)] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute left-2.5 top-1.5 text-xs text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Chapter Filter Dropdown */}
            <select
              value={chapterFilter}
              onChange={e => setChapterFilter(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs font-bold text-[var(--color-ink)]"
            >
              <option value="all">كل الأبواب ({chapters.length})</option>
              {chapters.map(c => (
                <option key={c.title} value={c.title}>
                  {c.title} ({c.verses.length})
                </option>
              ))}
            </select>
          </div>

          {/* Verses Scroll List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredVerses.map(v => {
              const isSelected = v.number === selection.verse
              const vMarks = data.marks.marks.filter(m => m.work === selection.work && m.verse === v.number)
              const vAssigns = data.assignments.assignments.filter(a => a.work === selection.work && a.verse === v.number)

              return (
                <button
                  key={v.number}
                  type="button"
                  onClick={() => setSelection({ work: selection.work, verse: v.number })}
                  className={`w-full rounded-xl p-2.5 text-right transition-all ${
                    isSelected
                      ? 'bg-[var(--color-primary)] text-white shadow-sm'
                      : 'hover:bg-[var(--color-paper)]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold">بيت {v.number}</span>
                    <div className="flex items-center gap-1">
                      {vAssigns.length > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {vAssigns.length} تعيين
                        </span>
                      )}
                      {vMarks.length > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {vMarks.length} رمز
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`mt-1 truncate text-xs ${isSelected ? 'text-white/90' : 'text-[var(--color-ink-soft)]'}`}>
                    {v.lines[0]}
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* ---------- Column 2: Center Poetic Canvas & Verse Card ---------- */}
        <main className="flex flex-col overflow-y-auto p-4 md:p-6 bg-[var(--color-paper)]">
          {currentVerse ? (
            <div className="mx-auto w-full max-w-4xl space-y-4">
              {/* Card Navigation & Metadata Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-[var(--color-primary-soft)] px-3 py-1 font-bold text-[var(--color-primary)]">
                    البيت {currentVerse.number}
                  </span>
                  <div className="text-sm">
                    <span className="font-bold">{chapters.find(c => c.verses.some(v => v.number === currentVerse.number))?.title}</span>
                    {currentVerse.printedPage && (
                      <span className="ms-2 text-xs text-[var(--color-ink-soft)]">
                        · ص {currentVerse.printedPage}
                      </span>
                    )}
                  </div>
                </div>

                {/* Next / Prev Stepper */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => navigateVerse(-1)}
                    title="البيت السابق (سهم يمين)"
                    className="rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold hover:bg-[var(--color-paper)]"
                  >
                    ← السابق
                  </button>
                  <span className="px-2 text-xs text-[var(--color-ink-soft)]">
                    {currentVerse.number} / {allVersesInWork.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateVerse(1)}
                    title="البيت التالي (سهم يسار)"
                    className="rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold hover:bg-[var(--color-paper)]"
                  >
                    التالي →
                  </button>
                </div>
              </div>

              {/* The Master Verse Card (Styled identically to iOS Variant Card) */}
              <div className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-md transition-all">
                {/* Actions Bar */}
                <div className="mb-4 flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                  <span className="text-xs font-bold text-[var(--color-ink-soft)]">
                    اختر أي كلمة لتعيين القراء والرواة ورموز المتن مباشرة
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingLines(!isEditingLines)}
                      className="rounded-xl border border-[var(--color-border)] px-3 py-1 text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-paper)]"
                    >
                      {isEditingLines ? 'إلغاء التعديل' : '✏️ تعديل شطري البيت'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(currentVerse.lines.join(' · '))
                        setStatusMessage('تم نسخ نص البيت إلى الحافظة')
                      }}
                      className="rounded-xl border border-[var(--color-border)] px-3 py-1 text-xs hover:bg-[var(--color-paper)]"
                    >
                      📋 نسخ النص
                    </button>
                  </div>
                </div>

                {/* Inline Full Verse Text Editor */}
                {isEditingLines && (
                  <div className="mb-6 rounded-2xl border border-[var(--color-primary)] bg-[var(--color-primary-soft)]/20 p-4">
                    <h3 className="mb-2 text-sm font-bold text-[var(--color-primary)]">
                      تعديل نص البيت وضبطه بالحركات
                    </h3>
                    <div className="space-y-3">
                      {verseLineEdits.map((line, lIdx) => (
                        <div key={lIdx}>
                          <label className="block text-xs font-bold mb-1">
                            {lIdx === 0 ? 'الشطر الأول (الصدر)' : 'الشطر الثاني (العجز)'}
                          </label>
                          <textarea
                            rows={2}
                            value={line}
                            onChange={e => {
                              const nextLines = [...verseLineEdits]
                              nextLines[lIdx] = e.target.value
                              setVerseLineEdits(nextLines)
                            }}
                            className="w-full rounded-xl border border-[var(--color-border)] bg-white p-3 font-serif text-xl leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={applyVerseLineEdits}
                        className="rounded-xl bg-[var(--color-primary)] px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:opacity-90"
                      >
                        حفظ التعديل في الشطرين
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVerseLineEdits([...currentVerse.lines])
                          setIsEditingLines(false)
                        }}
                        className="rounded-xl border border-[var(--color-border)] px-4 py-1.5 text-xs"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}

                {/* Poetic Hemistichs with Interactive Word Chips */}
                <div className="space-y-6 py-4 text-center">
                  {currentVerse.lines.map((line, lineIndex) => {
                    const lineWords = candidates(line)

                    return (
                      <div key={lineIndex} className="space-y-2">
                        <div className="text-[11px] font-bold text-[var(--color-ink-muted)]">
                          {lineIndex === 0 ? 'الشطر الأول (الصدر)' : 'الشطر الثاني (العجز)'}
                        </div>

                        {/* Hemistich Words Flow */}
                        <div className="flex flex-wrap items-center justify-center gap-2" dir="rtl">
                          {lineWords.map((wordObj, wIdx) => {
                            const isWordSelected = selectedLine === lineIndex && selectedWordIndex === wIdx
                            const wordAssign = verseAssignments.find(a =>
                              matchesWord(a, selection.work, selection.verse, lineIndex, line, wordObj.text, wordObj.occurrence)
                            )
                            const wordMark = verseMarks.find(
                              m => m.line === lineIndex && m.word === wordObj.text && m.occurrence === wordObj.occurrence
                            )

                            // Authority Colors
                            const color = wordAssign ? previewColor(wordAssign.readingIds) : wordMark ? '#DC2626' : undefined
                            const letters = wordLetters(wordObj.text)
                            const isLetterMode = wordAssign?.mode === 'letter'
                            const highlightedLetterIdx = isLetterMode ? (wordAssign.letterIndex ?? 0) : -1

                            return (
                              <button
                                key={`${wIdx}-${wordObj.text}-${wordObj.occurrence}`}
                                type="button"
                                onClick={() => {
                                  setSelectedLine(lineIndex)
                                  setSelectedWordIndex(wIdx)
                                  setIsEditingWord(false)
                                  setIsAddingWord(false)
                                }}
                                className={`group relative rounded-2xl px-3.5 py-2 font-serif text-2xl transition-all ${
                                  isWordSelected
                                    ? 'bg-amber-50 ring-2 ring-[var(--color-primary)] shadow-md'
                                    : 'hover:bg-[var(--color-paper)] hover:shadow-xs'
                                }`}
                                style={{
                                  borderBottom: color ? `3px solid ${color}` : undefined,
                                }}
                              >
                                {/* Word rendering with letter highlight support */}
                                <span>
                                  {isLetterMode && highlightedLetterIdx >= 0 ? (
                                    letters.map((letter, lIdx) => (
                                      <span
                                        key={lIdx}
                                        style={
                                          lIdx === highlightedLetterIdx
                                            ? {
                                                color,
                                                fontWeight: 700,
                                                textDecoration: 'underline',
                                                textDecorationColor: color,
                                              }
                                            : undefined
                                        }
                                      >
                                        {letter}
                                      </span>
                                    ))
                                  ) : (
                                    <span style={color ? { color, fontWeight: 700 } : undefined}>
                                      {wordObj.text}
                                    </span>
                                  )}
                                </span>

                                {/* Badge: Authority Count or Symbol */}
                                {wordAssign && (
                                  <span
                                    className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-xs"
                                    style={{ backgroundColor: color }}
                                    title={describeAuthorities(wordAssign.readingIds)}
                                  >
                                    {wordAssign.readingIds.length}
                                  </span>
                                )}

                                {wordMark && !wordAssign && (
                                  <span
                                    className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs"
                                    title={`رمز: ${wordMark.symbol}`}
                                  >
                                    {wordMark.symbol}
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}

                  {/* Decorative Islamic Hemistich Divider */}
                  <div className="flex items-center justify-center gap-3 pt-2 text-[var(--color-border)]">
                    <span className="h-px w-24 bg-[var(--color-border)]"></span>
                    <span className="text-lg text-[var(--color-primary)]">❊ ✦ ❊</span>
                    <span className="h-px w-24 bg-[var(--color-border)]"></span>
                  </div>
                </div>

                {/* Verse Summary Pills */}
                <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border)] pt-3 text-xs">
                  <span className="font-bold text-[var(--color-ink-soft)]">تعيينات البيت:</span>
                  {verseAssignments.length === 0 && verseMarks.length === 0 && (
                    <span className="text-[var(--color-ink-muted)]">لا توجد تعيينات أو رموز مضافة في هذا البيت حتى الآن.</span>
                  )}
                  {verseAssignments.flatMap(a =>
                    a.readingIds.map(id => {
                      const color = authorityColor(id)
                      const authName = AUTHORITIES.find(x => x.id === id)?.name ?? id
                      return (
                        <span
                          key={`${assignmentSlot(a)}:${id}`}
                          className="flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium"
                          style={{ borderColor: color, color, backgroundColor: `${color}14` }}
                        >
                          <span className="font-bold">{authName}</span>
                          <span className="text-[10px] opacity-75">· {a.word}</span>
                        </span>
                      )
                    })
                  )}
                  {verseMarks.map((m, idx) => (
                    <span
                      key={idx}
                      className="flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-red-800"
                    >
                      <span className="font-bold">رمز {m.symbol}</span>
                      <span className="text-[10px]">({m.word})</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Verified Marks In This Verse Table */}
              {verseMarks.length > 0 && (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs">
                  <h3 className="mb-3 text-sm font-bold text-red-700">
                    رموز المتن الموثقة في هذا البيت ({verseMarks.length})
                  </h3>
                  <div className="divide-y divide-[var(--color-border)]">
                    {verseMarks.map((mark, mIdx) => (
                      <div key={mIdx} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-red-100 px-2 py-0.5 font-bold text-red-700">
                              {mark.symbol}
                            </span>
                            <span className="font-bold text-sm">«{mark.word}»</span>
                            <span className="text-[var(--color-ink-soft)]">
                              الشطر {mark.line + 1} · {mark.mode === 'letter' ? 'الحرف الأول' : 'الكلمة كاملة'}
                            </span>
                          </div>
                          <div className="text-[var(--color-ink-soft)]">
                            المدلول: {describeAuthorities(mark.readingIds)}
                            {mark.source && ` · المصدر: ${mark.source}`}
                            {mark.note && ` · ملاحظة: ${mark.note}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMark(mIdx)}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-red-600 hover:bg-red-50"
                        >
                          حذف الرمز
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-[var(--color-ink-soft)]">
              البيت غير موجود. اختر بيتًا من القائمة.
            </div>
          )}
        </main>

        {/* ---------- Column 3: Word Inspector & Authority Assignment Station ---------- */}
        <aside className="flex flex-col border-s border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto p-4 space-y-4">
          {activeWord && currentVerse ? (
            <div className="space-y-4">
              {/* Active Word Hero */}
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-paper)] p-4 shadow-xs">
                <div className="flex items-center justify-between text-xs text-[var(--color-ink-soft)] mb-1">
                  <span>
                    الشطر {selectedLine === 0 ? 'الأول (الصدر)' : 'الثاني (العجز)'} · الكلمة {selectedWordIndex + 1}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingWordValue(activeWord.text)
                        setIsEditingWord(!isEditingWord)
                      }}
                      className="font-bold text-[var(--color-primary)] hover:underline"
                    >
                      {isEditingWord ? 'إلغاء' : '✏️ تعديل الكلمة'}
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingWord(!isAddingWord)}
                      className="font-bold text-[var(--color-primary)] hover:underline"
                    >
                      {isAddingWord ? 'إلغاء' : '➕ إضافة كلمة'}
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={applyWordDelete}
                      className="text-red-600 hover:underline"
                    >
                      حذف
                    </button>
                  </div>
                </div>

                {/* Inline Word Renamer */}
                {isEditingWord && (
                  <div className="my-2 flex gap-2">
                    <input
                      type="text"
                      value={editingWordValue}
                      onChange={e => setEditingWordValue(e.target.value)}
                      placeholder="أدخل نص الكلمة المصحح…"
                      className="flex-1 rounded-xl border border-[var(--color-border)] bg-white px-3 py-1.5 font-serif text-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                    <button
                      type="button"
                      onClick={applyWordRename}
                      className="rounded-xl bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white shadow-xs"
                    >
                      تطبيق
                    </button>
                  </div>
                )}

                {/* Inline Word Inserter */}
                {isAddingWord && (
                  <div className="my-2 space-y-2 rounded-xl border border-dashed border-[var(--color-border)] p-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newWordText}
                        onChange={e => setNewWordText(e.target.value)}
                        placeholder="الكلمة الجديدة…"
                        className="flex-1 rounded-xl border border-[var(--color-border)] bg-white px-3 py-1.5 font-serif text-base"
                      />
                      <select
                        value={addWordPosition}
                        onChange={e => setAddWordPosition(e.target.value as 'before' | 'after')}
                        className="rounded-xl border border-[var(--color-border)] bg-white px-2 py-1 text-xs"
                      >
                        <option value="after">بعد الكلمة</option>
                        <option value="before">قبل الكلمة</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={applyWordInsert}
                      className="w-full rounded-xl bg-[var(--color-primary)] py-1.5 text-xs font-bold text-white"
                    >
                      إدراج الكلمة في الشطر
                    </button>
                  </div>
                )}

                {/* Big Word Display */}
                <div className="my-2 text-center">
                  <span className="font-serif text-3xl font-bold tracking-wide">
                    « {activeWord.text} »
                  </span>
                </div>

                {/* Mode Selector: Whole Word vs Letter */}
                <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                  <span className="text-xs font-bold">نوع التعيين:</span>
                  <div className="flex rounded-xl bg-[var(--color-border)] p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setMode('word')}
                      className={`rounded-lg px-3 py-1 font-bold transition-all ${
                        currentMode === 'word'
                          ? 'bg-white text-[var(--color-primary)] shadow-xs'
                          : 'text-[var(--color-ink-soft)]'
                      }`}
                    >
                      الكلمة كاملة
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('letter')}
                      className={`rounded-lg px-3 py-1 font-bold transition-all ${
                        currentMode === 'letter'
                          ? 'bg-white text-[var(--color-primary)] shadow-xs'
                          : 'text-[var(--color-ink-soft)]'
                      }`}
                    >
                      حرف محدد
                    </button>
                  </div>
                </div>

                {/* Letter Selection Tiles */}
                {currentMode === 'letter' && (
                  <div className="mt-3 border-t border-[var(--color-border)] pt-2">
                    <span className="block text-[11px] font-bold text-[var(--color-ink-soft)] mb-1.5">
                      اختر الحرف الذي يحمل القراءة أو الرمز:
                    </span>
                    <div className="flex flex-wrap gap-1.5" dir="rtl">
                      {wordLetters(activeWord.text).map((letter, lIdx) => {
                        const isLetterActive = currentLetterIndex === lIdx
                        return (
                          <button
                            key={lIdx}
                            type="button"
                            onClick={() => setLetterIndex(lIdx)}
                            className={`flex h-10 min-w-10 items-center justify-center rounded-xl font-serif text-xl font-bold transition-all ${
                              isLetterActive
                                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                : 'border border-[var(--color-border)] bg-white hover:bg-[var(--color-paper)]'
                            }`}
                          >
                            {letter}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Classical Group Shortcuts */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>مجموعات ورموز القراء السريعة:</span>
                  <span className="text-[10px] text-[var(--color-ink-muted)]">نقرة واحدة للتعيين</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CLASSICAL_GROUPS.map(group => {
                    const isAllAssigned = activeAssignment
                      ? group.readingIds.every(id => activeAssignment.readingIds.includes(id))
                      : false

                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => applyClassicalGroup(group)}
                        title={group.description}
                        className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                          isAllAssigned
                            ? 'bg-[var(--color-primary)] text-white shadow-xs'
                            : 'border border-[var(--color-border)] bg-[var(--color-paper)] hover:bg-[var(--color-surface)]'
                        }`}
                      >
                        {group.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* The 10 Readers & 20 Narrators Matrix */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">الأئمة العشرة والرواة:</span>
                  {activeAssignment && (
                    <button
                      type="button"
                      onClick={removeActiveAssignment}
                      className="text-[11px] font-bold text-red-600 hover:underline"
                    >
                      إلغاء تعيين الكلمة
                    </button>
                  )}
                </div>

                {/* Filter Authorities */}
                <input
                  type="text"
                  value={authorityQuery}
                  onChange={e => setAuthorityQuery(e.target.value)}
                  placeholder="ابحث عن قارئ أو راوٍ (حفص، ورش، نافع)…"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-paper)] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />

                {/* Readers & Narrators Cards List */}
                <div className="space-y-2">
                  {authorityList.map(group => {
                    const readerAssigned = !!activeAssignment?.readingIds.includes(group.reader.id)
                    const n1Assigned = !!activeAssignment?.readingIds.includes(group.narrator1.id)
                    const n2Assigned = !!activeAssignment?.readingIds.includes(group.narrator2.id)
                    const rColor = authorityColor(group.reader.id)
                    const n1Color = authorityColor(group.narrator1.id)
                    const n2Color = authorityColor(group.narrator2.id)

                    return (
                      <div
                        key={group.reader.id}
                        className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-paper)] p-2.5 space-y-1.5 shadow-2xs"
                      >
                        {/* Imam / Reader Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleAuthority(group.reader.id)}
                          className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-right transition-all`}
                          style={{
                            backgroundColor: readerAssigned ? `${rColor}22` : undefined,
                            border: `1px solid ${readerAssigned ? rColor : 'transparent'}`,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: rColor }}
                            ></span>
                            <span className="text-xs font-bold" style={{ color: rColor }}>
                              {group.reader.name}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold">
                            {readerAssigned ? '✓ معيّن' : '+ تعيين'}
                          </span>
                        </button>

                        {/* Two Narrators Grid */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleAuthority(group.narrator1.id)}
                            className="flex items-center justify-between rounded-xl p-2 text-right transition-all"
                            style={{
                              backgroundColor: n1Assigned ? `${n1Color}22` : undefined,
                              border: `1px solid ${n1Assigned ? n1Color : 'var(--color-border)'}`,
                            }}
                          >
                            <span className="text-xs font-medium" style={{ color: n1Color }}>
                              {group.narrator1.name}
                            </span>
                            <span className="text-[10px] font-bold">
                              {n1Assigned ? '✓' : '+'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleAuthority(group.narrator2.id)}
                            className="flex items-center justify-between rounded-xl p-2 text-right transition-all"
                            style={{
                              backgroundColor: n2Assigned ? `${n2Color}22` : undefined,
                              border: `1px solid ${n2Assigned ? n2Color : 'var(--color-border)'}`,
                            }}
                          >
                            <span className="text-xs font-medium" style={{ color: n2Color }}>
                              {group.narrator2.name}
                            </span>
                            <span className="text-[10px] font-bold">
                              {n2Assigned ? '✓' : '+'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Classical Poetic Symbol Linking (رموز المتن) */}
              <div className="rounded-2xl border border-red-200 bg-red-50/50 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-red-800">
                  <span>ربط برمز المتن التقليدي:</span>
                </div>

                {matchedDefinitions.length > 0 ? (
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-red-700">رموز محتملة للكلمة الحالية:</span>
                    {matchedDefinitions.map(def => (
                      <div
                        key={def.symbol}
                        className="flex items-center justify-between rounded-xl border border-red-200 bg-white p-2 text-xs"
                      >
                        <div>
                          <span className="font-bold text-red-700">رمز [{def.symbol}]</span>
                          <span className="ms-1.5 text-[var(--color-ink-soft)]">
                            {describeAuthorities(def.readingIds)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => addPoeticSymbol(def)}
                          className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-red-700"
                        >
                          اعتماد الرمز
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--color-ink-soft)]">
                    لا يوجد رمز مطابق في بداية الكلمة في هذا المتن.
                  </p>
                )}
              </div>

              {/* Assignment Notes & Scholarly Commentary */}
              {activeAssignment && (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-paper)] p-3 space-y-2 text-xs">
                  <span className="font-bold">توثيق وشرح التعيين:</span>
                  <div>
                    <label className="block text-[11px] text-[var(--color-ink-soft)] mb-1">
                      المصدر والشرح (الوافي، الهادي، غيث النفع…):
                    </label>
                    <input
                      type="text"
                      value={activeAssignment.source}
                      onChange={e => updateAssignmentDetails({ source: e.target.value })}
                      placeholder="مثال: الوافي في شرح الشاطبية ص ٥٠"
                      className="w-full rounded-xl border border-[var(--color-border)] bg-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--color-ink-soft)] mb-1">
                      ملاحظة وجه القراءة:
                    </label>
                    <input
                      type="text"
                      value={activeAssignment.note}
                      onChange={e => updateAssignmentDetails({ note: e.target.value })}
                      placeholder="مثال: إمالة الألف، تسهيل الهمز…"
                      className="w-full rounded-xl border border-[var(--color-border)] bg-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[var(--color-ink-soft)]">
              اختر كلمة من البيت لعرض خيارات التعيين
            </div>
          )}
        </aside>
      </div>

      {/* ===================== Bottom Status Bar ===================== */}
      <footer className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-1.5 text-xs text-[var(--color-ink-soft)]">
        <div>
          {statusMessage || 'محرر المتون المباشر جاهز'}
        </div>
        <div>
          {updatedAt ? `آخر حفظ في السحابة: ${new Date(updatedAt).toLocaleTimeString('ar-AE')}` : 'لم يُحفظ بعد'}
        </div>
      </footer>
    </div>
  )
}
