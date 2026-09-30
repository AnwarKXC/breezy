import Link from 'next/link'

import { checkLocale, type Locale } from '@/i18n/config'
import ar from '@/i18n/locales/ar.json'
import en from '@/i18n/locales/en.json'

const translations = { ar, en }

function getLabels(locale: Locale) {
  return translations[locale].auth.unauthorized
}

export default async function UnauthorizedPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = checkLocale(rawLocale)
  const labels = getLabels(locale)

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F5F7] px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-[#EAEAEA] bg-white p-6 text-center ">
        <p className="text-xs font-medium uppercase tracking-wide text-[#787774]">
          {labels.eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight text-[#1A1A1A]">
          {labels.title}
        </h1>
        <p className="mt-2 text-sm text-[#787774]">{labels.description}</p>
        <Link
          className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[#1A1A1A] px-4 text-xs font-bold text-white transition hover:bg-[#333333]"
          href={`/${locale}/reservations`}
        >
          {labels.back}
        </Link>
      </section>
    </main>
  )
}
