import { SettingsPage } from "@/modules/settings/components/SettingsPage";
import { Suspense } from "react";
import { AuthAccessError } from '@/services/auth/serverSession'
import { checkLocale, type Locale } from '@/i18n/config'
import { requireSettingsRead, getSettingsUiPermissions } from '@/modules/settings/services/serviceSecurity'
import ar from '@/i18n/locales/ar.json'
import en from '@/i18n/locales/en.json'
import { PageSkeleton } from "@/shared/components/PageSkeleton";
import { getAppTheme } from '@/shared/theme/server'

const translations = { ar, en }

function getAccessLabels(locale: Locale, error: AuthAccessError) {
  const nav = translations[locale].nav
  const description =
    error.code === 'auth/permission_denied'
      ? translations[locale].settings.errors.permissionDenied
      : translations[locale].settings.errors.invalidSession

  return { description, title: nav.settings }
}

function SettingsAccessState({ description, title }: { description: string; title: string }) {
  return (
    <main className="min-h-screen bg-[#F4F5F7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-xl bg-white p-10 text-center ">
        <h1 className="text-base font-medium text-[#1A1A1A]">{title}</h1>
        <p className="mt-2 text-sm text-[#787774]">{description}</p>
      </div>
    </main>
  )
}

export default async function SettingsRoutePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = checkLocale(rawLocale)
  let permissions = { canDeleteRooms: false, canWriteSettings: false }
  let accessLabels: ReturnType<typeof getAccessLabels> | null = null

  try {
    const session = await requireSettingsRead()
    permissions = getSettingsUiPermissions(session)
  } catch (error) {
    if (error instanceof AuthAccessError) {
      accessLabels = getAccessLabels(locale, error)
    } else {
      throw error
    }
  }

  if (accessLabels) {
    return <SettingsAccessState {...accessLabels} />
  }

  const theme = await getAppTheme()

  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsPage permissions={permissions} theme={{ primaryColor: theme.primaryColor }} />
    </Suspense>
  )
}
