import dynamic from "next/dynamic";
import { AuthAccessError } from '@/services/auth/serverSession'
import { checkLocale, type Locale } from '@/i18n/config'
import { requireContactsRead } from '@/modules/contacts/services/serviceSecurity'
import { getContactsUiPermissions } from '@/modules/contacts/services/serviceSecurity'
import ar from '@/i18n/locales/ar.json'
import en from '@/i18n/locales/en.json'
import { PageSkeleton } from "@/shared/components/PageSkeleton";

const ContactsPage = dynamic(() =>
  import("@/modules/contacts/components").then((m) => ({ default: m.ContactsPage })),
  { loading: () => <PageSkeleton /> }
);

const translations = { ar, en }

function getAccessLabels(locale: Locale, error: AuthAccessError) {
  const contacts = translations[locale].contacts
  const description =
    error.code === 'auth/permission_denied'
      ? contacts.errors.permissionDenied
      : contacts.errors.invalidSession

  return { description, title: contacts.errorTitle }
}

function ContactsAccessState({ description, title }: { description: string; title: string }) {
  return (
    <main className="min-h-screen bg-[#F4F5F7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-xl bg-white p-10 text-center ">
        <h1 className="text-base font-medium text-[#1A1A1A]">{title}</h1>
        <p className="mt-2 text-sm text-[#787774]">{description}</p>
      </div>
    </main>
  )
}

export default async function ContactsRoutePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = checkLocale(rawLocale)
  let permissions = { canCreateContacts: false, canDeleteContacts: false, canUpdateContacts: false, canUpdatePriceOverrides: false }
  let accessLabels: ReturnType<typeof getAccessLabels> | null = null

  try {
    const session = await requireContactsRead()
    permissions = getContactsUiPermissions(session)
  } catch (error) {
    if (error instanceof AuthAccessError) {
      accessLabels = getAccessLabels(locale, error)
    } else {
      throw error
    }
  }

  if (accessLabels) {
    return <ContactsAccessState {...accessLabels} />
  }

  return <ContactsPage permissions={permissions} />
}
