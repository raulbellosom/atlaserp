import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export function createGoogleTokenCrypto({ key }) {
  const decodedKey = Buffer.from(String(key), 'base64')

  if (decodedKey.length !== 32) {
    throw new Error('GOOGLE_OAUTH_ENCRYPTION_KEY must decode to 32 bytes.')
  }

  return {
    encrypt(value) {
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', decodedKey, iv)
      const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
      const tag = cipher.getAuthTag()
      return Buffer.concat([iv, tag, encrypted]).toString('base64')
    },
    decrypt(payload) {
      const raw = Buffer.from(String(payload), 'base64')
      const iv = raw.subarray(0, 12)
      const tag = raw.subarray(12, 28)
      const data = raw.subarray(28)
      const decipher = createDecipheriv('aes-256-gcm', decodedKey, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
    },
  }
}
