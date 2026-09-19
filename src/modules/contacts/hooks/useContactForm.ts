'use client'

import { useCallback, useState } from 'react'
import { toast } from '@/shared/toast/toastEvents'
import type { Contact, CreateContactInput } from '../types'
import { getValidContactDraft, type ContactFormDraft } from '../utils/contactValidation'
import { ContactCreateSchema } from '@/shared/validation'
import { createContact, updateContact } from '../services/contactsApiClient'

export type ContactFormMode = 'create' | 'edit'
export type { ContactFormDraft }
export type SavedContactDraft = CreateContactInput & { id?: string }
export type MutationCallback = (savedDraft?: SavedContactDraft) => void

type ContactsActions = { triggerMutation: MutationCallback }

const emptyDraft: ContactFormDraft = {
  type: 'company',
  name: '',
  phone: '',
  email: '',
  logo: '',
  country: '',
  city: '',
  responsiblePerson: '',
  idPassport: '',
}

export function useContactForm({ triggerMutation }: ContactsActions) {
  const [draft, setDraft] = useState<ContactFormDraft>(emptyDraft)
  const [mode, setMode] = useState<ContactFormMode>('create')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const closeForm = useCallback(() => {
    setOpen(false)
    setError(null)
    setPhoneError(null)
    setFieldErrors({})
  }, [])

  const openCreateForm = useCallback(() => {
    setDraft(emptyDraft)
    setMode('create')
    setError(null)
    setPhoneError(null)
    setFieldErrors({})
    setOpen(true)
  }, [])

  const openEditForm = useCallback((contact: Contact) => {
    setDraft({
      type: contact.type,
      name: contact.name,
      phone: contact.phone ?? '',
      email: contact.email ?? '',
      logo: contact.logo ?? '',
      country: contact.country ?? '',
      city: contact.city ?? '',
      responsiblePerson: contact.responsiblePerson ?? '',
      idPassport: contact.idPassport ?? '',
      id: contact.id,
    })
    setMode('edit')
    setError(null)
    setPhoneError(null)
    setFieldErrors({})
    setOpen(true)
  }, [])

  const updateDraft = useCallback((field: keyof ContactFormDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    if (field === 'phone') setPhoneError(null)
    setFieldErrors((current) => {
      if (current[field]) {
        const next = { ...current }
        delete next[field]
        return next
      }
      return current
    })
  }, [])

  const submitForm = useCallback(async () => {
    setSaving(true)
    setError(null)
    setPhoneError(null)
    setFieldErrors({})

    try {
      const result = getValidContactDraft(draft)
      if ('error' in result) {
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
          const errors: Record<string, string> = {}
          for (const issue of parsed.error.issues) {
            const field = String(issue.path[0])
            if (field && !errors[field]) errors[field] = issue.message
          }
          setFieldErrors(errors)
        }
        setError(result.error)
        return
      }
      const validDraft = result.data

      if (mode === 'create') {
        await createContact(validDraft)
        toast.success('Contact created')
        triggerMutation()
      } else if (validDraft.id) {
        const { name, phone, email, country, city, responsiblePerson, idPassport, logo } = validDraft
        await updateContact(validDraft.id, { id: validDraft.id, name, phone, email, country, city, responsiblePerson, idPassport, logo })
        toast.success('Contact updated')
        triggerMutation(validDraft)
      }
      setOpen(false)
    } catch (submitError) {
      const message = submitError instanceof Error
        ? submitError.message
        : submitError && typeof submitError === 'object' && 'message' in submitError
          ? String((submitError as { message: unknown }).message ?? '')
          : 'contacts/request_failed'
      if (message === 'contacts/phone_exists') {
        setPhoneError(message)
      } else {
        toast.error('Operation failed', { description: message })
        setError(message)
      }
    } finally {
      setSaving(false)
    }
  }, [draft, mode, triggerMutation])

  return {
    draft,
    error,
    phoneError,
    fieldErrors,
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
