import { UserCreateSchema, UserUpdateSchema } from '@/shared/validation'
import type { CreateStaffUserInput } from '../services/authTypes'
import type { UserRole } from '../types'

export interface UserFormDraft {
  id?: string
  name: string
  email: string
  password: string
  phone: string
  role: string
}

export function getValidUserDraft(draft: UserFormDraft, isCreate: boolean) {
  const input = {
    name: draft.name.trim(),
    email: draft.email.trim(),
    password: draft.password.trim(),
    phone: draft.phone.trim(),
    role: draft.role,
  }

  if (isCreate) {
    const parsed = UserCreateSchema.safeParse(input)
    if (!parsed.success) return null
    return { ...parsed.data, id: draft.id } as CreateStaffUserInput & { id?: string }
  }

  const updateInput: Record<string, string> = { id: draft.id! }
  if (input.name) updateInput.name = input.name
  if (input.email) updateInput.email = input.email
  if (input.password) updateInput.password = input.password
  if (input.phone) updateInput.phone = input.phone
  if (input.role) updateInput.role = input.role

  const parsed = UserUpdateSchema.safeParse(updateInput)
  if (!parsed.success) return null
  return { ...parsed.data, id: draft.id } as CreateStaffUserInput & { id?: string }
}
