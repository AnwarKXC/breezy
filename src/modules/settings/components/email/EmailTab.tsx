'use client'

import { useState } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { fetchData, useResource } from '@/shared/data/useResource'
import { EmailAccountForm } from './EmailAccountForm'
import { Mailbox } from './Mailbox'
import { emailErrorText, type EmailAccount } from './emailApi'

const ACCOUNT_URL = '/api/settings/email'
const fetchAccount = () => fetchData<EmailAccount | null>(ACCOUNT_URL)

export function EmailTab({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation()
  const account = useResource(ACCOUNT_URL, fetchAccount)
  const [view, setView] = useState<'mailbox' | 'account' | null>(null)

  if (account.isLoading) return <p className="text-sm text-ink-muted">{t('settings.email.inbox.loading')}</p>
  if (account.error) return <p className="text-sm text-red-600">{emailErrorText(t, account.error.message)}</p>

  const connected = account.data ?? null
  // Not connected yet: the account form is the only useful screen.
  const active = connected ? (view ?? 'mailbox') : 'account'

  return (
    <div className="space-y-4">
      {connected && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-muted">
            {t('settings.email.connectedAs')} <span dir="ltr" className="font-medium text-ink">{connected.email}</span>
          </p>
          <div className="flex gap-1 rounded-lg bg-surface-muted p-1" role="tablist">
            {(['mailbox', 'account'] as const).map((id) => (
              <button key={id} type="button" role="tab" aria-selected={active === id} onClick={() => setView(id)}
                className={`h-9 flex-1 rounded-md px-4 text-sm font-medium sm:flex-none ${active === id ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
                {t(`settings.email.views.${id}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {active === 'mailbox' && connected ? (
        <Mailbox email={connected.email} canEdit={canEdit} />
      ) : (
        <EmailAccountForm
          key={connected?.email ?? 'new'}
          account={connected}
          canEdit={canEdit}
          onSaved={(next) => {
            account.mutate(() => next)
            setView(next ? 'mailbox' : null)
          }}
        />
      )}
    </div>
  )
}
