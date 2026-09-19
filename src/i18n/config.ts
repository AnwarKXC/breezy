// ðŸ“ src/i18n/config.ts - i18n configuration
import { notFound } from 'next/navigation'

// Supported locales
export type Locale = 'en' | 'ar'

export const locales: Locale[] = ['en', 'ar']
export const defaultLocale: Locale = 'en'

// Locale config with metadata
export const localeConfig: Record<Locale, { name: string; dir: 'ltr' | 'rtl' }> = {
  en: { name: 'English', dir: 'ltr' },
  ar: { name: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', dir: 'rtl' },
}

// Get direction from locale
export function getDir(locale: Locale): 'ltr' | 'rtl' {
  return localeConfig[locale].dir
}

// Validate locale
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale)
}

// Check if locale is valid, otherwise redirect
export function checkLocale(locale: string): Locale {
  if (!isValidLocale(locale)) {
    notFound()
  }
  return locale as Locale
}