'use client'

import { useEffect, useEffectEvent, useState, type FormEvent } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { toast } from '@/shared/toast/toastEvents'
import { fetchData, loadResource, useResource } from '@/shared/data/useResource'
import { MailComposer, type ComposeDraft } from './MailComposer'
import { EmailIcon } from '@/modules/email/components/EmailIcon'
import styles from './Mailbox.module.css'
import { emailErrorText, formatAddress, sendJson, type MailAction, type MailDetail, type MailFolder, type MailPage, type MailSummary } from './emailApi'

const FOLDERS: MailFolder[] = ['inbox', 'sent', 'drafts', 'archive', 'pinned', 'trash']
const API = '/api/settings/email/messages'

const button =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-xs font-medium text-ink transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'

const folderIcons = { inbox: 'inbox', sent: 'sent', drafts: 'draft', archive: 'archive', pinned: 'pin', trash: 'trash' } as const
const actionIcons = { read: 'read', unread: 'unread', pin: 'pin', unpin: 'pin', archive: 'archive', trash: 'trash', restore: 'restore', deleteForever: 'trash' } as const

function initials(label: string) {
  return label.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

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
    return <pre dir="auto" className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-ink [overflow-wrap:anywhere]">{message.text}</pre>
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

  const bulkActions: MailAction[] = folder === 'trash' ? ['restore', 'deleteForever'] : folder === 'drafts' ? ['trash'] : ['archive', 'read', 'unread', 'pin', 'unpin', 'trash']
  if (folder === 'archive') bulkActions[0] = 'restore'
  const readerActions: MailAction[] = selected?.folder === 'trash' ? ['restore', 'deleteForever'] : [message.data?.flagged ? 'unpin' : 'pin', 'unread', ...(selected?.folder === 'archive' ? ['restore' as const] : selected?.folder === 'inbox' || selected?.folder === 'sent' ? ['archive' as const] : []), 'trash']
  const actionButton = (action: MailAction, rows: { uid: number; folder?: MailFolder }[]) => (
    <button key={action} type="button" disabled={busy} title={t(`settings.email.actions.${action}`)} aria-label={t(`settings.email.actions.${action}`)}
      onClick={() => void applyAction(action, rows)}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 ${action === 'deleteForever' ? 'text-red-600' : 'text-ink-muted hover:text-ink'}`}>
      <EmailIcon name={actionIcons[action]} className="h-4 w-4" />
    </button>
  )

  return (
    <div className={`${styles.workspace} overflow-hidden rounded-xl border border-line bg-white shadow-[0_4px_24px_-16px_rgba(28,25,23,0.22)]`}>
      <div className="flex min-w-0 flex-col lg:h-[min(760px,calc(100dvh-210px))] lg:min-h-[520px] xl:flex-row">
        <aside className={`flex shrink-0 flex-col border-b border-line bg-surface-muted/40 xl:w-44 xl:border-b-0 xl:border-e ${selected ? 'hidden lg:flex' : ''}`}>
          <div className="hidden px-5 pb-6 pt-7 xl:block">
            <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white text-ink"><EmailIcon name="mail" className="h-5 w-5" /></span>
            <p className="text-xs font-semibold text-ink">{t('settings.email.inbox.mailboxLabel')}</p>
            <p dir="auto" title={email} className="mt-1 truncate text-[11px] text-ink-muted">{email}</p>
          </div>
          <div className="flex items-center gap-3 p-3 xl:block xl:px-3 xl:pb-4 xl:pt-0">
            {canEdit && <button type="button" disabled={busy} onClick={() => setDraft({ to: '', cc: '', subject: '', text: '' })}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 xl:w-full">
              <EmailIcon name="compose" className="h-4 w-4" />{t('settings.email.compose.title')}
            </button>}
            <div className="min-w-0 overflow-x-auto xl:mt-5" role="tablist" aria-label={t('settings.email.inbox.folders')}>
              <div className="flex min-w-max gap-1 xl:min-w-0 xl:flex-col">
                {FOLDERS.map((f) => (
                  <button key={f} type="button" role="tab" aria-label={t(`settings.email.folders.${f}`)} disabled={busy} tabIndex={folder === f ? 0 : -1} aria-selected={folder === f} onClick={() => switchFolder(f)}
                    onKeyDown={(event) => {
                      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
                      event.preventDefault()
                      const horizontal = event.key === 'ArrowRight' || event.key === 'ArrowLeft'
                      const step = (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) * (horizontal && locale === 'ar' ? -1 : 1)
                      const index = event.key === 'Home' ? 0 : event.key === 'End' ? FOLDERS.length - 1 : (FOLDERS.indexOf(f) + step + FOLDERS.length) % FOLDERS.length
                      switchFolder(FOLDERS[index])
                      const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                      tabs?.[index]?.focus()
                    }}
                    className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-start text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${folder === f ? 'bg-white font-semibold text-ink shadow-sm ring-1 ring-line' : 'text-ink-muted hover:bg-white/70 hover:text-ink'}`}>
                    <EmailIcon name={folderIcons[f]} className={`h-4 w-4 shrink-0 ${folder === f ? 'text-accent-ink' : ''}`} />
                    <span>{t(`settings.email.folders.${f}`)}</span>
                    {folder === f && data && <span className="ms-auto hidden rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-ink-muted xl:block">{data.total}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="grid min-h-0 min-w-0 flex-1 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.15fr)] xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
          <section className={`flex min-h-0 min-w-0 flex-col lg:border-e lg:border-line ${selected !== null ? 'hidden lg:flex' : ''}`}>
            <header className="shrink-0 border-b border-line px-5 pb-4 pt-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0"><h2 className="text-base font-semibold tracking-tight text-ink">{t(`settings.email.folders.${folder}`)}</h2><p className="mt-0.5 truncate text-xs text-ink-muted">{data ? `${data.total} ${t('settings.email.inbox.messageCount')}` : email}</p></div>
                <button type="button" disabled={busy || list.isFetching} onClick={() => void list.refresh()} aria-label={t('settings.email.inbox.refresh')} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-50">
                  <EmailIcon name="refresh" className={`h-4 w-4 ${list.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} />
                </button>
              </div>
              <form onSubmit={runSearch} className="relative">
                <EmailIcon name="search" className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-ink-muted" />
                <input id="email-mail-search" type="search" disabled={busy} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('settings.email.inbox.search')} aria-label={t('settings.email.inbox.search')}
                  className="h-10 w-full rounded-lg border border-line bg-surface-muted/40 pe-3 ps-9 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-ink focus:bg-white" />
              </form>
            </header>
            {canEdit && !!data?.items.length && (
              <div className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs text-ink-muted">
                  <input type="checkbox" aria-label={t('settings.email.inbox.selectAll')} className="h-4 w-4 rounded border-line accent-ink" checked={data.items.every((m) => checked.includes(key(m)))} disabled={busy} onChange={(e) => setChecked(e.target.checked ? data.items.map(key) : [])} />
                  <span>{t('settings.email.inbox.selectAll')}{checked.length ? ` · ${checked.length}` : ''}</span>
                </label>
                {!!checked.length && <div className="flex items-center">
                  {actionButton(bulkActions[0], data.items.filter((m) => checked.includes(key(m))))}
                  {bulkActions.length > 1 && <details className="group relative">
                    <summary aria-label={t('settings.email.inbox.moreActions')} title={t('settings.email.inbox.moreActions')} className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg text-ink-muted hover:bg-surface-muted [&::-webkit-details-marker]:hidden"><EmailIcon name="more" className="h-4 w-4" /></summary>
                    <div className="absolute end-0 top-full z-20 min-w-44 rounded-lg border border-line bg-white p-1 shadow-lg">
                      {bulkActions.slice(1).map((action) => <button key={action} type="button" disabled={busy} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); void applyAction(action, data.items.filter((m) => checked.includes(key(m)))) }} className={`flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-start text-xs hover:bg-surface-muted ${action === 'deleteForever' ? 'text-red-600' : 'text-ink'}`}>
                        <EmailIcon name={actionIcons[action]} className="h-4 w-4" />{t(`settings.email.actions.${action}`)}
                      </button>)}
                    </div>
                  </details>}
                </div>}
              </div>
            )}
            <div className="min-h-80 flex-1 lg:min-h-0 lg:overflow-y-auto">
              {list.error ? <p role="alert" className="p-6 text-sm text-red-600">{emailErrorText(t, list.error.message)}</p>
                : list.isLoading ? <div role="status" aria-label={t('settings.email.inbox.loading')} className="divide-y divide-line">{[0, 1, 2, 3, 4].map((row) => <div key={row} className="animate-pulse space-y-3 px-5 py-5 motion-reduce:animate-none"><div className="h-3 w-2/3 rounded bg-surface-muted" /><div className="h-3 w-5/6 rounded bg-surface-muted" /><div className="h-2 w-1/3 rounded bg-surface-muted" /></div>)}</div>
                  : !data?.items.length ? <div className="flex min-h-80 flex-col items-center justify-center px-8 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface-muted/50"><EmailIcon name={folderIcons[folder]} className="h-6 w-6 text-ink-muted" /></div>
                    <p className="text-sm font-medium text-ink">{t('settings.email.inbox.empty')}</p><p className="mt-2 max-w-56 text-xs leading-relaxed text-ink-muted">{t('settings.email.inbox.emptyHint')}</p>
                  </div> : <ul className="divide-y divide-line/70">
                    {data.items.map((m) => {
                      const people = folder === 'sent' || folder === 'drafts' ? m.to : m.from
                      const person = people.map(formatAddress).join(', ') || '—'
                      const active = selected?.uid === m.uid && selected.folder === (m.folder ?? folder)
                      return <li key={key(m)} className={`relative flex items-start transition-colors ${active ? 'bg-accent/8' : 'hover:bg-surface-muted/50'}`}>
                        {active && <span className="absolute inset-y-0 start-0 w-0.5 bg-accent" />}
                        {canEdit && <label className="flex min-h-12 w-9 shrink-0 cursor-pointer items-center justify-center ps-1 pt-2"><input type="checkbox" className="h-3.5 w-3.5 rounded border-line accent-ink" aria-label={`${t('settings.email.inbox.select')}: ${m.subject}`} disabled={busy} checked={checked.includes(key(m))} onChange={(e) => setChecked(e.target.checked ? [...checked, key(m)] : checked.filter((k) => k !== key(m)))} /></label>}
                        <button type="button" disabled={busy} onClick={() => void open(m)} className={`min-w-0 flex-1 py-4 pe-4 text-start focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-accent ${canEdit ? 'ps-1' : 'ps-5'}`}>
                          <span className="flex items-center justify-between gap-2"><span className={`truncate text-[13px] ${m.seen ? 'font-medium text-ink-muted' : 'font-semibold text-ink'}`}>{person}</span><span className="shrink-0 text-[10px] tabular-nums text-ink-muted">{formatDate(m.date, locale)}</span></span>
                          <span className={`mt-1.5 block truncate text-[13px] leading-5 ${m.seen ? 'text-ink-muted' : 'font-medium text-ink'}`} dir="auto">{m.subject || t('settings.email.inbox.noSubject')}</span>
                          <span className="mt-2 flex h-4 items-center gap-2">
                            {!m.seen && <span className="flex items-center gap-1.5 text-[10px] font-medium text-accent-ink"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{t('settings.email.inbox.unread')}</span>}
                            {m.flagged && <span aria-label={t('settings.email.folders.pinned')}><EmailIcon name="pin" className="h-3.5 w-3.5 text-accent-ink" /></span>}
                            {m.hasAttachments && <span aria-label={t('settings.email.inbox.hasAttachments')}><EmailIcon name="attachment" className="h-3.5 w-3.5 text-ink-muted" /></span>}
                          </span>
                        </button>
                      </li>
                    })}
                  </ul>}
            </div>
            {data && data.total > data.pageSize && <div className="flex shrink-0 items-center justify-between border-t border-line bg-surface-muted/20 px-4 py-2 text-xs text-ink-muted">
              <button type="button" className="inline-flex h-10 items-center gap-1 font-medium disabled:opacity-40" disabled={busy || page <= 1} onClick={() => { setPage(page - 1); setChecked([]); setSelected(null) }}><EmailIcon name="chevronLeft" className="h-4 w-4 rtl:rotate-180" />{t('settings.email.inbox.newer')}</button>
              <span className="tabular-nums">{page} / {totalPages}</span>
              <button type="button" className="inline-flex h-10 items-center gap-1 font-medium disabled:opacity-40" disabled={busy || page >= totalPages} onClick={() => { setPage(page + 1); setChecked([]); setSelected(null) }}>{t('settings.email.inbox.older')}<EmailIcon name="chevronRight" className="h-4 w-4 rtl:rotate-180" /></button>
            </div>}
          </section>

          <section className={`min-h-0 min-w-0 lg:overflow-y-auto ${selected === null ? 'hidden lg:flex lg:flex-col' : ''}`}>
            {selected !== null && <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-line px-4">
              <button type="button" className="inline-flex h-10 items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink lg:hidden" onClick={() => setSelected(null)}><EmailIcon name="chevronLeft" className="h-4 w-4 rtl:rotate-180" />{t('settings.email.inbox.backToList')}</button>
              <span className="hidden text-xs text-ink-muted lg:block">{t(`settings.email.folders.${selected.folder}`)}</span>
              {canEdit && <fieldset disabled={busy} className="flex items-center">
                <button type="button" aria-label={t('settings.email.compose.title')} title={t('settings.email.compose.title')} onClick={() => setDraft({ to: '', cc: '', subject: '', text: '' })} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-muted lg:hidden"><EmailIcon name="compose" className="h-4 w-4" /></button>
                {!message.error && message.data && readerActions.map((action) => actionButton(action, [selected]))}
              </fieldset>}
            </div>}
            {selected === null ? <div className="flex min-h-80 flex-1 flex-col items-center justify-center bg-surface-muted/15 p-8 text-center">
              <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-line/60"><div className="absolute inset-2 rounded-full border border-line/70 bg-white" /><EmailIcon name="mail" className="relative h-9 w-9 text-ink-muted" /></div>
              <h2 className="text-base font-semibold tracking-tight text-ink">{t('settings.email.inbox.selectMessage')}</h2>
              <p className="mt-2 max-w-60 text-sm leading-6 text-ink-muted">{t('settings.email.inbox.readerHint')}</p><p dir="auto" className="mt-6 max-w-full break-words text-xs text-ink-muted [overflow-wrap:anywhere]">{email}</p>
            </div> : message.error ? <p role="alert" className="p-6 text-sm text-red-600">{emailErrorText(t, message.error.message)}</p>
              : !message.data ? <div role="status" aria-label={t('settings.email.inbox.loading')} className="animate-pulse space-y-6 p-7 motion-reduce:animate-none"><div className="h-6 w-3/4 rounded bg-surface-muted" /><div className="h-10 w-1/2 rounded bg-surface-muted" /><div className="h-48 w-full rounded bg-surface-muted/50" /></div>
                : <article className="min-w-0">
                  <div className="min-w-0 px-5 py-6 sm:px-7">
                    <header className="border-b border-line pb-6">
                      <h2 dir="auto" className="break-words text-xl font-semibold leading-8 tracking-tight text-ink [overflow-wrap:anywhere]">{message.data.subject || t('settings.email.inbox.noSubject')}</h2>
                      <div className="mt-5 flex items-start gap-3">
                        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface-muted text-xs font-semibold text-ink-muted">{initials(message.data.from.map(formatAddress).join(' ')) || '—'}</span>
                        <div className="min-w-0 flex-1">
                          <p dir="auto" className="break-words text-sm font-semibold text-ink [overflow-wrap:anywhere]">{message.data.from.map(formatAddress).join(', ')}</p>
                          <p dir="auto" className="mt-0.5 break-words text-xs leading-5 text-ink-muted [overflow-wrap:anywhere]">{message.data.from.map((a) => a.address).join(', ')}</p>
                          <p dir="auto" className="mt-2 break-words text-xs leading-5 text-ink-muted [overflow-wrap:anywhere]">{t('settings.email.compose.to')}: {message.data.to.map((a) => a.address).join(', ')}{message.data.cc.length > 0 && ` · ${t('settings.email.compose.cc')}: ${message.data.cc.map((a) => a.address).join(', ')}`}</p>
                          {message.data.date && <p className="mt-1 text-[11px] text-ink-muted">{new Date(message.data.date).toLocaleString(locale)}</p>}
                        </div>
                      </div>
                    </header>
                    <div className="min-w-0 py-6"><MailBody message={message.data} /></div>
                    {message.data.attachments.length > 0 && <ul className="mb-6 grid min-w-0 gap-2">
                      {message.data.attachments.map((a) => <li key={a.index} className="min-w-0"><a href={`${API}/${message.data!.uid}/attachments/${a.index}?folder=${selected.folder}`} className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg border border-line bg-surface-muted/25 px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-muted">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-white"><EmailIcon name="attachment" className="h-4 w-4 text-ink-muted" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{a.filename}</span><span className="mt-0.5 block text-[10px] text-ink-muted">{Math.max(1, Math.round(a.size / 1024))} KB</span></span><EmailIcon name="download" className="h-4 w-4 shrink-0 text-ink-muted" />
                      </a></li>)}
                    </ul>}
                    {canEdit && <fieldset disabled={busy} className="flex flex-wrap gap-2 border-t border-line pt-5">
                      <button type="button" className={button} onClick={() => reply(message.data!, false)}><EmailIcon name="reply" className="h-4 w-4" />{t('settings.email.inbox.reply')}</button>
                      <button type="button" className={button} onClick={() => reply(message.data!, true)}><EmailIcon name="replyAll" className="h-4 w-4" />{t('settings.email.inbox.replyAll')}</button>
                      <button type="button" className={button} onClick={() => void forward(message.data!)}><EmailIcon name="forward" className="h-4 w-4" />{t('settings.email.inbox.forward')}</button>
                    </fieldset>}
                  </div>
                </article>}
          </section>
        </div>
      </div>
      {draft && <MailComposer draft={draft} onClose={() => setDraft(null)} onSent={() => { setDraft(null); void list.refresh() }} onSaved={() => void list.refresh()} />}
    </div>
  )
}
