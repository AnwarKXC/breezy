'use client'

import { useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { toast } from '@/shared/toast/toastEvents'
import { useBranding, useSetBranding } from '@/shared/branding/BrandingContext'
import { MAX_PHONES, SOCIAL_PLATFORMS, documentQr, type OrganizationDetails, type PublicBranding } from '@/shared/branding/branding'

const inputClass =
  'block h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-ink focus:ring-1 focus:ring-ink disabled:bg-surface-muted'
const secondaryButton =
  'h-10 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:opacity-50'

function toForm(branding: PublicBranding): OrganizationDetails {
  const { name, phones, email, website, address, socials, taxId, qrLink, showQr, invoiceFooter } = branding
  return { name, phones, email, website, address, socials, taxId, qrLink, showQr, invoiceFooter }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="font-semibold text-ink">{title}</h2>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function OrganizationTab({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation()
  const router = useRouter()
  const branding = useBranding()
  const setBranding = useSetBranding()
  const [form, setForm] = useState<OrganizationDetails>(() => toForm(branding))
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const disabled = !canEdit || busy
  const qr = documentQr(form)

  const set = <K extends keyof OrganizationDetails>(key: K, value: OrganizationDetails[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const request = async (url: string, init: RequestInit, successKey: string, resetForm = false) => {
    setBusy(true)
    try {
      const res = await fetch(url, init)
      const body = (await res.json().catch(() => ({}))) as { data?: PublicBranding; error?: string }
      if (!res.ok || !body.data) throw new Error(body.error ?? 'request failed')
      setBranding(body.data)
      if (resetForm) setForm(toForm(body.data))
      router.refresh()
      toast.success(t(successKey))
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      toast.error(code.startsWith('files/') ? t('settings.organization.logoInvalid') : `${t('settings.organization.saveFailed')}${code ? `: ${code}` : ''}`)
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    const payload: OrganizationDetails = {
      ...form,
      phones: form.phones.map((p) => p.trim()).filter(Boolean),
      socials: Object.fromEntries(Object.entries(form.socials).filter(([, v]) => v?.trim())),
    }
    void request(
      '/api/settings/organization',
      { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
      'settings.organization.saved',
      true,
    )
  }

  const reset = () => {
    if (!window.confirm(t('settings.organization.resetConfirm'))) return
    void request('/api/settings/organization', { method: 'DELETE' }, 'settings.organization.resetDone', true)
  }

  const uploadLogo = (file: File | undefined) => {
    if (!file) return
    const body = new FormData()
    body.append('file', file)
    void request('/api/settings/organization/logo', { method: 'POST', body }, 'settings.organization.logoSaved')
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <div className="space-y-6">
      <Section title={t('settings.organization.identity')}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- DB-served logo, preview only */}
            <img
              src={branding.logoUrl}
              alt={branding.displayName}
              className="h-24 w-24 rounded-xl border border-line bg-surface-muted object-contain p-2"
            />
            {canEdit && (
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className={`${secondaryButton} h-9 px-3 text-xs`}>
                  {t('settings.organization.uploadLogo')}
                </button>
                {branding.hasCustomLogo && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void request('/api/settings/organization/logo', { method: 'DELETE' }, 'settings.organization.logoRemoved')}
                    className={`${secondaryButton} h-9 px-3 text-xs`}
                  >
                    {t('settings.organization.removeLogo')}
                  </button>
                )}
              </div>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => uploadLogo(e.target.files?.[0])}
            />
          </div>
          <div className="min-w-0 flex-1">
            <Field label={t('settings.organization.name')} hint={t('settings.organization.nameHint')}>
              <input
                className={inputClass}
                value={form.name}
                maxLength={80}
                placeholder={t('common.appName')}
                disabled={disabled}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
            <p className="mt-3 text-xs text-ink-muted">{t('settings.organization.logoHint')}</p>
          </div>
        </div>
      </Section>

      <Section title={t('settings.organization.contact')} description={t('settings.organization.contactHint')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('settings.organization.email')}>
            <input className={inputClass} type="email" dir="ltr" value={form.email} disabled={disabled} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label={t('settings.organization.website')}>
            <input
              className={inputClass}
              type="url"
              dir="ltr"
              placeholder="https://"
              value={form.website}
              disabled={disabled}
              onChange={(e) => set('website', e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('settings.organization.address')}>
              <textarea
                className={`${inputClass} h-auto min-h-20 py-2`}
                maxLength={300}
                value={form.address}
                disabled={disabled}
                onChange={(e) => set('address', e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="mt-5">
          <span className="mb-1.5 block text-sm font-medium text-ink">{t('settings.organization.phones')}</span>
          <ul className="space-y-2">
            {form.phones.map((phone, index) => (
              <li key={index} className="flex gap-2">
                <input
                  className={inputClass}
                  type="tel"
                  dir="ltr"
                  placeholder="+20 100 000 0000"
                  value={phone}
                  disabled={disabled}
                  aria-label={`${t('settings.organization.phones')} ${index + 1}`}
                  onChange={(e) => set('phones', form.phones.map((p, i) => (i === index ? e.target.value : p)))}
                />
                {canEdit && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => set('phones', form.phones.filter((_, i) => i !== index))}
                    className={`${secondaryButton} h-11 shrink-0`}
                  >
                    {t('settings.organization.remove')}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canEdit && form.phones.length < MAX_PHONES && (
            <button type="button" disabled={busy} onClick={() => set('phones', [...form.phones, ''])} className={`${secondaryButton} mt-2`}>
              + {t('settings.organization.addPhone')}
            </button>
          )}
        </div>
      </Section>

      <Section title={t('settings.organization.socials')} description={t('settings.organization.socialsHint')}>
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map((platform) => (
            <Field key={platform} label={t(`settings.organization.social.${platform}`)}>
              <input
                className={inputClass}
                type="url"
                dir="ltr"
                placeholder="https://"
                value={form.socials[platform] ?? ''}
                disabled={disabled}
                onChange={(e) => set('socials', { ...form.socials, [platform]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      </Section>

      <Section title={t('settings.organization.documents')} description={t('settings.organization.documentsHint')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('settings.organization.taxId')} hint={t('settings.organization.taxIdHint')}>
            <input
              className={inputClass}
              dir="ltr"
              maxLength={60}
              value={form.taxId}
              disabled={disabled}
              onChange={(e) => set('taxId', e.target.value)}
            />
          </Field>
          <Field label={t('settings.organization.invoiceFooter')} hint={t('settings.organization.invoiceFooterHint')}>
            <input
              className={inputClass}
              maxLength={160}
              placeholder={t('settings.organization.invoiceFooterPlaceholder')}
              value={form.invoiceFooter}
              disabled={disabled}
              onChange={(e) => set('invoiceFooter', e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 accent-current"
                checked={form.showQr}
                disabled={disabled}
                onChange={(e) => set('showQr', e.target.checked)}
              />
              <span className="text-sm font-medium text-ink">{t('settings.organization.showQr')}</span>
            </label>
          </div>
          {form.showQr && (
            <div className="sm:col-span-2">
              <Field
                label={t('settings.organization.qrLink')}
                hint={
                  qr
                    ? t('settings.organization.qrPreview').replace('{link}', qr.value).replace('{caption}', qr.caption || qr.value)
                    : t('settings.organization.qrEmpty')
                }
              >
                <input
                  className={inputClass}
                  type="url"
                  dir="ltr"
                  placeholder={form.website || 'https://'}
                  value={form.qrLink}
                  disabled={disabled}
                  onChange={(e) => set('qrLink', e.target.value)}
                />
              </Field>
            </div>
          )}
        </div>
      </Section>

      {canEdit && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button type="button" disabled={busy} onClick={reset} className={secondaryButton}>
            {t('settings.organization.reset')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? t('settingsPricing.saving') : t('settingsPricing.save')}
          </button>
        </div>
      )}
    </div>
  )
}
