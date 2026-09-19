import { NextResponse } from 'next/server'
import { getContactsMetrics } from '@/modules/contacts/services/contactService'
import { authorizeRequest } from '@/shared/routeAuth'
import { ACTIONS } from '@/config/rbac'

export async function GET(request: Request) {
  try {
    const auth = await authorizeRequest(request, ACTIONS.CONTACTS_READ)
    if ('response' in auth) return auth.response

    return NextResponse.json(await getContactsMetrics())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'contacts/request_failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
