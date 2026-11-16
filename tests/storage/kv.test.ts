import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MemoryKVDatabase, openKVDatabase, type KVDatabaseDefinition } from '../../src/lib/storage/kv'

const definition: KVDatabaseDefinition = {
  name: 'test', version: 1,
  stores: [{ name: 'rows', keyPath: 'id', indexes: [{ name: 'by_value', keyPath: 'value', unique: true }] }],
}

describe('KV adapters', () => {
  it('in-memory transactions roll back and enforce unique indexes', async () => {
    const database = new MemoryKVDatabase(definition)
    await database.put('rows', { id: 'a', value: 1 })
    await assert.rejects(database.put('rows', { id: 'b', value: 1 }), { name: 'ConstraintError' })
    await assert.rejects(database.transaction(['rows'], 'readwrite', async (transaction) => {
      await transaction.put('rows', { id: 'b', value: 2 })
      throw new Error('rollback')
    }))
    assert.equal(await database.get('rows', 'b'), undefined)
  })

  it('unavailable or throwing IndexedDB factories fall back to session memory', async () => {
    const unavailable = await openKVDatabase(definition, null)
    assert.equal(unavailable.persistent, false)
    await unavailable.put('rows', { id: 'a', value: 1 })
    assert.deepEqual(await unavailable.get('rows', 'a'), { id: 'a', value: 1 })

    const quotaFactory = { open() { throw new DOMException('quota', 'QuotaExceededError') } } as unknown as IDBFactory
    const quotaFallback = await openKVDatabase(definition, quotaFactory)
    assert.equal(quotaFallback.persistent, false)
    await quotaFallback.put('rows', { id: 'q', value: 2 })
    assert.deepEqual(await quotaFallback.get('rows', 'q'), { id: 'q', value: 2 })
  })

  it('degrades to memory during runtime write failures', async () => {
    let closed = false
    // Minimal hand-rolled IndexedDB mock: shape is checked by the adapter at runtime, not by TypeScript.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockTx: any = {
      objectStore() {
        return {
          put() {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const req: any = { onsuccess: null, onerror: null, error: null }
            queueMicrotask(() => {
              req.error = new DOMException('quota exceeded', 'QuotaExceededError')
              if (typeof req.onerror === 'function') req.onerror(new Event('error'))
              if (typeof mockTx.onabort === 'function') mockTx.onabort(new Event('abort'))
              else if (typeof mockTx.onerror === 'function') mockTx.onerror(new Event('error'))
            })
            return req
          },
        }
      },
      abort() {
        queueMicrotask(() => {
          if (typeof mockTx.onabort === 'function') mockTx.onabort(new Event('abort'))
        })
      },
      oncomplete: null,
      onabort: null,
      onerror: null,
    }
    const mockDb = {
      transaction() { return mockTx },
      close() { closed = true },
    }
    const mockFactory = {
      open() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const req: any = {
          result: mockDb,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          onblocked: null,
        }
        queueMicrotask(() => {
          if (typeof req.onsuccess === 'function') req.onsuccess(new Event('success'))
        })
        return req
      },
    } as unknown as IDBFactory

    const database = await openKVDatabase(definition, mockFactory)
    assert.equal(database.persistent, true)
    // Writing should fail on mock IDB and fall back to memory
    await database.put('rows', { id: 'fallback', value: 42 })
    assert.equal(closed, true)
    assert.equal(database.persistent, false)
    assert.deepEqual(await database.get('rows', 'fallback'), { id: 'fallback', value: 42 })
  })
})

