import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import nodemailer from 'nodemailer'

const ALGORITHM = 'aes-256-gcm'
const SALT = 'atlas-smtp-v1'

function deriveKey() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return scryptSync(secret, SALT, 32)
}

export function encryptPassword(plaintext) {
  const key = deriveKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptPassword(ciphertext) {
  const key = deriveKey()
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function createSmtpService({ prisma }) {
  async function getConfig() {
    const rows = await prisma.instanceConfig.findMany({
      where: {
        key: {
          in: ['smtp.host', 'smtp.port', 'smtp.user', 'smtp.pass',
               'smtp.from_name', 'smtp.from_email', 'smtp.tls'],
        },
      },
    })
    const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    if (!cfg['smtp.host'] || !cfg['smtp.user']) return null

    return {
      host:      cfg['smtp.host'],
      port:      Number(cfg['smtp.port'] ?? 587),
      user:      cfg['smtp.user'],
      pass:      cfg['smtp.pass'] ? decryptPassword(cfg['smtp.pass']) : '',
      fromName:  cfg['smtp.from_name'] ?? '',
      fromEmail: cfg['smtp.from_email'] ?? cfg['smtp.user'],
      tls:       cfg['smtp.tls'] === 'true',
    }
  }

  async function sendEmail({ to, subject, html, text }) {
    const config = await getConfig()
    if (!config) throw new Error('SMTP no configurado')

    const transporter = nodemailer.createTransport({
      host:   config.host,
      port:   config.port,
      secure: config.tls,
      auth:   { user: config.user, pass: config.pass },
    })

    await transporter.sendMail({
      from:    `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject,
      html,
      text,
    })
  }

  async function isConfigured() {
    const config = await getConfig()
    return Boolean(config)
  }

  return { sendEmail, isConfigured, getConfig }
}
