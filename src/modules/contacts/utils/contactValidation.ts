import { ContactCreateSchema, zodErrorMessage } from '@/shared/validation'
import type { CreateContactInput } from '../types'

export interface ContactFormDraft {
  id?: string
  type: 'company' | 'individual'
  name: string
  phone: string
  email: string
  logo?: string
  country: string
  city: string
  responsiblePerson: string
  idPassport: string
}

export function getValidContactDraft(
  draft: ContactFormDraft,
): { data: CreateContactInput & { id?: string } } | { error: string } {
  const input: Record<string, unknown> = {
    type: draft.type,
    name: draft.name.trim(),
    phone: draft.phone.trim() || undefined,
    email: draft.email.trim() || undefined,
    logo: draft.logo?.trim() || undefined,
    country: draft.country.trim() || undefined,
    city: draft.city.trim() || undefined,
    responsiblePerson: draft.responsiblePerson.trim() || undefined,
    idPassport: draft.idPassport.trim() || undefined,
  }

  const parsed = ContactCreateSchema.safeParse(input)
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) }
  }

  return { data: { ...parsed.data, id: draft.id } }
}
