'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { toast } from '@/shared/toast/toastEvents'
import { emailErrorText, type EmailAccount } from './emailApi'

interface Preset {
  id: 'gmail' | 'zoho' | 'custom'
  imapHost: string
  imapPort: number
  imapSecure: boolean
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
}

const PRESETS: Preset[] = [
  { id: 'gmail', imapHost: 'imap.gmail.com', imapPort: 993, imapSecure: true, smtpHost: 'smtp.gmail.com', smtpPort: 465, smtpSecure: true },
  { id: 'zoho', imapHost: 'imap.zoho.com', imapPort: 993, imapSecure: true, smtpHost: 'smtp.zoho.com', smtpPort: 465, smtpSecure: true },
  { id: 'custom', imapHost: '', imapPort: 993, imapSecure: true, smtpHost: '', smtpPort: 465, smtpSecure: true },
]

const input =
  'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-ink disabled:opacity-60'
const label = 'mb-1.5 block text-sm font-medium text-ink'
const secondaryButton =
  'h-10 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:opacity-50'

function presetFor(account: EmailAccount | null): Preset['id'] {
  if (!account) return 'gmail'
  return PRESETS.find((p) => p.id !== 'custom' && p.imapHost === account.imapHost)?.id ?? 'custom'
}

export function EmailAccountForm({
  account,
  canEdit,
  onSaved,
}: {
  account: EmailAccount | null
  canEdit: boolean
  onSaved: (account: EmailAccount | null) => void
}) {
  const { t } = useTranslation()
  const [preset, setPreset] = useState<Preset['id']>(presetFor(account))
  const [form, setForm] = useState(() => ({
    displayName: account?.displayName ?? '',
    email: account?.email ?? '',
    username: account?.username ?? '',
    password: '',
    imapHost: account?.imapHost ?? PRESETS[0].imapHost,
    imapPort: account?.imapPort ?? PRESETS[0].imapPort,
    imapSecure: account?.imapSecure ?? true,
    smtpHost: account?.smtpHost ?? PRESETS[0].smtpHost,
    smtpPort: account?.smtpPort ?? PRESETS[0].smtpPort,
    smtpSecure: account?.smtpSecure ?? true,
  }))
  const [busy, setBusy] = useState(false)
  const disabled = !canEdit || busy

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const choosePreset = (id: Preset['id']) => {
    setPreset(id)
    if (id === 'custom') return
    const { imapHost, imapPort, imapSecure, smtpHost, smtpPort, smtpSecure } = PRESETS.find((p) => p.id === id)!
    setForm((current) => ({ ...current, imapHost, imapPort, imapSecure, smtpHost, smtpPort, smtpSecure }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/settings/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // The login name is the address for almost every provider.
        body: JSON.stringify({ ...form, username: form.username || form.email }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? 'email/save_failed')
      set('password', '')
      onSaved(body.data)
      toast.success(t('settings.email.account.saved'))
    } catch (error) {
      toast.error(emailErrorText(t, (error as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (!window.confirm(t('settings.email.account.disconnectConfirm'))) return
    setBusy(true)
    try {
      const res = await fetch('/api/settings/email', { method: 'DELETE' })
      if (!res.ok) throw new Error('email/save_failed')
      onSaved(null)
      toast.success(t('settings.email.account.disconnected'))
    } catch {
      toast.error(t('settings.email.errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="font-semibold text-ink">{t('settings.email.account.provider')}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t('settings.email.account.provider')}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={preset === p.id}
              disabled={disabled}
              onClick={() => choosePreset(p.id)}
              className={`min-h-11 rounded-lg border px-4 py-2 text-start text-sm font-medium transition-colors disabled:opacity-60 ${
                preset === p.id ? 'border-ink bg-surface-muted text-ink' : 'border-line bg-white text-ink-muted hover:text-ink'
              }`}
            >
              {t(`settings.email.presets.${p.id}`)}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t(`settings.email.help.${preset}`)}</p>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="font-semibold text-ink">{t('settings.email.account.credentials')}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="mail-name">{t('settings.email.account.displayName')}</label>
            <input id="mail-name" className={input} value={form.displayName} disabled={disabled} maxLength={120}
              placeholder={t('settings.email.account.displayNamePlaceholder')}
              onChange={(e) => set('displayName', e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="mail-email">{t('settings.email.account.email')}</label>
            <input id="mail-email" type="email" dir="ltr" required autoComplete="off" className={input} value={form.email}
              disabled={disabled} onChange={(e) => set('email', e.target.value)} />
          </div>
          {preset === 'custom' && (
            <div>
              <label className={label} htmlFor="mail-user">{t('settings.email.account.username')}</label>
              <input id="mail-user" dir="ltr" autoComplete="off" className={input} value={form.username}
                placeholder={form.email} disabled={disabled} onChange={(e) => set('username', e.target.value)} />
            </div>
          )}
          <div>
            <label className={label} htmlFor="mail-pass">
              {t(preset === 'gmail' ? 'settings.email.account.appPassword' : 'settings.email.account.password')}
            </label>
            <input id="mail-pass" type="password" dir="ltr" autoComplete="new-password" className={input}
              value={form.password} required={!account} disabled={disabled}
              placeholder={account ? t('settings.email.account.passwordKeep') : ''}
              onChange={(e) => set('password', preset === 'gmail' ? e.target.value.replace(/\s/g, '') : e.target.value)} />
          </div>
        </div>
      </section>

      {preset === 'custom' && (
        <section className="grid gap-4 lg:grid-cols-2">
          {(['imap', 'smtp'] as const).map((kind) => (
            <div key={kind} className="rounded-xl border border-line bg-white p-5">
              <h2 className="font-semibold text-ink">{t(`settings.email.account.${kind}`)}</h2>
              <p className="mt-1 text-sm text-ink-muted">{t(`settings.email.account.${kind}Hint`)}</p>
              <div className="mt-4 grid grid-cols-[1fr_6rem] gap-3">
                <div>
                  <label className={label} htmlFor={`${kind}-host`}>{t('settings.email.account.host')}</label>
                  <input id={`${kind}-host`} dir="ltr" required className={input} disabled={disabled}
                    placeholder="mail.yourhotel.com"
                    value={form[`${kind}Host`]} onChange={(e) => set(`${kind}Host`, e.target.value)} />
                </div>
                <div>
                  <label className={label} htmlFor={`${kind}-port`}>{t('settings.email.account.port')}</label>
                  <input id={`${kind}-port`} type="number" dir="ltr" required min={1} max={65535} className={input}
                    disabled={disabled} value={form[`${kind}Port`]}
                    onChange={(e) => set(`${kind}Port`, Number(e.target.value))} />
                </div>
              </div>
              <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-ink">
                <input type="checkbox" className="h-4 w-4" disabled={disabled} checked={form[`${kind}Secure`]}
                  onChange={(e) => set(`${kind}Secure`, e.target.checked)} />
                {t('settings.email.account.ssl')}
              </label>
            </div>
          ))}
        </section>
      )}

      {canEdit && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {account ? (
            <button type="button" disabled={busy} onClick={() => void disconnect()} className={`${secondaryButton} text-red-600`}>
              {t('settings.email.account.disconnect')}
            </button>
          ) : <span />}
          <button type="submit" disabled={busy}
            className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50">
            {busy ? t('settings.email.account.testing') : t('settings.email.account.save')}
          </button>
        </div>
      )}
    </form>
  )
}
