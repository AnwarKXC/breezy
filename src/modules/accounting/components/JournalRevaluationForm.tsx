'use client'

import { useState, type FormEvent } from 'react'
import { Modal } from '@/shared/components/Modal'
import { FloatingInput, FloatingSelect } from '@/shared/components/FloatingField'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import type { JournalWorkspace } from '../journal/types'
import { buttonPrimary, buttonSecondary } from '../utils/buttonStyles'

export function JournalRevaluationForm({ workspace, defaultDate, onClose, onSaved }: {
  workspace: JournalWorkspace; defaultDate: string; onClose: () => void; onSaved: () => void
}) {
  const { t, locale } = useTranslation()
  const label = (key: string) => t(`accounting.journal.${key}`)
  const [date, setDate] = useState(defaultDate)
  const [currency, setCurrency] = useState('USD')
  const [accountCode, setAccountCode] = useState('1101')
  const [contactId, setContactId] = useState('')
  const [closingRate, setClosingRate] = useState('')
  const [source, setSource] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const contactRequired = accountCode === '1201' || accountCode === '2101'
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const response = await fetch('/api/accounting/journal/revaluation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, currency, accountCode, contactId: contactRequired ? contactId : null, closingRate, source }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error ?? label('failed'))
      onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : label('failed')) }
    finally { setSaving(false) }
  }
  return <Modal isOpen title={label('revaluation')} onClose={() => { if (!saving) onClose() }}><form onSubmit={submit} className="space-y-4">
    <p className="text-sm text-stone-600">{label('revaluationHint')}</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <FloatingInput label={label('date')} type="date" value={date} required onChange={(event) => setDate(event.target.value)} />
      <FloatingSelect label={label('currency')} aria-label={label('currency')} value={currency} onChange={(event) => setCurrency(event.target.value)}>{['USD', 'EUR', 'GBP'].map((code) => <option key={code}>{code}</option>)}</FloatingSelect>
      <FloatingSelect label={label('account')} aria-label={label('account')} value={accountCode} onChange={(event) => { setAccountCode(event.target.value); setContactId('') }}>{workspace.accounts.filter((account) => account.postable && ['1101', '1102', '1201', '2101'].includes(account.code)).map((account) => <option key={account.code} value={account.code}>{account.code} · {locale === 'ar' ? account.nameAr : account.nameEn}</option>)}</FloatingSelect>
      {contactRequired && <FloatingSelect label={label('contact')} aria-label={label('contact')} value={contactId} required onChange={(event) => setContactId(event.target.value)}><option value="">{label('selectContact')}</option>{workspace.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</FloatingSelect>}
      <FloatingInput label={label('closingRate')} value={closingRate} required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,8})?" maxLength={25} onChange={(event) => setClosingRate(event.target.value)} />
      <FloatingInput label={label('rateSource')} value={source} required minLength={3} maxLength={200} onChange={(event) => setSource(event.target.value)} />
    </div>
    <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{label('revaluationWarning')}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex justify-end gap-3"><button type="button" className={buttonSecondary} disabled={saving} onClick={onClose}>{t('common.cancel')}</button><button className={buttonPrimary} disabled={saving}>{saving ? t('common.saving') : label('postRevaluation')}</button></div>
  </form></Modal>
}
