const SYNC_CLEANUP_INTERVAL_MS = Number(
  process.env.ATLAS_SYNC_CLEANUP_INTERVAL_MS ?? 6 * 60 * 60 * 1000, // 6 hours
)

export function createSyncLogCleanupWorker({ prisma }) {
  async function processExpiredLogs() {
    const result = await prisma.syncMutationLog.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    return { deleted: result.count }
  }

  return { processExpiredLogs, SYNC_CLEANUP_INTERVAL_MS }
}
