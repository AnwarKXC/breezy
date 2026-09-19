import { LogsPage } from '@/modules/logs'
import { ACTIONS, canPerformAction } from '@/config/rbac'
import { checkLocale, type Locale } from '@/i18n/config'
import ar from '@/i18n/locales/ar.json'
import en from '@/i18n/locales/en.json'
import { AuthAccessError, getCurrentServerSession } from '@/services/auth/serverSession'
const translations = { ar, en }

function getAccessLabels(locale: Locale, error?: AuthAccessError) {
  const logs = translations[locale].logs
  const description =
    error?.code === 'auth/requires_authenticated_user' || error?.code === 'auth/invalid_session'
      ? logs.invalidSession
      : logs.permissionDenied

  return { description, title: logs.errorTitle }
}

function LogsAccessState({ description, title }: { description: string; title: string }) {
  return (
    <main className="content-visibility-auto min-h-screen bg-[#F4F5F7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-xl bg-white p-10 text-center ">
        <h1 className="text-base font-medium text-[#1A1A1A]">{title}</h1>
        <p className="mt-2 text-sm text-[#787774]">{description}</p>
      </div>
    </main>
  )
}

export default async function LogsRoutePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = checkLocale(rawLocale)
  let accessLabels: ReturnType<typeof getAccessLabels> | null = null

  try {
    const session = await getCurrentServerSession()
    if (!canPerformAction(session.role, ACTIONS.LOGS_READ)) {
      accessLabels = getAccessLabels(locale)
    }
  } catch (error) {
    if (error instanceof AuthAccessError) {
      accessLabels = getAccessLabels(locale, error)
    } else {
      throw error
    }
  }

  if (accessLabels) return <LogsAccessState {...accessLabels} />
  return <LogsPage />
}
