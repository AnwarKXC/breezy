import { AccountingPage as AccountingPageClient } from '@/modules/accounting/components/AccountingPage'
import { AuthAccessError } from '@/services/auth/serverSession'
import { checkLocale } from '@/i18n/config'
import { requireAccountingRead } from '@/modules/accounting/services'
import ar from '@/i18n/locales/ar.json'
import en from '@/i18n/locales/en.json'

const translations: Record<string, Record<string, unknown>> = { ar, en }

function t(locale: string, key: string): string {
  const keys = key.split('.')
  let result: unknown = translations[locale]
  for (const k of keys) {
    if (result && typeof result === 'object') {
      result = (result as Record<string, unknown>)[k]
    } else {
      return key
    }
  }
  return typeof result === 'string' ? result : key
}

export default async function AccountingRoutePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = checkLocale(rawLocale)

  try {
    await requireAccountingRead()
  } catch (error) {
    if (error instanceof AuthAccessError) {
      const description = error.code === 'auth/permission_denied'
        ? t(locale, 'accounting.title')
        : 'auth/invalid_session'
      return (
        <main className="min-h-screen bg-[#F4F5F7] px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-xl bg-white p-10 text-center ">
            <h1 className="text-base font-medium text-[#1A1A1A]">{description}</h1>
          </div>
        </main>
      )
    }
    throw error
  }

  return <AccountingPageClient locale={locale} />
}
