// 📁 src/modules/guests/types.ts - Guests module types

export type GuestStatus = 'active' | 'inactive' | 'vip' | 'blacklist'

export interface Guest {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
  passportNumber?: string
  status: GuestStatus
  totalBookings: number
  totalSpent: number
  lastVisit?: Date
  createdAt: Date
}

export interface GuestFilters {
  status?: GuestStatus
  country?: string
  search?: string
}

export interface CreateGuestInput {
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
  passportNumber?: string
}