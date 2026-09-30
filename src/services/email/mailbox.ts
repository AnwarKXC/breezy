// Live IMAP/SMTP operations against the hotel mailbox. Messages are not copied
// into our DB: the mail server stays the single source of truth, so Gmail/Outlook
// and this dashboard always show the same state.

import 'server-only'
import type { ImapFlow } from 'imapflow'
import { simpleParser, type AddressObject } from 'mailparser'
import MailComposer from 'nodemailer/lib/mail-composer'
import type Mail from 'nodemailer/lib/mailer'
import { createImapClient, createSmtpTransport, getEmailAccount, type EmailAccount } from './account'

export const MAIL_FOLDERS = ['inbox', 'sent', 'trash'] as const
export type MailFolder = (typeof MAIL_FOLDERS)[number]

export interface MailAddress {
  name: string
  address: string
}

export interface MailSummary {
  uid: number
  subject: string
  from: MailAddress[]
  to: MailAddress[]
  date: string | null
  seen: boolean
  flagged: boolean
  hasAttachments: boolean
}

export interface MailAttachmentMeta {
  index: number
  filename: string
  contentType: string
  size: number
}

export interface MailDetail extends MailSummary {
  cc: MailAddress[]
  replyTo: MailAddress[]
  messageId: string | null
  references: string[]
  html: string | null
  text: string
  attachments: MailAttachmentMeta[]
}

export interface OutgoingAttachment {
  filename: string
  contentType: string
  /** base64 */
  content: string
}

export interface OutgoingMail {
  to: string[]
  cc: string[]
  subject: string
  text: string
  inReplyTo?: string
  references?: string[]
  attachments: OutgoingAttachment[]
}

export class MailboxNotConfiguredError extends Error {
  constructor() {
    super('email/not_configured')
  }
}

async function withMailbox<T>(run: (client: ImapFlow, account: EmailAccount) => Promise<T>): Promise<T> {
  const account = await getEmailAccount()
  if (!account) throw new MailboxNotConfiguredError()
  const client = createImapClient(account)
  await client.connect()
  try {
    return await run(client, account)
  } finally {
    await client.logout().catch(() => undefined)
  }
}

/** Maps our folder names onto the server's real paths (Gmail: "[Gmail]/Sent Mail"). */
async function resolveFolder(client: ImapFlow, folder: MailFolder): Promise<string | null> {
  if (folder === 'inbox') return 'INBOX'
  const specialUse = folder === 'sent' ? '\\Sent' : '\\Trash'
  const boxes = await client.list()
  const match =
    boxes.find((box) => box.specialUse === specialUse) ??
    boxes.find((box) => box.name.toLowerCase() === (folder === 'sent' ? 'sent' : 'trash'))
  return match?.path ?? null
}

function addresses(value: { name?: string; address?: string }[] | undefined): MailAddress[] {
  return (value ?? []).map((a) => ({ name: a.name ?? '', address: a.address ?? '' }))
}

function parsedAddresses(value: AddressObject | AddressObject[] | undefined): MailAddress[] {
  const list = Array.isArray(value) ? value : value ? [value] : []
  return list.flatMap((obj) => addresses(obj.value))
}

function hasAttachmentParts(node: unknown): boolean {
  const part = node as { disposition?: string; childNodes?: unknown[] } | undefined
  if (!part) return false
  if (part.disposition === 'attachment') return true
  return (part.childNodes ?? []).some(hasAttachmentParts)
}

export async function listMessages(
  folder: MailFolder,
  { page, pageSize, search }: { page: number; pageSize: number; search: string },
): Promise<{ items: MailSummary[]; total: number }> {
  return withMailbox(async (client) => {
    const path = await resolveFolder(client, folder)
    if (!path) return { items: [], total: 0 }

    const lock = await client.getMailboxLock(path, { readOnly: true })
    try {
      const query = search ? { or: [{ subject: search }, { from: search }, { to: search }] } : { all: true }
      const uids = ((await client.search(query, { uid: true })) || []).sort((a, b) => b - a)
      const pageUids = uids.slice((page - 1) * pageSize, page * pageSize)
      if (pageUids.length === 0) return { items: [], total: uids.length }

      const items: MailSummary[] = []
      for await (const msg of client.fetch(
        pageUids,
        { uid: true, envelope: true, flags: true, bodyStructure: true, internalDate: true },
        { uid: true },
      )) {
        const sentAt = msg.envelope?.date ?? msg.internalDate
        items.push({
          uid: msg.uid,
          subject: msg.envelope?.subject ?? '',
          from: addresses(msg.envelope?.from),
          to: addresses(msg.envelope?.to),
          date: sentAt ? new Date(sentAt).toISOString() : null,
          seen: msg.flags?.has('\\Seen') ?? false,
          flagged: msg.flags?.has('\\Flagged') ?? false,
          hasAttachments: hasAttachmentParts(msg.bodyStructure),
        })
      }
      items.sort((a, b) => b.uid - a.uid)
      return { items, total: uids.length }
    } finally {
      lock.release()
    }
  })
}

async function fetchParsed(client: ImapFlow, uid: number) {
  const msg = await client.fetchOne(String(uid), { uid: true, flags: true, source: true }, { uid: true })
  if (!msg || !msg.source) return null
  return { msg, parsed: await simpleParser(msg.source) }
}

/** Reading a message marks it as seen, like any mail client. */
export async function getMessage(folder: MailFolder, uid: number): Promise<MailDetail | null> {
  return withMailbox(async (client) => {
    const path = await resolveFolder(client, folder)
    if (!path) return null
    const lock = await client.getMailboxLock(path)
    try {
      const found = await fetchParsed(client, uid)
      if (!found) return null
      const { msg, parsed } = found
      if (!msg.flags?.has('\\Seen')) await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })

      const references = parsed.references
      return {
        uid,
        subject: parsed.subject ?? '',
        from: parsedAddresses(parsed.from),
        to: parsedAddresses(parsed.to),
        cc: parsedAddresses(parsed.cc),
        replyTo: parsedAddresses(parsed.replyTo),
        date: parsed.date?.toISOString() ?? null,
        seen: true,
        flagged: msg.flags?.has('\\Flagged') ?? false,
        hasAttachments: parsed.attachments.length > 0,
        messageId: parsed.messageId ?? null,
        references: Array.isArray(references) ? references : references ? [references] : [],
        html: typeof parsed.html === 'string' ? parsed.html : null,
        text: parsed.text ?? '',
        attachments: parsed.attachments.map((a, index) => ({
          index,
          filename: a.filename ?? `attachment-${index + 1}`,
          contentType: a.contentType,
          size: a.size,
        })),
      }
    } finally {
      lock.release()
    }
  })
}

export async function getAttachment(folder: MailFolder, uid: number, index: number) {
  return withMailbox(async (client) => {
    const path = await resolveFolder(client, folder)
    if (!path) return null
    const lock = await client.getMailboxLock(path, { readOnly: true })
    try {
      const attachment = (await fetchParsed(client, uid))?.parsed.attachments[index]
      if (!attachment) return null
      return {
        filename: attachment.filename ?? `attachment-${index + 1}`,
        contentType: attachment.contentType,
        content: attachment.content,
      }
    } finally {
      lock.release()
    }
  })
}

export async function setMessageFlags(
  folder: MailFolder,
  uid: number,
  flags: { seen?: boolean; flagged?: boolean },
): Promise<void> {
  await withMailbox(async (client) => {
    const path = await resolveFolder(client, folder)
    if (!path) return
    const lock = await client.getMailboxLock(path)
    try {
      for (const [flag, on] of [['\\Seen', flags.seen], ['\\Flagged', flags.flagged]] as const) {
        if (on === undefined) continue
        if (on) await client.messageFlagsAdd(String(uid), [flag], { uid: true })
        else await client.messageFlagsRemove(String(uid), [flag], { uid: true })
      }
    } finally {
      lock.release()
    }
  })
}

/** Moves to Trash; deleting from Trash removes permanently. */
export async function deleteMessage(folder: MailFolder, uid: number): Promise<void> {
  await withMailbox(async (client) => {
    const path = await resolveFolder(client, folder)
    if (!path) return
    const trash = await resolveFolder(client, 'trash')
    const lock = await client.getMailboxLock(path)
    try {
      if (trash && trash !== path) await client.messageMove(String(uid), trash, { uid: true })
      else await client.messageDelete(String(uid), { uid: true })
    } finally {
      lock.release()
    }
  })
}

export async function sendMessage(mail: OutgoingMail): Promise<void> {
  const account = await getEmailAccount()
  if (!account) throw new MailboxNotConfiguredError()

  const options: Mail.Options = {
    from: account.displayName ? { name: account.displayName, address: account.email } : account.email,
    to: mail.to,
    cc: mail.cc.length ? mail.cc : undefined,
    subject: mail.subject,
    text: mail.text,
    inReplyTo: mail.inReplyTo,
    references: mail.references?.length ? mail.references : undefined,
    attachments: mail.attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      content: Buffer.from(a.content, 'base64'),
    })),
  }

  const smtp = createSmtpTransport(account)
  try {
    await smtp.sendMail(options)
  } finally {
    smtp.close()
  }

  // Gmail files SMTP-sent mail into "Sent" itself; other servers need an IMAP copy.
  if (/(^|\.)gmail\.com$/i.test(account.smtpHost)) return
  try {
    const raw = await new MailComposer(options).compile().build()
    await withMailbox(async (client) => {
      const sent = await resolveFolder(client, 'sent')
      if (sent) await client.append(sent, raw, ['\\Seen'])
    })
  } catch (err) {
    // The mail is already delivered; a missing Sent copy must not report failure.
    console.error('[email] could not save copy to Sent:', (err as Error).message)
  }
}
