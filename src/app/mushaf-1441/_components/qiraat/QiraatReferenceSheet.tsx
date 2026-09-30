'use client'

import { useState } from 'react'
import { QIRAAT_READERS } from '../../../../../packages/qiraat-core/readers'
import { narratorsOfReader } from '../../../../../packages/qiraat-core/narrators'
import { readerColor, narratorColor } from '../../../../../packages/qiraat-core/colors'
import {
  AUTHORITY_SYMBOLS, COMPOSITION_EXAMPLES, DURRAH_LETTER_REMAP, GROUP_NAMES,
  LETTER_GROUP_SYMBOLS, MATN_LABEL_AR, REFERENCE_SOURCES, REMAINDER_CAVEAT,
  SYMBOL_RELATIONS, USAGE_RULES, WORD_SYMBOLS, authorityNameAr, readingsOfGroupSymbol,
  type GroupSymbol, type MatnId,
} from '../../../../../packages/qiraat-core/symbols'

// المرجع: القرّاء العشرة ورموز الشاطبية والدرة.
//
// Long reference text is unreadable as one wall, so it is one accordion per section with only the
// first open: the reader chooses what to unfold instead of scrolling past six tables to reach the
// one they wanted. Every group symbol shows its members as the SAME identity-coloured pills the
// rest of the Qiraat layer uses, so a symbol here and a word on the page speak one visual language.

const SECTIONS = [
  { id: 'readers', title: '١ · القرّاء العشرة ورموزهم' },
  { id: 'words', title: '٢ · الرموز الكلمية الثمانية' },
  { id: 'letters', title: '٣ · الرموز الحرفية الستة' },
  { id: 'relations', title: '٤ · تفكيك التجميعات' },
  { id: 'examples', title: '٥ · أمثلة اجتماع الرموز' },
  { id: 'durrah', title: '٦ · الدرة: الحرف نفسه، دلالة أخرى' },
  { id: 'places', title: '٧ · أسماء البلدان والجماعات' },
  { id: 'rules', title: '٨ · ضوابط الاستعمال' },
] as const

function SymbolBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-9 items-center justify-center rounded-md border border-[var(--mushaf-gold)] bg-[var(--mushaf-cream)] px-2 py-1 font-[family-name:var(--font-amiri-quran)] text-base font-black leading-none text-[var(--mushaf-gold-deep)]">
      {children}
    </span>
  )
}

/** One pill per Riwayah, in that narrator's own identity colour — same language as the page. */
function ReadingPills({ symbol }: { symbol: GroupSymbol }) {
  const readings = readingsOfGroupSymbol(symbol)
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {readings.map((readingId) => {
        const readerId = readingId.split('-')[0]
        const reader = QIRAAT_READERS.find((r) => r.id === readerId)
        const narrator = narratorsOfReader(readerId as never).find((n) => n.id === readingId)
        const colour = narratorColor(readingId as never)
        return (
          <span
            key={readingId}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold"
            style={{ color: colour, borderColor: `${colour}66`, backgroundColor: `${colour}14` }}
          >
            <span aria-hidden className="inline-block size-1.5 rounded-full" style={{ backgroundColor: colour }} />
            {narrator?.nameAr}
            <span className="font-normal opacity-70">عن {reader?.nameArShort}</span>
          </span>
        )
      })}
    </div>
  )
}

function GroupSymbolCard({ symbol }: { symbol: GroupSymbol }) {
  return (
    <div className="rounded-lg border border-[var(--mushaf-rule)] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <SymbolBadge>{symbol.symbol}</SymbolBadge>
          <div>
            <p className="text-sm font-black text-[var(--mushaf-ink)]">{symbol.meaningAr}</p>
            {symbol.labelAr ? <p className="text-[11px] text-[var(--mushaf-gold-ink)]">{symbol.labelAr}</p> : null}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[#f4efe6] px-2 py-0.5 text-[11px] font-bold text-[var(--mushaf-gold-deep)]">
          {symbol.readingCountInSource} روايات
        </span>
      </div>
      <ReadingPills symbol={symbol} />
      <p className="mt-2 text-[11px] text-[var(--mushaf-gold-ink)]">بيت الشاطبية {symbol.verseRef}</p>
    </div>
  )
}

function MatnSymbolTable({ matn }: { matn: MatnId }) {
  const rows = AUTHORITY_SYMBOLS.filter((a) => a.matn === matn)
  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.map((entry) => {
        const colour = entry.readerId
          ? readerColor(entry.readerId)
          : narratorColor(entry.narratorId as never)
        return (
          <span
            key={`${entry.matn}-${entry.symbol}-${entry.readerId ?? entry.narratorId}`}
            className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
            style={{ borderColor: `${colour}55`, backgroundColor: `${colour}10` }}
          >
            <span className="font-[family-name:var(--font-amiri-quran)] text-sm font-black" style={{ color: colour }}>
              {entry.symbol}
            </span>
            <span className="font-bold text-[var(--mushaf-ink)]">{authorityNameAr(entry)}</span>
            <span className="text-[11px] text-[var(--mushaf-gold-ink)]">{entry.readerId ? 'إمام' : 'راوٍ'}</span>
          </span>
        )
      })}
    </div>
  )
}

export default function QiraatReferenceSheet() {
  const [open, setOpen] = useState<string | null>('readers')

  return (
    <div className="space-y-2">
      <p className="rounded-lg border border-[var(--mushaf-rule)] bg-[var(--mushaf-cream-2)] p-3 text-xs leading-6 text-[var(--mushaf-brown)]">
        قاموس <strong className="text-[var(--mushaf-gold-deep)]">هوية ورموز</strong> للقرّاء العشرة ورواياتهم العشرين،
        وللرموز الاصطلاحية الثابتة في الشاطبية (للسبعة) والدرة (للثلاثة المتممين).
        الرمز يدلّ على <em>مَن</em> يقرأ، لا على <em>كيف</em> تُرسم الكلمة؛ فتغيير الرسم يحتاج بيانات
        الأوجه الموثقة وموضعها من الآية.
      </p>

      {SECTIONS.map((section) => {
        const isOpen = open === section.id
        return (
          <div key={section.id} className="overflow-hidden rounded-lg border border-[var(--mushaf-rule)]">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : section.id)}
              aria-expanded={isOpen}
              className="flex min-h-11 w-full items-center justify-between gap-3 bg-[var(--mushaf-cream-2)] px-3 py-2 text-right text-sm font-black text-[var(--mushaf-ink)] transition-colors hover:bg-[var(--mushaf-cream)]"
            >
              {section.title}
              <span aria-hidden className="text-xs text-[var(--mushaf-gold-ink)]">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen ? (
              <div className="space-y-3 border-t border-[var(--mushaf-rule-soft)] bg-white p-3">
                {section.id === 'readers' ? (
                  <>
                    {(['shatibiyyah', 'durrah'] as const).map((matn) => (
                      <div key={matn}>
                        <p className="mb-1.5 text-xs font-bold text-[var(--mushaf-gold-ink)]">
                          {MATN_LABEL_AR[matn]} — {matn === 'shatibiyyah' ? 'القرّاء السبعة' : 'الثلاثة المتممون للعشرة'}
                        </p>
                        <MatnSymbolTable matn={matn} />
                      </div>
                    ))}
                    <p className="rounded-md bg-[#f4efe6] p-2.5 text-[11px] leading-6 text-[var(--mushaf-gold-deep)]">
                      عشرون رواية لا عشرون شخصًا: <strong>الدوري</strong> هو حفص بن عمر الدوري نفسه يروي عن
                      أبي عمرو وعن الكسائي، وهما روايتان مستقلتان. و<strong>خلف</strong> الراوي عن حمزة هو
                      خلف العاشر نفسه، لكن روايته عن حمزة غير اختياره بوصفه إمامًا — فلا يُدمج السجلان.
                      و<strong>حفص عن عاصم</strong> ليس حفص بن عمر الدوري.
                    </p>
                  </>
                ) : null}

                {section.id === 'words' ? (
                  <>
                    <p className="text-[11px] leading-6 text-[var(--mushaf-brown)]">
                      إذا ورد اسم الإمام في مدلول الرمز شمل روايتيه، وإذا ورد اسم راوٍ بعينه اقتصر عليه.
                    </p>
                    {WORD_SYMBOLS.map((s) => <GroupSymbolCard key={s.symbol} symbol={s} />)}
                    <p className="rounded-md bg-[#fff3c4] p-2.5 text-[11px] leading-6 text-[var(--mushaf-gold-deep)]">
                      لضبط الفرق: <strong>صَحْبَة</strong> فيها شعبة ولا يدخل فيها حفص، و<strong>صِحَاب</strong> فيها
                      حفص ولا يدخل فيها شعبة؛ وكلتاهما تشمل حمزة والكسائي بروايتيهما. وهذه الدلالات خاصة
                      باصطلاح الشاطبية، فلا يُضاف خلف العاشر إلى أيٍّ منها تلقائيًا.
                    </p>
                  </>
                ) : null}

                {section.id === 'letters' ? (
                  <>
                    <p className="text-[11px] leading-6 text-[var(--mushaf-brown)]">
                      تُحفظ حروف الجماعات في عبارتي «ثخذ ظغش». والرمز الحرفي يؤخذ من أول الكلمة الرمزية في
                      موضعه، فلا تُفكّ كل حروف تلك الكلمة إلى قرّاء. والواو في اصطلاح النظم للفصل بين المسائل،
                      وليست رمزًا لقارئ.
                    </p>
                    {LETTER_GROUP_SYMBOLS.map((s) => <GroupSymbolCard key={s.symbol} symbol={s} />)}
                  </>
                ) : null}

                {section.id === 'relations' ? (
                  <>
                    <p className="text-[11px] leading-6 text-[var(--mushaf-brown)]">
                      إعادة ترتيب تعليمية: <strong>+</strong> جمع الأعضاء مع حذف التكرار، و<strong>−</strong> استثناء.
                      ولا تعني جمع أوجه التلاوة ولا إجازة تركيبها.
                    </p>
                    <ul className="divide-y divide-[var(--mushaf-rule-soft)] rounded-md border border-[var(--mushaf-rule-soft)]">
                      {SYMBOL_RELATIONS.map((r) => (
                        <li key={r.group} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-2.5 py-2 text-xs">
                          <span className="font-black text-[var(--mushaf-ink)]">{r.group}</span>
                          <span className="text-[var(--mushaf-gold-ink)]">=</span>
                          <span className="text-[var(--mushaf-brown)]">{r.decomposition}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                {section.id === 'examples' ? (
                  <>
                    {COMPOSITION_EXAMPLES.map((ex) => (
                      <div key={ex.phrase} className="rounded-lg border border-[var(--mushaf-rule)] bg-[var(--mushaf-cream-2)] p-3">
                        <p className="font-[family-name:var(--font-amiri-quran)] text-lg leading-relaxed text-[var(--mushaf-ink)]">
                          {ex.phrase}
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--mushaf-gold-ink)]">طريقة الفك: {ex.how}</p>
                        <p className="mt-1 text-xs font-bold text-[#11643f]">{ex.result}</p>
                        {ex.caution ? (
                          <p className="mt-1.5 rounded bg-[#fff3c4] px-2 py-1 text-[11px] leading-5 text-[var(--mushaf-gold-deep)]">
                            {ex.caution}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </>
                ) : null}

                {section.id === 'durrah' ? (
                  <>
                    <div className="overflow-hidden rounded-md border border-[var(--mushaf-rule-soft)]">
                      <div className="grid grid-cols-[auto_1fr_1fr] gap-px bg-[var(--mushaf-rule-soft)] text-[11px]">
                        <div className="bg-[#f4efe6] px-2 py-1.5 font-bold text-[var(--mushaf-gold-deep)]">الحروف</div>
                        <div className="bg-[#f4efe6] px-2 py-1.5 font-bold text-[var(--mushaf-gold-deep)]">في الشاطبية</div>
                        <div className="bg-[#f4efe6] px-2 py-1.5 font-bold text-[var(--mushaf-gold-deep)]">في الدرة</div>
                        {DURRAH_LETTER_REMAP.map((row) => (
                          <div key={row.letters} className="contents">
                            <div className="bg-white px-2 py-1.5 font-[family-name:var(--font-amiri-quran)] text-sm font-black text-[var(--mushaf-gold-deep)]">{row.letters}</div>
                            <div className="bg-white px-2 py-1.5 leading-5 text-[var(--mushaf-brown)]">{row.inShatibiyyah}</div>
                            <div className="bg-white px-2 py-1.5 leading-5 text-[var(--mushaf-brown)]">{row.inDurrah}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="rounded-md bg-[#fff3c4] p-2.5 text-[11px] leading-6 text-[var(--mushaf-gold-deep)]">
                      في اصطلاح الدرة: أصل أبي جعفر نافع، وأصل يعقوب أبو عمرو، وأصل خلف العاشر حمزة —
                      و«الأصل» هنا للمقارنة في النظم فقط، ولا يعني أن الثلاثة رواة عن هذه الأصول. فلا تُنسخ
                      أحكام الأصل آليًا بلا قراءة الدرة وقيودها. مثال مباشر:
                      <span className="mx-1 font-[family-name:var(--font-amiri-quran)] font-black">ض</span>
                      في الشاطبية = خلف عن حمزة، وفي الدرة = إسحاق عن خلف العاشر.
                    </p>
                  </>
                ) : null}

                {section.id === 'places' ? (
                  <>
                    <ul className="divide-y divide-[var(--mushaf-rule-soft)] rounded-md border border-[var(--mushaf-rule-soft)]">
                      {GROUP_NAMES.map((g) => (
                        <li key={g.term} className="px-2.5 py-2 text-[11px] leading-5">
                          <p className="font-black text-[var(--mushaf-ink)]">{g.term}</p>
                          <p className="mt-0.5 text-[var(--mushaf-brown)]"><span className="text-[var(--mushaf-gold-ink)]">في السبعة:</span> {g.inSeven}</p>
                          <p className="text-[var(--mushaf-brown)]"><span className="text-[var(--mushaf-gold-ink)]">في العشرة:</span> {g.inTen}</p>
                        </li>
                      ))}
                    </ul>
                    <p className="rounded-md bg-[#fff3c4] p-2.5 text-[11px] leading-6 text-[var(--mushaf-gold-deep)]">{REMAINDER_CAVEAT}</p>
                  </>
                ) : null}

                {section.id === 'rules' ? (
                  <>
                    <ol className="list-decimal space-y-1.5 ps-5 text-[11px] leading-6 text-[var(--mushaf-brown)] marker:font-bold marker:text-[var(--mushaf-gold-ink)]">
                      {USAGE_RULES.map((rule) => <li key={rule}>{rule}</li>)}
                    </ol>
                    <div>
                      <p className="mb-1.5 text-xs font-bold text-[var(--mushaf-gold-ink)]">المصادر</p>
                      <ul className="space-y-1">
                        {REFERENCE_SOURCES.map((src) => (
                          <li key={src.href}>
                            <a
                              href={src.href}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-[11px] leading-5 text-[#1d4ed8] underline decoration-dotted underline-offset-2"
                            >
                              {src.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-[11px] leading-6 text-[var(--mushaf-gold-ink)]">
                      درجة الاكتمال: يشمل جميع رموز القرّاء والرواة في المتنين، ورموز جماعات الشاطبية الستة
                      الحرفية والثمانية الكلمية، وأهم الألقاب الجغرافية وأمثلة تركيب موثقة. ولا يدّعي حصر كل
                      صيغة وصفية في الشروح، ولا حصر أوجه القراءات والتحريرات.
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
