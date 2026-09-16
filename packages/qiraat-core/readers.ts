import type { QiraatReader, ReaderId } from './types'

// Canonical ten readers. IDs and colors are permanent (Part 1/2) — never derive a color from an
// Arabic name string, and never renumber.
export const QIRAAT_READERS: readonly QiraatReader[] = [
  { id: 'Q01', nameAr: 'نافع المدني', nameEn: 'Nafi al-Madani', slug: 'nafi-al-madani', color: '#2563EB', sortOrder: 1 },
  { id: 'Q02', nameAr: 'ابن كثير المكي', nameEn: 'Ibn Kathir al-Makki', slug: 'ibn-kathir-al-makki', color: '#16A34A', sortOrder: 2 },
  { id: 'Q03', nameAr: 'أبو عمرو البصري', nameEn: 'Abu Amr al-Basri', slug: 'abu-amr-al-basri', color: '#0891B2', sortOrder: 3 },
  { id: 'Q04', nameAr: 'ابن عامر الشامي', nameEn: 'Ibn Amir ash-Shami', slug: 'ibn-amir-ash-shami', color: '#7C3AED', sortOrder: 4 },
  { id: 'Q05', nameAr: 'عاصم الكوفي', nameEn: 'Asim al-Kufi', slug: 'asim-al-kufi', color: '#EA580C', sortOrder: 5 },
  { id: 'Q06', nameAr: 'حمزة الكوفي', nameEn: 'Hamzah al-Kufi', slug: 'hamzah-al-kufi', color: '#DC2626', sortOrder: 6 },
  { id: 'Q07', nameAr: 'الكسائي الكوفي', nameEn: 'Al-Kisai', slug: 'al-kisai', color: '#DB2777', sortOrder: 7 },
  { id: 'Q08', nameAr: 'أبو جعفر المدني', nameEn: 'Abu Jafar al-Madani', slug: 'abu-jafar-al-madani', color: '#CA8A04', sortOrder: 8 },
  { id: 'Q09', nameAr: 'يعقوب الحضرمي', nameEn: 'Yaqub al-Hadrami', slug: 'yaqub-al-hadrami', color: '#B45309', sortOrder: 9 },
  { id: 'Q10', nameAr: 'خلف العاشر', nameEn: 'Khalaf al-Ashir', slug: 'khalaf-al-ashir', color: '#475569', sortOrder: 10 },
] as const

export const QIRAAT_READER_BY_ID: Readonly<Record<ReaderId, QiraatReader>> = Object.fromEntries(
  QIRAAT_READERS.map((reader) => [reader.id, reader])
) as Record<ReaderId, QiraatReader>

export function getReader(readerId: ReaderId): QiraatReader {
  return QIRAAT_READER_BY_ID[readerId]
}
