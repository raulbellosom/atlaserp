import { createGoogleAccessTokenResolver } from './google-access-token-resolver.js'

const STALE_SYNC_STATUSES = ['SYNCING', 'PENDING_INITIAL_SYNC']

// The API kicks off imports fire-and-forget from the request process
// (queueMicrotask). A process restart/crash mid-import orphans the source
// at SYNCING forever with nothing to resume it — this worker tick finds
// those and retries. upsertImportedEvent is upsert-by-googleEventId, so
// redoing an import from scratch is safe.
export const GOOGLE_IMPORT_RECOVERY_INTERVAL_MS = Number(
  process.env.ATLAS_GOOGLE_IMPORT_RECOVERY_INTERVAL_MS ?? 60 * 1000,
)

export const GOOGLE_IMPORT_STALE_AFTER_MS = Number(
  process.env.ATLAS_GOOGLE_IMPORT_STALE_AFTER_MS ?? 3 * 60 * 1000,
)

export function createGoogleCalendarImportRecoveryService({
  prisma,
  connectionService,
  oauthService,
  tokenCrypto,
  initialImportService,
  staleAfterMs = GOOGLE_IMPORT_STALE_AFTER_MS,
  accessTokenResolver = createGoogleAccessTokenResolver({ tokenCrypto, oauthService, connectionService }),
}) {
  async function recoverStaleImports() {
    const staleBefore = new Date(Date.now() - staleAfterMs)

    const staleSources = await prisma.googleCalendarSource.findMany({
      where: {
        enabled: true,
        syncStatus: { in: STALE_SYNC_STATUSES },
        updatedAt: { lt: staleBefore },
      },
    })

    if (staleSources.length === 0) {
      return { recovered: 0, failed: 0 }
    }

    const sourcesByConnectionId = new Map()
    for (const source of staleSources) {
      const list = sourcesByConnectionId.get(source.connectionId) ?? []
      list.push(source)
      sourcesByConnectionId.set(source.connectionId, list)
    }

    let recovered = 0
    let failed = 0

    for (const [connectionId, sources] of sourcesByConnectionId) {
      const connection = await prisma.googleCalendarConnection.findUnique({
        where: { id: connectionId },
      })

      let accessToken = null

      if (connection && connection.status === 'ACTIVE') {
        try {
          const resolved = await accessTokenResolver.resolveAccessToken(connection.userId, connection)
          accessToken = resolved.accessToken
        } catch {
          accessToken = null
        }
      }

      for (const source of sources) {
        if (!accessToken) {
          await initialImportService.markSourceError(
            source.id,
            new Error('La conexion de Google Calendar expiro. Reconecta la cuenta para continuar.'),
          )
          failed += 1
          continue
        }

        try {
          await initialImportService.importSource({ source, accessToken })
          recovered += 1
        } catch {
          failed += 1
        }
      }
    }

    return { recovered, failed }
  }

  return { recoverStaleImports }
}
