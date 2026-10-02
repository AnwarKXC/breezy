'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { toast } from '@/shared/toast/toastEvents'
import { DEFAULT_PRIMARY_COLOR, PRIMARY_COLOR_PRESETS, normalizeHexColor, themeCssVars } from '@/shared/theme/theme'

export interface ThemeTabProps {
  initialPrimaryColor: string
  canEdit: boolean
}

/** Live preview: inline vars on <html> override the server-injected theme until reload. */
function previewTheme(primary: string) {
  for (const [name, value] of Object.entries(themeCssVars(primary))) {
    document.documentElement.style.setProperty(name, value)
  }
}

const secondaryButton =
  'h-10 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:opacity-50'

export function ThemeTab({ initialPrimaryColor, canEdit }: ThemeTabProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [saved, setSaved] = useState(initialPrimaryColor)
  const [color, setColor] = useState(initialPrimaryColor)
  const [hexInput, setHexInput] = useState(initialPrimaryColor)
  const [busy, setBusy] = useState(false)

  const pick = (value: string) => {
    setHexInput(value.toUpperCase())
    const hex = normalizeHexColor(value)
    if (!hex) return
    setColor(hex)
    previewTheme(hex)
  }

  const persist = async (method: 'PUT' | 'DELETE', next: string) => {
    setBusy(true)
    try {
      const res = await fetch('/api/settings/theme', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'PUT' ? JSON.stringify({ primaryColor: next }) : undefined,
      })
      if (!res.ok) throw new Error('theme save failed')
      setSaved(next)
      pick(next)
      router.refresh()
      toast.success(t(method === 'PUT' ? 'settings.theme.saved' : 'settings.theme.resetDone'))
    } catch {
      toast.error(t('settings.theme.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  const dirty = color !== saved
  const disabled = !canEdit || busy

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="font-semibold text-ink">{t('settings.theme.primaryColor')}</h2>
        <p className="mt-1 text-sm text-ink-muted">{t('settings.theme.primaryColorHint')}</p>

        <div className="mt-4 flex flex-wrap gap-3" role="radiogroup" aria-label={t('settings.theme.presets')}>
          {PRIMARY_COLOR_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={color === preset}
              aria-label={preset}
              disabled={disabled}
              onClick={() => pick(preset)}
              className={`h-11 w-11 rounded-full border-2 border-white transition-transform disabled:cursor-not-allowed disabled:opacity-50 ${
                color === preset ? 'scale-110 ring-2 ring-accent-ink' : 'ring-1 ring-line hover:scale-105'
              }`}
              style={{ backgroundColor: preset }}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <input
            type="color"
            value={color}
            disabled={disabled}
            onChange={(e) => pick(e.target.value)}
            className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-white p-1 disabled:cursor-not-allowed"
            aria-label={t('settings.theme.customColor')}
          />
          <input
            type="text"
            dir="ltr"
            value={hexInput}
            maxLength={7}
            spellCheck={false}
            disabled={disabled}
            onChange={(e) => pick(e.target.value)}
            aria-label={t('settings.theme.customColor')}
            aria-invalid={!normalizeHexColor(hexInput)}
            className="h-11 w-32 rounded-lg border border-line bg-white px-3 font-mono text-sm uppercase text-ink outline-none focus:border-ink aria-[invalid=true]:border-red-400"
          />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="font-semibold text-ink">{t('settings.theme.preview')}</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground">
            {t('settings.theme.previewButton')}
          </span>
          <span className="inline-flex h-10 items-center rounded-md bg-accent/10 px-4 text-sm font-medium text-accent-ink">
            {t('settings.theme.previewActiveLink')}
          </span>
          <span className="inline-flex h-10 items-center rounded-lg border border-accent px-4 text-sm font-medium text-accent-ink">
            {t('settings.theme.previewOutline')}
          </span>
        </div>
      </section>

      {canEdit && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            disabled={busy || (saved === DEFAULT_PRIMARY_COLOR && !dirty)}
            onClick={() => void persist('DELETE', DEFAULT_PRIMARY_COLOR)}
            className={secondaryButton}
          >
            {t('settings.theme.reset')}
          </button>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" disabled={busy || !dirty} onClick={() => pick(saved)} className={secondaryButton}>
              {t('settings.theme.discard')}
            </button>
            <button
              type="button"
              disabled={busy || !dirty}
              onClick={() => void persist('PUT', color)}
              className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {busy ? t('settingsPricing.saving') : t('settingsPricing.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
