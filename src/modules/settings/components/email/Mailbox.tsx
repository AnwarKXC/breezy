'use client'

import { useEffect, useEffectEvent, useState, type FormEvent } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { toast } from '@/shared/toast/toastEvents'
import { fetchData, loadResource, useResource } from '@/shared/data/useResource'
import { MailComposer, type ComposeDraft } from './MailComposer'
import { emailErrorText, formatAddress, sendJson, type MailAction, type MailDetail, type MailFolder, type MailPage, type MailSummary } from './emailApi'

const FOLDERS: MailFolder[] = ['inbox', 'sent', 'drafts', 'archive', 'pinned', 'trash']
const API = '/api/settings/email/messages'

const button =
  'inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink transition-colors hover:bg-accent/10 disabled:opacity-50'

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

async function composeAttachments(message: MailDetail, folder: MailFolder) {
  return Promise.all(message.attachments.map(async (a) => {
    if (a.content !== undefined) return { filename: a.filename, contentType: a.contentType, content: a.content }
    const response = await fetch(`${API}/${message.uid}/attachments/${a.index}?folder=${folder}`)
    if (!response.ok) throw new Error('email/imap_failed')
    const blob = await response.blob()
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    return { filename: a.filename, contentType: a.contentType, content }
  }))
}

export function Mailbox({ email, canEdit }: { email: string; canEdit: boolean }) {
  const { t, locale } = useTranslation()
  const [folder, setFolder] = useState<MailFolder>('inbox')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<{ uid: number; folder: MailFolder } | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<ComposeDraft | null>(null)

  const listUrl = `${API}?${new URLSearchParams({ folder, page: String(page), q: query })}`
  const list = useResource<MailPage>(listUrl, () => fetchData<MailPage>(listUrl), { staleMs: 30_000 })
  const messageUrl = selected === null ? null : `${API}/${selected.uid}?folder=${selected.folder}`
  const message = useResource<MailDetail>(messageUrl, () => fetchData<MailDetail>(messageUrl!), { staleMs: 60_000 })

  const key = (m: MailSummary) => `${m.folder ?? folder}:${m.uid}`
  const open = async (m: MailSummary) => {
    if ((m.folder ?? folder) === 'drafts' && canEdit) {
      setBusy(true)
      try {
        const detail = await fetchData<MailDetail>(`${API}/${m.uid}?folder=drafts`)
        const attachments = await composeAttachments(detail, 'drafts')
        setDraft({ draftUid: m.uid, to: detail.to.map((a) => a.address).join(', '), cc: detail.cc.map((a) => a.address).join(', '), subject: detail.subject, text: detail.text, inReplyTo: detail.inReplyTo ?? undefined, references: detail.references, attachments })
      } catch (error) { toast.error(emailErrorText(t, (error as Error).message)) }
      finally { setBusy(false) }
      return
    }
    setSelected({ uid: m.uid, folder: m.folder ?? folder })
    const detailUrl = `${API}/${m.uid}?folder=${m.folder ?? folder}`
    void loadResource(detailUrl, () => fetchData<MailDetail>(detailUrl), { force: true })
    list.mutate((current) =>
      current ? { ...current, items: current.items.map((row) => (key(row) === key(m) ? { ...row, seen: true } : row)) } : current!,
    )
  }

  const switchFolder = (next: MailFolder) => {
    setFolder(next)
    setPage(1)
    setSelected(null)
    setChecked([])
  }

  const runSearch = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setQuery(search.trim())
    setSelected(null)
    setChecked([])
  }

  const act = async (run: () => Promise<unknown>, done: string) => {
    try {
      await run()
      toast.success(t(done))
      await list.refresh()
    } catch (error) {
      toast.error(emailErrorText(t, (error as Error).message))
      await list.refresh()
    }
  }

  const applyAction = async (action: MailAction, rows: {uid: number; folder?: MailFolder}[]) => {
    if (busy || !rows.length) return
    if (action === 'deleteForever' && !window.confirm(t('settings.email.inbox.deleteConfirm'))) return
    setBusy(true)
    await act(async () => {
      const groups = new Map<MailFolder, number[]>()
      rows.forEach((row) => { const f = row.folder ?? folder; groups.set(f, [...(groups.get(f) ?? []), row.uid]) })
      for (const [f, uids] of groups) await sendJson(API, 'PATCH', { folder: f, uids, action })
      if ((action === 'pin' || action === 'unpin') && selected && rows.some((row) => row.uid === selected.uid && (row.folder ?? folder) === selected.folder)) {
        message.mutate((current) => current ? { ...current, flagged: action === 'pin' } : current!)
      }
      if (action !== 'pin' && action !== 'unpin' && action !== 'read') setSelected(null)
      setChecked([])
    }, 'settings.email.inbox.updated')
    setBusy(false)
  }

  const refreshVisible = useEffectEvent(() => {
    if (!document.hidden && !busy && !draft && !list.isFetching) void list.refresh()
  })
  useEffect(() => {
    const timer = window.setInterval(refreshVisible, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const reply = (m: MailDetail, all: boolean) => {
    const own = email.toLowerCase()
    const sentByUs = m.from.some((a) => a.address.toLowerCase() === own)
    const candidates = sentByUs ? m.to : m.replyTo.length ? m.replyTo : m.from
    const addresses = new Set([own])
    const unique = (people: typeof candidates) => people.filter((a) => {
      const address = a.address.toLowerCase()
      if (addresses.has(address)) return false
      addresses.add(address)
      return true
    })
    const target = unique(candidates)
    const others = all ? unique([...m.to, ...m.cc]) : []
    setDraft({
      to: target.map((a) => a.address).join(', '),
      cc: others.map((a) => a.address).join(', '),
      subject: prefixed('Re:', m.subject),
      text: quote(m),
      inReplyTo: m.messageId ?? undefined,
      references: [...m.references, ...(m.messageId ? [m.messageId] : [])].slice(-100),
    })
  }

  const forward = async (m: MailDetail) => {
    if (!selected || busy) return
    setBusy(true)
    try {
      const attachments = await composeAttachments(m, selected.folder)
      setDraft({ to: '', cc: '', subject: prefixed('Fwd:', m.subject), text: quote(m), attachments })
    } catch (error) { toast.error(emailErrorText(t, (error as Error).message)) }
    finally { setBusy(false) }
  }

  const data = list.data
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg bg-surface-muted p-1" role="tablist" aria-label={t('settings.email.inbox.folders')}>
          {FOLDERS.map((f) => (
            <button key={f} type="button" role="tab" disabled={busy} tabIndex={folder === f ? 0 : -1} aria-selected={folder === f} onClick={() => switchFolder(f)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                event.preventDefault()
                const step = (event.key === 'ArrowRight' ? 1 : -1) * (locale === 'ar' ? -1 : 1)
                const index = event.key === 'Home' ? 0 : event.key === 'End' ? FOLDERS.length - 1 : (FOLDERS.indexOf(f) + step + FOLDERS.length) % FOLDERS.length
                switchFolder(FOLDERS[index])
                const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                tabs?.[index]?.focus()
              }}
              className={`h-10 rounded-md px-3 text-sm font-medium transition-colors ${folder === f ? 'bg-accent/10 text-accent-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
              {t(`settings.email.folders.${f}`)}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <form onSubmit={runSearch} className="min-w-0 flex-1 sm:w-48 sm:flex-none">
            <input type="search" disabled={busy} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('settings.email.inbox.search')}
              aria-label={t('settings.email.inbox.search')}
              className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-ink" />
          </form>
          <button type="button" className={button} disabled={busy || list.isFetching} onClick={() => void list.refresh()} aria-label={t('settings.email.inbox.refresh')}>
            {list.isFetching ? '…' : '↻'}
          </button>
          {canEdit && (
            <button type="button" disabled={busy} onClick={() => setDraft({ to: '', cc: '', subject: '', text: '' })}
              className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
              {t('settings.email.compose.title')}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className={`overflow-hidden rounded-xl border border-line bg-white ${selected !== null ? 'hidden lg:block' : ''}`}>
          {canEdit && !!data?.items.length && (
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
              <label className="flex min-h-10 items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={data.items.every((m) => checked.includes(key(m)))} disabled={busy} onChange={(e) => setChecked(e.target.checked ? data.items.map(key) : [])} />
                {t('settings.email.inbox.selectAll')}
              </label>
              {checked.length > 0 && <><span className="text-xs text-ink-muted">{checked.length} {t('settings.email.inbox.selected')}</span>
                {(folder === 'trash' ? ['restore', 'deleteForever'] : folder === 'drafts' ? ['trash'] : ['read', 'unread', 'pin', 'unpin', ...(folder !== 'archive' ? ['archive'] : ['restore']), 'trash']).map((action) => (
                  <button key={action} type="button" className={button} disabled={busy} onClick={() => void applyAction(action as MailAction, data.items.filter((m) => checked.includes(key(m))))}>{t(`settings.email.actions.${action}`)}</button>
                ))}
              </>}
            </div>
          )}
          {list.error ? (
            <p className="p-6 text-sm text-red-600">{emailErrorText(t, list.error.message)}</p>
          ) : list.isLoading ? (
            <p className="p-6 text-sm text-ink-muted">{t('settings.email.inbox.loading')}</p>
          ) : !data?.items.length ? (
            <p className="p-6 text-sm text-ink-muted">{t('settings.email.inbox.empty')}</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.items.map((m) => {
                const people = folder === 'sent' || folder === 'drafts' ? m.to : m.from
                return (
                  <li key={key(m)} className="flex items-center">
                    {canEdit && <label className="flex min-h-12 w-10 shrink-0 items-center justify-center"><input type="checkbox" aria-label={`${t('settings.email.inbox.select')}: ${m.subject}`} disabled={busy} checked={checked.includes(key(m))} onChange={(e) => setChecked(e.target.checked ? [...checked, key(m)] : checked.filter((k) => k !== key(m)))} /></label>}
                    <button type="button" disabled={busy} onClick={() => void open(m)}
                      className={`block min-w-0 flex-1 px-4 py-3 text-start transition-colors hover:bg-accent/10 ${selected && selected.uid === m.uid && selected.folder === (m.folder ?? folder) ? 'bg-surface-muted' : ''}`}>
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={`truncate text-sm ${m.seen ? 'text-ink-muted' : 'font-semibold text-ink'}`}>
                          {people.map(formatAddress).join(', ') || '—'}
                        </span>
                        <span className="shrink-0 text-xs text-ink-muted">{formatDate(m.date, locale)}</span>
                      </span>
                      <span className={`mt-0.5 flex items-center gap-2 text-sm ${m.seen ? 'text-ink-muted' : 'font-medium text-ink'}`}>
                        {!m.seen && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label={t('settings.email.inbox.unread')} />}
                        <span dir="auto" className="truncate">{m.subject || t('settings.email.inbox.noSubject')}</span>
                        {m.flagged && <span aria-label={t('settings.email.folders.pinned')}>★</span>}
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
              <button type="button" className={button} disabled={page <= 1} onClick={() => { setPage(page - 1); setChecked([]); setSelected(null) }}>{t('settings.email.inbox.newer')}</button>
              <span>{page} / {totalPages}</span>
              <button type="button" className={button} disabled={page >= totalPages} onClick={() => { setPage(page + 1); setChecked([]); setSelected(null) }}>{t('settings.email.inbox.older')}</button>
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
                <fieldset disabled={busy} className="flex flex-wrap gap-2">
                  <button type="button" className={button} onClick={() => reply(message.data!, false)}>{t('settings.email.inbox.reply')}</button>
                  <button type="button" className={button} onClick={() => reply(message.data!, true)}>{t('settings.email.inbox.replyAll')}</button>
                  <button type="button" className={button} onClick={() => void forward(message.data!)}>{t('settings.email.inbox.forward')}</button>
                  {(selected.folder === 'trash' ? ['restore', 'deleteForever'] : [message.data.flagged ? 'unpin' : 'pin', 'unread', ...(selected.folder === 'archive' ? ['restore'] : selected.folder === 'inbox' || selected.folder === 'sent' ? ['archive'] : []), 'trash']).map((action) => (
                    <button key={action} type="button" className={button} onClick={() => void applyAction(action as MailAction, [selected])}>{t(`settings.email.actions.${action}`)}</button>
                  ))}
                </fieldset>
              )}

              <MailBody message={message.data} />

              {message.data.attachments.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {message.data.attachments.map((a) => (
                    <li key={a.index}>
                      <a href={`${API}/${message.data!.uid}/attachments/${a.index}?folder=${selected.folder}`}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm text-ink hover:bg-accent/10">
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
            void list.refresh()
          }}
          onSaved={() => void list.refresh()}
        />
      )}
    </div>
  )
}
