'use client'

import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  fetchFinanceTableData,
  fetchFinancialHealthData,
  fetchExpenseCategoriesData,
  fetchAccountingOverviewData,
  fetchInvoicesData,
  fetchLedgerEntriesData,
  fetchSettingsData,
  selectFinanceTable,
  selectFinancialHealth,
  selectExpenseCategories,
  selectOverview,
  selectInvoices,
  selectLedgerEntries,
  selectSettings,
  selectNextInvoiceNumber,
  selectAccountingLoading,
  selectAccountingError,
} from '../store/accountingSlice'

export function useAccounting() {
  const dispatch = useAppDispatch()
  const financeTable = useAppSelector(selectFinanceTable)
  const financialHealth = useAppSelector(selectFinancialHealth)
  const expenseCategories = useAppSelector(selectExpenseCategories)
  const overview = useAppSelector(selectOverview)
  const invoices = useAppSelector(selectInvoices)
  const ledgerEntries = useAppSelector(selectLedgerEntries)
  const settings = useAppSelector(selectSettings)
  const nextInvoiceNumber = useAppSelector(selectNextInvoiceNumber)
  const loading = useAppSelector(selectAccountingLoading)
  const error = useAppSelector(selectAccountingError)

  const loadFinanceTable = useCallback(
    (dateParams?: { fromDate?: string; toDate?: string }) => dispatch(fetchFinanceTableData(dateParams)),
    [dispatch],
  )
  const loadFinancialHealth = useCallback(
    (dateParams?: { fromDate?: string; toDate?: string }) => dispatch(fetchFinancialHealthData(dateParams)),
    [dispatch],
  )
  const loadExpenseCategories = useCallback(() => dispatch(fetchExpenseCategoriesData()), [dispatch])
  const loadOverview = useCallback(() => dispatch(fetchAccountingOverviewData()), [dispatch])
  const loadInvoices = useCallback((params?: Record<string, string>) => dispatch(fetchInvoicesData(params)), [dispatch])
  const loadLedger = useCallback((params?: Record<string, string>) => dispatch(fetchLedgerEntriesData(params)), [dispatch])
  const loadSettings = useCallback(() => dispatch(fetchSettingsData()), [dispatch])

  return {
    financeTable,
    financialHealth,
    expenseCategories,
    overview,
    invoices,
    ledgerEntries,
    settings,
    nextInvoiceNumber,
    loading,
    error,
    loadFinanceTable,
    loadFinancialHealth,
    loadExpenseCategories,
    loadOverview,
    loadInvoices,
    loadLedger,
    loadSettings,
  }
}
