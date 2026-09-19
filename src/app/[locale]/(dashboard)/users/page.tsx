import { UsersPage } from "@/modules/users/components";
import { AuthServiceError } from '@/modules/users/services/authErrors'
import { getUsersUiPermissions, requireUsersRead } from '@/modules/users/services/server'
import { getUsersPage } from '@/modules/users/services/userService'
import { checkLocale, type Locale } from '@/i18n/config'
import ar from '@/i18n/locales/ar.json'
import en from '@/i18n/locales/en.json'

const translations = { ar, en }

function getAccessLabels(locale: Locale, error: AuthServiceError) {
  const users = translations[locale].users
  const description =
    error.code === 'auth/permission_denied'
      ? users.errors.permissionDenied
      : users.errors.invalidSession

  return { description, title: users.errorTitle }
}

function UsersAccessState({ description, title }: { description: string; title: string }) {
  return (
    <main className="min-h-screen bg-[#F4F5F7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-xl bg-white p-10 text-center ">
        <h1 className="text-base font-medium text-[#1A1A1A]">{title}</h1>
        <p className="mt-2 text-sm text-[#787774]">{description}</p>
      </div>
    </main>
  )
}

export default async function UsersRoutePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = checkLocale(rawLocale)
  let permissions = { canCreateUsers: false, canDeleteUsers: false, canUpdateUsers: false }
  let accessLabels: ReturnType<typeof getAccessLabels> | null = null
  let initialData = undefined as Awaited<ReturnType<typeof getUsersPage>> | undefined

  try {
    const session = await requireUsersRead()
    permissions = getUsersUiPermissions(session)
    initialData = await getUsersPage({})
  } catch (error) {
    if (error instanceof AuthServiceError) {
      accessLabels = getAccessLabels(locale, error)
    } else {
      throw error
    }
  }

  if (accessLabels) {
    return <UsersAccessState {...accessLabels} />
  }

  return <UsersPage permissions={permissions} initialData={initialData} />
}
