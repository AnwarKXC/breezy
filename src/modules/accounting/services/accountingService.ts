import 'server-only'

import type { Prisma } from '@/generated/prisma/client'
import { lockInvoice as lockInvoiceSql } from '@/generated/prisma/sql'
import { prisma, type DbTransaction } from '@/services/db/prisma'
import { dbDate, fromRow, serializeRow, toRow, toRows } from '@/services/db/rows'
import type {
  UpdateInvoiceInput,
  Invoice, InvoiceBookingLookup, InvoiceFormLookups,
} from '../types'
import {
  mapPaymentRow, mapInvoiceRow, mapInvoiceItemRow, mapInvoiceEventRow, mapLedgerEntryRow,
} from '../types'
import { requireAccountingRead, requireInvoicesCreate, requireInvoicesUpdate, requireInvoicesDelete, requireInvoicesIssue, requireInvoicesVoid, requireInvoicesRefund, requireInvoicesAdjust, requireLedgerRead, requireAccountingExport } from './serviceSecurity'
import { deriveInvoiceStatus } from './deriveInvoiceStatus'
import {
  calculateInvoiceTotals, formatDate, mapInvoiceItemsForInsert, roundMoney,
  type CreateInvoiceDraftInput, type InvoiceItemDraftInput,
} from './accountingUtils'
import { currencyOrDefault } from '@/shared/currency/server'
import {
  getAccountingOverview, getFinanceTable, getFinancialHealth, getDailyRevenueReport,
  getMonthlyRevenueReport, getAccountsReceivableAging, getAccountingSettings, updateAccountingSetting,
} from './reportsService'
import { getLedgerEntries } from './ledgerService'
import { updateInvoicePaidAmount, ensurePaymentLedgerEntry, getAllPayments, syncReservationPaymentTotals } from './paymentService'
import { getExpenses } from './expenseService'
import { recordReservationStatus, releaseRooms } from '@/modules/reservations/services/stayServer'
import {
  logInvoiceCreated, logInvoiceUpdated,
  logInvoiceIssued, logInvoiceVoided, logInvoiceRefunded, logInvoiceDeleted,
} from './activityLogService'

type Db = DbTransaction | typeof prisma
type InvoiceRowShape = Parameters<typeof mapInvoiceRow>[0]
const toInvoice = (row: unknown) => mapInvoiceRow(serializeRow('invoices', row) as InvoiceRowShape)

// Reports, settings and the ledger live in their own services; re-exported
// here so the accounting barrel keeps one entry point.
export {
  getAccountingOverview, getFinanceTable, getFinancialHealth, getDailyRevenueReport,
  getMonthlyRevenueReport, getAccountsReceivableAging, getAccountingSettings, updateAccountingSetting,
  getLedgerEntries,
}

// ponytail: see deriveInvoiceStatus in ./deriveInvoiceStatus.ts for the
// pure derivation used here. Re-exported for testing convenience.
export { deriveInvoiceStatus } from './deriveInvoiceStatus'

function withDerivedPaymentStatus(
  invoice: Invoice,
  payments: { amount: number | string | null }[] = [],
) {
  const grossPaid = payments.reduce((sum, p) => {
    const amount = Number(p.amount ?? 0)
    return amount > 0 ? sum + amount : sum
  }, 0)
  const totalRefunded = payments.reduce((sum, p) => {
    const amount = Number(p.amount ?? 0)
    return amount < 0 ? sum + Math.abs(amount) : sum
  }, 0)
  const paidAmount = grossPaid
  const refundedAmount = totalRefunded
  // ponytail: balance_due is what the customer owes — refunds flow back to
  // the customer, they don't reduce the customer's payment obligation.
  // Net-paid (gross - refunded) is a separate metric for reporting.
  const remainingBalance = Math.max(0, invoice.amount - grossPaid)

  // Closed-status preservation: void stays void; the buggy historical
  // 'cancelled' label collapes to 'void' (it was never a valid invoices
  // status under the CHECK constraint).
  if (invoice.status === 'void') {
    return {
      ...invoice,
      status: 'void',
      paidAmount,
      refundedAmount,
      remainingBalance,
    }
  }

  const status = deriveInvoiceStatus({
    invoiceTotal: invoice.amount,
    grossPaid,
    totalRefunded,
    currentStatus: invoice.status,
  })

  return {
    ...invoice,
    status,
    paidAmount,
    refundedAmount,
    remainingBalance,
  }
}

// ─── Payments ─────────────────────────────────────────
// Delegated to paymentService.ts — re-exported for barrel compatibility.

export {
  getPaymentsByInvoice,
  getAllPayments,
  createPayment,
  refundPayment,
  deletePayment,
} from './paymentService'

// ─── Expense Categories & Expenses ────────────────────
// Delegated to expenseService.ts — re-exported for barrel compatibility.

export {
  getExpenseCategories,
  createExpenseCategory,
  deleteExpenseCategory,
  getExpenses,
  createExpense,
  updateExpense,
  approveExpense,
  deleteExpense,
} from './expenseService'

// ─── Invoices ─────────────────────────────────────────

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NIL_UUID = '00000000-0000-0000-0000-000000000000'

const INVOICE_SORT_FIELDS = new Set(['created_at', 'issue_date', 'due_date', 'amount', 'invoice_number', 'status', 'guest_name', 'remaining_balance'])

export async function getInvoices(params?: {
  status?: string; contactId?: string; reservationId?: string; roomId?: string;
  fromDate?: string; toDate?: string; dueDateFrom?: string; dueDateTo?: string;
  search?: string; paymentStatus?: string; createdBy?: string;
  limit?: number; offset?: number; sortField?: string; sortDir?: string
}) {
  await requireAccountingRead()
  const where: Prisma.invoicesWhereInput = { deleted_at: null }

  if (params?.contactId) where.contact_id = params.contactId
  // Filter strictly by the linkage column. An invalid id must match nothing,
  // never fall back to returning all invoices.
  if (params?.reservationId !== undefined) {
    where.reservation_id = UUID_PATTERN.test(params.reservationId) ? params.reservationId : NIL_UUID
  }
  if (params?.roomId) where.room_id = params.roomId
  if (params?.fromDate || params?.toDate) {
    where.issue_date = {
      ...(params?.fromDate ? { gte: dbDate(params.fromDate) } : {}),
      ...(params?.toDate ? { lte: dbDate(params.toDate) } : {}),
    }
  }
  const dueDate: Prisma.DateTimeFilter<'invoices'> = {}
  if (params?.dueDateFrom) dueDate.gte = dbDate(params.dueDateFrom)
  if (params?.dueDateTo) dueDate.lte = dbDate(params.dueDateTo)
  if (params?.paymentStatus === 'overdue') {
    dueDate.lt = dbDate(formatDate(new Date()))
    where.status = { in: ['issued', 'partially_paid'] }
  }
  if (Object.keys(dueDate).length) where.due_date = dueDate
  if (params?.createdBy) where.created_by = params.createdBy
  if (params?.search) {
    const contains = { contains: params.search, mode: 'insensitive' as const }
    where.OR = [{ invoice_number: contains }, { guest_name: contains }, { company_name: contains }, { room_number: contains }]
  }

  const sortField = INVOICE_SORT_FIELDS.has(params?.sortField ?? '') ? params!.sortField! : 'created_at'
  const limit = params?.limit ? Math.min(Number(params.limit), 1000) : undefined
  const offset = params?.offset ? Number(params.offset) : undefined

  const [rows, count] = await Promise.all([
    prisma.invoices.findMany({
      where,
      include: { contacts: { select: { name: true, type: true, email: true, phone: true } } },
      orderBy: { [sortField]: params?.sortDir === 'asc' ? 'asc' : 'desc' },
      ...(limit !== undefined || offset !== undefined ? { take: limit ?? 50 } : {}),
      ...(offset !== undefined ? { skip: offset } : {}),
    }),
    prisma.invoices.count({ where }),
  ])
  const invoices = rows.map(toInvoice)
  const invoiceIds = invoices.map((invoice) => invoice.id)

  const payments = invoiceIds.length
    ? await prisma.payments.findMany({ where: { invoice_id: { in: invoiceIds }, deleted_at: null }, select: { invoice_id: true, amount: true } })
    : []
  const paymentsByInvoice = new Map<string, { amount: number }[]>()
  for (const payment of payments) {
    const list = paymentsByInvoice.get(payment.invoice_id) ?? []
    list.push({ amount: Number(payment.amount) })
    paymentsByInvoice.set(payment.invoice_id, list)
  }

  const derivedInvoices = invoices.map((invoice) =>
    withDerivedPaymentStatus(invoice, paymentsByInvoice.get(invoice.id) ?? []),
  )
  const filteredInvoices = params?.status
    ? derivedInvoices.filter((invoice) => invoice.status === params.status)
    : derivedInvoices

  return { data: filteredInvoices, total: params?.status ? filteredInvoices.length : count }
}

export async function getInvoiceById(id: string) {
  await requireAccountingRead()
  const row = await prisma.invoices.findFirst({
    where: { id, deleted_at: null },
    include: { contacts: { select: { name: true, type: true, email: true, phone: true } } },
  })
  if (!row) throw new Error('Failed to fetch invoice: not found')
  const data = serializeRow('invoices', row) as InvoiceRowShape & { contacts: unknown }

  const [itemRows, paymentRows, eventRows] = await Promise.all([
    prisma.invoice_items.findMany({ where: { invoice_id: id }, orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }] }),
    prisma.payments.findMany({ where: { invoice_id: id, deleted_at: null }, orderBy: { created_at: 'desc' } }),
    prisma.invoice_events.findMany({ where: { invoice_id: id }, orderBy: { created_at: 'desc' } }),
  ])

  // Stay details for reservation invoices (used for the summary line and PDF).
  let booking: { guest_name: string | null; check_in: string; check_out: string; room_number: string | null } | null = null
  if (data.reservation_id) {
    const stay = await prisma.reservations.findUnique({
      where: { id: data.reservation_id },
      select: { check_in_date: true, check_out_date: true, booker_name: true, reservation_rooms: { select: { rooms: { select: { number: true } } } } },
    })
    if (stay) {
      const roomNumbers = stay.reservation_rooms.map((rr) => rr.rooms?.number).filter(Boolean)
      booking = {
        guest_name: data.guest_name ?? stay.booker_name ?? null,
        check_in: formatDate(stay.check_in_date),
        check_out: formatDate(stay.check_out_date),
        room_number: roomNumbers.join(', ') || data.room_number || null,
      }
    }
  }

  const payments = toRows('payments', paymentRows).map(mapPaymentRow)
  const invoice = withDerivedPaymentStatus(
    mapInvoiceRow(data),
    payments.map((payment) => ({ amount: payment.amount })),
  )
  const items = toRows('invoice_items', itemRows).map(mapInvoiceItemRow)
  const fallbackItems = items.length === 0 && invoice.amount > 0
    ? [{
        id: `summary-${invoice.id}`,
        invoiceId: invoice.id,
        type: booking ? 'room_charge' : 'other',
        description: booking
          ? `Room ${booking.room_number ?? invoice.roomNumber ?? ''} - ${dateValue(booking.check_in)} to ${dateValue(booking.check_out)}`
          : 'Invoice total',
        quantity: 1,
        unitPrice: invoice.subtotal || invoice.amount,
        discountAmount: invoice.discount,
        taxAmount: invoice.taxAmount,
        totalPrice: invoice.amount,
        sortOrder: 0,
        createdAt: invoice.createdAt,
      }]
    : items
  return {
    ...invoice,
    items: fallbackItems,
    payments,
    events: toRows('invoice_events', eventRows).map(mapInvoiceEventRow),
    contact: data.contacts,
    booking,
  }
}

function dateValue(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : ''
}

export async function getInvoiceItems(invoiceId: string) {
  await requireAccountingRead()
  const rows = await prisma.invoice_items.findMany({ where: { invoice_id: invoiceId }, orderBy: { created_at: 'asc' } })
  return toRows('invoice_items', rows).map(mapInvoiceItemRow)
}

export async function createInvoice(input: CreateInvoiceDraftInput & { items?: InvoiceItemDraftInput[] }) {
  const session = await requireInvoicesCreate()

  const { subtotal, discount, taxAmount, serviceCharge, total } = calculateInvoiceTotals(input)
  const status = input.status ?? 'draft'
  const isPaid = status === 'paid'
  // A reservation's invoice is always in the reservation's currency (no FX).
  const reservationCurrency = input.reservation_id
    ? (await prisma.reservations.findUnique({ where: { id: input.reservation_id }, select: { currency: true } }))?.currency
    : undefined
  if (reservationCurrency && input.currency && input.currency !== reservationCurrency) {
    throw new Error(`Invoice currency must match the reservation currency (${reservationCurrency})`)
  }
  const currency = reservationCurrency ?? (await currencyOrDefault(input.currency))
  const invoiceNumber = input.invoice_number ?? await getNextInvoiceNumber()

  // Fields shared by the "reuse existing" and "create new" paths.
  const common = {
    subtotal,
    discount,
    tax_amount: taxAmount,
    service_charge: serviceCharge,
    amount: total,
    payment_method: input.payment_method ?? null,
    guest_name: input.guest_name ?? null,
    company_name: input.company_name ?? null,
    room_id: input.room_id ?? null,
    room_number: input.room_number ?? null,
    stay_check_in: dbDate(input.stay_check_in),
    stay_check_out: dbDate(input.stay_check_out),
    notes: input.notes ?? null,
    public_notes: input.public_notes ?? null,
    internal_notes: input.internal_notes ?? null,
    billing_address: input.billing_address ?? null,
    currency,
    issue_date: dbDate(input.issue_date ?? formatDate(new Date())),
    due_date: dbDate(input.due_date),
  }

  const { invoice, reused } = await prisma.$transaction(async (tx) => {
    // Idempotent by parent linkage: when the caller supplies reservation_id,
    // reuse the existing non-void invoice (and replace its items) instead of
    // creating a duplicate. invoices_reservation_id_active_unique is the
    // database-level guarantee.
    const existing = input.reservation_id
      ? await tx.invoices.findFirst({
          where: { reservation_id: input.reservation_id, deleted_at: null, status: { not: 'void' } },
          select: { id: true },
          orderBy: { created_at: 'asc' },
        })
      : null

    if (existing) {
      await tx.invoices.update({ where: { id: existing.id }, data: { ...common, updated_by: session.id } })
      if (input.items && input.items.length > 0) {
        await tx.invoice_items.deleteMany({ where: { invoice_id: existing.id } })
        await tx.invoice_items.createMany({ data: mapInvoiceItemsForInsert(existing.id, input.items) })
      }
      // Recompute paid/refunded/status from the payment history against the new total.
      await updateInvoicePaidAmount(existing.id, tx)
      return { invoice: toInvoice(await tx.invoices.findUniqueOrThrow({ where: { id: existing.id } })), reused: true }
    }

    const created = await tx.invoices.create({
      data: {
        ...common,
        contact_id: input.contact_id,
        invoice_number: invoiceNumber,
        paid_amount: isPaid ? total : 0,
        remaining_balance: isPaid ? 0 : total,
        paid_at: isPaid ? new Date() : null,
        status,
        created_by: session.id,
        ...(input.reservation_id ? { reservation_id: input.reservation_id } : {}),
      },
    })
    if (input.items && input.items.length > 0) {
      await tx.invoice_items.createMany({ data: mapInvoiceItemsForInsert(created.id, input.items) })
    }
    return { invoice: toInvoice(created), reused: false }
  })

  if (reused) void logInvoiceUpdated({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: invoice.amount })
  else void logInvoiceCreated({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: invoice.amount, contactId: invoice.contactId })
  return invoice
}

export async function updateInvoice(id: string, input: UpdateInvoiceInput & { items?: InvoiceItemDraftInput[] }) {
  const session = await requireInvoicesUpdate()

  const existingInvoice = await prisma.invoices.findUnique({
    where: { id },
    select: { status: true, subtotal: true, discount: true, tax_amount: true, service_charge: true, amount: true, reservation_id: true },
  })

  if (input.currency && existingInvoice?.reservation_id) {
    const reservation = await prisma.reservations.findUnique({ where: { id: existingInvoice.reservation_id }, select: { currency: true } })
    if (reservation && reservation.currency !== input.currency) {
      throw new Error(`Invoice currency must match the reservation currency (${reservation.currency})`)
    }
  }

  if (existingInvoice && existingInvoice.status !== 'draft') {
    const allowedFields: (keyof typeof input)[] = [
      'due_date', 'notes', 'public_notes', 'internal_notes',
      'billing_address', 'guest_name', 'company_name',
    ]
    const changedFields = Object.keys(input).filter(k => !allowedFields.includes(k as keyof typeof input))
    if (changedFields.length > 0 && ['paid', 'void', 'refunded'].includes(existingInvoice.status)) {
      throw new Error('This invoice cannot be edited. Use adjustments or corrections.')
    }
  }

  const { items: inputItems, ...invoiceFields } = input

  if (existingInvoice && existingInvoice.status !== 'draft' && invoiceFields.status === 'draft') {
    delete invoiceFields.status
    delete invoiceFields.issue_date
  }

  let updatedAmount = input.amount
  if (existingInvoice && (inputItems || input.subtotal !== undefined || input.discount !== undefined || input.tax_amount !== undefined || input.service_charge !== undefined)) {
    const { total } = calculateInvoiceTotals({
      ...input,
      subtotal: input.subtotal ?? Number(existingInvoice.subtotal),
      discount: input.discount ?? Number(existingInvoice.discount),
      tax_amount: input.tax_amount ?? Number(existingInvoice.tax_amount),
      service_charge: input.service_charge ?? Number(existingInvoice.service_charge),
      items: inputItems,
    })
    updatedAmount = total
  }

  const updatedInvoiceFields = updatedAmount === undefined ? invoiceFields : { ...invoiceFields, amount: updatedAmount }

  const row = await prisma.$transaction(async (tx) => {
    const { count } = await tx.invoices.updateMany({
      where: { id, deleted_at: null },
      data: {
        ...(fromRow('invoices', updatedInvoiceFields as Record<string, unknown>) as Prisma.invoicesUncheckedUpdateManyInput),
        updated_by: session.id,
      },
    })
    if (count === 0) throw new Error('Failed to update invoice: not found')

    if (inputItems) {
      await tx.invoice_items.deleteMany({ where: { invoice_id: id } })
      if (inputItems.length > 0) await tx.invoice_items.createMany({ data: mapInvoiceItemsForInsert(id, inputItems) })
    }

    await createInvoiceEvent(
      {
        invoiceId: id,
        eventType: existingInvoice?.status !== 'draft' ? 'updated' : 'draft_saved',
        actorId: session.id,
        metadata: { updatedFields: Object.keys(input) },
      },
      tx,
    )
    return tx.invoices.findUniqueOrThrow({ where: { id } })
  })

  const invoice = toInvoice(row)
  void logInvoiceUpdated({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: invoice.amount })
  return invoice
}

export async function issueInvoice(id: string) {
  const session = await requireInvoicesIssue()
  const current = await prisma.invoices.findFirst({ where: { id, deleted_at: null } })
  if (!current) throw new Error('Failed to fetch invoice: not found')
  if (current.status === 'void' || current.status === 'refunded') {
    throw new Error('Invoice is already void or refunded')
  }

  const shouldUpdateStatus = current.status === 'draft'
  const row = shouldUpdateStatus
    ? await prisma.invoices.update({
        where: { id },
        data: { status: 'issued', issued_at: new Date(), issued_by: session.id, updated_by: session.id },
      })
    : current

  const invoice = toInvoice(row)
  void logInvoiceIssued({ id: invoice.id, invoiceNumber: invoice.invoiceNumber })
  await ensureInvoiceIssuedEvent(invoice, session.id, current.status)
  return invoice
}

async function ensureInvoiceIssuedEvent(invoice: Invoice, actorId: string, oldStatus: string | null) {
  const existing = await prisma.invoice_events.findFirst({ where: { invoice_id: invoice.id, event_type: 'issued' }, select: { id: true } })
  if (existing) return
  await createInvoiceEvent({
    invoiceId: invoice.id,
    eventType: 'issued',
    actorId,
    oldStatus,
    newStatus: 'issued',
  })
}

export async function voidInvoice(id: string, reason: string) {
  const session = await requireInvoicesVoid()
  const current = await prisma.invoices.findUnique({ where: { id }, select: { status: true } })
  if (!current || current.status === 'void' || current.status === 'refunded') {
    throw new Error('Invoice is already void or refunded')
  }

  const row = await prisma.$transaction(async (tx) => {
    const { count } = await tx.invoices.updateMany({
      where: { id, deleted_at: null },
      data: { status: 'void', void_reason: reason, voided_at: new Date(), voided_by: session.id, remaining_balance: 0, updated_by: session.id },
    })
    if (count === 0) throw new Error('Failed to void invoice: not found')
    await createInvoiceEvent({ invoiceId: id, eventType: 'voided', actorId: session.id, oldStatus: current.status, newStatus: 'void', reason }, tx)
    return tx.invoices.findUniqueOrThrow({ where: { id } })
  })

  const invoice = toInvoice(row)
  void logInvoiceVoided({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, reason })
  // Cash-basis ledger: voiding moves no money, so no ledger entry.
  // If the invoice had been paid, cash leaves via a refund payment entry.
  return invoice
}

// A linked reservation in one of these states is cancelled together with its
// invoice. checked_in blocks the delete (the guest must be checked out first).
const CANCELLABLE_RESERVATION_STATUSES = ['draft', 'held', 'confirmed']

export async function deleteInvoice(id: string) {
  const session = await requireInvoicesDelete()
  const invoice = await prisma.invoices.findFirst({
    where: { id, deleted_at: null },
    select: { id: true, invoice_number: true, status: true, reservation_id: true },
  })
  if (!invoice) throw new Error('Invoice not found')

  // Validate BEFORE mutating so a blocked delete never leaves a half-deleted invoice.
  const linkedReservation = invoice.reservation_id
    ? await prisma.reservations.findFirst({ where: { id: invoice.reservation_id, deleted_at: null }, select: { id: true, status: true } })
    : null
  if (linkedReservation?.status === 'checked_in') {
    throw new Error('Cannot delete this invoice: the linked reservation is checked in. Check out the guest before deleting it.')
  }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.invoices.update({ where: { id }, data: { deleted_at: now } })

    // invoice_events has no 'deleted' event type; record it as a status change.
    await createInvoiceEvent(
      { invoiceId: id, eventType: 'status_changed', actorId: session.id, oldStatus: invoice.status, newStatus: 'deleted', reason: 'Invoice deleted' },
      tx,
    )

    // The cash record and the invoice's general-ledger entries follow the invoice
    // (payment ledger rows carry invoice_id; older rows are keyed by source_id).
    await tx.payments.updateMany({ where: { invoice_id: id, deleted_at: null }, data: { deleted_at: now } })
    await tx.accounting_ledger_entries.deleteMany({
      where: { OR: [{ invoice_id: id }, { source_type: 'invoice', source_id: id }] },
    })

    // Cancel the linked reservation and free its rooms (matches the warning in DeleteInvoiceDialog).
    if (linkedReservation && CANCELLABLE_RESERVATION_STATUSES.includes(linkedReservation.status)) {
      await tx.reservations.update({ where: { id: linkedReservation.id }, data: { status: 'cancelled', cancelled_at: now } })
      await tx.reservation_holds.updateMany({
        where: { reservation_id: linkedReservation.id, status: 'active' },
        data: { status: 'released', updated_at: now },
      })
      await releaseRooms(tx, {
        reservationId: linkedReservation.id,
        actorId: session.id,
        reason: 'Invoice deleted',
        roomStatus: 'cancelled',
        onlyIfOccupied: true,
        at: now,
      })
      await recordReservationStatus(tx, {
        reservationId: linkedReservation.id,
        from: linkedReservation.status,
        to: 'cancelled',
        reason: 'Invoice deleted',
        actorId: session.id,
        at: now,
      })
    }
  })

  void logInvoiceDeleted({ id: invoice.id, invoiceNumber: invoice.invoice_number })
}

async function lockInvoice(tx: DbTransaction, invoiceId: string) {
  await tx.$queryRawTyped(lockInvoiceSql(invoiceId))
}

function paymentSums(payments: Array<{ amount: Prisma.Decimal | number | null }>) {
  let grossPaid = 0
  let totalRefunded = 0
  for (const p of payments) {
    const value = Number(p.amount ?? 0)
    if (value > 0) grossPaid += value
    else if (value < 0) totalRefunded += Math.abs(value)
  }
  return { grossPaid: roundMoney(grossPaid), totalRefunded: roundMoney(totalRefunded) }
}

export async function refundInvoice(id: string, amount: number, reason: string) {
  const session = await requireInvoicesRefund()

  const refundAmount = roundMoney(amount)
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    throw new Error('Refund amount must be greater than zero.')
  }

  const invoice = await prisma.$transaction(async (tx) => {
    await lockInvoice(tx, id)
    const current = await tx.invoices.findFirst({ where: { id, deleted_at: null }, select: { status: true, currency: true } })
    if (!current) throw new Error('Invoice not found')
    if (current.status === 'void') {
      throw new Error('Cannot refund a voided invoice.')
    }

    const { grossPaid, totalRefunded } = paymentSums(
      await tx.payments.findMany({ where: { invoice_id: id, deleted_at: null }, select: { amount: true } }),
    )
    if (refundAmount > Math.max(0, grossPaid - totalRefunded)) {
      throw new Error('Refund amount exceeds the remaining refundable amount.')
    }

    // One negative payment row records the refund ('cash' mirrors prior behaviour).
    const refundRow = await tx.payments.create({
      data: { invoice_id: id, method: 'cash', amount: -refundAmount, currency: current.currency, description: reason ? `Refund: ${reason}` : 'Refund', created_by: session.id },
    })

    // Recompute derived columns (partially_refunded / refunded) from payment rows.
    await updateInvoicePaidAmount(id, tx)
    const refreshed = toInvoice(await tx.invoices.findUniqueOrThrow({ where: { id } }))

    await createInvoiceEvent(
      {
        invoiceId: id,
        eventType: 'payment_refunded',
        actorId: session.id,
        oldStatus: current.status,
        newStatus: refreshed.status,
        amountChanged: refundAmount,
        reason,
      },
      tx,
    )
    await ensurePaymentLedgerEntry(mapPaymentRow(toRow('payments', refundRow)), session.id, tx)
    return refreshed
  })

  void logInvoiceRefunded({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: refundAmount })
  return invoice
}

export async function applyInvoiceDiscount(id: string, amount: number, reason: string) {
  const session = await requireInvoicesAdjust()

  const discount = roundMoney(amount)
  if (!Number.isFinite(discount) || discount < 0) {
    throw new Error('Discount amount cannot be negative.')
  }
  const trimmedReason = (reason ?? '').trim()
  if (!trimmedReason) throw new Error('A reason is required to apply a discount.')

  const result = await prisma.$transaction(async (tx) => {
    await lockInvoice(tx, id)
    const current = await tx.invoices.findFirst({
      where: { id, deleted_at: null },
      select: { status: true, subtotal: true, discount: true, tax_amount: true, service_charge: true, amount: true, paid_at: true, reservation_id: true },
    })
    if (!current) throw new Error('Invoice not found')
    if (current.status === 'void') {
      throw new Error('Cannot discount a voided invoice.')
    }
    if (current.status === 'refunded') {
      throw new Error('Cannot discount a refunded invoice. Issue a credit note instead.')
    }

    // Tax and service charge stay exactly as issued: the discount is an
    // after-tax deduction off the total. Rows without a breakdown fall back to
    // their stored total.
    const taxAmount = roundMoney(Number(current.tax_amount ?? 0))
    const serviceCharge = roundMoney(Number(current.service_charge ?? 0))
    const previousDiscount = roundMoney(Number(current.discount ?? 0))
    const storedSubtotal = roundMoney(Number(current.subtotal ?? 0))
    const previousTotal = roundMoney(Number(current.amount ?? 0))
    const subtotal = storedSubtotal > 0
      ? storedSubtotal
      : roundMoney(previousTotal + previousDiscount - taxAmount - serviceCharge)
    const grossBeforeDiscount = roundMoney(subtotal + taxAmount + serviceCharge)

    if (grossBeforeDiscount <= 0) throw new Error('This invoice has no amount to discount.')
    if (discount > grossBeforeDiscount) {
      throw new Error(`Discount cannot exceed the invoice total before discount (${grossBeforeDiscount}).`)
    }

    const { total: newTotal } = calculateInvoiceTotals({ subtotal, discount, tax_amount: taxAmount, service_charge: serviceCharge })

    // Payment rows are the source of truth for paid/refunded.
    const { grossPaid, totalRefunded } = paymentSums(
      await tx.payments.findMany({ where: { invoice_id: id, deleted_at: null }, select: { amount: true } }),
    )
    if (newTotal < grossPaid) {
      throw new Error(`The new total (${newTotal}) is less than the ${grossPaid} already paid. Refund the difference first.`)
    }
    if (discount === previousDiscount) return null

    const derivedStatus = deriveInvoiceStatus({ invoiceTotal: newTotal, grossPaid, totalRefunded, currentStatus: current.status ?? 'issued' })
    // deriveInvoiceStatus is payment-shaped: it does not know about 'overdue'
    // and cannot close a zero-total invoice.
    const status = newTotal === 0 && grossPaid === 0 && current.status !== 'draft'
      ? 'paid'
      : derivedStatus === 'issued' && current.status === 'overdue'
        ? 'overdue'
        : derivedStatus
    // Never clear a paid date on an adjustment — the first payment date stands.
    const paidAt = status === 'paid' ? (current.paid_at ?? new Date()) : current.paid_at

    const updated = await tx.invoices.update({
      where: { id },
      data: {
        discount,
        discount_reason: trimmedReason,
        amount: newTotal,
        paid_amount: grossPaid,
        refunded_amount: totalRefunded,
        remaining_balance: Math.max(0, roundMoney(newTotal - grossPaid)),
        status,
        paid_at: paidAt,
        updated_by: session.id,
      },
    })

    if (current.reservation_id) await syncReservationPaymentTotals(current.reservation_id, tx)

    // Cash-basis ledger: a discount moves no money, so no ledger entry.
    await createInvoiceEvent(
      {
        invoiceId: id,
        eventType: 'adjusted',
        actorId: session.id,
        oldStatus: current.status,
        newStatus: status,
        amountChanged: roundMoney(newTotal - previousTotal),
        reason: trimmedReason,
        metadata: {
          previousDiscount,
          newDiscount: discount,
          previousTotal,
          newTotal,
          grossPaid,
          taxAmount,
          taxRecomputed: false,
          reservationId: current.reservation_id ?? null,
        },
      },
      tx,
    )
    return toInvoice(updated)
  })

  if (!result) return await getInvoiceById(id)
  void logInvoiceUpdated({ id: result.id, invoiceNumber: result.invoiceNumber, amount: result.amount })
  return result
}

// Uniqueness is enforced by invoices_invoice_number_active_unique.
export async function getNextInvoiceNumber() {
  return `INV-${Date.now()}`
}

export async function getInvoiceFormLookups(): Promise<InvoiceFormLookups> {
  await requireAccountingRead()

  const [contacts, reservations, rooms, invoiced] = await Promise.all([
    prisma.contacts.findMany({
      where: { deleted_at: null },
      select: { id: true, name: true, type: true, phone: true, email: true },
      orderBy: { name: 'asc' },
      take: 1000,
    }),
    prisma.reservations.findMany({
      where: { deleted_at: null, status: { notIn: ['cancelled', 'expired'] } },
      select: {
        id: true, status: true, company_id: true, booker_name: true, check_in_date: true, check_out_date: true,
        nights: true, total_amount: true, paid_amount: true, currency: true,
        reservation_rooms: {
          where: { deleted_at: null },
          select: { room_id: true, rooms: { select: { number: true } }, room_types: { select: { name: true } } },
        },
        reservation_guests: { where: { deleted_at: null }, select: { full_name: true, contact_id: true, is_primary: true } },
      },
      orderBy: { check_in_date: 'desc' },
      take: 1000,
    }),
    prisma.rooms.findMany({ where: { deleted_at: null }, select: { id: true, number: true, floor: true, status: true }, orderBy: { number: 'asc' }, take: 1000 }),
    prisma.invoices.findMany({
      where: { reservation_id: { not: null }, deleted_at: null, status: { not: 'void' } },
      select: { reservation_id: true },
    }),
  ])

  // Offer only stays without an active invoice: createInvoice reuses (and
  // replaces the items of) an existing invoice for the same reservation.
  const invoicedReservationIds = new Set(invoiced.map((row) => row.reservation_id))
  const contactsById = new Map(contacts.map((c) => [c.id, c]))

  const bookings: InvoiceBookingLookup[] = reservations
    .filter((reservation) => !invoicedReservationIds.has(reservation.id))
    .map((reservation) => {
      const primaryGuest = reservation.reservation_guests.find((g) => g.is_primary) ?? reservation.reservation_guests[0]
      const contactId = reservation.company_id ?? primaryGuest?.contact_id ?? null
      const contact = contactId ? contactsById.get(contactId) : undefined
      const stayRooms = reservation.reservation_rooms
      return {
        checkIn: formatDate(reservation.check_in_date),
        checkOut: formatDate(reservation.check_out_date),
        contactId,
        contactName: contact?.name ?? null,
        companyName: contact?.type === 'company' ? contact.name : null,
        guestName: primaryGuest?.full_name ?? reservation.booker_name ?? contact?.name ?? '',
        id: reservation.id,
        roomId: stayRooms[0]?.room_id ?? null,
        roomNumber: stayRooms.map((rr) => rr.rooms?.number).filter(Boolean).join(', ') || null,
        roomTypeName: stayRooms[0]?.room_types?.name ?? null,
        status: reservation.status,
        nights: Math.max(1, reservation.nights ?? 1),
        totalAmount: Number(reservation.total_amount ?? 0),
        paidAmount: Number(reservation.paid_amount ?? 0),
        currency: reservation.currency,
      }
    })

  return {
    contacts: contacts.map((contact) => ({ email: contact.email, id: contact.id, name: contact.name, phone: contact.phone, type: contact.type })),
    bookings,
    rooms: rooms.map((room) => ({ floor: room.floor, id: room.id, number: room.number, status: room.status })),
  }
}

async function createInvoiceEvent(
  input: {
    invoiceId: string; eventType: string; actorId: string;
    oldStatus?: string | null; newStatus?: string | null;
    amountChanged?: number; reason?: string | null; metadata?: Record<string, unknown>
  },
  tx: Db = prisma,
) {
  await tx.invoice_events.create({
    data: {
      invoice_id: input.invoiceId,
      event_type: input.eventType,
      actor_id: input.actorId,
      old_status: input.oldStatus ?? null,
      new_status: input.newStatus ?? null,
      amount_changed: input.amountChanged ?? null,
      reason: input.reason ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  })
}

export async function getInvoiceEvents(invoiceId: string) {
  await requireAccountingRead()
  const rows = await prisma.invoice_events.findMany({ where: { invoice_id: invoiceId }, orderBy: { created_at: 'desc' } })
  return toRows('invoice_events', rows).map(mapInvoiceEventRow)
}

export async function getInvoiceLedger(invoiceId: string) {
  await requireLedgerRead()
  const payments = await prisma.payments.findMany({ where: { invoice_id: invoiceId, deleted_at: null }, select: { id: true } })
  const sourceIds = [invoiceId, ...payments.map((payment) => payment.id)]

  const rows = await prisma.accounting_ledger_entries.findMany({
    where: { OR: [{ invoice_id: invoiceId }, { source_id: { in: sourceIds } }] },
    include: { invoices: { select: { invoice_number: true } } },
    orderBy: { created_at: 'desc' },
  })
  return rows.map((row) => mapLedgerEntryRow(serializeRow('accounting_ledger_entries', row) as Parameters<typeof mapLedgerEntryRow>[0]))
}

export async function getExportData(type: string, params?: Record<string, string>) {
  await requireAccountingExport()
  switch (type) {
    case 'invoices':
      return getInvoices(params as Record<string, string>)
    case 'payments':
      return getAllPayments(params as Record<string, string>)
    case 'expenses':
      return getExpenses(params as Record<string, string>)
    case 'ledger':
      return getLedgerEntries(params as Record<string, string>)
    case 'daily-revenue':
      return getDailyRevenueReport(params?.date ?? formatDate(new Date()))
    case 'monthly-revenue':
      return getMonthlyRevenueReport(params?.month ?? formatDate(new Date()).slice(0, 7))
    case 'aging':
      return getAccountsReceivableAging()
    default:
      throw new Error(`Unknown export type: ${type}`)
  }
}
