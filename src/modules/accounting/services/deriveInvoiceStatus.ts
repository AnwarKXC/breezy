// Shared pure derivation for invoice status from trusted payment totals.
// Imported on both server (accountingService) and client (accountingSlice)
// to keep the refund/paid status mapping consistent.

import type { InvoiceStatus } from '@/modules/accounting/types'

export interface DeriveInvoiceStatusInput {
  invoiceTotal: number
  grossPaid: number
  totalRefunded: number
  currentStatus: string
}

export function deriveInvoiceStatus(input: DeriveInvoiceStatusInput): InvoiceStatus {
  const grossPaid = Math.max(0, Number(input.grossPaid ?? 0))
  const totalRefunded = Math.max(0, Number(input.totalRefunded ?? 0))
  const total = Math.max(0, Number(input.invoiceTotal ?? 0))
  const netPaid = Math.max(0, grossPaid - totalRefunded)
  const balanceDue = Math.max(0, total - netPaid)
  const current = input.currentStatus ?? 'issued'

  if (current === 'void') return 'void'

  if (totalRefunded > 0 && grossPaid > 0 && totalRefunded >= grossPaid) return 'refunded'
  if (totalRefunded > 0 && totalRefunded < grossPaid) return 'partially_refunded'
  if (grossPaid > 0 && balanceDue === 0 && total > 0) return 'paid'
  if (grossPaid > 0 && balanceDue > 0) return 'partially_paid'
  if (current === 'draft') return 'draft'
  return 'issued'
}

export function deriveRemainingBalance(input: {
  invoiceTotal: number
  grossPaid: number
  totalRefunded: number
}): number {
  // ponytail: balance_due = "what the customer still owes the business".
  // Refunds do NOT add new debt — they reduce our obligation back to the
  // customer, tracked separately. So balance_due is computed from gross
  // paid only, never from net (gross - refunded).
  const grossPaid = Math.max(0, Number(input.grossPaid ?? 0))
  const total = Math.max(0, Number(input.invoiceTotal ?? 0))
  return Math.max(0, total - grossPaid)
}