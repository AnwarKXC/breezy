'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { toast } from '@/shared/toast/toastEvents'
import { fetchData, useResource } from '@/shared/data/useResource'
import { MailComposer, type ComposeDraft } from './MailComposer'
import { emailErrorText, formatAddress, sendJson, type MailDetail, type MailFolder, type MailPage } from './emailApi'

const FOLDERS: MailFolder[] = ['inbox', 'sent', 'trash']
const API = '/api/settings/email/messages'

const button =
  'inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:opacity-50'

function formatDate(iso: string | null, locale: string) {
  if (!iso) return ''
  const date = new Date(iso)
  const sameDay = date.toDateString() === new Date().toDateString()
  return date.toLocaleString(locale, sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' })
}

/**
 * HTML mail is untrusted: render it in a sandboxed iframe (no scripts, no
 * same-origin access). The page CSP also applies to srcdoc, so remote images
 * and trackers stay blocked. Links open in a new tab.
 */
function MailBody({ message }: { message: MailDetail }) {
  if (!message.html) {
    return <pre dir="auto" className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-ink">{message.text}</pre>
  }
  const doc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;font:14px/1.5 system-ui,sans-serif;color:#1a1a1a;word-break:break-word}img{max-width:100%;height:auto}</style></head><body>${message.html}</body></html>`
  return (
    <iframe
      title={message.subject}
      srcDoc={doc}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      className="h-[60vh] w-full rounded-lg border border-line bg-white"
    />
  )
}

function quote(message: MailDetail) {
  const who = message.from.map(formatAddress).join(', ')
  const body = message.text.split('\n').map((line) => `> ${line}`).join('\n')
  return `\n\n${message.date ? new Date(message.date).toLocaleString() : ''} ${who}:\n${body}`
}

function prefixed(prefix: string, subject: string) {
  return subject.toLowerCase().startsWith(prefix.toLowerCase()) ? subject : `${prefix} ${subject}`
}

export function Mailbox({ email, canEdit }: { email: string; canEdit: boolean }) {
  const { t, locale } = useTranslation()
  const [folder, setFolder] = useState<MailFolder>('inbox')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [draft, setDraft] = useState<ComposeDraft | null>(null)

  const listUrl = `${API}?${new URLSearchParams({ folder, page: String(page), q: query })}`
  const list = useResource<MailPage>(listUrl, () => fetchData<MailPage>(listUrl), { staleMs: 30_000 })
  const messageUrl = selected === null ? null : `${API}/${selected}?folder=${folder}`
  const message = useResource<MailDetail>(messageUrl, () => fetchData<MailDetail>(messageUrl!), { staleMs: 60_000 })

  const open = (uid: number) => {
    setSelected(uid)
    list.mutate((current) =>
      current ? { ...current, items: current.items.map((m) => (m.uid === uid ? { ...m, seen: true } : m)) } : current!,
    )
  }

  const switchFolder = (next: MailFolder) => {
    setFolder(next)
    setPage(1)
    setSelected(null)
  }

  const runSearch = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setQuery(search.trim())
  }

  const act = async (run: () => Promise<unknown>, done: string) => {
    try {
      await run()
      toast.success(t(done))
      await list.refresh()
    } catch (error) {
      toast.error(emailErrorText(t, (error as Error).message))
    }
  }

  const remove = (uid: number) =>
    act(async () => {
      await sendJson(`${API}/${uid}?folder=${folder}`, 'DELETE')
      setSelected(null)
    }, folder === 'trash' ? 'settings.email.inbox.deletedForever' : 'settings.email.inbox.movedToTrash')

  const markUnread = (uid: number) =>
    act(async () => {
      await sendJson(`${API}/${uid}?folder=${folder}`, 'PATCH', { seen: false })
      setSelected(null)
    }, 'settings.email.inbox.markedUnread')

  const reply = (m: MailDetail, all: boolean) => {
    const target = m.replyTo.length ? m.replyTo : m.from
    const others = all ? [...m.to, ...m.cc].filter((a) => a.address.toLowerCase() !== email.toLowerCase()) : []
    setDraft({
      to: target.map((a) => a.address).join(', '),
      cc: others.map((a) => a.address).join(', '),
      subject: prefixed('Re:', m.subject),
      text: quote(m),
      inReplyTo: m.messageId ?? undefined,
      references: [...m.references, ...(m.messageId ? [m.messageId] : [])],
    })
  }

  const forward = (m: MailDetail) =>
    setDraft({ to: '', cc: '', subject: prefixed('Fwd:', m.subject), text: quote(m) })

  const data = list.data
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-surface-muted p-1" role="tablist">
          {FOLDERS.map((f) => (
            <button key={f} type="button" role="tab" aria-selected={folder === f} onClick={() => switchFolder(f)}
              className={`h-9 flex-1 rounded-md px-4 text-sm font-medium transition-colors sm:flex-none ${folder === f ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
              {t(`settings.email.folders.${f}`)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <form onSubmit={runSearch} className="flex-1 sm:w-64 sm:flex-none">
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('settings.email.inbox.search')}
              aria-label={t('settings.email.inbox.search')}
              className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-ink" />
          </form>
          <button type="button" className={button} disabled={list.isFetching} onClick={() => void list.refresh()} aria-label={t('settings.email.inbox.refresh')}>
            {list.isFetching ? '…' : '↻'}
          </button>
          {canEdit && (
            <button type="button" onClick={() => setDraft({ to: '', cc: '', subject: '', text: '' })}
              className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
              {t('settings.email.compose.title')}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className={`overflow-hidden rounded-xl border border-line bg-white ${selected !== null ? 'hidden lg:block' : ''}`}>
          {list.error ? (
            <p className="p-6 text-sm text-red-600">{emailErrorText(t, list.error.message)}</p>
          ) : list.isLoading ? (
            <p className="p-6 text-sm text-ink-muted">{t('settings.email.inbox.loading')}</p>
          ) : !data?.items.length ? (
            <p className="p-6 text-sm text-ink-muted">{t('settings.email.inbox.empty')}</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.items.map((m) => {
                const people = folder === 'sent' ? m.to : m.from
                return (
                  <li key={m.uid}>
                    <button type="button" onClick={() => open(m.uid)}
                      className={`block w-full px-4 py-3 text-start transition-colors hover:bg-surface-muted ${selected === m.uid ? 'bg-surface-muted' : ''}`}>
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={`truncate text-sm ${m.seen ? 'text-ink-muted' : 'font-semibold text-ink'}`}>
                          {people.map(formatAddress).join(', ') || '—'}
                        </span>
                        <span className="shrink-0 text-xs text-ink-muted">{formatDate(m.date, locale)}</span>
                      </span>
                      <span className={`mt-0.5 flex items-center gap-2 text-sm ${m.seen ? 'text-ink-muted' : 'font-medium text-ink'}`}>
                        {!m.seen && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label={t('settings.email.inbox.unread')} />}
                        <span dir="auto" className="truncate">{m.subject || t('settings.email.inbox.noSubject')}</span>
                        {m.hasAttachments && <span className="shrink-0" aria-label={t('settings.email.inbox.hasAttachments')}>📎</span>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {data && data.total > data.pageSize && (
            <div className="flex items-center justify-between border-t border-line px-4 py-2 text-sm text-ink-muted">
              <button type="button" className={button} disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('settings.email.inbox.newer')}</button>
              <span>{page} / {totalPages}</span>
              <button type="button" className={button} disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{t('settings.email.inbox.older')}</button>
            </div>
          )}
        </section>

        <section className={`min-w-0 rounded-xl border border-line bg-white p-5 ${selected === null ? 'hidden lg:block' : ''}`}>
          {selected === null ? (
            <p className="text-sm text-ink-muted">{t('settings.email.inbox.selectMessage')}</p>
          ) : message.error ? (
            <p className="text-sm text-red-600">{emailErrorText(t, message.error.message)}</p>
          ) : !message.data ? (
            <p className="text-sm text-ink-muted">{t('settings.email.inbox.loading')}</p>
          ) : (
            <article className="space-y-4">
              <button type="button" className="text-sm font-medium text-ink-muted hover:text-ink lg:hidden" onClick={() => setSelected(null)}>
                {t('settings.email.inbox.back')}
              </button>
              <header className="space-y-1">
                <h2 dir="auto" className="text-lg font-semibold text-ink">{message.data.subject || t('settings.email.inbox.noSubject')}</h2>
                <p className="text-sm text-ink" dir="auto">
                  {message.data.from.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(', ')}
                </p>
                <p className="text-xs text-ink-muted" dir="auto">
                  {t('settings.email.compose.to')}: {message.data.to.map((a) => a.address).join(', ')}
                  {message.data.cc.length > 0 && ` · ${t('settings.email.compose.cc')}: ${message.data.cc.map((a) => a.address).join(', ')}`}
                  {message.data.date && ` · ${new Date(message.data.date).toLocaleString(locale)}`}
                </p>
              </header>

              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={button} onClick={() => reply(message.data!, false)}>{t('settings.email.inbox.reply')}</button>
                  <button type="button" className={button} onClick={() => reply(message.data!, true)}>{t('settings.email.inbox.replyAll')}</button>
                  <button type="button" className={button} onClick={() => forward(message.data!)}>{t('settings.email.inbox.forward')}</button>
                  <button type="button" className={button} onClick={() => void markUnread(message.data!.uid)}>{t('settings.email.inbox.markUnread')}</button>
                  <button type="button" className={`${button} text-red-600`} onClick={() => void remove(message.data!.uid)}>
                    {t(folder === 'trash' ? 'settings.email.inbox.deleteForever' : 'settings.email.inbox.delete')}
                  </button>
                </div>
              )}

              <MailBody message={message.data} />

              {message.data.attachments.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {message.data.attachments.map((a) => (
                    <li key={a.index}>
                      <a href={`${API}/${message.data!.uid}/attachments/${a.index}?folder=${folder}`}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm text-ink hover:bg-surface-muted">
                        📎 <span className="max-w-56 truncate">{a.filename}</span>
                        <span className="text-xs text-ink-muted">{Math.max(1, Math.round(a.size / 1024))} KB</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          )}
        </section>
      </div>

      {draft && (
        <MailComposer
          draft={draft}
          onClose={() => setDraft(null)}
          onSent={() => {
            setDraft(null)
            if (folder === 'sent') void list.refresh()
          }}
        />
      )}
    </div>
  )
}
