import type { UserRole } from '../types'

export interface LoginInput {
  email: string
  password: string
}

export interface ChangePasswordInput {
  currentPassword: string
  nextPassword: string
}

export interface CreateStaffUserInput {
  name: string
  email: string
  password: string
  phone: string
  role: UserRole
}

export interface AuthUserResult {
  id: string
  email: string
}
