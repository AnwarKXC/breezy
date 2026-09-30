import type { Tables, TablesInsert, TablesUpdate, Enums } from '@/services/db/rowTypes'
import type { CurrencyCode } from '@/shared/static/currencies'
import type { Money } from '@/shared/currency/money'

export type PaymentMethod = Enums<'payment_method'>

export type PaymentRow = Tables<'payments'>
export type CreatePaymentInput = TablesInsert<'payments'>
export type UpdatePaymentInput = TablesUpdate<'payments'>

export type ExpenseCategoryRow = Tables<'expense_categories'>
export type CreateExpenseCategoryInput = TablesInsert<'expense_categories'>

export type ExpenseRow = Tables<'expenses'>
export type CreateExpenseInput = TablesInsert<'expenses'>
export type UpdateExpenseInput = TablesUpdate<'expenses'>

export type InvoiceRow = Tables<'invoices'>
export type CreateInvoiceInput = TablesInsert<'invoices'>
export type UpdateInvoiceInput = TablesUpdate<'invoices'>

export type InvoiceItemRow = Tables<'invoice_items'>
export type CreateInvoiceItemInput = TablesInsert<'invoice_items'>

export type LedgerEntryRow = Tables<'accounting_ledger_entries'>
export type CreateLedgerEntryInput = TablesInsert<'accounting_ledger_entries'>

export type AccountingSettingRow = Tables<'accounting_settings'>

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'partially_refunded' | 'paid' | 'overdue' | 'void' | 'refunded'
export type InvoiceItemType = 'room_charge' | 'extra_service' | 'minibar' | 'laundry' | 'restaurant' | 'late_checkout' | 'early_check_in' | 'damage_fee' | 'cleaning_fee' | 'parking' | 'transportation' | 'discount' | 'tax' | 'service_charge' | 'manual_adjustment' | 'other'
export type LedgerEntryType = 'revenue' | 'payment' | 'expense' | 'refund' | 'adjustment' | 'tax' | 'deposit' | 'reversal'
export type InvoiceEventType = 'created' | 'draft_saved' | 'updated' | 'issued' | 'voided' | 'deleted' | 'payment_recorded' | 'payment_refunded' | 'payment_voided' | 'adjusted' | 'pdf_downloaded' | 'printed' | 'status_changed'
export type LedgerSourceType = 'invoice' | 'payment' | 'expense' | 'booking' | 'manual'
export type ExpenseStatus = 'draft' | 'approved' | 'paid' | 'void'
export type CostCenter = 'rooms' | 'housekeeping' | 'maintenance' | 'salaries' | 'utilities' | 'marketing' | 'admin' | 'food_beverage' | 'other'

export interface Payment {
  id: string
  invoiceId: string
  invoiceNumber: string | null
  method: PaymentMethod
  amount: number
  currency: CurrencyCode
  description: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
  [key: string]: unknown
}

export interface ExpenseCategory {
  id: string
  name: string
  nameAr: string | null
  description: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface Expense {
  id: string
  categoryId: string
  amount: number
  taxAmount: number
  totalAmount: number
  description: string
  date: string
  vendor: string | null
  paymentMethod: string | null
  receiptUrl: string | null
  costCenter: string | null
  status: string
  approvedBy: string | null
  approvedAt: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface Invoice {
  id: string
  contactId: string
  invoiceNumber: string
  reservationId: string | null
  roomId: string | null
  roomNumber: string | null
  amount: number
  subtotal: number
  discount: number
  discountReason: string | null
  taxAmount: number
  serviceCharge: number
  paidAmount: number
  refundedAmount: number
  remainingBalance: number
  status: string
  issueDate: string
  dueDate: string
  paidAt: string | null
  stayCheckIn: string | null
  stayCheckOut: string | null
  notes: string | null
  publicNotes: string | null
  internalNotes: string | null
  guestName: string | null
  companyName: string | null
  currency: string
  billingAddress: string | null
  paymentMethod: string | null
  voidReason: string | null
  voidedAt: string | null
  voidedBy: string | null
  issuedAt: string | null
  issuedBy: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string | null
  updatedAt: string | null
  items?: InvoiceItem[]
  contact?: { name: string; type: string; email?: string; phone?: string }
  booking?: { guest_name?: string; check_in?: string; check_out?: string; room_number?: string; room_type_name?: string; occupancy?: number }
  [key: string]: unknown
}

export interface InvoiceItem {
  id: string
  invoiceId: string
  type: string
  description: string
  quantity: number
  unitPrice: number
  discountAmount: number
  taxAmount: number
  totalPrice: number
  sortOrder: number
  createdAt: string | null
  roomTypeName?: string
  occupancy?: number
}

export interface InvoiceEvent {
  id: string
  invoiceId: string
  eventType: string
  actorId: string | null
  oldStatus: string | null
  newStatus: string | null
  amountChanged: number | null
  reason: string | null
  metadata: Record<string, unknown> | null
  createdAt: string | null
}

export interface LedgerEntry {
  id: string
  transactionNumber: string
  type: string
  sourceType: string
  sourceId: string | null
  invoiceId: string | null
  invoiceNumber: string | null
  incomeAmount: number
  outcomeAmount: number
  currency: string
  accountCategory: string | null
  description: string
  transactionDate: string
  createdBy: string | null
  metadata: Record<string, unknown> | null
  reversalOfTransactionId: string | null
  createdAt: string | null
  [key: string]: unknown
}

export interface FinanceRow {
  contactId: string
  contactName: string
  contactType: string
  invoiceCount: number
  totalInvoiced: Money
  totalPaid: Money
  balance: Money
}

export interface FinancialHealth {
  totalRevenue: Money
  totalExpenses: Money
  netBalance: Money
  outstanding: Money
}

export interface AccountingOverview {
  todayRevenue: Money
  monthToDateRevenue: Money
  outstandingBalance: Money
  paidInvoices: number
  unpaidInvoices: number
  totalExpenses: Money
  netProfit: Money
  cashCollectedToday: Money
  cardPaymentsToday: Money
  bankPaymentsToday: Money
  onlinePaymentsToday: Money
  depositsHeld: Money
  totalRefunds: Money
  occupancyRate: number | null
  averageDailyRate: number | null
  revPAR: number | null
}

export interface ReportInvoiceDetail {
  id: string
  invoiceNumber: string
  guestName: string | null
  companyName: string | null
  roomNumber: string | null
  amount: number
  paidAmount: number
  refundedAmount: number
  remainingBalance: number
  currency: string
  status: string
  issueDate: string
  paymentMethod: string | null
}

export interface ReportExpenseDetail {
  id: string
  description: string
  categoryName: string | null
  amount: number
  taxAmount: number
  totalAmount: number
  vendor: string | null
  costCenter: string | null
  paymentMethod: string | null
  status: string
  date: string
}

export interface DailyRevenueReport {
  date: string
  roomRevenue: Money
  extraServices: Money
  taxCollected: Money
  totalRevenue: Money
  expenses: Money
  netRevenue: Money
  payments: { method: string; amount: Money }[]
  occupancyCount: number
  invoices: ReportInvoiceDetail[]
  expenseDetails: ReportExpenseDetail[]
}

export interface MonthlyRevenueReport {
  month: string
  roomRevenue: Money
  otherRevenue: Money
  totalRevenue: Money
  expenses: Money
  netProfit: Money
  occupancyRate: number
  averageDailyRate: number
  invoices: ReportInvoiceDetail[]
  expenseDetails: ReportExpenseDetail[]
}

export interface AccountsReceivableAging {
  current: Money
  days1to30: Money
  days31to60: Money
  days61plus: Money
  total: Money
}

export interface InvoiceContactLookup {
  email: string | null
  id: string
  name: string
  phone: string | null
  type: string
}

export interface InvoiceBookingLookup {
  checkIn: string
  checkOut: string
  contactId: string | null
  contactName: string | null
  companyName: string | null
  guestName: string
  id: string
  roomId: string | null
  roomNumber: string | null
  roomTypeName: string | null
  status: string
  nights: number
  totalAmount: number | null
  paidAmount: number | null
  /** The reservation's currency; its invoice must use it. */
  currency: string
}

export interface InvoiceRoomLookup {
  floor: number
  id: string
  number: string
  status: string
}

export interface InvoiceFormLookups {
  bookings: InvoiceBookingLookup[]
  contacts: InvoiceContactLookup[]
  rooms: InvoiceRoomLookup[]
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  issued: 'Open',
  partially_paid: 'Partially Paid',
  partially_refunded: 'Partially Refunded',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
  refunded: 'Refunded',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  instapay: 'InstaPay',
  vodafone_cash: 'Vodafone Cash',
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  visa: 'Visa',
  card: 'Card',
  online: 'Online',
  ota: 'OTA',
  company_credit: 'Company Credit',
  other: 'Other',
}

export const INVOICE_ITEM_TYPE_LABELS: Record<string, string> = {
  room_charge: 'Room Charge',
  extra_service: 'Extra Service',
  minibar: 'Minibar',
  laundry: 'Laundry',
  restaurant: 'Restaurant',
  late_checkout: 'Late Checkout',
  early_check_in: 'Early Check-In',
  damage_fee: 'Damage Fee',
  cleaning_fee: 'Cleaning Fee',
  parking: 'Parking',
  transportation: 'Transportation',
  discount: 'Discount',
  tax: 'Tax',
  service_charge: 'Service Charge',
  manual_adjustment: 'Manual Adjustment',
  other: 'Other',
}

export const COST_CENTER_LABELS: Record<string, string> = {
  rooms: 'Rooms',
  housekeeping: 'Housekeeping',
  maintenance: 'Maintenance',
  salaries: 'Salaries',
  utilities: 'Utilities',
  marketing: 'Marketing',
  admin: 'Admin',
  food_beverage: 'Food & Beverage',
  other: 'Other',
}

export const LEDGER_TYPE_LABELS: Record<string, string> = {
  revenue: 'Revenue',
  payment: 'Payment',
  expense: 'Expense',
  refund: 'Refund',
  adjustment: 'Adjustment',
  tax: 'Tax',
  deposit: 'Deposit',
  reversal: 'Reversal',
}

export function mapPaymentRow(row: PaymentRow): Payment {
  const joined = row as PaymentRow & { invoices?: { invoice_number?: string | null } | null }
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    invoiceNumber: joined.invoices?.invoice_number ?? null,
    method: row.method,
    amount: Number(row.amount),
    currency: row.currency as CurrencyCode,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapExpenseCategoryRow(row: ExpenseCategoryRow): ExpenseCategory {
  return {
    id: row.id,
    name: row.name,
    nameAr: row.name_ar,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapExpenseRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    categoryId: row.category_id,
    amount: Number(row.amount),
    taxAmount: Number(row.tax_amount ?? 0),
    totalAmount: Number(row.total_amount ?? row.amount),
    description: row.description,
    date: row.date,
    vendor: row.vendor,
    paymentMethod: row.payment_method,
    receiptUrl: row.receipt_url,
    costCenter: row.cost_center,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapInvoiceRow(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    contactId: row.contact_id,
    invoiceNumber: row.invoice_number,
    reservationId: row.reservation_id,
    roomId: row.room_id,
    roomNumber: row.room_number,
    amount: Number(row.amount),
    subtotal: Number(row.subtotal ?? 0),
    discount: Number(row.discount ?? 0),
    discountReason: row.discount_reason ?? null,
    taxAmount: Number(row.tax_amount ?? 0),
    serviceCharge: Number(row.service_charge ?? 0),
    paidAmount: Number(row.paid_amount ?? 0),
    refundedAmount: Number(row.refunded_amount ?? 0),
    remainingBalance: Number(row.remaining_balance ?? 0),
    status: row.status,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    paidAt: row.paid_at,
    stayCheckIn: row.stay_check_in,
    stayCheckOut: row.stay_check_out,
    notes: row.notes,
    publicNotes: row.public_notes,
    internalNotes: row.internal_notes,
    guestName: row.guest_name,
    companyName: row.company_name,
    currency: row.currency ?? 'EGP',
    billingAddress: row.billing_address,
    paymentMethod: row.payment_method,
    voidReason: row.void_reason,
    voidedAt: row.voided_at,
    voidedBy: row.voided_by,
    issuedAt: row.issued_at,
    issuedBy: row.issued_by,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapInvoiceItemRow(row: InvoiceItemRow): InvoiceItem {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    type: row.type,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    discountAmount: Number(row.discount_amount ?? 0),
    taxAmount: Number(row.tax_amount ?? 0),
    totalPrice: Number(row.total_price),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at,
  }
}

export function mapInvoiceEventRow(row: {
  id: string; invoice_id: string; event_type: string; actor_id: string | null;
  old_status: string | null; new_status: string | null; amount_changed: number | null;
  reason: string | null; metadata: unknown; created_at: string | null
}): InvoiceEvent {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    eventType: row.event_type,
    actorId: row.actor_id,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    amountChanged: row.amount_changed ? Number(row.amount_changed) : null,
    reason: row.reason,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.created_at,
  }
}

export function mapLedgerEntryRow(row: LedgerEntryRow): LedgerEntry {
  const joined = row as LedgerEntryRow & { invoices?: { invoice_number?: string | null } | null }
  return {
    id: row.id,
    transactionNumber: row.transaction_number,
    type: row.type,
    sourceType: row.source_type,
    sourceId: row.source_id,
    invoiceId: row.invoice_id ?? null,
    invoiceNumber: joined.invoices?.invoice_number ?? null,
    incomeAmount: Number(row.income_amount),
    outcomeAmount: Number(row.outcome_amount),
    currency: row.currency,
    accountCategory: row.account_category,
    description: row.description,
    transactionDate: row.transaction_date,
    createdBy: row.created_by,
    metadata: row.metadata as Record<string, unknown> | null,
    reversalOfTransactionId: row.reversal_of_transaction_id,
    createdAt: row.created_at,
  }
}

// ── Wizard types ──────────────────────────────────────────

export type WizardMode = 'from-booking' | 'checkout' | 'manual' | 'edit-draft'

export interface WizardItem {
  type: InvoiceItemType
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  discountAmount: number
  taxAmount: number
  originalPrice?: number
}

export interface WizardPayment {
  amount: number
  method: PaymentMethod
}

export interface WizardDiscount {
  type: 'percentage' | 'fixed'
  value: number
  reason: string
  approvedBy: string | null
}

export interface BookingWarning {
  type: string
  severity: 'info' | 'warning' | 'error'
  message: string
  actions?: { label: string; action: string; payload?: Record<string, unknown> }[]
}

export type WizardStep = 'select-booking' | 'review-charges' | 'payment-notes' | 'confirm'

export interface WizardState {
  mode: WizardMode
  step: number
  selectedBooking: InvoiceBookingLookup | null
  contactId: string
  guestName: string
  companyName: string
  roomId: string
  roomNumber: string
  bookingId: string
  items: WizardItem[]
  issueDate: string
  dueDate: string
  status: 'draft' | 'issued'
  recordPayment: boolean
  payments: WizardPayment[]
  applyDeposit: boolean
  depositAmount: number
  discount: WizardDiscount | null
  serviceCharge: number
  taxRate: number
  publicNotes: string
  internalNotes: string
  warnings: BookingWarning[]
  errors: Record<string, string>
  saving: boolean
  lookups: InvoiceFormLookups
  lookupsLoading: boolean
  hasExistingInvoices: boolean
  existingInvoiceIds: string[]
  priceOverrides: { itemIndex: number; original: number }[]
}
