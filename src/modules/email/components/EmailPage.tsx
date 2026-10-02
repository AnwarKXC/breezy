'use client'

import Link from 'next/link'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { fetchData, useResource } from '@/shared/data/useResource'
import { Mailbox } from '@/modules/settings/components/email/Mailbox'
import { emailErrorText } from '@/modules/settings/components/email/emailApi'
import { EmailIcon } from './EmailIcon'

export function EmailPage({ canEdit, canConfigure }: { canEdit: boolean; canConfigure: boolean }) {
  const { t, locale } = useTranslation()
  const account = useResource<{ email: string; displayName: string } | null>('/api/email/account', () => fetchData('/api/email/account'))

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-accent-ink sm:flex"><EmailIcon name="mail" className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{t('email.title')}</h1>
            <p className="mt-0.5 text-xs text-ink-muted sm:text-sm">{t('email.description')}</p>
          </div>
        </div>
        {canConfigure && <Link href={`/${locale}/settings?tab=email`} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-2 text-xs font-medium text-ink-muted transition-colors hover:bg-white hover:text-ink sm:px-3 sm:text-sm"><EmailIcon name="settings" />{t('email.configure')}</Link>}
      </header>
      {account.isLoading ? <div role="status" aria-label={t('settings.email.inbox.loading')} className="min-h-96 animate-pulse overflow-hidden rounded-2xl border border-line bg-white motion-reduce:animate-none"><div className="h-16 border-b border-line bg-surface-muted/30" /><div className="space-y-6 p-6">{[1, 2, 3].map((n) => <div key={n} className="h-8 max-w-sm rounded-md bg-surface-muted/50" />)}</div></div>
        : account.error ? <div role="alert" className="flex min-h-96 flex-col items-center justify-center rounded-2xl border border-line bg-white p-8 text-center"><span className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-surface-muted/50 text-ink-muted"><EmailIcon name="mail" className="h-7 w-7" /></span><p className="max-w-md text-sm text-ink-muted">{emailErrorText(t, account.error.message)}</p><button type="button" onClick={() => void account.refresh()} className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-ink"><EmailIcon name="refresh" />{t('settings.email.inbox.refresh')}</button></div>
          : account.data ? <Mailbox email={account.data.email} canEdit={canEdit} />
            : <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-2xl border border-line bg-white p-8 text-center"><span className="mb-6 grid h-20 w-20 place-items-center rounded-2xl border border-line bg-surface-muted/30 text-accent-ink"><EmailIcon name="inbox" className="h-8 w-8" /></span><h2 className="text-lg font-semibold tracking-tight text-ink">{t('email.notConnected')}</h2><p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">{t(canConfigure ? 'email.connectPrompt' : 'email.contactAdmin')}</p>{canConfigure && <Link href={`/${locale}/settings?tab=email`} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-accent-foreground hover:bg-accent-hover">{t('email.configure')}<EmailIcon name="arrowUpRight" /></Link>}</div>}
    </div>
  )
}
