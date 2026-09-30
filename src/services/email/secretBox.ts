// AES-256-GCM for secrets stored in the DB (mailbox passwords). The key lives
// only in the environment, so a DB dump alone never reveals the password.

import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function key(): Buffer {
  const secret = process.env.EMAIL_ENCRYPTION_KEY
  if (!secret || secret.length < 32) throw new Error('email/encryption_key_missing')
  return createHash('sha256').update(secret).digest()
}

/** Returns "iv.tag.ciphertext" (base64url parts). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.')
}

export function decryptSecret(sealed: string): string {
  const [iv, tag, data] = sealed.split('.').map((part) => Buffer.from(part, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
