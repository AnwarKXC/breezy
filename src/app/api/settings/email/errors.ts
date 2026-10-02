import 'server-only'
import { NextResponse } from 'next/server'
import { MailboxNotConfiguredError } from '@/services/email/mailbox'
export { FolderSchema, UidSchema } from '@/services/email/contracts'


/** Maps mail-server failures onto stable error codes the UI translates. */
export function mailErrorResponse(error: unknown) {
  if (error instanceof MailboxNotConfiguredError) {
    return NextResponse.json({ error: 'email/not_configured' }, { status: 409 })
  }
  const message = error instanceof Error ? error.message : ''
  if (message === 'email/draft_busy' || message === 'email/draft_already_sent') return NextResponse.json({ error: message }, { status: 409 })
  if (message.startsWith('email/')) {
    return NextResponse.json({ error: message }, { status: message.endsWith('_not_found') ? 404 : 400 })
  }
  console.error('[email] mail server error:', message)
  return NextResponse.json({ error: 'email/server_unreachable' }, { status: 502 })
}
