import type { NarratorId, QiraatNarrator } from './types'

// Canonical twenty narrators (two per reader). IDs are permanent (Part 1/2).
//
// IMPORTANT: Q03-R01 ("الدوري عن أبي عمرو") and Q07-R02 ("الدوري عن الكسائي") are two different
// people who both happen to be called "الدوري". Never identify either by the bare string
// "الدوري" — always use the full canonical ID or the disambiguated display name.
export const QIRAAT_NARRATORS: readonly QiraatNarrator[] = [
  { id: 'Q01-R01', readerId: 'Q01', nameAr: 'قالون', nameEn: 'Qalun', slug: 'qalun', color: '#60A5FA', sortOrder: 1 },
  { id: 'Q01-R02', readerId: 'Q01', nameAr: 'ورش', nameEn: 'Warsh', slug: 'warsh', color: '#1D4ED8', sortOrder: 2 },

  { id: 'Q02-R01', readerId: 'Q02', nameAr: 'البزي', nameEn: 'Al-Bazzi', slug: 'al-bazzi', color: '#4ADE80', sortOrder: 1 },
  { id: 'Q02-R02', readerId: 'Q02', nameAr: 'قنبل', nameEn: 'Qunbul', slug: 'qunbul', color: '#15803D', sortOrder: 2 },

  { id: 'Q03-R01', readerId: 'Q03', nameAr: 'الدوري عن أبي عمرو', nameEn: 'Al-Duri (an Abi Amr)', slug: 'al-duri-an-abi-amr', color: '#67E8F9', sortOrder: 1 },
  { id: 'Q03-R02', readerId: 'Q03', nameAr: 'السوسي', nameEn: 'Al-Susi', slug: 'al-susi', color: '#0E7490', sortOrder: 2 },

  { id: 'Q04-R01', readerId: 'Q04', nameAr: 'هشام', nameEn: 'Hisham', slug: 'hisham', color: '#A78BFA', sortOrder: 1 },
  { id: 'Q04-R02', readerId: 'Q04', nameAr: 'ابن ذكوان', nameEn: 'Ibn Dhakwan', slug: 'ibn-dhakwan', color: '#6D28D9', sortOrder: 2 },

  { id: 'Q05-R01', readerId: 'Q05', nameAr: 'شعبة', nameEn: "Shu'bah", slug: 'shubah', color: '#FB923C', sortOrder: 1 },
  { id: 'Q05-R02', readerId: 'Q05', nameAr: 'حفص', nameEn: 'Hafs', slug: 'hafs', color: '#C2410C', sortOrder: 2 },

  { id: 'Q06-R01', readerId: 'Q06', nameAr: 'خلف', nameEn: 'Khalaf', slug: 'khalaf-an-hamzah', color: '#F87171', sortOrder: 1 },
  { id: 'Q06-R02', readerId: 'Q06', nameAr: 'خلاد', nameEn: 'Khallad', slug: 'khallad', color: '#B91C1C', sortOrder: 2 },

  { id: 'Q07-R01', readerId: 'Q07', nameAr: 'أبو الحارث', nameEn: 'Abu al-Harith', slug: 'abu-al-harith', color: '#F472B6', sortOrder: 1 },
  { id: 'Q07-R02', readerId: 'Q07', nameAr: 'الدوري عن الكسائي', nameEn: 'Al-Duri (an al-Kisai)', slug: 'al-duri-an-al-kisai', color: '#BE185D', sortOrder: 2 },

  { id: 'Q08-R01', readerId: 'Q08', nameAr: 'ابن وردان', nameEn: 'Ibn Wardan', slug: 'ibn-wardan', color: '#FACC15', sortOrder: 1 },
  { id: 'Q08-R02', readerId: 'Q08', nameAr: 'ابن جماز', nameEn: 'Ibn Jammaz', slug: 'ibn-jammaz', color: '#A16207', sortOrder: 2 },

  { id: 'Q09-R01', readerId: 'Q09', nameAr: 'رويس', nameEn: 'Ruways', slug: 'ruways', color: '#F59E0B', sortOrder: 1 },
  { id: 'Q09-R02', readerId: 'Q09', nameAr: 'روح', nameEn: 'Rawh', slug: 'rawh', color: '#92400E', sortOrder: 2 },

  { id: 'Q10-R01', readerId: 'Q10', nameAr: 'إسحاق', nameEn: 'Ishaq', slug: 'ishaq', color: '#94A3B8', sortOrder: 1 },
  { id: 'Q10-R02', readerId: 'Q10', nameAr: 'إدريس', nameEn: 'Idris', slug: 'idris', color: '#334155', sortOrder: 2 },
] as const

export const QIRAAT_NARRATOR_BY_ID: Readonly<Record<NarratorId, QiraatNarrator>> = Object.fromEntries(
  QIRAAT_NARRATORS.map((narrator) => [narrator.id, narrator])
) as Record<NarratorId, QiraatNarrator>

export function getNarrator(narratorId: NarratorId): QiraatNarrator {
  return QIRAAT_NARRATOR_BY_ID[narratorId]
}

export function narratorsOfReader(readerId: string): QiraatNarrator[] {
  return QIRAAT_NARRATORS.filter((narrator) => narrator.readerId === readerId)
}
