import type { Invoice } from '../types/invoiceTypes'

interface ExportLabels {
  invoiceNumber: string
  amount: string
  status: string
  issueDate: string
  dueDate: string
  paidAt: string
  notes: string
}

function escapeCsvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

export function buildInvoicesCsv(
  invoices: Invoice[],
  labels: ExportLabels,
) {
  const header = [
    labels.invoiceNumber,
    labels.amount,
    labels.status,
    labels.issueDate,
    labels.dueDate,
    labels.paidAt,
    labels.notes,
  ]
  const rows = invoices.map((invoice) => [
    invoice.invoiceNumber,
    String(invoice.amount),
    invoice.status,
    invoice.issueDate,
    invoice.dueDate,
    invoice.paidAt ?? '',
    invoice.notes ?? '',
  ])

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\n')
}
