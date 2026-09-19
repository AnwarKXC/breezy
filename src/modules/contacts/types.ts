import type { PaginatedResponse, PaginationParams } from '@/shared/pagination/types'

export type ContactType = 'company' | 'individual'

export type OccupancyCode = 'S' | 'D' | 'T'

export interface Contact {
  id: string
  type: ContactType
  name: string
  phone?: string
  email?: string

  logo?: string
  country?: string
  city?: string
  responsiblePerson?: string

  idPassport?: string

  createdAt: string
  updatedAt: string
}

export interface CompanyPriceOverride {
  id: string
  contactId: string
  roomCategory: string
  occupancyCode: OccupancyCode
  price: number
  currency?: string
}

export interface CreateContactInput {
  type: ContactType
  name: string
  phone?: string
  email?: string

  logo?: string
  country?: string
  city?: string
  responsiblePerson?: string

  idPassport?: string
}

export interface UpdateContactInput {
  id: string
  name?: string
  phone?: string
  email?: string

  logo?: string
  country?: string
  city?: string
  responsiblePerson?: string

  idPassport?: string
}

export interface UpdatePriceOverrideInput {
  id: string
  roomCategory?: string
  occupancyCode?: OccupancyCode
  price?: number
  currency?: string
}

export interface CreatePriceOverrideInput {
  contactId: string
  roomCategory: string
  occupancyCode: OccupancyCode
  price: number
  currency?: string
}

export interface ContactsListParams extends PaginationParams {
  type?: ContactType | 'all'
  search?: string
}

export type ContactsPage = PaginatedResponse<Contact>

export interface ContactsMetrics {
  total: number
  company: number
  individual: number
}
