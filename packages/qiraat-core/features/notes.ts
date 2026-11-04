// Favourites and personal notes on a Qiraat word (iOS QiraatNotesStore). Pure; persistence is src/lib/personal-store.
export const NOTES_STORE = 'qiraat-notes'

export interface QiraatWordNote {
  id: string
  surah: number
  ayah: number
  token: number
  text: string
  favourite: boolean
  updatedAt: string
}

export function noteId(surah: number, ayah: number, token: number): string {
  return `${surah}:${ayah}:${token}`
}

/** No text and not a favourite: nothing to keep. */
export function isEmptyNote(note: QiraatWordNote): boolean {
  return note.text.trim() === '' && !note.favourite
}

/** The union of both lists; for an id on both sides the newer `updatedAt` wins (ties keep the local one). */
export function mergeNotes(local: QiraatWordNote[], incoming: QiraatWordNote[]): QiraatWordNote[] {
  const byId = new Map(local.map((n) => [n.id, n]))
  for (const n of incoming) {
    const mine = byId.get(n.id)
    if (!mine || n.updatedAt > mine.updatedAt) byId.set(n.id, n)
  }
  return Array.from(byId.values())
}
