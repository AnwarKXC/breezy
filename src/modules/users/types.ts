import type { PaginatedResponse, PaginationParams } from '@/shared/pagination/types'
import type { UserRole } from '@/types/auth'
export type { UserRole } from '@/types/auth'
export { USERS_COLLECTION } from '@/types/auth'

export interface UserTimestamp {
  nanoseconds: number
  seconds: number
}

export interface User {
  id: string
  name: string
  email: string
  password?: string
  role: UserRole
  phone: string
  createdAt: UserTimestamp
}

export interface CreateUserInput {
  name: string
  email: string
  password: string
  role: UserRole
  phone: string
}

export interface UpdateUserInput {
  id: string
  name?: string
  email?: string
  password?: string
  role?: UserRole
  phone?: string
}

export interface UsersListParams extends PaginationParams {
  role?: UserRole | 'all'
  search?: string
}

export type UsersPage = PaginatedResponse<User>
export type UsersMetrics = Record<UserRole | 'total', number>
