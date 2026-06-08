export function createGoogleCalendarConnectionService({ prisma, tokenCrypto }) {
  async function getConnectionByUserId(userId) {
    return prisma.googleCalendarConnection.findUnique({
      where: { userId },
    })
  }

  async function saveConnection(input) {
    const existingConnection = await getConnectionByUserId(input.userId)
    const accessTokenEncrypted = tokenCrypto.encrypt(input.accessToken)
    const refreshTokenEncrypted = input.refreshToken
      ? tokenCrypto.encrypt(input.refreshToken)
      : existingConnection?.refreshTokenEncrypted

    if (!refreshTokenEncrypted) {
      throw new Error('A refresh token is required when saving the first Google Calendar connection.')
    }

    return prisma.googleCalendarConnection.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        googleSubject: input.googleSubject,
        googleEmail: input.googleEmail,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt: input.tokenExpiresAt,
        scopes: input.scopes,
        status: 'ACTIVE',
        revokedAt: null,
      },
      update: {
        googleSubject: input.googleSubject,
        googleEmail: input.googleEmail,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt: input.tokenExpiresAt,
        scopes: input.scopes,
        status: 'ACTIVE',
        revokedAt: null,
      },
    })
  }

  async function disconnect(userId) {
    return prisma.googleCalendarConnection.update({
      where: { userId },
      data: {
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    })
  }

  return {
    getConnectionByUserId,
    saveConnection,
    disconnect,
  }
}
