'use client'

import { useMemo, useState } from 'react'
import { buildSearchIndex, groupResults, type QiraatSearchQuery } from '../../../../../packages/qiraat-core/features/search'
import { narratorLabel } from '../../../../../packages/qiraat-core/features/readerPicker'
import { QIRAAT_NARRATORS } from '../../../../../packages/qiraat-core/narrators'
import { QIRAAT_READERS } from '../../../../../packages/qiraat-core/readers'
import { retryAllPages, useAllPagesData } from '../host/allPagesData'
import { FeatureSheet } from '../host/FeatureSheet'

type Scope = 'authority' | 'word' | 'category'
const SCOPES: { id: Scope; label: string }[] = [
  { id: 'authority', label: 'قارئ أو راوٍ' },
  { id: 'word', label: 'كلمة' },
  { id: 'category', label: 'باب' },
]
const KIND_LABEL = { variant: 'فرش', ruling: 'أصول' } as const

/** «بحث في القراءات»: places of the Mushaf by reader/narrator, by word, or by أصول باب. */
export function QiraatSearchSheet(props: {
  surahName: (surah: number) => string
  onGoToPlace: (place: { page: number; surah: number; ayah: number; startToken: number }) => void
  onClose: () => void
}) {
  const data = useAllPagesData(true)
  const [scope, setScope] = useState<Scope>('word')
  const [word, setWord] = useState('')
  const [authority, setAuthority] = useState('Q01')
  const [category, setCategory] = useState('')
  const index = useMemo(() => buildSearchIndex(data.variantsByPage, data.rulingsByPage), [data.variantsByPage, data.rulingsByPage])
  const query: QiraatSearchQuery | null =
    scope === 'authority' ? { kind: 'authority', authorityId: authority }
    : scope === 'category' ? (category || index.categories[0]?.code ? { kind: 'category', code: category || index.categories[0].code } : null)
    : word.trim() ? { kind: 'word', text: word } : null
  const groups = useMemo(() => (query ? groupResults(index.search(query)) : []), [index, query?.kind, scope, word, authority, category]) // eslint-disable-line react-hooks/exhaustive-deps
  const total = groups.reduce((n, g) => n + g.pages.reduce((m, p) => m + p.results.length, 0), 0)

  return (
    <FeatureSheet title="بحث في القراءات" onClose={props.onClose} testId="qiraat-search">
      {!data.done && data.failed === 0 ? (
        <p data-testid="search-progress" className="mb-2 text-[11px] font-bold text-[var(--mushaf-muted)]">جارٍ تحميل الصفحات {data.loaded} من {data.total}…</p>
      ) : null}
      {data.failed > 0 ? (
        <p data-testid="load-failed" className="mb-2 text-xs font-bold text-[#8a2f10]">
          تعذّر تحميل {data.failed} صفحة، فقد تنقص النتائج. <button type="button" onClick={retryAllPages} className="underline">إعادة المحاولة</button>
        </p>
      ) : null}
      <div role="tablist" className="mb-3 flex gap-1">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={scope === s.id}
            onClick={() => setScope(s.id)}
            className={`min-h-6 flex-1 rounded border px-2 py-1 text-xs font-bold [@media(pointer:coarse)]:min-h-11 ${scope === s.id ? 'border-[var(--mushaf-ink)] bg-[var(--mushaf-ink)] text-white' : 'border-[var(--mushaf-rule)]'}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {scope === 'word' ? (
        <input
          type="search"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="اكتب الكلمة أو جزءًا منها"
          aria-label="الكلمة"
          className="mb-3 min-h-6 w-full rounded border border-[var(--mushaf-rule)] bg-white px-3 py-1.5 text-sm [@media(pointer:coarse)]:min-h-11"
        />
      ) : null}
      {scope === 'authority' ? (
        <select aria-label="القارئ أو الراوي" value={authority} onChange={(e) => setAuthority(e.target.value)} className="mb-3 min-h-6 w-full rounded border border-[var(--mushaf-rule)] bg-white px-2 py-1.5 text-sm [@media(pointer:coarse)]:min-h-11">
          {QIRAAT_READERS.map((reader) => (
            <optgroup key={reader.id} label={reader.nameAr}>
              <option value={reader.id}>{reader.nameAr} (كل الروايتين)</option>
              {QIRAAT_NARRATORS.filter((n) => n.readerId === reader.id).map((n) => <option key={n.id} value={n.id}>{narratorLabel(n.id)}</option>)}
            </optgroup>
          ))}
        </select>
      ) : null}
      {scope === 'category' ? (
        <select aria-label="الباب" value={category || index.categories[0]?.code || ''} onChange={(e) => setCategory(e.target.value)} className="mb-3 min-h-6 w-full rounded border border-[var(--mushaf-rule)] bg-white px-2 py-1.5 text-sm [@media(pointer:coarse)]:min-h-11">
          {index.categories.map((c) => <option key={c.code} value={c.code}>{c.nameAr} ({c.rulingCount})</option>)}
        </select>
      ) : null}
      {query ? <p data-testid="search-count" className="mb-2 text-[11px] font-bold text-[var(--mushaf-muted)]">{total} موضعًا</p> : null}
      {query && total === 0 && data.done ? <p className="text-sm text-[var(--mushaf-muted)]">لا نتائج.</p> : null}
      <div className="space-y-3">
        {groups.map((g) => (
          <section key={g.surah}>
            <h3 className="mb-1 text-xs font-black">سورة {props.surahName(g.surah)}</h3>
            {g.pages.map((p) => (
              <div key={p.page} className="mb-2">
                <p className="mb-0.5 text-[11px] font-bold text-[var(--mushaf-muted)]">صفحة {p.page}</p>
                <ul className="space-y-1">
                  {p.results.map((r) => (
                    <li key={`${r.page}-${r.ayah}-${r.token}`}>
                      <button
                        type="button"
                        data-testid="search-result"
                        onClick={() => { props.onGoToPlace({ page: r.page, surah: r.surah, ayah: r.ayah, startToken: r.token }); props.onClose() }}
                        className="flex min-h-6 w-full items-baseline justify-between gap-2 rounded border border-[var(--mushaf-rule-soft)] bg-white px-2 py-1 text-start text-xs [@media(pointer:coarse)]:min-h-11"
                      >
                        <span className="font-[family-name:var(--font-amiri-quran)] text-lg">{r.displayText || '—'}</span>
                        <span className="text-[11px] text-[var(--mushaf-muted)]">{r.ayah}:{r.token} · {r.kinds.map((k) => KIND_LABEL[k]).join(' + ')}{r.recordCount > 1 ? ` · ${r.recordCount}` : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </div>
    </FeatureSheet>
  )
}
