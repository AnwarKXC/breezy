'use client'

import { useState } from 'react'
import { z } from 'zod'
import { useLocale } from '@/i18n/components/LocaleContext'
import { countryOptions, isCountryCode } from '@/shared/static/countries'
import { PHONE_FORMAT_MESSAGE, isValidPhone, normalizePhone } from '@/shared/phone'

const VALID_DOC_TYPES = ['passport', 'id_card', 'drivers_license'] as const

const guestSchema = z.object({
  full_name: z.string().trim().min(2, 'Name must be at least 2 characters').regex(/^[\p{L}\p{M}\s'.-]+$/u, 'Name contains invalid characters'),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().transform(normalizePhone).refine((value) => value === '' || isValidPhone(value), PHONE_FORMAT_MESSAGE).optional(),
  document_type: z.string().min(1, 'Document type is required'),
  document_number: z.string().min(1, 'Document number is required'),
  nationality: z.string().refine((value): boolean => value === '' || isCountryCode(value), 'Select a valid nationality').optional(),
  role: z.enum(['primary_guest', 'additional_guest', 'company_guest', 'child']),
}).superRefine((data, ctx) => {
  if (!VALID_DOC_TYPES.includes(data.document_type as typeof VALID_DOC_TYPES[number])) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select a valid document type', path: ['document_type'] })
  }

  if (data.document_number.length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Document number must be at least 2 characters', path: ['document_number'] })
  }
})

export type GuestFormData = z.infer<typeof guestSchema>

interface Props {
  initial?: Partial<GuestFormData>
  onSubmit: (data: GuestFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export function GuestForm({ initial, onSubmit, onCancel, loading }: Props) {
  const locale = useLocale()
  const [form, setForm] = useState<GuestFormData>({
    full_name: initial?.full_name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    document_type: initial?.document_type ?? '',
    document_number: initial?.document_number ?? '',
    nationality: initial?.nationality ?? '',
    role: initial?.role ?? 'additional_guest',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof GuestFormData, string>>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = guestSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof GuestFormData, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof GuestFormData
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    await onSubmit(result.data)
  }

  const set = (field: keyof GuestFormData, value: string) => {
    setForm({ ...form, [field]: value })
    const clearing: Partial<Record<keyof GuestFormData, undefined>> = {}
    clearing[field] = undefined
    if (field === 'document_type' || field === 'document_number') {
      clearing.document_number = undefined
      clearing.document_type = undefined
    }
    setErrors({ ...errors, ...clearing })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-4 rounded-xl border border-[#EAEAEA] bg-[#F9F9F8] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium uppercase tracking-wide text-[#787774]">Full name *</label>
          <input
            value={form.full_name}
            onChange={(e) => set('full_name', e.target.value)}
            className={`mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-gray-400 ${errors.full_name ? 'border-rose-300' : 'border-[#EAEAEA]'}`}
          />
          {errors.full_name && <p className="mt-1 text-xs text-rose-500">{errors.full_name}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-[#787774]">Email</label>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            spellCheck={false}
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className={`mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-gray-400 ${errors.email ? 'border-rose-300' : 'border-[#EAEAEA]'}`}
          />
          {errors.email && <p className="mt-1 text-xs text-rose-500">{errors.email}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-[#787774]">Phone</label>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder="+20 10 1234 5678"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            onBlur={(e) => set('phone', normalizePhone(e.target.value))}
            className={`mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-gray-400 ${errors.phone ? 'border-rose-300' : 'border-[#EAEAEA]'}`}
          />
          {errors.phone && <p className="mt-1 text-xs text-rose-500">{errors.phone}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-[#787774]">Document type</label>
          <select
            value={form.document_type}
            onChange={(e) => set('document_type', e.target.value)}
            className={`mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-gray-400 ${errors.document_type ? 'border-rose-300' : 'border-[#EAEAEA]'}`}
          >
            <option value="" disabled>Select document type</option>
            <option value="passport">Passport</option>
            <option value="id_card">ID Card</option>
            <option value="drivers_license">Driver&apos;s License</option>
          </select>
          {errors.document_type && <p className="mt-1 text-xs text-rose-500">{errors.document_type}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-[#787774]">Document number</label>
          <input
            dir="ltr"
            autoCapitalize="characters"
            spellCheck={false}
            value={form.document_number}
            onChange={(e) => set('document_number', e.target.value)}
            className={`mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-gray-400 ${errors.document_number || errors.document_type ? 'border-rose-300' : 'border-[#EAEAEA]'}`}
          />
          {errors.document_number && <p className="mt-1 text-xs text-rose-500">{errors.document_number}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-[#787774]">Nationality</label>
          <select
            value={form.nationality ?? ''}
            onChange={(e) => set('nationality', e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#EAEAEA] bg-white px-3 py-2.5 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-gray-400"
          >
            <option value="">—</option>
            {countryOptions(locale).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-[#787774]">Role</label>
          <select
            value={form.role}
            onChange={(e) => set('role', e.target.value as GuestFormData['role'])}
            className="mt-1 w-full rounded-lg border border-[#EAEAEA] bg-white px-3 py-2.5 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-gray-400"
          >
            <option value="additional_guest">Adult</option>
            <option value="child">Child</option>
            <option value="primary_guest">Primary</option>
            <option value="company_guest">Company</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[#EAEAEA] bg-white px-4 py-2 text-sm font-medium text-[#333333] transition-colors hover:bg-accent/10"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Saving...' : initial ? 'Update' : 'Add Guest'}
        </button>
      </div>
    </form>
  )
}
