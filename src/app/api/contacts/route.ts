import { NextResponse } from 'next/server'
import { createContact, getContactsPage } from '@/modules/contacts/services/contactService'
import { ACTIONS } from '@/config/rbac'
import { decodeCursor } from '@/shared/pagination/cursor'
import { secureReadEndpoint, secureMutationEndpoint } from '@/shared/secureEndpoint'
import { ContactCreateSchema, zodErrorMessage } from '@/shared/validation'

function getLimit(value: string | null) {
  if (!value) return undefined
  const parsed = Number(value)
  if (Number.isInteger(parsed) && parsed > 0) return Math.min(parsed, 100)
  throw new Error('contacts/invalid_form')
}

function getType(value: string | null) {
  if (!value || value === 'all') return undefined
  if (value === 'company' || value === 'individual') return value
  throw new Error('contacts/invalid_form')
}

function getCursor(value: string | null) {
  if (!value) return undefined
  decodeCursor(value)
  return value
}

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.CONTACTS_READ, async () => {
    try {
      const { searchParams } = new URL(request.url)
      const page = await getContactsPage({
        cursor: getCursor(searchParams.get('cursor')),
        limit: getLimit(searchParams.get('limit')),
        type: getType(searchParams.get('type')),
        search: searchParams.get('search') ?? undefined,
      })
      return NextResponse.json(page)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'contacts/request_failed'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  })
}

export async function POST(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.CONTACTS_CREATE, async () => {
    try {
      const body = await request.json()
      const parsed = ContactCreateSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
      }
      const contact = await createContact(parsed.data)
      return NextResponse.json({ data: contact, message: 'Contact created' }, { status: 201 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'contacts/request_failed'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  })
}
