/** «تُقرأ هكذا» — the word as it is written when this ruling is applied (صلة ميم الجمع, نقل). */
export function ReadingFormLine({ form }: { form: string }) {
  return (
    <p data-testid="reading-form" className="mt-1 flex flex-wrap items-baseline gap-2 text-[11px] font-bold text-[var(--mushaf-muted)]">
      <span>تُقرأ هكذا</span>
      <span className="font-[family-name:var(--font-amiri-quran)] text-lg text-[var(--mushaf-ink)]">{form}</span>
    </p>
  )
}
