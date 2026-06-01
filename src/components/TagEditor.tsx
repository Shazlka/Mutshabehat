'use client'

import { useEffect, useState } from 'react'

interface Tag { id: string; name: string; color: string | null }
interface Props { groupId: string }

export default function TagEditor({ groupId }: Props) {
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [groupTags, setGroupTags] = useState<Tag[]>([])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#4b63e6')

  async function reload() {
    const [allRes, gRes] = await Promise.all([
      fetch('/api/tags'),
      fetch(`/api/groups/${groupId}/tags`),
    ])
    if (allRes.ok) { const j = await allRes.json(); setAllTags(j.tags || []) }
    if (gRes.ok)   { const j = await gRes.json();   setGroupTags(j.tags || []) }
  }

  useEffect(() => { reload() }, [groupId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleTag(tag: Tag) {
    const has = groupTags.some((t) => t.id === tag.id)
    if (has) {
      await fetch(`/api/groups/${groupId}/tags?tag_id=${tag.id}`, { method: 'DELETE' })
    } else {
      await fetch(`/api/groups/${groupId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: tag.id }),
      })
    }
    reload()
  }

  async function createTag() {
    if (!newName.trim()) return
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    })
    if (res.ok) {
      const { tag } = await res.json()
      // Auto-attach
      await fetch(`/api/groups/${groupId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: tag.id }),
      })
      setNewName(''); setAdding(false); reload()
    }
  }

  return (
    <div className="space-y-3">
      {/* Active tags */}
      <div className="flex flex-wrap gap-1.5">
        {groupTags.length === 0 && (
          <span className="text-[12px] text-[var(--color-ink-muted)]">لا توجد وسوم بعد.</span>
        )}
        {groupTags.map((t) => (
          <button key={t.id} type="button" onClick={() => toggleTag(t)}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tap-shrink transition-opacity hover:opacity-70"
            style={{ background: (t.color ?? 'var(--color-primary-soft)'), color: '#fff' }}
            aria-label={`إزالة ${t.name}`}>
            {t.name} <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>

      {/* Available tags to add */}
      {allTags.filter((t) => !groupTags.some((g) => g.id === t.id)).length > 0 && (
        <div>
          <div className="text-[10px] tracking-widest text-[var(--color-ink-muted)] uppercase font-bold mb-1.5">
            وسوم متاحة
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTags
              .filter((t) => !groupTags.some((g) => g.id === t.id))
              .map((t) => (
                <button key={t.id} type="button" onClick={() => toggleTag(t)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border tap-shrink transition-colors hover:bg-[var(--color-surface-2)]"
                  style={{ borderColor: t.color ?? 'var(--color-border)', color: t.color ?? 'var(--color-ink-soft)' }}>
                  + {t.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Create new tag */}
      {!adding ? (
        <button type="button" onClick={() => setAdding(true)}
          className="text-[12px] font-bold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] tap-shrink transition-colors">
          + إنشاء وسم جديد
        </button>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border-soft)]">
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم الوسم"
            className="flex-1 px-3 py-1.5 text-[13px] bg-[var(--color-paper)] border border-[var(--color-border)] rounded-md focus:border-[var(--color-primary)] focus:outline-none transition-colors" />
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
            className="w-9 h-9 rounded-md cursor-pointer border-0 p-0" aria-label="لون الوسم" />
          <button onClick={createTag} type="button"
            className="px-3 py-1.5 text-[12px] font-bold rounded-md bg-[var(--color-primary)] text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)] tap-shrink transition-colors">
            حفظ
          </button>
          <button onClick={() => { setAdding(false); setNewName('') }} type="button"
            className="text-[12px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] tap-shrink transition-colors">
            إلغاء
          </button>
        </div>
      )}
    </div>
  )
}
