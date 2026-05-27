/**
 * quranMeta.js — Quran structure data (Task 4.1)
 *
 * Exports:
 *   SURAHS          — array[114] of surah descriptor objects
 *   SURAH_BY_NAME   — Map<arabicName, surahObj>  (exact match)
 *   SURAH_BY_NUMBER — Map<number,    surahObj>
 *   JUZ             — array[30]  of juz descriptor objects
 *   getSurahByName(name)       — exact lookup, returns null on miss
 *   getSurahByNameFuzzy(name)  — normalised lookup for tashkeel/alef variants
 *   getSurahsInJuz(juzNumber)  — array of surah objects starting in that juz
 *   getJuzForSurah(surahNumber) — starting juz number (1-30)
 *
 * Surah object shape:
 *   { number, name, nameEn, verses, juz, type('مكي'|'مدني'), page }
 *
 * Juz assignment: the juz in which the surah starts (standard mushaf index).
 * Juz 2 (2:142) and Juz 5 (4:24) have no surah starts — their `surahs`
 * array is empty; both juz are continuous sections of surah 2 / surah 4.
 *
 * Verse counts follow the Hafs-'an-'Asim recitation (604-page Madinah Mushaf).
 */

// ── Raw data ──────────────────────────────────────────────────────────────────
// Columns: [number, arabicName, englishName, verses, startJuz, isMadani, mushafPage]
// isMadani: 1 = مدني, 0 = مكي

/* eslint-disable */
const _RAW = [
  [ 1, 'الفاتحة',    'Al-Fatihah',      7,  1, 0,   1],
  [ 2, 'البقرة',     'Al-Baqarah',    286,  1, 1,   2],
  [ 3, 'آل عمران',   'Aal Imran',     200,  3, 1,  50],
  [ 4, 'النساء',     'An-Nisa',       176,  4, 1,  77],
  [ 5, 'المائدة',    "Al-Ma'idah",    120,  6, 1, 106],
  [ 6, 'الأنعام',    "Al-An'am",      165,  7, 0, 128],
  [ 7, 'الأعراف',    "Al-A'raf",      206,  8, 0, 151],
  [ 8, 'الأنفال',    'Al-Anfal',       75,  9, 1, 177],
  [ 9, 'التوبة',     'At-Tawbah',     129, 10, 1, 187],
  [10, 'يونس',       'Yunus',         109, 11, 0, 208],
  [11, 'هود',        'Hud',           123, 11, 0, 221],
  [12, 'يوسف',       'Yusuf',         111, 12, 0, 235],
  [13, 'الرعد',      "Ar-Ra'd",        43, 13, 1, 249],
  [14, 'إبراهيم',    'Ibrahim',        52, 13, 0, 255],
  [15, 'الحجر',      'Al-Hijr',        99, 14, 0, 262],
  [16, 'النحل',      'An-Nahl',       128, 14, 0, 267],
  [17, 'الإسراء',    "Al-Isra'",      111, 15, 0, 282],
  [18, 'الكهف',      'Al-Kahf',       110, 15, 0, 293],
  [19, 'مريم',       'Maryam',         98, 16, 0, 305],
  [20, 'طه',         'Ta-Ha',         135, 16, 0, 312],
  [21, 'الأنبياء',   'Al-Anbiya',     112, 17, 0, 322],
  [22, 'الحج',       'Al-Hajj',        78, 17, 1, 332],
  [23, 'المؤمنون',   "Al-Mu'minun",   118, 18, 0, 342],
  [24, 'النور',      'An-Nur',         64, 18, 1, 350],
  [25, 'الفرقان',    'Al-Furqan',      77, 18, 0, 359],
  [26, 'الشعراء',    "Ash-Shu'ara",   227, 19, 0, 367],
  [27, 'النمل',      'An-Naml',        93, 19, 0, 377],
  [28, 'القصص',      'Al-Qasas',       88, 20, 0, 385],
  [29, 'العنكبوت',   'Al-Ankabut',     69, 20, 0, 396],
  [30, 'الروم',      'Ar-Rum',         60, 21, 0, 404],
  [31, 'لقمان',      'Luqman',         34, 21, 0, 411],
  [32, 'السجدة',     'As-Sajdah',      30, 21, 0, 415],
  [33, 'الأحزاب',    'Al-Ahzab',       73, 21, 1, 418],
  [34, 'سبأ',        "Saba'",          54, 22, 0, 428],
  [35, 'فاطر',       'Fatir',          45, 22, 0, 434],
  [36, 'يس',         'Ya-Sin',         83, 22, 0, 440],
  [37, 'الصافات',    'As-Saffat',     182, 23, 0, 446],
  [38, 'ص',          'Sad',            88, 23, 0, 453],
  [39, 'الزمر',      'Az-Zumar',       75, 23, 0, 458],
  [40, 'غافر',       'Ghafir',         85, 24, 0, 467],
  [41, 'فصلت',       'Fussilat',       54, 24, 0, 477],
  [42, 'الشورى',     'Ash-Shura',      53, 25, 0, 483],
  [43, 'الزخرف',     'Az-Zukhruf',     89, 25, 0, 489],
  [44, 'الدخان',     'Ad-Dukhan',      59, 25, 0, 496],
  [45, 'الجاثية',    'Al-Jathiyah',    37, 25, 0, 499],
  [46, 'الأحقاف',    'Al-Ahqaf',       35, 26, 0, 502],
  [47, 'محمد',       'Muhammad',       38, 26, 1, 507],
  [48, 'الفتح',      'Al-Fath',        29, 26, 1, 511],
  [49, 'الحجرات',    'Al-Hujurat',     18, 26, 1, 515],
  [50, 'ق',          'Qaf',            45, 26, 0, 518],
  [51, 'الذاريات',   'Adh-Dhariyat',   60, 26, 0, 521],
  [52, 'الطور',      'At-Tur',         49, 27, 0, 523],
  [53, 'النجم',      'An-Najm',        62, 27, 0, 526],
  [54, 'القمر',      'Al-Qamar',       55, 27, 0, 528],
  [55, 'الرحمن',     'Ar-Rahman',      78, 27, 1, 531],
  [56, 'الواقعة',    "Al-Waqi'ah",     96, 27, 0, 534],
  [57, 'الحديد',     'Al-Hadid',       29, 27, 1, 537],
  [58, 'المجادلة',   'Al-Mujadila',    22, 28, 1, 542],
  [59, 'الحشر',      'Al-Hashr',       24, 28, 1, 545],
  [60, 'الممتحنة',   'Al-Mumtahanah',  13, 28, 1, 549],
  [61, 'الصف',       'As-Saf',         14, 28, 1, 551],
  [62, 'الجمعة',     "Al-Jumu'ah",     11, 28, 1, 553],
  [63, 'المنافقون',  'Al-Munafiqun',   11, 28, 1, 554],
  [64, 'التغابن',    'At-Taghabun',    18, 28, 1, 556],
  [65, 'الطلاق',     'At-Talaq',       12, 28, 1, 558],
  [66, 'التحريم',    'At-Tahrim',      12, 28, 1, 560],
  [67, 'الملك',      'Al-Mulk',        30, 29, 0, 562],
  [68, 'القلم',      'Al-Qalam',       52, 29, 0, 564],
  [69, 'الحاقة',     'Al-Haqqah',      52, 29, 0, 566],
  [70, 'المعارج',    "Al-Ma'arij",     44, 29, 0, 568],
  [71, 'نوح',        'Nuh',            28, 29, 0, 570],
  [72, 'الجن',       'Al-Jinn',        28, 29, 0, 572],
  [73, 'المزمل',     'Al-Muzzammil',   20, 29, 0, 574],
  [74, 'المدثر',     'Al-Muddaththir', 56, 29, 0, 575],
  [75, 'القيامة',    'Al-Qiyamah',     40, 29, 0, 577],
  [76, 'الإنسان',    'Al-Insan',       31, 29, 1, 578],
  [77, 'المرسلات',   'Al-Mursalat',    50, 29, 0, 580],
  [78, 'النبأ',      "An-Naba'",       40, 30, 0, 582],
  [79, 'النازعات',   "An-Nazi'at",     46, 30, 0, 583],
  [80, 'عبس',        'Abasa',          42, 30, 0, 585],
  [81, 'التكوير',    'At-Takwir',      29, 30, 0, 586],
  [82, 'الانفطار',   'Al-Infitar',     19, 30, 0, 587],
  [83, 'المطففين',   'Al-Mutaffifin',  36, 30, 0, 587],
  [84, 'الانشقاق',   'Al-Inshiqaq',    25, 30, 0, 589],
  [85, 'البروج',     'Al-Buruj',       22, 30, 0, 590],
  [86, 'الطارق',     'At-Tariq',       17, 30, 0, 591],
  [87, 'الأعلى',     "Al-A'la",        19, 30, 0, 591],
  [88, 'الغاشية',    'Al-Ghashiyah',   26, 30, 0, 592],
  [89, 'الفجر',      'Al-Fajr',        30, 30, 0, 593],
  [90, 'البلد',      'Al-Balad',       20, 30, 0, 594],
  [91, 'الشمس',      'Ash-Shams',      15, 30, 0, 595],
  [92, 'الليل',      'Al-Layl',        21, 30, 0, 595],
  [93, 'الضحى',      'Ad-Duha',        11, 30, 0, 596],
  [94, 'الشرح',      'Ash-Sharh',       8, 30, 0, 596],
  [95, 'التين',      'At-Tin',          8, 30, 0, 597],
  [96, 'العلق',      "Al-'Alaq",       19, 30, 0, 597],
  [97, 'القدر',      'Al-Qadr',         5, 30, 0, 598],
  [98, 'البينة',     'Al-Bayyinah',     8, 30, 1, 598],
  [99, 'الزلزلة',    'Az-Zalzalah',     8, 30, 1, 599],
  [100,'العاديات',   "Al-'Adiyat",     11, 30, 0, 599],
  [101,"القارعة",    "Al-Qari'ah",     11, 30, 0, 600],
  [102,'التكاثر',    'At-Takathur',     8, 30, 0, 600],
  [103,'العصر',      "Al-'Asr",         3, 30, 0, 601],
  [104,'الهمزة',     'Al-Humazah',      9, 30, 0, 601],
  [105,'الفيل',      'Al-Fil',          5, 30, 0, 601],
  [106,'قريش',       'Quraysh',         4, 30, 0, 602],
  [107,'الماعون',    "Al-Ma'un",        7, 30, 0, 602],
  [108,'الكوثر',     'Al-Kawthar',      3, 30, 0, 602],
  [109,'الكافرون',   'Al-Kafirun',      6, 30, 0, 603],
  [110,'النصر',      'An-Nasr',         3, 30, 1, 603],
  [111,'المسد',      'Al-Masad',        5, 30, 0, 603],
  [112,'الإخلاص',    'Al-Ikhlas',       4, 30, 0, 604],
  [113,'الفلق',      'Al-Falaq',        5, 30, 0, 604],
  [114,'الناس',      'An-Nas',          6, 30, 0, 604],
];
/* eslint-enable */

// ── SURAHS ────────────────────────────────────────────────────────────────────

export const SURAHS = _RAW.map(([number, name, nameEn, verses, juz, madani, page]) => ({
  number,
  name,
  nameEn,
  verses,
  juz,
  type: madani ? 'مدني' : 'مكي',
  page,
}));

// ── Lookup maps ───────────────────────────────────────────────────────────────

/** O(1) lookup by Arabic name (exact). */
export const SURAH_BY_NAME   = new Map(SURAHS.map(s => [s.name,   s]));

/** O(1) lookup by surah number (1-114). */
export const SURAH_BY_NUMBER = new Map(SURAHS.map(s => [s.number, s]));

// ── JUZ ───────────────────────────────────────────────────────────────────────

/**
 * Juz start boundaries (surah:verse where each juz begins).
 * Used for reference; the heatmap primarily uses surah.juz for grouping.
 */
const _JUZ_STARTS = [
  [1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],
  [7,88],[8,41],[9,93],[11,6],[12,53],[15,1],[17,1],[18,75],
  [21,1],[23,1],[25,21],[27,56],[29,46],[33,31],[36,28],[39,32],
  [41,47],[46,1],[51,31],[58,1],[67,1],[78,1],
];

export const JUZ = Array.from({ length: 30 }, (_, i) => {
  const n = i + 1;
  const [startSurah, startVerse] = _JUZ_STARTS[i];
  return {
    number:     n,
    startSurah,
    startVerse,
    /** Surah numbers whose first verse falls in this juz. */
    surahs: SURAHS.filter(s => s.juz === n).map(s => s.number),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Exact name lookup — returns null on miss. */
export function getSurahByName(name) {
  return SURAH_BY_NAME.get(name) ?? null;
}

/**
 * Fuzzy lookup: strips tashkeel and normalises alef/ta-marbuta variants.
 * Falls back to exact match first for performance.
 */
export function getSurahByNameFuzzy(name) {
  const exact = SURAH_BY_NAME.get(name);
  if (exact) return exact;
  const norm = _normalise(name);
  return SURAHS.find(s => _normalise(s.name) === norm) ?? null;
}

function _normalise(s) {
  return s
    .replace(/[ً-ْٰ]/g, '')  // strip tashkeel + superscript alef
    .replace(/[أإآ]/g, 'ا')                  // unify alef forms
    .replace(/ة/g, 'ه')                      // ta marbuta → ha
    .trim();
}

/** All surah objects whose starting juz equals juzNumber (1-30). */
export function getSurahsInJuz(juzNumber) {
  return SURAHS.filter(s => s.juz === juzNumber);
}

/** Starting juz (1-30) for the given surah number, or null. */
export function getJuzForSurah(surahNumber) {
  return SURAH_BY_NUMBER.get(surahNumber)?.juz ?? null;
}
