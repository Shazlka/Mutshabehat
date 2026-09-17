export type MushafTheme = 'sepia' | 'dark' | 'white'

export const MUSHAF_THEME_STORAGE_KEY = 'mushaf1441:theme:v1'

export interface MushafThemeTokens {
  id: MushafTheme
  nameAr: string
  nameArShort: string
  descriptionAr: string

  // Root viewer container
  viewerBgClass: string

  // Top header chrome
  headerBgClass: string
  headerTitleClass: string
  headerSubClass: string
  headerBtnClass: string
  headerPageFrameClass: string
  headerPageFrameLabelClass: string
  headerPageFrameNumClass: string

  // Mushaf page paper & borders
  pageBg: string
  pageBorderClass: string
  pageShadowClass: string
  textPrimaryClass: string
  textPrimaryHex: string

  // Page margins (Juz / Hizb / Rub / Surah / Page No)
  marginMetaClass: string
  marginPageNoClass: string
  sideTabClass: string

  // Word selection & interactions
  wordDefaultTextClass: string
  wordHoverClass: string
  wordActiveClass: string
  wordSelectedClass: string
  wordHighlightedAyahClass: string
  selectionBg: string

  // Spine shading in two-page spread
  spineGradientRight: string
  spineGradientLeft: string

  // Page skeleton
  skeletonBoneClass: string

  // Empty page fallback
  emptyPageNumClass: string
  emptyPageTextClass: string

  // Surah header banner SVG styling
  surahBanner: {
    goldGradient: [string, string]
    panelGradient: [string, string]
    latticeStroke: string
    latticeOpacity: number
    innerRuleStroke: string
    innerRuleOpacity: number
    cartoucheFill: string
    cartoucheInnerStroke: string
    cartoucheInnerOpacity: number
    medallionFill: string
    medallionStroke: string
    medallionText: string
    surahNameColor: string
  }

  // Basmala styling
  basmalaTextClass: string

  // Bottom quick slider
  sliderContainerClass: string
  sliderTrackClass: string
  sliderThumbColor: string
  sliderTextClass: string
  sliderPreviewClass: string
  sliderPreviewTextClass: string
  sliderPreviewSubClass: string

  // Side rail (desktop / iPad landscape)
  sidebarContainerClass: string
  sidebarTitleClass: string
  sidebarCardClass: string
  sidebarSubtextClass: string

  // Burger menu drawer
  drawerAsideClass: string
  drawerHeaderSubClass: string
  drawerCloseBtnClass: string
  drawerCardClass: string
  drawerCardAltClass: string
  drawerTitleClass: string
  drawerSubtextClass: string
}

export const THEME_TOKENS: Record<MushafTheme, MushafThemeTokens> = {
  sepia: {
    id: 'sepia',
    nameAr: 'ورق دافئ (المظهر الكلاسيكي)',
    nameArShort: 'ورق دافئ',
    descriptionAr: 'محاكاة ورق المصحف الكلاسيكي المطبوع بنقاء ولمسات ذهبية دافئة.',

    viewerBgClass: 'bg-[#efe7d6] text-[#171717]',

    headerBgClass: 'border-[#d7c7a7] bg-[#f7f0e0]',
    headerTitleClass: 'text-[#171717]',
    headerSubClass: 'text-[#80662c]',
    headerBtnClass: 'border-[#b99b51] text-[#3f3215] hover:bg-[#fff9e9]',
    headerPageFrameClass: 'border-[#b99b51] bg-[#fffaf0]',
    headerPageFrameLabelClass: 'text-[#80662c]',
    headerPageFrameNumClass: 'text-[#3f3215]',

    pageBg: '#fffdf6',
    pageBorderClass: 'sm:border sm:border-[#e2d4b3]',
    pageShadowClass: 'shadow-[0_8px_30px_rgba(63,49,21,0.12)]',
    textPrimaryClass: 'text-[#171717]',
    textPrimaryHex: '#171717',

    marginMetaClass: 'text-[#9a7b35]',
    marginPageNoClass: 'text-[#59461d]',
    sideTabClass: 'bg-[#b8871d] text-white',

    wordDefaultTextClass: 'text-[#171717]',
    wordHoverClass: 'hover:bg-[#f3ecd9]',
    wordActiveClass: 'active:bg-[#e3d8bc]',
    wordSelectedClass: 'bg-[#ece2c8] text-[#171717] ring-1 ring-[#d8c9a3]',
    wordHighlightedAyahClass: 'bg-[#ece2c8] text-[#171717]',
    selectionBg: '#ece2c8',

    spineGradientRight: 'linear-gradient(to right, rgba(63,49,21,0.10), transparent)',
    spineGradientLeft: 'linear-gradient(to left, rgba(63,49,21,0.10), transparent)',

    skeletonBoneClass: 'bg-[#efe4c9]',

    emptyPageNumClass: 'text-[#80662c]',
    emptyPageTextClass: 'text-[#665b48]',

    surahBanner: {
      goldGradient: ['#d6ad55', '#9c7016'],
      panelGradient: ['#fbf0d2', '#efd9a0'],
      latticeStroke: '#9c7016',
      latticeOpacity: 0.16,
      innerRuleStroke: '#9c7016',
      innerRuleOpacity: 0.42,
      cartoucheFill: '#fffdf6',
      cartoucheInnerStroke: '#b8871d',
      cartoucheInnerOpacity: 0.38,
      medallionFill: '#fffdf6',
      medallionStroke: '#b8871d',
      medallionText: '#6b531f',
      surahNameColor: '#4a3a17',
    },

    basmalaTextClass: 'text-[#171717]',

    sliderContainerClass: 'border-[#d7c7a7] bg-[#f7f0e0]',
    sliderTrackClass: 'bg-[#e6d8b6]',
    sliderThumbColor: '#171717',
    sliderTextClass: 'text-[#59461d]',
    sliderPreviewClass: 'border-[#b8871d] bg-[#171717]',
    sliderPreviewTextClass: 'text-white',
    sliderPreviewSubClass: 'text-[#e6d8b6]',

    sidebarContainerClass: 'border-[#d7c7a7] bg-[#f7f0e0]',
    sidebarTitleClass: 'text-[#171717]',
    sidebarCardClass: 'border-[#d7c7a7] bg-white text-[#171717]',
    sidebarSubtextClass: 'text-[#665b48]',

    drawerAsideClass: 'border-[#d7c7a7] bg-[#fffdf8] text-[#171717]',
    drawerHeaderSubClass: 'text-[#80662c]',
    drawerCloseBtnClass: 'border-[#d7c7a7] text-[#59461d] hover:bg-[#fff7df]',
    drawerCardClass: 'border-[#d7c7a7] bg-[#fffaf0]',
    drawerCardAltClass: 'border-[#d7c7a7] bg-white',
    drawerTitleClass: 'text-[#171717]',
    drawerSubtextClass: 'text-[#665b48]',
  },

  dark: {
    id: 'dark',
    nameAr: 'الوضع الداكن (ليلي)',
    nameArShort: 'ليلي داكن',
    descriptionAr: 'صفحات فحمية هادئة مع نصوص عاجية مريحة للعين في الإضاءة الخافتة وتذهيب رصين.',

    viewerBgClass: 'bg-[#0f1013] text-[#f1f5f9]',

    headerBgClass: 'border-[#26272c] bg-[#16171a]',
    headerTitleClass: 'text-[#f1f5f9]',
    headerSubClass: 'text-[#c8a86b]',
    headerBtnClass: 'border-[#3f4046] text-[#e2e8f0] hover:bg-[#25262c]',
    headerPageFrameClass: 'border-[#3f4046] bg-[#1e1f24]',
    headerPageFrameLabelClass: 'text-[#c8a86b]',
    headerPageFrameNumClass: 'text-[#f1f5f9]',

    pageBg: '#18191d',
    pageBorderClass: 'sm:border sm:border-[#2a2b30]',
    pageShadowClass: 'shadow-[0_14px_45px_rgba(0,0,0,0.60)]',
    textPrimaryClass: 'text-[#f1f5f9]',
    textPrimaryHex: '#f1f5f9',

    marginMetaClass: 'text-[#c8a86b]',
    marginPageNoClass: 'text-[#c8a86b]',
    sideTabClass: 'bg-[#2a2b30] text-[#c8a86b] border border-[#3f4046]',

    wordDefaultTextClass: 'text-[#f1f5f9]',
    wordHoverClass: 'hover:bg-[#262830]',
    wordActiveClass: 'active:bg-[#323540]',
    wordSelectedClass: 'bg-[#3a3522] text-[#fef08a] ring-1 ring-[#ca8a04]',
    wordHighlightedAyahClass: 'bg-[#2a281e] text-[#fef9c3]',
    selectionBg: '#2a281e',

    spineGradientRight: 'linear-gradient(to right, rgba(0,0,0,0.45), transparent)',
    spineGradientLeft: 'linear-gradient(to left, rgba(0,0,0,0.45), transparent)',

    skeletonBoneClass: 'bg-[#26272d]',

    emptyPageNumClass: 'text-[#c8a86b]',
    emptyPageTextClass: 'text-[#94a3b8]',

    surahBanner: {
      goldGradient: ['#c8a86b', '#806020'],
      panelGradient: ['#25262c', '#1c1d22'],
      latticeStroke: '#c8a86b',
      latticeOpacity: 0.20,
      innerRuleStroke: '#c8a86b',
      innerRuleOpacity: 0.35,
      cartoucheFill: '#18191d',
      cartoucheInnerStroke: '#c8a86b',
      cartoucheInnerOpacity: 0.35,
      medallionFill: '#18191d',
      medallionStroke: '#c8a86b',
      medallionText: '#e2d5b5',
      surahNameColor: '#f5eed9',
    },

    basmalaTextClass: 'text-[#f1f5f9]',

    sliderContainerClass: 'border-[#26272c] bg-[#16171a]',
    sliderTrackClass: 'bg-[#2a2b32]',
    sliderThumbColor: '#c8a86b',
    sliderTextClass: 'text-[#c8a86b]',
    sliderPreviewClass: 'border-[#c8a86b] bg-[#1f2026]',
    sliderPreviewTextClass: 'text-[#f1f5f9]',
    sliderPreviewSubClass: 'text-[#c8a86b]',

    sidebarContainerClass: 'border-[#26272c] bg-[#141518]',
    sidebarTitleClass: 'text-[#f1f5f9]',
    sidebarCardClass: 'border-[#2a2b30] bg-[#1c1d22] text-[#f1f5f9]',
    sidebarSubtextClass: 'text-[#94a3b8]',

    drawerAsideClass: 'border-[#2a2b30] bg-[#16171b] text-[#f1f5f9]',
    drawerHeaderSubClass: 'text-[#c8a86b]',
    drawerCloseBtnClass: 'border-[#3f4046] text-[#e2e8f0] hover:bg-[#25262c]',
    drawerCardClass: 'border-[#2a2b30] bg-[#1f2026]',
    drawerCardAltClass: 'border-[#2a2b30] bg-[#1a1b20]',
    drawerTitleClass: 'text-[#f1f5f9]',
    drawerSubtextClass: 'text-[#94a3b8]',
  },

  white: {
    id: 'white',
    nameAr: 'الوضع الفاتح (ورق أبيض)',
    nameArShort: 'ورق أبيض',
    descriptionAr: 'ورق أبيض ناصع مع حبر داكن فائق التباين وتذهيب متوازن وعصري.',

    viewerBgClass: 'bg-[#f4f4f5] text-[#0f172a]',

    headerBgClass: 'border-[#e4e4e7] bg-[#ffffff]',
    headerTitleClass: 'text-[#0f172a]',
    headerSubClass: 'text-[#64748b]',
    headerBtnClass: 'border-[#cbd5e1] text-[#334155] hover:bg-[#f1f5f9]',
    headerPageFrameClass: 'border-[#cbd5e1] bg-[#ffffff]',
    headerPageFrameLabelClass: 'text-[#64748b]',
    headerPageFrameNumClass: 'text-[#0f172a]',

    pageBg: '#ffffff',
    pageBorderClass: 'sm:border sm:border-[#e2e8f0]',
    pageShadowClass: 'shadow-[0_8px_30px_rgba(0,0,0,0.06)]',
    textPrimaryClass: 'text-[#0f172a]',
    textPrimaryHex: '#0f172a',

    marginMetaClass: 'text-[#64748b]',
    marginPageNoClass: 'text-[#64748b]',
    sideTabClass: 'bg-[#0f172a] text-white',

    wordDefaultTextClass: 'text-[#0f172a]',
    wordHoverClass: 'hover:bg-[#f1f5f9]',
    wordActiveClass: 'active:bg-[#e2e8f0]',
    wordSelectedClass: 'bg-[#fef3c7] text-[#0f172a] ring-1 ring-[#fcd34d]',
    wordHighlightedAyahClass: 'bg-[#fef9c3] text-[#0f172a]',
    selectionBg: '#fef9c3',

    spineGradientRight: 'linear-gradient(to right, rgba(0,0,0,0.06), transparent)',
    spineGradientLeft: 'linear-gradient(to left, rgba(0,0,0,0.06), transparent)',

    skeletonBoneClass: 'bg-[#e2e8f0]',

    emptyPageNumClass: 'text-[#475569]',
    emptyPageTextClass: 'text-[#64748b]',

    surahBanner: {
      goldGradient: ['#b8871d', '#8a6515'],
      panelGradient: ['#faf7ee', '#f1ebd9'],
      latticeStroke: '#8a6515',
      latticeOpacity: 0.14,
      innerRuleStroke: '#8a6515',
      innerRuleOpacity: 0.35,
      cartoucheFill: '#ffffff',
      cartoucheInnerStroke: '#b8871d',
      cartoucheInnerOpacity: 0.35,
      medallionFill: '#ffffff',
      medallionStroke: '#b8871d',
      medallionText: '#5c4514',
      surahNameColor: '#2b220c',
    },

    basmalaTextClass: 'text-[#0f172a]',

    sliderContainerClass: 'border-[#e4e4e7] bg-[#ffffff]',
    sliderTrackClass: 'bg-[#e2e8f0]',
    sliderThumbColor: '#0f172a',
    sliderTextClass: 'text-[#475569]',
    sliderPreviewClass: 'border-[#cbd5e1] bg-[#0f172a]',
    sliderPreviewTextClass: 'text-white',
    sliderPreviewSubClass: 'text-[#94a3b8]',

    sidebarContainerClass: 'border-[#e4e4e7] bg-[#f8fafc]',
    sidebarTitleClass: 'text-[#0f172a]',
    sidebarCardClass: 'border-[#e2e8f0] bg-white text-[#0f172a]',
    sidebarSubtextClass: 'text-[#64748b]',

    drawerAsideClass: 'border-[#e2e8f0] bg-[#ffffff] text-[#0f172a]',
    drawerHeaderSubClass: 'text-[#64748b]',
    drawerCloseBtnClass: 'border-[#cbd5e1] text-[#334155] hover:bg-[#f1f5f9]',
    drawerCardClass: 'border-[#e2e8f0] bg-[#f8fafc]',
    drawerCardAltClass: 'border-[#e2e8f0] bg-white',
    drawerTitleClass: 'text-[#0f172a]',
    drawerSubtextClass: 'text-[#64748b]',
  },
}

// Mutshabehat highlight tints per theme
export const MUTSHABEHAT_TINTS_SEPIA = [
  { bg: '#f4eca6', edge: '#c4b23d', text: '#5b4a26' }, // lemon
  { bg: '#d5efc8', edge: '#7dbb63', text: '#2d5a1e' }, // leaf
  { bg: '#c7ebe1', edge: '#55ad98', text: '#1b5a4d' }, // mint
  { bg: '#cde7f6', edge: '#5aa6cc', text: '#225573' }, // sky
  { bg: '#d9dffb', edge: '#7f8fdc', text: '#34458f' }, // periwinkle
  { bg: '#e7d8fa', edge: '#a283dc', text: '#58368f' }, // lavender
  { bg: '#f8d5ee', edge: '#d585bf', text: '#7d2e67' }, // orchid
  { bg: '#e6dcc9', edge: '#ad966c', text: '#594420' }, // sand
] as const

export const MUTSHABEHAT_TINTS_DARK = [
  { bg: 'rgba(234, 179, 8, 0.28)', edge: '#eab308', text: '#fef08a' }, // lemon
  { bg: 'rgba(34, 197, 94, 0.26)', edge: '#4ade80', text: '#bbf7d0' }, // leaf
  { bg: 'rgba(20, 184, 166, 0.26)', edge: '#2dd4bf', text: '#99f6e4' }, // mint
  { bg: 'rgba(14, 165, 233, 0.27)', edge: '#38bdf8', text: '#bae6fd' }, // sky
  { bg: 'rgba(99, 102, 241, 0.29)', edge: '#818cf8', text: '#c7d2fe' }, // periwinkle
  { bg: 'rgba(168, 85, 247, 0.28)', edge: '#c084fc', text: '#e9d5ff' }, // lavender
  { bg: 'rgba(236, 72, 153, 0.28)', edge: '#f472b6', text: '#fbcfe8' }, // orchid
  { bg: 'rgba(217, 180, 130, 0.26)', edge: '#d4af37', text: '#fef3c7' }, // sand
] as const

export const MUTSHABEHAT_TINTS_WHITE = [
  { bg: '#fef9c3', edge: '#ca8a04', text: '#713f12' }, // lemon
  { bg: '#dcfce7', edge: '#16a34a', text: '#14532d' }, // leaf
  { bg: '#ccfbf1', edge: '#0d9488', text: '#115e59' }, // mint
  { bg: '#e0f2fe', edge: '#0284c7', text: '#075985' }, // sky
  { bg: '#e0e7ff', edge: '#4f46e5', text: '#312e81' }, // periwinkle
  { bg: '#f3e8ff', edge: '#9333ea', text: '#581c87' }, // lavender
  { bg: '#fce7f3', edge: '#db2777', text: '#831843' }, // orchid
  { bg: '#f5efe6', edge: '#a88242', text: '#5c4514' }, // sand
] as const

export function tintForGroupWithTheme(key: string | undefined, theme: MushafTheme) {
  const palette = theme === 'dark'
    ? MUTSHABEHAT_TINTS_DARK
    : theme === 'white'
      ? MUTSHABEHAT_TINTS_WHITE
      : MUTSHABEHAT_TINTS_SEPIA

  if (!key) return palette[0]
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return palette[Math.abs(hash) % palette.length]
}

/**
 * Adjusts a ruling/variant color so it glows crisply against dark backgrounds (>= 7:1 contrast).
 */
export function adaptColorForDark(color: string): string {
  if (!color || !color.startsWith('#')) return color
  const hex = color.toLowerCase()
  // High contrast luminous maps for dark theme
  const darkMap: Record<string, string> = {
    '#2563eb': '#60a5fa', // blue -> blue-400
    '#1d4ed8': '#60a5fa',
    '#16a34a': '#4ade80', // green -> green-400
    '#15803d': '#4ade80',
    '#dc2626': '#f87171', // red -> red-400
    '#b91c1c': '#f87171',
    '#7c3aed': '#a78bfa', // purple -> purple-400
    '#6d28d9': '#a78bfa',
    '#0891b2': '#38bdf8', // cyan -> sky-400
    '#0e7490': '#38bdf8',
    '#ca8a04': '#facc15', // gold -> yellow-400
    '#a16207': '#facc15',
    '#db2777': '#f472b6', // magenta -> pink-400
    '#be185d': '#f472b6',
    '#ea580c': '#fb923c', // orange -> orange-400
    '#c2410c': '#fb923c',
    '#4f46e5': '#818cf8', // indigo performance marker -> indigo-400
    '#b45309': '#fbbf24', // yaqub -> amber-400
    '#92400e': '#fbbf24',
    '#475569': '#94a3b8', // khalaf ashir -> slate-400
    '#334155': '#94a3b8',
    '#8a8a8a': '#cbd5e1', // unresolved marker
  }
  return darkMap[hex] ?? color
}

/**
 * In dark mode, adapts annotation background and text color to maintain
 * readability without harsh glare or washed-out text.
 */
export function adaptAnnotationForDark(annotation: { backgroundColor?: string; textColor?: string }) {
  const bg = annotation.backgroundColor
  if (!bg) return { backgroundColor: undefined, textColor: undefined }

  return {
    backgroundColor: `color-mix(in srgb, ${bg} 32%, transparent)`,
    textColor: '#fef08a',
  }
}
