// Client-side types and helpers for /api/settings/email. Mirrors the server
// shapes in src/services/email (kept separate: those modules are server-only).

export type MailFolder = 'inbox' | 'sent' | 'drafts' | 'archive' | 'pinned' | 'trash'
export type MailAction = 'read' | 'unread' | 'pin' | 'unpin' | 'archive' | 'trash' | 'restore' | 'deleteForever'
export interface MailAttachment { filename: string; contentType: string; content: string }

export interface EmailAccount {
  displayName: string
  email: string
  username: string
  imapHost: string
  imapPort: number
  imapSecure: boolean
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  hasPassword: true
}

export interface MailAddress {
  name: string
  address: string
}

export interface MailSummary {
  uid: number
  folder?: MailFolder
  subject: string
  from: MailAddress[]
  to: MailAddress[]
  date: string | null
  seen: boolean
  flagged: boolean
  hasAttachments: boolean
}

export interface MailDetail extends MailSummary {
  cc: MailAddress[]
  replyTo: MailAddress[]
  messageId: string | null
  inReplyTo?: string | null
  references: string[]
  html: string | null
  text: string
  attachments: { index: number; filename: string; contentType: string; size: number; content?: string }[]
}

export interface MailPage {
  items: MailSummary[]
  total: number
  page: number
  pageSize: number
}

const KNOWN_ERRORS = new Set([
  'email/send_uncertain',
  'email/draft_already_sent',
  'email/not_configured',
  'email/imap_failed',
  'email/smtp_failed',
  'email/password_required',
  'email/encryption_key_missing',
  'email/server_unreachable',
  'email/message_not_found',
  'email/attachments_too_large',
  'email/folder_not_found',
  'email/operation_failed',
  'email/draft_save_failed',
  'email/delete_requires_trash',
  'email/cannot_restore',
  'email/invalid_header',
  'email/recipient_required',
  'email/send_failed',
  'email/draft_busy',
])

export function emailErrorText(t: (key: string) => string, code: string): string {
  const match = [...KNOWN_ERRORS].find((known) => code.includes(known))
  return t(match ? `settings.email.errors.${match.slice('email/'.length)}` : 'settings.email.errors.generic')
}

export function formatAddress(a: MailAddress): string {
  return a.name || a.address
}

export async function sendJson(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = (await res.json().catch(() => null)) as { data?: unknown; error?: string } | null
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`)
  return json?.data
}
