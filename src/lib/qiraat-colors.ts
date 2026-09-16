/**
 * Canonical Color Taxonomy for the Ten Qira'at (القراءات العشر)
 *
 * Each Imam has a distinct primary color hue, and their two primary narrators (Ruwat)
 * inherit cohesive shades within that hue family.
 */

export const QIRAAT_COLORS = {
  nafi: {
    name: "نافع المدني",
    color: "#2563EB",
    narrators: {
      qalun: { name: "قالون", color: "#60A5FA" },
      warsh: { name: "ورش", color: "#1D4ED8" }
    }
  },

  ibnKathir: {
    name: "ابن كثير المكي",
    color: "#16A34A",
    narrators: {
      alBazzi: { name: "البزي", color: "#4ADE80" },
      qunbul: { name: "قنبل", color: "#15803D" }
    }
  },

  abuAmr: {
    name: "أبو عمرو البصري",
    color: "#0891B2",
    narrators: {
      alDuri: { name: "الدوري", color: "#67E8F9" },
      alSusi: { name: "السوسي", color: "#0E7490" }
    }
  },

  ibnAmir: {
    name: "ابن عامر الشامي",
    color: "#7C3AED",
    narrators: {
      hisham: { name: "هشام", color: "#A78BFA" },
      ibnDhakwan: { name: "ابن ذكوان", color: "#6D28D9" }
    }
  },

  asim: {
    name: "عاصم الكوفي",
    color: "#EA580C",
    narrators: {
      shubah: { name: "شعبة", color: "#FB923C" },
      hafs: { name: "حفص", color: "#C2410C" }
    }
  },

  hamzah: {
    name: "حمزة الكوفي",
    color: "#DC2626",
    narrators: {
      khalaf: { name: "خلف", color: "#F87171" },
      khallad: { name: "خلاد", color: "#B91C1C" }
    }
  },

  alKisai: {
    name: "الكسائي الكوفي",
    color: "#DB2777",
    narrators: {
      abuAlHarith: { name: "أبو الحارث", color: "#F472B6" },
      alDuri: { name: "الدوري", color: "#BE185D" }
    }
  },

  abuJafar: {
    name: "أبو جعفر المدني",
    color: "#CA8A04",
    narrators: {
      ibnWardan: { name: "ابن وردان", color: "#FACC15" },
      ibnJammaz: { name: "ابن جماز", color: "#A16207" }
    }
  },

  yaqub: {
    name: "يعقوب الحضرمي",
    color: "#B45309",
    narrators: {
      ruways: { name: "رويس", color: "#F59E0B" },
      rawh: { name: "روح", color: "#92400E" }
    }
  },

  khalafAlAshir: {
    name: "خلف العاشر",
    color: "#475569",
    narrators: {
      ishaq: { name: "إسحاق", color: "#94A3B8" },
      idris: { name: "إدريس", color: "#334155" }
    }
  }
} as const

export interface QiraatColorToken {
  color: string
  bg: string
  border: string
  name: string
  isImam: boolean
  isRawi: boolean
}

// Convert 6-char hex to RGBA background and border tints
function hexToColorToken(hex: string, name: string, isImam = false, isRawi = false): QiraatColorToken {
  // Normalize hex (e.g. #2563EB)
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)

  return {
    color: hex,
    bg: `rgba(${r}, ${g}, ${b}, 0.12)`,
    border: `rgba(${r}, ${g}, ${b}, 0.35)`,
    name,
    isImam,
    isRawi,
  }
}

// Lookup registry mapping Database IDs, Arabic names, and English keys to color tokens
const COLOR_REGISTRY: Record<string, QiraatColorToken> = {
  // Nafi
  NAFI: hexToColorToken(QIRAAT_COLORS.nafi.color, QIRAAT_COLORS.nafi.name, true, false),
  QALUN: hexToColorToken(QIRAAT_COLORS.nafi.narrators.qalun.color, QIRAAT_COLORS.nafi.narrators.qalun.name, false, true),
  WARSH: hexToColorToken(QIRAAT_COLORS.nafi.narrators.warsh.color, QIRAAT_COLORS.nafi.narrators.warsh.name, false, true),
  'نافع': hexToColorToken(QIRAAT_COLORS.nafi.color, QIRAAT_COLORS.nafi.name, true, false),
  'الإمام نافع': hexToColorToken(QIRAAT_COLORS.nafi.color, QIRAAT_COLORS.nafi.name, true, false),
  'نافع المدني': hexToColorToken(QIRAAT_COLORS.nafi.color, QIRAAT_COLORS.nafi.name, true, false),
  'قالون': hexToColorToken(QIRAAT_COLORS.nafi.narrators.qalun.color, QIRAAT_COLORS.nafi.narrators.qalun.name, false, true),
  'ورش': hexToColorToken(QIRAAT_COLORS.nafi.narrators.warsh.color, QIRAAT_COLORS.nafi.narrators.warsh.name, false, true),

  // Ibn Kathir
  IBN_KATHIR: hexToColorToken(QIRAAT_COLORS.ibnKathir.color, QIRAAT_COLORS.ibnKathir.name, true, false),
  AL_BAZZI: hexToColorToken(QIRAAT_COLORS.ibnKathir.narrators.alBazzi.color, QIRAAT_COLORS.ibnKathir.narrators.alBazzi.name, false, true),
  QUNBUL: hexToColorToken(QIRAAT_COLORS.ibnKathir.narrators.qunbul.color, QIRAAT_COLORS.ibnKathir.narrators.qunbul.name, false, true),
  'ابن كثير': hexToColorToken(QIRAAT_COLORS.ibnKathir.color, QIRAAT_COLORS.ibnKathir.name, true, false),
  'الإمام ابن كثير': hexToColorToken(QIRAAT_COLORS.ibnKathir.color, QIRAAT_COLORS.ibnKathir.name, true, false),
  'ابن كثير المكي': hexToColorToken(QIRAAT_COLORS.ibnKathir.color, QIRAAT_COLORS.ibnKathir.name, true, false),
  'البزي': hexToColorToken(QIRAAT_COLORS.ibnKathir.narrators.alBazzi.color, QIRAAT_COLORS.ibnKathir.narrators.alBazzi.name, false, true),
  'قنبل': hexToColorToken(QIRAAT_COLORS.ibnKathir.narrators.qunbul.color, QIRAAT_COLORS.ibnKathir.narrators.qunbul.name, false, true),

  // Abu Amr
  ABU_AMR: hexToColorToken(QIRAAT_COLORS.abuAmr.color, QIRAAT_COLORS.abuAmr.name, true, false),
  AL_DURI: hexToColorToken(QIRAAT_COLORS.abuAmr.narrators.alDuri.color, QIRAAT_COLORS.abuAmr.narrators.alDuri.name, false, true),
  AL_DURI_ABU_AMR: hexToColorToken(QIRAAT_COLORS.abuAmr.narrators.alDuri.color, QIRAAT_COLORS.abuAmr.narrators.alDuri.name, false, true),
  AL_SUSI: hexToColorToken(QIRAAT_COLORS.abuAmr.narrators.alSusi.color, QIRAAT_COLORS.abuAmr.narrators.alSusi.name, false, true),
  'أبو عمرو': hexToColorToken(QIRAAT_COLORS.abuAmr.color, QIRAAT_COLORS.abuAmr.name, true, false),
  'الإمام أبو عمرو': hexToColorToken(QIRAAT_COLORS.abuAmr.color, QIRAAT_COLORS.abuAmr.name, true, false),
  'أبو عمرو البصري': hexToColorToken(QIRAAT_COLORS.abuAmr.color, QIRAAT_COLORS.abuAmr.name, true, false),
  'الدوري عن أبي عمرو': hexToColorToken(QIRAAT_COLORS.abuAmr.narrators.alDuri.color, QIRAAT_COLORS.abuAmr.narrators.alDuri.name, false, true),
  'السوسي': hexToColorToken(QIRAAT_COLORS.abuAmr.narrators.alSusi.color, QIRAAT_COLORS.abuAmr.narrators.alSusi.name, false, true),

  // Ibn Amir
  IBN_AMIR: hexToColorToken(QIRAAT_COLORS.ibnAmir.color, QIRAAT_COLORS.ibnAmir.name, true, false),
  HISHAM: hexToColorToken(QIRAAT_COLORS.ibnAmir.narrators.hisham.color, QIRAAT_COLORS.ibnAmir.narrators.hisham.name, false, true),
  IBN_DHAKWAN: hexToColorToken(QIRAAT_COLORS.ibnAmir.narrators.ibnDhakwan.color, QIRAAT_COLORS.ibnAmir.narrators.ibnDhakwan.name, false, true),
  'ابن عامر': hexToColorToken(QIRAAT_COLORS.ibnAmir.color, QIRAAT_COLORS.ibnAmir.name, true, false),
  'الإمام ابن عامر': hexToColorToken(QIRAAT_COLORS.ibnAmir.color, QIRAAT_COLORS.ibnAmir.name, true, false),
  'ابن عامر الشامي': hexToColorToken(QIRAAT_COLORS.ibnAmir.color, QIRAAT_COLORS.ibnAmir.name, true, false),
  'هشام': hexToColorToken(QIRAAT_COLORS.ibnAmir.narrators.hisham.color, QIRAAT_COLORS.ibnAmir.narrators.hisham.name, false, true),
  'ابن ذكوان': hexToColorToken(QIRAAT_COLORS.ibnAmir.narrators.ibnDhakwan.color, QIRAAT_COLORS.ibnAmir.narrators.ibnDhakwan.name, false, true),

  // Asim
  ASIM: hexToColorToken(QIRAAT_COLORS.asim.color, QIRAAT_COLORS.asim.name, true, false),
  SHUBAH: hexToColorToken(QIRAAT_COLORS.asim.narrators.shubah.color, QIRAAT_COLORS.asim.narrators.shubah.name, false, true),
  HAFS: hexToColorToken(QIRAAT_COLORS.asim.narrators.hafs.color, QIRAAT_COLORS.asim.narrators.hafs.name, false, true),
  'عاصم': hexToColorToken(QIRAAT_COLORS.asim.color, QIRAAT_COLORS.asim.name, true, false),
  'الإمام عاصم': hexToColorToken(QIRAAT_COLORS.asim.color, QIRAAT_COLORS.asim.name, true, false),
  'عاصم الكوفي': hexToColorToken(QIRAAT_COLORS.asim.color, QIRAAT_COLORS.asim.name, true, false),
  'شعبة': hexToColorToken(QIRAAT_COLORS.asim.narrators.shubah.color, QIRAAT_COLORS.asim.narrators.shubah.name, false, true),
  'حفص': hexToColorToken(QIRAAT_COLORS.asim.narrators.hafs.color, QIRAAT_COLORS.asim.narrators.hafs.name, false, true),

  // Hamzah
  HAMZA: hexToColorToken(QIRAAT_COLORS.hamzah.color, QIRAAT_COLORS.hamzah.name, true, false),
  HAMZAH: hexToColorToken(QIRAAT_COLORS.hamzah.color, QIRAAT_COLORS.hamzah.name, true, false),
  KHALAF_HAMZA: hexToColorToken(QIRAAT_COLORS.hamzah.narrators.khalaf.color, 'خلف عن حمزة', false, true),
  KHALLAD: hexToColorToken(QIRAAT_COLORS.hamzah.narrators.khallad.color, QIRAAT_COLORS.hamzah.narrators.khallad.name, false, true),
  'حمزة': hexToColorToken(QIRAAT_COLORS.hamzah.color, QIRAAT_COLORS.hamzah.name, true, false),
  'الإمام حمزة': hexToColorToken(QIRAAT_COLORS.hamzah.color, QIRAAT_COLORS.hamzah.name, true, false),
  'حمزة الكوفي': hexToColorToken(QIRAAT_COLORS.hamzah.color, QIRAAT_COLORS.hamzah.name, true, false),
  'خلف عن حمزة': hexToColorToken(QIRAAT_COLORS.hamzah.narrators.khalaf.color, 'خلف عن حمزة', false, true),
  'خلاد': hexToColorToken(QIRAAT_COLORS.hamzah.narrators.khallad.color, QIRAAT_COLORS.hamzah.narrators.khallad.name, false, true),

  // Al-Kisai
  AL_KISAI: hexToColorToken(QIRAAT_COLORS.alKisai.color, QIRAAT_COLORS.alKisai.name, true, false),
  ABU_AL_HARITH: hexToColorToken(QIRAAT_COLORS.alKisai.narrators.abuAlHarith.color, QIRAAT_COLORS.alKisai.narrators.abuAlHarith.name, false, true),
  AL_DURI_KISAI: hexToColorToken(QIRAAT_COLORS.alKisai.narrators.alDuri.color, 'الدوري عن الكسائي', false, true),
  'الكسائي': hexToColorToken(QIRAAT_COLORS.alKisai.color, QIRAAT_COLORS.alKisai.name, true, false),
  'الإمام الكسائي': hexToColorToken(QIRAAT_COLORS.alKisai.color, QIRAAT_COLORS.alKisai.name, true, false),
  'الكسائي الكوفي': hexToColorToken(QIRAAT_COLORS.alKisai.color, QIRAAT_COLORS.alKisai.name, true, false),
  'أبو الحارث': hexToColorToken(QIRAAT_COLORS.alKisai.narrators.abuAlHarith.color, QIRAAT_COLORS.alKisai.narrators.abuAlHarith.name, false, true),
  'الدوري عن الكسائي': hexToColorToken(QIRAAT_COLORS.alKisai.narrators.alDuri.color, 'الدوري عن الكسائي', false, true),

  // Abu Ja'far
  ABU_JAFAR: hexToColorToken(QIRAAT_COLORS.abuJafar.color, QIRAAT_COLORS.abuJafar.name, true, false),
  IBN_WARDAN: hexToColorToken(QIRAAT_COLORS.abuJafar.narrators.ibnWardan.color, QIRAAT_COLORS.abuJafar.narrators.ibnWardan.name, false, true),
  IBN_JAMMAZ: hexToColorToken(QIRAAT_COLORS.abuJafar.narrators.ibnJammaz.color, QIRAAT_COLORS.abuJafar.narrators.ibnJammaz.name, false, true),
  'أبو جعفر': hexToColorToken(QIRAAT_COLORS.abuJafar.color, QIRAAT_COLORS.abuJafar.name, true, false),
  'الإمام أبو جعفر': hexToColorToken(QIRAAT_COLORS.abuJafar.color, QIRAAT_COLORS.abuJafar.name, true, false),
  'أبو جعفر المدني': hexToColorToken(QIRAAT_COLORS.abuJafar.color, QIRAAT_COLORS.abuJafar.name, true, false),
  'ابن وردان': hexToColorToken(QIRAAT_COLORS.abuJafar.narrators.ibnWardan.color, QIRAAT_COLORS.abuJafar.narrators.ibnWardan.name, false, true),
  'ابن جماز': hexToColorToken(QIRAAT_COLORS.abuJafar.narrators.ibnJammaz.color, QIRAAT_COLORS.abuJafar.narrators.ibnJammaz.name, false, true),

  // Yaqub
  YAQUB: hexToColorToken(QIRAAT_COLORS.yaqub.color, QIRAAT_COLORS.yaqub.name, true, false),
  RUWAYS: hexToColorToken(QIRAAT_COLORS.yaqub.narrators.ruways.color, QIRAAT_COLORS.yaqub.narrators.ruways.name, false, true),
  RAWH: hexToColorToken(QIRAAT_COLORS.yaqub.narrators.rawh.color, QIRAAT_COLORS.yaqub.narrators.rawh.name, false, true),
  'يعقوب': hexToColorToken(QIRAAT_COLORS.yaqub.color, QIRAAT_COLORS.yaqub.name, true, false),
  'الإمام يعقوب': hexToColorToken(QIRAAT_COLORS.yaqub.color, QIRAAT_COLORS.yaqub.name, true, false),
  'يعقوب الحضرمي': hexToColorToken(QIRAAT_COLORS.yaqub.color, QIRAAT_COLORS.yaqub.name, true, false),
  'رويس': hexToColorToken(QIRAAT_COLORS.yaqub.narrators.ruways.color, QIRAAT_COLORS.yaqub.narrators.ruways.name, false, true),
  'روح': hexToColorToken(QIRAAT_COLORS.yaqub.narrators.rawh.color, QIRAAT_COLORS.yaqub.narrators.rawh.name, false, true),

  // Khalaf al-Ashir
  KHALAF_ASHIR: hexToColorToken(QIRAAT_COLORS.khalafAlAshir.color, QIRAAT_COLORS.khalafAlAshir.name, true, false),
  ISHAQ: hexToColorToken(QIRAAT_COLORS.khalafAlAshir.narrators.ishaq.color, QIRAAT_COLORS.khalafAlAshir.narrators.ishaq.name, false, true),
  IDRIS: hexToColorToken(QIRAAT_COLORS.khalafAlAshir.narrators.idris.color, QIRAAT_COLORS.khalafAlAshir.narrators.idris.name, false, true),
  'خلف العاشر': hexToColorToken(QIRAAT_COLORS.khalafAlAshir.color, QIRAAT_COLORS.khalafAlAshir.name, true, false),
  'الإمام خلف العاشر': hexToColorToken(QIRAAT_COLORS.khalafAlAshir.color, QIRAAT_COLORS.khalafAlAshir.name, true, false),
  'إسحاق': hexToColorToken(QIRAAT_COLORS.khalafAlAshir.narrators.ishaq.color, QIRAAT_COLORS.khalafAlAshir.narrators.ishaq.name, false, true),
  'إدريس': hexToColorToken(QIRAAT_COLORS.khalafAlAshir.narrators.idris.color, QIRAAT_COLORS.khalafAlAshir.narrators.idris.name, false, true),

  // Composites / Groups
  AL_JUMHUR: hexToColorToken('#475569', 'الجمهور', false, false),
  AL_BAQUN: hexToColorToken('#475569', 'الباقون', false, false),
  'الجمهور': hexToColorToken('#475569', 'الجمهور', false, false),
  'الباقون': hexToColorToken('#475569', 'الباقون', false, false),
}

/**
 * Returns the exact color styling token for an Imam or Narrator.
 * Accepts database IDs (e.g. 'ASIM', 'QUNBUL'), Arabic names ('عاصم', 'قنبل'), or English keys.
 * Handles disambiguation for Khalaf (Hamzah rawi vs 10th Imam) and Al-Duri (Abu Amr vs Al-Kisai).
 */
export function getQiraatPersonColor(
  identifier?: string | null,
  role?: string,
  personType?: string,
  parentPersonId?: string | null
): QiraatColorToken {
  if (!identifier) {
    return hexToColorToken('#64748B', 'غير محدد')
  }

  const trimmed = identifier.trim()
  const upper = trimmed.toUpperCase()

  // Disambiguation for "خلف"
  if (trimmed === 'خلف' || upper === 'KHALAF') {
    if (parentPersonId === 'HAMZA' || role === 'rawi' || personType === 'rawi') {
      return COLOR_REGISTRY.KHALAF_HAMZA
    }
    return COLOR_REGISTRY.KHALAF_ASHIR
  }

  // Disambiguation for "الدوري"
  if (trimmed === 'الدوري' || upper === 'AL_DURI') {
    if (parentPersonId === 'AL_KISAI') {
      return COLOR_REGISTRY.AL_DURI_KISAI
    }
    return COLOR_REGISTRY.AL_DURI
  }

  // Direct lookup
  if (COLOR_REGISTRY[trimmed]) {
    return COLOR_REGISTRY[trimmed]
  }

  // Case-insensitive lookup for IDs
  if (COLOR_REGISTRY[upper]) {
    return COLOR_REGISTRY[upper]
  }

  // Fallback default
  return hexToColorToken('#64748B', trimmed, personType === 'imam' || role === 'imam', personType === 'rawi' || role === 'rawi')
}
