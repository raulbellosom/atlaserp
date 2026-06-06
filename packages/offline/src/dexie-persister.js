export function createDexiePersister(database) {
  return {
    async persistClient(persistedClient) {
      try {
        await database._query_cache.put({ id: 'persisted', data: persistedClient })
      } catch (err) {
        console.warn('[atlas/offline] persistClient failed', err)
      }
    },

    async restoreClient() {
      try {
        const row = await database._query_cache.get('persisted')
        return row?.data ?? undefined
      } catch (err) {
        console.warn('[atlas/offline] restoreClient failed', err)
        return undefined
      }
    },

    async removeClient() {
      try {
        await database._query_cache.delete('persisted')
      } catch (err) {
        console.warn('[atlas/offline] removeClient failed', err)
      }
    },
  }
}
