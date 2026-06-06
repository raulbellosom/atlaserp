import Dexie from 'dexie'

export class AtlasOfflineDatabase extends Dexie {
  constructor(name = 'atlas-offline') {
    super(name)

    this.version(1).stores({
      offline_records: '[moduleKey+entityType+id], moduleKey, entityType, companyId, dirty, pulledAt',
      mutation_queue: 'id, status, moduleKey, entityType, queuedAt, companyId, userId',
      sync_state: '[moduleKey+entityType]',
      session_vault: 'id',
      conflicts: 'id, status, moduleKey, entityType, recordId, detectedAt',
      _query_cache: 'id',
    })
  }
}

// Singleton instance — created lazily so tests can create their own instances
let _db = null

export function db() {
  if (!_db) {
    _db = new AtlasOfflineDatabase()
  }
  return _db
}
