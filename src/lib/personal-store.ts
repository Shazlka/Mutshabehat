// Per-device personal data (Qiraat favourites and notes) in IndexedDB. The page works without it: when IndexedDB is
// missing or blocked (private window, blocked site data) the store holds data in memory for this visit only and says
// so through `available: false`. Never writes to the shared database.
import { NOTES_STORE, type QiraatWordNote } from '../../packages/qiraat-core/features/notes'

export interface PersonalStore {
  get<T>(store: string, key: string): Promise<T | undefined>
  put<T>(store: string, key: string, value: T): Promise<void>
  delete(store: string, key: string): Promise<void>
  all<T>(store: string): Promise<T[]>
  /** False when data is held in memory only (nothing survives a reload). */
  available: boolean
}

const DB_NAME = 'mushaf1441-personal'
const DB_VERSION = 1
const STORES = [NOTES_STORE]

export function createMemoryStore(available = true): PersonalStore {
  const data = new Map<string, Map<string, unknown>>()
  const table = (name: string) => data.get(name) ?? data.set(name, new Map()).get(name)!
  return {
    available,
    get: async <T,>(store: string, key: string) => table(store).get(key) as T | undefined,
    put: async <T,>(store: string, key: string, value: T) => { table(store).set(key, value) },
    delete: async (store, key) => { table(store).delete(key) },
    all: async <T,>(store: string) => Array.from(table(store).values()) as T[],
  }
}

const request = <T,>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })

function indexedDbStore(db: IDBDatabase): PersonalStore {
  const store = (name: string, mode: IDBTransactionMode) => db.transaction(name, mode).objectStore(name)
  return {
    available: true,
    get: async <T,>(name: string, key: string) => (await request(store(name, 'readonly').get(key))) as T | undefined,
    put: async <T,>(name: string, key: string, value: T) => { await request(store(name, 'readwrite').put(value, key)) },
    delete: async (name, key) => { await request(store(name, 'readwrite').delete(key)) },
    all: async <T,>(name: string) => (await request(store(name, 'readonly').getAll())) as T[],
  }
}

export async function openPersonalStore(factory: IDBFactory | null | undefined = typeof indexedDB === 'undefined' ? null : indexedDB): Promise<PersonalStore> {
  if (!factory) return createMemoryStore(false)
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = factory.open(DB_NAME, DB_VERSION)
      open.onupgradeneeded = () => {
        for (const name of STORES) if (!open.result.objectStoreNames.contains(name)) open.result.createObjectStore(name)
      }
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
      open.onblocked = () => reject(new Error('blocked'))
    })
    return indexedDbStore(db)
  } catch {
    return createMemoryStore(false)
  }
}

const FORMAT_VERSION = 1
const BAD_FILE = 'الملف غير صالح: لم يتغيّر شيء.'

/** The whole personal data as a versioned JSON text. */
export async function exportPersonalData(store: PersonalStore): Promise<string> {
  const stores: Record<string, unknown[]> = {}
  for (const name of STORES) stores[name] = await store.all(name)
  return JSON.stringify({ version: FORMAT_VERSION, exportedAt: new Date().toISOString(), stores })
}

function isNote(value: unknown): value is QiraatWordNote {
  const n = value as Partial<QiraatWordNote> | null
  return !!n && typeof n.id === 'string' && typeof n.text === 'string' && typeof n.favourite === 'boolean'
    && typeof n.updatedAt === 'string' && typeof n.surah === 'number' && typeof n.ayah === 'number' && typeof n.token === 'number'
}

/** Merge an exported file into the store (newest note wins). Rejects, changing nothing, when the file is not valid. */
export async function importPersonalData(store: PersonalStore, json: string): Promise<{ imported: number }> {
  let parsed: { version?: unknown; stores?: Record<string, unknown> }
  try { parsed = JSON.parse(json) } catch { throw new Error(BAD_FILE) }
  if (!parsed || parsed.version !== FORMAT_VERSION || typeof parsed.stores !== 'object' || parsed.stores === null) throw new Error(BAD_FILE)
  const incoming = parsed.stores[NOTES_STORE] ?? []
  if (!Array.isArray(incoming) || !incoming.every(isNote)) throw new Error(BAD_FILE)
  let imported = 0
  for (const note of incoming) {
    const mine = await store.get<QiraatWordNote>(NOTES_STORE, note.id)
    if (!mine || note.updatedAt > mine.updatedAt) {
      await store.put(NOTES_STORE, note.id, note)
      imported += 1
    }
  }
  return { imported }
}
