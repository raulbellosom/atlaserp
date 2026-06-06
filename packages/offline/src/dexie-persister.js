export function createDexiePersister(database) {
  return {
    async persistClient(persistedClient) {
      try {
        await database._query_cache.put({ id: 'persisted', data: persistedClient })
      } catch {}
    },

    async restoreClient() {
      try {
        const row = await database._query_cache.get('persisted')
        return row?.data ?? undefined
      } catch {
        return undefined
      }
    },

    async removeClient() {
      try {
        await database._query_cache.delete('persisted')
      } catch {}
    },
  }
}
