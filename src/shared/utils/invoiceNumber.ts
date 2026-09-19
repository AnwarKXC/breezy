export type InvoiceKind = 'in' | 'co' | 'ex'

/**
 * Invoice numbers follow INV-{YYYYMMDD}-{kind} where kind is:
 *   in = individual guest, co = company, ex = expenses.
 * A short base36 time tail keeps numbers unique under the
 * invoices_invoice_number_active_unique index when two documents of the
 * same kind are created on the same day.
 */
export function buildInvoiceNumber(kind: InvoiceKind, now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const tail = Date.now().toString(36).toUpperCase().slice(-4)
  return `INV-${y}${m}${d}-${kind}-${tail}`
}

export function invoiceKindFromContactType(contactType?: string | null): InvoiceKind {
  return contactType === 'company' ? 'co' : 'in'
}
