import { createCrudApiClient } from '@/shared/crud'
import type {
  Payment, CreatePaymentInput, Expense, CreateExpenseInput,
  ExpenseCategory, CreateExpenseCategoryInput,
  FinanceRow, FinancialHealth, AccountingOverview,
  Invoice, CreateInvoiceInput, UpdateInvoiceInput,
  InvoiceEvent, LedgerEntry, InvoiceItem, InvoiceFormLookups,
} from '../types'

const paymentsCrud = createCrudApiClient<Payment, CreatePaymentInput>({
  endpoint: '/api/accounting/payments',
  defaultError: 'Failed to manage payments',
})

const expensesCrud = createCrudApiClient<Expense, CreateExpenseInput>({
  endpoint: '/api/accounting/expenses',
  defaultError: 'Failed to manage expenses',
})

const expenseCategoriesCrud = createCrudApiClient<ExpenseCategory, CreateExpenseCategoryInput>({
  endpoint: '/api/accounting/expense-categories',
  defaultError: 'Failed to load expense categories',
})

export const fetchPaymentsByInvoice = (invoiceId: string) =>
  paymentsCrud.list({ invoiceId } as Record<string, string>)

export const createPaymentApi = paymentsCrud.create
export const deletePaymentApi = paymentsCrud.delete

export const fetchExpenses = expensesCrud.list
export const createExpenseApi = expensesCrud.create
export const deleteExpenseApi = (id: string) =>
  expensesCrud.request('', { method: 'DELETE', query: { id } })

export const fetchExpenseCategories = expenseCategoriesCrud.list
export const createExpenseCategoryApi = expenseCategoriesCrud.create
export const deleteExpenseCategoryApi = (id: string) =>
  expenseCategoriesCrud.request('', { method: 'DELETE', query: { id } })

export async function fetchFinanceTable(dateParams?: { fromDate?: string; toDate?: string }): Promise<FinanceRow[]> {
  const params = new URLSearchParams()
  if (dateParams?.fromDate) params.set('fromDate', dateParams.fromDate)
  if (dateParams?.toDate) params.set('toDate', dateParams.toDate)
  const qs = params.toString()
  const res = await fetch(`/api/accounting/finance${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error('Failed to load finance data')
  const json = await res.json()
  return json.data ?? json
}

export async function fetchFinancialHealth(dateParams?: { fromDate?: string; toDate?: string }): Promise<FinancialHealth> {
  const params = new URLSearchParams({ type: 'health' })
  if (dateParams?.fromDate) params.set('fromDate', dateParams.fromDate)
  if (dateParams?.toDate) params.set('toDate', dateParams.toDate)
  const res = await fetch(`/api/accounting/finance?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to load financial health')
  const json = await res.json()
  return json.data ?? json
}

export async function fetchAccountingOverview(): Promise<AccountingOverview> {
  const res = await fetch('/api/accounting/overview')
  if (!res.ok) throw new Error('Failed to load overview')
  const json = await res.json()
  return json.data ?? json
}

export async function fetchInvoices(params?: Record<string, string>): Promise<Invoice[]> {
  const qs = params ? new URLSearchParams(params).toString() : ''
  const res = await fetch(`/api/accounting/invoices${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error('Failed to load invoices')
  const json = await res.json()
  return json.data ?? json
}

export async function fetchInvoiceById(id: string): Promise<Invoice & { items: InvoiceItem[] }> {
  const res = await fetch(`/api/accounting/invoices/${id}`)
  if (!res.ok) throw new Error('Failed to load invoice')
  const json = await res.json()
  return json.data ?? json
}

async function invoiceApiError(response: Response, fallback: string) {
  const json = await response.json().catch(() => null)
  return new Error(json?.error ?? fallback)
}

export async function createInvoiceApi(input: CreateInvoiceInput): Promise<Invoice> {
  const res = await fetch('/api/accounting/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw await invoiceApiError(res, 'Failed to create invoice')
  const json = await res.json()
  return json.data ?? json
}

export async function updateInvoiceApi(id: string, input: UpdateInvoiceInput): Promise<Invoice> {
  const res = await fetch(`/api/accounting/invoices/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw await invoiceApiError(res, 'Failed to update invoice')
  const json = await res.json()
  return json.data ?? json
}

export async function fetchInvoiceFormLookups(signal?: AbortSignal): Promise<InvoiceFormLookups> {
  const res = await fetch('/api/accounting/lookups', { signal })
  if (!res.ok) throw new Error('Failed to load invoice lookups')
  const json = await res.json()
  return json.data ?? json
}

export async function fetchLedgerEntries(params?: Record<string, string>): Promise<LedgerEntry[]> {
  const qs = params ? new URLSearchParams(params).toString() : ''
  const res = await fetch(`/api/accounting/ledger${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error('Failed to load ledger')
  const json = await res.json()
  return json.data ?? json
}

export async function fetchReport(type: string, params?: Record<string, string>): Promise<unknown> {
  const qs = params ? new URLSearchParams(params).toString() : ''
  const res = await fetch(`/api/accounting/reports/${type}${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error('Failed to load report')
  const json = await res.json()
  return json.data ?? json
}

export async function fetchAccountingSettings(): Promise<{ key: string; value: Record<string, unknown>; description: string | null }[]> {
  const res = await fetch('/api/accounting/settings')
  if (!res.ok) throw new Error('Failed to load settings')
  const json = await res.json()
  return json.data ?? json
}

export async function updateAccountingSettingApi(key: string, value: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/accounting/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
  if (!res.ok) throw new Error('Failed to update setting')
}

export async function deleteInvoiceApi(id: string): Promise<void> {
  const res = await fetch(`/api/accounting/invoices/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw await invoiceApiError(res, 'Failed to delete invoice')
}

export async function getNextInvoiceNumberApi(): Promise<string> {
  const res = await fetch('/api/accounting/invoices/next-number')
  if (!res.ok) throw new Error('Failed to get next invoice number')
  const json = await res.json()
  return json.data ?? json
}

export async function fetchInvoiceLedger(invoiceId: string): Promise<LedgerEntry[]> {
  const res = await fetch(`/api/accounting/invoices/${invoiceId}/ledger`)
  if (!res.ok) throw new Error('Failed to load invoice ledger')
  const json = await res.json()
  return json.data ?? json
}

export async function fetchInvoiceEvents(invoiceId: string): Promise<InvoiceEvent[]> {
  const res = await fetch(`/api/accounting/invoices/${invoiceId}/events`)
  if (!res.ok) throw new Error('Failed to load invoice events')
  const json = await res.json()
  return json.data ?? json
}
