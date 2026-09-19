import type { Invoice } from '../types'
import { INVOICE_STATUS_LABELS, PAYMENT_TYPE_LABELS } from '../types'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
}

export function exportInvoicesCsv(invoices: Invoice[], fileName: string): void {
  const headers = [
    'Invoice #',
    'Contact',
    'Status',
    'Payment Method',
    'Amount',
    'Discount',
    'Paid',
    'Balance',
    'Issue Date',
    'Due Date',
    'Notes',
  ]

  const rows = invoices.map((inv) => [
    inv.invoiceNumber,
    inv.contact?.name ?? inv.contactId,
    INVOICE_STATUS_LABELS[inv.status] ?? inv.status,
    inv.paymentMethod ? ((PAYMENT_TYPE_LABELS as Record<string, string>)[inv.paymentMethod] ?? inv.paymentMethod) : '',
    formatCurrency(inv.amount),
    formatCurrency(inv.discount ?? 0),
    formatCurrency(inv.paidAmount),
    formatCurrency(inv.remainingBalance),
    inv.issueDate,
    inv.dueDate,
    inv.notes ?? '',
  ])

  const bom = '\uFEFF'
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n')

  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
