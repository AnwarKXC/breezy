import type { UsersPage, User } from '../types'

export type UserResponse = Omit<User, 'password'>

export function userJson(user: User): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    createdAt: user.createdAt,
  }
}

export function usersPageJson(page: UsersPage) {
  return {
    data: page.data.map(userJson),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
    total: page.total,
  }
}
