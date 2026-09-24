'use client'

// Structured Hamzah performance controls for the تغيير الهمز / الهمزتان من كلمة /
// الهمزتان من كلمتين Usul chapters (categoryCode: TAGHYIR_HAMZ / HAMZATAN_KALIMA /
// HAMZATAN_KALIMATAYN). Compact chip rows instead of dropdowns, per the review-editor spec.
// This component never invents qiraat rulings -- it only lets the reviewer pick from the
// existing rule/face vocabulary; the value round-trips through EntryFields.hamzahDetail as
// opaque jsonb.

import type { HamzahDetail, HamzahSingleTreatment } from '../_lib/types'
import { cn } from '@/lib/cn'

const SINGLE_TREATMENTS: HamzahSingleTreatment[] = ['تحقيق', 'تسهيل', 'إبدال', 'نقل', 'حذف', 'سكت قبل الهمز']
const TWO_HAMZAH_TREATMENTS: HamzahSingleTreatment[] = ['تحقيق', 'تسهيل', 'إبدال', 'حذف']

const HAMZAH_CATEGORY_CODES = new Set(['TAGHYIR_HAMZ', 'HAMZATAN_KALIMA', 'HAMZATAN_KALIMATAYN'])

export function isHamzahCategory(categoryCode: string | null): boolean {
  return Boolean(categoryCode && HAMZAH_CATEGORY_CODES.has(categoryCode))
}

function Chip({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean
  onClick(): void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-full border px-2 py-0.5 text-[11px] font-bold transition-all',
        active
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:border-[var(--color-primary)]/60'
      )}
    >
      {children}
    </button>
  )
}

function Toggle({
  active,
  onClick,
  label,
  disabled,
}: {
  active: boolean
  onClick(): void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'rounded-md border px-2 py-0.5 text-[11px] font-bold',
        active
          ? 'border-green-600 bg-green-50 text-green-800'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)]'
      )}
    >
      {active ? '✓ ' : ''}
      {label}
    </button>
  )
}

type Props = {
  categoryCode: string | null
  value: HamzahDetail | null
  onChange(value: HamzahDetail | null): void
  disabled?: boolean
}

export default function HamzahDetailFields({ categoryCode, value, onChange, disabled }: Props) {
  if (!isHamzahCategory(categoryCode)) return null

  if (categoryCode === 'TAGHYIR_HAMZ') {
    const current = value && value.mode === 'single' ? value : null
    return (
      <div className="space-y-1.5 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/30 p-2">
        <label className="text-[11px] font-bold text-[var(--color-ink)]">همزة واحدة: نوع المعالجة</label>
        <div className="flex flex-wrap gap-1">
          {SINGLE_TREATMENTS.map((t) => (
            <Chip
              key={t}
              active={current?.treatment === t}
              disabled={disabled}
              onClick={() => onChange(current?.treatment === t ? null : { mode: 'single', treatment: t })}
            >
              {t}
            </Chip>
          ))}
        </div>
      </div>
    )
  }

  if (categoryCode === 'HAMZATAN_KALIMA') {
    const current = value && value.mode === 'kalima' ? value : null
    return (
      <div className="space-y-1.5 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/30 p-2">
        <label className="text-[11px] font-bold text-[var(--color-ink)]">الهمزتان من كلمة واحدة</label>
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-[var(--color-ink-muted)]">الأولى:</span>
          <div className="flex flex-wrap gap-1">
            {TWO_HAMZAH_TREATMENTS.map((t) => (
              <Chip
                key={t}
                active={current?.first === t}
                disabled={disabled}
                onClick={() =>
                  onChange({
                    mode: 'kalima',
                    first: t,
                    second: current?.second ?? t,
                    idkhalAlif: current?.idkhalAlif,
                  })
                }
              >
                {t}
              </Chip>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-[var(--color-ink-muted)]">الثانية:</span>
          <div className="flex flex-wrap gap-1">
            {TWO_HAMZAH_TREATMENTS.map((t) => (
              <Chip
                key={t}
                active={current?.second === t}
                disabled={disabled || !current}
                onClick={() => current && onChange({ ...current, second: t })}
              >
                {t}
              </Chip>
            ))}
          </div>
        </div>
        <Toggle
          label="إدخال ألف بين الهمزتين"
          active={Boolean(current?.idkhalAlif)}
          disabled={disabled || !current}
          onClick={() => current && onChange({ ...current, idkhalAlif: !current.idkhalAlif })}
        />
      </div>
    )
  }

  // HAMZATAN_KALIMATAYN
  const current = value && value.mode === 'kalimatayn' ? value : null
  return (
    <div className="space-y-1.5 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/30 p-2">
      <label className="text-[11px] font-bold text-[var(--color-ink)]">الهمزتان من كلمتين</label>
      <div className="flex gap-1">
        {(['متفقتان', 'مختلفتان'] as const).map((rel) => (
          <Chip
            key={rel}
            active={current?.harakahRelation === rel}
            disabled={disabled}
            onClick={() =>
              onChange({
                mode: 'kalimatayn',
                harakahRelation: rel,
                firstTreatment: current?.firstTreatment ?? 'تحقيق',
                secondTreatment: current?.secondTreatment ?? 'تحقيق',
                isqatFirst: current?.isqatFirst,
                isqatSecond: current?.isqatSecond,
                ibdalMadd: current?.ibdalMadd,
              })
            }
          >
            {rel} في الحركة
          </Chip>
        ))}
      </div>
      {current ? (
        <>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[var(--color-ink-muted)]">معالجة الأولى:</span>
            <div className="flex flex-wrap gap-1">
              {TWO_HAMZAH_TREATMENTS.map((t) => (
                <Chip key={t} active={current.firstTreatment === t} disabled={disabled} onClick={() => onChange({ ...current, firstTreatment: t })}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[var(--color-ink-muted)]">معالجة الثانية:</span>
            <div className="flex flex-wrap gap-1">
              {TWO_HAMZAH_TREATMENTS.map((t) => (
                <Chip key={t} active={current.secondTreatment === t} disabled={disabled} onClick={() => onChange({ ...current, secondTreatment: t })}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            <Toggle label="إسقاط الأولى" active={Boolean(current.isqatFirst)} disabled={disabled} onClick={() => onChange({ ...current, isqatFirst: !current.isqatFirst })} />
            <Toggle label="إسقاط الثانية" active={Boolean(current.isqatSecond)} disabled={disabled} onClick={() => onChange({ ...current, isqatSecond: !current.isqatSecond })} />
            <Toggle label="إبدال حرف مد" active={Boolean(current.ibdalMadd)} disabled={disabled} onClick={() => onChange({ ...current, ibdalMadd: !current.ibdalMadd })} />
          </div>
        </>
      ) : null}
    </div>
  )
}
