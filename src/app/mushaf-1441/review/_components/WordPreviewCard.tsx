'use client'

import { useMemo } from 'react'
import type { ReviewNarrator, ReviewRow } from '../_lib/types'
import { cn } from '@/lib/cn'
import { CANONICAL_VARIANT_TYPES, normalizeVariantType } from './FarshFields'
import { describeNarratorGroup } from './narratorDisplay'
import { NarratorBadges } from './NarratorBadges'
import { approvalKind } from './statusMeta'

type Props = {
  /** The word as the Mushaf prints it, and its "surah:ayah" place. */
  wordText: string | null
  ayahKey: string | null
  /** Every live وجه covering the word (not narrowed by the screen's filters: the app shows them all). */
  rows: readonly ReviewRow[]
  /** The reviewer has edits that are not saved yet; the card shows what is saved. */
  unsavedEdits?: boolean
}

type ActionGroup = { action: string; narrators: ReviewNarrator[] }

// One group per action, in the order the actions first appear, like the app's «القرّاء والرواة» lines.
function groupByAction(narrators: readonly ReviewNarrator[]): ActionGroup[] {
  const groups: ActionGroup[] = []
  for (const narrator of narrators) {
    const action = narrator.action?.trim() ?? ''
    const group = groups.find((g) => g.action === action)
    if (group) group.narrators.push(narrator)
    else groups.push({ action, narrators: [narrator] })
  }
  return groups
}

function conditionLabel(row: ReviewRow): string | null {
  if (row.appliesWasl && row.appliesWaqf) return null
  return row.appliesWaqf ? 'وقفًا فقط' : 'وصلًا فقط'
}

function subCategoryLabel(row: ReviewRow): string {
  if (row.kind === 'usul') return row.subCategory?.trim() ?? ''
  const normalized = normalizeVariantType(row.variantType)
  return CANONICAL_VARIANT_TYPES.find((t) => t.dbEnum === normalized)?.label ?? (row.variantType?.trim() ?? '')
}

function ReaderGroups({ row }: { row: ReviewRow }) {
  const groups = useMemo(() => groupByAction(row.narrators), [row.narrators])
  const showWajhs = row.narrators.some((n) => n.wajhOrder > 1)
  if (groups.length === 0) {
    return <p className="text-[11px] font-bold text-red-700">لا قرّاء مسجّلون لهذا الوجه — لن يظهر في التطبيق</p>
  }
  return (
    <div className="space-y-1.5">
      {groups.map((group) => {
        const wajhs = [...new Set(group.narrators.map((n) => n.wajhOrder))].filter((w) => w > 1)
        const notes = [...new Set(group.narrators.map((n) => n.wajhNote?.trim()).filter((n): n is string => !!n))]
        return (
          <div key={group.action || '_'} className="space-y-0.5" data-preview-group>
            <NarratorBadges items={describeNarratorGroup(group.narrators)} />
            {group.action ? (
              <p className="text-[12px] font-bold text-[var(--color-ink-soft)]">{group.action}</p>
            ) : null}
            {showWajhs && wajhs.length > 0 ? (
              <p className="text-[11px] text-[var(--color-ink-muted)]">وجه {wajhs.join('، ')}</p>
            ) : null}
            {notes.map((note) => (
              <p key={note} className="text-[11px] text-[var(--color-ink-muted)]">
                الخلاف: {note}
              </p>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function Crumbs({ parts }: { parts: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold">
      {parts
        .filter(Boolean)
        .flatMap((part, i) => [
          i > 0 ? (
            <span key={`s${i}`} aria-hidden className="text-[var(--color-ink-muted)]">
              ›
            </span>
          ) : null,
          <span key={part} className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[var(--color-ink-soft)]">
            {part}
          </span>,
        ])}
    </div>
  )
}

function StatusChip({ row }: { row: ReviewRow }) {
  const kind = approvalKind(row)
  const [label, tone] =
    row.reviewStatus === 'flagged'
      ? ['معلَّم للمراجعة', 'bg-red-100 text-red-800']
      : kind === 'manual'
        ? ['معتمد', 'bg-green-100 text-green-800']
        : kind === 'auto'
          ? ['معتمد آليًا — يحتاج اعتمادًا يدويًا', 'bg-sky-100 text-sky-800']
          : ['غير معتمد بعد', 'bg-amber-100 text-amber-800']
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', tone)}>{label}</span>
}

function PreviewCard({ row }: { row: ReviewRow }) {
  const isUsul = row.kind === 'usul'
  // What the app prints: the changed reading for a فرش, the word as the Mushaf has it for an أصل.
  const text = isUsul
    ? row.uthmaniText?.trim() || row.hafsText
    : row.uthmaniText?.trim() || row.readingText?.trim() || row.hafsText
  const condition = conditionLabel(row)
  const description = row.description?.trim()
  const performance = row.performanceNote?.trim()
  const ruling = row.rulingText?.trim()
  const notes = row.notes?.trim()
  const spansWords = row.endKey !== row.startKey

  return (
    <article
      className={cn(
        'space-y-2 rounded-[10px] border bg-[var(--color-surface)] p-2.5',
        isUsul ? 'border-[var(--color-primary)]/60' : 'border-[var(--color-border)]',
        row.hiddenFromMushaf && 'opacity-60'
      )}
      data-preview-card={row.kind}
    >
      <div className="flex flex-wrap items-center justify-between gap-1">
        <Crumbs
          parts={
            isUsul
              ? ['أصول القراءات', row.categoryNameAr?.trim() ?? '', subCategoryLabel(row)]
              : ['فرش الحروف', subCategoryLabel(row)]
          }
        />
        <div className="flex items-center gap-1">
          {condition ? <span className="text-[11px] font-bold text-[var(--color-ink-muted)]">{condition}</span> : null}
          <StatusChip row={row} />
        </div>
      </div>

      {spansWords ? <p className="text-[11px] font-bold text-[var(--color-ink-soft)]">الكلمات محل الخلاف</p> : null}
      <p className="text-center font-quran text-[34px] leading-snug text-[var(--color-ink)]" data-preview-text>
        {text}
      </p>
      {isUsul ? <p className="text-center text-[11px] font-bold text-[var(--color-ink-muted)]">تُقرأ هكذا</p> : null}

      {!isUsul && description ? <p className="text-[12px] text-[var(--color-ink-soft)]">{description}</p> : null}
      {!isUsul && performance && performance !== description ? (
        <p className="text-[12px] font-bold text-[var(--color-ink-muted)]">{performance}</p>
      ) : null}

      <ReaderGroups row={row} />

      {isUsul && ruling ? <p className="text-[12px] text-[var(--color-ink-soft)]">{ruling}</p> : null}
      {notes ? <p className="whitespace-pre-line text-[12px] text-[var(--color-ink-muted)]">{notes}</p> : null}
      {row.hiddenFromMushaf ? (
        <p className="text-[11px] font-bold text-[var(--color-ink-muted)]">مخفي عن المصحف — لا يظهر في التطبيق</p>
      ) : null}
    </article>
  )
}

function PreviewBody({ wordText, ayahKey, rows, unsavedEdits }: Props) {
  const live = useMemo(() => rows.filter((r) => !r.deleted), [rows])
  const farsh = live.filter((r) => r.kind === 'farsh')
  const usul = live.filter((r) => r.kind === 'usul')

  return (
    <div className="space-y-2 p-2.5" data-word-preview>
      <div className="flex items-baseline justify-between border-b border-[var(--color-border)] pb-1.5">
        <span className="font-quran text-3xl leading-none text-[var(--color-ink)]">{wordText ?? '—'}</span>
        {ayahKey ? (
          <span dir="ltr" className="text-xs font-bold text-[var(--color-ink-muted)]">
            {ayahKey}
          </span>
        ) : null}
      </div>
      {unsavedEdits ? (
        <p className="rounded bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">
          تعديلات غير محفوظة — البطاقة تعرض المحفوظ فقط
        </p>
      ) : null}

      {farsh.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-[var(--color-primary)]">الفرش</h3>
          {farsh.map((row) => (
            <PreviewCard key={row.entryId} row={row} />
          ))}
        </section>
      ) : null}
      {usul.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-[var(--color-primary)]">الأصول</h3>
          {usul.map((row) => (
            <PreviewCard key={row.entryId} row={row} />
          ))}
        </section>
      ) : null}
      {live.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-sm font-bold text-[var(--color-ink)]">لا خلاف في هذه الكلمة</p>
          <p className="text-xs text-[var(--color-ink-muted)]">متفق عليها بين القراء العشرة ورواتهم</p>
        </div>
      ) : null}
    </div>
  )
}

/**
 * The word's card as the app's word sheet shows it: the word and its place, one card per فرش وجه
 * («الفرش»), one per أصول rule («الأصول»), each with the readers grouped by what they do. It is built
 * from the saved faces, so the reviewer can check what a reader of the app will actually see.
 * Inline (collapsible) version, used in the phone-width editor.
 */
export default function WordPreviewCard(props: Props) {
  return (
    <details open className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40" dir="rtl">
      <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-bold text-[var(--color-ink)]">
        معاينة البطاقة كما تظهر في التطبيق
      </summary>
      <PreviewBody {...props} />
    </details>
  )
}

// An iPhone screen is 390 × 844 points. The card is laid out at exactly that size and scaled down, so
// the reviewer sees the line breaks and sizes the app will have, in a small frame.
const PHONE_W = 390
const PHONE_H = 844
const BEZEL = 6

/** The same card inside a small iPhone-shaped frame (390 × 844, scaled), for beside the Mushaf page. */
export function WordPreviewPhone({ scale = 0.72, ...props }: Props & { scale?: number }) {
  const width = PHONE_W * scale + BEZEL * 2
  const height = PHONE_H * scale + BEZEL * 2
  return (
    <div
      dir="rtl"
      className="shrink-0 overflow-hidden rounded-[28px] border-neutral-800 bg-[var(--color-paper)] shadow-md"
      style={{ width, height, borderWidth: BEZEL, borderStyle: 'solid' }}
      aria-label="معاينة البطاقة كما تظهر في التطبيق"
      data-phone-preview
    >
      <div
        className="flex flex-col"
        style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})`, transformOrigin: 'top right' }}
      >
        <div className="relative flex h-11 shrink-0 items-center justify-center border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <span className="absolute top-1.5 h-1.5 w-20 rounded-full bg-neutral-300" aria-hidden />
          <span className="mt-3 text-sm font-bold text-[var(--color-ink)]">القراءات العشر</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PreviewBody {...props} />
        </div>
      </div>
    </div>
  )
}
