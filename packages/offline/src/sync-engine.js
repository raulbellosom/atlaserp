export class SyncEngine {
  #db
  #apiBaseUrl
  #getToken
  #fetchImpl
  #pulling = false

  constructor({ db, apiBaseUrl, getToken, fetchImpl }) {
    this.#db = db
    this.#getToken = getToken
    // fetchImpl is injected for testing; in production globalThis.fetch is used
    this.#fetchImpl = fetchImpl ?? ((...args) => globalThis.fetch(...args))
    this.#apiBaseUrl = (apiBaseUrl ?? '').replace(/\/$/, '')
  }

  async pull({ modules }) {
    if (this.#pulling) return { pulled: 0, nextCursor: null }
    this.#pulling = true
    try {
    const token = await this.#getToken()
    if (!token) return { pulled: 0, nextCursor: null }

    // Find the oldest stored cursor across requested modules so we don't
    // miss records changed before a newer module's cursor.
    const allStates = await this.#db.sync_state.toArray()
    const relevantStates = allStates.filter((s) => modules.includes(s.moduleKey))
    const oldestCursor = relevantStates.reduce((min, s) => {
      if (!s.serverCursor) return min
      if (min === null || s.serverCursor < min) return s.serverCursor
      return min
    }, null)

    const url = new URL(`${this.#apiBaseUrl}/sync/pull`)
    url.searchParams.set('modules', modules.join(','))
    if (oldestCursor) url.searchParams.set('cursor', oldestCursor)

    const response = await this.#fetchImpl(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      throw new Error(`Pull failed: ${response.status}`)
    }

    const { records, nextCursor } = await response.json()
    const now = new Date().toISOString()

    await this.#db.transaction(
      'rw',
      [this.#db.offline_records, this.#db.sync_state],
      async () => {
        for (const rec of records) {
          if (rec.deleted) {
            await this.#db.offline_records
              .where('[moduleKey+entityType+id]')
              .equals([rec.moduleKey, rec.entityType, rec.id])
              .delete()
          } else {
            await this.#db.offline_records.put({
              moduleKey: rec.moduleKey,
              entityType: rec.entityType,
              id: rec.id,
              data: rec.data,
              version: rec.version,
              pulledAt: now,
              companyId: rec.data?.companyId ?? null,
              dirty: false,
            })
          }
        }

        // Update sync_state for each (moduleKey, entityType) seen in the response
        const seen = new Map()
        for (const rec of records) {
          const key = `${rec.moduleKey}/${rec.entityType}`
          if (!seen.has(key)) seen.set(key, { moduleKey: rec.moduleKey, entityType: rec.entityType })
        }
        for (const { moduleKey, entityType } of seen.values()) {
          await this.#db.sync_state.put({
            moduleKey,
            entityType,
            lastPullAt: now,
            serverCursor: nextCursor,
            schemaVersion: null,
          })
        }
      },
    )

    return { pulled: records.length, nextCursor }
    } finally {
      this.#pulling = false
    }
  }

  async getLocalCount({ moduleKey, entityType }) {
    return this.#db.offline_records.where({ moduleKey, entityType }).count()
  }
}
