'use client'

import { useMemo, useState } from 'react'
import { buildUsulIndex, type UsulPlace } from '../../../../../packages/qiraat-core/features/usulIndex'
import { useAllPagesData } from '../host/allPagesData'
import { FeatureSheet } from '../host/FeatureSheet'

/** «فهرس الأصول»: every أصول باب and the places it applies across the Mushaf. */
export function UsulIndexSheet(props: {
  onGoToPlace: (place: Pick<UsulPlace, 'page' | 'surah' | 'ayah' | 'startToken'>) => void
  onClose: () => void
}) {
  const data = useAllPagesData(true)
  const [open, setOpen] = useState<string | null>(null)
  const categories = useMemo(() => buildUsulIndex(data.rulingsByPage), [data.rulingsByPage])
  return (
    <FeatureSheet title="فهرس الأصول" onClose={props.onClose} testId="usul-index">
      {!data.done ? (
        <p data-testid="usul-index-progress" className="mb-3 text-[11px] font-bold text-[var(--mushaf-muted)]">
          جارٍ تحميل الصفحات {data.loaded} من {data.total}…
        </p>
      ) : null}
      {categories.length === 0 && data.done ? <p className="text-sm text-[var(--mushaf-muted)]">لا توجد أحكام مسجَّلة.</p> : null}
      <ul className="space-y-2">
        {categories.map((category) => (
          <li key={category.code} className="rounded-lg border border-[var(--mushaf-rule-soft)] bg-white">
            <button
              type="button"
              data-testid={`usul-category-${category.code}`}
              aria-expanded={open === category.code}
              onClick={() => setOpen(open === category.code ? null : category.code)}
              className="flex min-h-6 w-full items-center gap-2 p-2 text-start text-xs font-black [@media(pointer:coarse)]:min-h-11"
            >
              <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full" style={{ background: category.color }} />
              <span className="flex-1">{category.categoryAr}</span>
              <span className="text-[var(--mushaf-muted)]">{category.count} موضعًا</span>
            </button>
            {open === category.code ? (
              <ul className="max-h-72 space-y-1 overflow-y-auto border-t border-[var(--mushaf-rule-soft)] p-2">
                {category.places.map((place) => (
                  <li key={place.id}>
                    <button
                      type="button"
                      data-testid="usul-place"
                      onClick={() => { props.onGoToPlace(place); props.onClose() }}
                      className="flex min-h-6 w-full items-baseline justify-between gap-2 rounded px-1 py-0.5 text-start text-xs hover:bg-[var(--mushaf-cream-3)] [@media(pointer:coarse)]:min-h-11"
                    >
                      <span className="font-[family-name:var(--font-amiri-quran)] text-lg">{place.baseText || '—'}</span>
                      <span className="text-[11px] text-[var(--mushaf-muted)]">{place.surah}:{place.ayah} · ص {place.page}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </FeatureSheet>
  )
}
