import 'server-only'

import type { Prisma } from '@/generated/prisma/client'
import type { payment_method } from '@/generated/prisma/enums'
import { lockInvoice as lockInvoiceSql } from '@/generated/prisma/sql'
import { prisma, type DbTransaction } from '@/services/db/prisma'
import { fromRow, serializeRow } from '@/services/db/rows'
import type { CreatePaymentInput, Payment } from '../types'
import { mapPaymentRow } from '../types'
import {
  requireAccountingRead, requirePaymentsCreate, requirePaymentsRefund,
} from './serviceSecurity'
import { logPaymentCreated, logPaymentRefunded } from './activityLogService'
import { deriveInvoiceStatus } from './deriveInvoiceStatus'
import { createLedgerEntry } from './ledgerService'
import { getPaymentLedgerEntryAmounts } from './ledgerAmounts'

type Db = DbTransaction | typeof prisma
type PaymentRow = Parameters<typeof mapPaymentRow>[0]
const toPayment = (row: unknown) => mapPaymentRow(serializeRow('payments', row) as PaymentRow)

/** Serialize concurrent payments/refunds on one invoice (balance checks read-then-write). */
async function lockInvoice(tx: DbTransaction, invoiceId: string) {
  await tx.$queryRawTyped(lockInvoiceSql(invoiceId))
}

function paymentTotals(amounts: Array<{ amount: Prisma.Decimal | number | null }>) {
  let grossPaid = 0
  let totalRefunded = 0
  for (const p of amounts) {
    const value = Number(p.amount ?? 0)
    if (value > 0) grossPaid += value
    else if (value < 0) totalRefunded += Math.abs(value)
  }
  return { grossPaid, totalRefunded }
}

export async function getPaymentsByInvoice(invoiceId: string) {
  await requireAccountingRead()
  const rows = await prisma.payments.findMany({ where: { invoice_id: invoiceId, deleted_at: null }, orderBy: { created_at: 'desc' } })
  return rows.map(toPayment)
}

export async function getAllPayments(params?: { fromDate?: string; toDate?: string; method?: string }) {
  await requireAccountingRead()
  const where: Prisma.paymentsWhereInput = { deleted_at: null }
  if (params?.fromDate || params?.toDate) {
    where.created_at = {
      ...(params?.fromDate ? { gte: new Date(params.fromDate) } : {}),
      ...(params?.toDate ? { lte: new Date(`${params.toDate.slice(0, 10)}T23:59:59.999Z`) } : {}),
    }
  }
  if (params?.method) where.method = params.method as payment_method

  const rows = await prisma.payments.findMany({
    where,
    include: { invoices: { select: { contact_id: true, invoice_number: true } } },
    orderBy: { created_at: 'desc' },
  })
  return rows.map(toPayment)
}

export async function createPayment(input: CreatePaymentInput) {
  const session = await requirePaymentsCreate()
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than zero. Use the refund action for refunds.')
  if (amount < 0.01 || amount > 9999999999.99 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) throw new Error('Payment amount must have at most two decimal places and fit the supported monetary limit.')

  const payment = await prisma.$transaction(async (tx) => {
    await lockInvoice(tx, input.invoice_id)
    const invoice = await tx.invoices.findFirst({
      where: { id: input.invoice_id, deleted_at: null },
      select: { id: true, status: true, amount: true, currency: true },
    })
    if (!invoice) throw new Error('Invoice not found')
    if (input.currency && input.currency !== invoice.currency) {
      throw new Error(`Payment currency must match the invoice currency (${invoice.currency})`)
    }
    if (invoice.status === 'draft' || invoice.status === 'void' || invoice.status === 'refunded') {
      throw new Error('Issue the invoice before recording a payment; void and refunded invoices cannot receive payments')
    }

    const existing = await tx.payments.findMany({ where: { invoice_id: input.invoice_id, deleted_at: null }, select: { amount: true, currency: true } })
    if (existing.some((payment) => payment.currency !== invoice.currency)) throw new Error('Invoice payment history contains mixed currencies; reconcile it first.')
    const { grossPaid, totalRefunded } = paymentTotals(existing)
    if (amount > 0 && amount > Math.max(0, Number(invoice.amount ?? 0) - grossPaid)) {
      throw new Error('Payment amount cannot exceed the remaining invoice balance')
    }
    if (amount < 0 && Math.abs(amount) > Math.max(0, grossPaid - totalRefunded)) {
      throw new Error('Refund amount exceeds the remaining refundable amount.')
    }

    const row = await tx.payments.create({
      data: {
        ...(fromRow('payments', input as unknown as Record<string, unknown>) as Prisma.paymentsUncheckedCreateInput),
        currency: invoice.currency,
        created_by: session.id,
      },
    })
    const created = toPayment(row)
    await updateInvoicePaidAmount(row.invoice_id, tx)
    await ensurePaymentLedgerEntry(created, session.id, tx)
    return created
  })

  void logPaymentCreated({ id: payment.id, invoiceId: payment.invoiceId, amount: payment.amount, type: payment.method })
  return payment
}

export async function refundPayment(id: string, reason?: string) {
  const session = await requirePaymentsRefund()

  const payment = await prisma.$transaction(async (tx) => {
    const original = await tx.payments.findFirst({ where: { id, deleted_at: null } })
    if (!original) throw new Error('Payment not found')
    await lockInvoice(tx, original.invoice_id)
    if (Number(original.amount) <= 0) throw new Error('Only a positive receipt can be refunded')
    const refundKey = `refund:${original.id}`
    const priorRefund = await tx.payments.findFirst({ where: { idempotency_key: refundKey, deleted_at: null } })
    if (priorRefund) return toPayment(priorRefund)

    const invoice = await tx.invoices.findFirst({ where: { id: original.invoice_id, deleted_at: null }, select: { currency: true } })
    if (!invoice || invoice.currency !== original.currency) throw new Error('Payment currency does not match its invoice; reconcile it before refunding.')
    const invoicePayments = await tx.payments.findMany({ where: { invoice_id: original.invoice_id, deleted_at: null }, select: { amount: true, currency: true } })
    if (invoicePayments.some((payment) => payment.currency !== invoice.currency)) throw new Error('Invoice payment history contains mixed currencies; reconcile it first.')
    const { grossPaid, totalRefunded } = paymentTotals(invoicePayments)
    if (Math.abs(Number(original.amount)) > Math.max(0, grossPaid - totalRefunded)) {
      throw new Error('Refund amount exceeds the remaining refundable amount.')
    }

    const row = await tx.payments.create({
      data: {
        invoice_id: original.invoice_id,
        idempotency_key: refundKey,
        method: original.method,
        amount: -Math.abs(Number(original.amount)),
        currency: original.currency,
        description: reason ? `Refund: ${reason}` : 'Refund',
        created_by: session.id,
      },
    })
    const refund = toPayment(row)
    await updateInvoicePaidAmount(row.invoice_id, tx)
    await ensurePaymentLedgerEntry(refund, session.id, tx)
    return refund
  })

  void logPaymentRefunded({ id: payment.id, invoiceId: payment.invoiceId, amount: payment.amount, reason })
  return payment
}

export async function deletePayment(id: string) {
  await requirePaymentsRefund()
  void id
  throw new Error('Payment history cannot be deleted. Record a refund or a documented correction.')
}

/** Recomputes paid/refunded/remaining/status of an invoice from its payments. */
export async function updateInvoicePaidAmount(invoiceId: string, tx: Db = prisma) {
  const payments = await tx.payments.findMany({ where: { invoice_id: invoiceId, deleted_at: null }, select: { amount: true, currency: true } })
  const invoice = await tx.invoices.findUnique({ where: { id: invoiceId }, select: { amount: true, status: true, reservation_id: true, currency: true } })
  if (!invoice) return
  if (payments.some((payment) => payment.currency !== invoice.currency)) throw new Error('Invoice payment history contains mixed currencies; reconcile it before changing this invoice.')

  const { grossPaid, totalRefunded } = paymentTotals(payments)
  const total = Number(invoice.amount)
  const status = deriveInvoiceStatus({
    invoiceTotal: total,
    grossPaid,
    totalRefunded,
    currentStatus: invoice.status ?? 'issued',
  })

  await tx.invoices.update({
    where: { id: invoiceId },
    data: {
      paid_amount: grossPaid,
      refunded_amount: totalRefunded,
      remaining_balance: Math.max(0, total - grossPaid),
      status,
      paid_at: status === 'paid' ? new Date() : null,
    },
  })
  if (invoice.reservation_id) await syncReservationPaymentTotals(invoice.reservation_id, tx)
}

/** reservations.paid_amount / balance_amount follow the reservation's non-void invoices. */
export async function syncReservationPaymentTotals(reservationId: string, tx: Db = prisma) {
  const reservation = await tx.reservations.findFirst({ where: { id: reservationId, deleted_at: null }, select: { total_amount: true } })
  if (!reservation) return

  const paid = await tx.invoices.aggregate({
    where: { reservation_id: reservationId, deleted_at: null, status: { not: 'void' } },
    _sum: { paid_amount: true },
  })
  const paidAmount = Number(paid._sum.paid_amount ?? 0)
  await tx.reservations.update({
    where: { id: reservationId },
    data: { paid_amount: paidAmount, balance_amount: Math.max(0, Number(reservation.total_amount ?? 0) - paidAmount) },
  })
}

export async function ensurePaymentLedgerEntry(payment: Payment, actorId: string, tx: Db = prisma) {
  const existing = await tx.accounting_ledger_entries.findFirst({
    where: { type: 'payment', source_type: 'payment', source_id: payment.id },
    select: { id: true },
  })
  if (existing) return

  const { incomeAmount, outcomeAmount } = getPaymentLedgerEntryAmounts(payment.amount)
  await createLedgerEntry(
    {
      type: 'payment',
      sourceType: 'payment',
      sourceId: payment.id,
      outcomeAmount,
      incomeAmount,
      currency: payment.currency,
      description: `Payment ${payment.method} - ${payment.amount}`,
      createdBy: actorId,
      invoiceId: payment.invoiceId,
    },
    tx,
  )
}

