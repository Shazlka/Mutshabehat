'use client'

import { useEffect, useState } from 'react'

interface Tag { id: string; name: string; color: string | null }

const DEFAULT_COLOR = '#4b63e6'

export default function TagManager() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(DEFAULT_COLOR)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(DEFAULT_COLOR)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function reload() {
    const res = await fetch('/api/tags')
    if (res.ok) { const j = await res.json(); setTags(j.tags || []) }
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  function startEdit(tag: Tag) {
    setEditId(tag.id)
    setEditName(tag.name)
    setEditColor(tag.color ?? DEFAULT_COLOR)
    setError(null)
  }

  function cancelEdit() { setEditId(null); setError(null) }

  async function saveEdit(id: string) {
    if (!editName.trim()) return
    setSaving(true); setError(null)
    const res = await fetch(`/api/tags/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), color: editColor }),
    })
    const j = await res.json()
    if (res.ok) { setEditId(null); reload() }
    else setError(j.error || 'حدث خطأ')
    setSaving(false)
  }

  async function deleteTag(id: string) {
    setSaving(true)
    await fetch(`/api/tags/${id}`, { method: 'DELETE' })
    setDeleteId(null); setSaving(false); reload()
  }

  async function createTag() {
    if (!newName.trim()) return
    setSaving(true); setError(null)
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    })
    const j = await res.json()
    if (res.ok) { setNewName(''); setAdding(false); reload() }
    else setError(j.error || 'حدث خطأ')
    setSaving(false)
  }

  if (loading) {
    return <p className="text-[13px] text-[var(--color-ink-muted)]">جارٍ التحميل…</p>
  }

  return (
    <div className="space-y-3">
      {/* Tag list */}
      {tags.length === 0 && !adding && (
        <p className="text-[13px] text-[var(--color-ink-muted)]">لا توجد وسوم بعد.</p>
      )}

      <ul className="space-y-1.5">
        {tags.map((tag) => {
          const isEditing = editId === tag.id
          const isDeleting = deleteId === tag.id
          return (
            <li key={tag.id}>
              {isEditing ? (
                /* Edit row */
                <div className="flex items-center gap-2 p-2.5 bg-[var(--color-surface)] rounded-xl border border-[var(--color-primary-soft)]">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(tag.id); if (e.key === 'Escape') cancelEdit() }}
                    className="flex-1 px-3 py-1.5 text-[13px] bg-[var(--color-paper)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)] transition-colors"
                    autoFocus
                    dir="rtl"
                  />
                  <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 shrink-0" aria-label="لون الوسم" />
                  <button onClick={() => saveEdit(tag.id)} disabled={saving} type="button"
                    className="px-3 py-1.5 text-[12px] font-bold rounded-lg bg-[var(--color-primary)] text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 tap-shrink transition-colors">
                    حفظ
                  </button>
                  <button onClick={cancelEdit} type="button"
                    className="text-[12px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] tap-shrink transition-colors">
                    إلغاء
                  </button>
                </div>
              ) : isDeleting ? (
                /* Delete confirm row */
                <div className="flex items-center gap-3 p-2.5 bg-[var(--color-danger-bg)] rounded-xl border border-[var(--color-danger)]/20">
                  <span className="flex-1 text-[13px] text-[var(--color-danger)] font-bold">
                    حذف «{tag.name}»؟ سيُزال من جميع المجموعات.
                  </span>
                  <button onClick={() => deleteTag(tag.id)} disabled={saving} type="button"
                    className="px-3 py-1.5 text-[12px] font-bold rounded-lg bg-[var(--color-danger)] text-white hover:opacity-90 disabled:opacity-50 tap-shrink transition-opacity">
                    حذف
                  </button>
                  <button onClick={() => setDeleteId(null)} type="button"
                    className="text-[12px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] tap-shrink transition-colors">
                    إلغاء
                  </button>
                </div>
              ) : (
                /* Normal row */
                <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[var(--color-surface)] transition-colors group">
                  <span className="w-3 h-3 rounded-full shrink-0"
                        style={{ background: tag.color ?? 'var(--color-border)' }} aria-hidden="true" />
                  <span className="flex-1 text-[14px] font-bold text-[var(--color-ink)]">{tag.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(tag)} type="button"
                      className="px-2.5 py-1 text-[11px] font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] rounded-md tap-shrink transition-colors">
                      تعديل
                    </button>
                    <button onClick={() => { setDeleteId(tag.id); setError(null) }} type="button"
                      className="px-2.5 py-1 text-[11px] font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] rounded-md tap-shrink transition-colors">
                      حذف
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* Error */}
      {error && (
        <p role="alert" className="text-[12px] px-3 py-2 rounded-lg font-bold animate-fade-rise"
           style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>
          {error}
        </p>
      )}

      {/* Add new tag */}
      {adding ? (
        <div className="flex items-center gap-2 p-2.5 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-soft)]">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createTag(); if (e.key === 'Escape') { setAdding(false); setError(null) } }}
            placeholder="اسم الوسم الجديد"
            className="flex-1 px-3 py-1.5 text-[13px] bg-[var(--color-paper)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)] transition-colors"
            autoFocus
            dir="rtl"
          />
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
            className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 shrink-0" aria-label="لون الوسم" />
          <button onClick={createTag} disabled={saving || !newName.trim()} type="button"
            className="px-3 py-1.5 text-[12px] font-bold rounded-lg bg-[var(--color-primary)] text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 tap-shrink transition-colors">
            إضافة
          </button>
          <button onClick={() => { setAdding(false); setNewName(''); setError(null) }} type="button"
            className="text-[12px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] tap-shrink transition-colors">
            إلغاء
          </button>
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setEditId(null); setDeleteId(null); setError(null) }} type="button"
          className="text-[13px] font-bold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] tap-shrink transition-colors">
          + إضافة وسم جديد
        </button>
      )}
    </div>
  )
}
