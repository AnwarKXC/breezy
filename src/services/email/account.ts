// The hotel's mailbox connection, stored in `app_settings` (key='email_account').
// The password is encrypted with EMAIL_ENCRYPTION_KEY and never leaves the server.

import 'server-only'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { prisma } from '@/services/db/prisma'
import { decryptSecret, encryptSecret } from './secretBox'

const ACCOUNT_KEY = 'email_account'

const host = z.string().trim().min(1).max(253).regex(/^[a-zA-Z0-9.-]+$/, 'invalid host')
const port = z.coerce.number().int().min(1).max(65535)

export const EmailAccountInputSchema = z.object({
  displayName: z.string().trim().max(120).default(''),
  email: z.email().trim().max(254),
  username: z.string().trim().min(1).max(254),
  /** Empty on update = keep the stored password. */
  password: z.string().max(512).default(''),
  imapHost: host,
  imapPort: port,
  imapSecure: z.boolean(),
  smtpHost: host,
  smtpPort: port,
  smtpSecure: z.boolean(),
})

export type EmailAccountInput = z.infer<typeof EmailAccountInputSchema>

interface StoredAccount extends Omit<EmailAccountInput, 'password'> {
  passwordSealed: string
}

export interface EmailAccount extends Omit<EmailAccountInput, 'password'> {
  password: string
}

/** Safe for the browser: no password. */
export type EmailAccountPublic = Omit<EmailAccountInput, 'password'> & { hasPassword: true }

async function readStored(): Promise<StoredAccount | null> {
  const row = await prisma.app_settings.findUnique({ where: { key: ACCOUNT_KEY }, select: { value: true } })
  const value = row?.value as StoredAccount | null | undefined
  return value?.passwordSealed ? value : null
}

export async function getEmailAccountPublic(): Promise<EmailAccountPublic | null> {
  const stored = await readStored()
  if (!stored) return null
  const { passwordSealed, ...rest } = stored
  return { ...rest, hasPassword: Boolean(passwordSealed) as true }
}

export async function getEmailAccount(): Promise<EmailAccount | null> {
  const stored = await readStored()
  if (!stored) return null
  const { passwordSealed, ...rest } = stored
  return { ...rest, password: decryptSecret(passwordSealed) }
}

export function createImapClient(account: EmailAccount): ImapFlow {
  return new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure,
    auth: { user: account.username, pass: account.password },
    logger: false,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 60_000,
  })
}

export function createSmtpTransport(account: EmailAccount) {
  return nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure,
    auth: { user: account.username, pass: account.password },
    connectionTimeout: 15_000,
  })
}

/** Logs in to both servers; throws `email/imap_failed` or `email/smtp_failed`. */
export async function verifyEmailAccount(account: EmailAccount): Promise<void> {
  const imap = createImapClient(account)
  try {
    await imap.connect()
  } catch (err) {
    console.error('[email] IMAP verify failed:', (err as Error).message)
    throw new Error('email/imap_failed')
  } finally {
    await imap.logout().catch(() => undefined)
  }

  const smtp = createSmtpTransport(account)
  try {
    await smtp.verify()
  } catch (err) {
    console.error('[email] SMTP verify failed:', (err as Error).message)
    throw new Error('email/smtp_failed')
  } finally {
    smtp.close()
  }
}

/** Verifies the credentials, then saves them. */
export async function saveEmailAccount(input: EmailAccountInput, userId: string): Promise<EmailAccountPublic> {
  const { password: newPassword, ...rest } = input
  const password = newPassword || (await getEmailAccount())?.password
  if (!password) throw new Error('email/password_required')

  await verifyEmailAccount({ ...rest, password })

  const value: StoredAccount = { ...rest, passwordSealed: encryptSecret(password) }
  await prisma.app_settings.upsert({
    where: { key: ACCOUNT_KEY },
    create: { key: ACCOUNT_KEY, value: { ...value }, updated_by: userId },
    update: { value: { ...value }, updated_by: userId, updated_at: new Date() },
  })
  return { ...rest, hasPassword: true }
}

export async function deleteEmailAccount(): Promise<void> {
  await prisma.app_settings.deleteMany({ where: { key: ACCOUNT_KEY } })
}
