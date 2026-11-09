'use client'

import { useMemo, type CSSProperties } from 'react'
import { normalizeArabic } from '@/lib/arabic'
import { categoryColor } from '../../../../../packages/qiraat-core/categoryColors'
import { QIRAAT_NARRATORS } from '../../../../../packages/qiraat-core/narrators'
import { QIRAAT_READERS } from '../../../../../packages/qiraat-core/readers'
import type { ReviewNarrator, ReviewRow } from '../_lib/types'
import { cn } from '@/lib/cn'
import { CANONICAL_VARIANT_TYPES, normalizeVariantType } from './FarshFields'
import { approvalKind } from './statusMeta'

// The word sheet of the iPhone app (QiraatSheet, VariantCard, RulingCard, QiraatPills), in the same
// colours, shapes and order: the word and its ayah, «الفرش» then «الأصول», one card per وجه with the
// reader pills and what each group does. Light appearance. Built from the SAVED faces.

const INK = '#171717'
const BROWN = '#59461D'
const CARD_FILL = '#FFFEFA'
const CARD_STROKE = '#D9C99B'
const VARIANT_INK = '#7A1F1A'
const BADGE_INK = '#6B4A00'
const BADGE_FILL = '#F1E2B6'
const SECONDARY = '#6B6B6B'
const UNKNOWN_PILL = '#8A7C5C'

type Props = {
  /** The word as the Mushaf prints it, and its "surah:ayah" place. */
  wordText: string | null
  ayahKey: string | null
  /** Every live وجه covering the word (not narrowed by the screen's filters: the app shows them all). */
  rows: readonly ReviewRow[]
  /** The reviewer has edits that are not saved yet; the card shows what is saved. */
  unsavedEdits?: boolean
}

// ---------- pills: «الإمام X» for a whole reader, «الراوي Y» for a lone narrator ----------

type Pill = { key: string; name: string; color: string; narrator: boolean }

function rollupPills(narrators: readonly ReviewNarrator[]): Pill[] {
  const ids = new Set(narrators.map((n) => n.id))
  const pills: Pill[] = []
  const known = new Set<string>()
  for (const reader of [...QIRAAT_READERS].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const all = QIRAAT_NARRATORS.filter((n) => n.readerId === reader.id)
    const present = all.filter((n) => ids.has(n.id))
    all.forEach((n) => known.add(n.id))
    if (present.length === 0) continue
    if (present.length === all.length) {
      pills.push({ key: reader.id, name: `الإمام ${reader.nameArShort}`, color: reader.color, narrator: false })
    } else {
      for (const n of present) pills.push({ key: n.id, name: `الراوي ${n.nameAr}`, color: n.color, narrator: true })
    }
  }
  for (const n of narrators) {
    if (!known.has(n.id)) pills.push({ key: n.id, name: n.nameAr || n.id, color: UNKNOWN_PILL, narrator: false })
  }
  return pills
}

// The first letter of the name, after the label and the article, so the pill says who without colour.
function initialOf(name: string): string {
  let base = name
  for (const prefix of ['الإمام ', 'الراوي ']) {
    if (base.startsWith(prefix)) {
      base = base.slice(prefix.length)
      break
    }
  }
  if (base.startsWith('ال') && base.length > 3) base = base.slice(2)
  return base.charAt(0) || '؟'
}

function onFill(hex: string): string {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return lum > 0.4 ? '#16110A' : '#FFFFFF'
}

function PillRow({ pills }: { pills: Pill[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map((pill) => (
        <span
          key={pill.key}
          className="inline-flex items-center gap-1.5 rounded-full py-[3px] pe-[9px] ps-1"
          style={{
            background: `${pill.color}1A`,
            border: `1px ${pill.narrator ? 'dashed' : 'solid'} ${pill.color}8C`,
          }}
        >
          <span
            aria-hidden
            className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
            style={{ background: pill.color, color: onFill(pill.color) }}
          >
            {initialOf(pill.name)}
          </span>
          <span className="text-xs font-bold" style={{ color: INK }}>
            {pill.name}
          </span>
        </span>
      ))}
    </div>
  )
}

// ---------- small pieces ----------

function Badge({ children, fill = BADGE_FILL, ink = BADGE_INK }: { children: React.ReactNode; fill?: string; ink?: string }) {
  return (
    <span className="rounded-full px-2 py-[3px] text-[11px] font-bold" style={{ background: fill, color: ink }}>
      {children}
    </span>
  )
}

function Dabt({ note }: { note: string }) {
  return (
    <>
      {note.includes('تسهيل') ? (
        <span aria-label="علامة ضبط التسهيل" className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: INK }} />
      ) : null}
      {note.includes('سكت') ? (
        <span aria-label="علامة ضبط السكت" className="text-[11px] font-bold" style={{ color: SECONDARY }}>
          سـ
        </span>
      ) : null}
    </>
  )
}

const fold = (text: string | null | undefined) => normalizeArabic(text ?? '').replace(/\s+/g, ' ').trim()

// The action is shown once under the pills, unless it only repeats the category.
function showAction(action: string, categoryAr: string): boolean {
  const a = fold(action)
  return a !== '' && a !== fold(categoryAr)
}

// The ruling's general text only when it says something the badge and the actions do not.
function distinctRulingText(text: string | null | undefined, categoryAr: string, actions: string[]): string | null {
  const t = fold(text)
  if (!t) return null
  const others = [fold(categoryAr), ...actions.map(fold)].filter(Boolean)
  return others.some((o) => o === t || o.includes(t) || t.includes(o)) ? null : (text ?? '').trim()
}

type ActionGroup = { action: string; narrators: ReviewNarrator[] }

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

function ReaderGroups({ row, categoryAr }: { row: ReviewRow; categoryAr: string }) {
  const groups = useMemo(() => groupByAction(row.narrators), [row.narrators])
  const showWajhs = row.narrators.some((n) => n.wajhOrder > 1)
  const condition = conditionLabel(row)
  if (groups.length === 0) {
    return <p className="text-xs font-bold text-red-700">لا قرّاء مسجّلون لهذا الوجه — لن يظهر في التطبيق</p>
  }
  return (
    <>
      {groups.map((group) => {
        const wajhs = showWajhs ? [...new Set(group.narrators.map((n) => n.wajhOrder))].sort((a, b) => a - b) : []
        const notes = [...new Set(group.narrators.map((n) => n.wajhNote?.trim()).filter((n): n is string => !!n))]
        const withAction = showAction(group.action, categoryAr)
        return (
          <div key={group.action || '_'} className="space-y-1" data-preview-group>
            <PillRow pills={rollupPills(group.narrators)} />
            {withAction || condition || wajhs.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1">
                {wajhs.map((n) => (
                  <Badge key={n}>وجه {n}</Badge>
                ))}
                {withAction ? (
                  <>
                    <Dabt note={group.action} />
                    <span className="text-xs font-bold" style={{ color: INK }}>
                      {group.action}
                    </span>
                  </>
                ) : null}
                {condition ? (
                  <span className="text-xs" style={{ color: SECONDARY }}>
                    {withAction ? '— ' : ''}
                    {condition}
                  </span>
                ) : null}
              </div>
            ) : null}
            {notes.map((note) => (
              <p key={note} className="text-xs" style={{ color: SECONDARY }}>
                الخلاف: {note}
              </p>
            ))}
          </div>
        )
      })}
    </>
  )
}

function Classification({ segments, colored }: { segments: { text: string; color?: string }[]; colored?: boolean }) {
  const parts = segments.filter((s) => s.text)
  return (
    <div className="flex flex-wrap items-center gap-[5px]" aria-label={parts.map((p) => p.text).join(' › ')}>
      {parts.flatMap((part, i) => [
        i > 0 ? (
          <span key={`s${i}`} aria-hidden className="text-[11px] font-bold" style={{ color: SECONDARY }}>
            ›
          </span>
        ) : null,
        part.color && colored ? (
          <Badge key={part.text} fill={part.color} ink={onFill(part.color)}>
            {part.text}
          </Badge>
        ) : (
          <Badge key={part.text}>{part.text}</Badge>
        ),
      ])}
    </div>
  )
}

function subCategoryLabel(row: ReviewRow): string {
  if (row.kind === 'usul') return row.subCategory?.trim() ?? ''
  const normalized = normalizeVariantType(row.variantType)
  return CANONICAL_VARIANT_TYPES.find((t) => t.dbEnum === normalized)?.label ?? (row.variantType?.trim() ?? '')
}

// ---------- cards ----------

const cardBase = 'space-y-2 rounded-[10px] p-2.5'

function ReviewAid({ row }: { row: ReviewRow }) {
  const kind = approvalKind(row)
  const [label, tone] =
    row.reviewStatus === 'flagged'
      ? ['معلَّم للمراجعة', 'bg-red-100 text-red-800']
      : kind === 'manual'
        ? ['معتمد', 'bg-green-100 text-green-800']
        : kind === 'auto'
          ? ['معتمد آليًا — يحتاج اعتمادًا يدويًا', 'bg-sky-100 text-sky-800']
          : ['غير معتمد بعد', 'bg-amber-100 text-amber-800']
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5" data-review-aid>
      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', tone)}>{label}</span>
      {row.hiddenFromMushaf ? (
        <span className="text-[10px] font-bold" style={{ color: SECONDARY }}>
          مخفي عن المصحف — لا يظهر في التطبيق
        </span>
      ) : null}
    </div>
  )
}

function VariantCard({ row }: { row: ReviewRow }) {
  const description = row.description?.trim()
  const note = row.performanceNote?.trim()
  const performanceOnly = !!note && (!row.readingText?.trim() || row.readingText.trim() === row.hafsText.trim())
  const text = row.uthmaniText?.trim() || (performanceOnly ? row.hafsText : row.readingText?.trim() || row.hafsText)
  const spans = row.endKey !== row.startKey
  const label = note || subCategoryLabel(row)
  return (
    <div className={row.hiddenFromMushaf ? 'opacity-60' : undefined}>
      <article
        className={cardBase}
        style={{ background: CARD_FILL, border: `1px solid ${CARD_STROKE}` }}
        data-preview-card="farsh"
      >
        <Classification segments={[{ text: 'فرش الحروف' }, { text: subCategoryLabel(row) }]} />
        {spans ? (
          <p className="text-[11px] font-bold" style={{ color: BROWN }}>
            الكلمات محل الخلاف
          </p>
        ) : null}
        <p className="text-center font-quran text-[40px] leading-snug" style={{ color: VARIANT_INK }} data-preview-text>
          {text}
        </p>
        {description ? (
          <p className="text-xs" style={{ color: BROWN }}>
            {description}
          </p>
        ) : null}
        {note && note !== description ? (
          <div className="flex items-center gap-1">
            <Dabt note={note} />
            <span className="text-xs font-bold" style={{ color: SECONDARY }}>
              {note}
            </span>
          </div>
        ) : null}
        <ReaderGroups row={row} categoryAr={label} />
      </article>
      <ReviewAid row={row} />
    </div>
  )
}

function RulingCard({ row }: { row: ReviewRow }) {
  const color = categoryColor(row.categoryCode)
  const categoryAr = row.categoryNameAr?.trim() ?? ''
  const condition = conditionLabel(row)
  const spans = row.endKey !== row.startKey
  const notes = row.notes?.trim()
  const distinct = distinctRulingText(
    row.rulingText,
    categoryAr,
    row.narrators.map((n) => n.action ?? '')
  )
  const style: CSSProperties = {
    background: `linear-gradient(${color}0F, ${color}0F), ${CARD_FILL}`,
    border: `1px solid ${color}`,
  }
  return (
    <div className={row.hiddenFromMushaf ? 'opacity-60' : undefined}>
      <article className={cardBase} style={style} data-preview-card="usul">
        <div className="flex items-baseline justify-between gap-2">
          <Classification
            colored
            segments={[{ text: 'أصول القراءات' }, { text: categoryAr, color }, { text: row.subCategory?.trim() ?? '' }]}
          />
          {condition ? (
            <span className="shrink-0 text-[10px] font-bold" style={{ color: SECONDARY }}>
              {condition}
            </span>
          ) : null}
        </div>
        {row.hafsText ? (
          <div className="space-y-1 text-center">
            {spans ? (
              <p className="text-[11px] font-bold" style={{ color: BROWN }}>
                الكلمات محل الخلاف
              </p>
            ) : null}
            <p className="font-quran text-[40px] leading-snug" style={{ color }} data-preview-text>
              {row.uthmaniText?.trim() || row.hafsText}
            </p>
            <p className="text-[10px] font-bold" style={{ color: SECONDARY }}>
              تُقرأ هكذا
            </p>
          </div>
        ) : null}
        <ReaderGroups row={row} categoryAr={categoryAr} />
        {distinct ? (
          <p className="text-xs" style={{ color: BROWN }}>
            {distinct}
          </p>
        ) : null}
        {notes ? (
          <p className="whitespace-pre-line text-xs" style={{ color: SECONDARY }}>
            {notes}
          </p>
        ) : null}
      </article>
      <ReviewAid row={row} />
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="pt-1 text-sm font-bold" style={{ color: BROWN }}>
      {children}
    </h3>
  )
}

function PreviewBody({ wordText, ayahKey, rows, unsavedEdits }: Props) {
  const live = useMemo(() => rows.filter((r) => !r.deleted), [rows])
  const farsh = live.filter((r) => r.kind === 'farsh')
  const usul = live.filter((r) => r.kind === 'usul')

  return (
    <div className="space-y-3 p-4" data-word-preview style={{ color: INK }}>
      <div className="flex items-baseline justify-between border-b pb-2" style={{ borderColor: CARD_STROKE }}>
        <span className="font-quran text-[34px] leading-none">{wordText ?? '—'}</span>
        {ayahKey ? (
          <span dir="ltr" className="text-xs font-bold" style={{ color: SECONDARY }}>
            {ayahKey}
          </span>
        ) : null}
      </div>
      {unsavedEdits ? (
        <p className="rounded bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800" data-review-aid>
          تعديلات غير محفوظة — البطاقة تعرض المحفوظ فقط
        </p>
      ) : null}

      {farsh.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading>الفرش</SectionHeading>
          {farsh.map((row) => (
            <VariantCard key={row.entryId} row={row} />
          ))}
        </section>
      ) : null}
      {usul.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading>الأصول</SectionHeading>
          {usul.map((row) => (
            <RulingCard key={row.entryId} row={row} />
          ))}
        </section>
      ) : null}
      {live.length === 0 ? (
        <div className="space-y-1 py-8 text-center">
          <div
            aria-hidden
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 text-xl"
            style={{ color: BROWN, borderColor: BROWN }}
          >
            ✓
          </div>
          <p className="text-[17px] font-bold" style={{ color: BROWN }}>
            لا خلاف في هذه الكلمة
          </p>
          <p className="text-sm" style={{ color: SECONDARY }}>
            متفق عليها بين القراء العشرة ورواتهم
          </p>
        </div>
      ) : null}
    </div>
  )
}

/** Inline (collapsible) version, used in the phone-width editor. */
export default function WordPreviewCard(props: Props) {
  return (
    <details open className="rounded-lg border" style={{ background: '#FFFDF6', borderColor: CARD_STROKE }} dir="rtl">
      <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-bold" style={{ color: BROWN }}>
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

/** The same card as the app's sheet, inside a small iPhone-shaped frame (390 × 844, scaled). */
export function WordPreviewPhone({ scale = 0.72, ...props }: Props & { scale?: number }) {
  const width = PHONE_W * scale + BEZEL * 2
  const height = PHONE_H * scale + BEZEL * 2
  return (
    <div
      dir="rtl"
      className="shrink-0 overflow-hidden rounded-[28px] shadow-md"
      style={{ width, height, border: `${BEZEL}px solid #262626`, background: '#FFFDF6' }}
      aria-label="معاينة البطاقة كما تظهر في التطبيق"
      data-phone-preview
    >
      <div
        className="flex flex-col"
        style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})`, transformOrigin: 'top right' }}
      >
        {/* The sheet's navigation bar: «إغلاق» on the leading side, the title centred. */}
        <div className="relative flex h-12 shrink-0 items-center justify-center border-b" style={{ borderColor: CARD_STROKE }}>
          <span className="absolute top-1.5 h-1 w-9 rounded-full bg-neutral-300" aria-hidden />
          <span className="mt-2 text-[15px] font-semibold" style={{ color: INK }}>
            القراءات العشر
          </span>
          <span className="absolute start-4 top-[22px] text-[15px]" style={{ color: BROWN }} aria-hidden>
            إغلاق
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PreviewBody {...props} />
        </div>
      </div>
    </div>
  )
}
