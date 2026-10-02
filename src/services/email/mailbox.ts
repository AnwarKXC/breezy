// Live IMAP/SMTP operations against the hotel mailbox. Messages are not copied
// into our DB: the mail server stays the single source of truth, so Gmail/Outlook
// and this dashboard always show the same state.

import 'server-only'
import type { ImapFlow } from 'imapflow'
import { simpleParser, type AddressObject } from 'mailparser'
import MailComposer from 'nodemailer/lib/mail-composer'
import type Mail from 'nodemailer/lib/mailer'
import { createImapClient, getEmailAccount, type EmailAccount } from './account'
import { withDraftLocks } from './draftLock'
import { sendSmtpMessage } from './smtp'

export const MAIL_FOLDERS = ['inbox', 'sent', 'trash', 'archive', 'drafts', 'pinned'] as const
export type MailFolder = (typeof MAIL_FOLDERS)[number]

export interface MailAddress {
  name: string
  address: string
}

export interface MailSummary {
  uid: number
  folder?: MailFolder
  messageId?: string | null
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
  /** Available only when editing a draft. */
  content?: string
}

export interface MailDetail extends MailSummary {
  cc: MailAddress[]
  replyTo: MailAddress[]
  messageId: string | null
  inReplyTo?: string | null
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
  draftUid?: number
}

export const MAIL_ACTIONS = ['read', 'unread', 'pin', 'unpin', 'archive', 'trash', 'restore', 'deleteForever'] as const
export type MailAction = (typeof MAIL_ACTIONS)[number]

export class MailboxOperationError extends Error {
  constructor(code: string) { super(`email/${code}`) }
}

export class MailboxNotConfiguredError extends Error {
  constructor() {
    super('email/not_configured')
  }
}

async function withMailbox<T>(run: (client: ImapFlow, account: EmailAccount) => Promise<T>, fixedAccount?: EmailAccount, timeoutMs?: number): Promise<T> {
  const account = fixedAccount ?? await getEmailAccount()
  if (!account) throw new MailboxNotConfiguredError()
  const client = createImapClient(account)
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const operation = (async () => { await client.connect(); return run(client, account) })()
    if (!timeoutMs) return await operation
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { client.close(); reject(new MailboxOperationError('server_unreachable')) }, timeoutMs)
    })])
  } finally {
    if (timer) clearTimeout(timer)
    if (timeoutMs) client.close()
    else await client.logout().catch(() => undefined)
  }
}

/** Maps our folder names onto the server's real paths (Gmail: "[Gmail]/Sent Mail"). */
async function resolveFolder(client: ImapFlow, folder: MailFolder): Promise<string | null> {
  if (folder === 'inbox' || folder === 'pinned') return 'INBOX'
  const specialUse = { sent: '\\Sent', trash: '\\Trash', archive: '\\Archive', drafts: '\\Drafts' }[folder]
  const boxes = await client.list()
  const match =
    boxes.find((box) => box.specialUse === specialUse) ??
    boxes.find((box) => box.name.toLowerCase() === folder) ??
    (folder === 'archive' && client.capabilities.has('X-GM-EXT-1') ? boxes.find((box) => box.specialUse === '\\All') : undefined)
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
  { page, pageSize, search, pinnedOnly = false }: { page: number; pageSize: number; search: string; pinnedOnly?: boolean },
): Promise<{ items: MailSummary[]; total: number }> {
  if (folder === 'pinned') {
    const results = await Promise.all((['inbox', 'sent', 'archive'] as const).map((source) => listMessages(source, { page: 1, pageSize: page * pageSize, search, pinnedOnly: true })))
    const items = results.flatMap((result) => result.items).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.uid - a.uid)
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total: results.reduce((sum, result) => sum + result.total, 0) }
  }
  return withMailbox(async (client) => {
    const path = await resolveFolder(client, folder)
    if (!path) return { items: [], total: 0 }

    const lock = await client.getMailboxLock(path, { readOnly: true })
    try {
      // Gmail's All Mail includes Inbox and Sent; the Archive view excludes those labels.
      const archiveOnly = folder === 'archive' && client.capabilities.has('X-GM-EXT-1')
      const pinnedSentOnly = pinnedOnly && folder === 'sent' && client.capabilities.has('X-GM-EXT-1')
      const query = { ...(search ? { or: [{ subject: search }, { from: search }, { to: search }] } : { all: true }), ...(pinnedOnly ? { flagged: true } : {}), ...(archiveOnly ? { gmraw: '-in:inbox -in:sent -in:trash -in:drafts' } : pinnedSentOnly ? { gmraw: '-in:inbox' } : {}) }
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
          folder,
          messageId: msg.envelope?.messageId ?? null,
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
        inReplyTo: parsed.inReplyTo ?? null,
        references: Array.isArray(references) ? references : references ? [references] : [],
        html: typeof parsed.html === 'string' ? parsed.html : null,
        text: parsed.text ?? '',
        attachments: parsed.attachments.map((a, index) => ({
          index,
          filename: a.filename ?? `attachment-${index + 1}`,
          contentType: a.contentType,
          size: a.size,
          ...(folder === 'drafts' ? { content: a.content.toString('base64') } : {}),
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
  if (flags.seen !== undefined) await updateMessages(folder, [uid], flags.seen ? 'read' : 'unread')
  if (flags.flagged !== undefined) await updateMessages(folder, [uid], flags.flagged ? 'pin' : 'unpin')
}

/** Moves to Trash; deleting from Trash removes permanently. */
export async function deleteMessage(folder: MailFolder, uid: number): Promise<void> {
  await updateMessages(folder, [uid], folder === 'trash' ? 'deleteForever' : 'trash')
}

export async function updateMessages(folder: MailFolder, uids: number[], action: MailAction): Promise<void> {
  const account = await getEmailAccount()
  if (!account) throw new MailboxNotConfiguredError()
  return withDraftLocks(account.email, folder === 'drafts' ? uids : [], () => updateMessagesForAccount(account, folder, uids, action))
}

async function updateMessagesForAccount(account: EmailAccount, folder: MailFolder, uids: number[], action: MailAction): Promise<void> {
  if (action === 'deleteForever' && folder !== 'trash') throw new MailboxOperationError('delete_requires_trash')
  if (action === 'restore' && folder !== 'trash' && folder !== 'archive') throw new MailboxOperationError('cannot_restore')
  await withMailbox(async (client) => {
    const path = await resolveFolder(client, folder)
    if (!path) throw new MailboxOperationError('folder_not_found')
    const destinationFolder = action === 'archive' ? 'archive' : action === 'trash' ? 'trash' : action === 'restore' ? 'inbox' : null
    let destination = destinationFolder ? await resolveFolder(client, destinationFolder) : null
    if (destinationFolder === 'archive' && !destination) {
      await client.mailboxCreate('Archive')
      destination = 'Archive'
    }
    if (destinationFolder && !destination) throw new MailboxOperationError('folder_not_found')
    const lock = await client.getMailboxLock(path)
    try {
      const found = (await client.search({ uid: uids.join(','), ...(folder === 'pinned' ? { flagged: true } : {}) }, { uid: true })) || []
      if (uids.some((uid) => !found.includes(uid))) throw new MailboxOperationError('message_not_found')
      const range = uids.join(',')
      let result: unknown = true
      if (action === 'deleteForever') result = await client.messageDelete(range, { uid: true })
      else if (destination && destination !== path) result = await client.messageMove(range, destination, { uid: true })
      else if (action === 'read' || action === 'pin') result = await client.messageFlagsAdd(range, [action === 'read' ? '\\Seen' : '\\Flagged'], { uid: true })
      else if (action === 'unread' || action === 'unpin') result = await client.messageFlagsRemove(range, [action === 'unread' ? '\\Seen' : '\\Flagged'], { uid: true })
      if (result === false) throw new MailboxOperationError('operation_failed')
    } finally {
      lock.release()
    }
  }, account, folder === 'drafts' ? 20_000 : undefined)
}

function composeOptions(account: EmailAccount, mail: OutgoingMail): Mail.Options {
  return {
    from: account.displayName ? { name: account.displayName, address: account.email } : account.email,
    to: mail.to, cc: mail.cc.length ? mail.cc : undefined, subject: mail.subject, text: mail.text,
    inReplyTo: mail.inReplyTo, references: mail.references?.length ? mail.references : undefined,
    attachments: mail.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, content: Buffer.from(a.content, 'base64') })),
  }
}

export async function saveDraft(mail: OutgoingMail): Promise<{ uid: number; replaced: boolean }> {
  const account = await getEmailAccount()
  if (!account) throw new MailboxNotConfiguredError()
  return withDraftLocks(account.email, mail.draftUid ? [mail.draftUid] : [], () => saveDraftForAccount(account, mail))
}

async function saveDraftForAccount(account: EmailAccount, mail: OutgoingMail): Promise<{ uid: number; replaced: boolean }> {
  return withMailbox(async (client, account) => {
    let path = await resolveFolder(client, 'drafts')
    if (!path) { await client.mailboxCreate('Drafts'); path = 'Drafts' }
    const lock = await client.getMailboxLock(path)
    try {
      if (mail.draftUid) {
        const existing = await client.fetchOne(String(mail.draftUid), { uid: true, flags: true }, { uid: true })
        if (!existing) throw new MailboxOperationError('message_not_found')
        if (existing.flags?.has('\\Answered')) throw new MailboxOperationError('draft_already_sent')
      }
      const raw = await new MailComposer(composeOptions(account, mail)).compile().build()
      const result = await client.append(path, raw, ['\\Draft', '\\Seen'])
      if (!result || !result.uid) throw new MailboxOperationError('draft_save_failed')
      let replaced = !mail.draftUid
      if (mail.draftUid) {
        try { replaced = await client.messageDelete(String(mail.draftUid), { uid: true }) }
        catch { console.error('[email] saved draft but could not remove previous draft') }
      }
      return { uid: result.uid, replaced }
    } finally { lock.release() }
  }, account, mail.draftUid ? 20_000 : undefined)
}

export async function unreadCount(): Promise<number> {
  return withMailbox(async (client) => {
    const status = await client.status('INBOX', { unseen: true })
    if (!status) throw new MailboxOperationError('folder_not_found')
    return status.unseen ?? 0
  })
}

export async function sendMessage(mail: OutgoingMail): Promise<{ draftRemoved: boolean }> {
  const account = await getEmailAccount()
  if (!account) throw new MailboxNotConfiguredError()
  return withDraftLocks(account.email, mail.draftUid ? [mail.draftUid] : [], () => sendMessageForAccount(account, mail))
}

async function sendMessageForAccount(account: EmailAccount, mail: OutgoingMail): Promise<{ draftRemoved: boolean }> {

  const options = composeOptions(account, mail)

  if (mail.draftUid) {
    await withMailbox(async (client) => {
      const path = await resolveFolder(client, 'drafts')
      if (!path) throw new MailboxOperationError('message_not_found')
      const lock = await client.getMailboxLock(path, { readOnly: true })
      try {
        const existing = await client.fetchOne(String(mail.draftUid), { uid: true, flags: true }, { uid: true })
        if (!existing) throw new MailboxOperationError('message_not_found')
        if (existing.flags?.has('\\Answered')) throw new MailboxOperationError('draft_already_sent')
      } finally { lock.release() }
    }, account, mail.draftUid ? 20_000 : undefined)
  }

  await sendSmtpMessage(account, options)

  // Gmail files SMTP-sent mail into "Sent" itself; other servers need an IMAP copy.
  let draftRemoved = !mail.draftUid
  if (mail.draftUid) {
    try {
      await withMailbox(async (client) => {
        const path = await resolveFolder(client, 'drafts')
        if (!path) throw new MailboxOperationError('folder_not_found')
        const lock = await client.getMailboxLock(path)
        try {
          // Keep a provider-backed sent marker if expunging the draft fails.
          if (!await client.messageFlagsAdd(String(mail.draftUid), ['\\Answered'], { uid: true })) throw new MailboxOperationError('operation_failed')
          if (!await client.messageDelete(String(mail.draftUid), { uid: true })) throw new MailboxOperationError('operation_failed')
        } finally { lock.release() }
      }, account, mail.draftUid ? 20_000 : undefined)
      draftRemoved = true
    } catch { console.error('[email] sent message but could not remove draft') }
  }
  if (/(^|\.)gmail\.com$/i.test(account.smtpHost)) return { draftRemoved }
  try {
    const raw = await new MailComposer(options).compile().build()
    await withMailbox(async (client) => {
      const sent = await resolveFolder(client, 'sent')
      if (sent) await client.append(sent, raw, ['\\Seen'])
    }, account, mail.draftUid ? 20_000 : undefined)
  } catch (err) {
    // The mail is already delivered; a missing Sent copy must not report failure.
    console.error('[email] could not save copy to Sent:', (err as Error).message)
  }
  return { draftRemoved }
}
