import { NextResponse } from 'next/server'
import { deleteContact, getContactById, updateContact } from '@/modules/contacts/services/contactService'
import { ACTIONS } from '@/config/rbac'
import { authorizeRequest } from '@/shared/routeAuth'
import { validateCsrf } from '@/shared/csrf'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'
import { ContactUpdateSchema, zodErrorMessage } from '@/shared/validation'

interface ContactRouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: ContactRouteContext) {
  try {
    const rateLimited = rateLimit(request, RateLimitTier.READ)
    if (rateLimited.error) return rateLimited.error
    const auth = await authorizeRequest(request, ACTIONS.CONTACTS_READ)
    if ('response' in auth) return auth.response

    const { id } = await context.params
    const contact = await getContactById(id)
    if (!contact) {
      return NextResponse.json({ error: 'contacts/not_found' }, { status: 404 })
    }
    return NextResponse.json({ data: contact })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'contacts/request_failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: ContactRouteContext) {
  try {
    const rateLimited = rateLimit(request, RateLimitTier.MUTATION)
    if (rateLimited.error) return rateLimited.error
    const csrf = validateCsrf(request)
    if (csrf.error) return csrf.error

    const auth = await authorizeRequest(request, ACTIONS.CONTACTS_UPDATE)
    if ('response' in auth) return auth.response

    const { id } = await context.params
    const body = await request.json()
    const parsed = ContactUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    const contact = await updateContact(id, { ...parsed.data, id })
    return NextResponse.json({ data: contact, message: 'Contact updated' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'contacts/request_failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: ContactRouteContext) {
  try {
    const rateLimited = rateLimit(request, RateLimitTier.MUTATION)
    if (rateLimited.error) return rateLimited.error
    const csrf = validateCsrf(request)
    if (csrf.error) return csrf.error

    const auth = await authorizeRequest(request, ACTIONS.CONTACTS_DELETE)
    if ('response' in auth) return auth.response

    const { id } = await context.params
    await deleteContact(id)
    return NextResponse.json({ data: { id }, message: 'Contact deleted' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'contacts/request_failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
