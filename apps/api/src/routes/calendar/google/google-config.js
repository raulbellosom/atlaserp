const REQUIRED_ENV_KEYS = [
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
  'GOOGLE_OAUTH_ENCRYPTION_KEY',
]

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
]

export function resolveGoogleCalendarConfig(env = process.env) {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !String(env[key] ?? '').trim())

  if (missing.length > 0) {
    return {
      configured: false,
      missing,
      scopes: GOOGLE_SCOPES,
    }
  }

  return {
    configured: true,
    missing: [],
    clientId: String(env.GOOGLE_OAUTH_CLIENT_ID).trim(),
    clientSecret: String(env.GOOGLE_OAUTH_CLIENT_SECRET).trim(),
    redirectUri: String(env.GOOGLE_OAUTH_REDIRECT_URI).trim(),
    encryptionKey: String(env.GOOGLE_OAUTH_ENCRYPTION_KEY).trim(),
    scopes: GOOGLE_SCOPES,
  }
}
