import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { AtlasOfflineDatabase } from '../db.js'
import { MutationQueue } from '../mutation-queue.js'

let dbCounter = 0
function makeDb() {
  return new AtlasOfflineDatabase(`test-mq-${++dbCounter}`)
}

const ITEM = {
  id: 'mut-1',
  idempotencyKey: 'ik-1',
  moduleKey: 'atlas.contacts',
  entityType: 'contact',
  recordId: null,
  operation: 'CREATE',
  payload: { name: 'Ana' },
  companyId: 'co-1',
  userId: 'u-1',
}

describe('MutationQueue', () => {
  let db
  let queue

  beforeEach(async () => {
    db = makeDb()
    await db.open()
    queue = new MutationQueue({ db })
  })

  afterEach(async () => {
    await db.delete().catch(() => {})
  })

  it('enqueue puts record with PENDING status and queuedAt', async () => {
    await queue.enqueue(ITEM)
    const row = await db.mutation_queue.get('mut-1')
    assert.ok(row)
    assert.equal(row.status, 'PENDING')
    assert.equal(row.attempts, 0)
    assert.ok(row.queuedAt)
    assert.equal(row.lastError, null)
  })

  it('getPending returns only PENDING items sorted by queuedAt', async () => {
    await queue.enqueue({ ...ITEM, id: 'mut-a', queuedAt: undefined })
    await queue.enqueue({ ...ITEM, id: 'mut-b', idempotencyKey: 'ik-2', queuedAt: undefined })
    await db.mutation_queue.update('mut-b', { status: 'DONE' })
    const pending = await queue.getPending()
    assert.equal(pending.length, 1)
    assert.equal(pending[0].id, 'mut-a')
  })

  it('markDone sets status to DONE', async () => {
    await queue.enqueue(ITEM)
    await queue.markDone('mut-1')
    const row = await db.mutation_queue.get('mut-1')
    assert.equal(row.status, 'DONE')
  })

  it('markFailed with attempts < 3 keeps status PENDING and increments attempts', async () => {
    await queue.enqueue(ITEM)
    await queue.markFailed('mut-1', 'Network error')
    const row = await db.mutation_queue.get('mut-1')
    assert.equal(row.status, 'PENDING')
    assert.equal(row.attempts, 1)
    assert.equal(row.lastError, 'Network error')
  })

  it('markFailed at attempt 3 sets status to FAILED', async () => {
    await queue.enqueue(ITEM)
    await queue.markFailed('mut-1', 'err')
    await queue.markFailed('mut-1', 'err')
    await queue.markFailed('mut-1', 'err')
    const row = await db.mutation_queue.get('mut-1')
    assert.equal(row.status, 'FAILED')
    assert.equal(row.attempts, 3)
  })

  it('markConflict sets status to CONFLICT', async () => {
    await queue.enqueue(ITEM)
    await queue.markConflict('mut-1', 'Conflicto del servidor')
    const row = await db.mutation_queue.get('mut-1')
    assert.equal(row.status, 'CONFLICT')
    assert.equal(row.lastError, 'Conflicto del servidor')
  })

  it('getPendingCount includes PENDING + SYNCING + CONFLICT + FAILED', async () => {
    await queue.enqueue({ ...ITEM, id: 'a', idempotencyKey: 'ik-a' })
    await queue.enqueue({ ...ITEM, id: 'b', idempotencyKey: 'ik-b' })
    await queue.enqueue({ ...ITEM, id: 'c', idempotencyKey: 'ik-c' })
    await queue.enqueue({ ...ITEM, id: 'd', idempotencyKey: 'ik-d' })
    await db.mutation_queue.update('b', { status: 'SYNCING' })
    await db.mutation_queue.update('c', { status: 'CONFLICT' })
    await db.mutation_queue.update('d', { status: 'FAILED' })
    const count = await queue.getPendingCount()
    assert.equal(count, 4)
  })

  it('discard removes the entry from the queue', async () => {
    await queue.enqueue(ITEM)
    await queue.discard('mut-1')
    const row = await db.mutation_queue.get('mut-1')
    assert.equal(row, undefined)
  })

  it('markSyncing sets status to SYNCING', async () => {
    await queue.enqueue(ITEM)
    await queue.markSyncing('mut-1')
    const row = await db.mutation_queue.get('mut-1')
    assert.equal(row.status, 'SYNCING')
  })

  it('resetToRetry resets FAILED item to PENDING with cleared attempts and lastError', async () => {
    await queue.enqueue(ITEM)
    await queue.markFailed('mut-1', 'err')
    await queue.markFailed('mut-1', 'err')
    await queue.markFailed('mut-1', 'err')
    const failed = await db.mutation_queue.get('mut-1')
    assert.equal(failed.status, 'FAILED')
    await queue.resetToRetry('mut-1')
    const reset = await db.mutation_queue.get('mut-1')
    assert.equal(reset.status, 'PENDING')
    assert.equal(reset.attempts, 0)
    assert.equal(reset.lastError, null)
  })

  it('getAll with statuses filter returns only matching items', async () => {
    await queue.enqueue({ ...ITEM, id: 'x', idempotencyKey: 'ik-x' })
    await queue.enqueue({ ...ITEM, id: 'y', idempotencyKey: 'ik-y' })
    await db.mutation_queue.update('y', { status: 'FAILED' })
    const failed = await queue.getAll({ statuses: ['FAILED'] })
    assert.equal(failed.length, 1)
    assert.equal(failed[0].id, 'y')
    const all = await queue.getAll({ statuses: [] })
    assert.equal(all.length, 2)
  })
})
