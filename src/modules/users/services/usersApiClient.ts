import { createCrudApiClient } from '@/shared/crud'
import type { UpdateUserInput, User, UsersListParams, UsersMetrics, UsersPage } from '../types'
import type { CreateStaffUserInput } from './authTypes'

const usersCrud = createCrudApiClient<
  User,
  CreateStaffUserInput,
  UpdateUserInput,
  UsersPage,
  UsersListParams
>({
  endpoint: '/api/users',
  defaultError: 'Failed to load users',
})

export function fetchUsers(input: UsersListParams = {}): Promise<UsersPage> {
  return usersCrud.list({
    limit: input.limit,
    cursor: input.cursor,
    role: input.role === 'all' ? undefined : input.role,
    search: input.search,
  })
}

export function fetchUsersMetrics(): Promise<UsersMetrics> {
  return usersCrud.request<UsersMetrics>('/analytics', { cache: 'no-store' })
}

export async function createUser(input: CreateStaffUserInput): Promise<User> {
  return usersCrud.request<User>('', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateUser(input: UpdateUserInput): Promise<User> {
  return usersCrud.request<User>(`/${input.id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deleteUser(id: string): Promise<string> {
  const result = await usersCrud.request<{ id: string }>(`/${id}`, {
    method: 'DELETE',
  })
  return result.id
}
