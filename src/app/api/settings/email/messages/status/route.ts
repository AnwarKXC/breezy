import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { unreadCount } from '@/services/email/mailbox'
import { mailErrorResponse } from '../../errors'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.EMAIL_READ, async () => {
    try { return NextResponse.json({ data: { unread: await unreadCount() } }) }
    catch (error) { return mailErrorResponse(error) }
  })
}
