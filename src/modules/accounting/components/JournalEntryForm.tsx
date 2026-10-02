'use client'

import { useState, type FormEvent } from 'react'
import { Modal } from '@/shared/components/Modal'
import { FloatingInput, FloatingSelect } from '@/shared/components/FloatingField'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { postJournal } from '../journal/apiClient'
import type { JournalWorkspace, CreateJournalInput } from '../journal/types'
import { journalMoney } from '../journal/format'
import { buttonPrimary, buttonSecondary } from '../utils/buttonStyles'

type DraftLine = { accountCode: string; contactId: string; debit: string; credit: string; description: string }
const emptyLine = (): DraftLine => ({ accountCode: '', contactId: '', debit: '', credit: '', description: '' })

// Common two-line movements: value leaves `from` (credit) and arrives in `to` (debit).
export const JOURNAL_QUICK_ACTIONS = [
  { key: 'ownerInvestment', from: '3101', to: '1101' },
  { key: 'cashExpense', from: '1101', to: '5501' },
  { key: 'guestDeposit', from: '2201', to: '1101' },
  { key: 'bankTransfer', from: '1101', to: '1102' },
] as const
export type JournalQuickAction = (typeof JOURNAL_QUICK_ACTIONS)[number]['key']

// The preview uses integer cents; the server independently validates and balances every entry.
function cents(value: string): number {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value)) return 0
  const [whole, fraction = ''] = value.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

export function JournalEntryForm({ workspace, currency, defaultDate, preset, onClose, onSaved }: {
  workspace: JournalWorkspace; currency: CreateJournalInput['currency']; defaultDate: string
  preset?: JournalQuickAction; onClose: () => void; onSaved: () => void
}) {
  const { t, locale } = useTranslation()
  const label = (key: string) => t(`accounting.journal.${key}`)
  const presetAction = JOURNAL_QUICK_ACTIONS.find((action) => action.key === preset)
  const [date, setDate] = useState(defaultDate)
  const [description, setDescription] = useState(() => presetAction ? label(presetAction.key) : '')
  const [exchangeRate, setExchangeRate] = useState('')
  const [exchangeRateSource, setExchangeRateSource] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [from, setFrom] = useState(() => ({ ...emptyLine(), accountCode: presetAction?.from ?? '' }))
  const [to, setTo] = useState(() => ({ ...emptyLine(), accountCode: presetAction?.to ?? '' }))
  const [amount, setAmount] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const accounts = workspace.accounts.filter((account) => account.postable)
  const debit = lines.reduce((sum, line) => sum + cents(line.debit), 0)
  const credit = lines.reduce((sum, line) => sum + cents(line.credit), 0)
  const balanced = debit > 0 && debit === credit

  function accountFields(line: DraftLine, update: (next: DraftLine) => void, title: string) {
    const account = accounts.find((item) => item.code === line.accountCode)
    return <>
      <FloatingSelect label={title} aria-label={title} value={line.accountCode} required onChange={(event) => update({ ...line, accountCode: event.target.value })}>
        <option value="">{label('selectAccount')}</option>
        {accounts.map((item) => <option key={item.code} value={item.code}>{item.code} · {locale === 'ar' ? item.nameAr : item.nameEn}</option>)}
      </FloatingSelect>
      <FloatingSelect label={label('contact')} aria-label={label('contact')} value={line.contactId} required={account?.requiresContact} onChange={(event) => update({ ...line, contactId: event.target.value })}>
        <option value="">{label(account?.requiresContact ? 'selectContact' : 'noContact')}</option>
        {workspace.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
      </FloatingSelect>
    </>
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!advanced && from.accountCode === to.accountCode) { setError(label('differentAccounts')); return }
    if (advanced && !balanced) { setError(label('unbalanced')); return }
    setSaving(true)
    const draft = advanced ? lines : [{ ...from, debit: '', credit: amount }, { ...to, debit: amount, credit: '' }]
    try {
      await postJournal({ date, currency, description, ...(currency !== 'EGP' ? { exchangeRate, exchangeRateSource } : {}), lines: draft.map((line) => ({
        accountCode: line.accountCode, contactId: line.contactId || null,
        debit: line.debit || '0', credit: line.credit || '0', description: line.description || description,
      })) })
      onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : label('failed')) }
    finally { setSaving(false) }
  }

  return <Modal isOpen onClose={() => { if (!saving) onClose() }} title={label('newEntry')} size="xl">
    <form onSubmit={submit} className="space-y-5">
      <p className="text-sm text-stone-500">{label('immutableHint')}</p>
      {!advanced && <div className="flex flex-wrap gap-2">{JOURNAL_QUICK_ACTIONS.map((action) => <button type="button" key={action.key} aria-pressed={from.accountCode === action.from && to.accountCode === action.to} className="min-h-10 rounded-lg border border-stone-200 px-3 py-2 text-xs hover:bg-accent/10 aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent-ink" onClick={() => { setFrom({ ...emptyLine(), accountCode: action.from }); setTo({ ...emptyLine(), accountCode: action.to }); setDescription(label(action.key)) }}>{label(action.key)}</button>)}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <FloatingInput type="date" label={label('date')} value={date} required onChange={(event) => setDate(event.target.value)} />
        <FloatingInput label={label('currency')} value={currency} readOnly />
      </div>
      {currency !== 'EGP' && <div className="space-y-3 rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-600">{label('exchangeHint').replace('{currency}', currency)}</p><div className="grid gap-3 sm:grid-cols-2"><FloatingInput label={label('exchangeRate')} value={exchangeRate} inputMode="decimal" required pattern="[0-9]+(\.[0-9]{1,8})?" onChange={(event) => setExchangeRate(event.target.value)} /><FloatingInput label={label('rateSource')} value={exchangeRateSource} required maxLength={200} onChange={(event) => setExchangeRateSource(event.target.value)} /></div></div>}
      <FloatingInput label={label('description')} value={description} required minLength={3} maxLength={500} onChange={(event) => setDescription(event.target.value)} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={advanced} onChange={(event) => setAdvanced(event.target.checked)} />{label('advanced')}</label>
      {advanced ? <div className="space-y-3">
        {lines.map((line, index) => <fieldset key={index} className="rounded-lg border border-stone-200 p-3 space-y-3">
          <legend className="px-1 text-sm text-stone-500">{label('line')} {index + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-2">{accountFields(line, (next) => setLines(lines.map((item, position) => position === index ? next : item)), label('account'))}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['debit', 'credit'] as const).map((side) => <FloatingInput key={side} label={label(side)} inputMode="decimal" value={line[side]} pattern="[0-9]+(\.[0-9]{1,2})?" onChange={(event) => setLines(lines.map((item, position) => position === index ? { ...item, [side]: event.target.value } : item))} />)}
          </div>
          {lines.length > 2 && <button type="button" className="text-sm text-red-700 min-h-10" onClick={() => setLines(lines.filter((_, position) => position !== index))}>{label('removeLine')}</button>}
        </fieldset>)}
        <button type="button" disabled={lines.length >= 50} className={buttonSecondary} onClick={() => setLines([...lines, emptyLine()])}>{label('addLine')}</button>
        <div aria-live="polite" className={`rounded-lg p-3 text-sm ${balanced ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>
          <span dir="ltr">{label('debit')}: {journalMoney((debit / 100).toFixed(2), currency)} · {label('credit')}: {journalMoney((credit / 100).toFixed(2), currency)}</span> · {label(balanced ? 'balanced' : 'unbalanced')}
        </div>
      </div> : <>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="space-y-3 rounded-lg border border-stone-200 p-3"><legend className="text-sm px-1">{label('fromCredit')}</legend>{accountFields(from, setFrom, label('account'))}</fieldset>
          <fieldset className="space-y-3 rounded-lg border border-stone-200 p-3"><legend className="text-sm px-1">{label('toDebit')}</legend>{accountFields(to, setTo, label('account'))}</fieldset>
        </div>
        <FloatingInput label={label('amount')} inputMode="decimal" value={amount} pattern="[0-9]+(\.[0-9]{1,2})?" required onChange={(event) => setAmount(event.target.value)} />
      </>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className={buttonSecondary} disabled={saving} onClick={onClose}>{t('common.cancel')}</button>
        <button type="submit" className={buttonPrimary} disabled={saving || (advanced && !balanced)}>{saving ? t('common.loading') : label('post')}</button>
      </div>
    </form>
  </Modal>
}
