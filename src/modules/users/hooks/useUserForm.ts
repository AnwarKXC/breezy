'use client'

import { useCallback, useState } from 'react'
import type { User } from '../types'
import { getValidUserDraft, type UserFormDraft } from '../utils/userFormValidation'
import type { useUsersView } from './useUsersView'

type UsersActions = Pick<ReturnType<typeof useUsersView>, 'createUser' | 'updateUser'>
export type UserFormMode = 'create' | 'edit'
export type { UserFormDraft }

const emptyDraft: UserFormDraft = {
  name: '',
  email: '',
  password: '',
  phone: '',
  role: 'front_desk',
}

export function useUserForm({ createUser, updateUser }: UsersActions) {
  const [draft, setDraft] = useState<UserFormDraft>(emptyDraft)
  const [mode, setMode] = useState<UserFormMode>('create')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const closeForm = useCallback(() => {
    setOpen(false)
    setError(null)
  }, [])

  const openCreateForm = useCallback(() => {
    setDraft(emptyDraft)
    setMode('create')
    setError(null)
    setOpen(true)
  }, [])

  const openEditForm = useCallback((user: User) => {
    setDraft({
      id: user.id,
      name: user.name,
      email: user.email,
      password: '',
      phone: user.phone,
      role: user.role,
    })
    setMode('edit')
    setError(null)
    setOpen(true)
  }, [])

  const updateDraft = useCallback((field: keyof UserFormDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }, [])

  const submitForm = useCallback(async () => {
    setSaving(true)
    setError(null)

    try {
      const validDraft = getValidUserDraft(draft, mode === 'create')
      if (!validDraft) {
        setError('auth/invalid_form')
        return
      }

      if (mode === 'create') {
        await createUser(validDraft)
      } else if (validDraft.id) {
        const { id, name, password, phone, role } = validDraft
        await updateUser({ id, name, ...(password ? { password } : {}), phone, role })
      }
      setOpen(false)
    } catch (submitError) {
      const message = submitError instanceof Error
        ? submitError.message
        : submitError && typeof submitError === 'object' && 'message' in submitError
          ? String((submitError as { message: unknown }).message ?? '')
          : 'auth/request_failed'
      setError(message)
    } finally {
      setSaving(false)
    }
  }, [createUser, draft, mode, updateUser])

  return {
    draft,
    error,
    mode,
    open,
    saving,
    closeForm,
    openCreateForm,
    openEditForm,
    submitForm,
    updateDraft,
  }
}
