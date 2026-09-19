import type { Locale } from '@/i18n/config'
import { buildAndDownloadPdf } from '@/shared/utils/pdfMake'
import { formatDate, formatDateTime } from '@/shared/utils/date'
import type { Invoice } from '../types/invoiceTypes'

type ExportLabels = Record<'amount' | 'dueDate' | 'invoiceNumber' | 'issueDate' | 'notes' | 'paidAt' | 'status' | 'title', string>

export async function exportInvoicesPdf(
  invoices: Invoice[],
  labels: ExportLabels,
  locale: Locale,
  fileName: string,
): Promise<void> {
  const rows = invoices.map((invoice) => [
    invoice.invoiceNumber,
    String(invoice.amount),
    invoice.status,
    formatDate(invoice.issueDate, locale),
    formatDate(invoice.dueDate, locale),
    invoice.paidAt ? formatDateTime(invoice.paidAt, locale) : '',
    invoice.notes || '',
  ])

  await buildAndDownloadPdf({
    title: labels.title,
    headers: [labels.invoiceNumber, labels.amount, labels.status, labels.issueDate, labels.dueDate, labels.paidAt, labels.notes],
    rows,
    locale,
    fileName,
  })
}
