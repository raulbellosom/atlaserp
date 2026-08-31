import { CalendarServiceError } from '../calendar-service.js'

const RECONNECT_ERROR_MESSAGE =
  'La conexion de Google Calendar expiro. Reconecta la cuenta para continuar.'

export function hasUsableAccessToken(connection, now = new Date()) {
  if (!connection?.accessTokenEncrypted) return false

  const tokenExpiresAt = connection.tokenExpiresAt
    ? new Date(connection.tokenExpiresAt)
    : null

  if (!tokenExpiresAt || Number.isNaN(tokenExpiresAt.getTime())) return false

  return tokenExpiresAt.getTime() > now.getTime()
}

/**
 * Resolves a usable Google access token for a connection, transparently
 * refreshing (and persisting) it via the refresh token when the stored
 * access token has expired. Without this, any connection older than its
 * ~1h access-token lifetime would permanently fail until the user manually
 * reconnects.
 */
export function createGoogleAccessTokenResolver({ tokenCrypto, oauthService, connectionService }) {
  async function resolveAccessToken(userId, connection) {
    if (!connection?.accessTokenEncrypted) {
      throw new CalendarServiceError('No hay una cuenta Google conectada.', 409)
    }

    if (hasUsableAccessToken(connection)) {
      return {
        accessToken: tokenCrypto.decrypt(connection.accessTokenEncrypted),
        connection,
      }
    }

    if (!connection.refreshTokenEncrypted) {
      throw new CalendarServiceError(RECONNECT_ERROR_MESSAGE, 409)
    }

    const refreshToken = tokenCrypto.decrypt(connection.refreshTokenEncrypted)

    let refreshed
    try {
      refreshed = await oauthService.refreshAccessToken({ refreshToken })
    } catch {
      // The refresh token itself is no longer valid (revoked in the Google
      // account, expired, etc.) — the connection can no longer be used.
      await connectionService.disconnect(userId).catch(() => {})
      throw new CalendarServiceError(RECONNECT_ERROR_MESSAGE, 409)
    }

    const updatedConnection = await connectionService.updateAccessToken(userId, {
      accessToken: refreshed.accessToken,
      tokenExpiresAt: refreshed.tokenExpiresAt,
    })

    return { accessToken: refreshed.accessToken, connection: updatedConnection }
  }

  return { resolveAccessToken }
}
