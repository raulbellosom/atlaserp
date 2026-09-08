import { sign, verify } from 'hono/jwt';
import { OfficeError } from './errors.js';

export function createWopiTokens({ secret, tokenSeconds, now = Date.now }) {
  async function issue(claims) {
    const iat = Math.floor(now() / 1000);
    const exp = iat + tokenSeconds;
    return { accessToken: await sign({ ...claims, iat, exp, iss: 'atlas-office', aud: 'atlas-wopi' }, secret, 'HS256'), expiresAt: exp * 1000 };
  }
  async function validate(token, fileId) {
    try {
      if (typeof token !== 'string' || token.length > 4096) throw new Error();
      const claims = await verify(token, secret, 'HS256');
      if (claims.iss !== 'atlas-office' || claims.aud !== 'atlas-wopi' || claims.fileId !== fileId || !['view', 'edit'].includes(claims.mode) || !claims.authUserId || !claims.companyId || !claims.profileId || claims.exp * 1000 <= now() || claims.exp - claims.iat > tokenSeconds) throw new Error();
      return claims;
    } catch { throw new OfficeError('La sesión de Office expiró o no es válida.', 401, 'session_expired'); }
  }
  return { issue, validate };
}
