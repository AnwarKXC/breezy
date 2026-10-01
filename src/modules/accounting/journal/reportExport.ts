import type { JournalWorkspace, JournalStatement } from './types'
import type { Locale } from '@/i18n/config'
import type { PdfSection } from '@/shared/utils/pdfMake'

export type JournalReportKind = 'overview' | 'trialBalance' | 'incomeStatement' | 'balanceSheet' | 'entries'

export function csvCell(value: string): string {
  // Protect spreadsheet users from executable formulas in descriptions/contact names.
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function sectionsToCsv(sections: PdfSection[]): string {
  return '\uFEFF' + sections.map((section) => [[section.title], section.headers, ...section.rows].map((row) => row.map(csvCell).join(',')).join('\r\n')).join('\r\n\r\n')
}

export function journalReportSections(data: JournalWorkspace, month: string, currency: string, kind: JournalReportKind, locale: Locale, t: (key: string) => string): PdfSection[] {
  if (!data.reports.available && kind !== 'entries') throw new Error(t('accounting.journal.coverageWarning'))
  const label = (key: string) => t(`accounting.journal.${key}`)
  const accountName = (code: string) => {
    const account = data.accounts.find((item) => item.code === code)
    return account ? `${code} · ${locale === 'ar' ? account.nameAr : account.nameEn}` : code
  }
  const metadata: PdfSection = { title: label('reportScope'), headers: [label('description'), label('amount')], rows: [
    [label('month'), month], [label('currency'), currency], [label('valuation'), label(data.valuation === 'functional' ? 'functional' : 'native')],
    [label('reportSource'), label('manualJournalSource')], [label('rateMethod'), label('historicalRates')],
  ] }
  const metrics = (title: string, rows: [string, string][]): PdfSection => ({ title, headers: [label('description'), label('amount')], rows: rows.map(([key, value]) => [label(key), value]) })
  const sections: PdfSection[] = [metadata]
  if (kind === 'overview') {
    sections.push(metrics(label('ownerView'), Object.entries(data.owner) as [string, string][]))
    sections.push({ title: label('trend'), headers: [label('date'), label('monthRevenue'), label('monthExpenses'), label('cashIn'), label('cashOut')], rows: data.trend.map((row) => [row.date, row.revenue, row.expenses, row.cashIn, row.cashOut]) })
  }
  if (kind === 'trialBalance') sections.push({ title: label('trialBalance'), headers: [label('account'), label('openingDebit'), label('openingCredit'), label('periodDebit'), label('periodCredit'), label('closingDebit'), label('closingCredit')], rows: data.reports.trialBalance.map((row) => [accountName(row.code), row.openingDebit, row.openingCredit, row.periodDebit, row.periodCredit, row.closingDebit, row.closingCredit]) })
  if (kind === 'incomeStatement' && data.reports.incomeStatement) sections.push(metrics(label('incomeStatement'), [['monthRevenue', data.reports.incomeStatement.revenue], ['monthExpenses', data.reports.incomeStatement.expenses], ['monthProfit', data.reports.incomeStatement.profit]]))
  if (kind === 'balanceSheet' && data.reports.balanceSheet) {
    const sheet = data.reports.balanceSheet
    sections.push(metrics(`${label('balanceSheet')} · ${sheet.asOf}`, [['assets', sheet.assets], ['liabilities', sheet.liabilities], ['equity', sheet.equity], ['currentEarnings', sheet.currentEarnings]]))
    sections.push({ title: label('health'), headers: [label('description'), label('amount')], rows: [[label('equation'), label(sheet.balanced ? 'balanced' : 'unbalanced')]] })
  }
  if (kind === 'entries') {
    sections.push({ title: label('entries'), headers: [label('entryNumber'), label('date'), label('currency'), label('account'), label('contact'), label('debit'), label('credit'), label('description')], rows: data.entries.flatMap((entry) => entry.lines.map((line) => [entry.entryNumber, entry.date, entry.currency, accountName(line.accountCode), line.contactName ?? '', line.debit, line.credit, line.description || entry.description])) })
    sections.push({ title: label('rateMethod'), headers: [label('entryNumber'), label('account'), label('exchangeRate'), label('date'), label('rateSource'), `${label('debit')} EGP`, `${label('credit')} EGP`], rows: data.entries.flatMap((entry) => entry.lines.map((line) => [entry.entryNumber, accountName(line.accountCode), entry.exchangeRate ?? '', entry.exchangeRateDate ?? '', entry.exchangeRateSource ?? '', line.baseDebit ?? '', line.baseCredit ?? ''])) })
  }
  return sections
}

export function downloadJournalCsv(sections: PdfSection[], fileName: string) {
  const url = URL.createObjectURL(new Blob([sectionsToCsv(sections)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url; link.download = fileName; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadJournalPdf(sections: PdfSection[], fileName: string, title: string, locale: Locale) {
  const { buildAndDownloadPdf } = await import('@/shared/utils/pdfMake')
  await buildAndDownloadPdf({ sections, fileName, title, locale })
}

export function statementSections(statement: JournalStatement, t: (key: string) => string): PdfSection[] {
  const label = (key: string) => t(`accounting.journal.${key}`)
  if (!statement.available) throw new Error(label('coverageWarning'))
  return [{ title: `${label('statement')} · ${statement.accountCode} · ${statement.month} · ${statement.currency}`, headers: [label('description'), label('amount')], rows: [[label('openingBalance'), statement.opening], [label('closingBalance'), statement.closing], [label('valuation'), label(statement.valuation === 'functional' ? 'functional' : 'native')]] }, {
    title: label('movements'), headers: [label('date'), label('entryNumber'), label('contact'), label('description'), label('debit'), label('credit'), label('runningBalance')], rows: statement.lines.map((line) => [line.date, line.entryNumber, line.contactName ?? '', line.description, line.debit, line.credit, line.runningBalance]),
  }]
}
