import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'
import type {
  Payment, Expense, ExpenseCategory, FinanceRow, FinancialHealth,
  AccountingOverview, Invoice, LedgerEntry, InvoiceItem, InvoiceEvent,
  CreatePaymentInput, CreateExpenseInput, CreateExpenseCategoryInput,
  CreateInvoiceInput, UpdateInvoiceInput,
} from '../types'
import * as api from '../services/accountingApiClient'
import { fetchInvoiceLedger as fetchLedgerApi, fetchInvoiceEvents as fetchEventsApi } from '../services/accountingApiClient'
import { deriveInvoiceStatus } from '../services/deriveInvoiceStatus'

interface AccountingState {
  payments: Record<string, Payment[]>
  expenses: Expense[]
  expenseCategories: ExpenseCategory[]
  financeTable: FinanceRow[]
  financialHealth: FinancialHealth | null
  overview: AccountingOverview | null
  invoices: Invoice[]
  invoicesTotal: number
  currentInvoice: (Invoice & { items?: InvoiceItem[]; payments?: Payment[]; events?: InvoiceEvent[] }) | null
  invoiceLedger: LedgerEntry[]
  invoiceEvents: InvoiceEvent[]
  ledgerEntries: LedgerEntry[]
  settings: { key: string; value: Record<string, unknown>; description: string | null }[]
  nextInvoiceNumber: string | null
  loading: boolean
  error: string | null
}

const initialState: AccountingState = {
  payments: {},
  expenses: [],
  expenseCategories: [],
  financeTable: [],
  financialHealth: null,
  overview: null,
  invoices: [],
  invoicesTotal: 0,
  currentInvoice: null,
  invoiceLedger: [],
  invoiceEvents: [],
  ledgerEntries: [],
  settings: [],
  nextInvoiceNumber: null,
  loading: false,
  error: null,
}

function applyInvoicePaymentState(invoice: Invoice, payments: Payment[]) {
  const paidAmount = payments.reduce((sum, payment) => sum + Math.max(0, Number(payment.amount)), 0)
  const refundedAmount = payments.reduce((sum, payment) => {
    const amount = Number(payment.amount)
    return amount < 0 ? sum + Math.abs(amount) : sum
  }, 0)
  const grossPaid = paidAmount
  // ponytail: balance_due uses gross_paid only — refunds don't add debt.
  const remainingBalance = Math.max(0, Number(invoice.amount) - grossPaid)
  const currentStatus = invoice.status

  const status = currentStatus === 'void' || currentStatus === 'cancelled'
    ? currentStatus
    : deriveInvoiceStatus({
      invoiceTotal: Number(invoice.amount),
      grossPaid,
      totalRefunded: refundedAmount,
      currentStatus,
    })

  return {
    ...invoice,
    paidAmount: grossPaid,
    refundedAmount,
    remainingBalance,
    status,
  }
}

function refreshInvoicePaymentState(state: AccountingState, invoiceId: string) {
  const payments = state.payments[invoiceId] ?? []
  const invoiceIndex = state.invoices.findIndex((invoice) => invoice.id === invoiceId)

  if (invoiceIndex >= 0) {
    state.invoices[invoiceIndex] = applyInvoicePaymentState(state.invoices[invoiceIndex], payments)
  }

  if (state.currentInvoice?.id === invoiceId) {
    state.currentInvoice = applyInvoicePaymentState(state.currentInvoice, payments)
  }
}

export const fetchFinanceTableData = createAsyncThunk(
  'accounting/fetchFinanceTable',
  async (dateParams?: { fromDate?: string; toDate?: string }) =>
    api.fetchFinanceTable(dateParams)
)

export const fetchFinancialHealthData = createAsyncThunk(
  'accounting/fetchFinancialHealth',
  async (dateParams?: { fromDate?: string; toDate?: string }) =>
    api.fetchFinancialHealth(dateParams)
)

export const fetchPayments = createAsyncThunk('accounting/fetchPayments', async (invoiceId: string) => {
  const payments = await api.fetchPaymentsByInvoice(invoiceId)
  return { invoiceId, payments }
})

export const createPaymentThunk = createAsyncThunk(
  'accounting/createPayment',
  async (input: CreatePaymentInput) => {
    const payment = await api.createPaymentApi(input)
    return payment
  }
)

export const deletePaymentThunk = createAsyncThunk(
  'accounting/deletePayment',
  async ({ id, invoiceId }: { id: string; invoiceId: string }) => {
    await api.deletePaymentApi(id)
    return { id, invoiceId }
  }
)

export const fetchExpensesData = createAsyncThunk(
  'accounting/fetchExpenses',
  async (params?: Record<string, string | undefined>) => {
    const cleanParams: Record<string, string> = {}
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) cleanParams[k] = v
      }
    }
    return api.fetchExpenses(cleanParams)
  }
)

export const createExpenseThunk = createAsyncThunk(
  'accounting/createExpense',
  async (input: CreateExpenseInput) => {
    const expense = await api.createExpenseApi(input)
    return expense
  }
)

export const deleteExpenseThunk = createAsyncThunk(
  'accounting/deleteExpense',
  async (id: string) => {
    await api.deleteExpenseApi(id)
    return id
  }
)

export const fetchExpenseCategoriesData = createAsyncThunk('accounting/fetchExpenseCategories', async () =>
  api.fetchExpenseCategories()
)

export const createExpenseCategoryThunk = createAsyncThunk(
  'accounting/createExpenseCategory',
  async (input: CreateExpenseCategoryInput) => {
    const category = await api.createExpenseCategoryApi(input)
    return category
  }
)

export const deleteExpenseCategoryThunk = createAsyncThunk(
  'accounting/deleteExpenseCategory',
  async (id: string) => {
    await api.deleteExpenseCategoryApi(id)
    return id
  }
)

export const fetchAccountingOverviewData = createAsyncThunk(
  'accounting/fetchOverview',
  async () => api.fetchAccountingOverview()
)

export const fetchInvoicesData = createAsyncThunk(
  'accounting/fetchInvoices',
  async (params?: Record<string, string>) => api.fetchInvoices(params)
)

export const fetchInvoiceLedgerData = createAsyncThunk(
  'accounting/fetchInvoiceLedger',
  async (invoiceId: string) => fetchLedgerApi(invoiceId)
)

export const fetchInvoiceEventsData = createAsyncThunk(
  'accounting/fetchInvoiceEvents',
  async (invoiceId: string) => fetchEventsApi(invoiceId)
)

export const fetchInvoiceByIdData = createAsyncThunk(
  'accounting/fetchInvoiceById',
  async (id: string) => api.fetchInvoiceById(id)
)

export const createInvoiceThunk = createAsyncThunk(
  'accounting/createInvoice',
  async (input: CreateInvoiceInput) => {
    const invoice = await api.createInvoiceApi(input)
    return invoice
  }
)

export const updateInvoiceThunk = createAsyncThunk(
  'accounting/updateInvoice',
  async ({ id, input }: { id: string; input: UpdateInvoiceInput }) => {
    const invoice = await api.updateInvoiceApi(id, input)
    return invoice
  }
)

export const fetchLedgerEntriesData = createAsyncThunk(
  'accounting/fetchLedger',
  async (params?: Record<string, string>) => api.fetchLedgerEntries(params)
)

export const fetchSettingsData = createAsyncThunk(
  'accounting/fetchSettings',
  async () => api.fetchAccountingSettings()
)

export const deleteInvoiceThunk = createAsyncThunk(
  'accounting/deleteInvoice',
  async (id: string) => {
    await api.deleteInvoiceApi(id)
    return id
  }
)

export const fetchNextInvoiceNumberData = createAsyncThunk(
  'accounting/fetchNextInvoiceNumber',
  async () => api.getNextInvoiceNumberApi()
)

const accountingSlice = createSlice({
  name: 'accounting',
  initialState,
  reducers: {
    clearCurrentInvoice(state) {
      state.currentInvoice = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFinanceTableData.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchFinanceTableData.fulfilled, (state, action) => { state.loading = false; state.financeTable = action.payload })
      .addCase(fetchFinanceTableData.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load' })

      .addCase(fetchFinancialHealthData.fulfilled, (state, action) => { state.financialHealth = action.payload })

      .addCase(fetchPayments.fulfilled, (state, action) => {
        state.payments[action.payload.invoiceId] = action.payload.payments
        refreshInvoicePaymentState(state, action.payload.invoiceId)
      })
      .addCase(createPaymentThunk.fulfilled, (state, action) => {
        const p = action.payload
        const existing = state.payments[p.invoiceId] ?? []
        state.payments[p.invoiceId] = [...existing, p]
        refreshInvoicePaymentState(state, p.invoiceId)
      })
      .addCase(deletePaymentThunk.fulfilled, (state, action) => {
        const { id, invoiceId } = action.payload
        state.payments[invoiceId] = (state.payments[invoiceId] ?? []).filter((p) => p.id !== id)
        refreshInvoicePaymentState(state, invoiceId)
      })

      .addCase(fetchExpensesData.fulfilled, (state, action) => { state.expenses = action.payload })
      .addCase(createExpenseThunk.fulfilled, (state, action) => { state.expenses.unshift(action.payload) })
      .addCase(deleteExpenseThunk.fulfilled, (state, action) => {
        state.expenses = state.expenses.filter((e) => e.id !== action.payload)
      })

      .addCase(fetchExpenseCategoriesData.fulfilled, (state, action) => { state.expenseCategories = action.payload })
      .addCase(createExpenseCategoryThunk.fulfilled, (state, action) => { state.expenseCategories.unshift(action.payload) })
      .addCase(deleteExpenseCategoryThunk.fulfilled, (state, action) => {
        state.expenseCategories = state.expenseCategories.filter((c) => c.id !== action.payload)
      })

      .addCase(fetchAccountingOverviewData.pending, (state) => { state.loading = true })
      .addCase(fetchAccountingOverviewData.fulfilled, (state, action) => { state.loading = false; state.overview = action.payload })
      .addCase(fetchAccountingOverviewData.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Failed to load' })

      .addCase(fetchInvoicesData.fulfilled, (state, action) => {
        if (Array.isArray(action.payload)) {
          state.invoices = action.payload
          state.invoicesTotal = action.payload.length
        } else {
          const result = action.payload as { data: Invoice[]; total: number }
          state.invoices = result.data
          state.invoicesTotal = result.total
        }
      })
      .addCase(fetchInvoiceByIdData.fulfilled, (state, action) => {
        state.currentInvoice = action.payload
        const idx = state.invoices.findIndex((invoice) => invoice.id === action.payload.id)
        if (idx >= 0) state.invoices[idx] = { ...state.invoices[idx], ...action.payload }
        if (Array.isArray(action.payload.payments)) {
          state.payments[action.payload.id] = action.payload.payments as Payment[]
          refreshInvoicePaymentState(state, action.payload.id)
        }
      })
      .addCase(fetchInvoiceLedgerData.fulfilled, (state, action) => { state.invoiceLedger = action.payload })
      .addCase(fetchInvoiceEventsData.fulfilled, (state, action) => { state.invoiceEvents = action.payload })
      .addCase(createInvoiceThunk.fulfilled, (state, action) => { state.invoices.unshift(action.payload) })
      .addCase(updateInvoiceThunk.fulfilled, (state, action) => {
        const idx = state.invoices.findIndex((i) => i.id === action.payload.id)
        if (idx >= 0) state.invoices[idx] = action.payload
        if (state.currentInvoice?.id === action.payload.id) {
          state.currentInvoice = { ...state.currentInvoice, ...action.payload }
        }
      })
      .addCase(deleteInvoiceThunk.fulfilled, (state, action) => {
        state.invoices = state.invoices.filter((i) => i.id !== action.payload)
      })

      .addCase(fetchLedgerEntriesData.fulfilled, (state, action) => { state.ledgerEntries = action.payload })

      .addCase(fetchSettingsData.fulfilled, (state, action) => { state.settings = action.payload })

      .addCase(fetchNextInvoiceNumberData.fulfilled, (state, action) => { state.nextInvoiceNumber = action.payload })
  },
})

export const { clearCurrentInvoice } = accountingSlice.actions
export default accountingSlice.reducer

interface SliceState {
  accounting: AccountingState
}
export const selectAccountingState = (state: SliceState) => state.accounting
export const selectAccountingLoading = createSelector(selectAccountingState, (s) => s.loading)
export const selectAccountingError = createSelector(selectAccountingState, (s) => s.error)
export const selectFinanceTable = createSelector(selectAccountingState, (s) => s.financeTable)
export const selectFinancialHealth = createSelector(selectAccountingState, (s) => s.financialHealth)
export const selectExpenseCategories = createSelector(selectAccountingState, (s) => s.expenseCategories)
export const selectOverview = createSelector(selectAccountingState, (s) => s.overview)
export const selectInvoices = createSelector(selectAccountingState, (s) => s.invoices)
export const selectInvoicesTotal = createSelector(selectAccountingState, (s) => s.invoicesTotal)
export const selectCurrentInvoice = createSelector(selectAccountingState, (s) => s.currentInvoice)
export const selectInvoiceLedger = createSelector(selectAccountingState, (s) => s.invoiceLedger)
export const selectInvoiceEvents = createSelector(selectAccountingState, (s) => s.invoiceEvents)
export const selectLedgerEntries = createSelector(selectAccountingState, (s) => s.ledgerEntries)
export const selectSettings = createSelector(selectAccountingState, (s) => s.settings)
export const selectNextInvoiceNumber = createSelector(selectAccountingState, (s) => s.nextInvoiceNumber)
export const selectPayments = createSelector(selectAccountingState, (s) => s.payments)
export const selectExpenses = createSelector(selectAccountingState, (s) => s.expenses)
