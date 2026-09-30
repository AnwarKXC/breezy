'use client'

// ðŸ“ src/pwa/components/InstallPrompt.tsx
// Visual: STEP 5 â€” PWA UI spec
// Role: Show install prompt when app is installable

import { useState } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useInstallPrompt } from '../use-install-prompt'

interface InstallPromptProps {
  onInstall?: () => void
  onDismiss?: () => void
}

/** Floating install banner for browsers that expose a native install prompt. */
export function InstallPrompt({ onInstall, onDismiss }: InstallPromptProps) {
  const { mode, install } = useInstallPrompt()
  const [isVisible, setIsVisible] = useState(true)
  const { t } = useTranslation()

  const handleInstall = async () => {
    if (await install()) onInstall?.()
    setIsVisible(false)
  }

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  if (mode !== 'prompt' || !isVisible) {
    return null
  }

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-2xl bg-white px-6 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.12)]"
      role="dialog"
      aria-label="Install app"
    >
      {/* App icon/logo placeholder */}
      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
        <svg
          className="w-6 h-6 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      </div>

      {/* Text content */}
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{t('pwa.installTitle')}</p>
        <p className="text-xs text-gray-500">{t('pwa.installDescription')}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Install button per spec: bg-accent text-white rounded-xl px-4 py-2 text-sm font-medium */}
        <button
          onClick={handleInstall}
          className={`
            bg-accent text-white rounded-xl px-4 py-2 text-sm font-medium
            hover:bg-accent-hover transition
          `}
        >
          {t('pwa.install')}
        </button>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className={`
            p-2 text-gray-400 hover:text-gray-600 transition
          `}
          aria-label="Dismiss"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default InstallPrompt
