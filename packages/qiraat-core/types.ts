export type QiraatReading = 'hafs' | 'warsh' | 'abu-amr' | 'hamza'

export interface QiraatVariant {
  id: string
  surahNumber: number
  ayahNumber: number
  ayahKey: string
  wordIndexInAyah?: number
  reading: QiraatReading
  text: string
  explanation?: string
  source?: string
}

export interface QiraatSource {
  variants: QiraatVariant[]
}

export const QIRAAT_READINGS: QiraatReading[] = ['hafs', 'warsh', 'abu-amr', 'hamza']
