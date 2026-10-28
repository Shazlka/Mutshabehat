'use client'

import { useEffect, useMemo, useState } from 'react'
import { AUTHORITIES, definedIn, definitions, key, symbolsFor, WORK_IDS, type Definition, type WorkId } from './data'
import { AuthorityPill, authorityColor, describeAuthorities } from './authority'
import { FOCUS, Icon, INPUT, Segmented, Skeleton } from './ui'

const ar = (n: number) => n.toLocaleString('ar-EG', { useGrouping: false })
const WORK_NAMES: Record<WorkId, string> = { shatibiyyah: 'الشاطبية', durrah: 'الدرة', tayyibah: 'الطيبة' }
const KIND_NAMES = { reader: 'قارئ', narrator: 'راوٍ', group: 'جماعي' } as const

type Usage = { symbol: string; count: number; verified: number; verses: number[] }
const usageCache = new Map<WorkId, Usage[]>()

async function loadUsage(work: WorkId): Promise<Usage[]> {
  const hit = usageCache.get(work)
  if (hit) return hit
  const response = await fetch(`/api/mushaf-1441/mutoon-editor?symbols=${work}`, { cache: 'no-store' })
  if (!response.ok) throw new Error('تعذر تحميل أعداد الرموز')
  const body = await response.json() as { symbols: Usage[] }
  usageCache.set(work, body.symbols)
  return body.symbols
}

/** First verse number in «٤٥–٤٦» (Arabic-Indic digits). */
const firstVerse = (range: string) => Number(range.split('–')[0].replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))))

export function SymbolIndex({ work, onOpenVerse }: { work: WorkId; onOpenVerse: (work: WorkId, verse: number) => void }) {
  const [tab, setTab] = useState<'symbol' | 'reader'>('symbol')
  const [shown, setShown] = useState<WorkId>(work)
  const [seenWork, setSeenWork] = useState<WorkId>(work)
  if (seenWork !== work) { setSeenWork(work); setShown(work) } // the header's poem switch drives the index too
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | Definition['kind']>('all')

  const pick = (w: WorkId, symbol: string) => { setShown(w); setQuery(symbol); setKind('all'); setTab('symbol') }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-4 overflow-y-auto [&>*]:shrink-0 p-3 pb-24 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">فهرس رموز القراء</h2>
          <p className="text-xs text-[var(--color-ink-soft)]">ما يدل عليه كل رمز في المتون الثلاثة، وأين عُرّف، وكم مرة وُسم في الأبيات.</p>
        </div>
        <Segmented label="طريقة الفهرسة" value={tab} onChange={setTab} options={[{ value: 'symbol', label: 'حسب الرمز' }, { value: 'reader', label: 'حسب القارئ والراوي' }]} />
      </div>

      {tab === 'symbol'
        ? <BySymbol work={shown} onWork={setShown} query={query} onQuery={setQuery} kind={kind} onKind={setKind} onOpenVerse={onOpenVerse} />
        : <ByReader current={work} onPick={pick} />}
    </div>
  )
}

function BySymbol({ work, onWork, query, onQuery, kind, onKind, onOpenVerse }: {
  work: WorkId; onWork: (w: WorkId) => void; query: string; onQuery: (q: string) => void
  kind: 'all' | Definition['kind']; onKind: (k: 'all' | Definition['kind']) => void; onOpenVerse: (w: WorkId, verse: number) => void
}) {
  const [usage, setUsage] = useState<{ work: WorkId; rows: Usage[] } | { work: WorkId; error: string } | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    loadUsage(work).then(rows => { if (live) setUsage({ work, rows }) }).catch(e => { if (live) setUsage({ work, error: e instanceof Error ? e.message : 'تعذر التحميل' }) })
    return () => { live = false }
  }, [work])

  const current = usage?.work === work ? usage : null
  const rows = current && 'rows' in current ? current.rows : null
  const failed = current && 'error' in current ? current.error : null

  const counts = useMemo(() => {
    const map = new Map<string, { count: number; verified: number; verses: number[] }>()
    for (const u of rows ?? []) {
      const def = definitions(work).find(d => key(d.symbol) === key(u.symbol)) // the dictionary spelling of the symbol
      if (!def) continue
      const have = map.get(def.symbol) ?? { count: 0, verified: 0, verses: [] }
      map.set(def.symbol, { count: have.count + u.count, verified: have.verified + u.verified, verses: [...have.verses, ...u.verses].sort((a, b) => a - b).slice(0, 40) })
    }
    return map
  }, [rows, work])

  const q = key(query)
  const list = definitions(work).filter(d =>
    (kind === 'all' || d.kind === kind) &&
    (!q || key(d.symbol).includes(q) || key(describeAuthorities(d.readingIds)).includes(q)))

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="المتن" value={work} onChange={onWork} options={WORK_IDS.map(w => ({ value: w, label: WORK_NAMES[w] }))} />
        <Segmented label="النوع" value={kind} onChange={onKind} options={[{ value: 'all', label: 'الكل' }, { value: 'reader', label: 'قارئ' }, { value: 'narrator', label: 'راوٍ' }, { value: 'group', label: 'جماعي' }]} />
        <div className="relative min-w-52 flex-1">
          <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-muted)]" />
          <input type="search" aria-label="ابحث عن رمز أو قارئ" value={query} onChange={e => onQuery(e.target.value)} placeholder="رمز أو اسم قارئ: ورش، صحبة" className={`${INPUT} ps-9`} />
        </div>
      </div>
      {failed && <p role="alert" className="text-xs text-[var(--color-danger)]">{failed}. التعريفات تظهر دون الأعداد.</p>}
      <p className="text-[11px] text-[var(--color-ink-muted)]" aria-live="polite">{ar(list.length)} رمزًا في {WORK_NAMES[work]}</p>

      {list.length === 0 && <p className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-xs text-[var(--color-ink-soft)]">لا رمز يطابق البحث.</p>}
      <ul className="divide-y divide-[var(--color-border-soft)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        {list.map(d => {
          const used = counts.get(d.symbol)
          const where = definedIn(work, d.symbol)
          const isOpen = open === d.symbol
          return (
            <li key={`${d.symbol}-${d.readingIds.join()}`} className="px-3 py-3 md:px-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-quran grid min-w-14 place-items-center rounded-lg bg-[var(--color-unique-bg)] px-2 py-1 text-3xl leading-[1.5] text-[var(--color-unique)]" aria-label={`الرمز ${d.symbol}`}>{d.symbol}</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-ink-soft)]">{KIND_NAMES[d.kind]}</span>
                    {d.readingIds.map(id => <AuthorityPill key={id} id={id} size="sm" />)}
                  </div>
                  <p className="text-[11px] text-[var(--color-ink-muted)]">
                    عُرّف في الأبيات <button type="button" onClick={() => onOpenVerse(work, firstVerse(where))} className={`cursor-pointer rounded font-bold text-[var(--color-primary)] hover:underline ${FOCUS}`}>{where}</button> من {WORK_NAMES[work]}
                  </p>
                </div>
                <div className="text-end">
                  {!rows && !failed ? <Skeleton className="h-8 w-20" /> : used ? (
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : d.symbol)}
                      className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 text-xs font-bold hover:bg-[var(--color-surface-2)] [@media(pointer:coarse)]:min-h-11 ${FOCUS}`}>
                      {ar(used.count)} موضعًا
                      <Icon name={isOpen ? 'x' : 'list'} size={14} />
                    </button>
                  ) : <span className="text-xs text-[var(--color-ink-muted)]">{failed ? '' : 'غير موسوم في الأبيات'}</span>}
                </div>
              </div>
              {isOpen && used && (
                <div className="mt-3 border-t border-[var(--color-border-soft)] pt-3">
                  <p className="mb-2 text-[11px] text-[var(--color-ink-soft)]">{ar(used.verified)} موثّقًا من {ar(used.count)}. الأبيات الأولى (اضغط للفتح في المحرر):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {used.verses.map(v => (
                      <button key={v} type="button" onClick={() => onOpenVerse(work, v)}
                        className={`min-h-8 min-w-10 cursor-pointer rounded-lg border border-[var(--color-border)] px-2 text-xs font-bold tabular-nums hover:bg-[var(--color-primary-soft)] [@media(pointer:coarse)]:min-h-11 ${FOCUS}`}>{ar(v)}</button>
                    ))}
                    {used.count > used.verses.length && <span className="self-center text-[11px] text-[var(--color-ink-muted)]">وغيرها…</span>}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

function SymbolChips({ work, defs, onPick, soft }: { work: WorkId; defs: Definition[]; onPick: (w: WorkId, s: string) => void; soft?: boolean }) {
  if (defs.length === 0) return <span className="text-[11px] text-[var(--color-ink-muted)]">لا رمز</span>
  return (
    <span className="flex flex-wrap gap-1">
      {defs.map(d => (
        <button key={d.symbol} type="button" onClick={() => onPick(work, d.symbol)} title={`${d.symbol}: ${describeAuthorities(d.readingIds)}`}
          className={`font-quran min-h-8 min-w-8 cursor-pointer rounded-md border px-1.5 text-lg leading-[1.6] transition-colors duration-150 [@media(pointer:coarse)]:min-h-11 ${FOCUS} ${soft ? 'border-dashed border-[var(--color-border)] text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]' : 'border-[var(--color-unique)] bg-[var(--color-unique-bg)] text-[var(--color-unique)] hover:bg-[var(--color-surface)]'}`}>
          {d.symbol}
        </button>
      ))}
    </span>
  )
}

function ByReader({ current, onPick }: { current: WorkId; onPick: (w: WorkId, s: string) => void }) {
  const readers = Array.from({ length: 10 }, (_, i) => AUTHORITIES.slice(i * 3, i * 3 + 3))
  const order = [current, ...WORK_IDS.filter(w => w !== current)]
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {readers.map(group => (
        <section key={group[0].id} aria-label={group[0].name} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <h3 className="flex items-center gap-2 border-b border-[var(--color-border-soft)] px-4 py-2.5 text-sm font-bold">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: authorityColor(group[0].id) }} aria-hidden="true" />
            {group[0].name}
          </h3>
          <div className="divide-y divide-[var(--color-border-soft)]">
            {group.map(a => (
              <div key={a.id} className="space-y-2 px-4 py-3">
                <AuthorityPill id={a.id} size="sm" />
                {order.map(w => {
                  const { own, within } = symbolsFor(w, a.id)
                  return (
                    <div key={w} className="grid grid-cols-[4.5rem_1fr] items-start gap-2 text-xs">
                      <span className="pt-1 font-bold text-[var(--color-ink-soft)]">{WORK_NAMES[w]}</span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <SymbolChips work={w} defs={own} onPick={onPick} />
                        {within.length > 0 && <><span className="text-[10px] text-[var(--color-ink-muted)]">ضمن:</span><SymbolChips work={w} defs={within} onPick={onPick} soft /></>}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
