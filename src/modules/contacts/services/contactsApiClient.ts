import { createCrudApiClient } from '@/shared/crud'
import type { CompanyPriceOverride, Contact, ContactsListParams, ContactsMetrics, ContactsPage, CreateContactInput, CreatePriceOverrideInput, UpdateContactInput } from '../types'

const contactsCrud = createCrudApiClient<
  Contact,
  CreateContactInput,
  UpdateContactInput,
  ContactsPage,
  ContactsListParams
>({
  endpoint: '/api/contacts',
  defaultError: 'Failed to load contacts',
})

export function fetchContacts(params: ContactsListParams = {}): Promise<ContactsPage> {
  return contactsCrud.list({
    limit: params.limit,
    cursor: params.cursor,
    type: params.type === 'all' ? undefined : params.type,
    search: params.search,
  })
}

export async function fetchContactById(id: string): Promise<Contact | null> {
  try {
    return await contactsCrud.request<Contact>(`/${id}`, { cache: 'no-store' })
  } catch {
    return null
  }
}

export function fetchContactsMetrics(): Promise<ContactsMetrics> {
  return contactsCrud.request<ContactsMetrics>('/analytics', { cache: 'no-store' })
}

export async function createContact(input: CreateContactInput): Promise<Contact> {
  return contactsCrud.request<Contact>('', {
    method: 'POST',
    body: JSON.stringify(input),
    toast: false,
  })
}

export async function updateContact(id: string, input: UpdateContactInput): Promise<Contact> {
  return contactsCrud.request<Contact>(`/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
    toast: false,
  })
}

export async function deleteContact(id: string): Promise<string> {
  const result = await contactsCrud.request<{ id: string }>(`/${id}`, {
    method: 'DELETE',
    toast: false,
  })
  return result.id
}

export async function fetchPriceOverrides(contactId: string): Promise<CompanyPriceOverride[]> {
  return await contactsCrud.request<CompanyPriceOverride[]>(`/${contactId}/price-overrides`)
}

export async function upsertPriceOverridesApi(
  contactId: string,
  overrides: CreatePriceOverrideInput[],
): Promise<CompanyPriceOverride[]> {
  return await contactsCrud.request<CompanyPriceOverride[]>(`/${contactId}/price-overrides`, {
    method: 'PUT',
    body: JSON.stringify({ overrides }),
  })
}
