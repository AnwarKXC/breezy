'use client'

import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react'
import { Locale, locales, defaultLocale, getDir } from './config'
import { LocaleProvider } from './components/LocaleContext'

type TranslationDict = Record<string, unknown>

interface I18nContextType {
  locale: Locale
  dir: 'ltr' | 'rtl'
  t: (key: string) => string
  setLocale: (locale: Locale) => void
  isLoading: boolean
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

const dictCache = new Map<Locale, TranslationDict>()

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

export function I18nProvider({ children, initialLocale = defaultLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const [dict, setDict] = useState<TranslationDict | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadDict(l: Locale) {
      if (dictCache.has(l)) {
        if (!cancelled) setDict(dictCache.get(l)!)
        return
      }
      const mod = l === 'ar' ? await import('./locales/ar.json') : await import('./locales/en.json')
      dictCache.set(l, mod as TranslationDict)
      if (!cancelled) setDict(mod as TranslationDict)
    }
    loadDict(locale)
    return () => { cancelled = true }
  }, [locale])

  useEffect(() => {
    const stored = window.localStorage.getItem('locale') as Locale | null
    if (stored && locales.includes(stored) && stored !== initialLocale) {
      setLocaleState(stored)
    }
  }, [initialLocale])

  const t = useCallback((key: string): string => {
    if (!dict) return key
    return getNestedValue(dict as Record<string, unknown>, key)
  }, [dict])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('locale', newLocale)
    document.documentElement.lang = newLocale
    document.documentElement.dir = getDir(newLocale)
  }, [])

  const dir = getDir(locale)
  const isLoading = !dict
  const value = useMemo(
    () => ({ locale, dir, t, setLocale, isLoading }),
    [dir, locale, setLocale, t, isLoading],
  )

  return (
    <I18nContext.Provider value={value}>
      <LocaleProvider locale={locale}>
        <div dir={dir} lang={locale}>
          {!isLoading ? children : null}
        </div>
      </LocaleProvider>
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
