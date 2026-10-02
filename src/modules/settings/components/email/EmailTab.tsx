'use client'

import Link from 'next/link'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { fetchData, useResource } from '@/shared/data/useResource'
import { EmailAccountForm } from './EmailAccountForm'
import { emailErrorText, type EmailAccount } from './emailApi'

const ACCOUNT_URL = '/api/settings/email'
const fetchAccount = () => fetchData<EmailAccount | null>(ACCOUNT_URL)

export function EmailTab({ canEdit }: { canEdit: boolean }) {
  const { t, locale } = useTranslation()
  const account = useResource(ACCOUNT_URL, fetchAccount)

  if (account.isLoading) return <p className="text-sm text-ink-muted">{t('settings.email.inbox.loading')}</p>
  if (account.error) return <p className="text-sm text-red-600">{emailErrorText(t, account.error.message)}</p>

  const connected = account.data ?? null

  return (
    <div className="space-y-4">
      {connected && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-muted">
            {t('settings.email.connectedAs')} <span dir="ltr" className="font-medium text-ink">{connected.email}</span>
          </p>
          <Link href={`/${locale}/email`} className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink hover:bg-accent/10">
            {t('email.openMailbox')}
          </Link>
        </div>
      )}

      <EmailAccountForm
          key={connected?.email ?? 'new'}
          account={connected}
          canEdit={canEdit}
          onSaved={(next) => {
            account.mutate(() => next)
          }}
        />
    </div>
  )
}
