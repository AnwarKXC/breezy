'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { ACTIONS } from '@/config/rbac'
import { useCan } from '@/shared/rbac/useCan'
import { FloatingSelect } from '@/shared/components/FloatingField'
import { fetchJournalStatement } from '../journal/apiClient'
import type { JournalWorkspace, JournalStatement } from '../journal/types'
import { journalReportSections, downloadJournalCsv, downloadJournalPdf, statementSections, type JournalReportKind } from '../journal/reportExport'
import { buttonSecondary } from '../utils/buttonStyles'

// Exports keep exact decimal strings; only the on-screen table is formatted.
const amountCell = /^-?\d+\.\d{2}$/

export function JournalReportsPanel({ data, month, currency, owner = false }: { data: JournalWorkspace; month: string; currency: string; owner?: boolean }) {
  const { t, locale } = useTranslation()
  const label = (key: string) => t(`accounting.journal.${key}`)
  const canExport = useCan(ACTIONS.ACCOUNTING_EXPORT)
  const [kind, setKind] = useState<JournalReportKind | 'statement'>('trialBalance')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [accountCode, setAccountCode] = useState('1101')
  const [contactId, setContactId] = useState('')
  const [statementResult, setStatementResult] = useState<{ key: string; data?: JournalStatement; error?: string } | null>(null)
  const statementKey = `${currency}:${month}:${data.valuation}:${accountCode}:${contactId}`
  const statement = statementResult?.key === statementKey ? statementResult.data : undefined

  useEffect(() => {
    if (kind !== 'statement' || owner) return
    const controller = new AbortController()
    fetchJournalStatement(currency, month, data.valuation, accountCode, contactId, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setStatementResult({ key: statementKey, data: result }) })
      .catch((cause) => { if (!controller.signal.aborted) setStatementResult({ key: statementKey, error: cause instanceof Error ? cause.message : 'Unable to load statement' }) })
    return () => controller.abort()
  }, [kind, owner, currency, month, data.valuation, accountCode, contactId, statementKey])

  const selectedKind = owner ? 'overview' : kind
  const reportSections = selectedKind === 'statement' ? statement?.available ? statementSections(statement, t) : [] : data.reports.available || selectedKind === 'entries' ? journalReportSections(data, month, currency, selectedKind, locale, t).slice(1) : []
  const available = selectedKind === 'entries' || (selectedKind === 'statement' ? statement?.available : data.reports.available)

  async function exportReport(format: 'csv' | 'pdf') {
    setExporting(true); setError('')
    try {
      const sections = selectedKind === 'statement' && statement ? statementSections(statement, t) : journalReportSections(data, month, currency, selectedKind as JournalReportKind, locale, t)
      const fileName = `journal-${selectedKind}-${month}-${currency}-${data.valuation}.${format}`
      if (format === 'csv') downloadJournalCsv(sections, fileName)
      else await downloadJournalPdf(sections, fileName, `${label(selectedKind === 'overview' ? 'ownerView' : selectedKind)} · ${month} · ${currency}`, locale)
    } catch (cause) { setError(cause instanceof Error ? cause.message : label('failed')) }
    finally { setExporting(false) }
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      {!owner && <FloatingSelect label={label('reportType')} aria-label={label('reportType')} value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} wrapperClassName="w-full sm:max-w-xs">
        {(['trialBalance', 'incomeStatement', 'balanceSheet', 'entries', 'statement'] as const).map((item) => <option key={item} value={item}>{label(item)}</option>)}
      </FloatingSelect>}
      {canExport && <div className="flex flex-wrap gap-2"><button className={buttonSecondary} disabled={exporting || !available} onClick={() => void exportReport('csv')}>{label('exportCsv')}</button><button className={buttonSecondary} disabled={exporting || !available} onClick={() => void exportReport('pdf')}>{exporting ? t('common.loading') : label('exportPdf')}</button></div>}
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {selectedKind === 'statement' && <>
      <div className="grid gap-3 sm:grid-cols-2"><FloatingSelect label={label('account')} aria-label={label('account')} value={accountCode} onChange={(event) => setAccountCode(event.target.value)}>{data.accounts.filter((account) => account.parentCode !== null).map((account) => <option key={account.code} value={account.code}>{account.code} · {locale === 'ar' ? account.nameAr : account.nameEn}</option>)}</FloatingSelect>
        <FloatingSelect label={label('contact')} aria-label={label('contact')} value={contactId} onChange={(event) => setContactId(event.target.value)}><option value="">{label('allContacts')}</option>{data.parties.map((party) => <option key={party.contactId} value={party.contactId}>{party.name}</option>)}</FloatingSelect></div>
      <p className="text-xs text-stone-500">{label('statementHint')}</p>
      {statementResult?.key === statementKey && statementResult.error && <p role="alert" className="text-sm text-red-700">{statementResult.error}</p>}
      {!statement && !(statementResult?.key === statementKey && statementResult.error) && <p role="status">{t('common.loading')}</p>}
    </>}
    {!available && <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{label('coverageWarning')}</p>}
    {!owner && reportSections.map((section, index) => {
      const numeric = section.headers.map((_, column) => section.rows.length > 0 && section.rows.every((row) => amountCell.test(String(row[column] ?? '')) || row[column] === ''))
      return <section key={index} className="rounded-xl border border-stone-200 bg-white overflow-hidden"><h3 className="border-b border-stone-100 p-4 font-semibold">{section.title}</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-stone-50 text-stone-500"><tr>{section.headers.map((header, column) => <th key={header} className={`p-3 font-medium whitespace-nowrap ${numeric[column] ? 'text-end' : 'text-start'}`}>{header}</th>)}</tr></thead><tbody>{section.rows.map((row, position) => <tr key={position} className="border-t border-stone-100 hover:bg-accent/10">{row.map((cell, cellIndex) => {
        const amount = amountCell.test(String(cell))
        return <td key={cellIndex} dir={amount ? 'ltr' : undefined} className={`p-3 ${amount || numeric[cellIndex] ? 'text-end whitespace-nowrap tabular-nums' : 'min-w-24 wrap-break-word'} ${amount && /^-?0\.00$/.test(String(cell)) ? 'text-stone-300' : ''} ${amount && String(cell).startsWith('-') && /[1-9]/.test(String(cell)) ? 'text-red-700' : ''}`}>{amount ? Number(cell).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : cell}</td>
      })}</tr>)}</tbody></table></div></section>
    })}
  </div>
}
