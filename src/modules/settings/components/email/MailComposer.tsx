'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { toast } from '@/shared/toast/toastEvents'
import { emailErrorText, sendJson, type MailAttachment } from './emailApi'

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

const input =
  'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-ink'

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

  useEffect(() => { dialog.current?.showModal() }, [])
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
    <dialog ref={dialog} onCancel={(e) => { e.preventDefault(); close() }} aria-labelledby="compose-title" className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-xl bg-white p-0 backdrop:bg-black/30">
      <form onSubmit={submit} className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-xl bg-white">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 id="compose-title" className="font-semibold text-ink">
            {t(form.inReplyTo ? 'settings.email.compose.reply' : 'settings.email.compose.title')}
          </h2>
          <button type="button" disabled={busy} onClick={close} className="grid h-10 w-10 place-items-center rounded-lg text-ink-muted hover:bg-accent/10" aria-label={t('settings.email.compose.close')}>
            ✕
          </button>
        </header>

        <fieldset disabled={busy} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          <input className={input} dir="ltr" required value={form.to} onChange={(e) => set('to', e.target.value)}
            placeholder={t('settings.email.compose.to')} aria-label={t('settings.email.compose.to')} />
          <input className={input} dir="ltr" value={form.cc} onChange={(e) => set('cc', e.target.value)}
            placeholder={t('settings.email.compose.cc')} aria-label={t('settings.email.compose.cc')} />
          <input className={input} value={form.subject} maxLength={500} onChange={(e) => set('subject', e.target.value)}
            placeholder={t('settings.email.compose.subject')} aria-label={t('settings.email.compose.subject')} />
          <textarea dir="auto" value={form.text} onChange={(e) => set('text', e.target.value)} rows={12}
            aria-label={t('settings.email.compose.body')}
            className="w-full rounded-lg border border-line bg-white p-3 text-sm text-ink outline-none focus:border-ink" />

          {(files.length > 0 || savedAttachments.length > 0) && (
            <ul className="flex flex-wrap gap-2">
              {savedAttachments.map((attachment, i) => (
                <li key={`saved-${i}`} className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-1.5 text-sm text-ink">
                  <span className="max-w-48 truncate">{attachment.filename}</span>
                  <button type="button" className="min-h-8 min-w-8 text-ink-muted hover:text-ink" aria-label={t('settings.email.compose.removeAttachment')}
                    onClick={() => { setDirty(true); setSavedAttachments(savedAttachments.filter((_, j) => j !== i)) }}>×</button>
                </li>
              ))}
              {files.map((file, i) => (
                <li key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-1.5 text-sm text-ink">
                  <span className="max-w-48 truncate">{file.name}</span>
                  <button type="button" className="text-ink-muted hover:text-ink" aria-label={t('settings.email.compose.removeAttachment')}
                    onClick={() => { setDirty(true); setFiles(files.filter((_, j) => j !== i)) }}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <label className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-accent/10">
            {t('settings.email.compose.attach')}
            <input type="file" multiple disabled={busy} className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
          </label>
          <button type="button" disabled={busy} onClick={() => void persist(true)} className="h-10 rounded-lg border border-line px-4 text-sm font-medium text-ink disabled:opacity-50">
            {busy && operation === 'save' ? t('settings.email.compose.saving') : t('settings.email.compose.saveDraft')}
          </button>
          <button type="submit" disabled={busy}
            className="h-10 rounded-lg bg-accent px-5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50">
            {busy && operation === 'send' ? t('settings.email.compose.sending') : t('settings.email.compose.send')}
          </button>
        </footer>
      </form>
    </dialog>
  )
}
