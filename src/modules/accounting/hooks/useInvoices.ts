'use client'

import { useEffect, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  fetchInvoicesData,
  fetchInvoiceByIdData,
  fetchInvoiceLedgerData,
  fetchInvoiceEventsData,
  createInvoiceThunk,
  updateInvoiceThunk,
  deleteInvoiceThunk,
  fetchNextInvoiceNumberData,
  clearCurrentInvoice,
  selectInvoices,
  selectInvoicesTotal,
  selectCurrentInvoice,
  selectInvoiceLedger,
  selectInvoiceEvents,
  selectNextInvoiceNumber,
  selectAccountingLoading,
} from '../store/accountingSlice'
import type { CreateInvoiceInput, UpdateInvoiceInput } from '../types'

export function useInvoices(filters?: Record<string, string>) {
  const dispatch = useAppDispatch()
  const invoices = useAppSelector(selectInvoices)
  const invoicesTotal = useAppSelector(selectInvoicesTotal)
  const currentInvoice = useAppSelector(selectCurrentInvoice)
  const invoiceLedger = useAppSelector(selectInvoiceLedger)
  const invoiceEvents = useAppSelector(selectInvoiceEvents)
  const nextInvoiceNumber = useAppSelector(selectNextInvoiceNumber)
  const loading = useAppSelector(selectAccountingLoading)

  useEffect(() => {
    dispatch(fetchInvoicesData(filters))
  }, [dispatch, JSON.stringify(filters)])

  const loadById = useCallback((id: string) => dispatch(fetchInvoiceByIdData(id)), [dispatch])
  const loadLedger = useCallback((id: string) => dispatch(fetchInvoiceLedgerData(id)), [dispatch])
  const loadEvents = useCallback((id: string) => dispatch(fetchInvoiceEventsData(id)), [dispatch])
  const create = useCallback((input: CreateInvoiceInput) => dispatch(createInvoiceThunk(input)).unwrap(), [dispatch])
  const update = useCallback((id: string, input: UpdateInvoiceInput) => dispatch(updateInvoiceThunk({ id, input })).unwrap(), [dispatch])
  const remove = useCallback((id: string) => dispatch(deleteInvoiceThunk(id)).unwrap(), [dispatch])
  const getNextNumber = useCallback(() => dispatch(fetchNextInvoiceNumberData()), [dispatch])
  const clearCurrent = useCallback(() => dispatch(clearCurrentInvoice()), [dispatch])
  const refresh = useCallback((f?: Record<string, string>) => dispatch(fetchInvoicesData(f)), [dispatch])

  return {
    invoices,
    invoicesTotal,
    currentInvoice,
    invoiceLedger,
    invoiceEvents,
    nextInvoiceNumber,
    loading,
    loadById,
    loadLedger,
    loadEvents,
    create,
    update,
    remove,
    getNextNumber,
    clearCurrent,
    refresh,
  }
}
