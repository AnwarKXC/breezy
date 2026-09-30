import { formatDate } from '@/shared/utils/date'
import type { Invoice } from '../types'
import { INVOICE_STATUS_LABELS } from '../types'
import { buildAndDownloadPdf } from '@/shared/utils/pdfMake'
import type { Locale } from '@/i18n/config'

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
}

export async function exportInvoicesListPdf(invoices: Invoice[], locale: Locale, fileName: string): Promise<void> {
  // Each invoice is printed in its own currency (amounts are never converted).
  const rows = invoices.map((inv) => {
    const format = (value: number) => formatCurrency(value, inv.currency)

    return [
      inv.invoiceNumber,
      inv.contact?.name ?? inv.contactId,
      format(inv.amount),
      INVOICE_STATUS_LABELS[inv.status] ?? inv.status,
      format(inv.paidAmount),
      format(inv.remainingBalance),
      formatDate(inv.issueDate, locale),
      formatDate(inv.dueDate, locale),
    ]
  })

  await buildAndDownloadPdf({
    title: 'Invoices Report',
    headers: ['Invoice #', 'Contact', 'Amount', 'Status', 'Paid', 'Balance', 'Issue Date', 'Due Date'],
    rows,
    locale,
    fileName,
  })
}
