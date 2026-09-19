import { checkLocale, getDir } from '@/i18n/config'
import { I18nProvider } from '@/i18n/provider'
import ar from '@/i18n/locales/ar.json'
import en from '@/i18n/locales/en.json'

const dictionaries = { ar, en }

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = checkLocale(rawLocale)

  return (
    <div lang={locale} dir={getDir(locale)}>
      <I18nProvider locale={locale} dictionary={dictionaries[locale]}>
        {children}
      </I18nProvider>
    </div>
  )
}
