import { useMemo, useState } from 'react'

import { useTranslation } from '@/i18n/hooks/useTranslation'
import { DropdownSelect } from '@/shared/components/DropdownSelect'
import { FloatingInput } from '@/shared/components/FloatingField'
import type { UserRole } from '../types'
import { USER_ROLES } from '../utils/userUi'
import type { UserFormDraft, UserFormMode } from '../hooks/useUserForm'
import { EyeIcon, EyeOffIcon } from './UserIcons'
import { useEscapeKey } from '@/shared/hooks/useEscapeKey'
import { useAuth } from '@/modules/auth'

interface UserFormProps {
  draft: UserFormDraft
  error: string | null
  errorDescription: string
  labels: Record<string, string>
  mode: UserFormMode
  roleLabels: Record<UserRole, string>
  saving: boolean
  onClose: () => void
  onSubmit: () => void
  onUpdate: (field: keyof UserFormDraft, value: string) => void
}

export function UserForm(props: UserFormProps) {
  const isCreate = props.mode === 'create'
  const isEdit = props.mode === 'edit'
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  useEscapeKey(props.onClose, !props.saving)
  const emailError = props.error === 'auth/email_already_exists' ? props.errorDescription : null
  const formError = props.error && props.error !== 'auth/email_already_exists' ? props.errorDescription : null
  const { role: actorRole } = useAuth()
  // Only admins can grant the admin role (enforced on the server too).
  const roleOptions = useMemo(
    () =>
      USER_ROLES.filter((role) => actorRole === 'admin' || role !== 'admin' || props.draft.role === 'admin').map((role) => ({
        label: props.roleLabels[role],
        value: role,
      })),
    [actorRole, props.draft.role, props.roleLabels],
  )

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
            <p className="mt-1 text-sm text-[#787774]">{props.labels.formDescription}</p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg bg-[#F5F5F5] px-3 py-1 text-sm text-[#555555] transition-all duration-200 hover:bg-[#EAEAEA]"
          >
            {props.labels.close}
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <FloatingInput
            required
            label={props.labels.name}
            value={props.draft.name}
            onChange={(event) => props.onUpdate('name', event.target.value)}
          />
          <div>
            <FloatingInput
              required
              disabled={isEdit}
              label={props.labels.email}
              type="email"
              value={props.draft.email}
              onChange={(event) => {
                if (!isEdit) props.onUpdate('email', event.target.value)
              }}
            />
            {emailError ? <p className="text-sm text-[#9F2F2D]">{emailError}</p> : null}
          </div>
          <FloatingInput
            required
            label={props.labels.phone}
            type="tel"
            value={props.draft.phone}
            onChange={(event) => props.onUpdate('phone', event.target.value)}
          />
          <div className="floating-field is-filled">
            <DropdownSelect
              ariaLabel={props.labels.role}
              onChange={(value) => props.onUpdate('role', value)}
              options={roleOptions}
              value={props.draft.role}
            />
            <span className="floating-label">{props.labels.role}</span>
          </div>
          {isCreate || isEdit ? (
            <div className="sm:col-span-2">
              <FloatingInput
                required={isCreate}
                label={props.labels.password}
                autoComplete="new-password"
                minLength={8}
                type={showPassword ? 'text' : 'password'}
                value={props.draft.password}
                onChange={(event) => props.onUpdate('password', event.target.value)}
                trailing={
                <button
                  type="button"
                  aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute end-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#787774] transition-all duration-200 hover:bg-[#F5F5F5] hover:text-[#1A1A1A]"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
                }
              />
            </div>
          ) : null}
        </div>

        {formError ? <p className="mt-4 text-sm text-[#9F2F2D]">{formError}</p> : null}

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

