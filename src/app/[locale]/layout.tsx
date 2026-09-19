import type { Locale } from '@/i18n/config'
import { checkLocale, getDir } from '@/i18n/config'
import { I18nProvider } from '@/i18n/provider'
import { LocaleSync } from '@/i18n/components'

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = checkLocale(rawLocale)
  const dir = getDir(locale as Locale)

  return (
    <div lang={locale} dir={dir}>
      <I18nProvider initialLocale={locale as Locale}>
        <LocaleSync locale={locale as Locale} />
        {children}
      </I18nProvider>
    </div>
  )
}
