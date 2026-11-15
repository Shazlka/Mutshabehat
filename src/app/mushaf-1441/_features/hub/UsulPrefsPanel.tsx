'use client'

import {
  toggleUsulCategory,
  setAllUsulCategories,
  type QiraatUsulPrefs,
  type UsulCategoryOption,
} from '../../../../../packages/qiraat-core/features/preferences'

// One switch per أصول باب and «فرش فقط» (iOS Settings). Each row shows the باب's name as text beside its
// colour dot, so the colour is never the only cue. Rows are at least 24 px tall (44 px on touch).
const ROW = 'flex min-h-6 items-center gap-2 text-[11px] font-bold text-[var(--mushaf-ink)] [@media(pointer:coarse)]:min-h-11'

export function UsulPrefsPanel(props: {
  prefs: QiraatUsulPrefs
  options: UsulCategoryOption[]
  expanded?: boolean
  onChange: (next: QiraatUsulPrefs) => void
}) {
  const { prefs, options, onChange } = props
  return (
    <details open={props.expanded || undefined} data-testid="usul-prefs" className="rounded-lg border border-[var(--mushaf-rule)] p-2 text-xs">
      <summary className="flex min-h-6 cursor-pointer items-center text-[11px] font-black text-[var(--mushaf-ink)] [@media(pointer:coarse)]:min-h-11">أبواب الأصول المعروضة</summary>
      <div className="mt-2 space-y-1">
        <label className={ROW}>
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 [@media(pointer:coarse)]:h-6 [@media(pointer:coarse)]:w-6"
            data-testid="usul-farsh-only"
            checked={prefs.farshOnly}
            onChange={(event) => onChange({ ...prefs, farshOnly: event.target.checked })}
          />
          فرش الحروف فقط (إخفاء الأصول)
        </label>
        <div className="space-y-0.5 border-t border-[var(--mushaf-rule-soft)] pt-1">
          <div className="flex items-center justify-between gap-2 py-2">
            <span>{options.filter((option) => !prefs.disabledCategories.includes(option.code)).length} من {options.length} بابًا</span>
            <div className="flex gap-2">
              <button type="button" disabled={prefs.farshOnly} className="min-h-11 rounded border border-[var(--mushaf-rule)] px-3 disabled:opacity-50" onClick={() => onChange(setAllUsulCategories(prefs, options.map((option) => option.code), true))}>إظهار الكل</button>
              <button type="button" disabled={prefs.farshOnly} className="min-h-11 rounded border border-[var(--mushaf-rule)] px-3 disabled:opacity-50" onClick={() => onChange(setAllUsulCategories(prefs, options.map((option) => option.code), false))}>إخفاء الكل</button>
            </div>
          </div>
          <p className="py-1 leading-6 text-[var(--qx-muted)]">إخفاء الباب يخفي علاماته وبطاقاته ونتائج البحث عنه. تبقى اختيارات الأبواب محفوظة عند تفعيل «فرش فقط».</p>
          {options.map((option) => (
            <label key={option.code} className={`${ROW} ${prefs.farshOnly ? 'opacity-50' : ''}`}>
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 [@media(pointer:coarse)]:h-6 [@media(pointer:coarse)]:w-6"
                data-testid={`usul-switch-${option.code}`}
                disabled={prefs.farshOnly}
                checked={!prefs.disabledCategories.includes(option.code)}
                onChange={(event) => onChange(toggleUsulCategory(prefs, option.code, event.target.checked))}
              />
              <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full border border-[var(--mushaf-rule)]" style={{ background: option.color ?? 'transparent' }} />
              {option.label}
            </label>
          ))}
        </div>
      </div>
    </details>
  )
}
