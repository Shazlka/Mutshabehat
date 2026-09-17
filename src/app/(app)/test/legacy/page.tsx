import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSurahNames } from '@/lib/quran'
import TestRunner from '@/components/TestRunner'
import { buildTestQuestions, TEST_MODES, TEST_SOURCES, type TestMode, type TestSource, type TestSourceGroup } from '@/lib/test-questions'
import { buildQuranTestQuestions } from '@/lib/test-questions-quran'

type SP = Promise<{ start?: string; scope?: string; surah?: string; count?: string; mode?: string; source?: string }>

const SCOPES = [
  { value: 'all', label: 'الكل' },
  { value: 'favorite', label: 'المفضّلة' },
  { value: 'completed', label: 'المكتملة' },
  { value: 'draft', label: 'المسودات' },
] as const

const MODE_OPTIONS: Record<TestMode, { label: string; hint: string }> = {
  mcq: { label: 'اختيار الموضع', hint: 'تظهر الآية فتختار سورتها وموضعها من بين المواضع المتشابهة' },
  words: { label: 'الكلمات المتشابهة', hint: 'تُخفى كلمة من الآية فتختارها من بين كلمات المواضع المتشابهة' },
  flash: { label: 'بطاقات الاستذكار', hint: 'يظهر الموضع فتستحضر الآية ثم تكشفها وتقيّم نفسك' },
  mixed: { label: 'مختلط', hint: 'مزيج من الأنواع الثلاثة' },
}

const SOURCE_OPTIONS: Record<TestSource, { label: string; hint: string }> = {
  personal: { label: 'مجموعاتي', hint: 'آيات مجموعات المتشابهات المحفوظة' },
  quran: { label: 'القرآن كاملًا', hint: 'أي آية من المصحف، والخيارات من مواضع تشبهها' },
}

const COUNTS = [10, 20, 50]

const GROUP_SELECT = 'id, title, verses ( surah, ayah, sort_order, parts ( type, text, sort_order ) )'

// Radio rendered as a pill; the checked state is styled from the hidden input via :has().
const PILL_CLASS =
  'inline-flex items-center px-3.5 py-2 rounded-full text-[13px] font-bold cursor-pointer tap-shrink transition-colors border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:border-[var(--color-primary)] has-[:checked]:bg-[var(--color-primary)] has-[:checked]:border-[var(--color-primary)] has-[:checked]:text-[var(--color-paper)] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[var(--color-primary-soft)]'

export default async function TestPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const scope = SCOPES.some((s) => s.value === sp.scope) ? sp.scope! : 'all'
  const mode: TestMode = TEST_MODES.includes(sp.mode as TestMode) ? (sp.mode as TestMode) : 'mcq'
  const source: TestSource = TEST_SOURCES.includes(sp.source as TestSource) ? (sp.source as TestSource) : 'personal'
  const count = COUNTS.includes(Number(sp.count)) ? Number(sp.count) : 10
  const surah = (sp.surah ?? '').trim()
  const started = sp.start === '1'

  const supabase = await createServerSupabaseClient()

  const settings = new URLSearchParams({ source, scope, mode, count: String(count), ...(surah ? { surah } : {}) })
  const settingsHref = `/test/legacy?${settings.toString()}`

  if (started) {
    let questions
    if (source === 'quran') {
      questions = buildQuranTestQuestions(mode, count, surah || null)
    } else {
      let query = supabase
        .from('groups')
        .select(surah ? `${GROUP_SELECT}, sv:verses!inner(surah)` : GROUP_SELECT)
        .limit(1000)
      if (scope === 'favorite') query = query.eq('favorite', true)
      if (scope === 'completed') query = query.eq('completed', true)
      if (scope === 'draft') query = query.eq('status', 'draft')
      if (surah) query = query.eq('sv.surah', surah)

      const { data } = await query
      questions = buildTestQuestions((data as unknown as TestSourceGroup[]) ?? [], mode, count)
    }

    return (
      <div className="max-w-2xl mx-auto px-3 md:px-8 py-5 md:py-12">
        <header className="mb-6 flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-[22px] md:text-[28px] font-bold tracking-tight text-[var(--color-ink)] leading-none">اختبار المتشابهات</h1>
            <p className="mt-1.5 text-[12px] text-[var(--color-ink-muted)]">
              {MODE_OPTIONS[mode].label} · {source === 'quran' ? SOURCE_OPTIONS.quran.label : SCOPES.find((s) => s.value === scope)?.label}{surah ? ` · سورة ${surah}` : ''}
            </p>
          </div>
        </header>

        {questions.length === 0 ? (
          <div className="py-16 px-6 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border-soft)]">
            <p className="text-[15px] font-bold text-[var(--color-ink)]">لا توجد أسئلة لهذه الإعدادات</p>
            <p className="mt-2 text-[12px] text-[var(--color-ink-muted)]">
              {mode === 'words'
                ? 'يحتاج اختبار الكلمات إلى مجموعات فيها أجزاء اختلاف ملوّنة.'
                : 'يحتاج الاختبار إلى مجموعات فيها موضعان مختلفان على الأقل.'}
            </p>
            <a href={settingsHref} className="inline-block mt-5 text-[13px] font-bold text-[var(--color-primary)] hover:underline">تغيير الإعدادات</a>
          </div>
        ) : (
          <TestRunner key={questions.map((q) => q.id).join('|')} questions={questions} settingsHref={settingsHref} />
        )}
      </div>
    )
  }

  // Setup screen
  const { data: surahRows } = await supabase.from('surah_counts').select('surah, cnt')
  // All 114 surahs (the whole-Quran source can test any of them); counts are personal groups' verses.
  const personalCounts = new Map(((surahRows as { surah: string; cnt: number }[] | null) ?? []).map((row) => [row.surah, Number(row.cnt)]))
  const surahOptions = Object.entries(getSurahNames())
    .map(([no, name]) => ({ name, count: personalCounts.get(name) ?? 0, no: Number(no) }))
    .sort((a, b) => a.no - b.no)

  return (
    <div className="max-w-2xl mx-auto px-3 md:px-8 py-5 md:py-12">
      <header className="mb-8">
        <h1 className="text-[22px] md:text-[32px] font-bold tracking-tight text-[var(--color-ink)] leading-none">اختبار المتشابهات</h1>
        <p className="mt-2 text-[13px] text-[var(--color-ink-muted)]">
          اختبر تمييزك بين المواضع والكلمات المتشابهة من مجموعاتك أو من القرآن كاملًا. تُحفظ نتائجك في الإحصائيات.
        </p>
      </header>

      <form action="/test/legacy" method="get" className="space-y-7">
        <input type="hidden" name="start" value="1" />

        <fieldset>
          <legend className="text-[13px] font-bold text-[var(--color-ink)] mb-3">مصدر الأسئلة</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {TEST_SOURCES.map((value) => (
              <label key={value}
                className="flex items-start gap-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] cursor-pointer tap-shrink transition-colors hover:border-[var(--color-primary)] has-[:checked]:border-[var(--color-primary)] has-[:checked]:bg-[var(--color-primary-soft)]">
                <input type="radio" name="source" value={value} defaultChecked={value === source} className="mt-1 accent-[var(--color-primary)]" />
                <span>
                  <span className="block text-[14px] font-bold text-[var(--color-ink)]">{SOURCE_OPTIONS[value].label}</span>
                  <span className="block mt-0.5 text-[12px] text-[var(--color-ink-muted)]">{SOURCE_OPTIONS[value].hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-[13px] font-bold text-[var(--color-ink)] mb-3">نوع الاختبار</legend>
          <div className="grid gap-2">
            {TEST_MODES.map((value) => (
              <label key={value}
                className="flex items-start gap-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] cursor-pointer tap-shrink transition-colors hover:border-[var(--color-primary)] has-[:checked]:border-[var(--color-primary)] has-[:checked]:bg-[var(--color-primary-soft)]">
                <input type="radio" name="mode" value={value} defaultChecked={value === mode} className="mt-1 accent-[var(--color-primary)]" />
                <span>
                  <span className="block text-[14px] font-bold text-[var(--color-ink)]">{MODE_OPTIONS[value].label}</span>
                  <span className="block mt-0.5 text-[12px] text-[var(--color-ink-muted)]">{MODE_OPTIONS[value].hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-[13px] font-bold text-[var(--color-ink)] mb-3">المجموعات <span className="font-normal text-[12px] text-[var(--color-ink-muted)]">(لمصدر مجموعاتي)</span></legend>
          <div className="flex flex-wrap gap-2">
            {SCOPES.map((s) => (
              <label key={s.value} className={PILL_CLASS}>
                <input type="radio" name="scope" value={s.value} defaultChecked={s.value === scope} className="sr-only" />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="test-surah" className="block text-[13px] font-bold text-[var(--color-ink)] mb-3">السورة</label>
          <select id="test-surah" name="surah" defaultValue={surah}
            className="w-full px-4 py-3 bg-[var(--color-surface)] text-[14px] text-[var(--color-ink)] border border-[var(--color-border)] rounded-xl focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary-soft)]">
            <option value="">كل السور</option>
            {surahOptions.map((option) => (
              <option key={option.name} value={option.name}>{option.no}. {option.name}{option.count ? ` (${option.count})` : ''}</option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="text-[13px] font-bold text-[var(--color-ink)] mb-3">عدد الأسئلة</legend>
          <div className="flex flex-wrap gap-2">
            {COUNTS.map((value) => (
              <label key={value} className={PILL_CLASS}>
                <input type="radio" name="count" value={value} defaultChecked={value === count} className="sr-only" />
                {value}
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit"
          className="w-full min-h-[54px] rounded-xl bg-[var(--color-primary)] text-[var(--color-paper)] text-[15px] font-bold hover:bg-[var(--color-primary-hover)] tap-shrink transition-colors">
          ابدأ الاختبار
        </button>
      </form>
    </div>
  )
}
