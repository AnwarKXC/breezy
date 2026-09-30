import 'server-only'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { MAIL_FOLDERS, MailboxNotConfiguredError } from '@/services/email/mailbox'

export const FolderSchema = z.enum(MAIL_FOLDERS).catch('inbox')
export const UidSchema = z.coerce.number().int().positive()

/** Maps mail-server failures onto stable error codes the UI translates. */
export function mailErrorResponse(error: unknown) {
  if (error instanceof MailboxNotConfiguredError) {
    return NextResponse.json({ error: 'email/not_configured' }, { status: 409 })
  }
  const message = error instanceof Error ? error.message : ''
  if (message.startsWith('email/')) {
    return NextResponse.json({ error: message }, { status: 400 })
  }
  console.error('[email] mail server error:', message)
  return NextResponse.json({ error: 'email/server_unreachable' }, { status: 502 })
}
