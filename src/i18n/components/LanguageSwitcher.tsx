'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import { useClickOutside } from '@/shared/hooks/useClickOutside'
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
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10" />
    </svg>
  )
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation()
  const dropdownId = useId()
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
  const currentName = t(`language.${locale}`)

  function handleLanguageChange(nextLocale: Locale) {
    const query = window.location.search
    const nextPath = buildLocalizedPath(pathname, nextLocale)

    setLocale(nextLocale)
    setOpen(false)
    router.replace(`${nextPath}${query}`)
  }

  return (
    <div ref={ref} className="relative">
      <button
        aria-controls={dropdownId}
        aria-expanded={open}
        aria-label={`${t('language.current')}: ${currentName}`}
        className="flex h-10 items-center gap-2 rounded-2xl bg-white px-3 text-sm font-bold uppercase text-[#101a24] shadow-[0_10px_24px_rgba(16,26,36,0.06)] transition-colors hover:bg-gray-100"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <LanguageIcon />
        {locale}
      </button>

      {open ? (
        <div
          className="absolute top-12 z-50 w-40 overflow-hidden rounded-[24px] border border-gray-100 bg-white p-2 text-sm shadow-[0_18px_40px_rgba(16,26,36,0.14)] right-0 max-sm:right-1"
          id={dropdownId}
        >
          {locales.map((item) => {
            const active = item === locale

            return (
              <button
                aria-current={active ? 'true' : undefined}
                className={`block w-full rounded-2xl px-3 py-2 text-start transition-colors ${
                  active ? 'bg-accent font-bold text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
                key={item}
                onClick={() => handleLanguageChange(item)}
                type="button"
              >
                {t(`language.${item}`)}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default LanguageSwitcher
