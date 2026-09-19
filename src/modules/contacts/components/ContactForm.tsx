'use client'
import { FloatingInput, FloatingSelect } from '@/shared/components/FloatingField'
import { useLocale } from '@/i18n/components/LocaleContext'
import { countryOptions } from '@/shared/static/countries'
import type { ContactFormDraft, ContactFormMode } from '../hooks/useContactForm'
import { ContactTypeSelector } from './ContactTypeSelector'
import { LogoUpload } from './LogoUpload'
import { useEscapeKey } from '@/shared/hooks/useEscapeKey'
interface ContactFormLabels {
  createTitle: string
  editTitle: string
  description: string
  saving: string
  close: string
  cancel: string
  save: string
  type: string
  name: string
  phone: string
  email: string
  company: string
  individual: string
  country: string
  city: string
  responsiblePerson: string
  idPassport: string
  logo: string
}

interface ContactFormProps {
  draft: ContactFormDraft
  error: string | null
  errorDescription: string
  fieldErrors: Record<string, string>
  phoneError: string | null
  phoneErrorDescription: string
  labels: ContactFormLabels
  mode: ContactFormMode
  saving: boolean
  onClose: () => void
  onSubmit: () => void
  onUpdate: (field: keyof ContactFormDraft, value: string) => void
}

export function ContactForm(props: ContactFormProps) {
  const locale = useLocale()
  const isCreate = props.mode === 'create'
  const isCompany = props.draft.type === 'company'
  useEscapeKey(props.onClose, !props.saving)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 px-4 py-6">
      <form
        role="dialog" aria-modal="true"
        className="max-h-[calc(100dvh-3rem)] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-6"
        onSubmit={(event) => {
          event.preventDefault()
          props.onSubmit()
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#1A1A1A]">
              {isCreate ? props.labels.createTitle : props.labels.editTitle}
            </h2>
            <p className="mt-1 text-sm text-[#787774]">{props.labels.description}</p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg bg-[#F5F5F5] px-3 py-1 text-sm text-[#555555] transition-all duration-200 hover:bg-[#EAEAEA]"
          >
            {props.labels.close}
          </button>
        </div>
        {isCreate ? (
          <ContactTypeSelector
            selected={props.draft.type}
            companyLabel={props.labels.company}
            individualLabel={props.labels.individual}
            typeLabel={props.labels.type}
            onChange={(value) => props.onUpdate('type', value)}
          />
        ) : null}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FloatingInput
              required
              label={<>{props.labels.name} <span className="text-[#9F2F2D]">*</span></>}
              value={props.draft.name}
              onChange={(event) => props.onUpdate('name', event.target.value)}
            />
            {props.fieldErrors.name ? (
              <p className="mt-1 text-sm text-[#9F2F2D]">{props.fieldErrors.name}</p>
            ) : null}
          </div>
          <div>
            <FloatingInput
              label={props.labels.phone}
              type="tel"
              value={props.draft.phone}
              onChange={(event) => props.onUpdate('phone', event.target.value)}
            />
            {(props.phoneError ?? props.fieldErrors.phone) ? (
              <p className="mt-1 text-sm text-[#9F2F2D]">{props.phoneErrorDescription || props.fieldErrors.phone}</p>
            ) : null}
          </div>
          <div>
            <FloatingInput
              label={props.labels.email}
              type="email"
              value={props.draft.email}
              onChange={(event) => props.onUpdate('email', event.target.value)}
            />
            {props.fieldErrors.email ? (
              <p className="mt-1 text-sm text-[#9F2F2D]">{props.fieldErrors.email}</p>
            ) : null}
          </div>
          {isCompany ? (
            <>
              <div>
                <FloatingSelect
                  label={props.labels.country}
                  value={props.draft.country}
                  onChange={(event) => props.onUpdate('country', event.target.value)}
                >
                  <option value="">—</option>
                  {countryOptions(locale).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </FloatingSelect>
                {props.fieldErrors.country ? (
                  <p className="mt-1 text-sm text-[#9F2F2D]">{props.fieldErrors.country}</p>
                ) : null}
              </div>
              <div>
                <FloatingInput
                  label={props.labels.city}
                  value={props.draft.city}
                  onChange={(event) => props.onUpdate('city', event.target.value)}
                />
                {props.fieldErrors.city ? (
                  <p className="mt-1 text-sm text-[#9F2F2D]">{props.fieldErrors.city}</p>
                ) : null}
              </div>
              <div>
                <FloatingInput
                  label={props.labels.responsiblePerson}
                  value={props.draft.responsiblePerson}
                  onChange={(event) => props.onUpdate('responsiblePerson', event.target.value)}
                />
                {props.fieldErrors.responsiblePerson ? (
                  <p className="mt-1 text-sm text-[#9F2F2D]">{props.fieldErrors.responsiblePerson}</p>
                ) : null}
              </div>
              <LogoUpload
                value={props.draft.logo}
                label={props.labels.logo}
                onChange={(value) => props.onUpdate('logo', value)}
              />
            </>
          ) : (
            <div>
              <FloatingInput
                label={props.labels.idPassport}
                  dir="ltr"
                  autoCapitalize="characters"
                  spellCheck={false}
                value={props.draft.idPassport}
                onChange={(event) => props.onUpdate('idPassport', event.target.value)}
              />
              {props.fieldErrors.idPassport ? (
                <p className="mt-1 text-sm text-[#9F2F2D]">{props.fieldErrors.idPassport}</p>
              ) : null}
            </div>
          )}
        </div>
        {props.error ? <p className="mt-4 text-sm text-[#9F2F2D]">{props.errorDescription}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-xl bg-[#F5F5F5] px-4 py-2 text-sm font-bold text-[#555555] transition-all duration-200 hover:bg-[#EAEAEA]"
          >
            {props.labels.cancel}
          </button>
          <button
            type="submit"
            disabled={props.saving}
            className="rounded-xl bg-[#1A1A1A] px-4 py-2 text-sm font-bold text-white transition-all duration-200 hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {props.saving ? props.labels.saving : props.labels.save}
          </button>
        </div>
      </form>
    </div>
  )
}
