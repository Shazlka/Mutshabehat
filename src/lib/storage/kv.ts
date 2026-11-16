/** A deliberately small IndexedDB facade shared by the reading and memorization repositories. */

export type KVKey = IDBValidKey
export type KVQuery = IDBValidKey | IDBKeyRange | undefined

export interface KVIndexDefinition {
  name: string
  keyPath: string | string[]
  unique?: boolean
  multiEntry?: boolean
}

export interface KVStoreDefinition {
  name: string
  keyPath?: string | string[]
  autoIncrement?: boolean
  indexes?: readonly KVIndexDefinition[]
}

export interface KVDatabaseDefinition {
  name: string
  version: number
  stores: readonly KVStoreDefinition[]
  migrate?: (database: IDBDatabase, oldVersion: number, transaction: IDBTransaction) => void
}

export interface KVTransaction {
  get<T>(store: string, key: KVKey): Promise<T | undefined>
  put<T>(store: string, value: T, key?: KVKey): Promise<KVKey>
  delete(store: string, key: KVKey): Promise<void>
  getAll<T>(store: string): Promise<T[]>
  queryIndex<T>(store: string, index: string, query?: KVQuery): Promise<T[]>
}

export interface KVDatabase extends KVTransaction {
  /** True only while writes are backed by IndexedDB. */
  readonly persistent: boolean
  transaction<T>(
    stores: readonly string[],
    mode: IDBTransactionMode,
    callback: (transaction: KVTransaction) => Promise<T>,
  ): Promise<T>
  close(): void
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!request) {
      reject(new Error('IndexedDB request failed'))
      return
    }
    let settled = false
    const onOk = () => {
      if (settled) return
      settled = true
      resolve(request.result)
    }
    const onErr = () => {
      if (settled) return
      settled = true
      reject(request.error ?? new Error('IndexedDB request failed'))
    }
    request.onsuccess = onOk
    request.onerror = onErr
    if ('addEventListener' in request && typeof (request as EventTarget).addEventListener === 'function') {
      ;(request as EventTarget).addEventListener('success', onOk, { once: true })
      ;(request as EventTarget).addEventListener('error', onErr, { once: true })
    }
    if (request.readyState === 'done') {
      if (request.error) onErr()
      else onOk()
    }
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const onOk = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const onErr = () => {
      if (settled) return
      settled = true
      reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    }
    transaction.oncomplete = onOk
    transaction.onabort = onErr
    transaction.onerror = onErr
    if ('addEventListener' in transaction && typeof (transaction as EventTarget).addEventListener === 'function') {
      ;(transaction as EventTarget).addEventListener('complete', onOk, { once: true })
      ;(transaction as EventTarget).addEventListener('abort', onErr, { once: true })
      ;(transaction as EventTarget).addEventListener('error', onErr, { once: true })
    }
  })
}

function idbTransactionAdapter(transaction: IDBTransaction): KVTransaction {
  return {
    get: async <T,>(store: string, key: KVKey): Promise<T | undefined> => {
      const os = transaction.objectStore(store)
      return requestResult(os.get(key)) as Promise<T | undefined>
    },
    put: async <T,>(store: string, value: T, key?: KVKey): Promise<KVKey> => {
      const os = transaction.objectStore(store)
      const request = key === undefined ? os.put(value) : os.put(value, key)
      return requestResult(request)
    },
    delete: async (store: string, key: KVKey): Promise<void> => {
      const os = transaction.objectStore(store)
      await requestResult(os.delete(key))
    },
    getAll: async <T,>(store: string): Promise<T[]> => {
      const os = transaction.objectStore(store)
      return requestResult(os.getAll()) as Promise<T[]>
    },
    queryIndex: async <T,>(store: string, index: string, query?: KVQuery): Promise<T[]> => {
      const os = transaction.objectStore(store)
      return requestResult(os.index(index).getAll(query)) as Promise<T[]>
    },
  }
}

class IndexedKVDatabase implements KVDatabase {
  readonly persistent = true

  constructor(private readonly database: IDBDatabase) {}

  async transaction<T>(
    stores: readonly string[],
    mode: IDBTransactionMode,
    callback: (transaction: KVTransaction) => Promise<T>,
  ): Promise<T> {
    const transaction = this.database.transaction([...stores], mode)
    const done = transactionDone(transaction)
    // If the callback throws first, `done` may reject later with nobody awaiting it.
    done.catch(() => undefined)
    try {
      const result = await callback(idbTransactionAdapter(transaction))
      await done
      return result
    } catch (error) {
      try { transaction.abort() } catch { /* The request may already have aborted it. */ }
      throw error
    }
  }

  get<T>(store: string, key: KVKey): Promise<T | undefined> {
    return this.transaction([store], 'readonly', (tx) => tx.get<T>(store, key))
  }

  put<T>(store: string, value: T, key?: KVKey): Promise<KVKey> {
    return this.transaction([store], 'readwrite', (tx) => tx.put(store, value, key))
  }

  delete(store: string, key: KVKey): Promise<void> {
    return this.transaction([store], 'readwrite', (tx) => tx.delete(store, key))
  }

  getAll<T>(store: string): Promise<T[]> {
    return this.transaction([store], 'readonly', (tx) => tx.getAll<T>(store))
  }

  queryIndex<T>(store: string, index: string, query?: KVQuery): Promise<T[]> {
    return this.transaction([store], 'readonly', (tx) => tx.queryIndex<T>(store, index, query))
  }

  close(): void {
    this.database.close()
  }
}

interface MemoryEntry {
  key: KVKey
  value: unknown
}

function keyToken(key: KVKey): string {
  if (Array.isArray(key)) return `a:${JSON.stringify(key)}`
  if (key instanceof Date) return `d:${key.getTime()}`
  if (key instanceof ArrayBuffer) return `b:${Array.from(new Uint8Array(key)).join(',')}`
  if (ArrayBuffer.isView(key)) {
    return `v:${Array.from(new Uint8Array(key.buffer, key.byteOffset, key.byteLength)).join(',')}`
  }
  return `${typeof key}:${String(key)}`
}

function valueAtKeyPath(value: unknown, keyPath: string | string[]): unknown {
  const read = (path: string): unknown => {
    let current = value
    for (const part of path.split('.')) {
      if (!current || typeof current !== 'object') return undefined
      current = (current as Record<string, unknown>)[part]
    }
    return current
  }
  return Array.isArray(keyPath) ? keyPath.map(read) : read(keyPath)
}

function isKey(value: unknown): value is KVKey {
  return typeof value === 'string' || typeof value === 'number' || value instanceof Date
    || value instanceof ArrayBuffer || ArrayBuffer.isView(value)
    || (Array.isArray(value) && value.every(isKey))
}

function queryMatches(key: unknown, query: KVQuery): boolean {
  if (query === undefined) return true
  if (typeof IDBKeyRange !== 'undefined' && query instanceof IDBKeyRange) {
    return isKey(key) && query.includes(key)
  }
  return isKey(key) && keyToken(key) === keyToken(query as KVKey)
}

/** In-memory adapter used by tests and whenever durable browser storage cannot be used. */
export class MemoryKVDatabase implements KVDatabase {
  readonly persistent: boolean
  private stores = new Map<string, Map<string, MemoryEntry>>()
  private autoKeys = new Map<string, number>()
  private readonly definitions = new Map<string, KVStoreDefinition>()

  constructor(definition: KVDatabaseDefinition, persistent = false) {
    this.persistent = persistent
    for (const store of definition.stores) {
      this.definitions.set(store.name, store)
      this.stores.set(store.name, new Map())
      this.autoKeys.set(store.name, 0)
    }
  }

  private table(name: string): Map<string, MemoryEntry> {
    const table = this.stores.get(name)
    if (!table) throw new Error(`Unknown store: ${name}`)
    return table
  }

  private deriveKey(store: string, value: unknown, provided?: KVKey): KVKey {
    if (provided !== undefined) return provided
    const definition = this.definitions.get(store)
    if (!definition) throw new Error(`Unknown store: ${store}`)
    if (definition.keyPath) {
      const derived = valueAtKeyPath(value, definition.keyPath)
      if (isKey(derived)) return derived
    }
    if (definition.autoIncrement) {
      const next = (this.autoKeys.get(store) ?? 0) + 1
      this.autoKeys.set(store, next)
      return next
    }
    throw new Error(`A key is required for store: ${store}`)
  }

  private assertUniqueIndexes(store: string, key: KVKey, value: unknown): void {
    const definition = this.definitions.get(store)
    for (const index of definition?.indexes ?? []) {
      if (!index.unique) continue
      const candidate = valueAtKeyPath(value, index.keyPath)
      for (const entry of this.table(store).values()) {
        if (keyToken(entry.key) === keyToken(key)) continue
        const existing = valueAtKeyPath(entry.value, index.keyPath)
        if (isKey(candidate) && isKey(existing) && keyToken(candidate) === keyToken(existing)) {
          throw new DOMException(`Unique index ${index.name} already contains that key`, 'ConstraintError')
        }
      }
    }
  }

  async get<T>(store: string, key: KVKey): Promise<T | undefined> {
    return this.table(store).get(keyToken(key))?.value as T | undefined
  }

  async put<T>(store: string, value: T, provided?: KVKey): Promise<KVKey> {
    const key = this.deriveKey(store, value, provided)
    this.assertUniqueIndexes(store, key, value)
    this.table(store).set(keyToken(key), { key, value: structuredClone(value) })
    return key
  }

  async delete(store: string, key: KVKey): Promise<void> {
    this.table(store).delete(keyToken(key))
  }

  async getAll<T>(store: string): Promise<T[]> {
    return Array.from(this.table(store).values(), (entry) => structuredClone(entry.value) as T)
  }

  async queryIndex<T>(store: string, indexName: string, query?: KVQuery): Promise<T[]> {
    const definition = this.definitions.get(store)
    const index = definition?.indexes?.find((candidate) => candidate.name === indexName)
    if (!index) throw new Error(`Unknown index ${indexName} on store ${store}`)
    return Array.from(this.table(store).values())
      .filter((entry) => queryMatches(valueAtKeyPath(entry.value, index.keyPath), query))
      .map((entry) => structuredClone(entry.value) as T)
  }

  async transaction<T>(
    stores: readonly string[],
    mode: IDBTransactionMode,
    callback: (transaction: KVTransaction) => Promise<T>,
  ): Promise<T> {
    if (mode === 'readonly') return callback(this)
    const snapshots = new Map<string, Map<string, MemoryEntry>>()
    const autoSnapshot = new Map(this.autoKeys)
    for (const store of stores) snapshots.set(store, structuredClone(this.table(store)))
    try {
      return await callback(this)
    } catch (error) {
      for (const [store, snapshot] of snapshots) this.stores.set(store, snapshot)
      this.autoKeys = autoSnapshot
      throw error
    }
  }

  close(): void {}
}

class FallbackKVDatabase implements KVDatabase {
  private current: KVDatabase
  private readonly memory: MemoryKVDatabase

  constructor(indexed: KVDatabase, definition: KVDatabaseDefinition) {
    this.current = indexed
    this.memory = new MemoryKVDatabase(definition)
  }

  get persistent(): boolean { return this.current.persistent }

  private async safely<T>(operation: (database: KVDatabase) => Promise<T>): Promise<T> {
    try {
      return await operation(this.current)
    } catch (error) {
      if (this.current === this.memory) throw error
      try { this.current.close() } catch { /* Ignore close failure on failed DB */ }
      this.current = this.memory
      return operation(this.current)
    }
  }

  get<T>(store: string, key: KVKey): Promise<T | undefined> {
    return this.safely((db) => db.get<T>(store, key))
  }
  put<T>(store: string, value: T, key?: KVKey): Promise<KVKey> {
    return this.safely((db) => db.put(store, value, key))
  }
  delete(store: string, key: KVKey): Promise<void> {
    return this.safely((db) => db.delete(store, key))
  }
  getAll<T>(store: string): Promise<T[]> {
    return this.safely((db) => db.getAll<T>(store))
  }
  queryIndex<T>(store: string, index: string, query?: KVQuery): Promise<T[]> {
    return this.safely((db) => db.queryIndex<T>(store, index, query))
  }
  transaction<T>(stores: readonly string[], mode: IDBTransactionMode, callback: (tx: KVTransaction) => Promise<T>): Promise<T> {
    return this.safely((db) => db.transaction(stores, mode, callback))
  }
  close(): void { this.current.close() }
}

function applySchema(database: IDBDatabase, definition: KVDatabaseDefinition): void {
  for (const storeDefinition of definition.stores) {
    let store: IDBObjectStore
    if (!database.objectStoreNames.contains(storeDefinition.name)) {
      store = database.createObjectStore(storeDefinition.name, {
        keyPath: storeDefinition.keyPath,
        autoIncrement: storeDefinition.autoIncrement,
      })
    } else {
      continue
    }
    for (const index of storeDefinition.indexes ?? []) {
      store.createIndex(index.name, index.keyPath, {
        unique: index.unique,
        multiEntry: index.multiEntry,
      })
    }
  }
}

/** Opens IndexedDB and permanently degrades to memory after any blocked/unavailable/quota failure. */
export async function openKVDatabase(
  definition: KVDatabaseDefinition,
  suppliedFactory?: IDBFactory | null,
): Promise<KVDatabase> {
  let factory = suppliedFactory
  if (factory === undefined) {
    try { factory = typeof indexedDB === 'undefined' ? null : indexedDB } catch { factory = null }
  }
  if (!factory) return new MemoryKVDatabase(definition)

  try {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = factory.open(definition.name, definition.version)
      open.onupgradeneeded = (event) => {
        applySchema(open.result, definition)
        definition.migrate?.(open.result, event.oldVersion, open.transaction!)
      }
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error ?? new Error('IndexedDB open failed'))
      open.onblocked = () => reject(new Error('IndexedDB open blocked'))
    })
    return new FallbackKVDatabase(new IndexedKVDatabase(database), definition)
  } catch {
    return new MemoryKVDatabase(definition)
  }
}
