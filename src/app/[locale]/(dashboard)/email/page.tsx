import { ACTIONS, canPerformAction } from '@/config/rbac'
import { checkLocale } from '@/i18n/config'
import en from '@/i18n/locales/en.json'
import ar from '@/i18n/locales/ar.json'
import { getCurrentServerSession } from '@/services/auth/serverSession'
import { EmailPage } from '@/modules/email/components/EmailPage'

export default async function EmailRoutePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = checkLocale((await params).locale)
  const session = await getCurrentServerSession()
  if (!canPerformAction(session.role, ACTIONS.EMAIL_READ)) {
    return <p className="p-6 text-sm text-ink-muted">{(locale === 'ar' ? ar : en).settings.errors.permissionDenied}</p>
  }
  return <EmailPage canEdit={canPerformAction(session.role, ACTIONS.EMAIL_WRITE)} canConfigure={canPerformAction(session.role, ACTIONS.SETTINGS_WRITE)} />
}
