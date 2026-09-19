'use client'

import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react'
import { type Locale, getDir } from './config'
import { LocaleProvider } from './components/LocaleContext'

type TranslationDict = Record<string, unknown>

interface I18nContextType {
  locale: Locale
  dir: 'ltr' | 'rtl'
  t: (key: string) => string
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.')
  let result: unknown = obj
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key]
    } else {
      return path
    }
  }
  return typeof result === 'string' ? result : path
}

// The URL segment is the source of truth for the locale: the [locale] layout
// passes it together with its dictionary, so the first render (including SSR)
// is fully translated. Switching language navigates to the other locale's URL.
export function I18nProvider({
  children,
  locale,
  dictionary,
}: {
  children: ReactNode
  locale: Locale
  dictionary: TranslationDict
}) {
  const t = useCallback((key: string) => getNestedValue(dictionary, key), [dictionary])

  // Persists the preference and updates <html> ahead of the navigation.
  const setLocale = useCallback((newLocale: Locale) => {
    try {
      localStorage.setItem('locale', newLocale)
    } catch {}
    document.documentElement.lang = newLocale
    document.documentElement.dir = getDir(newLocale)
  }, [])

  const dir = getDir(locale)
  const value = useMemo(() => ({ locale, dir, t, setLocale }), [dir, locale, setLocale, t])

  return (
    <I18nContext.Provider value={value}>
      <LocaleProvider locale={locale}>{children}</LocaleProvider>
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
