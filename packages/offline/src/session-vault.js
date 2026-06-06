export class SessionVault {
  constructor(database) {
    this._db = database
  }

  async store({ accessToken, refreshToken, expiresAt, userProfile, companyId, apiBaseUrl }) {
    await this._db.session_vault.put({
      id: 'current',
      accessToken,
      refreshToken,
      expiresAt,
      userProfile,
      companyId,
      apiBaseUrl,
      storedAt: new Date().toISOString(),
    })
  }

  async load() {
    const row = await this._db.session_vault.get('current')
    return row ?? null
  }

  async update(fields) {
    const existing = await this.load()
    if (!existing) return
    const { id: _id, storedAt: _storedAt, ...safeFields } = fields
    await this._db.session_vault.put({ ...existing, ...safeFields })
  }

  async clear() {
    await this._db.session_vault.delete('current')
  }

  async isExpired() {
    const session = await this.load()
    if (!session?.expiresAt) return true
    return new Date(session.expiresAt) <= new Date()
  }
}
