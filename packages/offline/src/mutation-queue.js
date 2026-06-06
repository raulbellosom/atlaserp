export class MutationQueue {
  #db

  constructor({ db }) {
    this.#db = db
  }

  async enqueue({ id, idempotencyKey, moduleKey, entityType, recordId, operation, payload, companyId, userId }) {
    await this.#db.mutation_queue.put({
      id,
      idempotencyKey,
      moduleKey,
      entityType,
      recordId: recordId ?? null,
      operation,
      payload,
      status: 'PENDING',
      queuedAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
      companyId: companyId ?? null,
      userId: userId ?? null,
    })
  }

  async getPending({ limit = 50 } = {}) {
    return this.#db.mutation_queue.where('status').equals('PENDING').limit(limit).sortBy('queuedAt')
  }

  async markSyncing(id) {
    await this.#db.mutation_queue.update(id, { status: 'SYNCING' })
  }

  async markDone(id) {
    await this.#db.mutation_queue.update(id, { status: 'DONE' })
  }

  async markFailed(id, lastError) {
    const item = await this.#db.mutation_queue.get(id)
    if (!item) return
    const attempts = (item.attempts ?? 0) + 1
    const status = attempts >= 3 ? 'FAILED' : 'PENDING'
    await this.#db.mutation_queue.update(id, { status, attempts, lastError: lastError ?? null })
  }

  async markConflict(id, lastError) {
    await this.#db.mutation_queue.update(id, { status: 'CONFLICT', lastError: lastError ?? null })
  }

  async getPendingCount() {
    const [pending, syncing, conflict, failed] = await Promise.all([
      this.#db.mutation_queue.where('status').equals('PENDING').count(),
      this.#db.mutation_queue.where('status').equals('SYNCING').count(),
      this.#db.mutation_queue.where('status').equals('CONFLICT').count(),
      this.#db.mutation_queue.where('status').equals('FAILED').count(),
    ])
    return pending + syncing + conflict + failed
  }

  async getAll({ statuses } = {}) {
    if (!statuses || statuses.length === 0) {
      return this.#db.mutation_queue.orderBy('queuedAt').toArray()
    }
    return this.#db.mutation_queue.where('status').anyOf(statuses).sortBy('queuedAt')
  }

  async discard(id) {
    await this.#db.mutation_queue.delete(id)
  }

  async resetToRetry(id) {
    await this.#db.mutation_queue.update(id, { status: 'PENDING', attempts: 0, lastError: null })
  }
}
