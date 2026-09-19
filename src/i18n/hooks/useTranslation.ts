'use client'

import { useI18n } from '../provider'
import type { Locale } from '../config'

interface UseTranslationReturn {
  t: (key: string) => string
  locale: Locale
  dir: 'ltr' | 'rtl'
  isRTL: boolean
  setLocale: (locale: Locale) => void
}

export function useTranslation(): UseTranslationReturn {
  const { t, locale, dir, setLocale } = useI18n()

  const isRTL = dir === 'rtl'

  return {
    t,
    locale,
    dir,
    isRTL,
    setLocale,
  }
}
