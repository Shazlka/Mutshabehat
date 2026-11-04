'use client'

import { useEffect, useMemo, useState } from 'react'
import { mutoonWorks, searchMutoon, type MutoonSnapshot } from '../../../../../packages/qiraat-core/features/mutoon'
import { FeatureSheet } from '../host/FeatureSheet'

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; snapshot: MutoonSnapshot }

/** «المتون»: الشاطبية والدرة وطيبة النشر by book and chapter, with a search. Verses are quotations from the books,
 * set in a plain Arabic face, never the Mushaf fonts. */
export function MutoonSheet({ onClose }: { onClose: () => void }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [query, setQuery] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoad({ state: 'loading' })
    fetch('/api/public/v1/mutoon')
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        const snapshot = (await res.json()) as MutoonSnapshot
        if (alive) setLoad({ state: 'ready', snapshot })
      })
      .catch(() => { if (alive) setLoad({ state: 'error' }) })
    return () => { alive = false }
  }, [attempt])

  const snapshot = load.state === 'ready' ? load.snapshot : null
  const works = useMemo(() => mutoonWorks(snapshot), [snapshot])
  const hits = useMemo(() => searchMutoon(snapshot, query), [snapshot, query])
  const searching = query.trim().length > 0

  return (
    <FeatureSheet title="المتون" onClose={onClose} testId="mutoon-sheet">
      {load.state === 'loading' ? <p className="text-sm text-[var(--mushaf-muted)]">جارٍ تحميل المتون…</p> : null}
      {load.state === 'error' ? (
        <div data-testid="mutoon-error" className="space-y-2 text-sm">
          <p>تعذّر تحميل المتون الآن.</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="min-h-6 rounded border border-[var(--mushaf-rule)] px-3 text-xs font-bold [@media(pointer:coarse)]:min-h-11">إعادة المحاولة</button>
        </div>
      ) : null}
      {load.state === 'ready' && works.length === 0 ? <p data-testid="mutoon-empty" className="text-sm text-[var(--mushaf-muted)]">لا متون مضمّنة بعد.</p> : null}
      {works.length > 0 ? (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في المتون"
            aria-label="ابحث في المتون"
            className="mb-3 min-h-6 w-full rounded border border-[var(--mushaf-rule)] bg-white px-3 py-1.5 text-sm [@media(pointer:coarse)]:min-h-11"
          />
          <div style={{ fontFamily: 'var(--font-cairo), system-ui, sans-serif' }}>
            {searching ? (
              hits.length === 0 ? <p className="text-sm text-[var(--mushaf-muted)]">لا نتائج.</p> : (
                <ul className="space-y-2">
                  {hits.map((hit) => (
                    <li key={`${hit.work}-${hit.chapterTitle}-${hit.verse.number}`} data-testid="mutoon-hit" className="rounded-lg border border-[var(--mushaf-rule-soft)] bg-white p-2 text-sm leading-8">
                      <span className="block text-[11px] font-bold text-[var(--mushaf-muted)]">{hit.workTitle} · {hit.chapterTitle} · بيت {hit.verse.number}</span>
                      {hit.verse.lines.map((line, i) => <span key={i} className="block">{line}</span>)}
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <div className="space-y-3">
                {works.map((work) => (
                  <details key={work.work} data-testid={`mutoon-work-${work.work}`} className="rounded-lg border border-[var(--mushaf-rule)] bg-white p-2">
                    <summary className="cursor-pointer text-sm font-black">{work.title} <span className="text-[11px] font-bold text-[var(--mushaf-muted)]">· {work.author}</span></summary>
                    <div className="mt-2 space-y-2">
                      {work.chapters.map((chapter) => (
                        <details key={chapter.title} className="rounded border border-[var(--mushaf-rule-soft)] p-1.5">
                          <summary className="cursor-pointer text-xs font-black">{chapter.title}{chapter.farsh ? ' (فرش)' : ''}</summary>
                          <ol className="mt-1 space-y-1 text-sm leading-8">
                            {chapter.verses.map((verse) => (
                              <li key={verse.number} data-testid="mutoon-verse">
                                <span className="me-2 text-[11px] font-bold text-[var(--mushaf-muted)]">{verse.number}</span>
                                {verse.lines.map((line, i) => <span key={i} className="block">{line}</span>)}
                              </li>
                            ))}
                          </ol>
                        </details>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
          <p className="mt-3 text-[11px] text-[var(--mushaf-muted)]">للتحرير: <a href="/mushaf-1441/mutoon-editor" className="underline">محرر المتون</a></p>
        </>
      ) : null}
    </FeatureSheet>
  )
}
