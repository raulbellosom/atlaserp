import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000

function createGoogleError(message, response, payload) {
  const details = payload && typeof payload === 'object'
    ? payload.error_description ?? payload.error ?? null
    : null

  const suffix = details ? ` ${details}` : ''
  const error = new Error(`${message}${suffix}`)

  if (response) {
    error.status = response.status
  }

  if (payload !== undefined) {
    error.payload = payload
  }

  return error
}

async function readJsonResponse(response, message) {
  let payload

  try {
    payload = await response.json()
  } catch {
    throw createGoogleError(message, response)
  }

  if (!response.ok) {
    throw createGoogleError(message, response, payload)
  }

  return payload
}

function resolveExpiresInSeconds(tokenPayload, response) {
  const expiresIn = Number(tokenPayload.expires_in)

  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw createGoogleError(
      'Google OAuth token exchange failed. Invalid expires_in.',
      response,
      tokenPayload
    )
  }

  return expiresIn
}

function resolveRefreshToken(tokenPayload, response) {
  const refreshToken = String(tokenPayload.refresh_token ?? '').trim()

  if (!refreshToken) {
    throw createGoogleError(
      'Google OAuth token exchange failed. Missing refresh token.',
      response,
      tokenPayload
    )
  }

  return refreshToken
}

function createInvalidStateError() {
  const error = new Error('Invalid OAuth state.')
  error.status = 401
  return error
}

function resolveStateSigningKey(config) {
  const decodedKey = Buffer.from(String(config?.encryptionKey ?? ''), 'base64')

  if (decodedKey.length !== 32) {
    throw new Error('GOOGLE_OAUTH_ENCRYPTION_KEY must decode to 32 bytes.')
  }

  return decodedKey
}

function signStatePayload(encodedPayload, signingKey) {
  return createHmac('sha256', signingKey).update(encodedPayload).digest()
}

export function createGoogleOAuthService({ config, fetchImpl = fetch }) {
  function createAuthorizationState({ userId, now = new Date() }) {
    const normalizedUserId = String(userId ?? '').trim()

    if (!normalizedUserId) {
      throw new Error('userId is required to build the Google OAuth state.')
    }

    const payload = {
      userId: normalizedUserId,
      issuedAt: new Date(now).toISOString(),
      nonce: randomBytes(16).toString('base64url'),
    }
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
    const signature = signStatePayload(encodedPayload, resolveStateSigningKey(config))

    return `${encodedPayload}.${Buffer.from(signature).toString('base64url')}`
  }

  function verifyAuthorizationState({ state, userId, now = new Date() }) {
    const normalizedState = String(state ?? '').trim()
    const normalizedUserId = String(userId ?? '').trim()

    if (!normalizedState || !normalizedUserId) {
      throw createInvalidStateError()
    }

    const [encodedPayload, encodedSignature, extraPart] = normalizedState.split('.')

    if (!encodedPayload || !encodedSignature || extraPart) {
      throw createInvalidStateError()
    }

    const expectedSignature = signStatePayload(
      encodedPayload,
      resolveStateSigningKey(config)
    )
    const actualSignature = Buffer.from(encodedSignature, 'base64url')

    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)
    ) {
      throw createInvalidStateError()
    }

    let payload
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
    } catch {
      throw createInvalidStateError()
    }

    const issuedAt = new Date(payload?.issuedAt)
    const ageMs = now.getTime() - issuedAt.getTime()

    if (
      payload?.userId !== normalizedUserId ||
      Number.isNaN(issuedAt.getTime()) ||
      ageMs < 0 ||
      ageMs > GOOGLE_OAUTH_STATE_TTL_MS
    ) {
      throw createInvalidStateError()
    }

    return payload
  }

  function buildAuthorizationUrl({ state }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
      scope: config.scopes.join(' '),
      state,
    })

    return `${GOOGLE_AUTH_URL}?${params.toString()}`
  }

  async function exchangeCodeForTokens({ code }) {
    const tokenResponse = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokenPayload = await readJsonResponse(
      tokenResponse,
      'Google OAuth token exchange failed.'
    )

    if (!tokenPayload.access_token) {
      throw createGoogleError(
        'Google OAuth token exchange failed. Missing access token.',
        tokenResponse,
        tokenPayload
      )
    }

    const expiresInSeconds = resolveExpiresInSeconds(tokenPayload, tokenResponse)
    const refreshToken = resolveRefreshToken(tokenPayload, tokenResponse)

    const userInfoResponse = await fetchImpl(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    })

    const userInfo = await readJsonResponse(
      userInfoResponse,
      'Google user identity lookup failed.'
    )

    if (!userInfo.sub || !userInfo.email) {
      throw createGoogleError(
        'Google user identity lookup failed. Missing openid/email identity.',
        userInfoResponse,
        userInfo
      )
    }

    return {
      accessToken: tokenPayload.access_token,
      refreshToken,
      tokenExpiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      scopes: String(tokenPayload.scope ?? '')
        .split(' ')
        .map((scope) => scope.trim())
        .filter(Boolean),
      googleSubject: userInfo.sub,
      googleEmail: userInfo.email,
    }
  }

  return {
    createAuthorizationState,
    verifyAuthorizationState,
    buildAuthorizationUrl,
    exchangeCodeForTokens,
  }
}
