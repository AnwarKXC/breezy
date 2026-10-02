'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { toast } from '@/shared/toast/toastEvents'
import { emailErrorText, sendJson, type MailAttachment } from './emailApi'
import { EmailIcon } from '@/modules/email/components/EmailIcon'
import styles from './EmailComposer.module.css'

export interface ComposeDraft {
  to: string
  cc: string
  subject: string
  text: string
  inReplyTo?: string
  references?: string[]
  draftUid?: number
  attachments?: MailAttachment[]
}

const MAX_TOTAL_BYTES = 10 * 1024 * 1024

const splitAddresses = (value: string) =>
  value.split(/[,;\s]+/).map((part) => part.trim()).filter(Boolean)

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function MailComposer({
  draft,
  onClose,
  onSent,
  onSaved,
}: {
  draft: ComposeDraft
  onClose: () => void
  onSent: () => void
  onSaved?: () => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState(draft)
  const [files, setFiles] = useState<File[]>([])
  const [savedAttachments, setSavedAttachments] = useState(draft.attachments ?? [])
  const [busy, setBusy] = useState(false)
  const [operation, setOperation] = useState<'send' | 'save'>('send')
  const [dirty, setDirty] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const attachedBytes = files.reduce((sum, file) => sum + file.size, 0) + savedAttachments.reduce((sum, a) => sum + Math.floor(a.content.length * 0.75), 0)
  const totalAttachments = files.length + savedAttachments.length

  useEffect(() => {
    const modal = dialog.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    modal?.showModal()
    return () => {
      modal?.close()
      opener?.focus()
    }
  }, [])
  const close = () => {
    if (!busy && (!dirty || window.confirm(t('settings.email.compose.discardConfirm')))) onClose()
  }

  const set = (key: 'to' | 'cc' | 'subject' | 'text', value: string) => {
    setDirty(true)
    setForm((current) => ({ ...current, [key]: value }))
  }

  const addFiles = (list: FileList | null) => {
    const next = [...files, ...Array.from(list ?? [])]
    if (next.reduce((sum, f) => sum + f.size, 0) + savedAttachments.reduce((sum, a) => sum + a.content.length * 0.75, 0) > MAX_TOTAL_BYTES || next.length + savedAttachments.length > 10) {
      toast.error(t('settings.email.errors.attachments_too_large'))
      return
    }
    setFiles(next)
    setDirty(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await persist(false)
  }

  const persist = async (save: boolean) => {
    if (busy) return
    setOperation(save ? 'save' : 'send')
    setBusy(true)
    try {
      const attachments = [...savedAttachments, ...await Promise.all(
        files.map(async (file) => ({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          content: await toBase64(file),
        })),
      )]
      const result = await sendJson(`/api/settings/email/messages${save ? '/drafts' : ''}`, 'POST', {
        to: splitAddresses(form.to),
        cc: splitAddresses(form.cc),
        subject: form.subject,
        text: form.text,
        inReplyTo: form.inReplyTo,
        references: form.references,
        draftUid: form.draftUid,
        attachments,
      })
      toast.success(t(save ? 'settings.email.compose.saved' : 'settings.email.compose.sent'))
      if (!save && (result as { draftRemoved?: boolean } | undefined)?.draftRemoved === false) toast.warning(t('settings.email.compose.draftNotRemoved'))
      if (save && (result as { replaced?: boolean } | undefined)?.replaced === false) toast.warning(t('settings.email.compose.draftNotReplaced'))
      if (save) { onSaved?.(); onClose() } else onSent()
    } catch (error) {
      toast.error(emailErrorText(t, (error as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog ref={dialog} onCancel={(e) => { e.preventDefault(); close() }} aria-labelledby="compose-title" className={styles.composer}>
      <form onSubmit={submit} className="flex max-h-[90dvh] w-full flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-surface-muted/25 px-5 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-accent-ink"><EmailIcon name={form.inReplyTo ? 'reply' : 'compose'} className="h-[18px] w-[18px]" /></span>
            <div className="min-w-0">
              <h2 id="compose-title" className="text-sm font-semibold tracking-tight text-ink">{t(form.inReplyTo ? 'settings.email.compose.reply' : 'settings.email.compose.title')}</h2>
              <p className="mt-0.5 text-xs text-ink-muted">{t('settings.email.compose.sharedSender')}</p>
            </div>
          </div>
          <button type="button" disabled={busy} onClick={close} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-white hover:text-ink disabled:opacity-40" aria-label={t('settings.email.compose.close')}>
            <EmailIcon name="close" className="h-[18px] w-[18px]" />
          </button>
        </header>

        <fieldset disabled={busy} className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2 sm:px-7">
          <div className={styles.recipientRow}>
            <label htmlFor="email-compose-to" className="text-xs font-medium text-ink-muted">{t('settings.email.compose.to')}</label>
            <input id="email-compose-to" dir="ltr" required value={form.to} onChange={(e) => set('to', e.target.value)} placeholder={t('settings.email.compose.recipientPlaceholder')} />
          </div>
          <div className={styles.recipientRow}>
            <label htmlFor="email-compose-cc" className="text-xs font-medium text-ink-muted">{t('settings.email.compose.cc')}</label>
            <input id="email-compose-cc" dir="ltr" value={form.cc} onChange={(e) => set('cc', e.target.value)} placeholder={t('settings.email.compose.optional')} />
          </div>
          <div className={styles.recipientRow}>
            <label htmlFor="email-compose-subject" className="text-xs font-medium text-ink-muted">{t('settings.email.compose.subject')}</label>
            <input id="email-compose-subject" dir="auto" value={form.subject} maxLength={500} onChange={(e) => set('subject', e.target.value)} placeholder={t('settings.email.compose.subjectPlaceholder')} />
          </div>
          <textarea id="email-compose-body" dir="auto" value={form.text} onChange={(e) => set('text', e.target.value)} rows={10} aria-label={t('settings.email.compose.body')} placeholder={t('settings.email.compose.bodyPlaceholder')} />

          {(files.length > 0 || savedAttachments.length > 0) && (
            <ul className="flex flex-wrap gap-2 border-t border-line pt-4">
              {savedAttachments.map((attachment, i) => (
                <li key={`saved-${i}`} className="flex max-w-full items-center gap-2 rounded-lg border border-line bg-surface-muted/20 py-1 pe-1 ps-3 text-xs text-ink">
                  <EmailIcon name="attachment" className="h-3.5 w-3.5 text-ink-muted" /><span className="min-w-0 max-w-48 truncate">{attachment.filename}</span>
                  <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-white hover:text-ink" aria-label={t('settings.email.compose.removeAttachment')}
                    onClick={() => { setDirty(true); setSavedAttachments(savedAttachments.filter((_, j) => j !== i)) }}><EmailIcon name="close" className="h-3.5 w-3.5" /></button>
                </li>
              ))}
              {files.map((file, i) => (
                <li key={`${file.name}-${i}`} className="flex max-w-full items-center gap-2 rounded-lg border border-line bg-surface-muted/20 py-1 pe-1 ps-3 text-xs text-ink">
                  <EmailIcon name="attachment" className="h-3.5 w-3.5 text-ink-muted" /><span className="min-w-0 max-w-48 truncate">{file.name}</span>
                  <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-white hover:text-ink" aria-label={t('settings.email.compose.removeAttachment')}
                    onClick={() => { setDirty(true); setFiles(files.filter((_, j) => j !== i)) }}>
                    <EmailIcon name="close" className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-muted/15 px-5 py-4 sm:px-7">
          <label className={`relative inline-flex h-10 items-center gap-2 rounded-lg px-2 text-xs font-medium text-ink-muted transition-colors focus-within:outline-2 focus-within:outline-accent-ink hover:bg-white hover:text-ink ${busy ? 'opacity-40' : 'cursor-pointer'}`}>
            <EmailIcon name="attachment" />{t('settings.email.compose.attach')}
            <input type="file" multiple disabled={busy} className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={() => void persist(true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-xs font-medium text-ink transition-colors hover:bg-surface-muted/30 disabled:opacity-40"><EmailIcon name="draft" />{busy && operation === 'save' ? t('settings.email.compose.saving') : t('settings.email.compose.saveDraft')}</button>
            <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-5 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-40">{busy && operation === 'send' ? t('settings.email.compose.sending') : t('settings.email.compose.send')}<EmailIcon name="sent" className="h-3.5 w-3.5" /></button>
          </div>
        </footer>
        {totalAttachments > 0 && <p className="border-t border-line px-5 py-2 text-[11px] text-ink-muted sm:px-7">{totalAttachments} {t('settings.email.compose.attachmentsLabel')} · {(attachedBytes / (1024 * 1024)).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB</p>}
      </form>
    </dialog>
  )
}
