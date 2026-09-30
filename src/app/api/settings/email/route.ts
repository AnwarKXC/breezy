import { NextResponse } from 'next/server'
import { secureMutationEndpoint, secureReadEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { zodErrorMessage } from '@/shared/validation'
import {
  EmailAccountInputSchema,
  deleteEmailAccount,
  getEmailAccountPublic,
  saveEmailAccount,
} from '@/services/email/account'
import { mailErrorResponse } from './errors'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.SETTINGS_READ, async () => {
    return NextResponse.json({ data: await getEmailAccountPublic() })
  })
}

/** Verifies IMAP + SMTP login before saving, so a stored account always works. */
export async function PUT(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.SETTINGS_WRITE, async (session) => {
    const parsed = EmailAccountInputSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    try {
      return NextResponse.json({ data: await saveEmailAccount(parsed.data, session.id) })
    } catch (error) {
      return mailErrorResponse(error)
    }
  })
}

export async function DELETE(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.SETTINGS_WRITE, async () => {
    await deleteEmailAccount()
    return NextResponse.json({ data: null })
  })
}
