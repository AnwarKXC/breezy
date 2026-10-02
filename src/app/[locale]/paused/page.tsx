import { redirect } from 'next/navigation'

import { checkLocale, type Locale } from '@/i18n/config'
import ar from '@/i18n/locales/ar.json'
import en from '@/i18n/locales/en.json'
import { getLicenseStatus } from '@/services/fleet/license'
import { getBranding } from '@/shared/branding/server'

const translations = { ar, en }

function getLabels(locale: Locale) {
  return translations[locale].auth.paused
}

// Shown (by the proxy) for every page while the provider has locked this instance.
export default async function PausedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = checkLocale(rawLocale)
  if (!(await getLicenseStatus()).locked) redirect(`/${locale}/reservations`)

  const labels = getLabels(locale)
  const branding = await getBranding()

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F5F7] px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-[#EAEAEA] bg-white p-6 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-[#787774]">{branding.displayName}</p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight text-[#1A1A1A]">{labels.title}</h1>
        <p className="mt-2 text-sm text-[#787774]">{labels.description}</p>
      </section>
    </main>
  )
}
