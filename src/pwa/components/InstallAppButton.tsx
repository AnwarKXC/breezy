'use client'

import { useState } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useInstallPrompt } from '../use-install-prompt'

/** Inline "Install app" CTA. Renders nothing when installed or not installable. */
export function InstallAppButton() {
  const { mode, install } = useInstallPrompt()
  const [showIosHelp, setShowIosHelp] = useState(false)
  const { t } = useTranslation()

  if (mode === 'hidden') return null

  const handleClick = () => {
    if (mode === 'ios') setShowIosHelp((open) => !open)
    else void install()
  }

  return (
    <div className="mt-6 border-t border-[#EDEDEB] pt-5">
      <button
        aria-expanded={mode === 'ios' ? showIosHelp : undefined}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#D6D6D4] bg-white px-4 text-xs font-bold text-[#1A1A1A] transition hover:bg-[#F5F5F5]"
        onClick={handleClick}
        type="button"
      >
        <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t('pwa.installApp')}
      </button>
      <p className="mt-2 text-center text-[11px] text-[#787774]">{t('pwa.installDescription')}</p>
      {mode === 'ios' && showIosHelp ? (
        <p className="mt-3 rounded-lg bg-[#F5F5F5] px-3 py-2 text-xs text-[#37352F]">{t('pwa.iosInstructions')}</p>
      ) : null}
    </div>
  )
}

export default InstallAppButton
