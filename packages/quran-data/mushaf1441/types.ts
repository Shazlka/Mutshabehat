export type QiraahReading = 'hafs' | 'warsh' | 'abu-amr' | 'hamza'

export interface MushafPage {
  pageNumber: number
  lines: MushafLine[]
  /** Empty line slots that show a surah header band or basmala (see pageDecorations.ts). */
  lineDecorations?: Record<number, MushafLineDecoration>
}

export interface MushafLineDecoration {
  surahHeader?: number
  basmala?: boolean
}

export interface MushafLine {
  pageNumber: number
  lineNumber: number
  words: MushafWord[]
}

export interface MushafWord {
  id: string
  pageNumber: number
  lineNumber: number
  wordIndexInLine: number
  surahNumber: number
  ayahNumber: number
  wordIndexInAyah: number
  ayahKey: string
  textUthmani: string
  glyph?: string
  textQpcHafs?: string
  charTypeName?: 'word' | 'end' | 'pause' | 'sajdah' | 'rub-el-hizb' | string
  qcfVersion?: 'v1' | 'v2' | 'v4' | string
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface AyahNote {
  id: string
  ayahKey: string
  title?: string
  body: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface QiraahVariant {
  id: string
  surahNumber: number
  ayahNumber: number
  ayahKey: string
  wordIndexInAyah?: number
  reading: QiraahReading
  text: string
  explanation?: string
  source?: string
}

export interface MutshabehatHighlight {
  ayahKey: string
  groupId?: string
  category?: string
  tags?: string[]
  similarAyat?: string[]
}

export type MushafAnnotationType = 'note' | 'highlight' | 'bookmark' | 'favorite'
export type MushafAnnotationTargetType = 'ayah' | 'word' | 'word-range'

export interface MushafAnnotation {
  id: string
  userId: string
  annotationType: MushafAnnotationType
  targetType: MushafAnnotationTargetType
  ayahKey: string
  pageNumber: number
  wordId?: string
  lineNumber?: number
  wordIndexInLine?: number
  wordRangeStartId?: string
  wordRangeEndId?: string
  title?: string
  body?: string
  textColor?: string
  backgroundColor?: string
  tags: string[]
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
