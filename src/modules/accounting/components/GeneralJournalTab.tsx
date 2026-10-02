'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { ACTIONS } from '@/config/rbac'
import { useCan } from '@/shared/rbac/useCan'
import { Modal } from '@/shared/components/Modal'
import { FloatingInput, FloatingSelect } from '@/shared/components/FloatingField'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { changeJournalPeriod, fetchJournalWorkspace, reverseJournal } from '../journal/apiClient'
import type { JournalWorkspace, CreateJournalInput, JournalPeriod } from '../journal/types'
import { journalMoney, isNegative } from '../journal/format'
import { JournalEntryForm, type JournalQuickAction } from './JournalEntryForm'
import { JournalOwnerView } from './JournalOwnerView'
import { JournalReportsPanel } from './JournalReportsPanel'
import { JournalRevaluationForm } from './JournalRevaluationForm'
import { CURRENCIES } from '@/shared/static/currencies'
import { buttonPrimary, buttonSecondary } from '../utils/buttonStyles'

type Mode = 'owner' | 'accountant'
type View = 'entries' | 'accounts' | 'parties' | 'reports' | 'periods'
type Entry = JournalWorkspace['entries'][number]
type PeriodAction = 'close' | 'reopen' | 'lock'

const MODE_STORAGE_KEY = 'hotel-system.accounting.journalMode'
const views: View[] = ['entries', 'accounts', 'parties', 'reports', 'periods']
const periodTone: Record<JournalPeriod['status'], string> = { open: 'bg-emerald-50 text-emerald-800', closed: 'bg-amber-50 text-amber-800', locked: 'bg-stone-200 text-stone-700' }

function today() { return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
function shiftMonth(month: string, delta: number) {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}
function readStoredMode(): Mode | null {
  try {
    const saved = window.localStorage.getItem(MODE_STORAGE_KEY)
    return saved === 'owner' || saved === 'accountant' ? saved : null
  } catch { return null }
}
const subscribeToNothing = () => () => {}

export function GeneralJournalTab() {
  const { t, locale } = useTranslation()
  const label = (key: string) => t(`accounting.journal.${key}`)
  const canRead = useCan(ACTIONS.LEDGER_READ)
  const canPost = useCan(ACTIONS.ACCOUNTING_WRITE)
  const canManagePeriods = useCan(ACTIONS.ACCOUNTING_SETTINGS)
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null)
  const storedMode = useSyncExternalStore(subscribeToNothing, readStoredMode, () => null)
  const mode = selectedMode ?? storedMode ?? 'owner'
  const [currency, setCurrency] = useState<CreateJournalInput['currency']>('EGP')
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const [view, setView] = useState<View>('entries')
  const [valuation, setValuation] = useState<'native' | 'functional'>('native')
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: JournalWorkspace; error?: string } | null>(null)
  const [form, setForm] = useState<{ preset?: JournalQuickAction } | null>(null)
  const [showRevaluation, setShowRevaluation] = useState(false)
  const [selected, setSelected] = useState<Entry | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [reverseDate, setReverseDate] = useState(today)
  const [periodAction, setPeriodAction] = useState<{ month: string; action: PeriodAction } | null>(null)
  const [busy, setBusy] = useState(false)
  const [mutationError, setMutationError] = useState('')
  const [search, setSearch] = useState('')
  // The owner summary always reads in transaction currency; the EGP basis is an accountant tool.
  const basis = mode === 'owner' ? 'native' : valuation
  const key = `${currency}:${month}:${basis}:${revision}`

  useEffect(() => {
    if (!canRead || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return
    const controller = new AbortController()
    fetchJournalWorkspace(currency, month, controller.signal, basis)
      .then((data) => { if (!controller.signal.aborted) setResult({ key, data }) })
      .catch((cause) => { if (!controller.signal.aborted) setResult({ key, error: cause instanceof Error ? cause.message : 'Unable to load the general journal' }) })
    return () => controller.abort()
  }, [canRead, currency, month, basis, key])

  const data = result?.key === key ? result.data : undefined
  const error = result?.key === key ? result.error : undefined
  const loading = !data && !error
  const reload = () => setRevision((value) => value + 1)
  const accountName = (code: string) => {
    const account = data?.accounts.find((item) => item.code === code)
    return account ? `${code} · ${locale === 'ar' ? account.nameAr : account.nameEn}` : code
  }
  const money = (value: string) => journalMoney(value, currency)

  function changeMode(next: Mode) {
    setSelectedMode(next)
    try { window.localStorage.setItem(MODE_STORAGE_KEY, next) } catch {}
  }
  function openEntry(entry: Entry) { setSelected(entry); setMutationError(''); setReverseReason(''); setReverseDate(today()) }

  async function reverse() {
    if (!selected) return
    setBusy(true); setMutationError('')
    try { await reverseJournal(selected.id, reverseDate, reverseReason); setSelected(null); reload() }
    catch (cause) { setMutationError(cause instanceof Error ? cause.message : label('failed')) }
    finally { setBusy(false) }
  }

  async function updatePeriod() {
    if (!periodAction) return
    setBusy(true); setMutationError('')
    try { await changeJournalPeriod(periodAction.month, periodAction.action); setPeriodAction(null); reload() }
    catch (cause) { setMutationError(cause instanceof Error ? cause.message : label('failed')) }
    finally { setBusy(false) }
  }

  if (!canRead) return <p className="rounded-lg border border-stone-200 p-5 text-sm text-stone-500">{t('common.permissionDeniedTitle')}</p>

  const currentPeriod = data?.periods.find((period) => period.month === month)
  const entries = data?.entries.filter((entry) => `${entry.entryNumber} ${entry.description}`.toLowerCase().includes(search.toLowerCase())) ?? []

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{label('title')}</h2>
        <p className="mt-1 max-w-2xl text-sm text-stone-500">{label(mode === 'owner' ? 'ownerIntro' : 'accountantIntro')}</p>
      </div>
      <div role="group" aria-label={label('mode')} className="flex gap-1 rounded-lg bg-[#F5F5F5] p-1">
        {(['owner', 'accountant'] as const).map((item) => <button key={item} type="button" aria-pressed={mode === item} onClick={() => changeMode(item)} className={`min-h-9 rounded-md px-4 text-sm font-medium ${mode === item ? 'bg-accent/10 text-accent-ink shadow-sm' : 'text-ink-muted hover:text-stone-800'}`}>{label(item === 'owner' ? 'ownerView' : 'accountantView')}</button>)}
      </div>
    </div>

    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex items-end gap-1">
        <button type="button" className={`${buttonSecondary} px-3`} aria-label={label('previous')} onClick={() => setMonth(shiftMonth(month, -1))}><span aria-hidden className="rtl:rotate-180 inline-block">‹</span></button>
        <FloatingInput type="month" label={label('month')} value={month} min="2000-01" max="2099-12" required onChange={(event) => { if (event.target.value) setMonth(event.target.value) }} />
        <button type="button" className={`${buttonSecondary} px-3`} aria-label={label('next')} onClick={() => setMonth(shiftMonth(month, 1))}><span aria-hidden className="rtl:rotate-180 inline-block">›</span></button>
      </div>
      <FloatingSelect label={label('currency')} aria-label={label('currency')} value={currency} disabled={basis === 'functional'} wrapperClassName="w-28" onChange={(event) => setCurrency(event.target.value as CreateJournalInput['currency'])}>
        {CURRENCIES.map(({ code }) => <option key={code}>{code}</option>)}
      </FloatingSelect>
      {mode === 'accountant' && <FloatingSelect label={label('valuation')} aria-label={label('valuation')} value={valuation} wrapperClassName="w-full sm:w-56" onChange={(event) => { const next = event.target.value as typeof valuation; setValuation(next); if (next === 'functional') setCurrency('EGP') }}><option value="native">{label('native')}</option><option value="functional">{label('functional')}</option></FloatingSelect>}
      {currentPeriod && currentPeriod.status !== 'open' && <span className={`rounded-full px-3 py-1 text-xs font-medium ${periodTone[currentPeriod.status]}`}>{label(currentPeriod.status)}</span>}
      <div className="ms-auto flex flex-wrap gap-2">
        <button type="button" className={buttonSecondary} onClick={reload} disabled={loading}>{t('common.refresh')}</button>
        {canPost && mode === 'accountant' && <button type="button" className={buttonSecondary} disabled={!data} onClick={() => setShowRevaluation(true)}>{label('revaluation')}</button>}
        {canPost && <button type="button" className={buttonPrimary} disabled={!data} onClick={() => setForm({})}>{label('newEntry')}</button>}
      </div>
    </div>

    <p className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">{label('scopeHint')}</p>

    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" className="ms-3 underline" onClick={reload}>{t('common.retry')}</button></div>}
    {loading && <div role="status" aria-label={t('common.loading')} className="grid animate-pulse gap-3 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 rounded-xl bg-[#F5F5F5]" />)}</div>}

    {data && mode === 'owner' && <>
      {data.reports.available
        ? <JournalOwnerView data={data} currency={currency} canPost={canPost} onQuickAction={(preset) => setForm({ preset })} onSelectEntry={openEntry} onViewEntries={() => { changeMode('accountant'); setView('entries') }} />
        : <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{label('coverageWarning')}</p>}
      <JournalReportsPanel data={data} month={month} currency={currency} owner />
    </>}

    {data && mode === 'accountant' && <>
      {data.reportingCoverage.unvalued > 0 && <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{label('missingRates')}: {data.reportingCoverage.unvalued} · {label('coverageWarning')}</p>}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Summary title={label('entryCount')} value={String(data.health.entryCount)} />
        <Summary title={label('debit')} value={money(data.health.debit)} />
        <Summary title={label('credit')} value={money(data.health.credit)} />
        <Summary title={label('health')} value={label(data.health.balanced ? 'balanced' : 'unbalanced')} tone={data.health.balanced ? 'text-emerald-700' : 'text-red-700'} ltr={false} />
      </div>
      <nav aria-label={label('views')} className="flex gap-1 overflow-x-auto border-b border-stone-200">
        {views.map((item) => <button key={item} type="button" aria-current={view === item ? 'page' : undefined} className={`-mb-px min-h-11 whitespace-nowrap border-b-2 px-4 text-sm font-medium ${view === item ? 'border-accent bg-accent/10 text-accent-ink' : 'border-transparent text-stone-500 hover:text-stone-800'}`} onClick={() => setView(item)}>{label(item)}</button>)}
      </nav>

      {view === 'entries' && <div className="space-y-3">
        <FloatingInput type="search" label={t('common.search')} value={search} onChange={(event) => setSearch(event.target.value)} />
        {!entries.length ? <Empty text={label('noEntries')} /> : <>
          <div className="hidden overflow-hidden rounded-xl border border-stone-200 bg-white md:block"><table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500"><tr><th className="p-3 text-start font-medium">{label('date')}</th><th className="p-3 text-start font-medium">{label('entryNumber')}</th><th className="p-3 text-start font-medium">{label('description')}</th><th className="p-3 text-end font-medium">{label('amount')}</th><th className="p-3 text-start font-medium">{label('status')}</th></tr></thead>
            <tbody>{entries.map((entry) => <tr key={entry.id} tabIndex={0} onClick={() => openEntry(entry)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEntry(entry) } }} className="cursor-pointer border-t border-stone-100 hover:bg-accent/10 focus:bg-accent/10 focus:outline-none">
              <td className="p-3 whitespace-nowrap">{entry.date}</td>
              <td className="p-3 whitespace-nowrap font-mono text-xs">{entry.entryNumber}</td>
              <td className="p-3 max-w-md truncate">{entry.description}</td>
              <td className="p-3 text-end whitespace-nowrap tabular-nums" dir="ltr">{journalMoney(entry.total, entry.currency)}{basis === 'functional' && <span className="block text-xs text-stone-500">{journalMoney(entry.baseTotal, 'EGP')}</span>}</td>
              <td className="p-3"><EntryStatus entry={entry} label={label} /></td>
            </tr>)}</tbody>
          </table></div>
          <ul className="space-y-2 md:hidden">{entries.map((entry) => <li key={entry.id}><button type="button" className="flex w-full items-start justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 text-start" onClick={() => openEntry(entry)}>
            <span className="min-w-0"><span className="block text-sm font-medium wrap-break-word">{entry.description}</span><span className="block text-xs text-stone-500">{entry.date} · {entry.entryNumber}</span></span>
            <span className="shrink-0 text-end"><span className="block text-sm tabular-nums" dir="ltr">{journalMoney(entry.total, entry.currency)}</span><EntryStatus entry={entry} label={label} /></span>
          </button></li>)}</ul>
        </>}
      </div>}

      {view === 'accounts' && <div className="space-y-2">
        <p className="text-sm text-stone-500">{label('accountsHint')}</p>
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white"><table className="w-full text-sm"><thead className="bg-stone-50 text-stone-500"><tr><th className="p-3 text-start font-medium">{label('account')}</th><th className="p-3 text-end font-medium">{label('debit')}</th><th className="p-3 text-end font-medium">{label('credit')}</th><th className="p-3 text-end font-medium">{label('balance')}</th></tr></thead>
          <tbody>{data.accounts.map((account) => {
            const heading = account.parentCode === null
            return <tr key={account.code} className={`border-t border-stone-100 ${heading ? 'bg-stone-50 font-semibold' : ''}`}>
              <td className={`p-3 ${heading ? '' : 'ps-8'}`}>{accountName(account.code)}{heading && <span className="ms-2 text-xs font-normal text-stone-500">{label(`types.${account.type}`)}</span>}</td>
              <td className="p-3 text-end whitespace-nowrap tabular-nums" dir="ltr">{money(account.debit)}</td>
              <td className="p-3 text-end whitespace-nowrap tabular-nums" dir="ltr">{money(account.credit)}</td>
              <td className={`p-3 text-end whitespace-nowrap tabular-nums ${isNegative(account.balance) ? 'text-red-700' : ''}`} dir="ltr">{money(account.balance)}</td>
            </tr>
          })}</tbody></table></div>
        <p className="text-xs text-stone-500">{label('balanceScope')}</p>
      </div>}

      {view === 'parties' && <div className="space-y-3"><p className="text-sm text-stone-500">{label('partiesHint')}</p>
        {!data.parties.length ? <Empty text={label('noParties')} /> : <div className="grid gap-3 md:grid-cols-2">{data.parties.map((party) => <div key={party.contactId} className="rounded-xl border border-stone-200 bg-white p-4"><h3 className="font-medium">{party.name}</h3><dl className="mt-3 grid grid-cols-3 gap-3">{(['receivable', 'payable', 'deposits'] as const).map((side) => <div key={side}><dt className="text-xs text-stone-500">{label(side)}</dt><dd className="text-sm tabular-nums wrap-break-word" dir="ltr">{money(party[side])}</dd></div>)}</dl></div>)}</div>}
      </div>}

      {view === 'reports' && <JournalReportsPanel data={data} month={month} currency={currency} />}

      {view === 'periods' && <div className="space-y-3"><p className="text-sm text-stone-500">{label('periodsHint')}</p>
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">{[...data.periods, ...(!currentPeriod ? [{ month, status: 'open' as const }] : [])].sort((a, b) => b.month.localeCompare(a.month)).map((period) => <li key={period.month} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3"><span className="font-medium tabular-nums">{period.month}</span><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${periodTone[period.status]}`}>{label(period.status)}</span></div>
          {canManagePeriods && period.status !== 'locked' && <div className="flex flex-wrap gap-2">{(period.status === 'open' ? ['close', 'lock'] as const : ['reopen', 'lock'] as const).map((action) => <button key={action} type="button" className={`${buttonSecondary} ${action === 'lock' ? 'text-red-700' : ''}`} onClick={() => { setPeriodAction({ month: period.month, action }); setMutationError('') }}>{label(action)}</button>)}</div>}
        </li>)}</ul>
      </div>}
    </>}

    {form && data && <JournalEntryForm workspace={data} currency={currency} preset={form.preset} defaultDate={month === today().slice(0, 7) ? today() : `${month}-01`} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload() }} />}
    {showRevaluation && data && <JournalRevaluationForm workspace={data} defaultDate={new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10)} onClose={() => setShowRevaluation(false)} onSaved={() => { setShowRevaluation(false); reload() }} />}
    {selected && <Modal isOpen onClose={() => { if (!busy) setSelected(null) }} title={selected.entryNumber} size="xl"><div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><p className="wrap-break-word font-medium">{selected.description}</p><p className="mt-1 text-xs text-stone-500">{selected.date} · {selected.currency}{selected.currency !== 'EGP' && <> · {label('exchangeRate')}: <span dir="ltr">{selected.exchangeRate ?? label('missingRates')}</span>{selected.exchangeRateSource && ` (${selected.exchangeRateSource})`}</>}</p></div>
        <EntryStatus entry={selected} label={label} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-stone-200"><table className="w-full text-sm">
        <thead className="bg-stone-50 text-stone-500"><tr><th className="p-3 text-start font-medium">{label('account')}</th><th className="p-3 text-end font-medium">{label('debit')}</th><th className="p-3 text-end font-medium">{label('credit')}</th></tr></thead>
        <tbody>{selected.lines.map((line) => <tr key={line.id} className="border-t border-stone-100 align-top">
          <td className="p-3"><span className="block">{accountName(line.accountCode)}</span>{line.contactName && <span className="block text-xs text-stone-500">{line.contactName}</span>}{line.description && line.description !== selected.description && <span className="block text-xs text-stone-500">{line.description}</span>}</td>
          <td className="p-3 text-end whitespace-nowrap tabular-nums" dir="ltr">{line.debit !== '0.00' ? journalMoney(line.debit, selected.currency) : ''}{selected.currency !== 'EGP' && line.baseDebit && line.baseDebit !== '0.00' && <span className="block text-xs text-stone-500">{journalMoney(line.baseDebit, 'EGP')}</span>}</td>
          <td className="p-3 text-end whitespace-nowrap tabular-nums" dir="ltr">{line.credit !== '0.00' ? journalMoney(line.credit, selected.currency) : ''}{selected.currency !== 'EGP' && line.baseCredit && line.baseCredit !== '0.00' && <span className="block text-xs text-stone-500">{journalMoney(line.baseCredit, 'EGP')}</span>}</td>
        </tr>)}</tbody>
        <tfoot className="border-t border-stone-200 bg-stone-50 font-semibold"><tr><td className="p-3">{label('total')}</td><td className="p-3 text-end tabular-nums" dir="ltr">{journalMoney(selected.total, selected.currency)}</td><td className="p-3 text-end tabular-nums" dir="ltr">{journalMoney(selected.total, selected.currency)}</td></tr></tfoot>
      </table></div>
      {canPost && selected.kind !== 'revaluation' && !selected.reversalOfId && !selected.reversedById && <form className="space-y-3 border-t border-stone-200 pt-4" onSubmit={(event) => { event.preventDefault(); void reverse() }}>
        <p className="text-sm text-stone-500">{label('reverseHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FloatingInput type="date" label={label('reversalDate')} value={reverseDate} required onChange={(event) => setReverseDate(event.target.value)} />
          <FloatingInput label={label('reason')} value={reverseReason} required minLength={3} maxLength={500} onChange={(event) => setReverseReason(event.target.value)} />
        </div>
        {mutationError && <p role="alert" className="text-sm text-red-700">{mutationError}</p>}
        <div className="flex justify-end"><button className={buttonSecondary} disabled={busy}>{label('reverse')}</button></div>
      </form>}
    </div></Modal>}
    {periodAction && <Modal isOpen onClose={() => { if (!busy) setPeriodAction(null) }} title={`${label(periodAction.action)} · ${periodAction.month}`}><div className="space-y-4"><p className="text-sm text-stone-600">{label(periodAction.action === 'lock' ? 'lockWarning' : 'periodConfirm')}</p>{mutationError && <p role="alert" className="text-sm text-red-700">{mutationError}</p>}<div className="flex flex-wrap justify-end gap-3"><button type="button" className={buttonSecondary} disabled={busy} onClick={() => setPeriodAction(null)}>{t('common.cancel')}</button><button type="button" className={buttonPrimary} disabled={busy} onClick={updatePeriod}>{label(periodAction.action)}</button></div></div></Modal>}
  </div>
}

function EntryStatus({ entry, label }: { entry: Entry; label: (key: string) => string }) {
  const [key, tone] = entry.kind === 'revaluation' ? ['revaluationEntry', 'bg-sky-50 text-sky-800']
    : entry.reversalOfId ? ['reversal', 'bg-amber-50 text-amber-800']
    : entry.reversedById ? ['reversed', 'bg-stone-100 text-stone-600 line-through']
    : ['posted', 'bg-emerald-50 text-emerald-800']
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{label(key)}</span>
}
function Summary({ title, value, tone = 'text-stone-900', ltr = true }: { title: string; value: string; tone?: string; ltr?: boolean }) {
  return <div className="rounded-xl border border-stone-200 bg-white p-4"><p className="text-xs text-stone-500">{title}</p><p dir={ltr ? 'ltr' : undefined} className={`mt-2 wrap-break-word text-lg font-semibold tabular-nums ${tone}`}>{value}</p></div>
}
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-500">{text}</p> }
