import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { getEmailAccountPublic } from '@/services/email/account'

/** Mailbox users need its identity, never connection details or credentials. */
export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.EMAIL_READ, async () => {
    const account = await getEmailAccountPublic()
    return NextResponse.json({ data: account ? { email: account.email, displayName: account.displayName } : null })
  })
}
