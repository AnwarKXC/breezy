'use client'

import { useState } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { toast } from '@/shared/toast/toastEvents'

interface ContactCreateData {
  type: 'individual' | 'company'
  name: string
  phone?: string
  email?: string
  idPassport?: string
  country?: string
  city?: string
  responsiblePerson?: string
}

interface NewContactModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (contact: { id: string; name: string; type: string; phone: string; email: string | null }) => void
}

export function NewContactModal({ isOpen, onClose, onCreated }: NewContactModalProps) {
  const [tab, setTab] = useState<'individual' | 'company'>('individual')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [idPassport, setIdPassport] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [responsiblePerson, setResponsiblePerson] = useState('')
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(t('reservations.nameRequired'))
      return
    }

    setSaving(true)
    try {
      const optional = (value: string) => value.trim() || undefined
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: tab,
          name: name.trim(),
          phone: optional(phone),
          email: optional(email),
          ...(tab === 'individual' ? { idPassport: optional(idPassport) } : {}),
          ...(tab === 'company' ? { country: optional(country), city: optional(city), responsiblePerson: optional(responsiblePerson) } : {}),
        }),
      })
      const json = (await res.json().catch(() => null)) as { data?: { id: string; name: string; type: string; phone?: string; email?: string }; error?: string } | null
      const data = json?.data
      if (!res.ok || !data) {
        toast.error(json?.error === 'contacts/phone_exists' ? t('reservations.failedToCreateContact') + ' (phone already exists)' : (json?.error ?? t('reservations.failedToCreateContact')))
        return
      }

      toast.success(t(tab === 'company' ? 'reservations.companyCreated' : 'reservations.contactCreated'))
      onCreated({
        id: data.id,
        name: data.name,
        type: data.type,
        phone: data.phone ?? '',
        email: data.email ?? null,
      })
      reset()
      onClose()
    } catch (err) {
      toast.error(t('reservations.failedToCreateContact'))
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setTab('individual')
    setName('')
    setPhone('')
    setEmail('')
    setIdPassport('')
    setCountry('')
    setCity('')
    setResponsiblePerson('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onClose}>
      <div className="mx-4 w-full max-w-lg rounded-xl border border-[#EAEAEA] bg-white p-6 " onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1A1A1A]">{t('reservations.newContactTitle')}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[#787774] hover:bg-[#F5F5F5] hover:text-[#555555]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex rounded-lg border border-[#EAEAEA] p-0.5 bg-[#F9F9F8]">
          <button
            type="button"
            onClick={() => setTab('individual')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'individual' ? 'bg-white text-[#1A1A1A] ' : 'text-[#787774] hover:text-[#333333]'
            }`}
          >
            {t('reservations.individualTab')}
          </button>
          <button
            type="button"
            onClick={() => setTab('company')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'company' ? 'bg-white text-[#1A1A1A] ' : 'text-[#787774] hover:text-[#333333]'
            }`}
          >
            {t('reservations.companyTab')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-[#787774]">{tab === 'company' ? t('reservations.companyNameLabel') : t('reservations.fullNameLabel')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tab === 'company' ? t('reservations.placeholderCompanyName') : t('reservations.placeholderFullName')}
              className="mt-1 h-9 w-full rounded-lg border border-[#EAEAEA] bg-white px-3 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-gray-400"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#787774]">{t('reservations.phoneLabel')}</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('reservations.placeholderPhoneNumber')}
                className="mt-1 h-9 w-full rounded-lg border border-[#EAEAEA] bg-white px-3 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-gray-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#787774]">{t('reservations.emailLabel')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('reservations.placeholderEmailOptional')}
                className="mt-1 h-9 w-full rounded-lg border border-[#EAEAEA] bg-white px-3 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-gray-400"
              />
            </div>
          </div>

          {tab === 'individual' && (
            <div>
              <label className="text-xs font-medium text-[#787774]">{t('reservations.idPassportLabel')}</label>
              <input
                type="text"
                value={idPassport}
                onChange={(e) => setIdPassport(e.target.value)}
                placeholder={t('reservations.placeholderIdPassport')}
                className="mt-1 h-9 w-full rounded-lg border border-[#EAEAEA] bg-white px-3 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-gray-400"
              />
            </div>
          )}

          {tab === 'company' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#787774]">{t('reservations.countryLabel')}</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder={t('reservations.placeholderCountry')}
                    className="mt-1 h-9 w-full rounded-lg border border-[#EAEAEA] bg-white px-3 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#787774]">{t('reservations.cityLabel')}</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder={t('reservations.placeholderCity')}
                    className="mt-1 h-9 w-full rounded-lg border border-[#EAEAEA] bg-white px-3 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-gray-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#787774]">{t('reservations.responsiblePersonLabel')}</label>
                <input
                  type="text"
                  value={responsiblePerson}
                  onChange={(e) => setResponsiblePerson(e.target.value)}
                  placeholder={t('reservations.placeholderContactPerson')}
                  className="mt-1 h-9 w-full rounded-lg border border-[#EAEAEA] bg-white px-3 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-gray-400"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-[#EAEAEA] bg-white px-4 text-sm font-medium text-[#555555] transition-colors hover:bg-[#F9F9F8]"
            >
              {t('reservations.cancelButton')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 rounded-lg bg-[#1A1A1A] px-4 text-sm font-medium text-white transition-colors hover:bg-[#333333] disabled:opacity-40"
            >
              {saving ? t('common.saving') : t('reservations.createButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
