import type { ReaderId, ReadingId, NarratorId } from './types'
import { QIRAAT_READERS } from './readers'
import { QIRAAT_NARRATORS, narratorsOfReader } from './narrators'

/**
 * رموز الشاطبية والدرة — the symbol dictionary of the two نظم.
 *
 * This is an IDENTITY dictionary, not a reading dictionary. A symbol tells you WHO a line of the
 * نظم is talking about; it never tells you how a word is written or performed. That still needs a
 * documented وجه anchored to a token (see PROJECT_MASTER.md §12), and must never be inferred from
 * a symbol alone.
 *
 * Two hazards the data model has to survive, both of which the source text warns about:
 *
 *  1. **The same letter means different people in the two متون.** أ is نافع in the Shatibiyyah and
 *     أبو جعفر in the Durrah; ض is خلف عن حمزة there and إسحاق عن خلف العاشر here. So every symbol
 *     carries its `matn`, and nothing resolves without one.
 *  2. **One person, two independent روايات.** الدوري narrates from both أبي عمرو and الكسائي, and
 *     خلف is both a راوٍ عن حمزة (Q06-R01) and the tenth إمام in his own right (Q10). The app's
 *     Q-ID space already separates these, which is exactly why the symbols are keyed to Q-IDs here
 *     rather than to Arabic name strings.
 *
 * `readingCountInSource` is the number printed in the reference's own عدد الروايات column. It is
 * kept deliberately, as a checksum: `symbols.test` asserts it equals what `readingIds` actually
 * expands to, so a mis-transcribed group fails the build instead of teaching the reader wrongly.
 */

export type MatnId = 'shatibiyyah' | 'durrah'

export const MATN_LABEL_AR: Readonly<Record<MatnId, string>> = {
  shatibiyyah: 'الشاطبية',
  durrah: 'الدرة',
}

/** One reader or narrator and the letter that stands for them in a given متن. */
export interface AuthoritySymbol {
  matn: MatnId
  symbol: string
  /** Exactly one of these is set. */
  readerId?: ReaderId
  narratorId?: NarratorId
}

/** A group symbol: one word (صحبة، سما…) or one letter (ث، خ…) standing for several authorities. */
export interface GroupSymbol {
  matn: MatnId
  symbol: string
  kind: 'word' | 'letter'
  /** The short name the شرح uses for the group, where it has one. */
  labelAr?: string
  /** What the symbol denotes, in the نظم's own terms. */
  meaningAr: string
  /** Whole readers the symbol includes (each expands to both of their روايات). */
  readerIds: readonly ReaderId[]
  /** Individual narrators included on their own, without their reader's partner. */
  narratorIds?: readonly NarratorId[]
  /** بيت الشاطبية the symbol is defined in. */
  verseRef: string
  /** The عدد الروايات printed in the source — verified against the expansion by the tests. */
  readingCountInSource: number
}

// ── 1 · القرّاء العشرة ورواة كل قارئ ──────────────────────────────────────────
// Shatibiyyah covers the seven; the Durrah covers the three completing the ten, and REUSES the
// same letters for its own people (see DURRAH_LETTER_REMAP below).
export const AUTHORITY_SYMBOLS: readonly AuthoritySymbol[] = [
  { matn: 'shatibiyyah', symbol: 'أ', readerId: 'Q01' },
  { matn: 'shatibiyyah', symbol: 'ب', narratorId: 'Q01-R01' },
  { matn: 'shatibiyyah', symbol: 'ج', narratorId: 'Q01-R02' },
  { matn: 'shatibiyyah', symbol: 'د', readerId: 'Q02' },
  { matn: 'shatibiyyah', symbol: 'هـ', narratorId: 'Q02-R01' },
  { matn: 'shatibiyyah', symbol: 'ز', narratorId: 'Q02-R02' },
  { matn: 'shatibiyyah', symbol: 'ح', readerId: 'Q03' },
  { matn: 'shatibiyyah', symbol: 'ط', narratorId: 'Q03-R01' },
  { matn: 'shatibiyyah', symbol: 'ي', narratorId: 'Q03-R02' },
  { matn: 'shatibiyyah', symbol: 'ك', readerId: 'Q04' },
  { matn: 'shatibiyyah', symbol: 'ل', narratorId: 'Q04-R01' },
  { matn: 'shatibiyyah', symbol: 'م', narratorId: 'Q04-R02' },
  { matn: 'shatibiyyah', symbol: 'ن', readerId: 'Q05' },
  { matn: 'shatibiyyah', symbol: 'ص', narratorId: 'Q05-R01' },
  { matn: 'shatibiyyah', symbol: 'ع', narratorId: 'Q05-R02' },
  { matn: 'shatibiyyah', symbol: 'ف', readerId: 'Q06' },
  { matn: 'shatibiyyah', symbol: 'ض', narratorId: 'Q06-R01' },
  { matn: 'shatibiyyah', symbol: 'ق', narratorId: 'Q06-R02' },
  { matn: 'shatibiyyah', symbol: 'ر', readerId: 'Q07' },
  { matn: 'shatibiyyah', symbol: 'س', narratorId: 'Q07-R01' },
  { matn: 'shatibiyyah', symbol: 'ت', narratorId: 'Q07-R02' },

  { matn: 'durrah', symbol: 'أ', readerId: 'Q08' },
  { matn: 'durrah', symbol: 'ب', narratorId: 'Q08-R01' },
  { matn: 'durrah', symbol: 'ج', narratorId: 'Q08-R02' },
  { matn: 'durrah', symbol: 'ح', readerId: 'Q09' },
  { matn: 'durrah', symbol: 'ط', narratorId: 'Q09-R01' },
  { matn: 'durrah', symbol: 'ي', narratorId: 'Q09-R02' },
  { matn: 'durrah', symbol: 'ف', readerId: 'Q10' },
  { matn: 'durrah', symbol: 'ض', narratorId: 'Q10-R01' },
  { matn: 'durrah', symbol: 'ق', narratorId: 'Q10-R02' },
] as const

// ── 2 · الرموز الكلمية الثمانية (الشاطبية) ────────────────────────────────────
// "إذا ورد اسم الإمام في مدلول الرمز شمل روايتيه، وإذا ورد اسم راوٍ بعينه اقتصر عليه."
export const WORD_SYMBOLS: readonly GroupSymbol[] = [
  {
    matn: 'shatibiyyah', symbol: 'صَحْبَة', kind: 'word',
    meaningAr: 'حمزة والكسائي وشعبة',
    readerIds: ['Q06', 'Q07'], narratorIds: ['Q05-R01'],
    verseRef: '٥٢', readingCountInSource: 5,
  },
  {
    matn: 'shatibiyyah', symbol: 'صِحَاب', kind: 'word',
    meaningAr: 'حمزة والكسائي وحفص',
    readerIds: ['Q06', 'Q07'], narratorIds: ['Q05-R02'],
    verseRef: '٥٣', readingCountInSource: 5,
  },
  {
    matn: 'shatibiyyah', symbol: 'عَمَّ', kind: 'word',
    meaningAr: 'نافع وابن عامر',
    readerIds: ['Q01', 'Q04'],
    verseRef: '٥٣', readingCountInSource: 4,
  },
  {
    matn: 'shatibiyyah', symbol: 'سَمَا', kind: 'word',
    meaningAr: 'نافع وابن كثير وأبو عمرو',
    readerIds: ['Q01', 'Q02', 'Q03'],
    verseRef: '٥٣–٥٤', readingCountInSource: 6,
  },
  {
    matn: 'shatibiyyah', symbol: 'حَقّ', kind: 'word',
    meaningAr: 'ابن كثير وأبو عمرو',
    readerIds: ['Q02', 'Q03'],
    verseRef: '٥٤', readingCountInSource: 4,
  },
  {
    matn: 'shatibiyyah', symbol: 'نَفَر', kind: 'word',
    meaningAr: 'ابن كثير وأبو عمرو وابن عامر',
    readerIds: ['Q02', 'Q03', 'Q04'],
    verseRef: '٥٤', readingCountInSource: 6,
  },
  {
    matn: 'shatibiyyah', symbol: 'حَرَمِيّ', kind: 'word',
    meaningAr: 'نافع وابن كثير',
    readerIds: ['Q01', 'Q02'],
    verseRef: '٥٥', readingCountInSource: 4,
  },
  {
    matn: 'shatibiyyah', symbol: 'حِصْن', kind: 'word',
    meaningAr: 'نافع وعاصم وحمزة والكسائي',
    readerIds: ['Q01', 'Q05', 'Q06', 'Q07'],
    verseRef: '٥٥', readingCountInSource: 8,
  },
] as const

// ── 3 · الرموز الحرفية الستة للجماعات (الشاطبية) — تُحفظ في «ثخذ ظغش» ─────────
export const LETTER_GROUP_SYMBOLS: readonly GroupSymbol[] = [
  {
    matn: 'shatibiyyah', symbol: 'ث', kind: 'letter', labelAr: 'الكوفيون الثلاثة',
    meaningAr: 'عاصم وحمزة والكسائي',
    readerIds: ['Q05', 'Q06', 'Q07'],
    verseRef: '٤٩', readingCountInSource: 6,
  },
  {
    matn: 'shatibiyyah', symbol: 'خ', kind: 'letter', labelAr: 'الستة غير نافع',
    meaningAr: 'ابن كثير وأبو عمرو وابن عامر وعاصم وحمزة والكسائي',
    readerIds: ['Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07'],
    verseRef: '٤٩–٥٠', readingCountInSource: 12,
  },
  {
    matn: 'shatibiyyah', symbol: 'ذ', kind: 'letter', labelAr: 'الكوفيون وابن عامر',
    meaningAr: 'عاصم وحمزة والكسائي وابن عامر',
    readerIds: ['Q05', 'Q06', 'Q07', 'Q04'],
    verseRef: '٥٠', readingCountInSource: 8,
  },
  {
    matn: 'shatibiyyah', symbol: 'ظ', kind: 'letter', labelAr: 'الكوفيون وابن كثير',
    meaningAr: 'عاصم وحمزة والكسائي وابن كثير',
    readerIds: ['Q05', 'Q06', 'Q07', 'Q02'],
    verseRef: '٥١', readingCountInSource: 8,
  },
  {
    matn: 'shatibiyyah', symbol: 'غ', kind: 'letter', labelAr: 'الكوفيون وأبو عمرو',
    meaningAr: 'عاصم وحمزة والكسائي وأبو عمرو',
    readerIds: ['Q05', 'Q06', 'Q07', 'Q03'],
    verseRef: '٥١', readingCountInSource: 8,
  },
  {
    matn: 'shatibiyyah', symbol: 'ش', kind: 'letter', labelAr: 'الأخوان',
    meaningAr: 'حمزة والكسائي',
    readerIds: ['Q06', 'Q07'],
    verseRef: '٥٢', readingCountInSource: 4,
  },
] as const

export const GROUP_SYMBOLS: readonly GroupSymbol[] = [...WORD_SYMBOLS, ...LETTER_GROUP_SYMBOLS]

/** Expand a group symbol to the Riwayat it covers. A reader expands to both of his narrators. */
export function readingsOfGroupSymbol(symbol: GroupSymbol): ReadingId[] {
  const out: ReadingId[] = []
  for (const readerId of symbol.readerIds) {
    for (const narrator of narratorsOfReader(readerId)) if (!out.includes(narrator.id)) out.push(narrator.id)
  }
  for (const narratorId of symbol.narratorIds ?? []) if (!out.includes(narratorId)) out.push(narratorId)
  return out
}

/** Resolve one letter/word symbol inside a given متن. Never resolves without the متن. */
export function resolveAuthoritySymbol(matn: MatnId, symbol: string): AuthoritySymbol | undefined {
  return AUTHORITY_SYMBOLS.find((a) => a.matn === matn && a.symbol === symbol)
}

// ── 4 · تفكيك التجميعات ───────────────────────────────────────────────────────
// Teaching relations only: + joins members and drops duplicates, − excludes. They never join
// أوجه of recitation and never license combining them.
export const SYMBOL_RELATIONS: readonly { group: string; decomposition: string }[] = [
  { group: 'صَحْبَة', decomposition: 'الأخوان + شعبة' },
  { group: 'صِحَاب', decomposition: 'الأخوان + حفص' },
  { group: 'الكوفيون / ث', decomposition: 'الأخوان + عاصم = صحبة + حفص = صحاب + شعبة' },
  { group: 'صحبة ∪ صحاب', decomposition: 'الكوفيون: جميع روايات عاصم وحمزة والكسائي' },
  { group: 'صحبة ∩ صحاب', decomposition: 'الأخوان: حمزة والكسائي' },
  { group: 'صحبة − صحاب', decomposition: 'شعبة وحده' },
  { group: 'صحاب − صحبة', decomposition: 'حفص وحده' },
  { group: 'عَمَّ', decomposition: 'نافع + ابن عامر' },
  { group: 'حَرَمِيّ', decomposition: 'نافع + ابن كثير' },
  { group: 'حَقّ', decomposition: 'ابن كثير + أبو عمرو' },
  { group: 'سَمَا', decomposition: 'حرميّ + أبو عمرو = حقّ + نافع' },
  { group: 'نَفَر', decomposition: 'حقّ + ابن عامر' },
  { group: 'حِصْن', decomposition: 'الكوفيون + نافع' },
  { group: 'ذ', decomposition: 'الكوفيون + ابن عامر' },
  { group: 'ظ', decomposition: 'الكوفيون + ابن كثير' },
  { group: 'غ', decomposition: 'الكوفيون + أبو عمرو' },
  { group: 'خ', decomposition: 'السبعة − نافع = نفر + الكوفيون' },
] as const

// ── 5 · أمثلة موثقة لاجتماع الرموز ────────────────────────────────────────────
export const COMPOSITION_EXAMPLES: readonly {
  phrase: string; how: string; result: string; caution?: string
}[] = [
  {
    phrase: 'عَمَّ عَلَا',
    how: 'عمّ + ع أول «علا»',
    result: 'نافع وابن عامر وحفص — خمس روايات',
  },
  {
    phrase: 'صَحْبَة كَهْف',
    how: 'صحبة + ك أول «كهف»',
    result: 'حمزة والكسائي وشعبة وابن عامر — سبع روايات',
  },
  {
    phrase: 'سَمَا الْعَلَا',
    how: 'سما + أ أول «العلا»',
    result: 'نافع وابن كثير وأبو عمرو',
    caution: 'الألف هنا تكرّر نافعًا وهو داخل أصلًا في «سما»، فلا يُعدّ مرتين.',
  },
  {
    phrase: 'لِيَقْضُوا سِوَى بَزِّيهِمْ نَفَرٌ جَلَا',
    how: 'نفر + ج أول «جلا» (ورش)، ثم يُخرَج البزي بنصّ «سوى بزيهم»',
    result: 'ورش وقنبل والدوري عن أبي عمرو والسوسي وهشام وابن ذكوان',
    caution: 'الاستثناء جزء من المسألة: لا يصح تشغيل قاموس الرموز منفصلًا عنه.',
  },
] as const

// ── 6 · الدرة: الحرف نفسه ودلالة مختلفة ───────────────────────────────────────
export const DURRAH_LETTER_REMAP: readonly {
  letters: string; inShatibiyyah: string; inDurrah: string
}[] = [
  { letters: 'أ · ب · ج', inShatibiyyah: 'نافع، قالون، ورش', inDurrah: 'أبو جعفر، ابن وردان، ابن جماز' },
  { letters: 'ح · ط · ي', inShatibiyyah: 'أبو عمرو، الدوري عن أبي عمرو، السوسي', inDurrah: 'يعقوب، رويس، روح' },
  { letters: 'ف · ض · ق', inShatibiyyah: 'حمزة، خلف عن حمزة، خلاد', inDurrah: 'خلف العاشر، إسحاق، إدريس' },
] as const

// ── 7 · أسماء البلدان والجماعات ───────────────────────────────────────────────
export const GROUP_NAMES: readonly {
  term: string; inSeven: string; inTen: string
}[] = [
  { term: 'المدني', inSeven: 'نافع', inTen: 'يحتاج إلى السياق؛ ففي العشرة إمامان مدنيان' },
  { term: 'المدنيان', inSeven: 'ليس اسم مجموعة داخل السبعة', inTen: 'نافع وأبو جعفر' },
  { term: 'المكي', inSeven: 'ابن كثير', inTen: 'ابن كثير' },
  { term: 'البصري', inSeven: 'أبو عمرو', inTen: 'يحتاج إلى السياق؛ ففي العشرة أبو عمرو ويعقوب' },
  { term: 'البصريان', inSeven: 'ليس اسم مجموعة داخل السبعة', inTen: 'أبو عمرو ويعقوب' },
  { term: 'الشامي / الدمشقي / اليحصبي', inSeven: 'ابن عامر', inTen: 'ابن عامر' },
  { term: 'الكوفيون', inSeven: 'عاصم وحمزة والكسائي', inTen: 'عند إطلاق الكوفيين الأربعة: ومعهم خلف العاشر' },
  { term: 'الأخوان', inSeven: 'حمزة والكسائي', inTen: 'حمزة والكسائي — لا يُلحق بهما خلف لمجرد توسيع النطاق' },
  { term: 'الحرميان / حرميّ', inSeven: 'نافع وابن كثير', inTen: 'يبقى في الشاطبية لنافع وابن كثير؛ وفي كتاب آخر يُرجع إلى اصطلاحه' },
  { term: 'الحجازيون', inSeven: 'نافع وابن كثير', inTen: 'نافع وابن كثير وأبو جعفر' },
  { term: 'العراقيون', inSeven: 'أبو عمرو وعاصم وحمزة والكسائي', inTen: 'ومعهم يعقوب وخلف العاشر' },
  { term: 'الثلاثة المتممون للعشرة', inSeven: 'خارج السبعة', inTen: 'أبو جعفر ويعقوب وخلف العاشر' },
] as const

// ── 8 · ضوابط الاستعمال ───────────────────────────────────────────────────────
export const USAGE_RULES: readonly string[] = [
  'يُخزَّن كل رمز مع اسم المتن: (الشاطبية، أ) غير (الدرة، أ).',
  'تُفصل هوية القارئ عن هوية الرواية: خلف عن حمزة غير خلف العاشر، والدوري له روايتان مستقلتان.',
  'يُوسَّع اسم الإمام إلى روايتيه، ويُترك الراوي المعيَّن وحده.',
  'تُطبَّق الاستثناءات والقيود على المجموعة في المسألة نفسها، مع حذف التكرار.',
  'هذا المرجع قاموس هوية ورموز فقط؛ وتغيير رسم الكلمة بحسب القراءة يحتاج بيانات الأوجه الموثقة وموضعها من الآية، ولا يُستنتج من الرموز وحدها.',
] as const

export const REFERENCE_SOURCES: readonly { label: string; href: string }[] = [
  { label: 'الشاطبية — الوافي، شرح البيت ٤٥ (رموز القراء والرواة)', href: 'https://shamela.ws/book/38075/21' },
  { label: 'الشاطبية — الأبيات ٤٩–٥٥ وشرح الرموز', href: 'https://shamela.ws/book/38075/23' },
  { label: 'الوافي — شرح الرموز الكلمية الثمانية، ص٢٦', href: 'https://shamela.ws/book/38075/24' },
  { label: 'الوافي — هوية الدوري وروايته عن الإمامين', href: 'https://shamela.ws/book/38075/19' },
  { label: 'الدرة — البهجة المرضية لعلي الضباع، ص١٠–١١', href: 'https://archive.org/details/AlBohga' },
  { label: 'الوافي — الضمائر والرجوع إلى المذكور السابق', href: 'https://shamela.ws/book/38075/314' },
]

/** «الباقون» وأخواتها ليست مجموعة ثابتة — تُحلّ بعد تعيين النطاق والمذكورين والاستثناءات. */
export const REMAINDER_CAVEAT =
  'ألفاظ «الباقون» و«غيره» و«سواهم» و«الجميع» و«عنهما» ليست مجموعات ذات قائمة ثابتة. تُحلّ بعد تعيين نطاق القراء ومَن سبق ذكرهم والاستثناءات والمسألة المقصودة؛ فغير نافع في الشاطبية ستة قراء، ولا يصح جعلهم تلقائيًا التسعة الآخرين من العشرة.'

/** Every authority in the app has exactly one symbol per متن it appears in — used by the UI. */
export function symbolsForMatn(matn: MatnId): AuthoritySymbol[] {
  return AUTHORITY_SYMBOLS.filter((a) => a.matn === matn)
}

export function authorityNameAr(entry: AuthoritySymbol): string {
  if (entry.readerId) return QIRAAT_READERS.find((r) => r.id === entry.readerId)!.nameArShort
  return QIRAAT_NARRATORS.find((n) => n.id === entry.narratorId)!.nameAr
}
