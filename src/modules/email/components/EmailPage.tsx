'use client'

import Link from 'next/link'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { fetchData, useResource } from '@/shared/data/useResource'
import { Mailbox } from '@/modules/settings/components/email/Mailbox'
import { emailErrorText } from '@/modules/settings/components/email/emailApi'

export function EmailPage({ canEdit, canConfigure }: { canEdit: boolean; canConfigure: boolean }) {
  const { t, locale } = useTranslation()
  const account = useResource<{ email: string; displayName: string } | null>('/api/email/account', () => fetchData('/api/email/account'))

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('email.title')}</h1>
          <p className="mt-1 text-sm text-ink-muted">{account.data ? `${account.data.displayName} · ${account.data.email}` : t('email.description')}</p>
        </div>
        {canConfigure && <Link href={`/${locale}/settings?tab=email`} className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink hover:bg-accent/10">{t('email.configure')}</Link>}
      </header>
      {account.isLoading ? <p role="status" className="text-sm text-ink-muted">{t('settings.email.inbox.loading')}</p>
        : account.error ? <div role="alert" className="rounded-xl border border-line bg-white p-6"><p className="text-sm text-red-600">{emailErrorText(t, account.error.message)}</p><button type="button" onClick={() => void account.refresh()} className="mt-3 min-h-10 rounded-lg border border-line px-4 text-sm">{t('settings.email.inbox.refresh')}</button></div>
          : account.data ? <Mailbox email={account.data.email} canEdit={canEdit} />
            : <div className="rounded-xl border border-line bg-white p-8"><h2 className="font-semibold text-ink">{t('email.notConnected')}</h2><p className="mt-2 text-sm text-ink-muted">{t(canConfigure ? 'email.connectPrompt' : 'email.contactAdmin')}</p></div>}
    </div>
  )
}
