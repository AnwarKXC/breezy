'use client'

import { usePathname, useRouter } from 'next/navigation'

import { locales, type Locale } from '../config'
import { useTranslation } from '../hooks/useTranslation'

function buildLocalizedPath(pathname: string, locale: Locale) {
  const segments = pathname.split('/')

  if (locales.includes(segments[1] as Locale)) {
    segments[1] = locale
    return segments.join('/') || `/${locale}`
  }

  return `/${locale}${pathname === '/' ? '' : pathname}`
}

function LanguageIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10" />
    </svg>
  )
}

// Each language is offered in its own script, so it is recognisable whatever the
// current UI language is.
const ENDONYMS: Record<Locale, string> = { en: 'English', ar: 'العربية' }

/** Two locales: one button switches straight to the other one. */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const nextLocale: Locale = locale === 'ar' ? 'en' : 'ar'

  function switchLanguage() {
    setLocale(nextLocale)
    router.replace(`${buildLocalizedPath(pathname, nextLocale)}${window.location.search}`)
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      aria-label={`${t('language.switcher')}: ${ENDONYMS[nextLocale]}`}
      className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <LanguageIcon />
      <span lang={nextLocale} className="hidden sm:inline">{ENDONYMS[nextLocale]}</span>
      <span lang={nextLocale} className="uppercase sm:hidden">{nextLocale}</span>
    </button>
  )
}
