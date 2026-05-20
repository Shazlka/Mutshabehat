/**
 * Test fixtures — Mutashabihat database entries
 * Simulates the real app's data structure for Quranic lexical pairs
 */

export const SAMPLE_MUTASHABIHAT = [
  {
    id: "ms-001",
    surah_a: 2,
    ayah_a: 7,
    surah_b: 16,
    ayah_b: 108,
    arabic_a: "خَتَمَ اللَّهُ عَلَىٰ قُلُوبِهِمْ",
    arabic_b: "أُولَٰئِكَ الَّذِينَ طَبَعَ اللَّهُ عَلَىٰ قُلُوبِهِمْ",
    keyword: "ختم / طبع",
    category: "قلب",
    similarity_type: "lexical",
    notes: "كلاهما يفيد الإغلاق على القلب",
    tags: ["قلب", "ختم", "طبع"],
    favorite: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "ms-002",
    surah_a: 4,
    ayah_a: 138,
    surah_b: 4,
    ayah_b: 161,
    arabic_a: "عَذَابٌ أَلِيمٌ",
    arabic_b: "عَذَابٌ عَظِيمٌ",
    keyword: "أليم / عظيم",
    category: "عذاب",
    similarity_type: "contextual",
    notes: "الفرق بين وصف العذاب بالألم ووصفه بالعظمة",
    tags: ["عذاب", "وصف"],
    favorite: true,
    created_at: "2024-01-02T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
  },
  {
    id: "ms-003",
    surah_a: 2,
    ayah_a: 10,
    surah_b: 9,
    ayah_b: 61,
    arabic_a: "وَلَهُمْ عَذَابٌ أَلِيمٌ بِمَا كَانُوا يَكْذِبُونَ",
    arabic_b: "وَلَهُمْ عَذَابٌ أَلِيمٌ",
    keyword: "يكذبون",
    category: "عذاب",
    similarity_type: "structural",
    notes: "تشابه في البنية النحوية",
    tags: ["عذاب", "كذب"],
    favorite: false,
    created_at: "2024-01-03T00:00:00Z",
    updated_at: "2024-01-03T00:00:00Z",
  },
];

export const SAMPLE_SETTINGS = {
  theme: "dark",
  language: "ar",
  fontSize: "medium",
  direction: "rtl",
  font: "Amiri",
  autoSave: true,
  syncEnabled: false,
  exportFormat: "json",
  showTashkeel: true,
  highlightKeywords: true,
};

export const SAMPLE_EXPORT_JSON = JSON.stringify(SAMPLE_MUTASHABIHAT, null, 2);

export const EMPTY_DB = [];

export const LARGE_DB = Array.from({ length: 200 }, (_, i) => ({
  id: `ms-${String(i + 100).padStart(4, "0")}`,
  surah_a: Math.floor(Math.random() * 114) + 1,
  ayah_a: Math.floor(Math.random() * 286) + 1,
  surah_b: Math.floor(Math.random() * 114) + 1,
  ayah_b: Math.floor(Math.random() * 286) + 1,
  keyword: `كلمة-${i}`,
  category: ["قلب", "عذاب", "رحمة", "نعمة", "إيمان"][i % 5],
  similarity_type: ["lexical", "contextual", "structural"][i % 3],
  notes: `ملاحظة رقم ${i}`,
  tags: [],
  favorite: i % 7 === 0,
  created_at: new Date(2024, 0, i + 1).toISOString(),
  updated_at: new Date(2024, 0, i + 1).toISOString(),
}));
